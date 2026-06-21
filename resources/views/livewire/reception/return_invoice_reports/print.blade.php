<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Return Invoice Report</title>
    <style>
        @page {
            size: A4;
            margin: 20mm;
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            margin: 0;
            padding: 0;
        }
        .print_h1 {
            text-align: center;
            font-size: 20px;
            margin: 0;
        }
        .print_h2 {
            text-align: center;
            font-size: 16px;
            margin: 0;
        }
        .print_h3 {
            text-align: center;
            font-size: 14px;
            margin: 0;
        }
        .print_h4 {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin-top: 0;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        table, th, td {
            border: 1px solid #000;
        }
        th, td {
            padding: 8px;
            text-align: left;
        }
        th {
            text-align: center;
        }
        tfoot td {
            font-weight: bold;
        }
        .print_footer {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
        }
        .print-button {
            display: block;
            width: 150px;
            margin: 20px auto;
            padding: 10px;
            background-color: #007bff;
            color: white;
            text-align: center;
            font-weight: bold;
            cursor: pointer;
            border: none;
            border-radius: 4px;
        }
        .print-button:hover {
            background-color: #0056b3;
        }
        @media print {
            .print-button {
                display: none;
            }
        }
    </style>
</head>
<body>
    <button class="print-button" onclick="window.print()">Print Report</button>
    
    <p class="print_h1">Life HealthCare Center</p>
    <p class="print_h2">Sayed Jamaluddin Township Road, Badkhak Square, Arzan Qemat, Kabul</p>
    <p class="print_h3">Contact: 0766 62 62 62</p>
    <p class="print_h4">Return Invoice Report</p>

    <table>
        <thead>
            <tr>
                <th>S.No</th>
                <th>Return Invoice ID</th>
                <th>Patient</th>
                <th>Return Invoice Date</th>
                <th>Payment Status</th>
                <th>Payment Method</th>
                <th>Net Amount</th>
                <th>Paid Amount</th>
                <th>Due Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach($query as $key => $invoice)
            <tr>
                <td style="text-align: center;">{{ $key + 1 }}</td>
                <td>{{ $invoice->return_invoice_id }}</td>
                <td>{{ strtoupper($invoice->patient->name) }}</td>
                <td>{{ $invoice->return_invoice_date }}</td>
                <td>{{ strtoupper($invoice->payment_status) }}</td>
                <td>{{ strtoupper($invoice->payment_method) }}</td>
                <td>{{ number_format($invoice->net_amount, 2) }}</td>
                <td>{{ number_format($invoice->paid_amount, 2) }}</td>
                <td>{{ number_format($invoice->due_amount, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <td colspan="6" style="text-align: right;">Totals:</td>
                <td>{{ number_format($totalNetAmount, 2) }}</td>
                <td>{{ number_format($totalPaidAmount, 2) }}</td>
                <td>{{ number_format($totalDueAmount, 2) }}</td>
            </tr>
        </tfoot>
    </table>

    <div class="print_footer">
        <span>Printed by: {{ Auth::user()->name }}</span>
        <span>Printed at: {{ now()->format('d-m-Y h:i:s A') }}</span>
    </div>

    <script>
        // Auto-focus to the print button when page loads
        window.onload = function() {
            document.querySelector('.print-button').focus();
        };
    </script>
</body>
</html>