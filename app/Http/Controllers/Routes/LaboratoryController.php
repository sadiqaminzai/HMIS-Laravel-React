<?php

namespace App\Http\Controllers\Routes;

use App\Http\Controllers\Controller;
use App\Models\General\Service;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LaboratoryController extends Controller
{
    public function test_type()
    {
        return view('laboratory.test-type');
    }

    public function test_detail()
    {
        return view('laboratory.test-detail');
    }

    public function test_result()
    {
        return view('laboratory.test-result');
    }

    public function test_result_report()
    {
        return view('laboratory.test-result-report');
    }
    
    public function test_type_report()
    {
        return view('laboratory.test-type-report');
    }

    // Handle printing test type report
    public function test_type_report_print()
    {
        // Get filters from session
        $filters = session('print_filters', []);

        // Build query based on filters
        $query = \App\Models\General\Service::with('service_type')
            ->where('is_active', 1)
            ->where('is_delete', 0)
            ->where('is_lab_test', 1);

        if (!empty($filters['search_id'])) {
            $query->where('id', 'like', '%' . $filters['search_id'] . '%');
        }
        
        if (!empty($filters['search_name'])) {
            $query->where('name', 'like', '%' . $filters['search_name'] . '%');
        }

        if (!empty($filters['searchFromDate']) && !empty($filters['searchToDate'])) {
            $query->whereBetween('created_at', [$filters['searchFromDate'], $filters['searchToDate']]);
        }
        
        if (!empty($filters['search_service_type_id'])) {
            $query->where('service_type_id', $filters['search_service_type_id']);
        }

        $query = $query->orderBy('id', 'DESC')->get();

        return view('livewire.laboratory.test_type_reports.print', [
            'query' => $query
        ]);
    }
}
