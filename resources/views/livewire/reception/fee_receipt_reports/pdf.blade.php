<!DOCTYPE html>
<html>

<head>
    <title>Fee Receipt Report</title>
    <link rel="stylesheet" href="{{ asset('resources/css/print.css') }}">
</head>

<body>
    <p class="print_h1">Life HealthCare Center</p>
    <p class="print_h2">Sayed Jamaluddin Township Road, Badkhak Square, Arzan Qemat, Kabul</p>
    <p class="print_h3">Contact: 0766 62 62 62</p>
    <p class="print_h4">Fee Receipt Report</p>

    <table>
        <thead>
            <tr>
                <th>S.No</th>
                <th>ID</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Total Fees</th>
                <th>Discount</th>
                <th>Net Amount</th>
                <th>Receipt Date</th>
            </tr>
        </thead>
        <tbody>
            @foreach($feeReceipts as $index => $feeReceipt)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ $feeReceipt->id }}</td>
                <td>{{ strtoupper($feeReceipt->patient->name) }}</td>
                <td>{{ strtoupper($feeReceipt->employee->first_name) }} {{ strtoupper($feeReceipt->employee->last_name) }}</td>
                <td>{{ number_format($feeReceipt->total_amount, 2) }}</td>
                <td>{{ number_format($feeReceipt->discount_amount, 2) }}</td>
                <td>{{ number_format($feeReceipt->total_amount - $feeReceipt->discount_amount, 2) }}</td>
                <td>{{ \Carbon\Carbon::parse($feeReceipt->receipt_date)->format('d-m-Y H:i:s') }}</td>
            </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <td colspan="4" class="text-end"><strong>Totals:</strong></td>
                <td><strong>{{ number_format($totalFees, 2) }}</strong></td>
                <td><strong>{{ number_format($totalDiscount, 2) }}</strong></td>
                <td><strong>{{ number_format($totalNetAmount, 2) }}</strong></td>
                <td></td>
            </tr>
        </tfoot>
    </table>

    <div class="print_footer">
        <span class="left">Printed by: {{ Auth::user()->name }}</span>
        <span class="right">Printed at: {{ now()->format('d-m-Y h:i:s A') }}</span>
    </div>

</body>

</html>