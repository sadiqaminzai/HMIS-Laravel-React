<?php

namespace App\Http\Controllers;

use App\Models\DentalReceipt;
use App\Services\LedgerPostingService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The dental cash desk.
 *
 * The same shape as the X-Ray desk: no report and no work queue, so the module
 * is a service catalogue plus one screen -- raise the charge, take the money,
 * print the receipt. The discount half comes from HandlesReceiptDiscounts, so
 * dental, ultrasound and room bookings all apply a discount identically.
 */
class DentalReceiptController extends Controller
{
    use \App\Http\Controllers\Concerns\HandlesReceiptDiscounts;

    private const RELATIONS = ['patient', 'doctor', 'dentalService'];

    public function __construct(
        private readonly LedgerPostingService $ledgerPostingService
    ) {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = DentalReceipt::query()->with(self::RELATIONS);

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

        $this->enforceDiscountPermission($request, $data);
        $this->applyDiscountRules($data, 'fee');

        $receipt = DB::transaction(function () use ($data, $request, $hospitalId) {
            $data['created_by'] = $request->user()->name ?? null;
            $data['updated_by'] = $request->user()->name ?? null;

            $nextSequence = DentalReceipt::withTrashed()
                ->where('hospital_id', $hospitalId)
                ->lockForUpdate()
                ->max('sequence_id');

            // Two clerks raising a receipt at the same moment collide on the
            // unique key; retry rather than losing one of the charges.
            for ($attempt = 0; $attempt < 3; $attempt++) {
                try {
                    $data['sequence_id'] = (int) ($nextSequence ?? 0) + 1;

                    return DentalReceipt::create($data);
                } catch (QueryException $e) {
                    if (!$this->isDuplicateSequenceError($e)) {
                        throw $e;
                    }

                    $nextSequence = DentalReceipt::withTrashed()
                        ->where('hospital_id', $hospitalId)
                        ->lockForUpdate()
                        ->max('sequence_id');
                }
            }

            throw ValidationException::withMessages([
                'patient_id' => ['Unable to generate a unique dental receipt number. Please try again.'],
            ]);
        });

        $this->ledgerPostingService->upsertDentalReceiptSnapshot($receipt);

        return response()->json($receipt->load(self::RELATIONS), 201);
    }

    public function show(Request $request, DentalReceipt $dentalReceipt)
    {
        $this->authorizeScope($request->user(), $dentalReceipt);

        return response()->json($dentalReceipt->load(self::RELATIONS));
    }

    public function update(Request $request, DentalReceipt $dentalReceipt)
    {
        $this->authorizeScope($request->user(), $dentalReceipt);

        $hospitalId = (int) $dentalReceipt->hospital_id;
        $data = $this->validatePayload($request, $hospitalId);
        $data['hospital_id'] = $hospitalId;
        $data['updated_by'] = $request->user()->name ?? null;
        unset($data['sequence_id']);

        $this->enforceDiscountPermission($request, $data, $dentalReceipt);
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

        $dentalReceipt->update($data);
        $this->ledgerPostingService->upsertDentalReceiptSnapshot($dentalReceipt->fresh());

        return response()->json($dentalReceipt->fresh()->load(self::RELATIONS));
    }

    public function destroy(Request $request, DentalReceipt $dentalReceipt)
    {
        $this->authorizeScope($request->user(), $dentalReceipt);

        $this->ledgerPostingService->voidDentalReceiptSnapshot($dentalReceipt, $request->user()->name ?? null);
        $dentalReceipt->delete();

        return response()->json(['message' => 'dental receipt deleted']);
    }

    /** Take payment at the counter. */
    public function processPayment(Request $request, DentalReceipt $dentalReceipt)
    {
        $this->authorizeScope($request->user(), $dentalReceipt);

        $data = $request->validate([
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', 'max:50'],
        ]);

        if ($dentalReceipt->isPaid()) {
            return response()->json(['message' => 'This dental receipt is already paid.'], 422);
        }

        // Settled against the discounted amount -- the fee alone would leave a
        // discounted study looking permanently underpaid.
        $payable = $dentalReceipt->payableAmount();
        $paid = (float) $data['paid_amount'];

        $dentalReceipt->update([
            'payment_status' => $paid >= $payable && $payable > 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'),
            'paid_amount' => $paid,
            'payment_method' => $data['payment_method'],
            'paid_at' => now(),
            'paid_by' => $request->user()?->name,
            'receipt_number' => $dentalReceipt->receipt_number
                ?? (string) ($dentalReceipt->sequence_id ?? $dentalReceipt->id),
            'updated_by' => $request->user()?->name,
        ]);

        $this->ledgerPostingService->upsertDentalReceiptSnapshot($dentalReceipt->fresh());

        return response()->json($dentalReceipt->fresh()->load(self::RELATIONS));
    }

    /**
     * Undo a payment.
     *
     * Its own permission, as in ultrasound and lab: the desk that collects must
     * not also be able to make the money disappear.
     */
    public function reversePayment(Request $request, DentalReceipt $dentalReceipt)
    {
        $this->authorizeScope($request->user(), $dentalReceipt);

        if (!($request->user()?->hasPermission('reverse_dental_payment') ?? false)) {
            return response()->json([
                'message' => 'Reversing an dental payment requires the Reverse Dental Payment permission.',
            ], 403);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $dentalReceipt->update([
            'payment_status' => 'unpaid',
            'paid_amount' => 0,
            'payment_method' => null,
            'paid_at' => null,
            'paid_by' => null,
            'updated_by' => $request->user()?->name,
        ]);

        $this->ledgerPostingService->upsertDentalReceiptSnapshot($dentalReceipt->fresh());

        return response()->json([
            'data' => $dentalReceipt->fresh()->load(self::RELATIONS),
            'message' => 'Payment reversed: ' . $data['reason'],
        ]);
    }

    /** Payload for the printable fees card. */
    public function receipt(Request $request, DentalReceipt $dentalReceipt)
    {
        $this->authorizeScope($request->user(), $dentalReceipt);

        $receipt = $dentalReceipt->load(self::RELATIONS);

        return response()->json([
            'receipt_number' => $receipt->receipt_number ?? (string) ($receipt->sequence_id ?? $receipt->id),
            'dental_receipt_id' => $receipt->id,
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
            'dental_service_id' => [
                'nullable',
                Rule::exists('dental_services', 'id')->where(
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

    private function authorizeScope($user, DentalReceipt $dentalReceipt): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $dentalReceipt->hospital_id) {
            abort(403, 'Unauthorized dental receipt access');
        }
    }

    private function isDuplicateSequenceError(QueryException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'duplicate') && str_contains($message, 'sequence');
    }
}
