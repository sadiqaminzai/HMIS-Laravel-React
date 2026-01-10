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

	Route::apiResource('hospitals', HospitalController::class)->except(['create', 'edit']);
	Route::apiResource('doctors', DoctorController::class)->except(['create', 'edit']);
	Route::apiResource('patients', PatientController::class)->except(['create', 'edit']);
	Route::apiResource('appointments', AppointmentController::class)->except(['create', 'edit']);
	Route::apiResource('manufacturers', ManufacturerController::class)->except(['create', 'edit']);
	Route::apiResource('medicine-types', MedicineTypeController::class)->except(['create', 'edit']);
	Route::apiResource('medicines', MedicineController::class)->except(['create', 'edit']);
	Route::apiResource('prescriptions', PrescriptionController::class)->except(['create', 'edit']);
	Route::apiResource('test-templates', TestTemplateController::class)->except(['create', 'edit']);

	// Lab Orders
	Route::apiResource('lab-orders', LabOrderController::class)->except(['create', 'edit']);
	Route::post('lab-orders/{labOrder}/payment', [LabOrderController::class, 'processPayment']);
	Route::post('lab-orders/{labOrder}/collect-sample', [LabOrderController::class, 'collectSample']);
	Route::post('lab-orders/{labOrder}/cancel', [LabOrderController::class, 'cancel']);
	Route::post('lab-order-items/{labOrderItem}/results', [LabOrderController::class, 'enterResults']);
	Route::get('lab-orders/{labOrder}/receipt', [LabOrderController::class, 'getReceipt']);
	Route::get('lab-orders/{labOrder}/report', [LabOrderController::class, 'getReport']);

	Route::get('hospital-settings/{hospital}', [HospitalSettingController::class, 'show']);
	Route::put('hospital-settings/{hospital}', [HospitalSettingController::class, 'update']);
	Route::apiResource('users', UserController::class);
	Route::apiResource('roles', RoleController::class);
	Route::apiResource('permissions', PermissionController::class);
	Route::apiResource('contact-messages', ContactMessageController::class)->only(['index', 'show', 'update', 'destroy']);
});
