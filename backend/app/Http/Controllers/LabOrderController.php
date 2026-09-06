<?php

namespace App\Http\Controllers;

use App\Models\HospitalSetting;
use App\Models\LabOrder;
use App\Models\LabOrderItem;
use App\Models\LabOrderResult;
use App\Models\TestTemplate;
use App\Models\Patient;
use App\Models\User;
use App\Models\WalkInPatient;
use App\Services\LedgerPostingService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LabOrderController extends Controller
{
    public function __construct(private readonly LedgerPostingService $ledgerPostingService)
    {
    }

    /**
     * Whether the user may see lab orders that are not fully paid.
     *
     * Deliberately NOT implied by manage_lab_orders: lab technicians hold that
     * permission but should only work on orders the patient has already paid for.
     */
    private function canViewUnpaidLabOrders($user): bool
    {
        if (!$user) {
            return false;
        }

        if ((string) $user->role === 'super_admin') {
            return true;
        }

        // Doctors are already scoped to the orders they themselves requested, so they
        // keep seeing their own pending/unpaid requests.
        if ((string) $user->role === 'doctor') {
            return true;
        }

        $names = method_exists($user, 'permissionNames') ? $user->permissionNames() : [];

        return in_array('view_unpaid_lab_orders', $names, true);
    }

    /**
     * List lab orders with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = LabOrder::query()
            // Results stay on the list. Dropping them to save payload broke the
            // printed report, which renders straight from the list row -- so
            // the saving is not available here without reworking that path.
            //
            // The doctor is still trimmed to id and name: the list only ever
            // prints doctor_name, yet the full user record carried a 520-byte
            // availability_schedule on EVERY row. That part is pure win.
            ->with(['items.results', 'patient', 'walkInPatient', 'doctor:id,name']);

        // If logged-in user is a doctor, always scope to their own hospital and their own orders.
        if ($user && (string) $user->role === 'doctor') {
            if ($user->hospital_id) {
                $query->where('hospital_id', (int) $user->hospital_id);
            }
            $query->where('doctor_id', (int) $user->id);
        }

        // Hospital filter
        if ((!$user || (string) $user->role !== 'doctor') && $request->has('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        // Status filter
        // Orders the laboratory still has to key a result for.
        //
        // The Processing queue used to be built in the browser, which meant the
        // whole history had to be downloaded to find the handful of rows that
        // belong in it -- 664 orders and 4.2 MB to show fifty. "Requires a
        // result" is a property of the test template, so only the database can
        // answer it; expressed here, the queue can be paginated like the rest.
        if ($request->boolean('has_result_work')) {
            $query->whereHas('items.template', function ($templateQuery) {
                $templateQuery->where('requires_result', true);
            });
        }

        if ($request->has('status')) {
            $query->where('status', $request->get('status'));
        }

        // Payment status filter
        // Neither desk queue shows a cancelled order; expressed as a filter so
        // the count the client paginates against matches what it displays.
        if ($request->boolean('exclude_cancelled')) {
            $query->where('status', '!=', 'cancelled');
        }

        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->get('payment_status'));
        }

        // Users without `view_unpaid_lab_orders` (typically lab technicians) may only
        // see orders whose payment is complete. Applied after the caller's own
        // payment_status filter so it cannot be widened from the query string.
        if (!$this->canViewUnpaidLabOrders($user)) {
            $query->where('payment_status', 'paid');
        }

        // Doctor filter
        if ((!$user || (string) $user->role !== 'doctor') && $request->has('doctor_id')) {
            $query->where('doctor_id', $request->integer('doctor_id'));
        }

        // Date range filter
        if ($request->has('from_date')) {
            $query->whereDate('created_at', '>=', $request->get('from_date'));
        }
        if ($request->has('to_date')) {
            $query->whereDate('created_at', '<=', $request->get('to_date'));
        }

        // Search by order number, patient name, or patient phone
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhere('patient_name', 'like', "%{$search}%")
                  ->orWhereHas('patient', function ($patientQuery) use ($search) {
                      $patientQuery->where('phone', 'like', "%{$search}%");
                  })
                  ->orWhereHas('walkInPatient', function ($walkInQuery) use ($search) {
                      $walkInQuery->where('phone', 'like', "%{$search}%");
                  });
            });
        }

        $orders = $query->orderByDesc('id')->paginate($request->integer('per_page', 25));

        // Ensure doctor name is always the latest user name (not a stale snapshot).
        $orders->getCollection()->transform(function (LabOrder $order) use ($user) {
            if ($order->relationLoaded('doctor') && $order->doctor) {
                $order->doctor_name = $order->doctor->name;
            }

            // Same flag getForResultEntry() sets, computed from the one rule in
            // LabOrderItem::isEditableBy(). The list needs it too: the Edit
            // Result button lives there, and a UI that re-derived "same user,
            // same day" for itself would drift from what the server enforces.
            $order->items->each(function (LabOrderItem $item) use ($user) {
                $item->setAttribute('is_editable', $item->isEditableBy($user));
            });

            return $order;
        });

        return response()->json($orders);
    }

    /**
     * Create a new lab order (Doctor creates)
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'patient_id' => ['nullable', 'exists:patients,id'],
            'is_walk_in' => ['boolean'],
            'walk_in_patient' => ['required_if:is_walk_in,true', 'array'],
            'walk_in_patient.name' => ['required_if:is_walk_in,true', 'string', 'max:255'],
            'walk_in_patient.age' => ['required_if:is_walk_in,true', 'integer', 'min:0', 'max:150'],
            'walk_in_patient.gender' => ['required_if:is_walk_in,true', 'in:male,female,other'],
            'walk_in_patient.phone' => ['nullable', 'string', 'max:20'],
            'doctor_id' => ['required', 'exists:users,id'],
            'doctor_name' => ['required', 'string', 'max:255'],
            'test_ids' => ['required', 'array', 'min:1'],
            'test_ids.*' => ['exists:test_templates,id'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'discount_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'priority' => ['in:normal,urgent,stat'],
            'clinical_notes' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();
        $hospitalId = $data['hospital_id'];
        $isWalkIn = $data['is_walk_in'] ?? false;

        // If the logged-in user is a doctor, force the order to be created under their identity.
        if ($user && (string) $user->role === 'doctor') {
            if ((int) $user->hospital_id !== (int) $hospitalId) {
                return response()->json(['message' => 'Doctor does not belong to the selected hospital'], 422);
            }

            $data['doctor_id'] = (int) $user->id;
            $data['doctor_name'] = (string) $user->name;
        }

        // Ensure doctor belongs to hospital and is marked as doctor.
        $doctor = $this->resolveDoctorUser((int) $data['doctor_id']);
        if ((int) $doctor->hospital_id !== (int) $hospitalId) {
            return response()->json(['message' => 'Doctor does not belong to the selected hospital'], 422);
        }

        $data['doctor_id'] = $doctor->id;

        return DB::transaction(function () use ($data, $hospitalId, $isWalkIn, $request, $doctor) {
            // Handle walk-in patient
            $patientId = null;
            $walkInPatientId = null;
            $patientName = '';
            $patientAge = 0;
            $patientAgeUnit = 'year';
            $patientGender = 'male';

            if ($isWalkIn) {
                $walkIn = WalkInPatient::create([
                    'hospital_id' => $hospitalId,
                    'name' => $data['walk_in_patient']['name'],
                    'age' => $data['walk_in_patient']['age'],
                    'age_unit' => $data['walk_in_patient']['age_unit'] ?? 'year',
                    'gender' => $data['walk_in_patient']['gender'],
                    'phone' => $data['walk_in_patient']['phone'] ?? null,
                    'created_by' => $request->user()?->name,
                ]);
                $walkInPatientId = $walkIn->id;
                $patientName = $walkIn->name;
                $patientAge = $walkIn->age;
                $patientAgeUnit = $walkIn->age_unit ?? 'year';
                $patientGender = $walkIn->gender;
            } else {
                $patient = Patient::findOrFail($data['patient_id']);
                $patientId = $patient->id;
                $patientName = $patient->name;
                $patientAge = $patient->age;
                $patientAgeUnit = $patient->age_unit ?? 'year';
                $patientGender = $patient->gender;
            }

            // Create lab order
            $order = LabOrder::create([
                'hospital_id' => $hospitalId,
                'order_number' => null,
                'patient_id' => $patientId,
                'walk_in_patient_id' => $walkInPatientId,
                'is_walk_in' => $isWalkIn,
                'patient_name' => $patientName,
                'patient_age' => $patientAge,
                'patient_age_unit' => $patientAgeUnit,
                'patient_gender' => $patientGender,
                'doctor_id' => $data['doctor_id'],
                'doctor_name' => $doctor->name,
                'priority' => $data['priority'] ?? 'normal',
                'clinical_notes' => $data['clinical_notes'] ?? null,
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'created_by' => $request->user()?->name,
            ]);

            // Add test items
            $grossAmount = 0;
            foreach ($data['test_ids'] as $testId) {
                $template = TestTemplate::with('parameters')->findOrFail($testId);

                $item = LabOrderItem::create([
                    'lab_order_id' => $order->id,
                    'test_template_id' => $template->id,
                    'test_code' => $template->test_code,
                    'test_name' => $template->test_name,
                    'test_type' => $template->test_type,
                    'sample_type' => $template->sample_type,
                    'price' => $template->price,
                    'status' => 'pending',
                ]);

                $grossAmount += (float) $template->price;

                // Create result placeholders for each parameter
                foreach ($template->parameters as $param) {
                    LabOrderResult::create([
                        'lab_order_item_id' => $item->id,
                        'parameter_id' => $param->id,
                        'parameter_name' => $param->name,
                        'unit' => $param->unit,
                        'normal_range' => $param->normal_range,
                    ]);
                }
            }

            $canEditDiscount = (bool) ($request->user()?->hasPermission('lab_test_order_discount') ?? false);
            $discountPercentInput = $canEditDiscount
                ? (float) ($data['discount_percentage'] ?? 0)
                : 0.0;

            $discountPercent = min(max($discountPercentInput, 0), 100);
            $discountAmount = round(($grossAmount * $discountPercent) / 100, 2);
            $discountAmount = min(max($discountAmount, 0), max($grossAmount, 0));
            $netAmount = max(0, $grossAmount - $discountAmount);

            // Update financial amount fields after test items are created.
            $totals = [
                'discount_amount' => round($discountAmount, 2),
                'total_amount' => round($netAmount, 2),
            ];

            // Where the hospital collects the fee at the counter before the
            // order is entered, every order starting Unpaid means settling each
            // one again by hand. The default is only honoured for a user who
            // may take payments; it must not become a way around that.
            $startsPaid = HospitalSetting::where('hospital_id', $order->hospital_id)
                ->value('lab_default_payment_status') === 'paid';

            if ($startsPaid && $netAmount > 0 && ($request->user()?->hasPermission('manage_lab_payments') ?? false)) {
                $totals['payment_status'] = 'paid';
                $totals['paid_amount'] = round($netAmount, 2);
                $totals['payment_method'] = 'cash';
                $totals['paid_at'] = now();
                $totals['paid_by'] = $request->user()?->name;
            }

            // An order made up entirely of analyser-reported tests has no work
            // for the laboratory, so nothing would ever move it off 'pending'.
            // Close it here rather than leaving it open forever.
            if ($order->items()->count() > 0 && $order->allItemsCompleted()) {
                $totals['status'] = 'completed';
                $totals['completed_at'] = now();
            }

            $order->update($totals);
            $this->ledgerPostingService->upsertLabOrderSnapshot($order);

            return response()->json([
                'data' => tap($order->load(['items.results', 'patient', 'walkInPatient', 'doctor']), function (LabOrder $loaded) {
                    if ($loaded->doctor) {
                        $loaded->doctor_name = $loaded->doctor->name;
                    }
                }),
                'message' => 'Lab order created successfully'
            ], Response::HTTP_CREATED);
        });
    }

    private function resolveDoctorUser(int $doctorId): User
    {
        $doctor = User::query()
            ->whereKey($doctorId)
            ->where('role', 'doctor')
            ->first();

        if (!$doctor) {
            $doctor = User::query()
                ->where('doctor_id', $doctorId)
                ->where('role', 'doctor')
                ->first();
        }

        if (!$doctor) {
            abort(422, 'Invalid doctor selection');
        }

        return $doctor;
    }

    /**
     * Show a single lab order
     */
    public function show(LabOrder $labOrder)
    {
        $user = request()->user();
        if ($user && (string) $user->role === 'doctor') {
            if ((int) $labOrder->doctor_id !== (int) $user->id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            if ($user->hospital_id && (int) $labOrder->hospital_id !== (int) $user->hospital_id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        // Mirror the index() restriction so an unpaid order cannot be fetched by id.
        if ((string) $labOrder->payment_status !== 'paid' && !$this->canViewUnpaidLabOrders($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $loaded = $labOrder->load(['items.results', 'patient', 'walkInPatient', 'doctor']);
        if ($loaded->doctor) {
            $loaded->doctor_name = $loaded->doctor->name;
        }

        return response()->json([
            'data' => $loaded
        ]);
    }

    /**
     * Update lab order (Admin/Super Admin)
     */
    public function update(Request $request, LabOrder $labOrder)
    {
        $validator = Validator::make($request->all(), [
            'hospital_id' => ['sometimes', 'exists:hospitals,id'],
            'patient_id' => ['sometimes', 'nullable', 'exists:patients,id'],
            'doctor_id' => ['sometimes', 'exists:users,id'],
            'doctor_name' => ['sometimes', 'string', 'max:255'],
            'test_ids' => ['sometimes', 'array', 'min:1'],
            'test_ids.*' => ['exists:test_templates,id'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'discount_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'priority' => ['in:normal,urgent,stat'],
            'clinical_notes' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
            'status' => ['in:pending,sample_collected,processing,completed,cancelled'],
        ]);

        if ($blocked = $this->guardStatusTransition($request, $labOrder, $request->input('status'))) {
            return $blocked;
        }

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();

        if (array_key_exists('hospital_id', $validated) && (int) $validated['hospital_id'] !== (int) $labOrder->hospital_id) {
            return response()->json(['message' => 'Hospital cannot be changed for an existing lab order'], 422);
        }

        return DB::transaction(function () use ($validated, $labOrder, $request) {
            $labOrder->load(['items.results']);

            if (array_key_exists('patient_id', $validated) && !empty($validated['patient_id'])) {
                $patient = Patient::findOrFail($validated['patient_id']);
                if ((int) $patient->hospital_id !== (int) $labOrder->hospital_id) {
                    return response()->json(['message' => 'Patient does not belong to this hospital'], 422);
                }

                $labOrder->patient_id = $patient->id;
                $labOrder->walk_in_patient_id = null;
                $labOrder->is_walk_in = false;
                $labOrder->patient_name = $patient->name;
                $labOrder->patient_age = $patient->age;
                $labOrder->patient_age_unit = $patient->age_unit ?? 'year';
                $labOrder->patient_gender = $patient->gender;
            }

            if (array_key_exists('doctor_id', $validated) && !empty($validated['doctor_id'])) {
                $doctor = $this->resolveDoctorUser((int) $validated['doctor_id']);
                if ((int) $doctor->hospital_id !== (int) $labOrder->hospital_id) {
                    return response()->json(['message' => 'Doctor does not belong to this hospital'], 422);
                }

                $labOrder->doctor_id = $doctor->id;
                $labOrder->doctor_name = $doctor->name;
            }

            $orderFields = collect($validated)
                ->only(['priority', 'clinical_notes', 'remarks', 'status'])
                ->all();

            $labOrder->fill($orderFields);

            if (array_key_exists('test_ids', $validated)) {
                $hasEnteredResults = $labOrder->items
                    ->flatMap(fn (LabOrderItem $item) => $item->results)
                    ->contains(fn (LabOrderResult $result) => filled($result->result_value));

                $requestedIds = collect($validated['test_ids'])
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values();

                $existingIds = $labOrder->items
                    ->pluck('test_template_id')
                    ->map(fn ($id) => (int) $id)
                    ->values();

                if ($hasEnteredResults && $requestedIds->sort()->values()->all() !== $existingIds->sort()->values()->all()) {
                    return response()->json(['message' => 'Tests cannot be changed after results have been entered'], 422);
                }

                $removeIds = $existingIds->diff($requestedIds)->values();
                if ($removeIds->isNotEmpty()) {
                    $labOrder->items()
                        ->whereIn('test_template_id', $removeIds->all())
                        ->get()
                        ->each(function (LabOrderItem $item) {
                            $item->results()->delete();
                            $item->delete();
                        });
                }

                $addIds = $requestedIds->diff($existingIds)->values();
                foreach ($addIds as $testId) {
                    $template = TestTemplate::with('parameters')->findOrFail($testId);

                    $item = LabOrderItem::create([
                        'lab_order_id' => $labOrder->id,
                        'test_template_id' => $template->id,
                        'test_code' => $template->test_code,
                        'test_name' => $template->test_name,
                        'test_type' => $template->test_type,
                        'sample_type' => $template->sample_type,
                        'price' => $template->price,
                        'status' => 'pending',
                    ]);

                    foreach ($template->parameters as $param) {
                        LabOrderResult::create([
                            'lab_order_item_id' => $item->id,
                            'parameter_id' => $param->id,
                            'parameter_name' => $param->name,
                            'unit' => $param->unit,
                            'normal_range' => $param->normal_range,
                        ]);
                    }
                }
            }

            $grossAmount = (float) $labOrder->items()->sum('price');
            $canEditDiscount = (bool) ($request->user()?->hasPermission('lab_test_order_discount') ?? false);
            $existingDiscount = (float) ($labOrder->discount_amount ?? 0);

            if ($canEditDiscount && array_key_exists('discount_percentage', $validated)) {
                $discountPercent = min(max((float) ($validated['discount_percentage'] ?? 0), 0), 100);
                $discountAmount = round(($grossAmount * $discountPercent) / 100, 2);
            } elseif ($canEditDiscount && array_key_exists('discount_amount', $validated)) {
                $discountAmount = (float) ($validated['discount_amount'] ?? 0);
            } else {
                $discountAmount = $existingDiscount;
            }

            $discountAmount = min(max($discountAmount, 0), max($grossAmount, 0));
            $netAmount = max(0, $grossAmount - $discountAmount);

            $labOrder->discount_amount = round($discountAmount, 2);
            $labOrder->total_amount = round($netAmount, 2);
            $labOrder->paid_amount = min((float) ($labOrder->paid_amount ?? 0), $netAmount);

            if ((float) $labOrder->paid_amount <= 0) {
                $labOrder->payment_status = 'unpaid';
            } elseif ((float) $labOrder->paid_amount < $netAmount) {
                $labOrder->payment_status = 'partial';
            } else {
                $labOrder->payment_status = 'paid';
            }

            // If an admin resets status away from completed, clear completion metadata.
            if (array_key_exists('status', $validated) && $validated['status'] !== 'completed') {
                $labOrder->completed_at = null;

                // If resetting all the way back to pending, also clear assignment/sample info.
                if ($validated['status'] === 'pending') {
                    $labOrder->sample_collected_at = null;
                    $labOrder->assigned_to = null;
                    $labOrder->assigned_to_name = null;
                }
            }

            $labOrder->updated_by = $request->user()?->name;
            $labOrder->save();

            if ((string) $labOrder->status === 'cancelled') {
                $this->ledgerPostingService->voidLabOrderSnapshot($labOrder, $request->user()?->name);
            } else {
                $this->ledgerPostingService->upsertLabOrderSnapshot($labOrder);
            }

            return response()->json([
                'data' => $labOrder->load(['items.results', 'patient', 'walkInPatient', 'doctor']),
                'message' => 'Lab order updated successfully'
            ]);
        });
    }

    /**
     * How far through the workflow each status sits.
     *
     * Cancelled is deliberately absent: it is a departure from the line rather
     * than a point on it, and is guarded separately.
     */
    private const STATUS_ORDER = [
        'pending' => 0,
        'sample_collected' => 1,
        'processing' => 2,
        'completed' => 3,
    ];

    /**
     * Refuse a status change that walks the workflow backwards, or that
     * cancels an order the patient has already paid for.
     *
     * Enforced here rather than only in the UI: a status dropdown is trivially
     * bypassed by calling the API directly, and these transitions decide
     * whether money is owed.
     *
     * Returns an error response, or null when the change is allowed.
     */
    private function guardStatusTransition(Request $request, LabOrder $labOrder, ?string $next)
    {
        if ($next === null || $next === (string) $labOrder->status) {
            return null;
        }

        $user = $request->user();
        $current = (string) $labOrder->status;

        if ($next === 'cancelled') {
            $isPaid = in_array((string) $labOrder->payment_status, ['paid', 'partial'], true);

            if ($isPaid && !($user?->hasPermission('cancel_paid_lab_order') ?? false)) {
                return response()->json([
                    'message' => 'Cancelling a paid lab order requires the Cancel A Paid Lab Order permission. Reverse the payment first, or ask an authorised user.',
                ], 403);
            }

            return null;
        }

        // Leaving a cancelled order is a reinstatement, not ordinary progress.
        if ($current === 'cancelled' && !($user?->hasPermission('reverse_lab_order_status') ?? false)) {
            return response()->json([
                'message' => 'Reinstating a cancelled lab order requires the Move Lab Order Backwards permission.',
            ], 403);
        }

        $from = self::STATUS_ORDER[$current] ?? null;
        $to = self::STATUS_ORDER[$next] ?? null;

        if ($from === null || $to === null) {
            return null;
        }

        if ($to < $from && !($user?->hasPermission('reverse_lab_order_status') ?? false)) {
            return response()->json([
                'message' => 'A lab order cannot be moved back from ' . $current . ' to ' . $next . '. This requires the Move Lab Order Backwards permission.',
            ], 403);
        }

        return null;
    }

    /**
     * Reset payment back to unpaid (Admin/Super Admin)
     */
    public function resetPayment(Request $request, LabOrder $labOrder)
    {
        // Route middleware already requires reverse_lab_payment; checked again
        // here so the rule survives a route being re-pointed at this method.
        if (!($request->user()?->hasPermission('reverse_lab_payment') ?? false)) {
            return response()->json([
                'message' => 'Reversing a lab payment requires the Reverse Lab Payment permission.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'reason' => ['required', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $labOrder->update([
            'payment_status' => 'unpaid',
            'paid_amount' => 0,
            'payment_method' => null,
            'paid_at' => null,
            'paid_by' => null,
            'receipt_number' => null,
            // Preserve lab progress status by default; only payment is reset.
            'updated_by' => $request->user()?->name,
            'remarks' => $validator->validated()['reason'] ?? $labOrder->remarks,
        ]);
        $this->ledgerPostingService->upsertLabOrderSnapshot($labOrder);

        return response()->json([
            'data' => $labOrder->load(['items.results', 'patient', 'walkInPatient', 'doctor']),
            'message' => 'Payment reset to unpaid'
        ]);
    }

    /**
     * Process payment (Receptionist)
     */
    public function processPayment(Request $request, LabOrder $labOrder)
    {
        $validator = Validator::make($request->all(), [
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', 'max:50'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $paidAmount = floatval($request->paid_amount);
        $totalPaid = floatval($labOrder->paid_amount) + $paidAmount;

        $paymentStatus = 'partial';
        if ($totalPaid >= floatval($labOrder->total_amount)) {
            $paymentStatus = 'paid';
            $totalPaid = floatval($labOrder->total_amount);
        }

        $labOrder->update([
            'paid_amount' => $totalPaid,
            'payment_status' => $paymentStatus,
            'payment_method' => $request->payment_method,
            'paid_at' => now(),
            'paid_by' => $request->user()?->name,
            'receipt_number' => $labOrder->receipt_number ?? ('RCP-' . $labOrder->order_number),
            'updated_by' => $request->user()?->name,
        ]);
        $this->ledgerPostingService->upsertLabOrderSnapshot($labOrder);

        return response()->json([
            'data' => $labOrder->load(['items.results', 'patient', 'walkInPatient', 'doctor']),
            'message' => 'Payment processed successfully'
        ]);
    }

    /**
     * Collect sample (Lab Technician)
     */
    public function collectSample(Request $request, LabOrder $labOrder)
    {
        if ($labOrder->payment_status !== 'paid') {
            return response()->json(['message' => 'Payment must be completed first'], 422);
        }

        $labOrder->update([
            'status' => 'sample_collected',
            'sample_collected_at' => now(),
            'assigned_to' => $request->user()?->id,
            'assigned_to_name' => $request->user()?->name,
            'updated_by' => $request->user()?->name,
        ]);

        return response()->json([
            'data' => $labOrder->load(['items.results', 'patient', 'walkInPatient', 'doctor']),
            'message' => 'Sample collected successfully'
        ]);
    }

    /**
     * Enter results for a test item (Lab Technician)
     */
    public function enterResults(Request $request, LabOrderItem $labOrderItem)
    {
        $order = $labOrderItem->order;

        if ($order->payment_status !== 'paid') {
            return response()->json(['message' => 'Payment must be completed first'], 422);
        }

        // The screens hide these tests, but the endpoint is what actually
        // enforces it -- a result keyed against a machine-printed test would
        // contradict the report the analyser already produced.
        if (!$labOrderItem->requiresResult()) {
            return response()->json([
                'message' => 'This test is reported directly by the analyser and does not take results here.',
            ], 422);
        }

        // A submitted result is the shift's record. The technician who entered
        // it may correct it the same day; after that it is closed, to everyone.
        // Enforced here rather than only in the UI -- a closed record that a
        // crafted request can still rewrite is not closed.
        if (!$labOrderItem->isEditableBy($request->user())) {
            $who = $labOrderItem->completed_by ?: 'another user';
            $when = optional($labOrderItem->completed_at)->format('d M Y');

            return response()->json([
                'message' => "This result was submitted by {$who} on {$when} and can no longer be changed."
                    . ' Results may only be corrected by the person who entered them, on the same day.'
                    . ' A supervisor holding "Correct A Closed Lab Result" can still amend it.',
            ], 403);
        }

        $usedOverride = $labOrderItem->requiresLockOverride($request->user());

        $validator = Validator::make($request->all(), [
            'results' => ['required', 'array'],
            'results.*.result_id' => ['required', 'exists:lab_order_results,id'],
            'results.*.result_value' => ['required', 'string', 'max:255'],
            'results.*.remarks' => ['nullable', 'string'],
            // The technician's overall note for the report, distinct from the
            // per-parameter remarks above. 'sometimes' so a caller that does
            // not manage it cannot blank a note someone else wrote.
            'order_remarks' => ['sometimes', 'nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($request, $labOrderItem, $order, $usedOverride) {
            foreach ($request->results as $resultData) {
                $result = LabOrderResult::findOrFail($resultData['result_id']);

                $result->update([
                    'result_value' => $resultData['result_value'],
                    'result_status' => $result->determineStatus(),
                    'remarks' => $resultData['remarks'] ?? null,
                    'entered_by' => $request->user()?->name,
                    'entered_at' => now(),
                ]);
            }

            // Update item status
            // A correction outside the normal window is attributed to whoever
            // made it, on top of the original submitter -- so the record shows
            // both who reported the result and who later amended it.
            if ($usedOverride) {
                $labOrderItem->forceFill([
                    'remarks' => trim(($labOrderItem->remarks ? $labOrderItem->remarks . ' | ' : '')
                        . 'Corrected by ' . ($request->user()?->name ?? 'unknown')
                        . ' on ' . now()->format('d M Y H:i')),
                ])->save();
            }

            $labOrderItem->update([
                'status' => 'completed',
                // Deliberately NOT refreshed on a correction: the edit window is
                // measured from the original submission, so re-saving cannot
                // roll it forward and keep the record open indefinitely.
                'completed_at' => $labOrderItem->completed_at ?? now(),
                'completed_by' => $labOrderItem->completed_by ?? $request->user()?->name,
                'completed_by_id' => $labOrderItem->completed_by_id ?? $request->user()?->id,
            ]);

            // The overall note lives on the order, not the item -- it covers the
            // whole report. Written here so it is saved in the same transaction
            // as the results it describes.
            $orderAttributes = ['updated_by' => $request->user()?->name];
            if ($request->has('order_remarks')) {
                $orderAttributes['remarks'] = $request->input('order_remarks') ?: null;
            }

            // Check if all items are completed
            if ($order->allItemsCompleted()) {
                $orderAttributes['status'] = 'completed';
                $orderAttributes['completed_at'] = now();
            } else {
                $orderAttributes['status'] = 'processing';
            }

            $order->update($orderAttributes);
        });

        return response()->json([
            'data' => $labOrderItem->load('results'),
            'message' => 'Results entered successfully'
        ]);
    }

    /**
     * Get order for result entry (Lab Technician view)
     */
    public function getForResultEntry(Request $request, LabOrder $labOrder)
    {
        $labOrder->load(['items.results', 'patient', 'walkInPatient', 'doctor']);

        // The UI cannot work the rule out for itself -- it does not know who
        // submitted what, or when -- so the server states it per item.
        $labOrder->items->each(function (LabOrderItem $item) use ($request) {
            $item->setAttribute('is_editable', $item->isEditableBy($request->user()));
        });

        return response()->json(['data' => $labOrder]);
    }

    /**
     * Cancel lab order
     */
    public function cancel(Request $request, LabOrder $labOrder)
    {
        if ($labOrder->status === 'completed') {
            return response()->json(['message' => 'Cannot cancel completed order'], 422);
        }

        // Cancelling voids the ledger entry, so a paid order cancelled here
        // would erase money that was actually taken.
        if ($blocked = $this->guardStatusTransition($request, $labOrder, 'cancelled')) {
            return $blocked;
        }

        $labOrder->update([
            'status' => 'cancelled',
            'remarks' => $request->get('reason', 'Cancelled'),
            'updated_by' => $request->user()?->name,
        ]);
        $this->ledgerPostingService->voidLabOrderSnapshot($labOrder, $request->user()?->name);

        return response()->json([
            'data' => $labOrder,
            'message' => 'Lab order cancelled'
        ]);
    }

    /**
     * Delete lab order (Admin only)
     */
    public function destroy(LabOrder $labOrder)
    {
        $labOrder->delete();
        $this->ledgerPostingService->voidLabOrderSnapshot($labOrder, request()->user()?->name);
        return response()->json(['message' => 'Lab order deleted']);
    }

    /**
     * Get receipt data for printing
     */
    public function getReceipt(LabOrder $labOrder)
    {
        return response()->json([
            'data' => [
                'order' => $labOrder->load(['items', 'patient', 'doctor']),
                'hospital' => $labOrder->hospital,
            ]
        ]);
    }

    /**
     * Get report data for printing
     */
    public function getReport(LabOrder $labOrder)
    {
        if ($labOrder->status !== 'completed') {
            return response()->json(['message' => 'Results not ready'], 422);
        }

        return response()->json([
            'data' => [
                'order' => $labOrder->load(['items.results', 'patient', 'walkInPatient', 'doctor']),
                'hospital' => $labOrder->hospital,
            ]
        ]);
    }
}
