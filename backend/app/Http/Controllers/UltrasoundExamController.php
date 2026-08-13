<?php

namespace App\Http\Controllers;

use App\Models\UltrasoundExam;
use App\Models\UltrasoundType;
use App\Services\LedgerPostingService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UltrasoundExamController extends Controller
{
    private const RELATIONS = ['patient', 'doctor', 'ultrasoundType'];

    public function __construct(private LedgerPostingService $ledgerPostingService)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = UltrasoundExam::query()->with(self::RELATIONS);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }

        if ($request->filled('doctor_id')) {
            $query->where('doctor_id', $request->integer('doctor_id'));
        }

        if ($request->filled('ultrasound_type_id')) {
            $query->where('ultrasound_type_id', $request->integer('ultrasound_type_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('examined_at', '>=', $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('examined_at', '<=', $request->string('end_date'));
        }

        return response()->json(
            $query->orderByDesc('examined_at')->orderByDesc('id')->get()
        );
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $data = $this->validatePayload($request, $hospitalId);
        $data['hospital_id'] = $hospitalId;

        // Fall back to the type's template so a report is never stored empty.
        if (empty($data['report_body'])) {
            $data['report_body'] = UltrasoundType::whereKey($data['ultrasound_type_id'])->value('default_template');
        }

        $exam = DB::transaction(function () use ($data, $request, $hospitalId) {
            $data['created_by'] = $request->user()->name ?? null;
            $data['updated_by'] = $request->user()->name ?? null;

            $nextSequence = UltrasoundExam::withTrashed()
                ->where('hospital_id', $hospitalId)
                ->lockForUpdate()
                ->max('sequence_id');

            for ($attempt = 0; $attempt < 3; $attempt++) {
                try {
                    $data['sequence_id'] = (int) ($nextSequence ?? 0) + 1;

                    return UltrasoundExam::create($data);
                } catch (QueryException $e) {
                    if (!$this->isDuplicateSequenceError($e)) {
                        throw $e;
                    }

                    $nextSequence = UltrasoundExam::withTrashed()
                        ->where('hospital_id', $hospitalId)
                        ->lockForUpdate()
                        ->max('sequence_id');
                }
            }

            throw ValidationException::withMessages([
                'patient_id' => ['Unable to generate a unique ultrasound number. Please try again.'],
            ]);
        });

        // Ultrasound fees are real income; without this they never reach the
        // ledger and are missing from every financial report.
        $this->ledgerPostingService->upsertUltrasoundExamSnapshot($exam);

        return response()->json($exam->load(self::RELATIONS), 201);
    }

    public function show(Request $request, UltrasoundExam $ultrasoundExam)
    {
        $this->authorizeScope($request->user(), $ultrasoundExam);

        return response()->json($ultrasoundExam->load(self::RELATIONS));
    }

    public function update(Request $request, UltrasoundExam $ultrasoundExam)
    {
        $this->authorizeScope($request->user(), $ultrasoundExam);

        $hospitalId = (int) $ultrasoundExam->hospital_id;
        $data = $this->validatePayload($request, $hospitalId);

        $data['hospital_id'] = $hospitalId;
        $data['updated_by'] = $request->user()->name ?? null;
        unset($data['sequence_id']);

        $ultrasoundExam->update($data);
        $this->ledgerPostingService->upsertUltrasoundExamSnapshot($ultrasoundExam->fresh());

        return response()->json($ultrasoundExam->fresh()->load(self::RELATIONS));
    }

    public function destroy(Request $request, UltrasoundExam $ultrasoundExam)
    {
        $this->authorizeScope($request->user(), $ultrasoundExam);

        $this->ledgerPostingService->voidUltrasoundExamSnapshot($ultrasoundExam, $request->user()->name ?? null);
        $ultrasoundExam->delete();

        return response()->json(['message' => 'Ultrasound exam deleted']);
    }

    /**
     * Payload for the printable report, mirroring the lab report endpoint.
     */
    public function report(Request $request, UltrasoundExam $ultrasoundExam)
    {
        $this->authorizeScope($request->user(), $ultrasoundExam);

        $ultrasoundExam->load(self::RELATIONS);

        return response()->json([
            'exam' => $ultrasoundExam,
            'patient' => $ultrasoundExam->patient,
            'doctor' => $ultrasoundExam->doctor,
            'type' => $ultrasoundExam->ultrasoundType,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, int $hospitalId): array
    {
        return $request->validate([
            'patient_id' => [
                'required',
                Rule::exists('patients', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'doctor_id' => [
                'nullable',
                // Doctors are users with the `doctor` role, matching prescriptions and lab orders.
                Rule::exists('users', 'id')->where(
                    fn ($q) => $q->where('hospital_id', $hospitalId)->where('role', 'doctor')->whereNull('deleted_at')
                ),
            ],
            'ultrasound_type_id' => [
                'required',
                Rule::exists('ultrasound_types', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'examined_at' => ['required', 'date'],
            'referred_by' => ['nullable', 'string', 'max:191'],
            'clinical_notes' => ['nullable', 'string'],
            'report_body' => ['nullable', 'string'],
            'impression' => ['nullable', 'string'],
            'status' => ['required', 'in:draft,completed,cancelled'],
            'fee' => ['nullable', 'numeric', 'min:0'],
        ]);
    }

    private function resolveHospitalId(Request $request): int
    {
        if ($request->user()->role !== 'super_admin') {
            $hospitalId = (int) $request->user()->hospital_id;

            if ($hospitalId <= 0) {
                abort(422, 'Hospital tenant context is required for this user.');
            }

            return $hospitalId;
        }

        $hospitalId = $request->integer('hospital_id');

        if (!$hospitalId) {
            abort(422, 'The hospital_id field is required.');
        }

        return (int) $hospitalId;
    }

    private function authorizeScope($user, UltrasoundExam $ultrasoundExam): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $ultrasoundExam->hospital_id) {
            abort(403, 'Unauthorized ultrasound exam access');
        }
    }

    private function isDuplicateSequenceError(QueryException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'duplicate') && str_contains($message, 'sequence');
    }
}
