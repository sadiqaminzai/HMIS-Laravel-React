<div class="container">
    <div class="row mb-2">
        <div class="col-md-1">
            @if(Auth::user()->can('fee.receipt.add'))
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
            @endif
        </div>
        <div class="col-md-8 text-start">
            <h3>Fees Receipt List</h3s>
        </div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <!-- Bootstrap Modal for creating or editing a Packing -->
    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document"> <!-- Added modal-lg class for larger width -->
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Fee Receipt' : 'Create Fee Receipt' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>

                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-6 form-group mb-1">
                            <label for="patient_id">Patient <span class="text-danger fw-300"> *</span></label>
                            <select wire:model="patient_id" id="patient_id" class="form-control mt-1">
                                <option value="" disabled>Select</option>
                                @foreach($patients as $patient)
                                <option value="{{ $patient->id }}">{{ $patient->name }}</option>
                                @endforeach
                            </select>
                            @error('patient_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <div class="col-md-6 form-group mb-1">
                            <label for="doctor_id">Doctor <span class="text-danger fw-300"> *</span></label>
                            <select wire:model="doctor_id" id="doctor_id" class="form-control mt-1">
                                <option value="" disabled>Select doctor</option>
                                @foreach($employees as $employee)
                                <option value="{{ $employee->id }}">{{ $employee->first_name ?? '' }} {{ $employee->last_name ?? '' }}</option>
                                @endforeach
                            </select>
                            @error('doctor_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6 form-group mb-1">
                            <label for="discount_amount">is Free?</label> <br />
                            <input type="checkbox" wire:model="discount" id="discount" class="form-check-input mt-1 me-1"> Free Checkup
                            @error('discount_amount') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <div class="col-md-6 form-group mb-1">
                            <label for="is_active">Status</label>
                            <select wire:model="is_active" id="is_active" class="form-control mt-1">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                            @error('is_active') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6 form-group mb-1">
                            <label for="payment_status">Payment Status</label>
                            <select wire:model="payment_status" id="payment_status" class="form-control mt-1">
                                <option value="" disabled>Select</option>
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                            </select>
                            @error('payment_status') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <div class="col-md-6 form-group mb-1">
                            <label for="payment_method">Payment Method</label>
                            <select wire:model="payment_method" id="payment_method" class="form-control mt-1">
                                <option value="" disabled>Select</option>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="insurance">Insurance</option>
                            </select>
                            @error('payment_method') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <!-- Created By (Auto-filled, just for display) -->
                        @if($id)
                        <div class="col-md-6 form-group mb-1">
                            <p>Created By: {{ Auth::user()->name }}</p>
                        </div>
                        @endif
                    </div>
                </div>
                <div class="modal-footer mt-3">
                    <!-- Cancel Button -->
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <!-- Save Button -->
                    <button type="button" wire:click="{{ $id ? 'update' : 'add' }}" class="btn btn-success">
                        {{ ($id) ? 'Update' : 'Save' }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Table displaying Patient details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Total Fees</th>
                    <th>Discount</th>
                    <th>Receipt Date</th>
                    <th>Created By</th>
                    @if(Auth::user()->can('fee.receipt.edit') || Auth::user()->can('fee.receipt.delete') || Auth::user()->can('fee.receipt.details'))

                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($fee_receipts as $fee_receipt)
                <tr>
                    <td>{{ $fee_receipt->id }}</td>
                    <td>{{ $fee_receipt->patient->name }}</td>
                    <td>{{ $fee_receipt->employee->first_name }} {{ $fee_receipt->employee->last_name }}</td>
                    <td>{{ $fee_receipt->total_amount }}</td>
                    <td>{{$fee_receipt->discount_amount }}</td>
                    <td>{{ $fee_receipt->receipt_date }}</td>
                    <td>{{ ($fee_receipt->user) ? $fee_receipt->user->name : 'Unknown' }}</td>
                    @if(Auth::user()->can('fee.receipt.edit') || Auth::user()->can('fee.receipt.delete') || Auth::user()->can('fee.receipt.details'))

                    <td>
                        @if(Auth::user()->can('fee.receipt.edit'))
                        <button wire:click="edit({{ $fee_receipt->id }})" class="btn btn-icon-text btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">
                            <i class="btn-icon-prepend" data-feather="edit"></i>Edit
                        </button>
                        @endif
                        @if(Auth::user()->can('fee.receipt.delete'))
                        <button wire:click="delete({{ $fee_receipt->id }})" class="btn btn-icon-text btn-sm btn-outline-danger" title="Delete">
                            <i class="btn-icon-prepend" data-feather="trash-2"></i>Delete
                        </button>
                        @endif
                        @if(Auth::user()->can('fee.receipt.details'))
                        <button wire:click="showDetails({{ $fee_receipt->id }})" class="btn btn-icon-text btn-sm btn-outline-info" data-bs-toggle="modal" data-bs-target="#detailsModal">
                            <i class="btn-icon-prepend" data-feather="info"></i>Details
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
        {{ $fee_receipts->links('pagination::bootstrap-4') }}
    </div>
    @endif

    <!-- Fees Receipt Details  -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header  text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Fee Receipt Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>

                <!-- Body -->
                <div class="modal-body p-4">
                    <div class="row g-4">
                        <!-- Patient Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Patient Name:</strong> <span class="text-primary">{{ $selected_data?->patient->name }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Doctor Name:</strong> <span class="text-primary">{{ $selected_data?->employee->first_name }} {{ $selected_data?->employee->last_name }}</span>
                            </div>
                        </div>

                        <!-- Financial Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Discount Amount:</strong> <span class="text-success">{{ number_format($selected_data?->discount_amount, 2) }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Total Amount:</strong> <span class="text-success">{{ number_format($selected_data?->total_amount, 2) }}</span>
                            </div>
                        </div>

                        <!-- Payment Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Payment Status:</strong>
                                <span class="badge {{ $selected_data?->payment_status == 'paid' ? 'bg-success' : 'bg-danger' }}">
                                    {{ ucfirst($selected_data?->payment_status) }}
                                </span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Payment Method:</strong> <span class="text-primary">{{ ucfirst($selected_data?->payment_method) }}</span>
                            </div>
                        </div>

                        <!-- Other Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Receipt Date:</strong> <span class="text-muted">{{ $selected_data?->receipt_date }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Created By:</strong> <span class="text-muted">{{ $selected_data?->user?->name }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Status:</strong>
                                <span class="badge {{ $selected_data?->is_active == 1 ? 'bg-success' : 'bg-secondary' }}">
                                    {{ $selected_data?->is_active == 1 ? 'Active' : 'Inactive' }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="modal-footer d-flex justify-content-end">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    @if(Auth::user()->can('fee.receipt.print'))
                    <button type="button" class="btn btn-primary" onclick="printModalContent()">Print</button>
                    @endif

                </div>
            </div>
        </div>
    </div>

    <!-- Print Receipt Report -->
    <div id="printableContent" style="display: none;">
        <div style="width: 250px; margin: 0; padding: 10px; font-family: Arial, sans-serif; font-size: 9px; border: 1px solid #000;">
            <!-- Header Section -->
            <p style="text-align: center; font-size: 12px; margin: 0;">LIFE HEALTHCARE CENTER</p>
            <p style="text-align: center; font-size: 10px; margin: 0;">Office Cell #: 0093 786 62 62 62</p>
            <p style="text-align: center; margin: 5px 0; font-weight: bold;">Fee RECEIPT</p>

            <!-- Patient & Doctor Information -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                <tr>
                    <td style="font-weight: bold; width: 40%;">Patient:</td>
                    <td style="width: 60%;">{{ $selected_data?->patient->name ?? 'N/A' }}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Doctor:</td>
                    <td>{{ $selected_data?->employee->first_name ?? 'N/A' }} {{ $selected_data?->employee->last_name ?? '' }}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Serial No.:</td>
                    <td>{{ $selected_data?->id ?? 'N/A' }}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Date:</td>
                    <td>{{ $selected_data?->receipt_date ?? 'N/A' }}</td>
                </tr>
            </table>

            <!-- Fee Details Section -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                <thead>
                    <tr>
                        <th style="border-bottom: 1px solid #000; text-align: left; padding-bottom: 3px;">Item</th>
                        <th style="border-bottom: 1px solid #000; text-align: center; padding-bottom: 3px;">Qty</th>
                        <th style="border-bottom: 1px solid #000; text-align: right; padding-bottom: 3px;">Price</th>
                        <th style="border-bottom: 1px solid #000; text-align: right; padding-bottom: 3px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 4px 0; border-bottom: 1px dashed #000;">Consultation Fee</td>
                        <td style="padding: 4px 0; text-align: center; border-bottom: 1px dashed #000;">1</td>
                        <td style="padding: 4px 0; text-align: right; border-bottom: 1px dashed #000;">{{ number_format($selected_data?->total_amount, 2) }}</td>
                        <td style="padding: 4px 0; text-align: right; border-bottom: 1px dashed #000;">{{ number_format($selected_data?->total_amount, 2) }}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Summary Section -->
            <div style="margin-top: 5px;">
                <p style="text-align: right; margin: 2px 0;"><strong>Total Discount:</strong> {{ number_format($selected_data?->discount_amount, 2) }}</p>
                <p style="text-align: right; margin: 2px 0;"><strong>Net Amount:</strong> {{ number_format($selected_data?->total_amount - $selected_data?->discount_amount, 2) }}</p>
                <p style="text-align: right; margin: 2px 0;"><strong>Paid Amount:</strong> {{ $selected_data?->payment_status == 'paid' ? number_format($selected_data?->total_amount, 2) : '0.00' }}</p>
                <p style="text-align: right; margin: 2px 0;"><strong>Due Amount:</strong> {{ $selected_data?->payment_status == 'pending' ? number_format($selected_data?->total_amount, 2) : '0.00' }}</p>
            </div>

            <!-- Dotted Line Separator -->
            <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>

            <!-- Footer Section -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <small>User: {{ $selected_data?->user->name ?? 'Admin' }}</small>
                <small>Printed at: {{ now()->format('Y-m-d h:i:s A') }}</small>
            </div>
            <div style="text-align: center;">
                <small>Thank you for your Visit!</small>
            </div>
        </div>
    </div>

</div>

<!-- Modal Event Listeners -->
<script>
    document.addEventListener('livewire:load', function() {
        window.addEventListener('open-modal', () => {
            var modal = new bootstrap.Modal(document.getElementById('modal'));
            modal.show();
        });

        window.addEventListener('close-modal', () => {
            var modal = bootstrap.Modal.getInstance(document.getElementById('modal'));
            modal.hide();
        });
    });

    window.addEventListener('save-modal', () => {
        var modal = bootstrap.Modal.getInstance(document.getElementById('modal'));
        modal.hide();
    });
</script>
<script>
    function printModalContent() {
        var printContent = document.getElementById('printableContent').innerHTML;

        if (printContent.trim() !== '') {
            var originalContent = document.body.innerHTML;

            // Set up the print content at the top left corner
            document.body.innerHTML = `
                <div style="position: absolute; top: 10px; left: 10px;">
                    ${printContent}
                </div>
            `;

            // Print the content
            window.print();

            // Restore original body content
            document.body.innerHTML = originalContent;

            // Reload the page to ensure everything is back to normal
            window.location.reload();
        } else {
            alert('Details not available for printing.');
        }
    }
</script>