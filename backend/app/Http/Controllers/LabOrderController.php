<?php

namespace App\Http\Controllers;

use App\Models\LabOrder;
use App\Models\LabOrderItem;
use App\Models\LabOrderResult;
use App\Models\TestTemplate;
use App\Models\Patient;
use App\Models\User;
use App\Models\WalkInPatient;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LabOrderController extends Controller
{
    /**
     * List lab orders with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = LabOrder::query()
            ->with(['items.results', 'patient', 'doctor']);

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
        if ($request->has('status')) {
            $query->where('status', $request->get('status'));
        }

        // Payment status filter
        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->get('payment_status'));
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

        // Search by order number, patient name
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhere('patient_name', 'like', "%{$search}%");
            });
        }

        $orders = $query->orderByDesc('id')->paginate($request->integer('per_page', 25));

        // Ensure doctor name is always the latest user name (not a stale snapshot).
        $orders->getCollection()->transform(function (LabOrder $order) {
            if ($order->relationLoaded('doctor') && $order->doctor) {
                $order->doctor_name = $order->doctor->name;
            }
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
        $doctor = User::query()->whereKey($data['doctor_id'])->where('role', 'doctor')->first();
        if (!$doctor || (int) $doctor->hospital_id !== (int) $hospitalId) {
            return response()->json(['message' => 'Doctor does not belong to the selected hospital'], 422);
        }

        return DB::transaction(function () use ($data, $hospitalId, $isWalkIn, $request, $doctor) {
            // Handle walk-in patient
            $patientId = null;
            $walkInPatientId = null;
            $patientName = '';
            $patientAge = 0;
            $patientGender = 'male';

            if ($isWalkIn) {
                $walkIn = WalkInPatient::create([
                    'hospital_id' => $hospitalId,
                    'name' => $data['walk_in_patient']['name'],
                    'age' => $data['walk_in_patient']['age'],
                    'gender' => $data['walk_in_patient']['gender'],
                    'phone' => $data['walk_in_patient']['phone'] ?? null,
                    'created_by' => $request->user()?->name,
                ]);
                $walkInPatientId = $walkIn->id;
                $patientName = $walkIn->name;
                $patientAge = $walkIn->age;
                $patientGender = $walkIn->gender;
            } else {
                $patient = Patient::findOrFail($data['patient_id']);
                $patientId = $patient->id;
                $patientName = $patient->name;
                $patientAge = $patient->age;
                $patientGender = $patient->gender;
            }

            // Create lab order
            $order = LabOrder::create([
                'hospital_id' => $hospitalId,
                'order_number' => LabOrder::generateOrderNumber($hospitalId),
                'patient_id' => $patientId,
                'walk_in_patient_id' => $walkInPatientId,
                'is_walk_in' => $isWalkIn,
                'patient_name' => $patientName,
                'patient_age' => $patientAge,
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
            $totalAmount = 0;
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

                $totalAmount += $template->price;

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

            // Update total amount
            $order->update(['total_amount' => $totalAmount]);

            return response()->json([
                'data' => tap($order->load(['items.results', 'patient', 'doctor']), function (LabOrder $loaded) {
                    if ($loaded->doctor) {
                        $loaded->doctor_name = $loaded->doctor->name;
                    }
                }),
                'message' => 'Lab order created successfully'
            ], Response::HTTP_CREATED);
        });
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

        $loaded = $labOrder->load(['items.results', 'patient', 'doctor']);
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
            'priority' => ['in:normal,urgent,stat'],
            'clinical_notes' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
            'status' => ['in:pending,sample_collected,processing,completed,cancelled'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();
        $labOrder->fill($validated);

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

        return response()->json([
            'data' => $labOrder->load(['items.results', 'patient', 'doctor']),
            'message' => 'Lab order updated successfully'
        ]);
    }

    /**
     * Reset payment back to unpaid (Admin/Super Admin)
     */
    public function resetPayment(Request $request, LabOrder $labOrder)
    {
        $validator = Validator::make($request->all(), [
            'reason' => ['nullable', 'string', 'max:255'],
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

        return response()->json([
            'data' => $labOrder->load(['items.results', 'patient', 'doctor']),
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

        return response()->json([
            'data' => $labOrder->load(['items.results', 'patient', 'doctor']),
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
            'data' => $labOrder->load(['items.results', 'patient', 'doctor']),
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

        $validator = Validator::make($request->all(), [
            'results' => ['required', 'array'],
            'results.*.result_id' => ['required', 'exists:lab_order_results,id'],
            'results.*.result_value' => ['required', 'string', 'max:255'],
            'results.*.remarks' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($request, $labOrderItem, $order) {
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
            $labOrderItem->update([
                'status' => 'completed',
                'completed_at' => now(),
                'completed_by' => $request->user()?->name,
            ]);

            // Check if all items are completed
            if ($order->allItemsCompleted()) {
                $order->update([
                    'status' => 'completed',
                    'completed_at' => now(),
                    'updated_by' => $request->user()?->name,
                ]);
            } else {
                $order->update([
                    'status' => 'processing',
                    'updated_by' => $request->user()?->name,
                ]);
            }
        });

        return response()->json([
            'data' => $labOrderItem->load('results'),
            'message' => 'Results entered successfully'
        ]);
    }

    /**
     * Get order for result entry (Lab Technician view)
     */
    public function getForResultEntry(LabOrder $labOrder)
    {
        return response()->json([
            'data' => $labOrder->load(['items.results', 'patient', 'doctor'])
        ]);
    }

    /**
     * Cancel lab order
     */
    public function cancel(Request $request, LabOrder $labOrder)
    {
        if ($labOrder->status === 'completed') {
            return response()->json(['message' => 'Cannot cancel completed order'], 422);
        }

        $labOrder->update([
            'status' => 'cancelled',
            'remarks' => $request->get('reason', 'Cancelled'),
            'updated_by' => $request->user()?->name,
        ]);

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
                'order' => $labOrder->load(['items.results', 'patient', 'doctor']),
                'hospital' => $labOrder->hospital,
            ]
        ]);
    }
}
