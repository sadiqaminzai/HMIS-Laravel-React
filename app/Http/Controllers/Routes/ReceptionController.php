<?php

namespace App\Http\Controllers\Routes;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ReceptionController extends Controller
{
    public function patient()
    {
        return view('reception.patient');
    }
    public function fee_receipt()
    {
        return view('reception.fee-receipt');
    }

    public function service_receipt()
    {
        return view('reception.service-receipt');
    }
    public function invoice_receipt()
    {
        return view('reception.invoice-receipt');
    }

    public function return_invoice_receipt()
    {
        return view('reception.return-invoice-receipt');
    }

    /*
    Reports Section
    */

    /*
    public function daily_report()
    {
        return view('reception.reports.daily-report');
    }

    public function monthly_report()
    {
        return view('reception.reports.monthly-report');
    }

    public function yearly_report()
    {
        return view('reception.reports.yearly-report');
    }

    public function custom_report()
    {
        return view('reception.reports.custom-report');
    }
    */

    public function patient_report()
    {
        return view('reception.patient-report');
    }
    public function patient_report_pdf()
    {
        return view('reception.patient-report-pdf');
    }
    public function patient_report_print()
    {
        // Get filters from session
        $filters = session('print_filters', []);

        // Build query based on filters
        $query = \App\Models\Reception\Patient::with('user')
            ->where('is_active', 1)
            ->where('is_delete', 0);

        if (!empty($filters['searchById'])) {
            $query->where('id', $filters['searchById']);
        } elseif (!empty($filters['searchByName'])) {
            $query->where('name', $filters['searchByName']);
        } elseif (!empty($filters['searchByCreatedAt'])) {
            $query->whereDate('created_at', $filters['searchByCreatedAt']);
        }

        if (!empty($filters['searchFromDate']) && !empty($filters['searchToDate'])) {
            $query->whereBetween('created_at', [
                $filters['searchFromDate'], 
                date('Y-m-d', strtotime($filters['searchToDate'] . ' +1 day'))
            ]);
        }

        $patients = $query->orderBy('created_at', 'asc')->get();

        return view('livewire.reception.patient_reports.print', compact('patients'));
    }

    public function fee_receipt_report()
    {
        return view('reception.fee-receipt-report');
    }

    public function service_receipt_report()
    {
        return view('reception.service-receipt-report');
    }

    public function sale_invoice_receipt_report()
    {
        return view('reception.sale-invoice-receipt-report');
    }

    public function return_invoice_receipt_report()
    {
        return view('reception.return-invoice-receipt-report');
    }
    
    public function purchasereport_rpo()
    {
        return view('reception.purchasereports');
    }
    
    // Unified Report
    public function unified_report()
    {
        return view('reception.unified-report');
    }

    public function surgery_management()
    {
        return view('reception.surgery-management');
    }

    public function surgery_print()
    {
        // Get filters from session
        $filters = session('print_filters', []);

        // Build query based on filters
        $query = \App\Models\Models\PatientSurgery::with('patient', 'surgery')
            ->where('is_delete', 0);

        if (!empty($filters['searchById'])) {
            $query->where('id', $filters['searchById']);
        }
        
        if (!empty($filters['searchFromId']) && !empty($filters['searchToId'])) {
            $query->whereBetween('id', [$filters['searchFromId'], $filters['searchToId']]);
        }
        
        if (!empty($filters['searchByPatient'])) {
            $query->whereHas('patient', function ($q) use ($filters) {
                $q->where('name', 'like', '%' . $filters['searchByPatient'] . '%');
            });
        }
        
        if (!empty($filters['searchBySurgery'])) {
            $query->whereHas('surgery', function ($q) use ($filters) {
                $q->where('name', 'like', '%' . $filters['searchBySurgery'] . '%');
            });
        }
        
        if (!empty($filters['searchFromDate']) && !empty($filters['searchToDate'])) {
            $query->whereBetween('surgery_date', [
                \Carbon\Carbon::createFromFormat('Y-m-d', $filters['searchFromDate'])->startOfDay(),
                \Carbon\Carbon::createFromFormat('Y-m-d', $filters['searchToDate'])->endOfDay(),
            ]);
        }

        $patientSurgeries = $query->orderBy('surgery_date', 'asc')->get();
        $totalCost = $patientSurgeries->sum('cost');

        return view('livewire.reception.patient_surgeries.print', compact('patientSurgeries', 'totalCost'));
    }

    public function room_management()
    {
        return view('reception.room-management');
    }

    public function room_booking_management()
    {
        return view('reception.room-booking-management');
    }

    public function room_print()
    {
        // Get filters from session
        $filters = session('print_filters', []);

        // Build query based on filters
        $query = \App\Models\Reception\Room::where('is_delete', 0);

        if (!empty($filters['searchById'])) {
            $query->where('id', $filters['searchById']);
        }
        
        if (!empty($filters['searchByRoomNumber'])) {
            $query->where('room_number', 'like', '%' . $filters['searchByRoomNumber'] . '%');
        }
        
        if (!empty($filters['searchByType'])) {
            $query->where('type', 'like', '%' . $filters['searchByType'] . '%');
        }

        $rooms = $query->orderBy('room_number', 'asc')->get();

        return view('livewire.reception.rooms.print', compact('rooms'));
    }

    public function room_booking_print()
    {
        // Get filters from session
        $filters = session('print_filters', []);

        // Build query based on filters
        $query = \App\Models\Reception\RoomBooking::with('patient', 'room')
            ->where('is_delete', 0);

        if (!empty($filters['searchById'])) {
            $query->where('id', $filters['searchById']);
        }
        
        if (!empty($filters['searchByPatient'])) {
            $query->whereHas('patient', function ($q) use ($filters) {
                $q->where('name', 'like', '%' . $filters['searchByPatient'] . '%');
            });
        }
        
        if (!empty($filters['searchByRoom'])) {
            $query->whereHas('room', function ($q) use ($filters) {
                $q->where('room_number', 'like', '%' . $filters['searchByRoom'] . '%');
            });
        }
        
        if (!empty($filters['searchFromDate']) && !empty($filters['searchToDate'])) {
            $query->whereBetween('check_in_date', [
                \Carbon\Carbon::createFromFormat('Y-m-d', $filters['searchFromDate'])->startOfDay(),
                \Carbon\Carbon::createFromFormat('Y-m-d', $filters['searchToDate'])->endOfDay(),
            ]);
        }

        $roomBookings = $query->orderBy('check_in_date', 'asc')->get();
        $totalCost = $roomBookings->sum('total_cost');

        return view('livewire.reception.room_bookings.print', compact('roomBookings', 'totalCost'));
    }
}
