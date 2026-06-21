<div class="container">
    <div class="row mb-2">
        <div class="col-md-6">
            <h3>Employee Documents</h3>
        </div>
        <div class="col-md-3"></div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <div class="table-responsive">
        <table class="table table-bordered mt-5">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Employee Code</th>
                    <th>Email</th>
                    @if(Auth::user()->can('employee.document.add') ||Auth::user()->can('employee.document.delete')|| Auth::user()->can('employee.document.details'))
                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($employees as $employee)
                <tr>
                    <td>{{ $loop->iteration }}</td>
                    <td>{{ $employee->first_name ?? 'N/A' }}</td>
                    <td>{{ $employee->last_name ?? 'N/A' }}</td>
                    <td>{{ $employee->employee_code }}</td>
                    <td>{{ $employee->email }}</td>
                    @if( Auth::user()->can('employee.document.add') ||Auth::user()->can('employee.document.delete')|| Auth::user()->can('employee.document.details'))

                    <td>
                        @if(Auth::user()->can('employee.document.details'))
                        <button wire:click="showDetails({{ $employee->id }})" class="btn btn-info btn-sm">Details</button>
                        @endif
                        @if(Auth::user()->can('employee.document.delete'))
                        <button wire:click="deleteDocument({{ $employee->id }})" class="btn btn-danger btn-sm">Delete</button>
                         @endif
                         @if(Auth::user()->can('employee.document.add'))

                        <button wire:click="openDocumentModal({{ $employee->id }})" class="btn btn-success btn-sm">Add Document</button>
                        @endif
                    </td>
                    @endif
                </tr>

                @endforeach
            </tbody>
        </table>
    </div>
    {{ $employees->links() }}

    <!-- Document Modal -->
    @if($showDocumentModal)
    <div class="modal show" style="display:block;" tabindex="-1" role="dialog">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Add/Edit Document</h5>
                    <button type="button" wire:click="closeDocumentModal" class="btn-close" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="document_type">Document Type</label>
                        <select wire:model="document_type" id="document_type" class="form-control" multiple>
                            <option value="ID Proof">ID Proof</option>
                            <option value="Resume">Resume</option>
                            <option value="Medical License">Medical License</option>
                            <option value="Background Check">Background Check</option>
                            <option value="Training Certificate">Training Certificate</option>
                            <option value="Contract Agreement">Contract Agreement</option>
                        </select>
                        <small class="form-text text-muted">Select multiple document types by holding Ctrl (Windows) or Command (Mac).</small>
                        @error('document_type') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group">
                        <label for="document_url">Document Files</label>
                        <input type="file" wire:model="document_url" id="document_url" class="form-control" multiple>
                        @error('document_url.*') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>
                    <div class="form-group">
                        <label for="is_active">Active</label>
                        <select wire:model="is_active" id="is_active" class="form-control">
                            <option value="1">Yes</option>
                            <option value="0">No</option>
                        </select>
                        @error('is_active') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" wire:click="closeDocumentModal" class="btn btn-secondary">Cancel</button>
                    <button type="button" wire:click="saveDocument" class="btn btn-success">Save Document</button>
                </div>
            </div>
        </div>
    </div>
    @endif

    <!-- Details Modal for Employee Documents -->
 <!-- Details Modal for Employee Documents -->
<!-- Details Modal for Employee Documents -->
<!-- Details Modal for Employee Documents -->
<!-- Details Modal for Employee Documents -->
@if($showDetailsModal)
<div class="modal show" style="display: block;" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Employee Document Details</h5>
                <button type="button" wire:click="closeDetailsModal" class="btn-close" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                @if($selectedDocument && $selectedDocument->isNotEmpty())
                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Employee:</strong> {{ $selectedDocument[0]->Employee->first_name }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Document Types:</strong></div>
                            @php
                                // Group documents by document_type
                                $groupedDocuments = $selectedDocument->groupBy('document_type');
                            @endphp
                            @foreach($groupedDocuments as $type => $documents)
                                <div>
                                    <strong>{{ trim($type) }}:</strong>
                                    @foreach($documents as $document)
                                        <div>
                                            <a href="{{ asset('storage/' . $document->document_url) }}" target="_blank">
                                                {{ trim($document->document_type) }}
                                            </a>
                                        </div>
                                    @endforeach
                                </div>
                                <br>
                            @endforeach
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Status:</strong> {{ $selectedDocument[0]->is_active ? 'Active' : 'Inactive' }}</div>
                        </div>
                    </div>
                @else
                    <p>No documents available for this employee.</p>
                @endif
            </div>
            <div class="modal-footer">
                <button type="button" wire:click="closeDetailsModal" class="btn btn-secondary">Close</button>
            </div>
        </div>
    </div>
</div>
@endif


</div>
