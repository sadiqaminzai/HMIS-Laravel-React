Here is the complete Laravel 12 Database Schema.
I have organized these into the correct order of execution (Parents first, then Children) to prevent Foreign Key errors. You can copy these distinct blocks into your migration files.
1. create_hospitals_table.php (The Tenant)
This must be created first as almost all other tables depend on it.
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hospitals', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique(); // for subdomain: hospital.shifaascript.com
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();
            $table->string('logo_path')->nullable();
            
            // Store currency, timezone, print header layout here
            $table->json('settings')->nullable(); 
            
            $table->enum('subscription_status', ['active', 'inactive', 'past_due'])->default('active');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hospitals');
    }
};
2. create_users_table.php (Authentication)
Updated standard Laravel users table to include Roles and Hospital ID.
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            // Nullable for Super Admins who manage the whole system
            $table->foreignId('hospital_id')->nullable()->constrained()->onDelete('cascade');
            
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            
            $table->enum('role', ['super_admin', 'admin', 'doctor', 'receptionist', 'pharmacist', 'lab_technician']);
            $table->string('avatar_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            // Index for faster tenant scoping
            $table->index(['hospital_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
3. create_doctor_profiles_table.php
Extra details specifically for doctors.
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctor_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            
            $table->string('specialization'); // e.g., Cardiologist
            $table->string('qualification')->nullable(); // e.g., MBBS, FCPS
            $table->string('license_number')->nullable();
            $table->decimal('consultation_fee', 10, 2)->default(0);
            
            // JSON to store: { "mon": ["09:00-12:00", "14:00-17:00"], "tue": ... }
            $table->json('availability_schedule')->nullable();
            
            $table->string('signature_path')->nullable(); // For prescription printing
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_profiles');
    }
};
4. create_patients_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            
            $table->string('mrn')->nullable(); // Medical Record Number
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable(); // Nullable for walk-ins/elderly
            $table->string('cnic')->nullable(); // National ID
            
            $table->date('dob')->nullable();
            $table->string('age_at_registration')->nullable(); // Fallback if DOB unknown
            $table->enum('gender', ['male', 'female', 'other']);
            $table->string('blood_group')->nullable();
            $table->text('address')->nullable();
            
            // JSON for dynamic history without extra tables
            $table->json('medical_history')->nullable(); // e.g. ["Diabetes", "Hypertension"]
            $table->json('allergies')->nullable(); 
            
            $table->timestamps();
            $table->softDeletes();
            
            // Ensure unique MRN per hospital
            $table->unique(['hospital_id', 'mrn']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
5. create_appointments_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            $table->foreignId('doctor_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('patient_id')->constrained()->onDelete('cascade');
            
            $table->date('appointment_date');
            $table->time('time_slot');
            $table->integer('queue_number')->nullable(); // Token number for the day
            
            $table->enum('type', ['consultation', 'follow_up', 'emergency'])->default('consultation');
            $table->enum('status', ['scheduled', 'checked_in', 'completed', 'cancelled', 'no_show'])->default('scheduled');
            $table->enum('payment_status', ['unpaid', 'paid'])->default('unpaid');
            
            $table->text('symptoms')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
6. create_pharmacy_tables.php
(Grouped Manufacturers, Types, and Medicines for brevity, but you can split them).
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Manufacturers
        Schema::create('medicine_manufacturers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('contact_info')->nullable();
            $table->timestamps();
        });

        // 2. Types (Tablet, Syrup, etc)
        Schema::create('medicine_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->timestamps();
        });

        // 3. Medicines (Inventory)
        Schema::create('medicines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            $table->foreignId('medicine_type_id')->constrained()->onDelete('cascade');
            $table->foreignId('manufacturer_id')->nullable()->constrained('medicine_manufacturers')->nullOnDelete();
            
            $table->string('name'); // Brand Name
            $table->string('generic_name')->nullable(); // Formula
            $table->string('sku')->nullable();
            $table->string('strength')->nullable(); // 500mg, 10ml
            
            $table->decimal('price', 10, 2);
            $table->integer('stock_quantity')->default(0);
            $table->integer('alert_level')->default(10); // Low stock warning
            
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicines');
        Schema::dropIfExists('medicine_types');
        Schema::dropIfExists('medicine_manufacturers');
    }
};
7. create_lab_test_templates_table.php (The Catalog)
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lab_test_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            
            $table->string('test_name');
            $table->string('test_code')->nullable();
            $table->string('category')->nullable(); // Hematology, Pathology
            $table->decimal('price', 10, 2);
            
            // JSON to define what inputs are needed for results
            // e.g. [{ "param": "Hemoglobin", "unit": "g/dL", "ref_range": "13-17" }]
            $table->json('parameters')->nullable(); 
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_test_templates');
    }
};
8. create_prescriptions_table.php (The Core)
This handles both Appointments and Walk-ins.
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prescriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            
            // The Prescription ID (e.g., RX-1001)
            $table->string('prescription_number'); 
            
            $table->foreignId('doctor_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('patient_id')->constrained()->onDelete('cascade');
            
            // KEY: Nullable Appointment ID for Walk-ins
            $table->foreignId('appointment_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('visit_type', ['appointment', 'walk_in', 'emergency'])->default('appointment');
            
            // Clinical Data
            // Stores: { "bp": "120/80", "weight": "70kg", "temp": "98F", "pulse": "72" }
            $table->json('vitals')->nullable();
            
            $table->text('diagnosis')->nullable();
            $table->text('notes')->nullable(); // Patient instructions
            
            $table->date('next_visit_date')->nullable();
            $table->enum('status', ['draft', 'finalized'])->default('draft');
            
            $table->timestamps();
            $table->softDeletes();
            
            // Index for efficient history lookup
            $table->index(['hospital_id', 'patient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prescriptions');
    }
};
9. create_prescription_items_table.php (Medicines in RX)
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prescription_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prescription_id')->constrained()->onDelete('cascade');
            $table->foreignId('medicine_id')->constrained()->onDelete('cascade');
            
            $table->string('dosage'); // e.g. "1-0-1"
            $table->string('duration'); // e.g. "5 Days"
            $table->string('instruction')->nullable(); // e.g. "After Meal"
            $table->integer('quantity')->default(0); // Total pills/units
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prescription_items');
    }
};
10. create_lab_module_tables.php (Orders & Results)
This connects Prescriptions, Patients, and the Lab Department.
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Lab Orders (The Invoice/Group of tests)
        Schema::create('lab_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            $table->string('order_number'); // e.g., LAB-2026-001
            
            $table->foreignId('patient_id')->constrained()->onDelete('cascade');
            $table->foreignId('doctor_id')->constrained('users')->onDelete('cascade');
            
            // Optional: Link to prescription if ordered there
            $table->foreignId('prescription_id')->nullable()->constrained()->nullOnDelete();
            
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->enum('payment_status', ['unpaid', 'paid', 'refunded'])->default('unpaid');
            $table->enum('status', ['pending', 'in_progress', 'completed', 'cancelled'])->default('pending');
            
            $table->timestamps();
        });

        // 2. Lab Results (The actual test details)
        Schema::create('lab_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lab_order_id')->constrained()->onDelete('cascade');
            $table->foreignId('lab_test_template_id')->constrained()->onDelete('cascade'); // Which test is this?
            
            // Which technician performed it?
            $table->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
            
            // JSON stores the result values based on the template parameters
            // e.g. { "Hemoglobin": "14.5", "WBC": "8.0" }
            $table->json('result_data')->nullable();
            
            $table->text('remarks')->nullable();
            $table->enum('status', ['pending', 'completed']).default('pending');
            
            $table->timestamp('sample_collected_at')->nullable();
            $table->timestamp('reported_at')->nullable();
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_results');
        Schema::dropIfExists('lab_orders');
    }
};


 

