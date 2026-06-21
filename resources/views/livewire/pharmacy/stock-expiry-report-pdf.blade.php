<!DOCTYPE html>
<html>

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Stock Expiry Report</title>
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

        table th,
        table td {
            border: 1px solid #ddd;
            padding: 5px;
            text-align: left;
            font-size: 11px;
        }

        table th {
            background-color: #f2f2f2;
            font-weight: bold;
        }

        .expired {
            color: #dc3545;
        }

        .about-to-expire {
            color: #ffc107;
        }

        .near-expiration {
            color: #17a2b8;
        }

        .good-condition {
            color: #28a745;
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
    </style>
</head>

<body>
    <div class="header">
        <!-- <img src="{{ public_path('backend/assets/images/logo.png') }}" alt="Logo" class="logo"> -->
        <h1>Life HealthCare Center</h1>
        <p>Sayed Jamaluddin Township Road, Badkhak Square, Arzan Qemat, Kabul</p>
        <p>Contact: 0766 62 62 62</p>
        <p><b>Stock Expiry Report<b></p>
    </div>

    <div class="date">
        Generated on: {{ date('d-m-Y H:i:s') }}
    </div>

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Product</th>
                <th>Batch No</th>
                <th>Qty</th>
                <th>Mfg Date</th>
                <th>Expiry Date</th>
                <th>Days</th>
                <th>Status</th>
                <th>Unit Price</th>
            </tr>
        </thead>
        <tbody>
            @php
            $expiredCount = 0;
            $aboutToExpireCount = 0;
            $nearExpirationCount = 0;
            $goodConditionCount = 0;
            @endphp

            @foreach($stocks as $stock)
            @php
            $today = \Carbon\Carbon::today();
            $expiryDate = \Carbon\Carbon::parse($stock->expiry_date);
            $daysRemaining = $today->diffInDays($expiryDate, false);

            $statusClass = 'good-condition';
            $status = 'Good Condition';

            if ($daysRemaining < 0) {
                $statusClass='expired' ;
                $status='Expired' ;
                $expiredCount++;
                } elseif ($daysRemaining <=30) {
                $statusClass='about-to-expire' ;
                $status='About to Expire' ;
                $aboutToExpireCount++;
                } elseif ($daysRemaining <=60) {
                $statusClass='near-expiration' ;
                $status='Near Expiration' ;
                $nearExpirationCount++;
                } else {
                $goodConditionCount++;
                }
                @endphp
                <tr>
                <td>{{ $stock->id }}</td>
                <td>{{ $stock->product->name ?? 'N/A' }}</td>
                <td>{{ $stock->batch_no }}</td>
                <td>{{ $stock->quantity }}</td>
                <td>{{ $stock->mfg_date ? date('d-m-Y', strtotime($stock->mfg_date)) : 'N/A' }}</td>
                <td>{{ $stock->expiry_date ? date('d-m-Y', strtotime($stock->expiry_date)) : 'N/A' }}</td>
                <td>{{ $daysRemaining > 0 ? $daysRemaining : 0 }}</td>
                <td class="{{ $statusClass }}">{{ $status }}</td>
                <td>{{ $stock->unit_price }}</td>
                </tr>
                @endforeach
        </tbody>
    </table>

    <div class="summary">
        <h4>Summary</h4>
        <table>
            <tr>
                <td><strong>Expired:</strong></td>
                <td class="expired">{{ $expiredCount }} items</td>
                <td><strong>About to Expire:</strong></td>
                <td class="about-to-expire">{{ $aboutToExpireCount }} items</td>
                <td><strong>Near Expiration:</strong></td>
                <td class="near-expiration">{{ $nearExpirationCount }} items</td>
                <td><strong>Good Condition:</strong></td>
                <td class="good-condition">{{ $goodConditionCount }} items</td>
            </tr>
        </table>
    </div>

    <div class="footer">
        <p>© {{ date('Y') }} Life HealthCare Center. All rights reserved.</p>
    </div>
</body>

</html>