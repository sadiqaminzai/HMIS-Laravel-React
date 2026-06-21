<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\RolePermissionController;

use App\Http\Controllers\Routes\GeneralController;
use App\Http\Controllers\Routes\PharmacyController;
use App\Http\Controllers\Routes\ReceptionController;
use App\Http\Controllers\Routes\LaboratoryController;
use App\Livewire\Reception\FeeReceiptReport;
use App\Livewire\Reception\SaleInvoiceReceiptReport;
use App\Livewire\Reception\ServiceReceiptReport;
use App\Livewire\Reception\ReturnInvoiceReceiptReport;
use App\Livewire\Pharmacy\PurchaseReport;
use App\Livewire\Pharmacy\StockExpiryReport;
use App\Livewire\Pharmacy\StockQuantityReport;
use App\Livewire\Reports\UnifiedReport;
/// AdminDashboard

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';


// Admin Login Route
Route::get('/', [AdminController::class, 'AdminLogin'])->name('admin.login');

/**
 * General
 */
Route::middleware(['auth'])->prefix('general')->group(function () {
    // user management routes
    Route::get('/user-management', [GeneralController::class, 'user_management'])->name('general.user-management');
    //Department routes
    Route::get('/department', [GeneralController::class, 'department'])->name('general.department');
    //Designation routes
    Route::get('/designation', [GeneralController::class, 'designation'])->name('general.designation');
    //employee routes
    Route::get('/employee',[GeneralController::class, 'employee'])->name('general.employee');
    //employee document routes
    Route::get('/employee/document', [GeneralController::class, 'employee_document'])->name('general.employee.document');
    //employee schedule routes
    Route::get('/employee/schedule', [GeneralController::class, 'employee_schedule'])->name('general.employee.schedule');
    //discount type routes
    Route::get('/discount/type', [GeneralController::class, 'discount_type'])->name('general.discount-type');
    //discount route
    Route::get('/discount', [GeneralController::class, 'discount'])->name('general.discount');
    //Service Type routes
    Route::get('/service/type', [GeneralController::class, 'service_type'])->name('general.service-type');
    //Service routes
    Route::get('/services', [GeneralController::class, 'service'])->name('general.service');
    //Fees routes
    Route::get('/fees', [GeneralController::class, 'fee'])->name('general.fee');
});

/**
 * Reception
 */
Route::middleware(['auth'])->prefix('reception')->group(function () {
    //Patient routes
    Route::get('/patient',[ReceptionController::class, 'patient'])->name('reception.patient');
    //Fee receipt routes
    Route::get('/fee/receipt', [ReceptionController::class, 'fee_receipt'])->name('reception.fee-receipt');
    //service receipt routes
    Route::get('/service/receipt', [ReceptionController::class, 'service_receipt'])->name('reception.service-receipt');
    //invoice receipt routes
    Route::get('/invoice/receipt', [ReceptionController::class, 'invoice_receipt'])->name('reception.invoice-receipt');
    //return invoice receipt routes
    Route::get('/return/invoice/receipt', [ReceptionController::class, 'return_invoice_receipt'])->name('reception.return-invoice-receipt');


    /*
    RECEIPTION REPORTS
    */
    
    //Patient Report
    Route::get('/p-report',[ReceptionController::class, 'patient_report'])->name('reception.patient-report');
    //PDF Report
    Route::get('/p-report-pdf', [ReceptionController::class, 'patient_report_pdf'])->name('reception.patient-report-pdf');
    //Print Patient Report
    Route::get('/p-report-print', [ReceptionController::class, 'patient_report_print'])->name('livewire.reception.patient_reports.print');

    //Print Fee Receipt Report
    Route::get('/f-report', [ReceptionController::class, 'fee_receipt_report'])->name('reception.fee-receipt-report');
    //Fee receipt Print
    Route::get('/f-report-print', [FeeReceiptReport::class, 'print'])->name('livewire.reception.fee_receipt_reports.print'); 
    
    //service receipt routes
    Route::get('/s-report', [ReceptionController::class, 'service_receipt_report'])->name('reception.service-receipt-report');
    //Service receipt Print
    Route::get('/s-report-print', [ServiceReceiptReport::class, 'print'])->name('livewire.reception.service_receipt_reports.print'); 
    
    //invoice receipt routes
    Route::get('/si-report', [ReceptionController::class, 'sale_invoice_receipt_report'])->name('reception.sale-invoice-receipt-report');
    Route::get('/purchase', [ReceptionController::class, 'purchasereport_rpo'])->name('purchasereports');
    //Sale Invoice receipt Print
    Route::get('/sale-invoice-report-print', [SaleInvoiceReceiptReport::class, 'print'])->name('livewire.reception.sale_invoice_reports.print');
    //return invoice receipt routes
    Route::get('/sr-report', [ReceptionController::class, 'return_invoice_receipt_report'])->name('reception.return-invoice-receipt-report');
    //Return Invoice receipt Print
    Route::get('/return-invoice-report-print', [ReturnInvoiceReceiptReport::class, 'print'])->name('livewire.reception.return_invoice_reports.print');

    //Surgery Management routes
    Route::get('/surgery-management', [ReceptionController::class, 'surgery_management'])->name('reception.surgery-management');
    // Surgery Management print route
    Route::get('/reception/surgery-print', [ReceptionController::class, 'surgery_print'])->name('reception.surgery-print');

    //Room Management routes
    Route::get('/room-management', [ReceptionController::class, 'room_management'])->name('reception.room-management');
    // Room Management print route
    Route::get('/room-print', [ReceptionController::class, 'room_print'])->name('reception.room-print');
    
    //Room Booking Management routes
    Route::get('/room-booking-management', [ReceptionController::class, 'room_booking_management'])->name('reception.room-booking-management');
    // Room Booking Management print route
    Route::get('/room-booking-print', [ReceptionController::class, 'room_booking_print'])->name('reception.room-booking-print');

});

/**
 * Pharmacy
 */
Route::middleware(['auth'])->prefix('pharmacy')->group(function () {
    //GENERAL
    //Company routes
    Route::get('/company', [PharmacyController::class, 'company'])->name('pharmacy.company');

    //Supplier routes
    Route::get('/supplier',  [PharmacyController::class, 'supplier'])->name('pharmacy.supplier');
    //Packing routes
    Route::get('/packing', [PharmacyController::class, 'packing'])->name('pharmacy.packing');
    //Product routes
    Route::get('/product', [PharmacyController::class, 'product'])->name('pharmacy.product');

    //Invventory
    //Stock routes
    Route::get('/stock', [PharmacyController::class, 'stock'])->name('pharmacy.stock');
    //Purchase routes
    Route::get('/purchase', [PharmacyController::class, 'purchase'])->name('pharmacy.purchase');
    
    // Purchase Report
    Route::get('/purchase-report', [PharmacyController::class, 'purchase_report'])->name('pharmacy.purchase-report');
    // Purchase Report Print
    Route::get('/purchase-report-print', [PurchaseReport::class, 'print'])->name('livewire.pharmacy.purchase_reports.print');
    
    // Stock Expiry Report
    Route::get('/stock-expiry-report', [PharmacyController::class, 'stock_expiry_report'])->name('pharmacy.stock-expiry-report');
    // Stock Expiry Report Print
    Route::get('/stock-expiry-report-print', [PharmacyController::class, 'stock_expiry_report_print'])->name('livewire.pharmacy.stock_expiry_report.print');
    
    // Stock Quantity Report
    Route::get('/stock-quantity-report', [PharmacyController::class, 'stock_quantity_report'])->name('pharmacy.stock-quantity-report');
    // Stock Quantity Report Print
    Route::get('/stock-quantity-report-print', [StockQuantityReport::class, 'print'])->name('livewire.pharmacy.stock-quantity-report-print');

    //Billings
    //invoice routes
    Route::get('/sale/invoice', [PharmacyController::class, 'sale_invoice'])->name('pharmacy.sale-invoice');
    //return invoice routes
    Route::get('/return/invoice', [PharmacyController::class, 'return_invoice'])->name('pharmacy.return-invoice');

});

/**
 * Laboratory (LAB)
 */
Route::middleware(['auth'])->prefix('laboratory')->group(function () {

    //Test Type routes
    Route::get('/test/type', [LaboratoryController::class, 'test_type'])->name('laboratory.test-type');
    //Test Details routes
    Route::get('/test/detail', [LaboratoryController::class, 'test_detail'])->name('laboratory.test-detail');
    //Test Result routes
    Route::get('/test/result', [LaboratoryController::class, 'test_result'])->name('laboratory.test-result');
    
    // Test Result Report
    Route::get('/test-result-report', [LaboratoryController::class, 'test_result_report'])->name('laboratory.test-result-report');
    // Test Result Report Print
    Route::get('/test-result-report-print', [App\Livewire\Laboratory\TestResultReport::class, 'print'])->name('livewire.laboratory.test_result_reports.print');
    
    // Test Type Report
    Route::get('/test-type-report', [LaboratoryController::class, 'test_type_report'])->name('laboratory.test-type-report');
    // Test Type Report Print
    Route::get('/test-type-report-print', [LaboratoryController::class, 'test_type_report_print'])->name('livewire.laboratory.test_type_reports.print');

});

Route::middleware(['auth'])->prefix('permissions')->group(function () {
    //GENERAL
    //Company routes
    Route::get('/permisions/view', [RolePermissionController::class, 'allpermisions'])->name('all.Permisions.view');
    Route::get('/Roles/view', [RolePermissionController::class, 'allroles'])->name('all.Roles.view');
    Route::get('/perimission/Roles/create', [RolePermissionController::class, 'assignperimission'])->name('assignpermission.view');

});

// admin related routes
Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/admin/dashboard', [AdminController::class, 'AdminDashboard'])->name('admin.dashboard');
    Route::post('/admin/dashboard/search', [AdminController::class, 'searchDashboard'])->name('admin.dashboard.search');

    Route::get('/admin/profile', [AdminController::class, 'AdminProfile'])->name('admin.profile');

    Route::post('/admin/profile/store', [AdminController::class, 'AdminProfileStore'])->name('admin.profile.store');

    Route::get('/admin/change/password', [AdminController::class, 'AdminChangePassword'])->name('admin.change.password');

    Route::post('/admin/update/password', [AdminController::class, 'AdminUpdatePassword'])->name('admin.update.password');

    Route::get('/admin/logout', [AdminController::class, 'AdminLogout'])->name('admin.logout');

}); // end admin middleware routes

// Unified Report Route
Route::middleware(['auth'])->group(function () {
    Route::get('/reports/unified', [ReceptionController::class, 'unified_report'])->name('reports.unified');
    Route::get('/reports/unified-print', [UnifiedReport::class, 'print'])->name('reports.unified.print');
});


