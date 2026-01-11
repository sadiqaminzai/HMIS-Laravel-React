<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Provide a fallback login route so API auth middleware has a redirect target
// and returns a proper 401 JSON payload instead of throwing RouteNotFound.
Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');
