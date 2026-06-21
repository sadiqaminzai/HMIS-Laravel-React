<!DOCTYPE html>
<html>

<head>
    <title>Patient Report</title>
    <link rel="stylesheet" href="{{ asset('resources/css/print.css') }}">
</head>

<body>
    <p class="print_h1">Life HealthCare Center</p>
    <p class="print_h2">Sayed Jamaluddin Township Road, Badkhak Square, Arzan Qemat, Kabul</p>
    <p class="print_h3">Contact: 0766 62 62 62</p>
    <p class="print_h4">Patient Report</p>

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Father's Name</th>
                <th>Mobile</th>
                <th>Age</th>
                <th>Created At</th>
            </tr>
        </thead>
        <tbody>
            @foreach($patients as $patient)
            <tr>
                <td>{{ $patient->id }}</td>
                <td>{{ strtoupper($patient->name) }}</td>
                <td>{{ strtoupper($patient->father_name) }}</td>
                <td>{{ $patient->mobile }}</td>
                <td>{{ $patient->age }}</td>
                <td>{{ $patient->created_at->format('d-m-Y H:i:s') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="print_footer">
        <span class="left">Printed by: {{ Auth::user()->name }}</span>
        <span class="right">Printed at: {{ now()->format('d-m-Y h:i:s A') }}</span>
    </div>

</body>

</html>