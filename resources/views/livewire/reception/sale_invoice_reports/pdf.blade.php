<!DOCTYPE html>
<html>
<head>
    <title>Sale Invoice Report</title>
    <link rel="stylesheet" href="{{ asset('resources/css/print.css') }}">
</head>
<body>
    <p class="print_h1">Life HealthCare Center</p>
    <p class="print_h2">Sayed Jamaluddin Township Road, Badkhak Square, Arzan Qemat, Kabul</p>
    <p class="print_h3">Contact: 0766 62 62 62</p>
    <p class="print_h4">Sale Invoice Report</p>

    <table>
        <thead>
            <tr>
                <th>S.No</th>
                <th>Invoice No</th>
                <th>Patient Name</th>
                <th>Invoice Date</th>
                <th>Payment Status</th>
                <th>Payment Method</th>
                <th>Net Amount</th>
                <th>Paid Amount</th>
                <th>Due Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach($invoices as $index => $invoice)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ $invoice->invoice_no }}</td>
                <td>{{ strtoupper($invoice->patient->name) }}</td>
                <td>{{ $invoice->invoice_date }}</td>
                <td>{{ ucfirst($invoice->payment_status) }}</td>
                <td>{{ ucfirst($invoice->payment_method) }}</td>
                <td>{{ number_format($invoice->net_amount, 2) }}</td>
                <td>{{ number_format($invoice->paid_amount, 2) }}</td>
                <td>{{ number_format($invoice->due_amount, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <td colspan="6" class="text-end"><strong>Totals:</strong></td>
                <td><strong>{{ number_format($totalNetAmount, 2) }}</strong></td>
                <td><strong>{{ number_format($totalPaidAmount, 2) }}</strong></td>
                <td><strong>{{ number_format($totalDueAmount, 2) }}</strong></td>
            </tr>
        </tfoot>
    </table>

    <div class="print_footer">
        <span class="left">Printed by: {{ Auth::user()->name }}</span>
        <span class="right">Printed at: {{ now()->format('d-m-Y h:i:s A') }}</span>
    </div>
</body>
</html>