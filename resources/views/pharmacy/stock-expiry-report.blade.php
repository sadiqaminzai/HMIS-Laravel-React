@extends('admin.admin_dashboard')
@section('admin')

<div class="page-content">
    <div class="row">
        <div class="col-12 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    @livewire('pharmacy.stock-expiry-report')
                </div>
            </div>
        </div>
    </div>
</div>

@endsection