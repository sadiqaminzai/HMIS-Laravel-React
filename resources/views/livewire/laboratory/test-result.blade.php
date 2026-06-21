<div class="container">

    <!-- ===========================
         1) Normal Table of Service Receipts
         =========================== -->
    <div class="row mb-1">
        <div class="col-md-9 text-start">
            <h3>Test Result List</h3>
        </div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <!-- Table of service receipts -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Receipt ID</th>
                    <th>Patient Code</th>
                    <th>Patient Name</th>
                    <th>Doctor Name</th>
                    <th>Receipt Date</th>
                    <th>Receipt Status</th>
                    @if(Auth::user()->can('lab.test.result.managestatus')
                        || Auth::user()->can('lab.test.result.details')
                        || Auth::user()->can('lab.test.result.view'))
                        <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($service_receipts as $service_receipt)
                <tr>
                    <td>{{ $service_receipt->id ?? '' }}</td>
                    <td>{{ $service_receipt->patient->id  ?? '' }}</td>
                    <td>{{ $service_receipt->patient->name  ?? '' }}</td>
                    <td>
                        {{ $service_receipt->employee->first_name ?? '' }}
                        {{ $service_receipt->employee->last_name  ?? '' }}
                    </td>
                    <td>{{ $service_receipt->receipt_date  ?? '' }}</td>
                    <td>
                        {!! $service_receipt->lab_test_status == 0
                            ? '<span class="badge bg-warning">Pending</span>'
                            : '<span class="badge bg-success">Completed</span>'
                        !!}
                    </td>
                    @if(Auth::user()->can('lab.test.result.managestatus')
                        || Auth::user()->can('lab.test.result.details')
                        || Auth::user()->can('lab.test.result.view'))
                    <td>
                        @if(Auth::user()->can('lab.test.result.details'))
                        <button wire:click="showDetails({{ $service_receipt->id }})"
                                class="btn btn-outline-info btn-icon-text btn-sm"
                                data-bs-toggle="modal" data-bs-target="#detailsModal">
                            <i class="btn-icon-prepend" data-feather="info"></i>Details
                        </button>
                        @endif

                        @if(Auth::user()->can('lab.test.result.view'))
                        <button wire:click="showResult({{ $service_receipt->id }})"
                                class="btn btn-outline-primary btn-icon-text btn-sm"
                                data-bs-toggle="modal" data-bs-target="#resultsModal">
                            <i class="btn-icon-prepend" data-feather="info"></i>Result
                        </button>
                        @endif

                        @if(Auth::user()->can('lab.test.result.managestatus'))
                        <button wire:click="testStatus({{ $service_receipt->id }})"
                                class="btn btn-icon-text btn-sm
                                    {{ $service_receipt->lab_test_status == 1
                                        ? 'btn-outline-success'
                                        : 'btn-outline-warning' }}"
                                title="Test Status">
                            <i class="btn-icon-prepend" data-feather="refresh-cw"></i> Status
                        </button>
                        @endif
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    @if(!$search)
    <div class="d-flex justify-content-end">
        {{ $service_receipts->links('pagination::bootstrap-4') }}
    </div>
    @endif

    <!-- ===========================
         2) Details Modal
         =========================== -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog"
         aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">

                <!-- Modal Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Lab Services List</h5>
                    <button type="button" class="btn-close text-white"
                            data-bs-dismiss="modal" aria-label="Close"
                            wire:click="closeDetailsModal"></button>
                </div>

                <!-- Modal Body -->
                <div class="modal-body">
                    <!-- Service Receipt Header -->
                    <div class="row mb-2">
                        <div class="col-md-2">
                            <span class="text-primary small">Patient Name:</span><br>
                            <span class="text-white">{{ $selected_data?->patient->name }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Doctor Name:</span><br>
                            <span class="text-white">
                                {{ $selected_data?->employee->first_name }}
                                {{ $selected_data?->employee->last_name }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Created By:</span><br>
                            <span class="text-white">{{ $selected_data?->user?->name }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Payment Method:</span><br>
                            <span class="text-white">
                                {{ ucfirst($selected_data?->payment_method) }}
                            </span>
                        </div>
                        <div class="col-md-1">
                            <span class="text-primary small">Payment:</span><br>
                            <span class="badge
                                {{ $selected_data?->payment_status == 'paid'
                                    ? 'bg-success'
                                    : 'bg-danger' }}">
                                {{ ucfirst($selected_data?->payment_status) }}
                            </span>
                        </div>
                        <div class="col-md-1">
                            <span class="text-primary small">Status:</span><br>
                            <span class="badge
                                {{ $selected_data?->is_active == 1
                                    ? 'bg-success'
                                    : 'bg-secondary' }}">
                                {{ $selected_data?->is_active == 1
                                    ? 'Active'
                                    : 'Inactive' }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Receipt Date:</span><br>
                            <span class="text-white">
                                {{ $selected_data?->receipt_date }}
                            </span>
                        </div>
                    </div>

                    <!-- Service Receipt Details Table -->
                    <div class="row">
                        <div class="col-md-12">
                            <div class="table-responsive" style="max-height: 256px; overflow-y: auto;">
                                <table class="table table-bordered table-hover">
                                    <thead style="position: sticky; top: 0; z-index: 1;">
                                        <tr>
                                            <th>S.N</th>
                                            <th>Service Name</th>
                                            <th>Service Type</th>
                                            <th>Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @if($selected_data?->service_receipt_details)
                                            @foreach($selected_data->service_receipt_details as $service_receipt_detail)
                                            <tr>
                                                <td>{{ $loop->iteration }}</td>
                                                <td>{{ $service_receipt_detail->service->name  ?? '' }}</td>
                                                <td>{{ $service_receipt_detail->service_type->name  ?? '' }}</td>
                                                <td>{{ $service_receipt_detail->price  ?? '' }}</td>
                                            </tr>
                                            @endforeach
                                        @else
                                            <tr>
                                                <td colspan="5" class="text-center">
                                                    No service receipt details found.
                                                </td>
                                            </tr>
                                        @endif
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Details (Totals) -->
                    <div class="row mt-2">
                        <div class="col-md-2">
                            <span class="text-primary small">Total Amount:</span><br>
                            <span class="text-success">
                                {{ number_format($selected_data?->total_amount, 2) }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Discount:</span><br>
                            <span class="text-success">{{ $selected_data?->discount }}%</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Discount Amount:</span><br>
                            <span class="text-success">
                                {{ number_format($selected_data?->discount_amount, 2) }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Net Amount:</span><br>
                            <span class="text-success">
                                {{ number_format($selected_data?->net_amount, 2) }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Paid Amount:</span><br>
                            <span class="text-success">
                                {{ number_format($selected_data?->paid_amount, 2) }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Due Amount:</span><br>
                            <span class="text-danger">
                                {{ number_format($selected_data?->due_amount, 2) }}
                            </span>
                        </div>
                    </div>
                </div> <!-- End modal-body -->

                <!-- Modal Footer -->
                <div class="modal-footer d-flex justify-content-end">
                    <button type="button" class="btn btn-secondary btn-sm"
                            data-bs-dismiss="modal">
                        Close
                    </button>
                    <button wire:click="create({{ $service_receipt->id }})"
                            class="btn btn-primary btn-sm"
                            data-bs-toggle="modal" data-bs-target="#resultsModal">
                        Result
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- ===========================
         3) Results Modal
         =========================== -->
    <div wire:ignore.self class="modal fade" id="resultsModal" tabindex="-1" role="dialog"
         aria-labelledby="resultsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">

                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="resultsModalLabel">Lab Result List</h5>
                    <button type="button" class="btn-close text-white"
                            data-bs-dismiss="modal" aria-label="Close"
                            wire:click="closeResultsModal"></button>
                </div>

                <!-- Body -->
                <div class="modal-body">
                    <!-- Service Receipt Header Info -->
                    <div class="row mb-2">
                        <input type="hidden" wire:model.defer="patient_service_id"
                               value="{{ $selected_data?->id }}">
                        <div class="col-md-2">
                            <span class="text-primary small">Patient Name:</span><br>
                            <span class="text-white">{{ $selected_data?->patient->name }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Doctor Name:</span><br>
                            <span class="text-white">
                                {{ $selected_data?->employee->first_name }}
                                {{ $selected_data?->employee->last_name }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Created By:</span><br>
                            <span class="text-white">
                                {{ $selected_data?->user?->name }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Receipt Date:</span><br>
                            <span class="text-white">
                                {{ $selected_data?->receipt_date }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Lab Technician:</span><br>
                            <span class="text-white">
                                {{ Auth::user()->name }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Reporting Date:</span><br>
                            <input type="date" wire:model.defer="reporting_date"
                                   class="form-control"
                                   value="{{ $selected_data?->reporting_date }}">
                        </div>
                    </div>

                    <!-- Table of Test Results -->
                    <div class="row">
                        <div class="col-md-12">
                            <div class="table-responsive" style="max-height: 256px; overflow-y: auto;">
                                <table class="table table-bordered table-hover">
                                    <thead style="position: sticky; top: 0; z-index: 1;">
                                        <tr>
                                            <th>S.N</th>
                                            <th>Test Name</th>
                                            <th>Normal Range</th>
                                            <th>Unit</th>
                                            <th>Service Name</th>
                                            <th>Result Value</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @if($selected_data?->service_receipt_details)
                                            @foreach($selected_data->service_receipt_details as $service_receipt_detail)
                                                @if($service_receipt_detail->test_details)
                                                    @foreach($service_receipt_detail->test_details as $test_detail)
                                                    <tr>
                                                        <td>{{ $loop->iteration }}</td>
                                                        <td>{{ $test_detail->name }}</td>
                                                        <td>{{ $test_detail->normal_range }}</td>
                                                        <td>{{ $test_detail->unit }}</td>
                                                        <td>{{ $service_receipt_detail->service->name ?? '' }}</td>
                                                        <td>
                                                            <input type="text"
                                                                   wire:model.defer="test_results.{{ $test_detail->id }}.result_value"
                                                                   class="form-control">
                                                        </td>
                                                        <td>
                                                            <input type="text"
                                                                   wire:model.defer="test_results.{{ $test_detail->id }}.description"
                                                                   class="form-control">
                                                        </td>
                                                    </tr>
                                                    @endforeach
                                                @else
                                                    <tr>
                                                        <td colspan="7" class="text-center">
                                                            No test details found.
                                                        </td>
                                                    </tr>
                                                @endif
                                            @endforeach
                                        @else
                                            <tr>
                                                <td colspan="7" class="text-center">
                                                    No service receipt details found.
                                                </td>
                                            </tr>
                                        @endif
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Remarks -->
                    <div class="row mt-2">
                        <div class="col-md-10">
                            <span class="text-primary small">Remarks:</span><br>
                            <textarea wire:model.defer="remarks"
                                      class="form-control" rows="2"></textarea>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="modal-footer d-flex justify-content-end">
                    <button type="button" class="btn btn-secondary btn-sm"
                            data-bs-dismiss="modal">
                        Close
                    </button>
                    @if(Auth::user()->can('lab.test.result.add'))
                    <button type="button" class="btn btn-primary btn-sm" wire:click="store">
                        Save
                    </button>
                    @endif

                    @if(Auth::user()->can('lab.test.result.print'))
                        @php
                            $isPrintEnabled = true;
                            if ($selected_data?->service_receipt_details) {
                                foreach ($selected_data->service_receipt_details as $service_receipt_detail) {
                                    if ($service_receipt_detail->test_details) {
                                        foreach ($service_receipt_detail->test_details as $test_detail) {
                                            if (empty($test_results[$test_detail->id]['result_value'] ?? null)) {
                                                $isPrintEnabled = false;
                                                break 2;
                                            }
                                        }
                                    }
                                }
                            } else {
                                $isPrintEnabled = false;
                            }
                        @endphp

                        <!-- Print Button -->
                        <button type="button" class="btn btn-success"
                                onclick="printModalContent()"
                                @if(!$isPrintEnabled) disabled @endif>
                            Print
                        </button>
                    @endif
                </div>
            </div>
        </div>
    </div>

    <!-- ===========================
         4) Group Test Details by test_type_id for Print
         =========================== -->
    @php
        $testsGroupedByType = [];
        foreach ($selected_data?->service_receipt_details ?? [] as $service_receipt_detail) {
            foreach ($service_receipt_detail->test_details ?? [] as $test_detail) {
                $typeId = $test_detail->test_type_id ?? 'UnknownType';
                if (!isset($testsGroupedByType[$typeId])) {
                    $testsGroupedByType[$typeId] = [];
                }
                $testsGroupedByType[$typeId][] = [
                    'test_detail'  => $test_detail,
                    'service_name' => $service_receipt_detail->service->name ?? '',
                ];
            }
        }

        // Count how many groups
        $groupCount = count($testsGroupedByType);
        $currentIndex = 0;
    @endphp

    <!-- ===========================
         5) Printable Section (One page per test_type)
         =========================== -->
    <div id="printable-section" style="display: none;">
        @foreach($testsGroupedByType as $typeId => $testDetailsArray)
            @php
                $currentIndex++;
                // If you have a relationship for test_type name:
                // $testTypeName = optional($testDetailsArray[0]['test_detail']->test_type)->name ?? 'Unknown Type';
                $testTypeName = 'Test Type: ' . $typeId;
                $serviceName = $testDetailsArray[0]['service_name'] ?? 'Unknown Service';

            @endphp

            <!-- Only do page-break-after if it's not the last group -->
            <div class="page"
                 style="@if($currentIndex < $groupCount) page-break-after: always; @endif">

                <!-- HEADER -->
                <div class="header" style="padding: 20px;">
                    <div style="text-align: center; margin-bottom: 5px;">
                        <h2 style="color: #28a745; margin: 0;">
                            LIFE HEALTHCARE CENTER
                        </h2>
                        <h2 style="color: #28a745; margin: 0;">
                            لایف هیلت کلینک او زیږنتون
                        </h2>
                        <!-- Pashto text (لایف هیلت کلینک او زیږنتون) right below the English title -->

                        <p style="color: #050605; font-size: 15px;  margin: 0;">
                            YOUR LIFE, OUR PRIORITY
                        </p>
                    </div>
                    <hr style="border: 2px solid #030303; margin: 12px 0 10px 0;">

                    <!-- Patient & Doctor Info Row -->
                    <div style="display: flex; justify-content: space-between;">
                        <div style="font-size: 14px; text-align: left;">
                            <p style="margin-bottom: 3px;">
                                <strong>Patient Name:</strong>
                                {{ $selected_data?->patient->name }}
                            </p>
                            <p style="margin-bottom: 3px;">
                                <strong>Doctor Name:</strong>
                                {{ $selected_data?->employee->first_name }}
                                {{ $selected_data?->employee->last_name }}
                            </p>
                        </div>
                        <div style="font-size: 14px; text-align: right;">
                            <p style="margin-bottom: 3px;">
                                <strong>Receipt Date:</strong>
                                {{ $selected_data?->receipt_date }}
                            </p>
                            <p style="margin-bottom: 3px;">
                                <strong>Reporting Date:</strong>
                                {{ $reporting_date }}
                            </p>
                        </div>
                    </div>

                    <!-- Test Type Title (OUTSIDE the Table) -->
                    <div style="text-align: center; margin-bottom: 10px;">
                        <h4 style="margin: 0; font-size: 16px; color: #012402;">
                            Test:{{ $serviceName }}
                        </h4>
                    </div>
                </div><!-- end .header -->

                <!-- CONTENT: Table + Remarks, with margin -->
                <div class="content" style="padding: 0 20px; margin-top: 30px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background-color: #007bff; color: #fff;">
                                <th style="border: 1px solid #ccc; padding: 8px;">Test Name</th>
                                {{-- <th style="border: 1px solid #ccc; padding: 8px;">Test Type</th> --}}
                                <th style="border: 1px solid #ccc; padding: 8px;">Result Value</th>

                                <th style="border: 1px solid #ccc; padding: 8px;">Normal Range</th>
                                <th style="border: 1px solid #ccc; padding: 8px;">Unit</th>
                                {{-- <th style="border: 1px solid #ccc; padding: 8px;">Observations</th> --}}
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($testDetailsArray as $item)
                                @php
                                    $detail      = $item['test_detail'];
                                    $serviceName = $item['service_name'];
                                @endphp
                                <tr>
                                    <td style="border: 1px solid #ccc; padding: 8px;">
                                        {{ $detail->name }}
                                    </td>
                                    {{-- <td style="border: 1px solid #ccc; padding: 8px;">
                                        {{ $serviceName }}
                                    </td> --}}
                                    <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">
                                        {{ $test_results[$detail->id]['result_value'] ?? '' }}
                                    </td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">
                                        {{ $detail->normal_range }}
                                    </td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">
                                        {{ $detail->unit }}
                                    </td>

                                    {{-- <td style="border: 1px solid #ccc; padding: 8px;">
                                        {{ $test_results[$detail->id]['description'] ?? '' }}
                                    </td> --}}
                                </tr>
                            @endforeach
                        </tbody>
                    </table>

                    <!-- Remarks -->
                    <div style="margin-top: 20px; font-size: 14px; text-align: left;">
                        <strong>Remarks:</strong> {{ $remarks }}
                    </div>
                </div><!-- end .content -->

                <!-- FOOTER pinned at bottom for short content -->
                <div class="footer"
                     style="position: absolute; bottom: 0; left: 0; right: 0;">
                    <div style="background-color: #35920d; color: white;
                                padding: 10px; font-size: 12px; text-align: center;">
                        <p style="margin: 0; font-weight: bold;">
                            Life Healthcare Center
                        </p>
                        <p style="margin: 0;">
                            12 Arzan Qemat bouthkhak,Kabul
                        </p>
                        <p style="margin: 0;">
                            Contact: 0766626262| Email: contact@lhc.com
                        </p>
                    </div>
                </div><!-- end .footer -->
            </div><!-- end .page -->
        @endforeach
    </div><!-- end #printable-section -->

    <!-- ===========================
         6) Scripts for Modal + Print
         =========================== -->
    <script>
        document.addEventListener('livewire:load', function() {
            window.addEventListener('open-modal', () => {
                var modal = new bootstrap.Modal(document.getElementById('resultsModal'));
                modal.show();
            });

            window.addEventListener('close-modal', () => {
                var modal = bootstrap.Modal.getInstance(document.getElementById('resultsModal'));
                modal.hide();
            });
        });

        window.addEventListener('save-modal', () => {
            var modal = bootstrap.Modal.getInstance(document.getElementById('resultsModal'));
            modal.hide();
        });

        function printModalContent() {
            const printContent = document.getElementById('printable-section').innerHTML;
            const printWindow = window.open('', '_blank', 'width=700,height=850');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print Test Results</title>
                    <style>
                        /* Force A4 so the footer can be pinned for short pages */
                        @page {
                            size: A4;
                            margin: 0;
                        }
                        @media print {
                            body {
                                margin: 0;
                                font-family: Arial, sans-serif;
                            }
                            .page {
                                position: relative;
                                width: 210mm;
                                height: 297mm;
                                margin: 0 auto;
                                overflow: hidden;
                                page-break-after: always;
                            }
                            .header {
                                position: absolute;
                                top: 0;
                                left: 0;
                                right: 0;
                            }
                            .content {
                                position: absolute;
                                top: 180px; /* more space for the newly added Pashto text */
                                bottom: 80px;
                                left: 0;
                                right: 0;
                                overflow: auto;
                            }
                            .footer {
                                position: absolute;
                                bottom: 0;
                                left: 0;
                                right: 0;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                            }
                            th, td {
                                border: 1px solid #ccc;
                                padding: 8px;
                                text-align: left;
                            }
                            th {
                                background-color: #0a5003 !important;
                                color: #fff !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
            printWindow.close();
        }
    </script>

</div>
