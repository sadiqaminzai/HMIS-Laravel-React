<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ContactMessageController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DatabaseBackupController;
use App\Http\Controllers\DoctorController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\HospitalSettingController;
use App\Http\Controllers\LabOrderController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\HospitalController;
use App\Http\Controllers\ManufacturerController;
use App\Http\Controllers\MedicineController;
use App\Http\Controllers\MedicineTypeController;
use App\Http\Controllers\PrescriptionController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\StockReconciliationController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\TestTemplateController;
use App\Http\Controllers\ShifaaScriptController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/contact-messages', [ContactMessageController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
	Route::get('/me', [AuthController::class, 'me']);
	Route::post('/logout', [AuthController::class, 'logout']);
	Route::get('/health', [ShifaaScriptController::class, 'index']);
	Route::get('/my-hospital', [HospitalController::class, 'myHospital']);
	Route::get('/dashboard/summary', [DashboardController::class, 'summary'])->middleware('permission:view_dashboard');

	Route::apiResource('hospitals', HospitalController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:manage_hospitals',
		'show' => 'permission:manage_hospitals',
		'store' => 'permission:manage_hospitals',
		'update' => 'permission:manage_hospitals',
		'destroy' => 'permission:manage_hospitals',
	]);
	// Doctors
	Route::apiResource('doctors', DoctorController::class)
		->only(['index', 'show'])
		->middleware('permission_or_doctor:view_doctors,manage_doctors');
	Route::apiResource('doctors', DoctorController::class)
		->only(['store', 'update', 'destroy'])
		->middleware('permission:manage_doctors');

	// Patients
	Route::apiResource('patients', PatientController::class)
		->only(['index', 'show'])
		->middleware('permission_or_doctor:view_patients,manage_patients,register_patients');
	Route::apiResource('patients', PatientController::class)
		->only(['store', 'update', 'destroy'])
		->middleware('permission:register_patients,manage_patients');
	// NOTE: Do not use apiResource()->middleware([ 'index' => ..., ... ]) here.
	// On Laravel's resource registration, that pattern applies ALL middleware values to ALL actions,
	// which unintentionally makes `index` require manage-level permissions.
	Route::get('appointments', [AppointmentController::class, 'index'])->middleware('permission_or_doctor:view_appointments,manage_appointments,schedule_appointments');
	Route::get('appointments/{appointment}', [AppointmentController::class, 'show'])->middleware('permission_or_doctor:view_appointments,manage_appointments,schedule_appointments');
	Route::post('appointments', [AppointmentController::class, 'store'])->middleware('permission:schedule_appointments,manage_appointments');
	Route::match(['PUT', 'PATCH'], 'appointments/{appointment}', [AppointmentController::class, 'update'])->middleware('permission:manage_appointments,update_appointment_status');
	Route::delete('appointments/{appointment}', [AppointmentController::class, 'destroy'])->middleware('permission:manage_appointments');
	Route::apiResource('manufacturers', ManufacturerController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_manufacturers,manage_manufacturers',
		'show' => 'permission:view_manufacturers,manage_manufacturers',
		'store' => 'permission:manage_manufacturers',
		'update' => 'permission:manage_manufacturers',
		'destroy' => 'permission:manage_manufacturers',
	]);
	Route::apiResource('medicine-types', MedicineTypeController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_medicine_types,manage_medicine_types',
		'show' => 'permission:view_medicine_types,manage_medicine_types',
		'store' => 'permission:manage_medicine_types',
		'update' => 'permission:manage_medicine_types',
		'destroy' => 'permission:manage_medicine_types',
	]);
	// Medicines
	Route::apiResource('medicines', MedicineController::class)
		->only(['index', 'show'])
		->middleware('permission_or_doctor:view_medicines,manage_medicines,create_prescription,manage_prescriptions');
	Route::apiResource('medicines', MedicineController::class)
		->only(['store', 'update', 'destroy'])
		->middleware('permission:manage_medicines');

	// Suppliers
	Route::apiResource('suppliers', SupplierController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_suppliers,manage_suppliers',
		'show' => 'permission:view_suppliers,manage_suppliers',
		'store' => 'permission:manage_suppliers',
		'update' => 'permission:manage_suppliers',
		'destroy' => 'permission:manage_suppliers',
	]);

	// Transactions
	Route::get('transactions', [TransactionController::class, 'index'])->middleware('permission:view_transactions,manage_transactions');
	Route::get('transactions/{transaction}', [TransactionController::class, 'show'])->middleware('permission:view_transactions,manage_transactions');
	Route::post('transactions', [TransactionController::class, 'store'])->middleware('permission:manage_transactions');
	Route::match(['PUT', 'PATCH'], 'transactions/{transaction}', [TransactionController::class, 'update'])->middleware('permission:manage_transactions');
	Route::delete('transactions/{transaction}', [TransactionController::class, 'destroy'])->middleware('permission:manage_transactions');

	// Stocks (read-only)
	Route::get('stocks', [StockController::class, 'index'])->middleware('permission:view_stocks,manage_stocks');
	Route::get('stocks/{stock}', [StockController::class, 'show'])->middleware('permission:view_stocks,manage_stocks');
	Route::get('stock-reconciliation', [StockReconciliationController::class, 'index'])->middleware('permission:view_stocks,manage_stocks');
	Route::post('stock-reconciliation', [StockReconciliationController::class, 'store'])->middleware('permission:manage_stocks');

	// Prescriptions
	Route::apiResource('prescriptions', PrescriptionController::class)
		->only(['index', 'show'])
		->middleware('permission_or_doctor:view_prescriptions,manage_prescriptions,create_prescription');
	Route::apiResource('prescriptions', PrescriptionController::class)
		->only(['store', 'update', 'destroy'])
		->middleware('permission:manage_prescriptions,create_prescription');
	// Split read vs write routes so index/show don't unintentionally require manage permissions.
	Route::apiResource('test-templates', TestTemplateController::class)
		->only(['index', 'show'])
		->middleware('permission_or_doctor:view_test_templates,manage_test_templates');
	Route::apiResource('test-templates', TestTemplateController::class)
		->only(['store', 'update', 'destroy'])
		->middleware('permission:manage_test_templates');

	// Lab Orders
	// Split read vs write routes to avoid resource middleware stacking issues.
	Route::get('lab-orders', [LabOrderController::class, 'index'])->middleware('permission_or_doctor:view_lab_orders,manage_lab_orders');
	Route::get('lab-orders/{labOrder}', [LabOrderController::class, 'show'])->middleware('permission_or_doctor:view_lab_orders,manage_lab_orders');
	Route::post('lab-orders', [LabOrderController::class, 'store'])->middleware('permission_or_doctor:manage_lab_orders');
	Route::match(['PUT', 'PATCH'], 'lab-orders/{labOrder}', [LabOrderController::class, 'update'])->middleware('permission:manage_lab_orders,update_lab_order_status');
	Route::delete('lab-orders/{labOrder}', [LabOrderController::class, 'destroy'])->middleware('permission:manage_lab_orders');
	Route::post('lab-orders/{labOrder}/payment', [LabOrderController::class, 'processPayment'])->middleware('permission:manage_lab_payments,manage_lab_orders');
	Route::post('lab-orders/{labOrder}/reset-payment', [LabOrderController::class, 'resetPayment'])->middleware('permission:manage_lab_payments,manage_lab_orders');
	Route::post('lab-orders/{labOrder}/collect-sample', [LabOrderController::class, 'collectSample'])->middleware('permission:manage_lab_orders,update_lab_order_status');
	Route::post('lab-orders/{labOrder}/cancel', [LabOrderController::class, 'cancel'])->middleware('permission:manage_lab_orders,update_lab_order_status');
	Route::post('lab-order-items/{labOrderItem}/results', [LabOrderController::class, 'enterResults'])->middleware('permission:enter_lab_results,manage_lab_orders');
	Route::get('lab-orders/{labOrder}/receipt', [LabOrderController::class, 'getReceipt'])->middleware('permission:view_lab_orders,manage_lab_orders');
	Route::get('lab-orders/{labOrder}/report', [LabOrderController::class, 'getReport'])->middleware('permission:view_lab_orders,manage_lab_orders');

	Route::get('hospital-settings/{hospital}', [HospitalSettingController::class, 'show'])->middleware('permission_or_doctor:view_hospital_settings,manage_hospital_settings');
	Route::put('hospital-settings/{hospital}', [HospitalSettingController::class, 'update'])->middleware('permission:manage_hospital_settings');
	Route::apiResource('users', UserController::class)->middleware([
		'index' => 'permission:view_users,manage_users',
		'show' => 'permission:view_users,manage_users',
		'store' => 'permission:manage_users',
		'update' => 'permission:manage_users',
		'destroy' => 'permission:manage_users',
	]);
	Route::apiResource('roles', RoleController::class)->middleware([
		'index' => 'permission:view_roles,manage_roles',
		'show' => 'permission:view_roles,manage_roles',
		'store' => 'permission:manage_roles',
		'update' => 'permission:manage_roles',
		'destroy' => 'permission:manage_roles',
	]);
	Route::apiResource('permissions', PermissionController::class)->middleware([
		'index' => 'permission:view_permissions,manage_permissions',
		'show' => 'permission:view_permissions,manage_permissions',
		'store' => 'permission:manage_permissions',
		'update' => 'permission:manage_permissions',
		'destroy' => 'permission:manage_permissions',
	]);
	Route::apiResource('contact-messages', ContactMessageController::class)->only(['index', 'show', 'update', 'destroy'])->middleware([
		'index' => 'permission:view_contact_messages,manage_contact_messages',
		'show' => 'permission:view_contact_messages,manage_contact_messages',
		'update' => 'permission:manage_contact_messages',
		'destroy' => 'permission:manage_contact_messages',
	]);

	// Database Backups
	Route::get('backups', [DatabaseBackupController::class, 'index'])->middleware('permission:manage_hospital_settings');
	Route::get('backups/settings', [DatabaseBackupController::class, 'settings'])->middleware('permission:manage_hospital_settings');
	Route::put('backups/settings', [DatabaseBackupController::class, 'updateSettings'])->middleware('permission:manage_hospital_settings');
	Route::post('backups', [DatabaseBackupController::class, 'store'])->middleware('permission:manage_hospital_settings');
	Route::get('backups/{filename}/download', [DatabaseBackupController::class, 'download'])->middleware('permission:manage_hospital_settings');
	Route::delete('backups/{filename}', [DatabaseBackupController::class, 'destroy'])->middleware('permission:manage_hospital_settings');
});
