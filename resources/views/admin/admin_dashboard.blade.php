<!DOCTYPE html>

<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta name="description" content="Responsive HTML Admin Dashboard Template based on Bootstrap 5">
    <meta name="author" content="NobleUI">
    <meta name="keywords" content="nobleui, bootstrap, bootstrap 5, bootstrap5, admin, dashboard, template, responsive, css, sass, html, theme, front-end, ui kit, web">

    <title>Admin Panel - HMIS</title>
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <!-- End fonts -->
    <!--cdn.datatables.net/2.1.8/css/dataTables.dataTables.min.css-->
    <link rel="stylesheet" href="https://cdn.datatables.net/2.1.8/css/dataTables.dataTables.min.css">
    <!-- Load jQuery -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

    <!-- Load DataTables -->
    <!--cdn.datatables.net/2.1.8/js/dataTables.min.js-->
    <script src="https://cdn.datatables.net/2.1.8/js/dataTables.min.js"></script>

    <!-- core:css -->
    <link rel="stylesheet" href="{{ asset('backend/assets/vendors/core/core.css') }}">
    <!-- endinject -->

    <!-- Plugin css for this page -->
    <link rel="stylesheet" href="{{ asset('backend/assets/vendors/flatpickr/flatpickr.min.css') }}">
    <!-- End plugin css for this page -->

    <!-- inject:css -->
    <link rel="stylesheet" href="{{ asset('backend/assets/fonts/feather-font/css/iconfont.css') }}">
    <link rel="stylesheet" href="{{ asset('backend/assets/vendors/flag-icon-css/css/flag-icon.min.css') }}">
    <!-- endinject -->

    <!-- Layout styles -->
    <link rel="stylesheet" href="{{ asset('backend/assets/css/demo2/style.css') }}">
    <!-- End layout styles -->

    <!-- jquery:js -->
    <script src="{{ asset('backend/assets/js/jquery.min.js') }}"></script>
    <!-- jqueryForImage -->

    <link rel="shortcut icon" href="{{ asset('backend/assets/images/favicon.png') }}" />

    <!-- toaster:css Notification -->
    <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.css">

    <!-- <link rel="stylesheet" type="text/css" href="{{ asset('backend/assets/toastr/toastr.css') }}" /> -->
    <!-- toaster:css Notification -->

    <!-- For any print area using below class  should be added in the print area -->
    <style>
        @media print {
            body {
                background-color: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact;
            }
            #printableContent {
                background-color: white !important;
                color: black !important;
                width: 100% !important;
                padding: 10px !important;
                margin: 0 !important;
                border: none !important;
            }
        }
    </style>

    @livewireStyles

</head>

<body>
    <div class="main-wrapper">

        <!-- partial:partials/_sidebar.html (Sidebar)-->
        @include('admin.layout.sidebar')

        <!-- partial -->

        <div class="page-wrapper">

            <!-- partial:partials/_navbar.html (Header)-->
            @include('admin.layout.header')
            <!-- partial -->

            @yield('admin')

            <!-- partial:partials/_footer.html (Footer)-->
            @include('admin.layout.footer')
            <!-- partial -->

        </div>
    </div>

    <!-- core:js -->
    <script src="{{ asset('backend/assets/vendors/core/core.js') }}"></script>
    <!-- endinject -->

    <!-- Plugin js for this page -->
    <script src="{{ asset('backend/assets/vendors/flatpickr/flatpickr.min.js') }}"></script>
    <script src="{{ asset('backend/assets/vendors/apexcharts/apexcharts.min.js') }}"></script>
    <!-- End plugin js for this page -->

    <!-- inject:js -->
    <script src="{{ asset('backend/assets/vendors/feather-icons/feather.min.js') }}"></script>
    <script src="{{ asset('backend/assets/js/template.js') }}"></script>
    <!-- endinject -->

    <!-- Custom js for this page -->
    <script src="{{ asset('backend/assets/js/dashboard-dark.js') }}"></script>
    <!-- End custom js for this page -->

    <!-- Custom js for this page -->
    <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>

    <!-- <script type="text/javascript" src="{{ asset('backend/assets/js/toastr.js') }}"></script> -->
    <!-- End custom js for this page -->

    <!-- Please add javascript toaster code -->

    <!-- for laravel blades notification -->
    <script>
        @if(Session::has('message'))
        var type = "{{ Session::get('alert-type','info') }}"
        switch (type) {
            case 'info':
                toastr.info(" {{ Session::get('message') }} ");
                break;

            case 'success':
                toastr.success(" {{ Session::get('message') }} ");
                break;

            case 'warning':
                toastr.warning(" {{ Session::get('message') }} ");
                break;

            case 'error':
                toastr.error(" {{ Session::get('message') }} ");
                break;
        }
        @endif
    </script>

    <!-- for livewire blades notification -->
    <script>
        toastr.options = {
            "progressBar": true,
            "positionClass": "toast-top-right"
        }

        window.addEventListener('success', event => {
            toastr.success(event.detail.message);
        });

        window.addEventListener('warning', event => {
            toastr.warning(event.detail.message);
        });

        window.addEventListener('error', event => {
            toastr.error(event.detail.message);
        });
    </script>

    @livewireScripts

</body>

</html>
