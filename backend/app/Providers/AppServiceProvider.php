<?php

namespace App\Providers;

use App\Observers\AuditObserver;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Models tracked by the audit trail, mapped to the module label shown in
     * the Audit Log UI. Add a model here to start auditing it.
     *
     * @var array<class-string, string>
     */
    private const AUDITED_MODELS = [
        \App\Models\Appointment::class => 'Appointments',
        \App\Models\Doctor::class => 'Doctors',
        \App\Models\Expense::class => 'Expenses',
        \App\Models\ExpenseCategory::class => 'Expense Categories',
        \App\Models\Hospital::class => 'Hospitals',
        \App\Models\LabOrder::class => 'Lab Orders',
        \App\Models\Medicine::class => 'Medicines',
        \App\Models\MedicineSet::class => 'Treatment Sets',
        \App\Models\OtherIncome::class => 'Other Incomes',
        \App\Models\OtherIncomeCategory::class => 'Other Income Categories',
        \App\Models\Patient::class => 'Patients',
        \App\Models\PatientSurgery::class => 'Patient Surgeries',
        \App\Models\Permission::class => 'Permissions',
        \App\Models\Prescription::class => 'Prescriptions',
        \App\Models\Role::class => 'Roles',
        \App\Models\Room::class => 'Rooms',
        \App\Models\RoomBooking::class => 'Room Bookings',
        \App\Models\Stock::class => 'Stocks',
        \App\Models\Supplier::class => 'Suppliers',
        \App\Models\Transaction::class => 'Transactions',
        \App\Models\UltrasoundExam::class => 'Ultrasound',
        \App\Models\UltrasoundType::class => 'Ultrasound Types',
        \App\Models\User::class => 'Users',
    ];

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->registerAuditObservers();

        Gate::before(function ($user, $ability) {
            if ($user && $user->role === 'super_admin') {
                return true;
            }

            return null;
        });
    }

    /**
     * Attach the shared audit observer to every tracked model.
     */
    private function registerAuditObservers(): void
    {
        AuditObserver::setModules(self::AUDITED_MODELS);

        foreach (array_keys(self::AUDITED_MODELS) as $model) {
            if (class_exists($model)) {
                $model::observe(AuditObserver::class);
            }
        }
    }
}
