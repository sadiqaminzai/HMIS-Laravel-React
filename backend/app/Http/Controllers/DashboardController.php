<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Hospital;
use App\Models\LabOrder;
use App\Models\Manufacturer;
use App\Models\Medicine;
use App\Models\MedicineType;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\TestTemplate;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $user = $request->user();

        $hospitalId = null;
        if ($user && $user->role === 'super_admin') {
            $hospitalId = $request->integer('hospital_id') ?: null;
        } else {
            $hospitalId = $user?->hospital_id;
        }

        if (!$hospitalId && (!$user || $user->role !== 'super_admin')) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        $hospitalsQuery = Hospital::query();
        if ($hospitalId) {
            $hospitalsQuery->where('id', $hospitalId);
        } elseif ($user && $user->role !== 'super_admin') {
            $hospitalsQuery->where('id', $user->hospital_id);
        }

        $hospitals = $hospitalsQuery
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'status']);

        $counts = [
            'hospitals' => $hospitalId ? 1 : Hospital::count(),
            'doctors' => Doctor::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'active_doctors' => Doctor::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->where('status', 'active')
                ->count(),
            'patients' => Patient::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'prescriptions' => Prescription::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'medicines' => Medicine::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'manufacturers' => Manufacturer::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'medicine_types' => MedicineType::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'test_templates' => TestTemplate::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'lab_orders_today' => LabOrder::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->whereDate('created_at', Carbon::today())
                ->count(),
            'appointments_today' => Appointment::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->whereDate('appointment_date', Carbon::today())
                ->count(),
        ];

        $monthly = [];
        $start = Carbon::now()->startOfMonth()->subMonths(5);
        for ($i = 0; $i < 6; $i++) {
            $monthStart = $start->copy()->addMonths($i);
            $monthEnd = $monthStart->copy()->endOfMonth();

            $monthly[] = [
                'month' => $monthStart->format('M'),
                'patients' => Patient::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->count(),
                'prescriptions' => Prescription::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->count(),
                'appointments' => Appointment::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereBetween('appointment_date', [$monthStart, $monthEnd])
                    ->count(),
            ];
        }

        $appointmentCounts = Appointment::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->selectRaw('LOWER(status) as status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $appointmentStatusData = [
            ['key' => 'scheduled', 'label' => 'Scheduled', 'color' => '#3b82f6'],
            ['key' => 'completed', 'label' => 'Completed', 'color' => '#10b981'],
            ['key' => 'cancelled', 'label' => 'Cancelled', 'color' => '#ef4444'],
            ['key' => 'no_show', 'label' => 'No Show', 'color' => '#6b7280'],
        ];

        $appointmentStatus = collect($appointmentStatusData)->map(function ($item) use ($appointmentCounts) {
            $count = (int) ($appointmentCounts[$item['key']] ?? $appointmentCounts[str_replace('_', ' ', $item['key'])] ?? 0);
            return [
                'name' => $item['label'],
                'value' => $count,
                'color' => $item['color'],
            ];
        })->values();

        $labCounts = LabOrder::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->selectRaw('LOWER(status) as status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $testStatusData = collect([
            ['key' => 'pending', 'label' => 'Pending', 'color' => '#f59e0b'],
            ['key' => 'in_progress', 'label' => 'In Progress', 'color' => '#3b82f6'],
            ['key' => 'completed', 'label' => 'Completed', 'color' => '#10b981'],
            ['key' => 'cancelled', 'label' => 'Cancelled', 'color' => '#ef4444'],
        ])->map(function ($item) use ($labCounts) {
            $count = (int) ($labCounts[$item['key']] ?? $labCounts[str_replace('_', ' ', $item['key'])] ?? 0);
            return [
                'name' => $item['label'],
                'value' => $count,
                'color' => $item['color'],
            ];
        })->values();

        $medicineStockQuery = Medicine::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId));
        $medicineStockData = [
            [
                'name' => 'In Stock',
                'value' => (int) (clone $medicineStockQuery)->where('stock', '>', 10)->count(),
                'color' => '#10b981',
            ],
            [
                'name' => 'Low Stock',
                'value' => (int) (clone $medicineStockQuery)->whereBetween('stock', [1, 10])->count(),
                'color' => '#f59e0b',
            ],
            [
                'name' => 'Out of Stock',
                'value' => (int) (clone $medicineStockQuery)->where('stock', '<=', 0)->count(),
                'color' => '#ef4444',
            ],
        ];

        $recentPatients = Patient::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->latest()
            ->limit(5)
            ->get(['id', 'name', 'patient_id', 'age', 'gender']);

        $recentPrescriptions = Prescription::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->withCount('items')
            ->latest()
            ->limit(5)
            ->get(['id', 'patient_name', 'prescription_number']);

        $recentLabOrders = LabOrder::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->latest()
            ->limit(5)
            ->get(['id', 'patient_name', 'order_number', 'status']);

        return response()->json([
            'hospital_id' => $hospitalId,
            'hospitals' => $hospitals,
            'counts' => $counts,
            'charts' => [
                'monthly' => $monthly,
                'appointment_status' => $appointmentStatus,
                'test_status' => $testStatusData,
                'medicine_stock' => $medicineStockData,
            ],
            'recent' => [
                'patients' => $recentPatients,
                'prescriptions' => $recentPrescriptions,
                'lab_orders' => $recentLabOrders,
            ],
        ]);
    }
}
