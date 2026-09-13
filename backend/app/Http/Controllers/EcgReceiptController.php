<?php

namespace App\Http\Controllers;

use App\Models\EcgReceipt;
use App\Services\LedgerPostingService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The ECG cash desk.
 *
 * The same shape as the Dental and X-Ray desks: the trace comes off the machine
 * and is filed in the chart, so there is no report to hold and no work queue --
 * the module is a study catalogue plus one screen: raise the charge, take the
 * money, print the receipt. The discount half comes from
 * HandlesReceiptDiscounts, so ECG, dental and room bookings all apply a
 * discount identically.
 */
class EcgReceiptController extends Controller
{
    use \App\Http\Controllers\Concerns\HandlesReceiptDiscounts;
    use \App\Http\Controllers\Concerns\HandlesDeskPayments;

    private const RELATIONS = ['patient', 'doctor', 'ecgService'];

    public function __construct(
        private readonly LedgerPostingService $ledgerPostingService
    ) {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = EcgReceipt::query()->with(self::RELATIONS);

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

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->string('payment_status'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('performed_at', '>=', $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('performed_at', '<=', $request->string('end_date'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('service_name', 'like', "%{$search}%")
                    ->orWhere('referred_by', 'like', "%{$search}%")
                    ->orWhereHas('patient', fn ($p) => $p->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%"));
            });
        }

        // Unpaid first: this is a collection desk, so what is still owed is the
        // work and everything else is history.
        return response()->json(
            $query
                ->orderByRaw("CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END")
                ->orderByDesc('id')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $data = $this->validatePayload($request, $hospitalId);
        $data['hospital_id'] = $hospitalId;

        // The fee is financial: without Set ECG Fee it is the study's catalogue
        // price, whatever the form sent. Disabling the input is only a hint.
        if (!$this->mayTypeFee($request)) {
            $data['fee'] = !empty($data['ecg_service_id'])
                ? (float) (\App\Models\EcgService::where('hospital_id', $hospitalId)->whereKey($data['ecg_service_id'])->value('price') ?? 0)
                : 0;
        }

        $this->enforceDiscountPermission($request, $data, null, 'ecg');
        $this->applyDiscountRules($data, 'fee');
        $this->applyDefaultPayment($request, $data, $hospitalId, 'ecg', (float) $data['net_amount']);

        $receipt = DB::transaction(function () use ($data, $request, $hospitalId) {
            $data['created_by'] = $request->user()->name ?? null;
            $data['updated_by'] = $request->user()->name ?? null;

            $nextSequence = EcgReceipt::withTrashed()
                ->where('hospital_id', $hospitalId)
                ->lockForUpdate()
                ->max('sequence_id');

            // Two clerks raising a receipt at the same moment collide on the
            // unique key; retry rather than losing one of the charges.
            for ($attempt = 0; $attempt < 3; $attempt++) {
                try {
                    $data['sequence_id'] = (int) ($nextSequence ?? 0) + 1;

                    return EcgReceipt::create($data);
                } catch (QueryException $e) {
                    if (!$this->isDuplicateSequenceError($e)) {
                        throw $e;
                    }

                    $nextSequence = EcgReceipt::withTrashed()
                        ->where('hospital_id', $hospitalId)
                        ->lockForUpdate()
                        ->max('sequence_id');
                }
            }

            throw ValidationException::withMessages([
                'patient_id' => ['Unable to generate a unique ECG receipt number. Please try again.'],
            ]);
        });

        $this->ledgerPostingService->upsertEcgReceiptSnapshot($receipt);

        return response()->json($receipt->load(self::RELATIONS), 201);
    }

    public function show(Request $request, EcgReceipt $ecgReceipt)
    {
        $this->authorizeScope($request->user(), $ecgReceipt);

        return response()->json($ecgReceipt->load(self::RELATIONS));
    }

    public function update(Request $request, EcgReceipt $ecgReceipt)
    {
        $this->authorizeScope($request->user(), $ecgReceipt);

        $hospitalId = (int) $ecgReceipt->hospital_id;
        $data = $this->validatePayload($request, $hospitalId);
        $data['hospital_id'] = $hospitalId;
        $data['updated_by'] = $request->user()->name ?? null;
        unset($data['sequence_id']);

        // Without Set ECG Fee the stored fee stands -- unless the study itself
        // was changed, in which case the new study's price applies.
        if (!$this->mayTypeFee($request)) {
            $sameStudy = (int) ($data['ecg_service_id'] ?? 0) === (int) ($ecgReceipt->ecg_service_id ?? 0);
            $data['fee'] = $sameStudy || empty($data['ecg_service_id'])
                ? (float) ($ecgReceipt->fee ?? 0)
                : (float) (\App\Models\EcgService::where('hospital_id', $hospitalId)->whereKey($data['ecg_service_id'])->value('price') ?? 0);
        }

        $this->enforceDiscountPermission($request, $data, $ecgReceipt);
        $this->applyDiscountRules($data, 'fee');

        // Payment belongs to its own endpoints, so a charge cannot be settled
        // by editing the record.
        unset(
            $data['payment_status'],
            $data['paid_amount'],
            $data['payment_method'],
            $data['paid_at'],
            $data['paid_by'],
            $data['receipt_number']
        );

        $ecgReceipt->update($data);
        $this->ledgerPostingService->upsertEcgReceiptSnapshot($ecgReceipt->fresh());

        return response()->json($ecgReceipt->fresh()->load(self::RELATIONS));
    }

    public function destroy(Request $request, EcgReceipt $ecgReceipt)
    {
        $this->authorizeScope($request->user(), $ecgReceipt);

        $this->ledgerPostingService->voidEcgReceiptSnapshot($ecgReceipt, $request->user()->name ?? null);
        $ecgReceipt->delete();

        return response()->json(['message' => 'ECG receipt deleted']);
    }

    /** Take payment at the counter. */
    public function processPayment(Request $request, EcgReceipt $ecgReceipt)
    {
        $this->authorizeScope($request->user(), $ecgReceipt);

        $data = $request->validate([
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', 'max:50'],
        ]);

        if ($ecgReceipt->isPaid()) {
            return response()->json(['message' => 'This ECG receipt is already paid.'], 422);
        }

        // Settled against the discounted amount -- the fee alone would leave a
        // discounted study looking permanently underpaid.
        $payable = $ecgReceipt->payableAmount();
        $paid = (float) $data['paid_amount'];

        $ecgReceipt->update([
            'payment_status' => $paid >= $payable && $payable > 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'),
            'paid_amount' => $paid,
            'payment_method' => $data['payment_method'],
            'paid_at' => now(),
            'paid_by' => $request->user()?->name,
            'receipt_number' => $ecgReceipt->receipt_number
                ?? (string) ($ecgReceipt->sequence_id ?? $ecgReceipt->id),
            'updated_by' => $request->user()?->name,
        ]);

        $this->ledgerPostingService->upsertEcgReceiptSnapshot($ecgReceipt->fresh());

        return response()->json($ecgReceipt->fresh()->load(self::RELATIONS));
    }

    /**
     * Undo a payment.
     *
     * Its own permission, as in ultrasound and lab: the desk that collects must
     * not also be able to make the money disappear.
     */
    public function reversePayment(Request $request, EcgReceipt $ecgReceipt)
    {
        $this->authorizeScope($request->user(), $ecgReceipt);

        if (!$this->canReturnFor($request, 'ecg')) {
            return response()->json([
                'message' => 'Returning an ECG payment requires the Return ECG Payment permission.',
            ], 403);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $ecgReceipt->update([
            'payment_status' => 'unpaid',
            'paid_amount' => 0,
            'payment_method' => null,
            'paid_at' => null,
            'paid_by' => null,
            'updated_by' => $request->user()?->name,
        ]);

        $this->ledgerPostingService->upsertEcgReceiptSnapshot($ecgReceipt->fresh());

        return response()->json([
            'data' => $ecgReceipt->fresh()->load(self::RELATIONS),
            'message' => 'Payment reversed: ' . $data['reason'],
        ]);
    }

    /** Payload for the printable fees card. */
    public function receipt(Request $request, EcgReceipt $ecgReceipt)
    {
        $this->authorizeScope($request->user(), $ecgReceipt);

        $receipt = $ecgReceipt->load(self::RELATIONS);

        return response()->json([
            'receipt_number' => $receipt->receipt_number ?? (string) ($receipt->sequence_id ?? $receipt->id),
            'ecg_receipt_id' => $receipt->id,
            'sequence_id' => $receipt->sequence_id,
            'patient' => $receipt->patient,
            'doctor' => $receipt->doctor,
            'service_name' => $receipt->service_name,
            'fee' => (float) ($receipt->fee ?? 0),
            'discount_percentage' => (float) ($receipt->discount_percentage ?? 0),
            'discount_amount' => (float) ($receipt->discount_amount ?? 0),
            'net_amount' => $receipt->payableAmount(),
            'paid_amount' => (float) ($receipt->paid_amount ?? 0),
            'payment_status' => $receipt->payment_status,
            'payment_method' => $receipt->payment_method,
            'paid_at' => $receipt->paid_at,
            'paid_by' => $receipt->paid_by,
            'performed_at' => $receipt->performed_at,
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
                Rule::exists('users', 'id')->where(
                    fn ($q) => $q->where('hospital_id', $hospitalId)->where('role', 'doctor')->whereNull('deleted_at')
                ),
            ],
            // The catalogue is the normal path, but service_name stays
            // required: historical receipts have no type, and the printed
            // label must survive a study later being renamed or removed.
            'ecg_service_id' => [
                'nullable',
                Rule::exists('ecg_services', 'id')->where(
                    fn ($q) => $q->where('hospital_id', $hospitalId)->whereNull('deleted_at')
                ),
            ],
            'service_name' => ['required', 'string', 'max:191'],
            'performed_at' => ['required', 'date'],
            'referred_by' => ['nullable', 'string', 'max:191'],
            'notes' => ['nullable', 'string'],
            'fee' => ['nullable', 'numeric', 'min:0'],
            'discount_enabled' => ['nullable', 'boolean'],
            'discount_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
        ]);
    }

    /** May this user type a fee rather than take the study's price? */
    private function mayTypeFee(Request $request): bool
    {
        $user = $request->user();

        return $user !== null && ($user->role === 'super_admin' || $user->hasPermission('set_ecg_fee'));
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

    private function authorizeScope($user, EcgReceipt $ecgReceipt): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $ecgReceipt->hospital_id) {
            abort(403, 'Unauthorized ECG receipt access');
        }
    }

    private function isDuplicateSequenceError(QueryException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'duplicate') && str_contains($message, 'sequence');
    }
}
