<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;


class RolePermissionController extends Controller
{
    //

    public function allpermisions() {
        return view('roles.permission');
    } // End Role Method
    public function allroles() {
        return view('roles.roles');
    } // End Role Method
    public function assignperimission() {
        return view('roles.assignperimission');
    } // End Role Method


}
