<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Unified Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 10px;  /* Reduced font size for better fit */
            line-height: 1.4;
            margin: 10px;
            padding: 0;
        }
        .header {
            text-align: center;
            margin-bottom: 15px;
        }
        .header h2 {
            margin: 0;
            padding: 0;
            font-size: 14px;
        }
        .header p {
            margin: 0;
            padding: 0;
            font-size: 12px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            table-layout: fixed; /* Fixed table layout for better column control */
        }
        table, th, td {
            border: 1px solid #ddd;
        }
        th, td {
            padding: 4px;
            text-align: left;
            overflow: hidden;
            word-wrap: break-word;
        }
        th {
            background-color: #f2f2f2;
            font-size: 9px;
        }
        td {
            font-size: 9px;
        }
        /* Set specific column widths */
        .col-num { width: 3%; }
        .col-type { width: 7%; }
        .col-id { width: 6%; }
        .col-date { width: 7%; }
        .col-name { width: 12%; }
        .col-doctor { width: 12%; }
        .col-service { width: 10%; }
        .col-amount { width: 7%; }
        .col-discount { width: 7%; }
        .col-net { width: 7%; }
        .col-paid { width: 7%; }
        .col-due { width: 7%; }
        .col-status { width: 8%; }
        
        .section-title {
            margin-top: 10px;
            margin-bottom: 5px;
            font-weight: bold;
            font-size: 12px;
            background-color: #f2f2f2;
            padding: 4px;
        }
        .totals {
            margin-top: 15px;
            text-align: right;
            font-size: 10px;
        }
        .filters {
            margin-bottom: 10px;
            font-size: 9px;
        }
        .filters strong {
            display: inline-block;
            min-width: 80px;
        }
        .page-break {
            page-break-after: always;
        }
        .text-right {
            text-align: right;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 9px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Life HealthCare Center</h2>
        <p>Sayed Jamaluddin Township Road, Badkhak Square, Arzan Qemat, Kabul</p>
        <p>Contact: 0766 62 62 62</p>
        <p><b>Unified Report</b></p>
        <p>Generated: {{ date('Y-m-d H:i:s') }}</p>
    </div>

    <div class="filters">
        <p><strong>Report Type:</strong> 
            @if($report_type == 'all')
                All
            @elseif($report_type == 'fee')
                Fee Receipts
            @elseif($report_type == 'service')
                Service Receipts
            @elseif($report_type == 'sale')
                Sale Invoices
            @elseif($report_type == 'return')
                Return Invoices
            @elseif($report_type == 'purchase')
                Purchases
            @endif
        </p>
        <p><strong>Date Range:</strong> 
            @if(!empty($searchFromDate) && !empty($searchToDate))
                {{ $searchFromDate }} to {{ $searchToDate }}
            @else
                All Dates
            @endif
        </p>
        @if(!empty($searchById))
            <p><strong>ID:</strong> {{ $searchById }}</p>
        @endif
        @if(!empty($searchFromId) && !empty($searchToId))
            <p><strong>ID Range:</strong> {{ $searchFromId }} to {{ $searchToId }}</p>
        @endif
        @if(!empty($searchByPatient))
            <p><strong>Patient:</strong> {{ $searchByPatient }}</p>
        @endif
        @if(!empty($searchByDoctor))
            <p><strong>Doctor:</strong> {{ $searchByDoctor }}</p>
        @endif
        @if(!empty($searchBySupplier))
            <p><strong>Supplier:</strong> {{ $searchBySupplier }}</p>
        @endif
        @if(!empty($search_payment_status))
            <p><strong>Payment Status:</strong> {{ $search_payment_status }}</p>
        @endif
        @if(!empty($search_payment_method))
            <p><strong>Payment Method:</strong> {{ $search_payment_method }}</p>
        @endif
    </div>

    <!-- Unified Report Table -->
    <table>
        <thead>
            <tr>
                <th class="col-num">#</th>
                <th class="col-type">Type</th>
                <th class="col-id">ID/No.</th>
                <th class="col-date">Date</th>
                <th class="col-name">Name</th>
                <th class="col-doctor">Doctor</th>
                <th class="col-service">Service</th>
                <th class="col-amount text-right">Total</th>
                <th class="col-discount text-right">Discount</th>
                <th class="col-net text-right">Net Amt</th>
                <th class="col-paid text-right">Paid</th>
                <th class="col-due text-right">Due</th>
                <th class="col-status">Status</th>
            </tr>
        </thead>
        <tbody>
            @forelse($reportData as $index => $item)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ $item['type_name'] }}</td>
                <td>{{ $item['number'] }}</td>
                <td>
                    @if(is_string($item['date']))
                        {{ $item['date'] }}
                    @elseif($item['date'] instanceof \Carbon\Carbon)
                        {{ $item['date']->format('Y-m-d') }}
                    @else
                        Invalid Date
                    @endif
                </td>
                <td>
                    @if(!empty($item['patient_name']))
                        {{ $item['patient_name'] }}
                    @elseif(!empty($item['supplier_name']))
                        {{ $item['supplier_name'] }}
                    @else
                        N/A
                    @endif
                </td>
                <td>{{ $item['doctor_name'] ?? 'N/A' }}</td>
                <td>{{ $item['service_name'] ?? 'N/A' }}</td>
                <td class="text-right">{{ number_format($item['total_amount'], 2) }}</td>
                <td class="text-right">{{ number_format($item['discount_amount'], 2) }}</td>
                <td class="text-right">{{ number_format($item['net_amount'], 2) }}</td>
                <td class="text-right">{{ number_format($item['paid_amount'], 2) }}</td>
                <td class="text-right">{{ number_format($item['due_amount'], 2) }}</td>
                <td>{{ $item['payment_status'] }}</td>
            </tr>
            @empty
            <tr>
                <td colspan="13" style="text-align: center;">No data found</td>
            </tr>
            @endforelse
        </tbody>
        <tfoot>
            <tr>
                <th colspan="7" style="text-align: right;">Totals:</th>
                <th class="text-right">{{ number_format($totalAmount, 2) }}</th>
                <th class="text-right">{{ number_format($totalDiscount, 2) }}</th>
                <th class="text-right">{{ number_format($totalNetAmount, 2) }}</th>
                <th class="text-right">{{ number_format($totalPaidAmount, 2) }}</th>
                <th class="text-right">{{ number_format($totalDueAmount, 2) }}</th>
                <th></th>
            </tr>
        </tfoot>
    </table>

    <div class="totals">
        <p><strong>Report Grand Totals</strong></p>
        <p>Total Amount: {{ number_format($totalAmount, 2) }}</p>
        <p>Total Discount: {{ number_format($totalDiscount, 2) }}</p>
        <p>Total Net Amount: {{ number_format($totalNetAmount, 2) }}</p>
        <p>Total Paid Amount: {{ number_format($totalPaidAmount, 2) }}</p>
        <p>Total Due Amount: {{ number_format($totalDueAmount, 2) }}</p>
    </div>

    <div class="footer">
        <p>© {{ date('Y') }} Life HealthCare Center. All rights reserved.</p>
        <p>This is a computer-generated document. No signature is required.</p>
    </div>
</body>
</html>