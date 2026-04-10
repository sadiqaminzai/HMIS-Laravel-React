<?php

namespace App\Http\Controllers;

use App\Models\PatientSurgery;
use App\Models\Surgery;
use App\Services\LedgerPostingService;
use App\Services\SurgeryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PatientSurgeryController extends Controller
{
    public function __construct(
        private readonly SurgeryService $surgeryService,
        private readonly LedgerPostingService $ledgerPostingService
    )
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = PatientSurgery::query()
            ->with([
                'patient:id,name,patient_id,hospital_id',
                'doctor:id,name,hospital_id',
                'surgery:id,name,type_id,hospital_id,cost',
                'surgery.type:id,name',
            ])
            ->where('is_delete', false);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('id')) {
            $query->where('id', $request->integer('id'));
        }

        if ($request->filled('id_from')) {
            $query->where('id', '>=', $request->integer('id_from'));
        }

        if ($request->filled('id_to')) {
            $query->where('id', '<=', $request->integer('id_to'));
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }

        if ($request->filled('doctor_id')) {
            $query->where('doctor_id', $request->integer('doctor_id'));
        }

        if ($request->filled('surgery_id')) {
            $query->where('surgery_id', $request->integer('surgery_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->string('payment_status'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('surgery_date', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('surgery_date', '<=', $request->date('date_to'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('notes', 'like', "%{$search}%")
                    ->orWhere('discharge_summary', 'like', "%{$search}%")
                    ->orWhereHas('patient', fn ($p) => $p->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('doctor', fn ($d) => $d->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('surgery', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }

        return response()->json($query->orderByDesc('id')->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);
        $data['created_by'] = $request->user()?->name;
        $this->decorateDischargeAuditFields($data, $request->user()?->name);

        $patientSurgery = DB::transaction(function () use ($data) {
            $surgery = Surgery::query()->findOrFail($data['surgery_id']);
            $this->assertScopedSurgery($surgery, (int) $data['hospital_id']);

            $data['cost'] = $this->surgeryService->resolveCost($surgery, $data['cost'] ?? null);
            $patientSurgery = PatientSurgery::create($data);
            $this->ledgerPostingService->upsertPatientSurgerySnapshot($patientSurgery);

            return $patientSurgery;
        });

        return response()->json($patientSurgery->load(['patient', 'doctor', 'surgery.type']), 201);
    }

    public function show(Request $request, PatientSurgery $patientSurgery)
    {
        $this->authorizeScope($request->user(), $patientSurgery->hospital_id);

        return response()->json($patientSurgery->load(['patient', 'doctor', 'surgery.type']));
    }

    public function update(Request $request, PatientSurgery $patientSurgery)
    {
        $this->authorizeScope($request->user(), $patientSurgery->hospital_id);

        $data = $this->validatePayload($request, $patientSurgery->hospital_id);
        $data['updated_by'] = $request->user()?->name;
        $this->decorateDischargeAuditFields($data, $request->user()?->name, $patientSurgery);

        DB::transaction(function () use ($data, $patientSurgery) {
            $surgery = Surgery::query()->findOrFail($data['surgery_id']);
            $this->assertScopedSurgery($surgery, (int) $data['hospital_id']);

            $data['cost'] = $this->surgeryService->resolveCost($surgery, $data['cost'] ?? null);

            $patientSurgery->update($data);

            if ((string) $patientSurgery->status === 'cancelled' || (string) $patientSurgery->payment_status === 'cancelled') {
                $this->ledgerPostingService->voidPatientSurgerySnapshot($patientSurgery, $data['updated_by'] ?? null);
            } else {
                $this->ledgerPostingService->upsertPatientSurgerySnapshot($patientSurgery);
            }
        });

        return response()->json($patientSurgery->fresh()->load(['patient', 'doctor', 'surgery.type']));
    }

    public function togglePaymentStatus(Request $request, PatientSurgery $patientSurgery)
    {
        $this->authorizeScope($request->user(), $patientSurgery->hospital_id);

        $patientSurgery->update([
            'payment_status' => $this->surgeryService->togglePaymentStatus($patientSurgery),
            'updated_by' => $request->user()?->name,
        ]);
        $this->ledgerPostingService->upsertPatientSurgerySnapshot($patientSurgery);

        return response()->json($patientSurgery->fresh()->load(['patient', 'doctor', 'surgery.type']));
    }

    public function destroy(Request $request, PatientSurgery $patientSurgery)
    {
        $this->authorizeScope($request->user(), $patientSurgery->hospital_id);

        $patientSurgery->update([
            'is_delete' => true,
            'is_active' => false,
            'deleted_by' => $request->user()?->name,
        ]);
        $this->ledgerPostingService->voidPatientSurgerySnapshot($patientSurgery, $request->user()?->name);

        return response()->json(['message' => 'Patient surgery deleted']);
    }

    private function validatePayload(Request $request, ?int $existingHospitalId = null): array
    {
        $hospitalId = $request->user()->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: $existingHospitalId)
            : $request->user()->hospital_id;

        $data = $request->validate([
            'hospital_id' => [
                $request->user()->role === 'super_admin' ? 'required' : 'nullable',
                'exists:hospitals,id',
            ],
            'patient_id' => ['required', 'exists:patients,id'],
            'doctor_id' => ['nullable', 'exists:users,id'],
            'surgery_id' => ['required', 'exists:surgeries,id'],
            'surgery_date' => ['required', 'date'],
            'discharge_date' => ['nullable', 'date'],
            'discharge_summary' => ['nullable', 'string'],
            'discharge_created_by' => ['nullable', 'string', 'max:191'],
            'discharge_completed_by' => ['nullable', 'string', 'max:191'],
            'status' => ['required', 'in:scheduled,in_progress,completed,cancelled'],
            'payment_status' => ['required', 'in:pending,paid,partial,cancelled'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        } elseif (!isset($data['hospital_id'])) {
            $data['hospital_id'] = $hospitalId;
        }

        return $data;
    }

    private function assertScopedSurgery(Surgery $surgery, int $hospitalId): void
    {
        if ((int) $surgery->hospital_id !== $hospitalId || (bool) $surgery->is_delete) {
            abort(422, 'Surgery does not belong to selected hospital');
        }
    }

    private function authorizeScope($user, int $hospitalId): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $hospitalId) {
            abort(403, 'Unauthorized access');
        }
    }

    private function decorateDischargeAuditFields(array &$data, ?string $actorName, ?PatientSurgery $existing = null): void
    {
        $hasIncomingDischargeFields = array_key_exists('discharge_summary', $data)
            || array_key_exists('discharge_date', $data)
            || array_key_exists('discharge_created_by', $data)
            || array_key_exists('discharge_completed_by', $data);

        if (!$hasIncomingDischargeFields && $existing) {
            return;
        }

        $summary = trim((string) ($data['discharge_summary'] ?? $existing?->discharge_summary ?? ''));
        $hasSummary = $summary !== '';

        if (!$hasSummary) {
            $data['discharge_summary'] = null;
            $data['discharge_date'] = $data['discharge_date'] ?? null;
            $data['discharge_created_by'] = null;
            $data['discharge_completed_by'] = null;
            return;
        }

        $data['discharge_summary'] = $summary;
        $data['discharge_created_by'] = $data['discharge_created_by']
            ?? $existing?->discharge_created_by
            ?? $actorName;

        $isCompleted = (string) ($data['status'] ?? $existing?->status ?? '') === 'completed';
        if ($isCompleted) {
            $data['discharge_completed_by'] = $data['discharge_completed_by']
                ?? $existing?->discharge_completed_by
                ?? $actorName;
        } else {
            $data['discharge_completed_by'] = $data['discharge_completed_by']
                ?? $existing?->discharge_completed_by;
        }
    }
}
