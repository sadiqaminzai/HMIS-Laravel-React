<nav class="sidebar">
    <div class="sidebar-header">
        <a href="#" class="sidebar-brand">
            LHC<span> HMIS</span>
        </a>
        <div class="sidebar-toggler not-active">
            <span></span>
            <span></span>
            <span></span>
        </div>
    </div>
    <div class="sidebar-body">
        <ul class="nav">
            <!-- <li class="nav-item nav-category">Main</li> -->
            <li class="nav-item">
                <a href=" {{ route('admin.dashboard') }}" class="nav-link">
                    <i class="link-icon" data-feather="box"></i>
                    <span class="link-title">Dashboard</span>
                </a>
            </li>
            <li class="nav-item nav-category">General</li>

            <!-- User Accounts Management -->

            @if(Auth::user()->can('user.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#user-account" role="button" aria-expanded="false" aria-controls="user-account">
                    <i class="link-icon" data-feather="user"></i>
                    <span class="link-title">User Accounts</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                @if (Auth::user()->can('user.view'))
                <div class="collapse" id="user-account">
                    <ul class="nav sub-menu">
                        <li class="nav-item">
                            <a href="{{ route('general.user-management') }}" class="nav-link">Manage Users</a>
                        </li>
                    </ul>
                </div>
                @endif
            </li>
            @endif

            <!-- Department Management -->
            @if(Auth::user()->can('department.menu'))

            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#department" role="button" aria-expanded="false" aria-controls="department">
                    <i class="link-icon" data-feather="layers"></i>
                    <span class="link-title">Department</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                @if(Auth::user()->can('department.view'))
                <div class="collapse" id="department">
                    <ul class="nav sub-menu">
                        <li class="nav-item">
                            <a href="{{ route('general.department') }}" class="nav-link">Manage Department</a>
                        </li>
                    </ul>
                </div>
                @endif
            </li>
            @endif

            <!-- Designation Management -->
            @if(Auth::user()->can('designation.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#designation" role="button" aria-expanded="false" aria-controls="designation">
                    <i class="link-icon" data-feather="briefcase"></i>
                    <span class="link-title">Designation</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                @if(Auth::user()->can('designation.view'))
                <div class="collapse" id="designation">
                    <ul class="nav sub-menu">
                        <li class="nav-item">
                            <a href="{{ route('general.designation') }}" class="nav-link">Manage Designation</a>
                        </li>
                    </ul>
                </div>
                @endif
            </li>
            @endif

            <!-- Employee Management -->
            @if(Auth::user()->can('employee.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#employee" role="button" aria-expanded="false" aria-controls="employee">
                    <i class="link-icon" data-feather="users"></i>
                    <span class="link-title">Manage Employee</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="employee">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('employee.view'))
                        <li class="nav-item">
                            <a href="{{ route('general.employee') }}" class="nav-link">Employee</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('employee.document.view'))
                        <li class="nav-item">
                            <a href="{{ route('general.employee.document') }}" class="nav-link">Employee Documents</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('employee.schedule.view'))
                        <li class="nav-item">
                            <a href="{{ route('general.employee.schedule') }}" class="nav-link">Employee Shedule</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>
            @endif

            <!-- Discount Management -->
            @if(Auth::user()->can('discount.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#discount" role="button" aria-expanded="false" aria-controls="discount">
                    <i class="link-icon" data-feather="percent"></i>
                    <span class="link-title">Manage Discount</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="discount">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('discount.type.view'))
                        <li class="nav-item">
                            <a href="{{ route('general.discount-type') }}" class="nav-link">Discount Type</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('discount.view'))
                        <li class="nav-item">
                            <a href="{{ route('general.discount') }}" class="nav-link">Discount</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>
            @endif

            <!-- Service Management -->
            @if(Auth::user()->can('service.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#service" role="button" aria-expanded="false" aria-controls="service">
                    <i class="link-icon" data-feather="tool"></i>
                    <span class="link-title">Manage Service</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="service">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('service.type.view'))
                        <li class="nav-item">
                            <a href="{{ route('general.service-type') }}" class="nav-link">Service Type</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('service.view'))
                        <li class="nav-item">
                            <a href="{{ route('general.service') }}" class="nav-link">Service</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>
            @endif

            <!-- Fees Management -->
            @if(Auth::user()->can('fee.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#manage-fee" role="button" aria-expanded="false" aria-controls="manage-fee">
                    <i class="link-icon" data-feather="dollar-sign"></i>
                    <span class="link-title">Manage Fee</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="manage-fee">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('fee.view'))
                        <li class="nav-item">
                            <a href="{{ route('general.fee') }}" class="nav-link">Fees</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>
            @endif

            <!-- Reports -->
            @if(Auth::user()->can('general.reports'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#general-reports" role="button" aria-expanded="false" aria-controls="general-reports">
                    <i class="link-icon" data-feather="bar-chart-2"></i>
                    <span class="link-title">Reports</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="general-reports">
                    <ul class="nav sub-menu">
                        <li class="nav-item">
                            <a href="#" class="nav-link">Incoming Revenue</a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link">Outgoing Revenue</a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link">Expenses</a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link">Profit</a>
                        </li>
                    </ul>
                </div>
            </li>
            @endif

            <li class="nav-item nav-category">Reception</li>
            @if(Auth::user()->can('reception.menu'))

            <!-- Patient Management -->
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#patient" role="button" aria-expanded="false" aria-controls="patient">
                    <i class="link-icon" data-feather="user"></i>
                    <span class="link-title">Manage Patient</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="patient">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('patient.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.patient') }}" class="nav-link">Register Patient</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>
            @endif

            <!-- Billing/Receipts Management -->
            @if(Auth::user()->can('reciept.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#billing-receipt" role="button" aria-expanded="false" aria-controls="billing-receipt">
                    <i class="link-icon" data-feather="file-text"></i>
                    <span class="link-title">Receipts/Billings</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="billing-receipt">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('fee.receipt.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.fee-receipt') }}" class="nav-link">Fee Receipt</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('service.receipt.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.service-receipt') }}" class="nav-link">Service Receipt</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('sale.invoice.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.invoice-receipt') }}" class="nav-link">Sale Invoice</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('sale.return.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.return-invoice-receipt') }}" class="nav-link">Sale Return</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>

            <!-- Reception Reports -->
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#reception_reports" role="button" aria-expanded="false" aria-controls="reception_reports">
                    <i class="link-icon" data-feather="bar-chart-2"></i>
                    <span class="link-title">Reports</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="reception_reports">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('patient.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.patient-report') }}" class="nav-link {{ request()->is('reception/patient/report') ? 'active' : '' }}">
                                Patient Report
                            </a>
                        </li>
                        @endif
                        @if(Auth::user()->can('fee.receipt.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.fee-receipt-report') }}" class="nav-link {{ request()->is('reception/fee/receipt/report') ? 'active' : '' }}">
                                Fee Receipt Report
                            </a>
                        </li>
                        @endif
                        
                        

                        
                        @if(Auth::user()->can('service.receipt.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.service-receipt-report') }}" class="nav-link {{ request()->is('reception/service/receipt/report') ? 'active' : '' }}">
                                Service Receipt Report
                            </a>
                        </li>
                        @endif
                        @if(Auth::user()->can('sale.invoice.receipt.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.sale-invoice-receipt-report') }}" class="nav-link {{ request()->is('reception/sale-invoice/receipt/report') ? 'active' : '' }}">
                                Sale Invoice Report
                            </a>
                        </li>
                        @endif
                        @if(Auth::user()->can('sale.return.receipt.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('reception.return-invoice-receipt-report') }}" class="nav-link {{ request()->is('reception/return-invoice/receipt/report') ? 'active' : '' }}">
                                Sale Return Report
                            </a>
                        </li>
                        @endif
                        @if(Auth::user()->can('purchase.receipt.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('purchasereports') }}" class="nav-link {{ request()->is('reception/purchase') ? 'active' : '' }}">
                                Purchase Report
                            </a>
                        </li>
                        @endif
                        @if(Auth::user()->can('fee.receipt.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('reports.unified') }}" class="nav-link {{ request()->is('reports/unified') ? 'active' : '' }}">
                                Full  Report
                            </a>
                        </li>
                        @endif
                    </ul>
                </div>

            </li>
            @endif

            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#surgery-management" role="button" aria-expanded="false" aria-controls="surgery-management">
                    <i class="link-icon" data-feather="scissors"></i>
                    <span class="link-title">Surgery Management</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="surgery-management">
                    <ul class="nav sub-menu">
                        <li class="nav-item">
                            <a href="{{ route('reception.surgery-management') }}" class="nav-link">Manage Surgeries</a>
                        </li>
                    </ul>
                </div>
            </li>

            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#room-management" role="button" aria-expanded="false" aria-controls="room-management">
                    <i class="link-icon" data-feather="home"></i>
                    <span class="link-title">Room Management</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="room-management">
                    <ul class="nav sub-menu">
                        <li class="nav-item">
                            <a href="{{ route('reception.room-management') }}" class="nav-link">Manage Rooms</a>
                        </li>
                        <li class="nav-item">
                            <a href="{{ route('reception.room-booking-management') }}" class="nav-link">Room Bookings</a>
                        </li>
                    </ul>
                </div>
            </li>

            <li class="nav-item nav-category">Pharmacy</li>

            <!-- pharmacy-general Management -->
            <!-- General -->
            @if(Auth::user()->can('general.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#pharmacy-general" role="button" aria-expanded="false" aria-controls="pharmacy-general">
                    <i class="link-icon" data-feather="settings"></i>
                    <span class="link-title">General</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="pharmacy-general">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('pharmacy.company.view'))
                        <li class="nav-item">
                            <a href="{{ route('pharmacy.company') }}" class="nav-link">Company</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('pharmacy.supplier.view'))
                        <li class="nav-item">
                            <a href="{{ route('pharmacy.supplier') }}" class="nav-link">Supplier</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('pharmacy.packing.view'))
                        <li class="nav-item">
                            <a href="{{ route('pharmacy.packing') }}" class="nav-link">Packing</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('pharmacy.product.view'))
                        <li class="nav-item">
                            <a href="{{ route('pharmacy.product') }}" class="nav-link">Product</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>
            @endif
            <!-- Inventory -->
            @if(Auth::user()->can('inventory.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#pharmacy-inventory" role="button" aria-expanded="false" aria-controls="pharmacy-inventory">
                    <i class="link-icon" data-feather="archive"></i>
                    <span class="link-title">Inventory</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="pharmacy-inventory">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('pharmacy.stock.view'))
                        <li class="nav-item">
                            <a href="{{ route('pharmacy.stock') }}" class="nav-link">Stock</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('pharmacy.purchase.view'))

                        <li class="nav-item">
                            <a href="{{ route('pharmacy.purchase') }}" class="nav-link">Purchase</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>
            @endif
            <!-- Billings -->
            @if(Auth::user()->can('billing.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#pharmacy-billings" role="button" aria-expanded="false" aria-controls="pharmacy-billings">
                    <i class="link-icon" data-feather="file-text"></i>
                    <span class="link-title">Billings</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="pharmacy-billings">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('pharmacy.saleinvoice.view'))
                        <li class="nav-item">
                            <a href="{{ route('pharmacy.sale-invoice') }}" class="nav-link">Sale Invoice</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('pharmacy.returnsaleinvoice.view'))
                        <li class="nav-item">
                            <a href="{{ route('pharmacy.return-invoice') }}" class="nav-link">Return Invoice</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>
            @endif
            <!-- Reports -->
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#pharmacy-reports" role="button" aria-expanded="false" aria-controls="pharmacy-reports">
                    <i class="link-icon" data-feather="bar-chart-2"></i>
                    <span class="link-title">Reports</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="pharmacy-reports">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('pharmay.expiry.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('pharmacy.stock-expiry-report') }}" class="nav-link {{ request()->is('pharmacy/stock-expiry-report') ? 'active' : '' }}">
                                Expiry Report
                            </a>
                        </li>
                        @endif
                        @if(Auth::user()->can('pharmacy.stock.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('pharmacy.stock-quantity-report') }}" class="nav-link {{ request()->is('pharmacy/stock-quantity-report') ? 'active' : '' }}">
                                Stock Report
                            </a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>

            <li class="nav-item nav-category">Laboratory</li>
            <!-- Test Management -->
            @if(Auth::user()->can('test.menu'))
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#test" role="button" aria-expanded="false" aria-controls="test">
                    <i class="link-icon" data-feather="activity"></i>
                    <span class="link-title">Manage Test</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="test">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('lab.test.type.view'))
                        <li class="nav-item">
                            <a href="{{ route('laboratory.test-type') }}" class="nav-link">Test Type</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('lab.test.detail.view'))
                        <li class="nav-item">
                            <a href="{{ route('laboratory.test-detail') }}" class="nav-link">Test Detail</a>
                        </li>
                        @endif
                        @if(Auth::user()->can('lab.test.result.view'))
                        <li class="nav-item">
                            <a href="{{ route('laboratory.test-result') }}" class="nav-link">Test Result</a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>
            @endif
            <!-- Reports -->
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#pharmacy-reports" role="button" aria-expanded="false" aria-controls="pharmacy-reports">
                    <i class="link-icon" data-feather="bar-chart-2"></i>
                    <span class="link-title">Reports</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="pharmacy-reports">
                    <ul class="nav sub-menu">
                        @if(Auth::user()->can('laboratory.test-result.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('laboratory.test-result-report') }}" class="nav-link {{ request()->is('laboratory/test-result-report') ? 'active' : '' }}">
                                Test Result Report
                            </a>
                        </li>
                        @endif
                        @if(Auth::user()->can('laboratory.test-type.report.view'))
                        <li class="nav-item">
                            <a href="{{ route('laboratory.test-type-report') }}" class="nav-link {{ request()->is('laboratory/test-type-report') ? 'active' : '' }}">
                                Test Type Report
                            </a>
                        </li>
                        @endif
                    </ul>
                </div>
            </li>

            @if(Auth::user()->can('permission.meu'))
            <li class="nav-item nav-category">Roles & Permissions</li>

            <!-- General -->
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="collapse" href="#permissions-general" role="button" aria-expanded="false" aria-controls="permissions-general">
                    <i class="link-icon" data-feather="settings"></i>
                    <span class="link-title">Perimissions</span>
                    <i class="link-arrow" data-feather="chevron-down"></i>
                </a>
                <div class="collapse" id="permissions-general">
                    <ul class="nav sub-menu">

                        <li class="nav-item">
                            <a href="{{ route('all.Permisions.view') }}" class="nav-link">All Permission</a>
                        </li>

                        <li class="nav-item">
                            <a href="{{ route('all.Roles.view') }}" class="nav-link">Roles</a>
                        </li>

                        <li class="nav-item">
                            <a href="{{ route('assignpermission.view') }}" class="nav-link">Assign Permission to roles</a>
                        </li>

                    </ul>
                </div>
            </li>
            @endif
        </ul>
    </div>
</nav>