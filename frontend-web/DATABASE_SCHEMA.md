# ShifaaScript - Database Schema (Laravel 12 / MySQL)

This document contains the complete database schema for the ShifaaScript Multi-vendor Hospital System.

## Migration Order
Please create migrations in this specific order to avoid Foreign Key constraint errors.

### 1. Hospitals (Tenants)
**File:** `create_hospitals_table.php`
```php
Schema::create('hospitals', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('slug')->unique(); // for subdomain: hospital.shifaascript.com
    $table->string('email')->nullable();
    $table->string('phone')->nullable();
    $table->text('address')->nullable();
    $table->string('logo_path')->nullable();
    $table->json('settings')->nullable(); // Currency, timezone, print headers
    $table->enum('subscription_status', ['active', 'inactive', 'past_due'])->default('active');
    $table->timestamps();
    $table->softDeletes();
});
```

### 2. Users (Authentication)
**File:** `create_users_table.php`
```php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    // Nullable for Super Admins
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
    $table->index(['hospital_id', 'role']);
});
```

### 3. Doctor Profiles
**File:** `create_doctor_profiles_table.php`
```php
Schema::create('doctor_profiles', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
    $table->string('specialization');
    $table->string('qualification')->nullable();
    $table->string('license_number')->nullable();
    $table->decimal('consultation_fee', 10, 2)->default(0);
    $table->json('availability_schedule')->nullable();
    $table->string('signature_path')->nullable();
    $table->timestamps();
});
```

### 4. Patients
**File:** `create_patients_table.php`
```php
Schema::create('patients', function (Blueprint $table) {
    $table->id();
    $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
    $table->string('mrn')->nullable();
    $table->string('name');
    $table->string('phone')->nullable();
    $table->string('email')->nullable();
    $table->string('cnic')->nullable();
    $table->date('dob')->nullable();
    $table->string('age_at_registration')->nullable();
    $table->enum('gender', ['male', 'female', 'other']);
    $table->string('blood_group')->nullable();
    $table->text('address')->nullable();
    $table->json('medical_history')->nullable();
    $table->json('allergies')->nullable();
    $table->timestamps();
    $table->softDeletes();
    $table->unique(['hospital_id', 'mrn']);
});
```

### 5. Appointments
**File:** `create_appointments_table.php`
```php
Schema::create('appointments', function (Blueprint $table) {
    $table->id();
    $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
    $table->foreignId('doctor_id')->constrained('users')->onDelete('cascade');
    $table->foreignId('patient_id')->constrained()->onDelete('cascade');
    $table->date('appointment_date');
    $table->time('time_slot');
    $table->integer('queue_number')->nullable();
    $table->enum('type', ['consultation', 'follow_up', 'emergency'])->default('consultation');
    $table->enum('status', ['scheduled', 'checked_in', 'completed', 'cancelled', 'no_show'])->default('scheduled');
    $table->enum('payment_status', ['unpaid', 'paid'])->default('unpaid');
    $table->text('symptoms')->nullable();
    $table->timestamps();
});
```

### 6. Pharmacy (Inventory)
**File:** `create_pharmacy_tables.php`
```php
// Manufacturers
Schema::create('medicine_manufacturers', function (Blueprint $table) {
    $table->id();
    $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
    $table->string('name');
    $table->string('contact_info')->nullable();
    $table->timestamps();
});

// Medicine Types
Schema::create('medicine_types', function (Blueprint $table) {
    $table->id();
    $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
    $table->string('name');
    $table->timestamps();
});

// Medicines
Schema::create('medicines', function (Blueprint $table) {
    $table->id();
    $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
    $table->foreignId('medicine_type_id')->constrained()->onDelete('cascade');
    $table->foreignId('manufacturer_id')->nullable()->constrained('medicine_manufacturers')->nullOnDelete();
    $table->string('name');
    $table->string('generic_name')->nullable();
    $table->string('sku')->nullable();
    $table->string('strength')->nullable();
    $table->decimal('price', 10, 2);
    $table->integer('stock_quantity')->default(0);
    $table->integer('alert_level')->default(10);
    $table->timestamps();
    $table->softDeletes();
});
```

### 7. Lab Test Templates
**File:** `create_lab_test_templates_table.php`
```php
Schema::create('lab_test_templates', function (Blueprint $table) {
    $table->id();
    $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
    $table->string('test_name');
    $table->string('test_code')->nullable();
    $table->string('category')->nullable();
    $table->decimal('price', 10, 2);
    $table->json('parameters')->nullable(); 
    $table->timestamps();
});
```

### 8. Prescriptions (Walk-in & Appointments)
**File:** `create_prescriptions_table.php`
```php
Schema::create('prescriptions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
    $table->string('prescription_number');
    $table->foreignId('doctor_id')->constrained('users')->onDelete('cascade');
    $table->foreignId('patient_id')->constrained()->onDelete('cascade');
    
    // NULL for Walk-ins, Value for Scheduled
    $table->foreignId('appointment_id')->nullable()->constrained()->nullOnDelete();
    $table->enum('visit_type', ['appointment', 'walk_in', 'emergency'])->default('appointment');
    
    $table->json('vitals')->nullable();
    $table->text('diagnosis')->nullable();
    $table->text('notes')->nullable();
    $table->date('next_visit_date')->nullable();
    $table->enum('status', ['draft', 'finalized'])->default('draft');
    $table->timestamps();
    $table->softDeletes();
    $table->index(['hospital_id', 'patient_id']);
});
```

### 9. Prescription Items
**File:** `create_prescription_items_table.php`
```php
Schema::create('prescription_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('prescription_id')->constrained()->onDelete('cascade');
    $table->foreignId('medicine_id')->constrained()->onDelete('cascade');
    $table->string('dosage');
    $table->string('duration');
    $table->string('instruction')->nullable();
    $table->integer('quantity')->default(0);
    $table->timestamps();
});
```

### 10. Lab Module (Orders & Results)
**File:** `create_lab_module_tables.php`
```php
// Lab Orders
Schema::create('lab_orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
    $table->string('order_number');
    $table->foreignId('patient_id')->constrained()->onDelete('cascade');
    $table->foreignId('doctor_id')->constrained('users')->onDelete('cascade');
    $table->foreignId('prescription_id')->nullable()->constrained()->nullOnDelete();
    $table->decimal('total_amount', 10, 2)->default(0);
    $table->enum('payment_status', ['unpaid', 'paid', 'refunded'])->default('unpaid');
    $table->enum('status', ['pending', 'in_progress', 'completed', 'cancelled'])->default('pending');
    $table->timestamps();
});

// Lab Results
Schema::create('lab_results', function (Blueprint $table) {
    $table->id();
    $table->foreignId('lab_order_id')->constrained()->onDelete('cascade');
    $table->foreignId('lab_test_template_id')->constrained()->onDelete('cascade');
    $table->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
    $table->json('result_data')->nullable();
    $table->text('remarks')->nullable();
    $table->enum('status', ['pending', 'completed']).default('pending');
    $table->timestamp('sample_collected_at')->nullable();
    $table->timestamp('reported_at')->nullable();
    $table->timestamps();
});
```
