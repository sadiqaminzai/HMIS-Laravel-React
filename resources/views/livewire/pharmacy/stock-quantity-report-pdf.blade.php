<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Stock Quantity Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 12px;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding: 10px;
            border-bottom: 1px solid #ccc;
        }
        .header h2 {
            margin: 0;
            color: #333;
        }
        .date {
            text-align: right;
            margin-bottom: 10px;
            font-size: 11px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        table th, table td {
            border: 1px solid #ddd;
            padding: 5px;
            text-align: left;
            font-size: 11px;
        }
        table th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .out-of-stock {
            color: #dc3545;
        }
        .low-stock {
            color: #ffc107;
        }
        .adequate {
            color: #28a745;
        }
        .overstocked {
            color: #17a2b8;
        }
        .summary {
            margin-top: 20px;
            padding: 10px;
            background-color: #f9f9f9;
            border: 1px solid #ddd;
        }
        .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 10px;
            color: #777;
        }
        .progress-container {
            width: 100%;
            background-color: #f1f1f1;
            border-radius: 3px;
            height: 12px;
            position: relative;
        }
        .progress-bar {
            height: 12px;
            border-radius: 3px;
            position: relative;
            text-align: center;
            line-height: 12px;
            font-size: 8px;
            font-weight: bold;
            color: white;
        }
        .progress-danger {
            background-color: #dc3545;
        }
        .progress-warning {
            background-color: #ffc107;
        }
        .progress-success {
            background-color: #28a745;
        }
        .progress-info {
            background-color: #17a2b8;
        }
    </style>
</head>
<body>
    <div class="header">
        <!-- <img src="{{ public_path('backend/assets/images/logo.png') }}" alt="Logo" class="logo"> -->
        <h1>Life HealthCare Center</h1>
        <p>Sayed Jamaluddin Township Road, Badkhak Square, Arzan Qemat, Kabul</p>
        <p>Contact: 0766 62 62 62</p>
        <p><b>Available Stock Report<b></p>
    
    <div class="date">
        Generated on: {{ date('d-m-Y H:i:s') }}
    </div>
    
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Stock Level</th>
            </tr>
        </thead>
        <tbody>
            @php
                $outOfStockCount = 0;
                $lowStockCount = 0;
                $adequateStockCount = 0;
                $overStockCount = 0;
            @endphp

            @foreach($stocks as $stock)
                @php
                    $statusClass = 'adequate';
                    
                    if ($stock->total_quantity <= 0) {
                        $statusClass = 'out-of-stock';
                        $outOfStockCount++;
                    } elseif ($stock->status == 'Low Stock') {
                        $statusClass = 'low-stock';
                        $lowStockCount++;
                    } elseif ($stock->status == 'Adequate') {
                        $statusClass = 'adequate';
                        $adequateStockCount++;
                    } else {
                        $statusClass = 'overstocked';
                        $overStockCount++;
                    }
                    
                    $percentage = 0;
                    $barClass = 'progress-danger';
                    
                    if ($stock->total_quantity <= 0) {
                        $percentage = 0;
                        $barClass = 'progress-danger';
                    } elseif ($stock->status == 'Low Stock') {
                        $percentage = 25;
                        $barClass = 'progress-warning';
                    } elseif ($stock->status == 'Adequate') {
                        $percentage = 70;
                        $barClass = 'progress-success';
                    } else {
                        $percentage = 100;
                        $barClass = 'progress-info';
                    }
                @endphp
                <tr>
                    <td>{{ $stock->product_id }}</td>
                    <td>{{ $stock->product_name }}</td>
                    <td>{{ $stock->total_quantity }}</td>
                    <td class="{{ $statusClass }}">{{ $stock->status }}</td>
                    <td>
                        <div class="progress-container">
                            <div class="progress-bar {{ $barClass }}" style="width: {{ $percentage }}%;">
                                {{ $percentage }}%
                            </div>
                        </div>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
    
    <div class="summary">
        <h4>Summary</h4>
        <table>
            <tr>
                <td><strong>Out of Stock:</strong></td>
                <td class="out-of-stock">{{ $outOfStockCount }} items</td>
                <td><strong>Low Stock:</strong></td>
                <td class="low-stock">{{ $lowStockCount }} items</td>
                <td><strong>Adequate Stock:</strong></td>
                <td class="adequate">{{ $adequateStockCount }} items</td>
                <td><strong>Overstocked:</strong></td>
                <td class="overstocked">{{ $overStockCount }} items</td>
            </tr>
        </table>
    </div>
    
    <div class="footer">
    <p>© {{ date('Y') }} Life HealthCare Center. All rights reserved.</p>
    </div>
</body>
</html>