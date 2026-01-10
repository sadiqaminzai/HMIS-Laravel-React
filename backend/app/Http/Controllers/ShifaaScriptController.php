<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ShifaaScriptController extends Controller
{
    public function index()
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'ShifaaScript API'
        ]);
    }
}
