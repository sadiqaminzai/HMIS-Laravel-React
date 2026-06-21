<!DOCTYPE html>
<html>
<head>
    <title>Test Type Report</title>
    <style>
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid black;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>
<body>
    <h2>Test Type Report</h2>
    <table>
        <thead>
            <tr>
                <th>S.No</th>
                <th>Service ID</th>
                <th>Service Name</th>
                <th>Service Type</th>
                <th>Price</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($services as $key => $service)
            <tr>
                <td>{{ $key + 1 }}</td>
                <td>{{ $service->id }}</td>
                <td>{{ $service->name }}</td>
                <td>{{ $service->service_type->name ?? 'N/A' }}</td>
                <td>{{ $service->amount }}</td>
                <td>{{ $service->is_active ? 'Active' : 'Inactive' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>