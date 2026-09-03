<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Http\Controllers\Concerns\StoresNamesInUpperCase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PatientController extends Controller
{
    use StoresNamesInUpperCase;

    public function index(Request $request)
    {
        $query = Patient::query();

        if ($request->user()->role !== 'super_admin') {
            $query->where('hospital_id', $request->user()->hospital_id);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        // Doctor scope: patients are linked to doctors via appointments.
        //
        // Unless the doctor has been granted patient access outright. Granting
        // "Patients -> View" to a doctor role had no effect before: the
        // appointment join below is applied independently of permissions, so a
        // clinic whose patients have no appointments yet showed the doctor an
        // empty list however the role was configured -- and a doctor writing a
        // prescription needs to pick any registered patient, not only the ones
        // already booked with them.
        // roleGrantsPermission, not hasAnyPermission: the latter falls back to a
        // built-in list in which 'doctor' already implies view_patients, so it
        // is true for every doctor and would have lifted the restriction for
        // all of them. This asks the narrower question -- did an administrator
        // tick Patients -> View on this doctor's role -- which is exactly the
        // act that should widen the scope.
        $seesAllHospitalPatients = $request->user()->role === 'doctor'
            && method_exists($request->user(), 'roleGrantsPermission')
            && $request->user()->roleGrantsPermission(['view_patients', 'manage_patients']);

        if ($request->user()->role === 'doctor' && !$seesAllHospitalPatients) {
            // `appointments.doctor_id` holds a users.id since the
            // *_doctor_fk_to_users migrations, but rows created before that
            // still hold the legacy doctors.id. Match either so a doctor sees
            // their patients regardless of when the appointment was booked.
            // Preferring doctor_id here was a bug: it resolved to the legacy
            // profile id, matched nothing, and left the patient picker empty.
            $doctorIds = array_values(array_unique(array_filter([
                (int) $request->user()->id,
                (int) ($request->user()->doctor_id ?? 0),
            ])));

            $allowedStatuses = ['scheduled', 'completed', 'cancelled', 'no_show'];
            $status = $request->filled('appointment_status') ? (string) $request->input('appointment_status') : null;
            $status = $status !== null ? strtolower(trim($status)) : null;

            if (!empty($doctorIds)) {
                $query->whereIn('id', function ($q) use ($doctorIds, $status, $allowedStatuses) {
                    $q->select('patient_id')
                        ->from('appointments')
                        ->whereIn('doctor_id', $doctorIds)
                        ->whereNotNull('patient_id')
                        ->distinct();

                    if ($status !== null && in_array($status, $allowedStatuses, true)) {
                        $q->where('status', $status);
                    }
                });
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('patient_id', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }

        // Pagination is retained so no single query/response is huge; clients that
        // need the full list page through it. The ceiling is only a memory guard.
        $perPage = max(1, min($request->integer('per_page', 25), 1000));
        // Newest registration first: the patient a receptionist just entered is
        // the one they are about to act on, and alphabetical order buried it.
        // id tiebreaker because created_at alone is non-deterministic for rows
        // saved in the same second, which can drop or repeat them across pages.
        $patients = $query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage);
        $patients->setCollection(
            $patients->getCollection()->map(fn ($patient) => $this->withMediaUrls($patient))
        );

        return response()->json($patients);
    }

    public function store(Request $request)
    {
        $this->authorizePatientAction($request->user(), ['add_patients', 'register_patients', 'manage_patients']);

        $actor = $request->user();
        $hospitalId = $actor->role !== 'super_admin'
            ? $actor->hospital_id
            : $request->integer('hospital_id');

        if ($actor->role === 'super_admin' && empty($hospitalId)) {
            return response()->json(['message' => 'hospital_id is required'], 422);
        }

        $data = $this->validatePayload($request, null, (int) $hospitalId);
        $data['hospital_id'] = $hospitalId;
        $data['patient_id'] = null;
        // Attribution is stamped server-side so the client cannot claim to be
        // someone else.
        $data['created_by'] = $actor?->name;
        $data['updated_by'] = $actor?->name;

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('patients/images', 'public');
        }

        $patient = Patient::create($data);

        return response()->json($this->withMediaUrls($patient), 201);
    }

    public function show(Request $request, Patient $patient)
    {
        $this->authorizeScope($request->user(), $patient);

        return response()->json($this->withMediaUrls($patient));
    }

    public function update(Request $request, Patient $patient)
    {
        $this->authorizePatientAction($request->user(), ['edit_patients', 'manage_patients']);
        $this->authorizeScope($request->user(), $patient);

        $data = $this->validatePayload($request, $patient->id, (int) $patient->hospital_id);
        $data['updated_by'] = $request->user()?->name;

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('patients/images', 'public');
        }

        $patient->update($data);

        return response()->json($this->withMediaUrls($patient->fresh()));
    }

    public function destroy(Request $request, Patient $patient)
    {
        $this->authorizePatientAction($request->user(), ['delete_patients', 'manage_patients']);
        $this->authorizeScope($request->user(), $patient);

        $patient->delete();

        return response()->json(['message' => 'Patient deleted']);
    }

    private function authorizePatientAction($user, array $permissions): void
    {
        $this->ensureAnyPermission($user, $permissions, 'Only users with patient permissions can manage patients');
    }

    private function authorizeScope($user, Patient $patient): void
    {
        if ($user->role !== 'super_admin' && $user->hospital_id !== $patient->hospital_id) {
            abort(403, 'Unauthorized patient access');
        }
    }

    private function validatePayload(Request $request, ?int $patientId = null, ?int $hospitalIdForUnique = null): array
    {
        $hospitalId = $hospitalIdForUnique;
        if (!$hospitalId) {
            $hospitalId = $request->user()->role !== 'super_admin'
                ? $request->user()->hospital_id
                : $request->integer('hospital_id');
        }

        $patientIdRule = $patientId === null
            ? ['nullable', 'string', 'max:50']
            : ['required', 'string', 'max:50'];

        $data = $request->validate([
            'hospital_id' => ['sometimes', 'required', 'exists:hospitals,id'],
            'patient_id' => [
                ...$patientIdRule,
                Rule::unique('patients', 'patient_id')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->ignore($patientId),
            ],
            'name' => ['required', 'string', 'max:255'],
            'age' => ['nullable', 'integer', 'min:0', 'max:150'],
            // The unit the number was given in. Stored as said rather than
            // converted, so "15 months" stays 15 months everywhere it appears.
            'age_unit' => ['nullable', 'in:year,month,day'],
            'gender' => ['required', 'in:male,female,other'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['required', 'in:active,inactive'],
            'image' => ['nullable', 'image', 'max:2048'],
        ]);

        return $this->upperCaseNames($data, ['name']);
    }



    private function withMediaUrls(Patient $patient): Patient
    {
        if (empty($patient->verification_token)) {
            $patient->verification_token = (string) Str::uuid();
            $patient->saveQuietly();
            $patient->refresh();
        }
        $patient->image_url = $patient->image_path ? url(Storage::url($patient->image_path)) : null;
        return $patient;
    }
}
