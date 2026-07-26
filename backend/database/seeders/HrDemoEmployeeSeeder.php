<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\Hospital;
use App\Models\Shift;
use Illuminate\Database\Seeder;

class HrDemoEmployeeSeeder extends Seeder
{
    public function run(): void
    {
        $hospital = Hospital::query()->where('slug', 'demo-hospital')->first();

        if (!$hospital) {
            $this->command?->warn('Demo hospital not found. Run MultiRoleDemoSeeder first.');
            return;
        }

        $departments = $this->seedDepartments((int) $hospital->id);
        $shifts = $this->seedShifts((int) $hospital->id);
        $designations = $this->seedDesignations((int) $hospital->id, $departments);

        $this->seedEmployees((int) $hospital->id, $departments, $designations, $shifts);
    }

    /**
     * @return array<string, Department>
     */
    private function seedDepartments(int $hospitalId): array
    {
        $rows = [
            ['name' => 'Administration', 'code' => 'ADM', 'description' => 'Hospital admin and operations'],
            ['name' => 'Nursing', 'code' => 'NUR', 'description' => 'Nursing and bedside care'],
            ['name' => 'Laboratory', 'code' => 'LAB', 'description' => 'Diagnostics and lab services'],
            ['name' => 'Pharmacy', 'code' => 'PHA', 'description' => 'Medicine dispensing and stock'],
            ['name' => 'Front Desk', 'code' => 'FRD', 'description' => 'Reception and patient flow'],
            ['name' => 'Finance', 'code' => 'FIN', 'description' => 'Billing and finance operations'],
        ];

        $result = [];

        foreach ($rows as $row) {
            $department = Department::updateOrCreate(
                [
                    'hospital_id' => $hospitalId,
                    'name' => $row['name'],
                ],
                [
                    'code' => $row['code'],
                    'description' => $row['description'],
                    'status' => 'active',
                    'updated_by' => 'seed',
                    'created_by' => 'seed',
                ]
            );

            $result[$row['name']] = $department;
        }

        return $result;
    }

    /**
     * @return array<string, Shift>
     */
    private function seedShifts(int $hospitalId): array
    {
        $rows = [
            ['name' => 'Morning Shift', 'code' => 'MORN', 'start_time' => '08:00', 'end_time' => '16:00', 'grace_minutes' => 10],
            ['name' => 'Evening Shift', 'code' => 'EVE', 'start_time' => '16:00', 'end_time' => '00:00', 'grace_minutes' => 10],
            ['name' => 'Night Shift', 'code' => 'NIGHT', 'start_time' => '00:00', 'end_time' => '08:00', 'grace_minutes' => 10],
            ['name' => 'General Shift', 'code' => 'GEN', 'start_time' => '09:00', 'end_time' => '17:00', 'grace_minutes' => 15],
        ];

        $result = [];

        foreach ($rows as $row) {
            $shift = Shift::updateOrCreate(
                [
                    'hospital_id' => $hospitalId,
                    'name' => $row['name'],
                ],
                [
                    'code' => $row['code'],
                    'start_time' => $row['start_time'],
                    'end_time' => $row['end_time'],
                    'grace_minutes' => $row['grace_minutes'],
                    'is_overnight' => strcmp($row['end_time'], $row['start_time']) < 0,
                    'status' => 'active',
                    'description' => $row['name'] . ' for demo testing',
                    'updated_by' => 'seed',
                    'created_by' => 'seed',
                ]
            );

            $result[$row['name']] = $shift;
        }

        return $result;
    }

    /**
     * @param array<string, Department> $departments
     * @return array<string, Designation>
     */
    private function seedDesignations(int $hospitalId, array $departments): array
    {
        $rows = [
            ['name' => 'HR Manager', 'department' => 'Administration'],
            ['name' => 'Head Nurse', 'department' => 'Nursing'],
            ['name' => 'Staff Nurse', 'department' => 'Nursing'],
            ['name' => 'Lab Technician', 'department' => 'Laboratory'],
            ['name' => 'Pharmacist', 'department' => 'Pharmacy'],
            ['name' => 'Receptionist', 'department' => 'Front Desk'],
            ['name' => 'Accountant', 'department' => 'Finance'],
        ];

        $result = [];

        foreach ($rows as $row) {
            $department = $departments[$row['department']] ?? null;
            if (!$department) {
                continue;
            }

            $designation = Designation::updateOrCreate(
                [
                    'hospital_id' => $hospitalId,
                    'name' => $row['name'],
                ],
                [
                    'department_id' => $department->id,
                    'status' => 'active',
                    'description' => $row['name'] . ' designation for demo testing',
                    'updated_by' => 'seed',
                    'created_by' => 'seed',
                ]
            );

            $result[$row['name']] = $designation;
        }

        return $result;
    }

    /**
     * @param array<string, Department> $departments
     * @param array<string, Designation> $designations
     * @param array<string, Shift> $shifts
     */
    private function seedEmployees(int $hospitalId, array $departments, array $designations, array $shifts): void
    {
        $rows = [
            [
                'first_name' => 'Amina',
                'last_name' => 'Safi',
                'email' => 'amina.safi@demo-hospital.com',
                'phone' => '0700000001',
                'department' => 'Administration',
                'designation' => 'HR Manager',
                'shift' => 'General Shift',
                'employment_type' => 'permanent',
                'basic_salary' => 45000,
            ],
            [
                'first_name' => 'Farid',
                'last_name' => 'Ahmadi',
                'email' => 'farid.ahmadi@demo-hospital.com',
                'phone' => '0700000002',
                'department' => 'Nursing',
                'designation' => 'Head Nurse',
                'shift' => 'Morning Shift',
                'employment_type' => 'permanent',
                'basic_salary' => 38000,
            ],
            [
                'first_name' => 'Laila',
                'last_name' => 'Nazari',
                'email' => 'laila.nazari@demo-hospital.com',
                'phone' => '0700000003',
                'department' => 'Nursing',
                'designation' => 'Staff Nurse',
                'shift' => 'Evening Shift',
                'employment_type' => 'contract',
                'basic_salary' => 32000,
            ],
            [
                'first_name' => 'Sami',
                'last_name' => 'Rahimi',
                'email' => 'sami.rahimi@demo-hospital.com',
                'phone' => '0700000004',
                'department' => 'Laboratory',
                'designation' => 'Lab Technician',
                'shift' => 'Morning Shift',
                'employment_type' => 'permanent',
                'basic_salary' => 30000,
            ],
            [
                'first_name' => 'Mina',
                'last_name' => 'Qadiri',
                'email' => 'mina.qadiri@demo-hospital.com',
                'phone' => '0700000005',
                'department' => 'Laboratory',
                'designation' => 'Lab Technician',
                'shift' => 'Night Shift',
                'employment_type' => 'temporary',
                'basic_salary' => 28000,
            ],
            [
                'first_name' => 'Bilal',
                'last_name' => 'Karimi',
                'email' => 'bilal.karimi@demo-hospital.com',
                'phone' => '0700000006',
                'department' => 'Pharmacy',
                'designation' => 'Pharmacist',
                'shift' => 'General Shift',
                'employment_type' => 'permanent',
                'basic_salary' => 36000,
            ],
            [
                'first_name' => 'Nazia',
                'last_name' => 'Yousufi',
                'email' => 'nazia.yousufi@demo-hospital.com',
                'phone' => '0700000007',
                'department' => 'Front Desk',
                'designation' => 'Receptionist',
                'shift' => 'Morning Shift',
                'employment_type' => 'contract',
                'basic_salary' => 25000,
            ],
            [
                'first_name' => 'Hameed',
                'last_name' => 'Arman',
                'email' => 'hameed.arman@demo-hospital.com',
                'phone' => '0700000008',
                'department' => 'Finance',
                'designation' => 'Accountant',
                'shift' => 'General Shift',
                'employment_type' => 'permanent',
                'basic_salary' => 40000,
            ],
        ];

        foreach ($rows as $index => $row) {
            $department = $departments[$row['department']] ?? null;
            $designation = $designations[$row['designation']] ?? null;
            $shift = $shifts[$row['shift']] ?? null;

            if (!$department || !$designation || !$shift) {
                continue;
            }

            Employee::updateOrCreate(
                [
                    'hospital_id' => $hospitalId,
                    'email' => $row['email'],
                ],
                [
                    'department_id' => $department->id,
                    'designation_id' => $designation->id,
                    'shift_id' => $shift->id,
                    'employee_code' => sprintf('EMP-%03d', $index + 1),
                    'first_name' => $row['first_name'],
                    'last_name' => $row['last_name'],
                    'gender' => $index % 2 === 0 ? 'female' : 'male',
                    'date_of_birth' => '1990-01-01',
                    'phone' => $row['phone'],
                    'address' => 'Demo City',
                    'emergency_contact_name' => 'Emergency Contact',
                    'emergency_contact_phone' => '0799999999',
                    'joining_date' => now()->subMonths(6)->toDateString(),
                    'employment_type' => $row['employment_type'],
                    'basic_salary' => $row['basic_salary'],
                    'status' => 'active',
                    'updated_by' => 'seed',
                    'created_by' => 'seed',
                ]
            );
        }
    }
}
