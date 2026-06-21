<?php

namespace App\Http\Controllers\Routes;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class GeneralController extends Controller
{
    public function department()
    {
        return view('general.department');

    }

    public function designation()
    {
        return view('general.designation');
    }
    public function user_management()
    {

        return view('general.usermanagement');

    }
    public function employee()
    {
        return view('general.employee');

    }
    public function employee_schedule()
    {
        return view('general.schedule');

    }
    public function employee_document()
    {
        return view('general.document');
    }
    public function discount_type()
    {
        return view('general.discount-type');
    }
    public function discount()
    {
        return view('general.discount');
    }
    public function service_type()
    {
        return view('general.service-type');
    }
    public function service()
    {
        return view('general.service');
    }
    public function fee()
    {
        return view('general.fee');
    }

}
