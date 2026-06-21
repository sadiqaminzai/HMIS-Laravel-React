<!DOCTYPE html>
<html>

<head>
    <title>Service Receipt Report</title>
    <link rel="stylesheet" href="{{ asset('resources/css/print.css') }}">
</head>

<body>
    <p class="print_h1">Life HealthCare Center</p>
    <p class="print_h2">Sayed Jamaluddin Township Road, Badkhak Square, Arzan Qemat, Kabul</p>
    <p class="print_h3">Contact: 0766 62 62 62</p>
    <p class="print_h4">Service Receipt Report</p>

    <table>
        <thead>
            <tr>
                <th>S.No</th>
                <th>ID</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Total Amount</th>
                <th>Discount</th>
                <th>Net Amount</th>
                <th>Receipt Date</th>
            </tr>
        </thead>
        <tbody>
            @foreach($serviceReceipts as $index => $serviceReceipt)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ $serviceReceipt->id }}</td>
                <td>{{ strtoupper($serviceReceipt->patient->name) }}</td>
                <td>{{ strtoupper($serviceReceipt->employee->first_name) }} {{ strtoupper($serviceReceipt->employee->last_name) }}</td>
                <td>{{ number_format($serviceReceipt->total_amount, 2) }}</td>
                <td>{{ number_format($serviceReceipt->discount_amount, 2) }}</td>
                <td>{{ number_format($serviceReceipt->total_amount - $serviceReceipt->discount_amount, 2) }}</td>
                <td>{{ \Carbon\Carbon::parse($serviceReceipt->receipt_date)->format('d-m-Y H:i:s') }}</td>
            </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <!-- Adjust colspan as needed -->
                <td colspan="4" class="text-end"><strong>Totals:</strong></td>
                <td><strong>{{ number_format($totalAmount, 2) }}</strong></td>
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