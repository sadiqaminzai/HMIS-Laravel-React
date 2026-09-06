<?php

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ContactMessageController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DatabaseBackupController;
use App\Http\Controllers\DoctorController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\PaymentCollectionController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\DesignationController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\EmployeeAttendanceController;
use App\Http\Controllers\LeaveRequestController;
use App\Http\Controllers\SalaryStructureController;
use App\Http\Controllers\PayrollBatchController;
use App\Http\Controllers\PayrollItemController;
use App\Http\Controllers\HrDataToolsController;
use App\Http\Controllers\HospitalSettingController;
use App\Http\Controllers\LabOrderController;
use App\Http\Controllers\LedgerController;
use App\Http\Controllers\ExpenseCategoryController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\OtherIncomeCategoryController;
use App\Http\Controllers\OtherIncomeController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\HospitalController;
use App\Http\Controllers\ManufacturerController;
use App\Http\Controllers\MedicineController;
use App\Http\Controllers\MedicineSetController;
use App\Http\Controllers\MedicineTypeController;
use App\Http\Controllers\PrescriptionController;
use App\Http\Controllers\PrescriptionDiagnosisController;
use App\Http\Controllers\PrescriptionItemGroupController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\StockReconciliationController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\PharmacyFinanceController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\RoomBookingController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\PatientSurgeryController;
use App\Http\Controllers\SurgeryController;
use App\Http\Controllers\SurgeryTypeController;
use App\Http\Controllers\TestTemplateController;
use App\Http\Controllers\UltrasoundExamController;
use App\Http\Controllers\XrayReceiptController;
use App\Http\Controllers\UltrasoundTypeController;
use App\Http\Controllers\DentalReceiptController;
use App\Http\Controllers\DentalServiceController;
use App\Http\Controllers\XrayTypeController;
use App\Http\Controllers\ShifaaScriptController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VerificationController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/contact-messages', [ContactMessageController::class, 'store']);
Route::get('/verify/prescriptions/{token}', [VerificationController::class, 'prescription']);
Route::get('/verify/patients/{token}', [VerificationController::class, 'patient']);
Route::get('/verify/lab-reports/{token}', [VerificationController::class, 'labReport']);
Route::get('/verify/transactions/{token}', [VerificationController::class, 'transaction']);
Route::get('/verify/surgery-discharges/{token}', [VerificationController::class, 'surgeryDischarge']);

Route::middleware('auth:sanctum')->group(function () {
	Route::get('/me', [AuthController::class, 'me']);
	Route::post('/logout', [AuthController::class, 'logout']);
	Route::get('/health', [ShifaaScriptController::class, 'index']);
	Route::get('/my-hospital', [HospitalController::class, 'myHospital']);
	Route::get('/dashboard/summary', [DashboardController::class, 'summary'])->middleware('permission:view_dashboard');
	Route::get('/dashboard/finance-submission', [DashboardController::class, 'financeSubmission'])->middleware('permission:view_dashboard');

	Route::get('hospitals', [HospitalController::class, 'index'])->middleware('permission:view_hospitals,manage_hospitals');
	Route::get('hospitals/{hospital}', [HospitalController::class, 'show'])->middleware('permission:view_hospitals,manage_hospitals');
	Route::post('hospitals', [HospitalController::class, 'store'])->middleware('permission:add_hospitals,manage_hospitals');
	Route::match(['PUT', 'PATCH'], 'hospitals/{hospital}', [HospitalController::class, 'update'])->middleware('permission:edit_hospitals,manage_hospitals');
	Route::delete('hospitals/{hospital}', [HospitalController::class, 'destroy'])->middleware('permission:delete_hospitals,manage_hospitals');

	// Doctors
	Route::get('doctors', [DoctorController::class, 'index'])->middleware('permission_or_doctor:view_doctors,manage_doctors');
	Route::get('doctors/{doctor}', [DoctorController::class, 'show'])->middleware('permission_or_doctor:view_doctors,manage_doctors');
	Route::post('doctors', [DoctorController::class, 'store'])->middleware('permission:add_doctors,manage_doctors');
	Route::match(['PUT', 'PATCH'], 'doctors/{doctor}', [DoctorController::class, 'update'])->middleware('permission:edit_doctors,manage_doctors');
	Route::delete('doctors/{doctor}', [DoctorController::class, 'destroy'])->middleware('permission:delete_doctors,manage_doctors');

	// Patients
	Route::get('patients', [PatientController::class, 'index'])->middleware('permission_or_doctor:view_patients,manage_patients,register_patients');
	Route::get('patients/{patient}', [PatientController::class, 'show'])->middleware('permission_or_doctor:view_patients,manage_patients,register_patients');
	Route::post('patients', [PatientController::class, 'store'])->middleware('permission:add_patients,register_patients,manage_patients');
	Route::match(['PUT', 'PATCH'], 'patients/{patient}', [PatientController::class, 'update'])->middleware('permission:edit_patients,manage_patients');
	Route::delete('patients/{patient}', [PatientController::class, 'destroy'])->middleware('permission:delete_patients,manage_patients');

	Route::get('appointments', [AppointmentController::class, 'index'])->middleware('permission_or_doctor:view_appointments,manage_appointments,schedule_appointments');
	Route::get('appointments/{appointment}', [AppointmentController::class, 'show'])->middleware('permission_or_doctor:view_appointments,manage_appointments,schedule_appointments');
	Route::post('appointments', [AppointmentController::class, 'store'])->middleware('permission:add_appointments,schedule_appointments,manage_appointments');
	Route::match(['PUT', 'PATCH'], 'appointments/{appointment}', [AppointmentController::class, 'update'])->middleware('permission:edit_appointments,manage_appointments,update_appointment_status');
	Route::delete('appointments/{appointment}', [AppointmentController::class, 'destroy'])->middleware('permission:delete_appointments,manage_appointments');
	// Collecting the fee is its own right, so a cashier can take money without
	// being able to edit the appointment, and a clerk can book without taking it.
	// COLLECT keeps a fallback so nobody is locked out mid-deploy. REVERSE does
	// NOT: undoing a payment is how cash gets taken and the trace erased, so it
	// is granted explicitly or not at all.
	// The money collector's desk: every unpaid charge across the revenue
	// modules, filtered to the ones this user may actually settle. Read-only
	// -- collecting still goes to each module's own payment endpoint, so the
	// per-module permission and collector attribution are unchanged.
	Route::get('payment-collection/pending', [PaymentCollectionController::class, 'pending']);

	Route::post('appointments/{appointment}/payment', [AppointmentController::class, 'processPayment'])->middleware('permission:manage_appointment_payments,manage_appointments');
	Route::post('appointments/{appointment}/payment/reverse', [AppointmentController::class, 'reversePayment'])->middleware('permission:reverse_appointment_payment');

	// Room management and booking
	Route::get('rooms', [RoomController::class, 'index'])->middleware('permission:view_rooms,manage_rooms');
	Route::get('rooms/{room}', [RoomController::class, 'show'])->middleware('permission:view_rooms,manage_rooms');
	Route::post('rooms', [RoomController::class, 'store'])->middleware('permission:add_rooms,manage_rooms');
	Route::match(['PUT', 'PATCH'], 'rooms/{room}', [RoomController::class, 'update'])->middleware('permission:edit_rooms,manage_rooms');
	Route::delete('rooms/{room}', [RoomController::class, 'destroy'])->middleware('permission:delete_rooms,manage_rooms');

	Route::get('room-bookings', [RoomBookingController::class, 'index'])->middleware('permission:view_room_bookings,manage_room_bookings');
	Route::get('room-bookings/availability', [RoomBookingController::class, 'availability'])->middleware('permission:view_room_bookings,manage_room_bookings,add_room_bookings,edit_room_bookings');
	Route::get('room-bookings/{roomBooking}', [RoomBookingController::class, 'show'])->middleware('permission:view_room_bookings,manage_room_bookings');
	Route::post('room-bookings', [RoomBookingController::class, 'store'])->middleware('permission:add_room_bookings,manage_room_bookings');
	Route::match(['PUT', 'PATCH'], 'room-bookings/{roomBooking}', [RoomBookingController::class, 'update'])->middleware('permission:edit_room_bookings,manage_room_bookings');
	Route::delete('room-bookings/{roomBooking}', [RoomBookingController::class, 'destroy'])->middleware('permission:delete_room_bookings,manage_room_bookings');
	Route::post('room-bookings/{roomBooking}/payment', [RoomBookingController::class, 'processPayment'])->middleware('permission:manage_room_booking_payments,manage_room_bookings');
	Route::post('room-bookings/{roomBooking}/payment/reverse', [RoomBookingController::class, 'reversePayment'])->middleware('permission:reverse_room_booking_payment');

	// Surgery management
	Route::get('surgery-types', [SurgeryTypeController::class, 'index'])->middleware('permission:view_surgery_types,manage_surgery_types');
	Route::get('surgery-types/{surgeryType}', [SurgeryTypeController::class, 'show'])->middleware('permission:view_surgery_types,manage_surgery_types');
	Route::post('surgery-types', [SurgeryTypeController::class, 'store'])->middleware('permission:add_surgery_types,manage_surgery_types');
	Route::match(['PUT', 'PATCH'], 'surgery-types/{surgeryType}', [SurgeryTypeController::class, 'update'])->middleware('permission:edit_surgery_types,manage_surgery_types');
	Route::delete('surgery-types/{surgeryType}', [SurgeryTypeController::class, 'destroy'])->middleware('permission:delete_surgery_types,manage_surgery_types');

	Route::get('surgeries', [SurgeryController::class, 'index'])->middleware('permission:view_surgeries,manage_surgeries');
	Route::get('surgeries/{surgery}', [SurgeryController::class, 'show'])->middleware('permission:view_surgeries,manage_surgeries');
	Route::post('surgeries', [SurgeryController::class, 'store'])->middleware('permission:add_surgeries,manage_surgeries');
	Route::match(['PUT', 'PATCH'], 'surgeries/{surgery}', [SurgeryController::class, 'update'])->middleware('permission:edit_surgeries,manage_surgeries');
	Route::delete('surgeries/{surgery}', [SurgeryController::class, 'destroy'])->middleware('permission:delete_surgeries,manage_surgeries');

	Route::get('patient-surgeries', [PatientSurgeryController::class, 'index'])->middleware('permission:view_patient_surgeries,manage_patient_surgeries');
	Route::get('patient-surgeries/{patientSurgery}', [PatientSurgeryController::class, 'show'])->middleware('permission:view_patient_surgeries,manage_patient_surgeries');
	Route::post('patient-surgeries', [PatientSurgeryController::class, 'store'])->middleware('permission:add_patient_surgeries,manage_patient_surgeries');
	Route::match(['PUT', 'PATCH'], 'patient-surgeries/{patientSurgery}', [PatientSurgeryController::class, 'update'])->middleware('permission:edit_patient_surgeries,manage_patient_surgeries');
	Route::post('patient-surgeries/{patientSurgery}/toggle-payment-status', [PatientSurgeryController::class, 'togglePaymentStatus'])->middleware('permission:edit_patient_surgeries,manage_patient_surgeries');
	Route::delete('patient-surgeries/{patientSurgery}', [PatientSurgeryController::class, 'destroy'])->middleware('permission:delete_patient_surgeries,manage_patient_surgeries');
	Route::post('patient-surgeries/{patientSurgery}/payment', [PatientSurgeryController::class, 'processPayment'])->middleware('permission:manage_surgery_payments,manage_patient_surgeries');
	Route::post('patient-surgeries/{patientSurgery}/payment/reverse', [PatientSurgeryController::class, 'reversePayment'])->middleware('permission:reverse_surgery_payment');

	Route::get('manufacturers', [ManufacturerController::class, 'index'])->middleware('permission:view_manufacturers,manage_manufacturers');
	Route::get('manufacturers/{manufacturer}', [ManufacturerController::class, 'show'])->middleware('permission:view_manufacturers,manage_manufacturers');
	Route::post('manufacturers', [ManufacturerController::class, 'store'])->middleware('permission:add_manufacturers,manage_manufacturers');
	Route::match(['PUT', 'PATCH'], 'manufacturers/{manufacturer}', [ManufacturerController::class, 'update'])->middleware('permission:edit_manufacturers,manage_manufacturers');
	Route::delete('manufacturers/{manufacturer}', [ManufacturerController::class, 'destroy'])->middleware('permission:delete_manufacturers,manage_manufacturers');

	Route::get('medicine-types', [MedicineTypeController::class, 'index'])->middleware('permission:view_medicine_types,manage_medicine_types');
	Route::get('medicine-types/{medicineType}', [MedicineTypeController::class, 'show'])->middleware('permission:view_medicine_types,manage_medicine_types');
	Route::post('medicine-types', [MedicineTypeController::class, 'store'])->middleware('permission:add_medicine_types,manage_medicine_types');
	Route::match(['PUT', 'PATCH'], 'medicine-types/{medicineType}', [MedicineTypeController::class, 'update'])->middleware('permission:edit_medicine_types,manage_medicine_types');
	Route::delete('medicine-types/{medicineType}', [MedicineTypeController::class, 'destroy'])->middleware('permission:delete_medicine_types,manage_medicine_types');

	// Medicines
	Route::get('medicines', [MedicineController::class, 'index'])->middleware('permission_or_doctor:view_medicines,manage_medicines,create_prescription,manage_prescriptions');
	// Registered before /medicines/{medicine} so 'barcode-lookup' is not
	// swallowed by the wildcard route.
	Route::get('medicines/barcode-lookup', [MedicineController::class, 'findByBarcode'])->middleware('permission_or_doctor:view_medicines,manage_medicines,dispense_medicines');
	Route::post('medicines/{medicine}/generate-barcode', [MedicineController::class, 'generateBarcode'])->middleware('permission:edit_medicines,manage_medicines');
	Route::get('medicines/{medicine}', [MedicineController::class, 'show'])->middleware('permission_or_doctor:view_medicines,manage_medicines,create_prescription,manage_prescriptions');
	Route::post('medicines', [MedicineController::class, 'store'])->middleware('permission:add_medicines,manage_medicines');
	Route::match(['PUT', 'PATCH'], 'medicines/{medicine}', [MedicineController::class, 'update'])->middleware('permission:edit_medicines,manage_medicines');
	Route::delete('medicines/{medicine}', [MedicineController::class, 'destroy'])->middleware('permission:delete_medicines,manage_medicines');

	// Suppliers
	Route::get('suppliers', [SupplierController::class, 'index'])->middleware('permission:view_suppliers,manage_suppliers');
	Route::get('suppliers/{supplier}', [SupplierController::class, 'show'])->middleware('permission:view_suppliers,manage_suppliers');
	Route::post('suppliers', [SupplierController::class, 'store'])->middleware('permission:add_suppliers,manage_suppliers');
	Route::match(['PUT', 'PATCH'], 'suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('permission:edit_suppliers,manage_suppliers');
	Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy'])->middleware('permission:delete_suppliers,manage_suppliers');

	// Expense Categories
	Route::get('expense-categories', [ExpenseCategoryController::class, 'index'])->middleware('permission:view_expense_categories,manage_expense_categories');
	Route::get('expense-categories/{expenseCategory}', [ExpenseCategoryController::class, 'show'])->middleware('permission:view_expense_categories,manage_expense_categories');
	Route::post('expense-categories', [ExpenseCategoryController::class, 'store'])->middleware('permission:add_expense_categories,manage_expense_categories');
	Route::match(['PUT', 'PATCH'], 'expense-categories/{expenseCategory}', [ExpenseCategoryController::class, 'update'])->middleware('permission:edit_expense_categories,manage_expense_categories');
	Route::delete('expense-categories/{expenseCategory}', [ExpenseCategoryController::class, 'destroy'])->middleware('permission:delete_expense_categories,manage_expense_categories');

	// Expenses
	Route::get('expenses', [ExpenseController::class, 'index'])->middleware('permission:view_expenses,manage_expenses');
	Route::get('expenses/{expense}', [ExpenseController::class, 'show'])->middleware('permission:view_expenses,manage_expenses');
	Route::post('expenses', [ExpenseController::class, 'store'])->middleware('permission:add_expenses,manage_expenses');
	Route::match(['PUT', 'PATCH'], 'expenses/{expense}', [ExpenseController::class, 'update'])->middleware('permission:edit_expenses,manage_expenses');
	Route::delete('expenses/{expense}', [ExpenseController::class, 'destroy'])->middleware('permission:delete_expenses,manage_expenses');

	// Other Income Categories
	Route::get('other-income-categories', [OtherIncomeCategoryController::class, 'index'])->middleware('permission:view_other_income_categories,manage_other_income_categories');
	Route::get('other-income-categories/{otherIncomeCategory}', [OtherIncomeCategoryController::class, 'show'])->middleware('permission:view_other_income_categories,manage_other_income_categories');
	Route::post('other-income-categories', [OtherIncomeCategoryController::class, 'store'])->middleware('permission:add_other_income_categories,manage_other_income_categories');
	Route::match(['PUT', 'PATCH'], 'other-income-categories/{otherIncomeCategory}', [OtherIncomeCategoryController::class, 'update'])->middleware('permission:edit_other_income_categories,manage_other_income_categories');
	Route::delete('other-income-categories/{otherIncomeCategory}', [OtherIncomeCategoryController::class, 'destroy'])->middleware('permission:delete_other_income_categories,manage_other_income_categories');

	// Other Incomes
	Route::get('other-incomes', [OtherIncomeController::class, 'index'])->middleware('permission:view_other_incomes,manage_other_incomes');
	Route::get('other-incomes/{otherIncome}', [OtherIncomeController::class, 'show'])->middleware('permission:view_other_incomes,manage_other_incomes');
	Route::post('other-incomes', [OtherIncomeController::class, 'store'])->middleware('permission:add_other_incomes,manage_other_incomes');
	Route::match(['PUT', 'PATCH'], 'other-incomes/{otherIncome}', [OtherIncomeController::class, 'update'])->middleware('permission:edit_other_incomes,manage_other_incomes');
	Route::delete('other-incomes/{otherIncome}', [OtherIncomeController::class, 'destroy'])->middleware('permission:delete_other_incomes,manage_other_incomes');

	// HR - Departments
	Route::get('departments', [DepartmentController::class, 'index'])->middleware('permission:view_departments,manage_departments');
	Route::get('departments/{department}', [DepartmentController::class, 'show'])->middleware('permission:view_departments,manage_departments');
	Route::post('departments', [DepartmentController::class, 'store'])->middleware('permission:add_departments,manage_departments');
	Route::match(['PUT', 'PATCH'], 'departments/{department}', [DepartmentController::class, 'update'])->middleware('permission:edit_departments,manage_departments');
	Route::delete('departments/{department}', [DepartmentController::class, 'destroy'])->middleware('permission:delete_departments,manage_departments');

	// HR - Designations
	Route::get('designations', [DesignationController::class, 'index'])->middleware('permission:view_designations,manage_designations');
	Route::get('designations/{designation}', [DesignationController::class, 'show'])->middleware('permission:view_designations,manage_designations');
	Route::post('designations', [DesignationController::class, 'store'])->middleware('permission:add_designations,manage_designations');
	Route::match(['PUT', 'PATCH'], 'designations/{designation}', [DesignationController::class, 'update'])->middleware('permission:edit_designations,manage_designations');
	Route::delete('designations/{designation}', [DesignationController::class, 'destroy'])->middleware('permission:delete_designations,manage_designations');

	// HR - Shifts
	Route::get('shifts', [ShiftController::class, 'index'])->middleware('permission:view_shifts,manage_shifts');
	Route::get('shifts/{shift}', [ShiftController::class, 'show'])->middleware('permission:view_shifts,manage_shifts');
	Route::post('shifts', [ShiftController::class, 'store'])->middleware('permission:add_shifts,manage_shifts');
	Route::match(['PUT', 'PATCH'], 'shifts/{shift}', [ShiftController::class, 'update'])->middleware('permission:edit_shifts,manage_shifts');
	Route::delete('shifts/{shift}', [ShiftController::class, 'destroy'])->middleware('permission:delete_shifts,manage_shifts');

	// HR - Employees
	Route::get('employees', [EmployeeController::class, 'index'])->middleware('permission:view_employees,manage_employees');
	Route::get('employees/{employee}', [EmployeeController::class, 'show'])->middleware('permission:view_employees,manage_employees');
	Route::post('employees', [EmployeeController::class, 'store'])->middleware('permission:add_employees,manage_employees');
	Route::match(['PUT', 'PATCH'], 'employees/{employee}', [EmployeeController::class, 'update'])->middleware('permission:edit_employees,manage_employees');
	Route::delete('employees/{employee}', [EmployeeController::class, 'destroy'])->middleware('permission:delete_employees,manage_employees');

	// HR - Employee Attendances
	Route::get('employee-attendances', [EmployeeAttendanceController::class, 'index'])->middleware('permission:view_employee_attendances,manage_employee_attendances');
	Route::post('employee-attendances/bulk', [EmployeeAttendanceController::class, 'bulkStore'])->middleware('permission:add_employee_attendances,manage_employee_attendances');
	Route::get('employee-attendances/{employeeAttendance}', [EmployeeAttendanceController::class, 'show'])->middleware('permission:view_employee_attendances,manage_employee_attendances');
	Route::post('employee-attendances', [EmployeeAttendanceController::class, 'store'])->middleware('permission:add_employee_attendances,manage_employee_attendances');
	Route::match(['PUT', 'PATCH'], 'employee-attendances/{employeeAttendance}', [EmployeeAttendanceController::class, 'update'])->middleware('permission:edit_employee_attendances,manage_employee_attendances');
	Route::delete('employee-attendances/{employeeAttendance}', [EmployeeAttendanceController::class, 'destroy'])->middleware('permission:delete_employee_attendances,manage_employee_attendances');

	// HR - Leave Requests
	Route::get('leave-requests', [LeaveRequestController::class, 'index'])->middleware('permission:view_leave_requests,manage_leave_requests');
	Route::get('leave-requests/{leaveRequest}', [LeaveRequestController::class, 'show'])->middleware('permission:view_leave_requests,manage_leave_requests');
	Route::post('leave-requests', [LeaveRequestController::class, 'store'])->middleware('permission:add_leave_requests,manage_leave_requests');
	Route::match(['PUT', 'PATCH'], 'leave-requests/{leaveRequest}', [LeaveRequestController::class, 'update'])->middleware('permission:edit_leave_requests,manage_leave_requests,approve_leave_requests');
	Route::post('leave-requests/{leaveRequest}/approve', [LeaveRequestController::class, 'approve'])->middleware('permission:approve_leave_requests,manage_leave_requests');
	Route::post('leave-requests/{leaveRequest}/reject', [LeaveRequestController::class, 'reject'])->middleware('permission:approve_leave_requests,manage_leave_requests');
	Route::post('leave-requests/{leaveRequest}/cancel', [LeaveRequestController::class, 'cancel'])->middleware('permission:edit_leave_requests,approve_leave_requests,manage_leave_requests');
	Route::delete('leave-requests/{leaveRequest}', [LeaveRequestController::class, 'destroy'])->middleware('permission:delete_leave_requests,manage_leave_requests');

	// HR - Salary Structures
	Route::get('salary-structures', [SalaryStructureController::class, 'index'])->middleware('permission:view_salary_structures,manage_salary_structures');
	Route::get('salary-structures/{salaryStructure}', [SalaryStructureController::class, 'show'])->middleware('permission:view_salary_structures,manage_salary_structures');
	Route::post('salary-structures', [SalaryStructureController::class, 'store'])->middleware('permission:add_salary_structures,manage_salary_structures');
	Route::match(['PUT', 'PATCH'], 'salary-structures/{salaryStructure}', [SalaryStructureController::class, 'update'])->middleware('permission:edit_salary_structures,manage_salary_structures');
	Route::delete('salary-structures/{salaryStructure}', [SalaryStructureController::class, 'destroy'])->middleware('permission:delete_salary_structures,manage_salary_structures');

	// HR - Payroll Batches
	Route::get('payroll-batches', [PayrollBatchController::class, 'index'])->middleware('permission:view_payroll_batches,manage_payroll_batches');
	Route::post('payroll-batches/generate', [PayrollBatchController::class, 'generate'])->middleware('permission:add_payroll_batches,manage_payroll_batches,generate_payroll');
	Route::get('payroll-batches/{payrollBatch}', [PayrollBatchController::class, 'show'])->middleware('permission:view_payroll_batches,manage_payroll_batches');
	Route::post('payroll-batches', [PayrollBatchController::class, 'store'])->middleware('permission:add_payroll_batches,manage_payroll_batches,generate_payroll');
	Route::match(['PUT', 'PATCH'], 'payroll-batches/{payrollBatch}', [PayrollBatchController::class, 'update'])->middleware('permission:edit_payroll_batches,manage_payroll_batches,approve_payroll');
	Route::post('payroll-batches/{payrollBatch}/approve', [PayrollBatchController::class, 'approve'])->middleware('permission:approve_payroll,manage_payroll_batches');
	Route::post('payroll-batches/{payrollBatch}/post', [PayrollBatchController::class, 'post'])->middleware('permission:approve_payroll,manage_payroll_batches');
	Route::post('payroll-batches/{payrollBatch}/void', [PayrollBatchController::class, 'void'])->middleware('permission:approve_payroll,manage_payroll_batches');
	Route::delete('payroll-batches/{payrollBatch}', [PayrollBatchController::class, 'destroy'])->middleware('permission:delete_payroll_batches,manage_payroll_batches');

	// HR - Payroll Items
	Route::get('payroll-items', [PayrollItemController::class, 'index'])->middleware('permission:view_payroll_items,manage_payroll_items,view_payroll_batches,manage_payroll_batches');
	Route::get('payroll-items/{payrollItem}', [PayrollItemController::class, 'show'])->middleware('permission:view_payroll_items,manage_payroll_items,view_payroll_batches,manage_payroll_batches');
	Route::get('payroll-items/{payrollItem}/payslip', [PayrollItemController::class, 'payslip'])->middleware('permission:view_payroll_items,manage_payroll_items,print_payslips,manage_payroll_batches');
	Route::post('payroll-items', [PayrollItemController::class, 'store'])->middleware('permission:add_payroll_items,manage_payroll_items,manage_payroll_batches');
	Route::match(['PUT', 'PATCH'], 'payroll-items/{payrollItem}', [PayrollItemController::class, 'update'])->middleware('permission:edit_payroll_items,manage_payroll_items,manage_payroll_batches');
	Route::delete('payroll-items/{payrollItem}', [PayrollItemController::class, 'destroy'])->middleware('permission:delete_payroll_items,manage_payroll_items,manage_payroll_batches');

	// HR - Data Tools
	Route::get('hr-data-tools/modules', [HrDataToolsController::class, 'modules'])->middleware('permission:manage_departments,manage_designations,manage_shifts,manage_employees,manage_employee_attendances,manage_leave_requests,manage_salary_structures,manage_payroll_batches');
	Route::get('hr-data-tools/{module}/export', [HrDataToolsController::class, 'export'])->middleware('permission:manage_departments,manage_designations,manage_shifts,manage_employees,manage_employee_attendances,manage_leave_requests,manage_salary_structures,manage_payroll_batches');
	Route::post('hr-data-tools/{module}/import', [HrDataToolsController::class, 'import'])->middleware('permission:manage_departments,manage_designations,manage_shifts,manage_employees,manage_employee_attendances,manage_leave_requests,manage_salary_structures,manage_payroll_batches');

	// Transactions
	Route::get('transactions', [TransactionController::class, 'index'])->middleware('permission:view_transactions,manage_transactions');
	Route::get('transactions/{transaction}', [TransactionController::class, 'show'])->middleware('permission:view_transactions,manage_transactions');
	Route::post('transactions', [TransactionController::class, 'store'])->middleware('permission:add_transactions,manage_transactions');
	Route::match(['PUT', 'PATCH'], 'transactions/{transaction}', [TransactionController::class, 'update'])->middleware('permission:edit_transactions,manage_transactions');
	Route::delete('transactions/{transaction}', [TransactionController::class, 'destroy'])->middleware('permission:delete_transactions,manage_transactions');

	// Pharmacy Finance — financial control over invoices, purchases and returns.
	// Per-document-type access is enforced inside the controller.
	Route::get('pharmacy-finance', [PharmacyFinanceController::class, 'index'])->middleware('permission:view_finance_sales,view_finance_purchases,view_finance_sales_returns,view_finance_purchase_returns,manage_finance');
	Route::get('pharmacy-finance/summary', [PharmacyFinanceController::class, 'summary'])->middleware('permission:view_finance_sales,view_finance_purchases,view_finance_sales_returns,view_finance_purchase_returns,manage_finance');
	Route::get('pharmacy-finance/export', [PharmacyFinanceController::class, 'export'])->middleware('permission:export_finance,manage_finance');
	Route::post('pharmacy-finance/{transaction}/payment', [PharmacyFinanceController::class, 'recordPayment'])->middleware('permission:record_finance_payments,manage_finance');
	Route::match(['PUT', 'PATCH'], 'pharmacy-finance/{transaction}/status', [PharmacyFinanceController::class, 'updateStatus'])->middleware('permission:edit_finance_payment_status,manage_finance');

	// Ledger & finance summary
	Route::get('ledger', [LedgerController::class, 'index'])->middleware('permission:view_ledger,manage_ledger');
	Route::get('ledger/summary', [LedgerController::class, 'summary'])->middleware('permission:view_ledger,manage_ledger');
	Route::get('ledger/export', [LedgerController::class, 'export'])->middleware('permission:export_ledger,manage_ledger');

	// Stocks (read-only)
	Route::get('stocks', [StockController::class, 'index'])->middleware('permission:view_stocks,manage_stocks');
	Route::get('stocks/{stock}', [StockController::class, 'show'])->middleware('permission:view_stocks,manage_stocks');
	Route::get('stock-reconciliation', [StockReconciliationController::class, 'index'])->middleware('permission:view_stock_reconciliation,view_stocks,manage_stock_reconciliation,manage_stocks');
	Route::post('stock-reconciliation', [StockReconciliationController::class, 'store'])->middleware('permission:add_stock_reconciliation,manage_stock_reconciliation,manage_stocks');

	// Prescriptions
	Route::get('prescriptions', [PrescriptionController::class, 'index'])->middleware('permission_or_doctor:view_prescriptions,manage_prescriptions,create_prescription');
	Route::get('prescriptions/{prescription}', [PrescriptionController::class, 'show'])->middleware('permission_or_doctor:view_prescriptions,manage_prescriptions,create_prescription');
	Route::post('prescriptions', [PrescriptionController::class, 'store'])->middleware('permission:add_prescriptions,manage_prescriptions,create_prescription');
	Route::match(['PUT', 'PATCH'], 'prescriptions/{prescription}', [PrescriptionController::class, 'update'])->middleware('permission:edit_prescriptions,manage_prescriptions');
	Route::delete('prescriptions/{prescription}', [PrescriptionController::class, 'destroy'])->middleware('permission:delete_prescriptions,manage_prescriptions');
	Route::post('prescriptions/{prescription}/dispense', [PrescriptionController::class, 'dispense'])->middleware('permission:dispense_medicines,manage_prescriptions,manage_transactions');
	Route::get('prescriptions/{prescription}/item-groups', [PrescriptionItemGroupController::class, 'show'])->middleware('permission_or_doctor:view_prescriptions,manage_prescriptions,create_prescription');
	Route::put('prescriptions/{prescription}/item-groups', [PrescriptionItemGroupController::class, 'sync'])->middleware('permission_or_doctor:edit_prescriptions,add_prescriptions,manage_prescriptions,create_prescription');

	// Medicine Sets (optional grouped-prescription templates)
	Route::get('medicine-sets', [MedicineSetController::class, 'index'])->middleware('permission_or_doctor:view_treatment_sets,manage_treatment_sets,view_medicines,manage_medicines,create_prescription,manage_prescriptions');
	Route::get('medicine-sets/{medicineSet}', [MedicineSetController::class, 'show'])->middleware('permission_or_doctor:view_treatment_sets,manage_treatment_sets,view_medicines,manage_medicines,create_prescription,manage_prescriptions');
	Route::post('medicine-sets', [MedicineSetController::class, 'store'])->middleware('permission:add_treatment_sets,manage_treatment_sets,add_prescriptions,manage_prescriptions');
	Route::match(['PUT', 'PATCH'], 'medicine-sets/{medicineSet}', [MedicineSetController::class, 'update'])->middleware('permission:edit_treatment_sets,manage_treatment_sets,edit_prescriptions,manage_prescriptions');
	Route::delete('medicine-sets/{medicineSet}', [MedicineSetController::class, 'destroy'])->middleware('permission:delete_treatment_sets,manage_treatment_sets,delete_prescriptions,manage_prescriptions');

	// Prescription Diagnosis Templates
	Route::get('prescription-diagnoses', [PrescriptionDiagnosisController::class, 'index'])->middleware('permission_or_doctor:view_prescription_diagnoses,manage_prescription_diagnoses,view_medicines,manage_medicines,create_prescription,manage_prescriptions');
	Route::get('prescription-diagnoses/{prescriptionDiagnosis}', [PrescriptionDiagnosisController::class, 'show'])->middleware('permission_or_doctor:view_prescription_diagnoses,manage_prescription_diagnoses,view_medicines,manage_medicines,create_prescription,manage_prescriptions');
	Route::post('prescription-diagnoses', [PrescriptionDiagnosisController::class, 'store'])->middleware('permission:add_prescription_diagnoses,manage_prescription_diagnoses,add_prescriptions,manage_prescriptions');
	Route::match(['PUT', 'PATCH'], 'prescription-diagnoses/{prescriptionDiagnosis}', [PrescriptionDiagnosisController::class, 'update'])->middleware('permission:edit_prescription_diagnoses,manage_prescription_diagnoses,edit_prescriptions,manage_prescriptions');
	Route::delete('prescription-diagnoses/{prescriptionDiagnosis}', [PrescriptionDiagnosisController::class, 'destroy'])->middleware('permission:delete_prescription_diagnoses,manage_prescription_diagnoses,delete_prescriptions,manage_prescriptions');

	Route::get('test-templates', [TestTemplateController::class, 'index'])->middleware('permission_or_doctor:view_test_templates,manage_test_templates');
	Route::get('test-templates/{testTemplate}', [TestTemplateController::class, 'show'])->middleware('permission_or_doctor:view_test_templates,manage_test_templates');
	Route::post('test-templates', [TestTemplateController::class, 'store'])->middleware('permission:add_test_templates,manage_test_templates');
	Route::match(['PUT', 'PATCH'], 'test-templates/{testTemplate}', [TestTemplateController::class, 'update'])->middleware('permission:edit_test_templates,manage_test_templates');
	Route::delete('test-templates/{testTemplate}', [TestTemplateController::class, 'destroy'])->middleware('permission:delete_test_templates,manage_test_templates');

	// Lab Orders
	// Split read vs write routes to avoid resource middleware stacking issues.
	Route::get('lab-orders', [LabOrderController::class, 'index'])->middleware('permission_or_doctor:view_lab_orders,manage_lab_orders');
	Route::get('lab-orders/{labOrder}', [LabOrderController::class, 'show'])->middleware('permission_or_doctor:view_lab_orders,manage_lab_orders');
	Route::post('lab-orders', [LabOrderController::class, 'store'])->middleware('permission_or_doctor:add_lab_orders,manage_lab_orders');
	Route::match(['PUT', 'PATCH'], 'lab-orders/{labOrder}', [LabOrderController::class, 'update'])->middleware('permission:edit_lab_orders,manage_lab_orders,update_lab_order_status');
	Route::delete('lab-orders/{labOrder}', [LabOrderController::class, 'destroy'])->middleware('permission:delete_lab_orders,manage_lab_orders');
	Route::post('lab-orders/{labOrder}/payment', [LabOrderController::class, 'processPayment'])->middleware('permission:manage_lab_payments,manage_lab_orders');
	Route::post('lab-orders/{labOrder}/reset-payment', [LabOrderController::class, 'resetPayment'])->middleware('permission:reverse_lab_payment');
	Route::post('lab-orders/{labOrder}/collect-sample', [LabOrderController::class, 'collectSample'])->middleware('permission:manage_lab_orders,update_lab_order_status');
	Route::post('lab-orders/{labOrder}/cancel', [LabOrderController::class, 'cancel'])->middleware('permission:manage_lab_orders,update_lab_order_status');
	Route::post('lab-order-items/{labOrderItem}/results', [LabOrderController::class, 'enterResults'])->middleware('permission:enter_lab_results,manage_lab_orders');
	Route::get('lab-orders/{labOrder}/receipt', [LabOrderController::class, 'getReceipt'])->middleware('permission:print_lab_orders,view_lab_orders,manage_lab_orders');
	Route::get('lab-orders/{labOrder}/report', [LabOrderController::class, 'getReport'])->middleware('permission:export_lab_orders,print_lab_orders,view_lab_orders,manage_lab_orders');

	// Radiology - Ultrasound report templates
	Route::get('ultrasound-types', [UltrasoundTypeController::class, 'index'])->middleware('permission_or_doctor:view_ultrasound_types,manage_ultrasound_types,view_ultrasound_exams,manage_ultrasound_exams');
	Route::get('ultrasound-types/{ultrasoundType}', [UltrasoundTypeController::class, 'show'])->middleware('permission_or_doctor:view_ultrasound_types,manage_ultrasound_types,view_ultrasound_exams,manage_ultrasound_exams');
	Route::post('ultrasound-types', [UltrasoundTypeController::class, 'store'])->middleware('permission:add_ultrasound_types,manage_ultrasound_types');
	Route::match(['PUT', 'PATCH'], 'ultrasound-types/{ultrasoundType}', [UltrasoundTypeController::class, 'update'])->middleware('permission:edit_ultrasound_types,manage_ultrasound_types');
	Route::delete('ultrasound-types/{ultrasoundType}', [UltrasoundTypeController::class, 'destroy'])->middleware('permission:delete_ultrasound_types,manage_ultrasound_types');

	// Radiology - Ultrasound exams
	Route::get('ultrasound-exams', [UltrasoundExamController::class, 'index'])->middleware('permission_or_doctor:view_ultrasound_exams,manage_ultrasound_exams');
	Route::get('ultrasound-exams/{ultrasoundExam}', [UltrasoundExamController::class, 'show'])->middleware('permission_or_doctor:view_ultrasound_exams,manage_ultrasound_exams');
	Route::get('ultrasound-exams/{ultrasoundExam}/report', [UltrasoundExamController::class, 'report'])->middleware('permission_or_doctor:print_ultrasound_exams,export_ultrasound_exams,view_ultrasound_exams,manage_ultrasound_exams');
	Route::post('ultrasound-exams', [UltrasoundExamController::class, 'store'])->middleware('permission_or_doctor:add_ultrasound_receipt,manage_ultrasound_exams');
	Route::match(['PUT', 'PATCH'], 'ultrasound-exams/{ultrasoundExam}', [UltrasoundExamController::class, 'update'])->middleware('permission_or_doctor:submit_ultrasound_result');
	Route::delete('ultrasound-exams/{ultrasoundExam}', [UltrasoundExamController::class, 'destroy'])->middleware('permission:delete_ultrasound_receipt,delete_ultrasound_exams,manage_ultrasound_exams');
	Route::post('ultrasound-exams/{ultrasoundExam}/payment', [UltrasoundExamController::class, 'processPayment'])->middleware('permission:manage_ultrasound_payments,manage_ultrasound_exams');
	Route::post('ultrasound-exams/{ultrasoundExam}/reverse-payment', [UltrasoundExamController::class, 'reversePayment'])->middleware('permission:reverse_ultrasound_payment');
	Route::get('ultrasound-exams/{ultrasoundExam}/receipt', [UltrasoundExamController::class, 'receipt'])->middleware('permission:print_ultrasound_receipt,manage_ultrasound_payments,manage_ultrasound_exams');

	// Radiology - X-Ray receipts (a cash desk only: the film is reported
	// outside ShifaaScript, so there is no exam or template counterpart).
	// Dental: a service catalogue and the receipts raised against it.
	Route::get('dental-services', [DentalServiceController::class, 'index'])->middleware('permission:view_dental_services,manage_dental_services,view_dental_receipts,manage_dental_receipts');
	Route::get('dental-services/{dentalService}', [DentalServiceController::class, 'show'])->middleware('permission:view_dental_services,manage_dental_services,view_dental_receipts,manage_dental_receipts');
	Route::post('dental-services', [DentalServiceController::class, 'store'])->middleware('permission:add_dental_services,manage_dental_services');
	Route::match(['PUT', 'PATCH'], 'dental-services/{dentalService}', [DentalServiceController::class, 'update'])->middleware('permission:edit_dental_services,manage_dental_services');
	Route::delete('dental-services/{dentalService}', [DentalServiceController::class, 'destroy'])->middleware('permission:delete_dental_services,manage_dental_services');

	Route::get('dental-receipts', [DentalReceiptController::class, 'index'])->middleware('permission:view_dental_receipts,manage_dental_receipts');
	Route::get('dental-receipts/{dentalReceipt}', [DentalReceiptController::class, 'show'])->middleware('permission:view_dental_receipts,manage_dental_receipts');
	Route::post('dental-receipts', [DentalReceiptController::class, 'store'])->middleware('permission:add_dental_receipts,manage_dental_receipts');
	Route::match(['PUT', 'PATCH'], 'dental-receipts/{dentalReceipt}', [DentalReceiptController::class, 'update'])->middleware('permission:edit_dental_receipts,manage_dental_receipts');
	Route::delete('dental-receipts/{dentalReceipt}', [DentalReceiptController::class, 'destroy'])->middleware('permission:delete_dental_receipts,manage_dental_receipts');
	Route::post('dental-receipts/{dentalReceipt}/payment', [DentalReceiptController::class, 'processPayment'])->middleware('permission:manage_dental_payments,manage_dental_receipts');
	Route::post('dental-receipts/{dentalReceipt}/reverse-payment', [DentalReceiptController::class, 'reversePayment'])->middleware('permission:reverse_dental_payment');
	Route::get('dental-receipts/{dentalReceipt}/receipt', [DentalReceiptController::class, 'receipt'])->middleware('permission:print_dental_receipt,manage_dental_payments,manage_dental_receipts');

	Route::get('xray-types', [XrayTypeController::class, 'index'])->middleware('permission:view_xray_types,manage_xray_types,view_xray_receipts,manage_xray_receipts');
	Route::get('xray-types/{xrayType}', [XrayTypeController::class, 'show'])->middleware('permission:view_xray_types,manage_xray_types,view_xray_receipts,manage_xray_receipts');
	Route::post('xray-types', [XrayTypeController::class, 'store'])->middleware('permission:add_xray_types,manage_xray_types');
	Route::match(['PUT', 'PATCH'], 'xray-types/{xrayType}', [XrayTypeController::class, 'update'])->middleware('permission:edit_xray_types,manage_xray_types');
	Route::delete('xray-types/{xrayType}', [XrayTypeController::class, 'destroy'])->middleware('permission:delete_xray_types,manage_xray_types');

	Route::get('xray-receipts', [XrayReceiptController::class, 'index'])->middleware('permission:view_xray_receipts,manage_xray_receipts');
	Route::get('xray-receipts/{xrayReceipt}', [XrayReceiptController::class, 'show'])->middleware('permission:view_xray_receipts,manage_xray_receipts');
	Route::post('xray-receipts', [XrayReceiptController::class, 'store'])->middleware('permission:add_xray_receipts,manage_xray_receipts');
	Route::match(['PUT', 'PATCH'], 'xray-receipts/{xrayReceipt}', [XrayReceiptController::class, 'update'])->middleware('permission:edit_xray_receipts,manage_xray_receipts');
	Route::delete('xray-receipts/{xrayReceipt}', [XrayReceiptController::class, 'destroy'])->middleware('permission:delete_xray_receipts,manage_xray_receipts');
	Route::post('xray-receipts/{xrayReceipt}/payment', [XrayReceiptController::class, 'processPayment'])->middleware('permission:manage_xray_payments,manage_xray_receipts');
	// Reversal stands alone: collecting must not imply being able to undo.
	Route::post('xray-receipts/{xrayReceipt}/reverse-payment', [XrayReceiptController::class, 'reversePayment'])->middleware('permission:reverse_xray_payment');
	Route::get('xray-receipts/{xrayReceipt}/receipt', [XrayReceiptController::class, 'receipt'])->middleware('permission:print_xray_receipt,manage_xray_payments,manage_xray_receipts');

	// Audit Log (read-only; entries are written by the application itself)
	Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware('permission:view_audit_logs,manage_audit_logs');
	Route::get('audit-logs/filters', [AuditLogController::class, 'filters'])->middleware('permission:view_audit_logs,manage_audit_logs');
	Route::get('audit-logs/export', [AuditLogController::class, 'export'])->middleware('permission:export_audit_logs,view_audit_logs,manage_audit_logs');
	Route::get('audit-logs/{auditLog}', [AuditLogController::class, 'show'])->middleware('permission:view_audit_logs,manage_audit_logs');
	// Any authenticated user may report their own print/export activity.
	Route::post('audit-logs/events', [AuditLogController::class, 'storeClientEvent']);

	// Operational screens need read-only hospital preferences (customer mode,
	// print layout, barcode behaviour, etc.). The controller scopes this to the
	// user's own hospital; write access remains separately permission-protected.
	Route::get('hospital-settings/{hospital}', [HospitalSettingController::class, 'show']);
	Route::put('hospital-settings/{hospital}', [HospitalSettingController::class, 'update'])->middleware('permission:edit_hospital_settings,manage_hospital_settings');
	Route::post('hospital-settings/{hospital}/watermark', [HospitalSettingController::class, 'uploadWatermark'])->middleware('permission:edit_hospital_settings,manage_hospital_settings');

	Route::get('users', [UserController::class, 'index'])->middleware('permission:view_users,manage_users');
	Route::get('users/{user}', [UserController::class, 'show'])->middleware('permission:view_users,manage_users');
	Route::post('users', [UserController::class, 'store'])->middleware('permission:add_users,manage_users');
	Route::match(['PUT', 'PATCH'], 'users/{user}', [UserController::class, 'update'])->middleware('permission:edit_users,manage_users');
	Route::delete('users/{user}', [UserController::class, 'destroy'])->middleware('permission:delete_users,manage_users');

	Route::get('roles', [RoleController::class, 'index'])->middleware('permission:view_roles,manage_roles');
	Route::get('roles/{role}', [RoleController::class, 'show'])->middleware('permission:view_roles,manage_roles');
	Route::post('roles', [RoleController::class, 'store'])->middleware('permission:add_roles,manage_roles');
	Route::match(['PUT', 'PATCH'], 'roles/{role}', [RoleController::class, 'update'])->middleware('permission:edit_roles,manage_roles');
	Route::delete('roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:delete_roles,manage_roles');

	Route::get('permissions', [PermissionController::class, 'index'])->middleware('permission:view_permissions,manage_permissions');
	Route::get('permissions/template-download', [PermissionController::class, 'downloadTemplate'])->middleware('permission:view_permissions,import_permissions,manage_permissions');
	Route::post('permissions/import', [PermissionController::class, 'import'])->middleware('permission:import_permissions,manage_permissions');
	Route::get('permissions/{permission}', [PermissionController::class, 'show'])->middleware('permission:view_permissions,manage_permissions');
	Route::post('permissions', [PermissionController::class, 'store'])->middleware('permission:add_permissions,manage_permissions');
	Route::match(['PUT', 'PATCH'], 'permissions/{permission}', [PermissionController::class, 'update'])->middleware('permission:edit_permissions,manage_permissions');
	Route::delete('permissions/{permission}', [PermissionController::class, 'destroy'])->middleware('permission:delete_permissions,manage_permissions');

	Route::get('contact-messages', [ContactMessageController::class, 'index'])->middleware('permission:view_contact_messages,manage_contact_messages');
	Route::get('contact-messages/{contactMessage}', [ContactMessageController::class, 'show'])->middleware('permission:view_contact_messages,manage_contact_messages');
	Route::match(['PUT', 'PATCH'], 'contact-messages/{contactMessage}', [ContactMessageController::class, 'update'])->middleware('permission:edit_contact_messages,manage_contact_messages');
	Route::delete('contact-messages/{contactMessage}', [ContactMessageController::class, 'destroy'])->middleware('permission:delete_contact_messages,manage_contact_messages');

	// Database Backups
	Route::get('backups', [DatabaseBackupController::class, 'index'])->middleware('permission:view_backups,manage_backups,manage_hospital_settings');
	Route::get('backups/settings', [DatabaseBackupController::class, 'settings'])->middleware('permission:view_backups,manage_backups,manage_hospital_settings');
	Route::put('backups/settings', [DatabaseBackupController::class, 'updateSettings'])->middleware('permission:edit_backups,manage_backups,manage_hospital_settings');
	Route::post('backups', [DatabaseBackupController::class, 'store'])->middleware('permission:add_backups,manage_backups,manage_hospital_settings');
	Route::get('backups/{filename}/download', [DatabaseBackupController::class, 'download'])->middleware('permission:export_backups,view_backups,manage_backups,manage_hospital_settings');
	Route::delete('backups/{filename}', [DatabaseBackupController::class, 'destroy'])->middleware('permission:delete_backups,manage_backups,manage_hospital_settings');
});
