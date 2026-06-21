@extends('admin.admin_dashboard')
@section('admin')

<div class="page-content">

    <!-- =======================
         HEADER & TOP BUTTONS
    ======================== -->
    <div class="d-flex justify-content-between align-items-center flex-wrap grid-margin">
        <div>
            <h4 class="mb-3 mb-md-0">Admin Dashboard</h4>
        </div>
        <div class="d-flex align-items-center flex-wrap text-nowrap">
            <form action="{{ route('admin.dashboard.search') }}" method="POST" class="d-flex align-items-center">
                @csrf
                <div class="input-group me-2 mb-2 mb-md-0">
                    <input type="text" name="start_date" class="form-control bg-transparent border-primary" placeholder="Start date" onfocus="(this.type='date')">
                    <input type="text" name="end_date" class="form-control bg-transparent border-primary" placeholder="End date" onfocus="(this.type='date')">
                </div>
                <button type="submit" class="btn btn-outline-primary btn-icon-text me-2 mb-2 mb-md-0">
                    <i class="btn-icon-prepend" data-feather="search"></i>
                    Search
                </button>
            </form>
            <div class="input-group flatpickr wd-200 me-2 mb-2 mb-md-0" id="dashboardDate">
                
            </div>
            <button type="button" class="btn btn-outline-primary btn-icon-text me-2 mb-2 mb-md-0">
                <i class="btn-icon-prepend" data-feather="printer"></i>
                Print
            </button>
            <button type="button" class="btn btn-primary btn-icon-text mb-2 mb-md-0">
                <i class="btn-icon-prepend" data-feather="download-cloud"></i>
                Download Report
            </button>
        </div>
    </div>

    <!-- =======================
         OVERVIEW CARDS
    ======================== -->
    <div class="row">
        <!-- Total Patients -->
        <div class="col-xl-3 col-md-4 col-sm-6 mb-4">
            <div class="card shadow-sm">
                <div class="card-body">
                    <h6 class="card-title">Total Patients</h6>
                    <h3 class="mb-0">{{ $totalPatients }}</h3>
                    <p class="text-muted mb-0">Registered Patients</p>
                </div>
            </div>
        </div>
        <!-- Fees Receipts -->
        <div class="col-xl-3 col-md-4 col-sm-6 mb-4">
            <div class="card shadow-sm">
                <div class="card-body">
                    <h6 class="card-title">Fees Receipts</h6>
                    <h3 class="mb-0">{{ $totalFeesReceipts }}</h3>
                    <p class="text-muted mb-0">Total Fees Generated</p>
                </div>
            </div>
        </div>
        <!-- Service Receipts -->
        <div class="col-xl-3 col-md-4 col-sm-6 mb-4">
            <div class="card shadow-sm">
                <div class="card-body">
                    <h6 class="card-title">Service Receipts</h6>
                    <h3 class="mb-0">{{ $totalServiceReceipts }}</h3>
                    <p class="text-muted mb-0">Services Rendered</p>
                </div>
            </div>
        </div>
        <!-- Sale Invoices -->
        <div class="col-xl-3 col-md-4 col-sm-6 mb-4">
            <div class="card shadow-sm">
                <div class="card-body">
                    <h6 class="card-title">Sale Invoices</h6>
                    <h3 class="mb-0">{{ $totalSaleInvoices }}</h3>
                    <p class="text-muted mb-0">Invoices Issued</p>
                </div>
            </div>
        </div>
    </div>

    <!-- =======================
         ADDITIONAL FINANCIAL METRICS
    ======================== -->
    <div class="row mt-4">
        <div class="col-12">
            <div class="card shadow-sm">
                <div class="card-body">
                    <h6 class="card-title">Financial Metrics</h6>
                    <div class="row">
                        <div class="col-md-2 col-6">
                            <small class="text-muted">Total Fees Amount</small>
                            <h4 class="mb-0">{{ $totalFeesAmount }}</h4>
                        </div>
                        <div class="col-md-2 col-6">
                            <small class="text-muted">Total Service Amount</small>
                            <h4 class="mb-0">{{ $totalServiceAmount }}</h4>
                        </div>
                        <div class="col-md-2 col-6">
                            <small class="text-muted">Total Sale Amount</small>
                            <h4 class="mb-0">{{ $totalSaleAmount }}</h4>
                        </div>
                        <div class="col-md-2 col-6">
                            <small class="text-muted">Total Purchase Amount</small>
                            <h4 class="mb-0">{{ $totalPurchaseAmount }}</h4>
                        </div>
                        <div class="col-md-2 col-6">
                            <small class="text-muted">Total Return Amount</small>
                            <h4 class="mb-0">{{ $totalReturnAmount }}</h4>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- =======================
         ROW 1: COMBINED (Paid + Pending)
    ======================== -->
    <div class="row py-4">
        <h5 class="mb-3">Combined (Paid + Pending)</h5>
        <!-- Fees (Combined) -->
        <div class="col-md-4 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title mb-0">FEES</h6>
                    <h3 class="mb-0">{{ number_format($todayFeesAmount, 2) }}</h3>
                    <small class="text-muted">Today Total</small>
                    <div class="d-flex align-items-baseline mt-2">
                        @if($feesPercentageChange >= 0)
                            <p class="text-success mb-0">
                                <span>+{{ number_format($feesPercentageChange, 2) }}%</span>
                                <i data-feather="arrow-up" class="icon-sm mb-1"></i>
                            </p>
                        @else
                            <p class="text-danger mb-0">
                                <span>{{ number_format($feesPercentageChange, 2) }}%</span>
                                <i data-feather="arrow-down" class="icon-sm mb-1"></i>
                            </p>
                        @endif
                    </div>
                    <div id="feesCombinedChart" class="mt-3"></div>
                </div>
            </div>
        </div>
        <!-- Sale (Combined) -->
        <div class="col-md-4 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title mb-0">SALE INVOICE</h6>
                    <h3 class="mb-0">{{ number_format($todaySaleAmount, 2) }}</h3>
                    <small class="text-muted">Today Total</small>
                    <div class="d-flex align-items-baseline mt-2">
                        @if($salePercentageChange >= 0)
                            <p class="text-success mb-0">
                                <span>+{{ number_format($salePercentageChange, 2) }}%</span>
                                <i data-feather="arrow-up" class="icon-sm mb-1"></i>
                            </p>
                        @else
                            <p class="text-danger mb-0">
                                <span>{{ number_format($salePercentageChange, 2) }}%</span>
                                <i data-feather="arrow-down" class="icon-sm mb-1"></i>
                            </p>
                        @endif
                    </div>
                    <div id="saleCombinedChart" class="mt-3"></div>
                </div>
            </div>
        </div>
        <!-- Service (Combined) -->
        <div class="col-md-4 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title mb-0">SERVICE</h6>
                    <h3 class="mb-0">{{ number_format($todayServiceAmount, 2) }}</h3>
                    <small class="text-muted">Today Total</small>
                    <div class="d-flex align-items-baseline mt-2">
                        @if($servicePercentageChange >= 0)
                            <p class="text-success mb-0">
                                <span>+{{ number_format($servicePercentageChange, 2) }}%</span>
                                <i data-feather="arrow-up" class="icon-sm mb-1"></i>
                            </p>
                        @else
                            <p class="text-danger mb-0">
                                <span>{{ number_format($servicePercentageChange, 2) }}%</span>
                                <i data-feather="arrow-down" class="icon-sm mb-1"></i>
                            </p>
                        @endif
                    </div>
                    <div id="serviceCombinedChart" class="mt-3"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- =======================
         ROW 2: PAID ONLY
    ======================== -->
    <div class="row">
        <h5 class="mb-3">Paid Only</h5>
        <!-- Fees (Paid) -->
        <div class="col-md-4 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title mb-0">FEES (Paid)</h6>
                    <h3 class="mb-0">{{ number_format($todayFeesAmountPaid, 2) }}</h3>
                    <small class="text-muted">Today Total</small>
                    <div class="d-flex align-items-baseline mt-2">
                        @if($feesPercentageChangePaid >= 0)
                            <p class="text-success mb-0">
                                <span>+{{ number_format($feesPercentageChangePaid, 2) }}%</span>
                                <i data-feather="arrow-up" class="icon-sm mb-1"></i>
                            </p>
                        @else
                            <p class="text-danger mb-0">
                                <span>{{ number_format($feesPercentageChangePaid, 2) }}%</span>
                                <i data-feather="arrow-down" class="icon-sm mb-1"></i>
                            </p>
                        @endif
                    </div>
                    <div id="feesPaidChart" class="mt-3"></div>
                </div>
            </div>
        </div>
        <!-- Sale (Paid) -->
        <div class="col-md-4 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title mb-0">SALE INVOICE (Paid)</h6>
                    <h3 class="mb-0">{{ number_format($todaySaleAmountPaid, 2) }}</h3>
                    <small class="text-muted">Today Total</small>
                    <div class="d-flex align-items-baseline mt-2">
                        @if($salePercentageChangePaid >= 0)
                            <p class="text-success mb-0">
                                <span>+{{ number_format($salePercentageChangePaid, 2) }}%</span>
                                <i data-feather="arrow-up" class="icon-sm mb-1"></i>
                            </p>
                        @else
                            <p class="text-danger mb-0">
                                <span>{{ number_format($salePercentageChangePaid, 2) }}%</span>
                                <i data-feather="arrow-down" class="icon-sm mb-1"></i>
                            </p>
                        @endif
                    </div>
                    <div id="salePaidChart" class="mt-3"></div>
                </div>
            </div>
        </div>
        <!-- Service (Paid) -->
        <div class="col-md-4 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title mb-0">SERVICE (Paid)</h6>
                    <h3 class="mb-0">{{ number_format($todayServiceAmountPaid, 2) }}</h3>
                    <small class="text-muted">Today Total</small>
                    <div class="d-flex align-items-baseline mt-2">
                        @if($servicePercentageChangePaid >= 0)
                            <p class="text-success mb-0">
                                <span>+{{ number_format($servicePercentageChangePaid, 2) }}%</span>
                                <i data-feather="arrow-up" class="icon-sm mb-1"></i>
                            </p>
                        @else
                            <p class="text-danger mb-0">
                                <span>{{ number_format($servicePercentageChangePaid, 2) }}%</span>
                                <i data-feather="arrow-down" class="icon-sm mb-1"></i>
                            </p>
                        @endif
                    </div>
                    <div id="servicePaidChart" class="mt-3"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- =======================
         ROW 3: PENDING ONLY
    ======================== -->
    <div class="row ">
        <h5 class="mb-3">Pending Only</h5>
        <!-- Fees (Pending) -->
        <div class="col-md-4 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title mb-0">FEES (Pending)</h6>
                    <h3 class="mb-0">{{ number_format($todayFeesAmountPending, 2) }}</h3>
                    <small class="text-muted">Today Total</small>
                    <div class="d-flex align-items-baseline mt-2">
                        @if($feesPercentageChangePending >= 0)
                            <p class="text-success mb-0">
                                <span>+{{ number_format($feesPercentageChangePending, 2) }}%</span>
                                <i data-feather="arrow-up" class="icon-sm mb-1"></i>
                            </p>
                        @else
                            <p class="text-danger mb-0">
                                <span>{{ number_format($feesPercentageChangePending, 2) }}%</span>
                                <i data-feather="arrow-down" class="icon-sm mb-1"></i>
                            </p>
                        @endif
                    </div>
                    <div id="feesPendingChart" class="mt-3"></div>
                </div>
            </div>
        </div>
        <!-- Sale (Pending) -->
        <div class="col-md-4 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title mb-0">SALE INVOICE (Pending)</h6>
                    <h3 class="mb-0">{{ number_format($todaySaleAmountPending, 2) }}</h3>
                    <small class="text-muted">Today Total</small>
                    <div class="d-flex align-items-baseline mt-2">
                        @if($salePercentageChangePending >= 0)
                            <p class="text-success mb-0">
                                <span>+{{ number_format($salePercentageChangePending, 2) }}%</span>
                                <i data-feather="arrow-up" class="icon-sm mb-1"></i>
                            </p>
                        @else
                            <p class="text-danger mb-0">
                                <span>{{ number_format($salePercentageChangePending, 2) }}%</span>
                                <i data-feather="arrow-down" class="icon-sm mb-1"></i>
                            </p>
                        @endif
                    </div>
                    <div id="salePendingChart" class="mt-3"></div>
                </div>
            </div>
        </div>
        <!-- Service (Pending) -->
        <div class="col-md-4 grid-margin stretch-card">
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title mb-0">SERVICE (Pending)</h6>
                    <h3 class="mb-0">{{ number_format($todayServiceAmountPending, 2) }}</h3>
                    <small class="text-muted">Today Total</small>
                    <div class="d-flex align-items-baseline mt-2">
                        @if($servicePercentageChangePending >= 0)
                            <p class="text-success mb-0">
                                <span>+{{ number_format($servicePercentageChangePending, 2) }}%</span>
                                <i data-feather="arrow-up" class="icon-sm mb-1"></i>
                            </p>
                        @else
                            <p class="text-danger mb-0">
                                <span>{{ number_format($servicePercentageChangePending, 2) }}%</span>
                                <i data-feather="arrow-down" class="icon-sm mb-1"></i>
                            </p>
                        @endif
                    </div>
                    <div id="servicePendingChart" class="mt-3"></div>
                </div>
            </div>
        </div>
    </div> <!-- End Pending Row -->

    <!-- =======================
         JAVASCRIPT FOR CHARTS
    ======================== -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        $(function() {
            'use strict';

            var colors = {
                primary     : "#6571ff",
                secondary   : "#7987a1",
                success     : "#05a34a",
                info        : "#66d1d1",
                warning     : "#fbbc06",
                danger      : "#ff3366",
                light       : "#e9ecef",
                dark        : "#060c17",
                muted       : "#7987a1",
                gridBorder  : "rgba(77, 138, 240, .15)",
                bodyColor   : "#b8c3d9",
                cardBg      : "#0c1427"
            };

            var fontFamily = "'Roboto', Helvetica, sans-serif";

            // -------------------------------------------------------------------
            // 1) COMBINED CHARTS (Paid + Pending)
            // -------------------------------------------------------------------
            // FEES COMBINED
            if($('#feesCombinedChart').length) {
                var feesCombinedOptions = {
                    chart: {
                        type: "line",
                        height: 60,
                        sparkline: { enabled: true }
                    },
                    series: [{
                        name: 'Fees Combined',
                        data: {!! json_encode($thisMonthFeesAmounts) !!}
                    }],
                    xaxis: {
                        type: 'datetime',
                        categories: {!! json_encode($thisMonthDays) !!}
                    },
                    stroke: { width: 2, curve: "smooth" },
                    markers: { size: 0 },
                    colors: [colors.primary]
                };
                new ApexCharts(document.querySelector("#feesCombinedChart"), feesCombinedOptions).render();
            }

            // SALE COMBINED
            if($('#saleCombinedChart').length) {
                var saleCombinedOptions = {
                    chart: {
                        type: "bar",
                        height: 60,
                        sparkline: { enabled: true }
                    },
                    plotOptions: {
                        bar: { borderRadius: 2, columnWidth: "60%" }
                    },
                    series: [{
                        name: 'Sale Combined',
                        data: {!! json_encode($thisMonthSaleAmounts) !!}
                    }],
                    xaxis: {
                        type: 'datetime',
                        categories: {!! json_encode($thisMonthDays) !!}
                    },
                    colors: [colors.primary]
                };
                new ApexCharts(document.querySelector("#saleCombinedChart"), saleCombinedOptions).render();
            }

            // SERVICE COMBINED
            if($('#serviceCombinedChart').length) {
                var serviceCombinedOptions = {
                    chart: {
                        type: "line",
                        height: 60,
                        sparkline: { enabled: true }
                    },
                    series: [{
                        name: 'Service Combined',
                        data: {!! json_encode($thisMonthServiceAmounts) !!}
                    }],
                    xaxis: {
                        type: 'datetime',
                        categories: {!! json_encode($thisMonthDays) !!}
                    },
                    stroke: { width: 2, curve: "smooth" },
                    markers: { size: 0 },
                    colors: [colors.primary]
                };
                new ApexCharts(document.querySelector("#serviceCombinedChart"), serviceCombinedOptions).render();
            }

            // -------------------------------------------------------------------
            // 2) PAID CHARTS
            // -------------------------------------------------------------------
            // FEES PAID
            if($('#feesPaidChart').length) {
                var feesPaidOptions = {
                    chart: {
                        type: "line",
                        height: 60,
                        sparkline: { enabled: true }
                    },
                    series: [{
                        name: 'Fees Paid',
                        data: {!! json_encode($thisMonthFeesAmountsPaid) !!}
                    }],
                    xaxis: {
                        type: 'datetime',
                        categories: {!! json_encode($thisMonthDays) !!}
                    },
                    stroke: { width: 2, curve: "smooth" },
                    markers: { size: 0 },
                    colors: [colors.success]
                };
                new ApexCharts(document.querySelector("#feesPaidChart"), feesPaidOptions).render();
            }

            // SALE PAID
            if($('#salePaidChart').length) {
                var salePaidOptions = {
                    chart: {
                        type: "bar",
                        height: 60,
                        sparkline: { enabled: true }
                    },
                    plotOptions: {
                        bar: { borderRadius: 2, columnWidth: "60%" }
                    },
                    series: [{
                        name: 'Sale Paid',
                        data: {!! json_encode($thisMonthSaleAmountsPaid) !!}
                    }],
                    xaxis: {
                        type: 'datetime',
                        categories: {!! json_encode($thisMonthDays) !!}
                    },
                    colors: [colors.success]
                };
                new ApexCharts(document.querySelector("#salePaidChart"), salePaidOptions).render();
            }

            // SERVICE PAID
            if($('#servicePaidChart').length) {
                var servicePaidOptions = {
                    chart: {
                        type: "line",
                        height: 60,
                        sparkline: { enabled: true }
                    },
                    series: [{
                        name: 'Service Paid',
                        data: {!! json_encode($thisMonthServiceAmountsPaid) !!}
                    }],
                    xaxis: {
                        type: 'datetime',
                        categories: {!! json_encode($thisMonthDays) !!}
                    },
                    stroke: { width: 2, curve: "smooth" },
                    markers: { size: 0 },
                    colors: [colors.success]
                };
                new ApexCharts(document.querySelector("#servicePaidChart"), servicePaidOptions).render();
            }

            // -------------------------------------------------------------------
            // 3) PENDING CHARTS
            // -------------------------------------------------------------------
            // FEES PENDING
            if($('#feesPendingChart').length) {
                var feesPendingOptions = {
                    chart: {
                        type: "line",
                        height: 60,
                        sparkline: { enabled: true }
                    },
                    series: [{
                        name: 'Fees Pending',
                        data: {!! json_encode($thisMonthFeesAmountsPending) !!}
                    }],
                    xaxis: {
                        type: 'datetime',
                        categories: {!! json_encode($thisMonthDays) !!}
                    },
                    stroke: { width: 2, curve: "smooth" },
                    markers: { size: 0 },
                    colors: [colors.danger]
                };
                new ApexCharts(document.querySelector("#feesPendingChart"), feesPendingOptions).render();
            }

            // SALE PENDING
            if($('#salePendingChart').length) {
                var salePendingOptions = {
                    chart: {
                        type: "bar",
                        height: 60,
                        sparkline: { enabled: true }
                    },
                    plotOptions: {
                        bar: { borderRadius: 2, columnWidth: "60%" }
                    },
                    series: [{
                        name: 'Sale Pending',
                        data: {!! json_encode($thisMonthSaleAmountsPending) !!}
                    }],
                    xaxis: {
                        type: 'datetime',
                        categories: {!! json_encode($thisMonthDays) !!}
                    },
                    colors: [colors.danger]
                };
                new ApexCharts(document.querySelector("#salePendingChart"), salePendingOptions).render();
            }

            // SERVICE PENDING
            if($('#servicePendingChart').length) {
                var servicePendingOptions = {
                    chart: {
                        type: "line",
                        height: 60,
                        sparkline: { enabled: true }
                    },
                    series: [{
                        name: 'Service Pending',
                        data: {!! json_encode($thisMonthServiceAmountsPending) !!}
                    }],
                    xaxis: {
                        type: 'datetime',
                        categories: {!! json_encode($thisMonthDays) !!}
                    },
                    stroke: { width: 2, curve: "smooth" },
                    markers: { size: 0 },
                    colors: [colors.danger]
                };
                new ApexCharts(document.querySelector("#servicePendingChart"), servicePendingOptions).render();
            }

        });
    </script>

</div>

@endsection
