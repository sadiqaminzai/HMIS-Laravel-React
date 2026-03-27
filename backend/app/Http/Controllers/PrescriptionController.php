<?php

namespace App\Http\Controllers;

use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\User;
use App\Models\WalkInPatient;
use App\Models\ModuleSequence;
use Illuminate\Http\Request;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PrescriptionController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Prescription::with(['items.groupLink', 'walkInPatient'])->orderByDesc('created_at');

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('doctor_id')) {
            $query->where('doctor_id', $request->integer('doctor_id'));
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('prescription_number', 'like', "%{$search}%")
                    ->orWhere('patient_name', 'like', "%{$search}%")
                    ->orWhere('doctor_name', 'like', "%{$search}%");
            });
        }

        $perPage = max(1, min($request->integer('per_page', 25), 200));

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $this->authorizePrescriptionAction($request->user(), ['add_prescriptions', 'create_prescription', 'manage_prescriptions']);

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->ensureHospitalConsistency($data);

        if (!empty($data['is_walk_in']) && empty($data['walk_in_patient_id'])) {
            $walkIn = WalkInPatient::create([
                'hospital_id' => $data['hospital_id'],
                'name' => $data['patient_name'],
                'age' => $data['patient_age'] ?? 0,
                'gender' => $data['patient_gender'] ?? null,
                'created_by' => $request->user()->name ?? null,
            ]);
            $data['walk_in_patient_id'] = $walkIn->id;
            $data['patient_id'] = null;
        }

        $prescription = null;
        $attempts = 0;

        while ($attempts < 3 && !$prescription) {
            try {
                $prescription = DB::transaction(function () use ($data) {
                    $items = $this->normalizePrescriptionItems($data['items'] ?? []);
                    $this->ensurePrescriptionStockAvailability((int) $data['hospital_id'], $items, null, true);

                    $prescription = Prescription::create(array_merge($data, [
                        'prescription_number' => $data['prescription_number'] ?? null,
                        'status' => 'active',
                    ]));

                    foreach ($items as $item) {
                        $prescription->items()->create($item);
                    }

                    return $prescription->load('items.groupLink');
                });
            } catch (UniqueConstraintViolationException $e) {
                $attempts++;
                if (!str_contains($e->getMessage(), 'prescriptions_hospital_id_prescription_number_unique')) {
                    throw $e;
                }

                $hospitalId = (int) ($data['hospital_id'] ?? 0);
                if ($hospitalId <= 0) {
                    throw $e;
                }

                $maxNumber = Prescription::withTrashed()
                    ->where('hospital_id', $hospitalId)
                    ->get(['prescription_number'])
                    ->reduce(function (int $max, Prescription $row) {
                        $numeric = (int) preg_replace('/\D+/', '', (string) $row->prescription_number);
                        return max($max, $numeric);
                    }, 0);

                ModuleSequence::updateOrCreate(
                    ['hospital_id' => $hospitalId, 'module' => 'prescription'],
                    ['last_number' => $maxNumber]
                );

                $data['prescription_number'] = null;
            }
        }

        if (!$prescription) {
            abort(500, 'Unable to generate a unique prescription number.');
        }

        return response()->json($prescription, 201);
    }

    public function show(Request $request, Prescription $prescription)
    {
        $this->authorizeScope($request->user(), $prescription);
        return response()->json($prescription->load('items.groupLink'));
    }

    public function update(Request $request, Prescription $prescription)
    {
        $this->authorizePrescriptionAction($request->user(), ['edit_prescriptions', 'manage_prescriptions']);
        $this->authorizeScope($request->user(), $prescription);

        $data = $this->validatePayload($request, $prescription->hospital_id, true);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $prescription->hospital_id;
        }

        $this->ensureHospitalConsistency($data, $prescription);

        if (!empty($data['is_walk_in']) && empty($data['walk_in_patient_id'])) {
            $walkIn = WalkInPatient::create([
                'hospital_id' => $data['hospital_id'],
                'name' => $data['patient_name'],
                'age' => $data['patient_age'] ?? 0,
                'gender' => $data['patient_gender'] ?? null,
                'created_by' => $request->user()->name ?? null,
            ]);
            $data['walk_in_patient_id'] = $walkIn->id;
            $data['patient_id'] = null;
        }

        $updated = DB::transaction(function () use ($prescription, $data) {
            $prescription->load('items');
            $hasDispensedItems = $prescription->items->contains(function (PrescriptionItem $item) {
                return (int) ($item->dispensed_quantity ?? 0) > 0;
            });

            if ($hasDispensedItems) {
                throw ValidationException::withMessages([
                    'items' => 'Prescription has already been partially dispensed and can no longer be edited.',
                ]);
            }

            $items = $this->normalizePrescriptionItems($data['items'] ?? []);
            $this->ensurePrescriptionStockAvailability((int) $prescription->hospital_id, $items, (int) $prescription->id, true);

            $prescription->update($data);

            $prescription->items()->delete();
            foreach ($items as $item) {
                $prescription->items()->create($item);
            }

            return $prescription->load('items.groupLink');
        });

        return response()->json($updated);
    }

    public function destroy(Request $request, Prescription $prescription)
    {
        $this->authorizePrescriptionAction($request->user(), ['delete_prescriptions', 'manage_prescriptions']);
        $this->authorizeScope($request->user(), $prescription);

        DB::transaction(function () use ($prescription) {
            $prescription->items()->delete();
            $prescription->forceDelete();
        });
        return response()->json(['message' => 'Prescription deleted']);
    }

    public function dispense(Request $request, Prescription $prescription)
    {
        $this->authorizePrescriptionAction($request->user(), ['dispense_medicines', 'manage_prescriptions', 'manage_transactions']);
        $this->authorizeScope($request->user(), $prescription);

        $data = $request->validate([
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.prescription_item_id' => ['required_with:items', 'integer', 'exists:prescription_items,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
        ]);

        $actor = $request->user()->name ?? null;

        $result = DB::transaction(function () use ($prescription, $data, $actor) {
            $prescription = Prescription::query()
                ->whereKey($prescription->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($prescription->status === 'cancelled') {
                throw ValidationException::withMessages([
                    'status' => 'Cancelled prescriptions cannot be dispensed.',
                ]);
            }

            $prescription->load('items');
            $dispensePlan = $this->buildDispensePlan($prescription, $data['items'] ?? null);

            if (empty($dispensePlan)) {
                throw ValidationException::withMessages([
                    'items' => 'No remaining medicine quantity found for dispensing.',
                ]);
            }

            $this->ensurePrescriptionStockAvailability(
                (int) $prescription->hospital_id,
                array_map(static function (array $row) {
                    return [
                        'medicine_id' => $row['medicine_id'],
                        'quantity' => $row['quantity'],
                    ];
                }, $dispensePlan),
                (int) $prescription->id,
                true
            );

            $totalAmount = 0.0;
            foreach ($dispensePlan as &$row) {
                $medicine = Medicine::query()->find((int) $row['medicine_id']);
                $unitPrice = (float) ($medicine?->sale_price ?? 0);
                $row['price'] = $unitPrice;
                $row['amount'] = round($unitPrice * (int) $row['quantity'], 2);
                $totalAmount += $row['amount'];
            }
            unset($row);

            $transaction = Transaction::create([
                'hospital_id' => (int) $prescription->hospital_id,
                'patient_id' => $prescription->is_walk_in ? null : $prescription->patient_id,
                'patient_name' => $prescription->patient_name,
                'trx_type' => 'sales',
                'grand_total' => round($totalAmount, 2),
                'total_discount' => 0,
                'total_tax' => 0,
                'paid_amount' => round($totalAmount, 2),
                'due_amount' => 0,
                'created_by' => $actor,
                'updated_by' => $actor,
            ]);

            $itemsById = $prescription->items->keyBy('id');

            foreach ($dispensePlan as $row) {
                $transaction->details()->create([
                    'medicine_id' => (int) $row['medicine_id'],
                    'batch_no' => null,
                    'expiry_date' => null,
                    'qtty' => (int) $row['quantity'],
                    'bonus' => 0,
                    'price' => (float) $row['price'],
                    'discount' => 0,
                    'tax' => 0,
                    'amount' => (float) $row['amount'],
                ]);

                $this->deductMedicineFromStock(
                    (int) $prescription->hospital_id,
                    (int) $row['medicine_id'],
                    (int) $row['quantity'],
                    (float) $row['price'],
                    (int) $transaction->id,
                    $actor
                );

                /** @var PrescriptionItem|null $item */
                $item = $itemsById->get((int) $row['prescription_item_id']);
                if ($item) {
                    $newDispensedQty = (int) ($item->dispensed_quantity ?? 0) + (int) $row['quantity'];
                    $item->dispensed_quantity = min((int) $item->quantity, $newDispensedQty);
                    if ((int) $item->dispensed_quantity >= (int) $item->quantity) {
                        $item->dispensed_at = now();
                    }
                    $item->save();
                }
            }

            $prescription->load('items');
            $isFullyDispensed = $prescription->items
                ->whereNotNull('medicine_id')
                ->every(function (PrescriptionItem $item) {
                    return (int) ($item->dispensed_quantity ?? 0) >= (int) $item->quantity;
                });

            $prescription->dispensing_transaction_id = (int) $transaction->id;
            if ($isFullyDispensed) {
                $prescription->dispensed_at = now();
                $prescription->dispensed_by = $actor;
            }
            $prescription->save();

            return [
                'message' => $isFullyDispensed ? 'Prescription dispensed successfully.' : 'Prescription partially dispensed successfully.',
                'transaction' => $transaction->load(['details.medicine', 'patient']),
                'prescription' => $prescription->load(['items.groupLink', 'walkInPatient']),
            ];
        });

        return response()->json($result);
    }

    private function validatePayload(Request $request, ?int $defaultHospitalId = null, bool $isUpdate = false): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        $isWalkIn = $request->boolean('is_walk_in');

        $validated = $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'is_walk_in' => ['sometimes', 'boolean'],
            'walk_in_patient_id' => ['nullable', 'exists:walk_in_patients,id'],
            'patient_id' => [$isWalkIn ? 'nullable' : 'required', 'exists:patients,id'],
            'patient_name' => ['required', 'string', 'max:255'],
            'patient_age' => ['required', 'integer', 'min:0'],
            'patient_gender' => ['nullable', 'string', 'max:20'],
            'doctor_id' => ['required', 'integer'],
            'doctor_name' => ['required', 'string', 'max:255'],
            'diagnosis' => ['nullable', 'string'],
            'advice' => ['nullable', 'string'],
            'next_visit' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::in(['active', 'cancelled'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => ['nullable', 'exists:medicines,id'],
            'items.*.medicine_name' => ['required', 'string', 'max:255'],
            'items.*.strength' => ['nullable', 'string', 'max:255'],
            'items.*.dose' => ['nullable', 'string', 'max:255'],
            'items.*.duration' => ['nullable', 'string', 'max:255'],
            'items.*.instruction' => ['nullable', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:0'],
            'items.*.type' => ['nullable', 'string', 'max:255'],
        ]);

        $validated['hospital_id'] = $hospitalId;
        $validated['created_by'] = $request->user()->name ?? null;

        $validated['is_walk_in'] = $isWalkIn;

        return $validated;
    }

    private function normalizePrescriptionItems(array $items): array
    {
        return array_map(function (array $item) {
            $quantity = (int) ($item['quantity'] ?? 0);
            $hasMedicine = !empty($item['medicine_id']);

            $item['reserved_quantity'] = $hasMedicine ? max(0, $quantity) : 0;
            $item['dispensed_quantity'] = 0;
            $item['dispensed_at'] = null;

            return $item;
        }, $items);
    }

    private function ensurePrescriptionStockAvailability(
        int $hospitalId,
        array $items,
        ?int $excludePrescriptionId = null,
        bool $lockRows = false
    ): void {
        $requiredByMedicine = [];

        foreach ($items as $item) {
            $medicineId = (int) ($item['medicine_id'] ?? 0);
            $quantity = (int) ($item['quantity'] ?? 0);

            if ($medicineId <= 0 || $quantity <= 0) {
                continue;
            }

            $requiredByMedicine[$medicineId] = ($requiredByMedicine[$medicineId] ?? 0) + $quantity;
        }

        if (empty($requiredByMedicine)) {
            return;
        }

        $today = now()->toDateString();

        foreach ($requiredByMedicine as $medicineId => $required) {
            $stockQuery = Stock::query()
                ->where('hospital_id', $hospitalId)
                ->where('medicine_id', (int) $medicineId)
                ->where(function ($q) use ($today) {
                    $q->whereNull('expiry_date')
                        ->orWhere('expiry_date', '>=', $today);
                });

            if ($lockRows) {
                $stocks = $stockQuery->lockForUpdate()->get(['stock_qty', 'bonus_qty']);
                $available = (int) $stocks->reduce(function (int $sum, Stock $stock) {
                    return $sum + (int) $stock->stock_qty + (int) ($stock->bonus_qty ?? 0);
                }, 0);
            } else {
                $available = (int) $stockQuery->sum(DB::raw('stock_qty + COALESCE(bonus_qty, 0)'));
            }

            $reservedRowsQuery = PrescriptionItem::query()
                ->join('prescriptions', 'prescriptions.id', '=', 'prescription_items.prescription_id')
                ->whereNull('prescriptions.deleted_at')
                ->where('prescriptions.hospital_id', $hospitalId)
                ->where('prescriptions.status', 'active')
                ->where('prescription_items.medicine_id', (int) $medicineId);

            if ($excludePrescriptionId) {
                $reservedRowsQuery->where('prescriptions.id', '!=', $excludePrescriptionId);
            }

            if ($lockRows) {
                $reservedRowsQuery->lockForUpdate();
            }

            $reservedRows = $reservedRowsQuery->get([
                'prescription_items.reserved_quantity',
                'prescription_items.dispensed_quantity',
            ]);

            $reservedByOthers = (int) $reservedRows->reduce(function (int $sum, PrescriptionItem $row) {
                $remaining = (int) ($row->reserved_quantity ?? 0) - (int) ($row->dispensed_quantity ?? 0);
                return $sum + max(0, $remaining);
            }, 0);

            $availableForReservation = $available - $reservedByOthers;
            if ($availableForReservation < $required) {
                $medicine = Medicine::find($medicineId);
                $name = $medicine?->brand_name ?? 'Medicine';
                throw ValidationException::withMessages([
                    'items' => "Insufficient available stock for {$name}. Available: {$availableForReservation}, Required: {$required}.",
                ]);
            }
        }
    }

    private function buildDispensePlan(Prescription $prescription, ?array $requestedItems = null): array
    {
        $plan = [];
        $itemsById = $prescription->items->keyBy('id');

        if (empty($requestedItems)) {
            foreach ($prescription->items as $item) {
                $medicineId = (int) ($item->medicine_id ?? 0);
                $remaining = (int) $item->quantity - (int) ($item->dispensed_quantity ?? 0);
                if ($medicineId <= 0 || $remaining <= 0) {
                    continue;
                }

                $plan[] = [
                    'prescription_item_id' => (int) $item->id,
                    'medicine_id' => $medicineId,
                    'quantity' => $remaining,
                ];
            }

            return $plan;
        }

        $seen = [];
        foreach ($requestedItems as $row) {
            $itemId = (int) ($row['prescription_item_id'] ?? 0);
            $quantity = (int) ($row['quantity'] ?? 0);

            if ($itemId <= 0 || $quantity <= 0) {
                continue;
            }

            if (isset($seen[$itemId])) {
                throw ValidationException::withMessages([
                    'items' => 'Duplicate prescription items are not allowed in a single dispense request.',
                ]);
            }
            $seen[$itemId] = true;

            /** @var PrescriptionItem|null $item */
            $item = $itemsById->get($itemId);
            if (!$item || (int) $item->prescription_id !== (int) $prescription->id) {
                throw ValidationException::withMessages([
                    'items' => 'One or more dispense rows do not belong to this prescription.',
                ]);
            }

            $medicineId = (int) ($item->medicine_id ?? 0);
            if ($medicineId <= 0) {
                throw ValidationException::withMessages([
                    'items' => 'Dispense is only supported for medicine-backed prescription items.',
                ]);
            }

            $remaining = (int) $item->quantity - (int) ($item->dispensed_quantity ?? 0);
            if ($quantity > $remaining) {
                throw ValidationException::withMessages([
                    'items' => "Requested quantity for {$item->medicine_name} exceeds remaining quantity.",
                ]);
            }

            $plan[] = [
                'prescription_item_id' => (int) $item->id,
                'medicine_id' => $medicineId,
                'quantity' => $quantity,
            ];
        }

        return $plan;
    }

    private function deductMedicineFromStock(
        int $hospitalId,
        int $medicineId,
        int $quantity,
        float $unitPrice,
        int $trxId,
        ?string $actor = null
    ): void {
        if ($quantity <= 0) {
            return;
        }

        $today = now()->toDateString();
        $stocks = Stock::query()
            ->where('hospital_id', $hospitalId)
            ->where('medicine_id', $medicineId)
            ->whereRaw('(stock_qty + COALESCE(bonus_qty, 0)) > 0')
            ->where(function ($q) use ($today) {
                $q->whereNull('expiry_date')
                    ->orWhere('expiry_date', '>=', $today);
            })
            ->orderByRaw('CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $remaining = $quantity;

        foreach ($stocks as $stock) {
            if ($remaining <= 0) {
                break;
            }

            $availableMain = (int) $stock->stock_qty;
            $availableBonus = (int) ($stock->bonus_qty ?? 0);

            $qtyFromMain = min($availableMain, $remaining);
            $stock->stock_qty = $availableMain - $qtyFromMain;
            $remaining -= $qtyFromMain;

            $qtyFromBonus = min($availableBonus, $remaining);
            $stock->bonus_qty = $availableBonus - $qtyFromBonus;
            $remaining -= $qtyFromBonus;

            $stock->save();

            if ($qtyFromMain > 0 || $qtyFromBonus > 0) {
                StockMovement::create([
                    'hospital_id' => $hospitalId,
                    'medicine_id' => $medicineId,
                    'trx_id' => $trxId,
                    'trx_type' => 'sales',
                    'batch_no' => $stock->batch_no,
                    'expiry_date' => $stock->expiry_date,
                    'qty_change' => -1 * $qtyFromMain,
                    'bonus_change' => -1 * $qtyFromBonus,
                    'unit_price' => $unitPrice,
                    'balance_qty' => (int) $stock->stock_qty,
                    'balance_bonus' => (int) ($stock->bonus_qty ?? 0),
                    'actor' => $actor,
                    'is_reversal' => false,
                ]);
            }
        }

        if ($remaining > 0) {
            $medicine = Medicine::find($medicineId);
            $name = $medicine?->brand_name ?? 'Medicine';
            throw ValidationException::withMessages([
                'items' => "Insufficient stock while dispensing {$name}. Remaining unmet quantity: {$remaining}.",
            ]);
        }

        $medicine = Medicine::query()->whereKey($medicineId)->lockForUpdate()->first();
        if ($medicine) {
            $next = (int) $medicine->stock - $quantity;
            if ($next < 0) {
                throw ValidationException::withMessages([
                    'items' => "Insufficient aggregate stock for {$medicine->brand_name} during dispensing.",
                ]);
            }
            $medicine->stock = $next;
            $medicine->save();
        }
    }

    private function ensureHospitalConsistency(array &$data, ?Prescription $existing = null): void
    {
        $hospitalId = $data['hospital_id'] ?? $existing?->hospital_id;

        if (!empty($data['is_walk_in'])) {
            if (!empty($data['walk_in_patient_id'])) {
                $walkIn = WalkInPatient::findOrFail($data['walk_in_patient_id']);
                if ((int) $walkIn->hospital_id !== (int) $hospitalId) {
                    abort(422, 'Walk-in patient does not belong to the selected hospital');
                }
            }
        } else {
            $patient = Patient::findOrFail($data['patient_id']);
            if ((int) $patient->hospital_id !== (int) $hospitalId) {
                abort(422, 'Patient does not belong to the selected hospital');
            }
        }

        $doctor = $this->resolveDoctorUser((int) $data['doctor_id']);
        if ((int) $doctor->hospital_id !== (int) $hospitalId) {
            abort(422, 'Doctor does not belong to the selected hospital');
        }

        $data['doctor_id'] = $doctor->id;

        $data['hospital_id'] = $hospitalId;
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

    private function authorizePrescriptionAction($user, array $permissions): void
    {
        $this->ensureAnyPermission($user, $permissions, 'Only users with prescription permissions can manage prescriptions');
    }

    private function authorizeScope($user, Prescription $prescription): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $prescription->hospital_id) {
            abort(403, 'Unauthorized prescription access');
        }
    }

}
