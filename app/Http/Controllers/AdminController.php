<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Reception\Patient;
use App\Models\Reception\FeesReceipt;
use App\Models\Reception\ServiceReceipt;
use App\Models\Pharmacy\SaleInvoice;
use App\Models\Pharmacy\Company;
use App\Models\Pharmacy\Supplier;
use App\Models\Pharmacy\Product;
use App\Models\Pharmacy\Stock;
use App\Models\Pharmacy\Purchase;
use App\Models\Pharmacy\ReturnInvoice;
use App\Models\Laboratory\TestResult;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class AdminController extends Controller
{
    public function AdminDashboard() {
        // Overall Counts & Totals
        return view('admin.dash');

       
    } 
    
    
    public function AdminDlashboard() {
        // Overall Counts & Totals
        $totalPatients         = Patient::count();
        $totalFeesReceipts     = FeesReceipt::count();
        $totalServiceReceipts  = ServiceReceipt::count();
        $totalSaleInvoices     = SaleInvoice::count();
        $totalCompanies        = Company::count();
        $totalSuppliers        = Supplier::count();
        $totalProducts         = Product::count();
        $totalStocks           = Stock::count();
        $totalPurchases        = Purchase::count();
        $totalReturnInvoices   = ReturnInvoice::count();
        $totalTestResults      = TestResult::count();

        $totalFeesAmount       = FeesReceipt::sum('total_amount');
        $totalServiceAmount    = ServiceReceipt::sum('total_amount');
        $totalSaleAmount       = SaleInvoice::sum('total_amount');
        $totalPurchaseAmount   = Purchase::sum('total_amount');
        $totalReturnAmount     = ReturnInvoice::sum('total_amount');

        $today     = Carbon::today();
        $yesterday = Carbon::yesterday();
        $lastWeek  = Carbon::now()->subWeek();
        $lastMonth = Carbon::now()->subMonth();
        $thisMonth = Carbon::now()->startOfMonth();
        $lastYear  = Carbon::now()->subYear();

        $todayPatients     = Patient::whereDate('created_at', $today)->count();
        $yesterdayPatients = Patient::whereDate('created_at', $yesterday)->count();
        $lastWeekPatients  = Patient::whereBetween('created_at', [$lastWeek, $today])->count();
        $lastMonthPatients = Patient::whereBetween('created_at', [$lastMonth, $today])->count();
        $thisMonthPatients = Patient::whereBetween('created_at', [$thisMonth, $today])->count();
        $lastYearPatients  = Patient::whereBetween('created_at', [$lastYear, $today])->count();

        // --- Overall Today's Totals (Both Paid & Pending) ---
        $todayFeesAmount     = FeesReceipt::whereDate('created_at', $today)->sum('total_amount');
        $todayServiceAmount  = ServiceReceipt::whereDate('created_at', $today)->sum('total_amount');
        $todaySaleAmount     = SaleInvoice::whereDate('created_at', $today)->sum('total_amount');

        // --- Today's Totals by Payment Status ---
        // Fees Receipts
        $todayFeesAmountPaid    = FeesReceipt::whereDate('created_at', $today)->where('payment_status', 'paid')->sum('total_amount');
        $todayFeesAmountPending = FeesReceipt::whereDate('created_at', $today)->where('payment_status', 'pending')->sum('total_amount');

        // Service Receipts
        $todayServiceAmountPaid    = ServiceReceipt::whereDate('created_at', $today)->where('payment_status', 'paid')->sum('total_amount');
        $todayServiceAmountPending = ServiceReceipt::whereDate('created_at', $today)->where('payment_status', 'pending')->sum('total_amount');

        // Sale Invoices
        $todaySaleAmountPaid    = SaleInvoice::whereDate('created_at', $today)->where('payment_status', 'paid')->sum('total_amount');
        $todaySaleAmountPending = SaleInvoice::whereDate('created_at', $today)->where('payment_status', 'pending')->sum('total_amount');

        // --- Totals for the Month-to-Date (Overall) ---
        $thisMonthFeesAmount    = FeesReceipt::whereBetween('created_at', [$thisMonth, $today])->sum('total_amount');
        $thisMonthServiceAmount = ServiceReceipt::whereBetween('created_at', [$thisMonth, $today])->sum('total_amount');
        $thisMonthSaleAmount    = SaleInvoice::whereBetween('created_at', [$thisMonth, $today])->sum('total_amount');

        // --- Prepare Dynamic Arrays for this Month's Daily Data ---
        $thisMonthDays = [];
        $thisMonthFeesAmounts    = [];
        $thisMonthServiceAmounts = [];
        $thisMonthSaleAmounts    = [];
        
        // Also for Paid & Pending separately:
        $thisMonthFeesAmountsPaid    = [];
        $thisMonthFeesAmountsPending = [];
        $thisMonthServiceAmountsPaid    = [];
        $thisMonthServiceAmountsPending = [];
        $thisMonthSaleAmountsPaid    = [];
        $thisMonthSaleAmountsPending = [];

        for ($date = clone $thisMonth; $date->lte($today); $date->addDay()) {
            $formattedDate = $date->format('Y-m-d');
            $thisMonthDays[] = $formattedDate;

            // Overall totals per day
            $thisMonthFeesAmounts[]    = FeesReceipt::whereDate('created_at', $formattedDate)->sum('total_amount');
            $thisMonthServiceAmounts[] = ServiceReceipt::whereDate('created_at', $formattedDate)->sum('total_amount');
            $thisMonthSaleAmounts[]    = SaleInvoice::whereDate('created_at', $formattedDate)->sum('total_amount');

            // Paid & Pending breakdown for Fees
            $thisMonthFeesAmountsPaid[]    = FeesReceipt::whereDate('created_at', $formattedDate)
                                                ->where('payment_status', 'paid')
                                                ->sum('total_amount');
            $thisMonthFeesAmountsPending[] = FeesReceipt::whereDate('created_at', $formattedDate)
                                                ->where('payment_status', 'pending')
                                                ->sum('total_amount');

            // Paid & Pending breakdown for Service
            $thisMonthServiceAmountsPaid[]    = ServiceReceipt::whereDate('created_at', $formattedDate)
                                                   ->where('payment_status', 'paid')
                                                   ->sum('total_amount');
            $thisMonthServiceAmountsPending[] = ServiceReceipt::whereDate('created_at', $formattedDate)
                                                   ->where('payment_status', 'pending')
                                                   ->sum('total_amount');

            // Paid & Pending breakdown for Sale
            $thisMonthSaleAmountsPaid[]    = SaleInvoice::whereDate('created_at', $formattedDate)
                                                ->where('payment_status', 'paid')
                                                ->sum('total_amount');
            $thisMonthSaleAmountsPending[] = SaleInvoice::whereDate('created_at', $formattedDate)
                                                ->where('payment_status', 'pending')
                                                ->sum('total_amount');
        }

        // --- Yesterday's Totals for Overall ---
        $yesterdayFeesAmount = FeesReceipt::whereDate('created_at', $yesterday)->sum('total_amount');
        $yesterdayServiceAmount = ServiceReceipt::whereDate('created_at', $yesterday)->sum('total_amount');
        $yesterdaySaleAmount = SaleInvoice::whereDate('created_at', $yesterday)->sum('total_amount');

        // --- Overall Percentage Changes (Today vs Yesterday) ---
        $feesPercentageChange = $yesterdayFeesAmount > 0 
            ? (($todayFeesAmount - $yesterdayFeesAmount) / $yesterdayFeesAmount) * 100 
            : ($todayFeesAmount > 0 ? 100 : 0);

        $servicePercentageChange = $yesterdayServiceAmount > 0 
            ? (($todayServiceAmount - $yesterdayServiceAmount) / $yesterdayServiceAmount) * 100 
            : ($todayServiceAmount > 0 ? 100 : 0);

        $salePercentageChange = $yesterdaySaleAmount > 0 
            ? (($todaySaleAmount - $yesterdaySaleAmount) / $yesterdaySaleAmount) * 100 
            : ($todaySaleAmount > 0 ? 100 : 0);

        // --- Yesterday's Totals & Percentage Changes by Payment Status ---
        // Fees Receipts
        $yesterdayFeesAmountPaid = FeesReceipt::whereDate('created_at', $yesterday)
                                    ->where('payment_status', 'paid')->sum('total_amount');
        $feesPercentageChangePaid = $yesterdayFeesAmountPaid > 0 
            ? (($todayFeesAmountPaid - $yesterdayFeesAmountPaid) / $yesterdayFeesAmountPaid) * 100 
            : ($todayFeesAmountPaid > 0 ? 100 : 0);

        $yesterdayFeesAmountPending = FeesReceipt::whereDate('created_at', $yesterday)
                                       ->where('payment_status', 'pending')->sum('total_amount');
        $feesPercentageChangePending = $yesterdayFeesAmountPending > 0 
            ? (($todayFeesAmountPending - $yesterdayFeesAmountPending) / $yesterdayFeesAmountPending) * 100 
            : ($todayFeesAmountPending > 0 ? 100 : 0);

        // Service Receipts
        $yesterdayServiceAmountPaid = ServiceReceipt::whereDate('created_at', $yesterday)
                                        ->where('payment_status', 'paid')->sum('total_amount');
        $servicePercentageChangePaid = $yesterdayServiceAmountPaid > 0 
            ? (($todayServiceAmountPaid - $yesterdayServiceAmountPaid) / $yesterdayServiceAmountPaid) * 100 
            : ($todayServiceAmountPaid > 0 ? 100 : 0);

        $yesterdayServiceAmountPending = ServiceReceipt::whereDate('created_at', $yesterday)
                                           ->where('payment_status', 'pending')->sum('total_amount');
        $servicePercentageChangePending = $yesterdayServiceAmountPending > 0 
            ? (($todayServiceAmountPending - $yesterdayServiceAmountPending) / $yesterdayServiceAmountPending) * 100 
            : ($todayServiceAmountPending > 0 ? 100 : 0);

        // Sale Invoices
        $yesterdaySaleAmountPaid = SaleInvoice::whereDate('created_at', $yesterday)
                                    ->where('payment_status', 'paid')->sum('total_amount');
        $salePercentageChangePaid = $yesterdaySaleAmountPaid > 0 
            ? (($todaySaleAmountPaid - $yesterdaySaleAmountPaid) / $yesterdaySaleAmountPaid) * 100 
            : ($todaySaleAmountPaid > 0 ? 100 : 0);

        $yesterdaySaleAmountPending = SaleInvoice::whereDate('created_at', $yesterday)
                                       ->where('payment_status', 'pending')->sum('total_amount');
        $salePercentageChangePending = $yesterdaySaleAmountPending > 0 
            ? (($todaySaleAmountPending - $yesterdaySaleAmountPending) / $yesterdaySaleAmountPending) * 100 
            : ($todaySaleAmountPending > 0 ? 100 : 0);

        return view('admin.index', compact(
            'totalPatients',
            'totalFeesReceipts',
            'totalServiceReceipts',
            'totalSaleInvoices',
            'totalCompanies',
            'totalSuppliers',
            'totalProducts',
            'totalStocks',
            'totalPurchases',
            'totalReturnInvoices',
            'totalTestResults',
            'totalFeesAmount',
            'totalServiceAmount',
            'totalSaleAmount',
            'totalPurchaseAmount',
            'totalReturnAmount',
            'todayPatients',
            'yesterdayPatients',
            'lastWeekPatients',
            'lastMonthPatients',
            'thisMonthPatients',
            'lastYearPatients',
            // Overall Totals for Today & Month-to-Date
            'todayFeesAmount',
            'thisMonthFeesAmount',
            'todayServiceAmount',
            'thisMonthServiceAmount',
            'todaySaleAmount',
            'thisMonthSaleAmount',
            // Payment Status Totals for Today (Fees)
            'todayFeesAmountPaid',
            'todayFeesAmountPending',
            // Payment Status Totals for Today (Service)
            'todayServiceAmountPaid',
            'todayServiceAmountPending',
            // Payment Status Totals for Today (Sale)
            'todaySaleAmountPaid',
            'todaySaleAmountPending',
            // Percentage Changes Overall
            'feesPercentageChange',
            'servicePercentageChange',
            'salePercentageChange',
            // Percentage Changes by Payment Status (Fees)
            'feesPercentageChangePaid',
            'feesPercentageChangePending',
            // Percentage Changes by Payment Status (Service)
            'servicePercentageChangePaid',
            'servicePercentageChangePending',
            // Percentage Changes by Payment Status (Sale)
            'salePercentageChangePaid',
            'salePercentageChangePending',
            // Arrays for Daily Data (Overall)
            'thisMonthDays',
            'thisMonthFeesAmounts',
            'thisMonthServiceAmounts',
            'thisMonthSaleAmounts',
            // Arrays for Daily Data by Payment Status (Fees)
            'thisMonthFeesAmountsPaid',
            'thisMonthFeesAmountsPending',
            // Arrays for Daily Data by Payment Status (Service)
            'thisMonthServiceAmountsPaid',
            'thisMonthServiceAmountsPending',
            // Arrays for Daily Data by Payment Status (Sale)
            'thisMonthSaleAmountsPaid',
            'thisMonthSaleAmountsPending'
        ));
    } 

    public function searchDashboard(Request $request) {
        $startDate = Carbon::parse($request->start_date)->startOfDay();
        $endDate = Carbon::parse($request->end_date)->endOfDay();

        // Overall Counts & Totals within date range
        $totalPatients = Patient::whereBetween('created_at', [$startDate, $endDate])->count();
        $totalFeesReceipts = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])->count();
        $totalServiceReceipts = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])->count();
        $totalSaleInvoices = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])->count();

        $totalFeesAmount = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
        $totalServiceAmount = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
        $totalSaleAmount = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
        $totalPurchaseAmount = Purchase::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
        $totalReturnAmount = ReturnInvoice::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');

        // Generate dates array for the period
        $thisMonthDays = [];
        $thisMonthFeesAmounts = [];
        $thisMonthServiceAmounts = [];
        $thisMonthSaleAmounts = [];
        
        $thisMonthFeesAmountsPaid = [];
        $thisMonthFeesAmountsPending = [];
        $thisMonthServiceAmountsPaid = [];
        $thisMonthServiceAmountsPending = [];
        $thisMonthSaleAmountsPaid = [];
        $thisMonthSaleAmountsPending = [];

        for ($date = clone $startDate; $date->lte($endDate); $date->addDay()) {
            $formattedDate = $date->format('Y-m-d');
            $thisMonthDays[] = $formattedDate;

            // Overall totals per day
            $thisMonthFeesAmounts[] = FeesReceipt::whereDate('created_at', $formattedDate)->sum('total_amount');
            $thisMonthServiceAmounts[] = ServiceReceipt::whereDate('created_at', $formattedDate)->sum('total_amount');
            $thisMonthSaleAmounts[] = SaleInvoice::whereDate('created_at', $formattedDate)->sum('total_amount');

            // Paid & Pending amounts
            $thisMonthFeesAmountsPaid[] = FeesReceipt::whereDate('created_at', $formattedDate)
                ->where('payment_status', 'paid')
                ->sum('total_amount');
            $thisMonthFeesAmountsPending[] = FeesReceipt::whereDate('created_at', $formattedDate)
                ->where('payment_status', 'pending')
                ->sum('total_amount');

            $thisMonthServiceAmountsPaid[] = ServiceReceipt::whereDate('created_at', $formattedDate)
                ->where('payment_status', 'paid')
                ->sum('total_amount');
            $thisMonthServiceAmountsPending[] = ServiceReceipt::whereDate('created_at', $formattedDate)
                ->where('payment_status', 'pending')
                ->sum('total_amount');

            $thisMonthSaleAmountsPaid[] = SaleInvoice::whereDate('created_at', $formattedDate)
                ->where('payment_status', 'paid')
                ->sum('total_amount');
            $thisMonthSaleAmountsPending[] = SaleInvoice::whereDate('created_at', $formattedDate)
                ->where('payment_status', 'pending')
                ->sum('total_amount');
        }

        // Calculate totals for the range
        $todayFeesAmount = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
        $todayServiceAmount = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
        $todaySaleAmount = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');

        // Paid and Pending totals for the range
        $todayFeesAmountPaid = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])
            ->where('payment_status', 'paid')
            ->sum('total_amount');
        $todayFeesAmountPending = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])
            ->where('payment_status', 'pending')
            ->sum('total_amount');

        $todayServiceAmountPaid = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])
            ->where('payment_status', 'paid')
            ->sum('total_amount');
        $todayServiceAmountPending = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])
            ->where('payment_status', 'pending')
            ->sum('total_amount');

        $todaySaleAmountPaid = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])
            ->where('payment_status', 'paid')
            ->sum('total_amount');
        $todaySaleAmountPending = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])
            ->where('payment_status', 'pending')
            ->sum('total_amount');

        // Calculate percentage changes
        $previousPeriodStart = (clone $startDate)->subDays($endDate->diffInDays($startDate) + 1);
        $previousPeriodEnd = (clone $startDate)->subDay();

        $previousFeesAmount = FeesReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])->sum('total_amount');
        $previousServiceAmount = ServiceReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])->sum('total_amount');
        $previousSaleAmount = SaleInvoice::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])->sum('total_amount');

        $feesPercentageChange = $previousFeesAmount > 0 
            ? (($todayFeesAmount - $previousFeesAmount) / $previousFeesAmount) * 100 
            : ($todayFeesAmount > 0 ? 100 : 0);

        $servicePercentageChange = $previousServiceAmount > 0 
            ? (($todayServiceAmount - $previousServiceAmount) / $previousServiceAmount) * 100 
            : ($todayServiceAmount > 0 ? 100 : 0);

        $salePercentageChange = $previousSaleAmount > 0 
            ? (($todaySaleAmount - $previousSaleAmount) / $previousSaleAmount) * 100 
            : ($todaySaleAmount > 0 ? 100 : 0);

        // Previous period calculations for paid amounts
        $previousFeesAmountPaid = FeesReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
            ->where('payment_status', 'paid')
            ->sum('total_amount');
        $previousServiceAmountPaid = ServiceReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
            ->where('payment_status', 'paid')
            ->sum('total_amount');
        $previousSaleAmountPaid = SaleInvoice::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
            ->where('payment_status', 'paid')
            ->sum('total_amount');

        // Previous period calculations for pending amounts
        $previousFeesAmountPending = FeesReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
            ->where('payment_status', 'pending')
            ->sum('total_amount');
        $previousServiceAmountPending = ServiceReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
            ->where('payment_status', 'pending')
            ->sum('total_amount');
        $previousSaleAmountPending = SaleInvoice::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
            ->where('payment_status', 'pending')
            ->sum('total_amount');

        // Calculate percentage changes for paid amounts
        $feesPercentageChangePaid = $previousFeesAmountPaid > 0 
            ? (($todayFeesAmountPaid - $previousFeesAmountPaid) / $previousFeesAmountPaid) * 100 
            : ($todayFeesAmountPaid > 0 ? 100 : 0);

        $servicePercentageChangePaid = $previousServiceAmountPaid > 0 
            ? (($todayServiceAmountPaid - $previousServiceAmountPaid) / $previousServiceAmountPaid) * 100 
            : ($todayServiceAmountPaid > 0 ? 100 : 0);

        $salePercentageChangePaid = $previousSaleAmountPaid > 0 
            ? (($todaySaleAmountPaid - $previousSaleAmountPaid) / $previousSaleAmountPaid) * 100 
            : ($todaySaleAmountPaid > 0 ? 100 : 0);

        // Calculate percentage changes for pending amounts
        $feesPercentageChangePending = $previousFeesAmountPending > 0 
            ? (($todayFeesAmountPending - $previousFeesAmountPending) / $previousFeesAmountPending) * 100 
            : ($todayFeesAmountPending > 0 ? 100 : 0);

        $servicePercentageChangePending = $previousServiceAmountPending > 0 
            ? (($todayServiceAmountPending - $previousServiceAmountPending) / $previousServiceAmountPending) * 100 
            : ($todayServiceAmountPending > 0 ? 100 : 0);

        $salePercentageChangePending = $previousSaleAmountPending > 0 
            ? (($todaySaleAmountPending - $previousSaleAmountPending) / $previousSaleAmountPending) * 100 
            : ($todaySaleAmountPending > 0 ? 100 : 0);

        return view('admin.index', compact(
            'totalPatients',
            'totalFeesReceipts',
            'totalServiceReceipts',
            'totalSaleInvoices',
            'totalFeesAmount',
            'totalServiceAmount',
            'totalSaleAmount',
            'totalPurchaseAmount',
            'totalReturnAmount',
            'todayFeesAmount',
            'todayServiceAmount',
            'todaySaleAmount',
            'todayFeesAmountPaid',
            'todayFeesAmountPending',
            'todayServiceAmountPaid',
            'todayServiceAmountPending',
            'todaySaleAmountPaid',
            'todaySaleAmountPending',
            'feesPercentageChange',
            'servicePercentageChange',
            'salePercentageChange',
            'feesPercentageChangePaid',
            'feesPercentageChangePending',
            'servicePercentageChangePaid',
            'servicePercentageChangePending',
            'salePercentageChangePaid',
            'salePercentageChangePending',
            'thisMonthDays',
            'thisMonthFeesAmounts',
            'thisMonthServiceAmounts',
            'thisMonthSaleAmounts',
            'thisMonthFeesAmountsPaid',
            'thisMonthFeesAmountsPending',
            'thisMonthServiceAmountsPaid',
            'thisMonthServiceAmountsPending',
            'thisMonthSaleAmountsPaid',
            'thisMonthSaleAmountsPending'
        ));
    }

    public function AdminProfile() {
        $id = Auth::user()->id;
        $profileData = User::find($id);
        return view('admin.admin_profile', compact('profileData'));
    } // End AdminProfile Method

    public function AdminProfileStore(Request $request): RedirectResponse {
        $id = Auth::user()->id;
        $data = User::find($id);

        $data->name     = $request->name;
        $data->username = $request->username;
        $data->email    = $request->email;
        $data->phone    = $request->phone;
        $data->address  = $request->address;

        if ($request->file('photo')) {
            $file = $request->file('photo');
            @unlink(public_path('upload/admin_images/' . $data->photo));
            $filename = date('YmdHi') . $file->getClientOriginalName();
            $file->move(public_path('upload/admin_images/'), $filename);
            $data['photo'] = $filename;
        }

        $data->save();

        $notification = [
            'message'    => 'Profile Updated Successfully!',
            'alert-type' => 'success'
        ];

        return redirect()->back()->with($notification);
    } // End AdminProfileStore Method

    public function AdminChangePassword() {
        $id = Auth::user()->id;
        $profileData = User::find($id);
        return view('admin.admin_change_password', compact('profileData'));
    } // End AdminChangePassword Method

    public function AdminUpdatePassword(Request $request): RedirectResponse {
        $request->validate([
            'old_password' => 'required',
            'new_password' => 'required|confirmed',
        ]);

        if (!Hash::check($request->old_password, Auth::user()->password)) {
            $notification = [
                'message'    => 'Old Password Not Matched!',
                'alert-type' => 'error'
            ];
            return redirect()->back()->with($notification);
        }

        User::whereId(Auth::user()->id)->update([
            'password' => Hash::make($request->new_password)
        ]);

        $notification = [
            'message'    => 'Password Changed Successfully!',
            'alert-type' => 'success'
        ];

        return redirect()->back()->with($notification);
    } // End AdminUpdatePassword Method

    public function AdminLogin() {
        return view('admin.admin_login');
    } // End AdminLogin Method

    public function AdminLogout(Request $request): RedirectResponse {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect('/');
    } // End AdminLogout Method
}
