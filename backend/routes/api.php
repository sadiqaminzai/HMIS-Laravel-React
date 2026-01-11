<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ContactMessageController;
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

	Route::apiResource('hospitals', HospitalController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:manage_hospitals',
		'show' => 'permission:manage_hospitals',
		'store' => 'permission:manage_hospitals',
		'update' => 'permission:manage_hospitals',
		'destroy' => 'permission:manage_hospitals',
	]);
	Route::apiResource('doctors', DoctorController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_doctors,manage_doctors',
		'show' => 'permission:view_doctors,manage_doctors',
		'store' => 'permission:manage_doctors',
		'update' => 'permission:manage_doctors',
		'destroy' => 'permission:manage_doctors',
	]);
	Route::apiResource('patients', PatientController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_patients,manage_patients,register_patients',
		'show' => 'permission:view_patients,manage_patients,register_patients',
		'store' => 'permission:register_patients,manage_patients',
		'update' => 'permission:manage_patients',
		'destroy' => 'permission:manage_patients',
	]);
	Route::apiResource('appointments', AppointmentController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_appointments,manage_appointments,schedule_appointments',
		'show' => 'permission:view_appointments,manage_appointments,schedule_appointments',
		'store' => 'permission:schedule_appointments,manage_appointments',
		'update' => 'permission:manage_appointments',
		'destroy' => 'permission:manage_appointments',
	]);
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
	Route::apiResource('medicines', MedicineController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_medicines,manage_medicines',
		'show' => 'permission:view_medicines,manage_medicines',
		'store' => 'permission:manage_medicines',
		'update' => 'permission:manage_medicines',
		'destroy' => 'permission:manage_medicines',
	]);
	Route::apiResource('prescriptions', PrescriptionController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_prescriptions,manage_prescriptions',
		'show' => 'permission:view_prescriptions,manage_prescriptions',
		'store' => 'permission:create_prescription,manage_prescriptions',
		'update' => 'permission:manage_prescriptions',
		'destroy' => 'permission:manage_prescriptions',
	]);
	Route::apiResource('test-templates', TestTemplateController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_test_templates,manage_test_templates',
		'show' => 'permission:view_test_templates,manage_test_templates',
		'store' => 'permission:manage_test_templates',
		'update' => 'permission:manage_test_templates',
		'destroy' => 'permission:manage_test_templates',
	]);

	// Lab Orders
	Route::apiResource('lab-orders', LabOrderController::class)->except(['create', 'edit'])->middleware([
		'index' => 'permission:view_lab_orders,manage_lab_orders',
		'show' => 'permission:view_lab_orders,manage_lab_orders',
		'store' => 'permission:manage_lab_orders',
		'update' => 'permission:manage_lab_orders',
		'destroy' => 'permission:manage_lab_orders',
	]);
	Route::post('lab-orders/{labOrder}/payment', [LabOrderController::class, 'processPayment'])->middleware('permission:manage_lab_payments,manage_lab_orders');
	Route::post('lab-orders/{labOrder}/reset-payment', [LabOrderController::class, 'resetPayment'])->middleware('permission:manage_lab_payments,manage_lab_orders');
	Route::post('lab-orders/{labOrder}/collect-sample', [LabOrderController::class, 'collectSample'])->middleware('permission:manage_lab_orders');
	Route::post('lab-orders/{labOrder}/cancel', [LabOrderController::class, 'cancel'])->middleware('permission:manage_lab_orders');
	Route::post('lab-order-items/{labOrderItem}/results', [LabOrderController::class, 'enterResults'])->middleware('permission:enter_lab_results,manage_lab_orders');
	Route::get('lab-orders/{labOrder}/receipt', [LabOrderController::class, 'getReceipt'])->middleware('permission:view_lab_orders,manage_lab_orders');
	Route::get('lab-orders/{labOrder}/report', [LabOrderController::class, 'getReport'])->middleware('permission:view_lab_orders,manage_lab_orders');

	Route::get('hospital-settings/{hospital}', [HospitalSettingController::class, 'show'])->middleware('permission:view_hospital_settings,manage_hospital_settings');
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
});
