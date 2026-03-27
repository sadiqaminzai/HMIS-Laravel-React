<?php

use App\Http\Controllers\PrescriptionController;
use App\Http\Controllers\TransactionController;
use App\Models\Hospital;
use App\Models\Manufacturer;
use App\Models\Medicine;
use App\Models\MedicineType;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

function pharmacyTestUser(int $hospitalId, string $role = 'admin', string $email = 'admin@pharmacy.test'): User
{
    return User::create([
        'hospital_id' => $hospitalId,
        'name' => ucfirst($role) . ' User',
        'email' => $email,
        'password' => 'secret123',
        'role' => $role,
        'is_active' => true,
    ]);
}

function pharmacyRequest(string $method, array $payload, User $user): Request
{
    $request = Request::create('/test-endpoint', $method, $payload);
    $request->setUserResolver(static fn () => $user);

    return $request;
}

function pharmacySetupCoreData(): array
{
    $hospital = Hospital::create([
        'name' => 'Pharmacy Test Hospital',
        'slug' => 'pharmacy-test-hospital',
        'email' => 'hospital-pharmacy@test.local',
        'subscription_status' => 'active',
    ]);

    $admin = pharmacyTestUser($hospital->id, 'admin', 'admin-pharmacy@test.local');
    $doctor = pharmacyTestUser($hospital->id, 'doctor', 'doctor-pharmacy@test.local');

    $patient = Patient::create([
        'hospital_id' => $hospital->id,
        'patient_id' => 'PT-1001',
        'name' => 'Test Patient',
        'age' => 35,
        'gender' => 'male',
        'status' => 'active',
    ]);

    $manufacturer = Manufacturer::create([
        'hospital_id' => $hospital->id,
        'name' => 'Pharma Co',
        'license_number' => 'LIC-1001',
        'country' => 'AF',
        'status' => 'active',
    ]);

    $medicineType = MedicineType::create([
        'hospital_id' => $hospital->id,
        'name' => 'Tablet',
        'status' => 'active',
    ]);

    $medicine = Medicine::create([
        'hospital_id' => $hospital->id,
        'manufacturer_id' => $manufacturer->id,
        'medicine_type_id' => $medicineType->id,
        'brand_name' => 'Paracetamol',
        'generic_name' => 'Acetaminophen',
        'strength' => '500mg',
        'status' => 'active',
        'stock' => 10,
        'sale_price' => 20,
    ]);

    Stock::create([
        'hospital_id' => $hospital->id,
        'medicine_id' => $medicine->id,
        'batch_no' => 'BATCH-001',
        'stock_qty' => 10,
        'bonus_qty' => 0,
        'sale_price' => 20,
    ]);

    return compact('hospital', 'admin', 'doctor', 'patient', 'medicine');
}

function pharmacyCreateSupplier(int $hospitalId): Supplier
{
    return Supplier::create([
        'hospital_id' => $hospitalId,
        'name' => 'Default Supplier',
        'contact_info' => '0700-000000',
        'address' => 'Kabul',
    ]);
}

function pharmacySalesPayload(array $setup, int $quantity, ?string $batchNo = 'BATCH-001'): array
{
    return [
        'hospital_id' => $setup['hospital']->id,
        'trx_type' => 'sales',
        'patient_id' => $setup['patient']->id,
        'paid_amount' => $quantity * 20,
        'items' => [
            [
                'medicine_id' => $setup['medicine']->id,
                'batch_no' => $batchNo,
                'qtty' => $quantity,
                'bonus' => 0,
                'price' => 20,
                'discount' => 0,
                'tax' => 0,
            ],
        ],
    ];
}

function pharmacyPurchasePayload(array $setup, int $supplierId, int $quantity, ?string $batchNo = 'BATCH-001'): array
{
    return [
        'hospital_id' => $setup['hospital']->id,
        'trx_type' => 'purchase',
        'supplier_id' => $supplierId,
        'paid_amount' => $quantity * 20,
        'items' => [
            [
                'medicine_id' => $setup['medicine']->id,
                'batch_no' => $batchNo,
                'qtty' => $quantity,
                'bonus' => 0,
                'price' => 20,
                'discount' => 0,
                'tax' => 0,
            ],
        ],
    ];
}

function pharmacyPrescriptionPayload(array $setup, int $quantity): array
{
    return [
        'hospital_id' => $setup['hospital']->id,
        'is_walk_in' => false,
        'patient_id' => $setup['patient']->id,
        'patient_name' => $setup['patient']->name,
        'patient_age' => 35,
        'patient_gender' => 'male',
        'doctor_id' => $setup['doctor']->id,
        'doctor_name' => $setup['doctor']->name,
        'diagnosis' => 'fever',
        'advice' => 'rest',
        'items' => [
            [
                'medicine_id' => $setup['medicine']->id,
                'medicine_name' => 'Paracetamol',
                'strength' => '500mg',
                'dose' => '1-1-1',
                'duration' => '3 days',
                'instruction' => 'after food',
                'quantity' => $quantity,
                'type' => 'tablet',
            ],
        ],
    ];
}

test('purchase transaction increases stock and medicine totals', function () {
    $setup = pharmacySetupCoreData();
    $supplier = pharmacyCreateSupplier($setup['hospital']->id);
    $controller = app(TransactionController::class);

    $purchaseRequest = pharmacyRequest('POST', pharmacyPurchasePayload($setup, $supplier->id, 5), $setup['admin']);
    $response = $controller->store($purchaseRequest);

    expect($response->getStatusCode())->toBe(201);

    $stock = Stock::query()->where('medicine_id', $setup['medicine']->id)->where('batch_no', 'BATCH-001')->firstOrFail();
    $medicine = $setup['medicine']->fresh();

    expect((int) $stock->stock_qty)->toBe(15)
        ->and((int) $medicine->stock)->toBe(15);
});

test('sales transaction decreases stock and records stock movement', function () {
    $setup = pharmacySetupCoreData();
    $controller = app(TransactionController::class);

    $saleRequest = pharmacyRequest('POST', pharmacySalesPayload($setup, 3), $setup['admin']);
    $response = $controller->store($saleRequest);

    expect($response->getStatusCode())->toBe(201);

    $stock = Stock::query()->where('medicine_id', $setup['medicine']->id)->where('batch_no', 'BATCH-001')->firstOrFail();
    $medicine = $setup['medicine']->fresh();

    expect((int) $stock->stock_qty)->toBe(7)
        ->and((int) $medicine->stock)->toBe(7)
        ->and(StockMovement::query()->where('medicine_id', $setup['medicine']->id)->where('qty_change', -3)->exists())->toBeTrue();
});

test('sales rejects when only expired stock exists', function () {
    $setup = pharmacySetupCoreData();
    $controller = app(TransactionController::class);

    $stock = Stock::query()->where('medicine_id', $setup['medicine']->id)->where('batch_no', 'BATCH-001')->firstOrFail();
    $stock->stock_qty = 0;
    $stock->save();

    Stock::create([
        'hospital_id' => $setup['hospital']->id,
        'medicine_id' => $setup['medicine']->id,
        'batch_no' => 'EXPIRED-1',
        'stock_qty' => 10,
        'bonus_qty' => 0,
        'expiry_date' => now()->subDay()->toDateString(),
        'sale_price' => 20,
    ]);

    $saleRequest = pharmacyRequest('POST', pharmacySalesPayload($setup, 1, null), $setup['admin']);
    expect(fn () => $controller->store($saleRequest))->toThrow(ValidationException::class);

    $medicine = $setup['medicine']->fresh();
    expect((int) $medicine->stock)->toBe(10);
});

test('purchase return rejects when return quantity exceeds available stock', function () {
    $setup = pharmacySetupCoreData();
    $supplier = pharmacyCreateSupplier($setup['hospital']->id);
    $controller = app(TransactionController::class);

    $returnRequest = pharmacyRequest('POST', [
        'hospital_id' => $setup['hospital']->id,
        'trx_type' => 'purchase_return',
        'supplier_id' => $supplier->id,
        'paid_amount' => 220,
        'items' => [
            [
                'medicine_id' => $setup['medicine']->id,
                'batch_no' => 'BATCH-001',
                'qtty' => 11,
                'bonus' => 0,
                'price' => 20,
                'discount' => 0,
                'tax' => 0,
            ],
        ],
    ], $setup['admin']);

    expect(fn () => $controller->store($returnRequest))->toThrow(ValidationException::class);
});

test('update sales transaction reverses previous quantities and applies new quantities', function () {
    $setup = pharmacySetupCoreData();
    $controller = app(TransactionController::class);

    $createRequest = pharmacyRequest('POST', pharmacySalesPayload($setup, 4), $setup['admin']);
    $createResponse = $controller->store($createRequest);
    expect($createResponse->getStatusCode())->toBe(201);

    $trx = Transaction::query()->latest('id')->firstOrFail();

    $updateRequest = pharmacyRequest('PUT', [
        'hospital_id' => $setup['hospital']->id,
        'trx_type' => 'sales',
        'patient_id' => $setup['patient']->id,
        'paid_amount' => 60,
        'items' => [
            [
                'medicine_id' => $setup['medicine']->id,
                'batch_no' => 'BATCH-001',
                'qtty' => 3,
                'bonus' => 0,
                'price' => 20,
                'discount' => 0,
                'tax' => 0,
            ],
        ],
    ], $setup['admin']);

    $updateResponse = $controller->update($updateRequest, $trx);
    expect($updateResponse->getStatusCode())->toBe(200);

    $stock = Stock::query()->where('medicine_id', $setup['medicine']->id)->where('batch_no', 'BATCH-001')->firstOrFail();
    expect((int) $stock->stock_qty)->toBe(7);
});

test('delete sales transaction restores stock to previous balance', function () {
    $setup = pharmacySetupCoreData();
    $controller = app(TransactionController::class);

    $createRequest = pharmacyRequest('POST', pharmacySalesPayload($setup, 2), $setup['admin']);
    $controller->store($createRequest);
    $trx = Transaction::query()->latest('id')->firstOrFail();

    $deleteRequest = pharmacyRequest('DELETE', [], $setup['admin']);
    $deleteResponse = $controller->destroy($deleteRequest, $trx);
    expect($deleteResponse->getStatusCode())->toBe(200);

    $stock = Stock::query()->where('medicine_id', $setup['medicine']->id)->where('batch_no', 'BATCH-001')->firstOrFail();
    $medicine = $setup['medicine']->fresh();
    expect((int) $stock->stock_qty)->toBe(10)
        ->and((int) $medicine->stock)->toBe(10);
});

test('prescription reservation blocks over-allocation and dispense deducts stock through transaction flow', function () {
    $setup = pharmacySetupCoreData();

    /** @var PrescriptionController $controller */
    $controller = app(PrescriptionController::class);

    $storeRequest = pharmacyRequest('POST', pharmacyPrescriptionPayload($setup, 8), $setup['admin']);

    $storeResponse = $controller->store($storeRequest);
    expect($storeResponse->getStatusCode())->toBe(201);

    $firstPrescription = Prescription::query()->latest('id')->firstOrFail();
    $firstItem = PrescriptionItem::query()->where('prescription_id', $firstPrescription->id)->firstOrFail();

    expect((int) $firstItem->reserved_quantity)->toBe(8)
        ->and((int) $firstItem->dispensed_quantity)->toBe(0);

    $overReserveRequest = pharmacyRequest('POST', pharmacyPrescriptionPayload($setup, 5), $setup['admin']);

    expect(fn () => $controller->store($overReserveRequest))->toThrow(ValidationException::class);

    $dispenseRequest = pharmacyRequest('POST', [], $setup['admin']);
    $dispenseResponse = $controller->dispense($dispenseRequest, $firstPrescription);

    expect($dispenseResponse->getStatusCode())->toBe(200);

    $updatedItem = $firstItem->fresh();
    $updatedPrescription = $firstPrescription->fresh();
    $stock = Stock::query()->where('medicine_id', $setup['medicine']->id)->firstOrFail();

    expect((int) $updatedItem->dispensed_quantity)->toBe(8)
        ->and((int) $stock->stock_qty)->toBe(2)
        ->and($updatedPrescription->dispensed_at)->not->toBeNull()
        ->and($updatedPrescription->dispensing_transaction_id)->not->toBeNull();

    $trx = Transaction::query()->findOrFail($updatedPrescription->dispensing_transaction_id);
    expect($trx->trx_type)->toBe('sales');
});

test('dispense supports partial then full flow and updates prescription state', function () {
    $setup = pharmacySetupCoreData();
    $controller = app(PrescriptionController::class);

    $createRequest = pharmacyRequest('POST', pharmacyPrescriptionPayload($setup, 6), $setup['admin']);
    $controller->store($createRequest);

    $prescription = Prescription::query()->latest('id')->firstOrFail();
    $item = PrescriptionItem::query()->where('prescription_id', $prescription->id)->firstOrFail();

    $partialDispenseRequest = pharmacyRequest('POST', [
        'items' => [
            [
                'prescription_item_id' => $item->id,
                'quantity' => 4,
            ],
        ],
    ], $setup['admin']);

    $partialResponse = $controller->dispense($partialDispenseRequest, $prescription);
    expect($partialResponse->getStatusCode())->toBe(200);

    $item->refresh();
    $prescription->refresh();

    expect((int) $item->dispensed_quantity)->toBe(4)
        ->and($prescription->dispensed_at)->toBeNull();

    $fullDispenseRequest = pharmacyRequest('POST', [], $setup['admin']);
    $controller->dispense($fullDispenseRequest, $prescription);

    $item->refresh();
    $prescription->refresh();

    expect((int) $item->dispensed_quantity)->toBe(6)
        ->and($prescription->dispensed_at)->not->toBeNull();
});

test('dispense fails when requested quantity exceeds remaining quantity', function () {
    $setup = pharmacySetupCoreData();
    $controller = app(PrescriptionController::class);

    $createRequest = pharmacyRequest('POST', pharmacyPrescriptionPayload($setup, 3), $setup['admin']);
    $controller->store($createRequest);

    $prescription = Prescription::query()->latest('id')->firstOrFail();
    $item = PrescriptionItem::query()->where('prescription_id', $prescription->id)->firstOrFail();

    $badDispenseRequest = pharmacyRequest('POST', [
        'items' => [
            [
                'prescription_item_id' => $item->id,
                'quantity' => 4,
            ],
        ],
    ], $setup['admin']);

    expect(fn () => $controller->dispense($badDispenseRequest, $prescription))->toThrow(ValidationException::class);
});

test('dispense fails for cancelled prescription', function () {
    $setup = pharmacySetupCoreData();
    $controller = app(PrescriptionController::class);

    $createRequest = pharmacyRequest('POST', pharmacyPrescriptionPayload($setup, 2), $setup['admin']);
    $controller->store($createRequest);

    $prescription = Prescription::query()->latest('id')->firstOrFail();
    $prescription->status = 'cancelled';
    $prescription->save();

    $dispenseRequest = pharmacyRequest('POST', [], $setup['admin']);
    expect(fn () => $controller->dispense($dispenseRequest, $prescription))->toThrow(ValidationException::class);
});

test('editing prescription after partial dispense is rejected', function () {
    $setup = pharmacySetupCoreData();
    $controller = app(PrescriptionController::class);

    $createRequest = pharmacyRequest('POST', pharmacyPrescriptionPayload($setup, 5), $setup['admin']);
    $controller->store($createRequest);

    $prescription = Prescription::query()->latest('id')->firstOrFail();
    $item = PrescriptionItem::query()->where('prescription_id', $prescription->id)->firstOrFail();

    $partialDispenseRequest = pharmacyRequest('POST', [
        'items' => [
            [
                'prescription_item_id' => $item->id,
                'quantity' => 1,
            ],
        ],
    ], $setup['admin']);
    $controller->dispense($partialDispenseRequest, $prescription);

    $updateRequest = pharmacyRequest('PUT', pharmacyPrescriptionPayload($setup, 4), $setup['admin']);
    expect(fn () => $controller->update($updateRequest, $prescription))->toThrow(ValidationException::class);
});

test('parallel sales race path rejects second sale and keeps stock non-negative', function () {
    $setup = pharmacySetupCoreData();

    /** @var TransactionController $controller */
    $controller = app(TransactionController::class);

    $firstSaleRequest = pharmacyRequest('POST', [
        'hospital_id' => $setup['hospital']->id,
        'trx_type' => 'sales',
        'patient_id' => $setup['patient']->id,
        'paid_amount' => 120,
        'items' => [
            [
                'medicine_id' => $setup['medicine']->id,
                'batch_no' => 'BATCH-001',
                'qtty' => 6,
                'bonus' => 0,
                'price' => 20,
                'discount' => 0,
                'tax' => 0,
            ],
        ],
    ], $setup['admin']);

    $firstResponse = $controller->store($firstSaleRequest);
    expect($firstResponse->getStatusCode())->toBe(201);

    $secondSaleRequest = pharmacyRequest('POST', [
        'hospital_id' => $setup['hospital']->id,
        'trx_type' => 'sales',
        'patient_id' => $setup['patient']->id,
        'paid_amount' => 100,
        'items' => [
            [
                'medicine_id' => $setup['medicine']->id,
                'batch_no' => 'BATCH-001',
                'qtty' => 5,
                'bonus' => 0,
                'price' => 20,
                'discount' => 0,
                'tax' => 0,
            ],
        ],
    ], $setup['admin']);

    expect(fn () => $controller->store($secondSaleRequest))->toThrow(ValidationException::class);

    $stock = Stock::query()->where('medicine_id', $setup['medicine']->id)->firstOrFail();
    expect((int) $stock->stock_qty)->toBe(4)
        ->and((int) $stock->stock_qty)->toBeGreaterThanOrEqual(0);
});
