<?php

namespace App\Http\Controllers;

use App\Models\PrescriptionDiagnosis;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PrescriptionDiagnosisController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = PrescriptionDiagnosis::query()->orderBy('name');

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $this->ensureAnyPermission($request->user(), ['add_treatment_sets', 'manage_treatment_sets', 'add_prescriptions', 'manage_prescriptions'], 'Unauthorized to create diagnosis templates');

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $diagnosis = PrescriptionDiagnosis::create([
            ...$data,
            'created_by' => $request->user()?->name,
        ]);

        return response()->json($diagnosis, 201);
    }

    public function show(Request $request, PrescriptionDiagnosis $prescriptionDiagnosis)
    {
        $this->authorizeScope($request->user(), $prescriptionDiagnosis);

        return response()->json($prescriptionDiagnosis);
    }

    public function update(Request $request, PrescriptionDiagnosis $prescriptionDiagnosis)
    {
        $this->ensureAnyPermission($request->user(), ['edit_treatment_sets', 'manage_treatment_sets', 'edit_prescriptions', 'manage_prescriptions'], 'Unauthorized to update diagnosis templates');
        $this->authorizeScope($request->user(), $prescriptionDiagnosis);

        $data = $this->validatePayload($request, true, $prescriptionDiagnosis->hospital_id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $prescriptionDiagnosis->hospital_id;
        }

        $prescriptionDiagnosis->fill($data);
        $prescriptionDiagnosis->updated_by = $request->user()?->name;
        $prescriptionDiagnosis->save();

        return response()->json($prescriptionDiagnosis->fresh());
    }

    public function destroy(Request $request, PrescriptionDiagnosis $prescriptionDiagnosis)
    {
        $this->ensureAnyPermission($request->user(), ['delete_treatment_sets', 'manage_treatment_sets', 'delete_prescriptions', 'manage_prescriptions'], 'Unauthorized to delete diagnosis templates');
        $this->authorizeScope($request->user(), $prescriptionDiagnosis);

        $prescriptionDiagnosis->delete();

        return response()->json(['message' => 'Diagnosis template deleted']);
    }

    private function validatePayload(Request $request, bool $isUpdate = false, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'name' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:255',
                Rule::unique('prescription_diagnoses', 'name')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->ignore($request->route('prescriptionDiagnosis')?->id),
            ],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);
    }

    private function authorizeScope($user, PrescriptionDiagnosis $prescriptionDiagnosis): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $prescriptionDiagnosis->hospital_id) {
            abort(403, 'Unauthorized diagnosis template access');
        }
    }
}
