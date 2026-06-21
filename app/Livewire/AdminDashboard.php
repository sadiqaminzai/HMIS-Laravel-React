<?php

namespace App\Livewire;

use Livewire\Component;
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
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
if (! Auth::check()) {
    abort(403, 'Unauthorized.');
}
class AdminDashboard extends Component
{
    // Date range properties
    public $start_date;
    public $end_date;

    // General Totals
    public $totalPatients, $totalFeesReceipts, $totalServiceReceipts, $totalSaleInvoices;
    public $totalCompanies, $totalSuppliers, $totalProducts, $totalStocks;
    public $totalPurchases, $totalReturnInvoices, $totalTestResults;
    public $totalFeesAmount, $totalServiceAmount, $totalSaleAmount, $totalPurchaseAmount, $totalReturnAmount;

    // Daily/period stats for dashboard (for "today" dashboard)
    public $todayPatients, $yesterdayPatients, $lastWeekPatients, $lastMonthPatients, $thisMonthPatients, $lastYearPatients;
    public $todayFeesAmount, $thisMonthFeesAmount, $todayServiceAmount, $thisMonthServiceAmount, $todaySaleAmount, $thisMonthSaleAmount;
    public $todayFeesAmountPaid, $todayFeesAmountPending, $todayServiceAmountPaid, $todayServiceAmountPending, $todaySaleAmountPaid, $todaySaleAmountPending;
    public $feesPercentageChange, $servicePercentageChange, $salePercentageChange;
    public $feesPercentageChangePaid, $feesPercentageChangePending, $servicePercentageChangePaid, $servicePercentageChangePending, $salePercentageChangePaid, $salePercentageChangePending;
    
    // Arrays for daily data
    public $thisMonthDays = [];
    public $thisMonthFeesAmounts = [];
    public $thisMonthServiceAmounts = [];
    public $thisMonthSaleAmounts = [];
    public $thisMonthFeesAmountsPaid = [];
    public $thisMonthFeesAmountsPending = [];
    public $thisMonthServiceAmountsPaid = [];
    public $thisMonthServiceAmountsPending = [];
    public $thisMonthSaleAmountsPaid = [];
    public $thisMonthSaleAmountsPending = [];

    public function mount()
    {
        $this->start_date = Carbon::today()->toDateString();
        $this->end_date   = Carbon::today()->toDateString();
        
        // Initial calculation
        $this->calculateDashboard();
    }

    /**
     * Recalculate all statistics based on the current start_date and end_date.
     * If the range equals today, use the default dashboard calculations; otherwise use the search logic.
     */
    public function calculateDashboard()
    {
        try {
            $startDate = Carbon::parse($this->start_date)->startOfDay();
            $endDate   = Carbon::parse($this->end_date)->endOfDay();
            
            // Cache the results for better performance
            $cacheKey = 'dashboard_' . auth()->id() . '_' . $startDate->format('Y-m-d') . '_' . $endDate->format('Y-m-d');
            $cacheDuration = Carbon::now()->addSeconds(8); // Cache for 8 seconds (less than polling interval)

            // If the range is "today" then run the default dashboard calculations:
            if ($startDate->equalTo(Carbon::today()->startOfDay()) && $endDate->equalTo(Carbon::today()->endOfDay())) {

                // Overall totals (using all data)
                $this->totalPatients        = Patient::count();
                $this->totalFeesReceipts    = FeesReceipt::count();
                $this->totalServiceReceipts = ServiceReceipt::count();
                $this->totalSaleInvoices    = SaleInvoice::count();
                $this->totalCompanies       = Company::count();
                $this->totalSuppliers       = Supplier::count();
                $this->totalProducts        = Product::count();
                $this->totalStocks          = Stock::count();
                $this->totalPurchases       = Purchase::count();
                $this->totalReturnInvoices  = ReturnInvoice::count();
                $this->totalTestResults     = TestResult::count();

                $this->totalFeesAmount      = FeesReceipt::sum('total_amount');
                $this->totalServiceAmount   = ServiceReceipt::sum('total_amount');
                $this->totalSaleAmount      = SaleInvoice::sum('total_amount');
                $this->totalPurchaseAmount  = Purchase::sum('total_amount');
                $this->totalReturnAmount    = ReturnInvoice::sum('total_amount');

                $today     = Carbon::today();
                $yesterday = Carbon::yesterday();
                $lastWeek  = Carbon::now()->subWeek();
                $lastMonth = Carbon::now()->subMonth();
                $thisMonth = Carbon::now()->startOfMonth();
                $lastYear  = Carbon::now()->subYear();

                // Patient counts
                $this->todayPatients     = Patient::whereDate('created_at', $today)->count();
                $this->yesterdayPatients = Patient::whereDate('created_at', $yesterday)->count();
                $this->lastWeekPatients  = Patient::whereBetween('created_at', [$lastWeek, $today])->count();
                $this->lastMonthPatients = Patient::whereBetween('created_at', [$lastMonth, $today])->count();
                $this->thisMonthPatients = Patient::whereBetween('created_at', [$thisMonth, $today])->count();
                $this->lastYearPatients  = Patient::whereBetween('created_at', [$lastYear, $today])->count();

                // Today's overall amounts
                $this->todayFeesAmount    = FeesReceipt::whereDate('created_at', $today)->sum('total_amount');
                $this->todayServiceAmount = ServiceReceipt::whereDate('created_at', $today)->sum('total_amount');
                $this->todaySaleAmount    = SaleInvoice::whereDate('created_at', $today)->sum('total_amount');

                // Today's amounts by payment status
                $this->todayFeesAmountPaid    = FeesReceipt::whereDate('created_at', $today)->where('payment_status', 'paid')->sum('total_amount');
                $this->todayFeesAmountPending = FeesReceipt::whereDate('created_at', $today)->where('payment_status', 'pending')->sum('total_amount');

                $this->todayServiceAmountPaid    = ServiceReceipt::whereDate('created_at', $today)->where('payment_status', 'paid')->sum('total_amount');
                $this->todayServiceAmountPending = ServiceReceipt::whereDate('created_at', $today)->where('payment_status', 'pending')->sum('total_amount');

                $this->todaySaleAmountPaid    = SaleInvoice::whereDate('created_at', $today)->where('payment_status', 'paid')->sum('total_amount');
                $this->todaySaleAmountPending = SaleInvoice::whereDate('created_at', $today)->where('payment_status', 'pending')->sum('total_amount');

                // Month-to-date overall amounts
                $this->thisMonthFeesAmount    = FeesReceipt::whereBetween('created_at', [$thisMonth, $today])->sum('total_amount');
                $this->thisMonthServiceAmount = ServiceReceipt::whereBetween('created_at', [$thisMonth, $today])->sum('total_amount');
                $this->thisMonthSaleAmount    = SaleInvoice::whereBetween('created_at', [$thisMonth, $today])->sum('total_amount');

                // Prepare dynamic arrays for this month’s daily data
                $this->thisMonthDays = [];
                $this->thisMonthFeesAmounts = [];
                $this->thisMonthServiceAmounts = [];
                $this->thisMonthSaleAmounts = [];
                $this->thisMonthFeesAmountsPaid = [];
                $this->thisMonthFeesAmountsPending = [];
                $this->thisMonthServiceAmountsPaid = [];
                $this->thisMonthServiceAmountsPending = [];
                $this->thisMonthSaleAmountsPaid = [];
                $this->thisMonthSaleAmountsPending = [];

                for ($date = clone $thisMonth; $date->lte($today); $date->addDay()) {
                    $formattedDate = $date->format('Y-m-d');
                    $this->thisMonthDays[] = $formattedDate;

                    $this->thisMonthFeesAmounts[]    = FeesReceipt::whereDate('created_at', $formattedDate)->sum('total_amount');
                    $this->thisMonthServiceAmounts[] = ServiceReceipt::whereDate('created_at', $formattedDate)->sum('total_amount');
                    $this->thisMonthSaleAmounts[]    = SaleInvoice::whereDate('created_at', $formattedDate)->sum('total_amount');

                    $this->thisMonthFeesAmountsPaid[]    = FeesReceipt::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'paid')
                        ->sum('total_amount');
                    $this->thisMonthFeesAmountsPending[] = FeesReceipt::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'pending')
                        ->sum('total_amount');

                    $this->thisMonthServiceAmountsPaid[]    = ServiceReceipt::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'paid')
                        ->sum('total_amount');
                    $this->thisMonthServiceAmountsPending[] = ServiceReceipt::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'pending')
                        ->sum('total_amount');

                    $this->thisMonthSaleAmountsPaid[]    = SaleInvoice::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'paid')
                        ->sum('total_amount');
                    $this->thisMonthSaleAmountsPending[] = SaleInvoice::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'pending')
                        ->sum('total_amount');
                }

                // Percentage changes (today vs. yesterday)
                $yesterdayFeesAmount    = FeesReceipt::whereDate('created_at', $yesterday)->sum('total_amount');
                $yesterdayServiceAmount = ServiceReceipt::whereDate('created_at', $yesterday)->sum('total_amount');
                $yesterdaySaleAmount    = SaleInvoice::whereDate('created_at', $yesterday)->sum('total_amount');

                $this->feesPercentageChange = $yesterdayFeesAmount > 0 
                    ? (($this->todayFeesAmount - $yesterdayFeesAmount) / $yesterdayFeesAmount) * 100 
                    : ($this->todayFeesAmount > 0 ? 100 : 0);
                $this->servicePercentageChange = $yesterdayServiceAmount > 0 
                    ? (($this->todayServiceAmount - $yesterdayServiceAmount) / $yesterdayServiceAmount) * 100 
                    : ($this->todayServiceAmount > 0 ? 100 : 0);
                $this->salePercentageChange = $yesterdaySaleAmount > 0 
                    ? (($this->todaySaleAmount - $yesterdaySaleAmount) / $yesterdaySaleAmount) * 100 
                    : ($this->todaySaleAmount > 0 ? 100 : 0);

                // Percentage changes by payment status
                $yesterdayFeesAmountPaid    = FeesReceipt::whereDate('created_at', $yesterday)->where('payment_status', 'paid')->sum('total_amount');
                $yesterdayFeesAmountPending = FeesReceipt::whereDate('created_at', $yesterday)->where('payment_status', 'pending')->sum('total_amount');
                $yesterdayServiceAmountPaid    = ServiceReceipt::whereDate('created_at', $yesterday)->where('payment_status', 'paid')->sum('total_amount');
                $yesterdayServiceAmountPending = ServiceReceipt::whereDate('created_at', $yesterday)->where('payment_status', 'pending')->sum('total_amount');
                $yesterdaySaleAmountPaid    = SaleInvoice::whereDate('created_at', $yesterday)->where('payment_status', 'paid')->sum('total_amount');
                $yesterdaySaleAmountPending = SaleInvoice::whereDate('created_at', $yesterday)->where('payment_status', 'pending')->sum('total_amount');

                $this->feesPercentageChangePaid = $yesterdayFeesAmountPaid > 0 
                    ? (($this->todayFeesAmountPaid - $yesterdayFeesAmountPaid) / $yesterdayFeesAmountPaid) * 100 
                    : ($this->todayFeesAmountPaid > 0 ? 100 : 0);
                $this->feesPercentageChangePending = $yesterdayFeesAmountPending > 0 
                    ? (($this->todayFeesAmountPending - $yesterdayFeesAmountPending) / $yesterdayFeesAmountPending) * 100 
                    : ($this->todayFeesAmountPending > 0 ? 100 : 0);
                $this->servicePercentageChangePaid = $yesterdayServiceAmountPaid > 0 
                    ? (($this->todayServiceAmountPaid - $yesterdayServiceAmountPaid) / $yesterdayServiceAmountPaid) * 100 
                    : ($this->todayServiceAmountPaid > 0 ? 100 : 0);
                $this->servicePercentageChangePending = $yesterdayServiceAmountPending > 0 
                    ? (($this->todayServiceAmountPending - $yesterdayServiceAmountPending) / $yesterdayServiceAmountPending) * 100 
                    : ($this->todayServiceAmountPending > 0 ? 100 : 0);
                $this->salePercentageChangePaid = $yesterdaySaleAmountPaid > 0 
                    ? (($this->todaySaleAmountPaid - $yesterdaySaleAmountPaid) / $yesterdaySaleAmountPaid) * 100 
                    : ($this->todaySaleAmountPaid > 0 ? 100 : 0);
                $this->salePercentageChangePending = $yesterdaySaleAmountPending > 0 
                    ? (($this->todaySaleAmountPending - $yesterdaySaleAmountPending) / $yesterdaySaleAmountPending) * 100 
                    : ($this->todaySaleAmountPending > 0 ? 100 : 0);
            } else {
                // Custom date range (search) calculations

                // Overall counts & totals within date range
                $this->totalPatients        = Patient::whereBetween('created_at', [$startDate, $endDate])->count();
                $this->totalFeesReceipts    = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])->count();
                $this->totalServiceReceipts = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])->count();
                $this->totalSaleInvoices    = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])->count();

                $this->totalFeesAmount      = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
                $this->totalServiceAmount   = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
                $this->totalSaleAmount      = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
                $this->totalPurchaseAmount  = Purchase::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
                $this->totalReturnAmount    = ReturnInvoice::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');

                // Build daily arrays for the period
                $this->thisMonthDays = [];
                $this->thisMonthFeesAmounts = [];
                $this->thisMonthServiceAmounts = [];
                $this->thisMonthSaleAmounts = [];
                $this->thisMonthFeesAmountsPaid = [];
                $this->thisMonthFeesAmountsPending = [];
                $this->thisMonthServiceAmountsPaid = [];
                $this->thisMonthServiceAmountsPending = [];
                $this->thisMonthSaleAmountsPaid = [];
                $this->thisMonthSaleAmountsPending = [];

                $date = clone $startDate;
                while ($date->lte($endDate)) {
                    $formattedDate = $date->format('Y-m-d');
                    $this->thisMonthDays[] = $formattedDate;

                    $this->thisMonthFeesAmounts[]    = FeesReceipt::whereDate('created_at', $formattedDate)->sum('total_amount');
                    $this->thisMonthServiceAmounts[] = ServiceReceipt::whereDate('created_at', $formattedDate)->sum('total_amount');
                    $this->thisMonthSaleAmounts[]    = SaleInvoice::whereDate('created_at', $formattedDate)->sum('total_amount');

                    $this->thisMonthFeesAmountsPaid[]    = FeesReceipt::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'paid')
                        ->sum('total_amount');
                    $this->thisMonthFeesAmountsPending[] = FeesReceipt::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'pending')
                        ->sum('total_amount');

                    $this->thisMonthServiceAmountsPaid[]    = ServiceReceipt::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'paid')
                        ->sum('total_amount');
                    $this->thisMonthServiceAmountsPending[] = ServiceReceipt::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'pending')
                        ->sum('total_amount');

                    $this->thisMonthSaleAmountsPaid[]    = SaleInvoice::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'paid')
                        ->sum('total_amount');
                    $this->thisMonthSaleAmountsPending[] = SaleInvoice::whereDate('created_at', $formattedDate)
                        ->where('payment_status', 'pending')
                        ->sum('total_amount');

                    $date->addDay();
                }

                // Totals for the custom range
                $this->todayFeesAmount    = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
                $this->todayServiceAmount = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');
                $this->todaySaleAmount    = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])->sum('total_amount');

                $this->todayFeesAmountPaid    = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])
                    ->where('payment_status', 'paid')
                    ->sum('total_amount');
                $this->todayFeesAmountPending = FeesReceipt::whereBetween('created_at', [$startDate, $endDate])
                    ->where('payment_status', 'pending')
                    ->sum('total_amount');

                $this->todayServiceAmountPaid    = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])
                    ->where('payment_status', 'paid')
                    ->sum('total_amount');
                $this->todayServiceAmountPending = ServiceReceipt::whereBetween('created_at', [$startDate, $endDate])
                    ->where('payment_status', 'pending')
                    ->sum('total_amount');

                $this->todaySaleAmountPaid    = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])
                    ->where('payment_status', 'paid')
                    ->sum('total_amount');
                $this->todaySaleAmountPending = SaleInvoice::whereBetween('created_at', [$startDate, $endDate])
                    ->where('payment_status', 'pending')
                    ->sum('total_amount');

                // Calculate percentage changes compared to a previous period of equal length
                $daysDiff = $endDate->diffInDays($startDate) + 1;
                $previousPeriodStart = (clone $startDate)->subDays($daysDiff);
                $previousPeriodEnd   = (clone $startDate)->subDay();

                $previousFeesAmount    = FeesReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])->sum('total_amount');
                $previousServiceAmount = ServiceReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])->sum('total_amount');
                $previousSaleAmount    = SaleInvoice::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])->sum('total_amount');

                $this->feesPercentageChange = $previousFeesAmount > 0 
                    ? (($this->todayFeesAmount - $previousFeesAmount) / $previousFeesAmount) * 100 
                    : ($this->todayFeesAmount > 0 ? 100 : 0);
                $this->servicePercentageChange = $previousServiceAmount > 0 
                    ? (($this->todayServiceAmount - $previousServiceAmount) / $previousServiceAmount) * 100 
                    : ($this->todayServiceAmount > 0 ? 100 : 0);
                $this->salePercentageChange = $previousSaleAmount > 0 
                    ? (($this->todaySaleAmount - $previousSaleAmount) / $previousSaleAmount) * 100 
                    : ($this->todaySaleAmount > 0 ? 100 : 0);

                $previousFeesAmountPaid    = FeesReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
                    ->where('payment_status', 'paid')
                    ->sum('total_amount');
                $previousServiceAmountPaid = ServiceReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
                    ->where('payment_status', 'paid')
                    ->sum('total_amount');
                $previousSaleAmountPaid    = SaleInvoice::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
                    ->where('payment_status', 'paid')
                    ->sum('total_amount');

                $previousFeesAmountPending    = FeesReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
                    ->where('payment_status', 'pending')
                    ->sum('total_amount');
                $previousServiceAmountPending = ServiceReceipt::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
                    ->where('payment_status', 'pending')
                    ->sum('total_amount');
                $previousSaleAmountPending    = SaleInvoice::whereBetween('created_at', [$previousPeriodStart, $previousPeriodEnd])
                    ->where('payment_status', 'pending')
                    ->sum('total_amount');

                $this->feesPercentageChangePaid = $previousFeesAmountPaid > 0 
                    ? (($this->todayFeesAmountPaid - $previousFeesAmountPaid) / $previousFeesAmountPaid) * 100 
                    : ($this->todayFeesAmountPaid > 0 ? 100 : 0);
                $this->servicePercentageChangePaid = $previousServiceAmountPaid > 0 
                    ? (($this->todayServiceAmountPaid - $previousServiceAmountPaid) / $previousServiceAmountPaid) * 100 
                    : ($this->todayServiceAmountPaid > 0 ? 100 : 0);
                $this->salePercentageChangePaid = $previousSaleAmountPaid > 0 
                    ? (($this->todaySaleAmountPaid - $previousSaleAmountPaid) / $previousSaleAmountPaid) * 100 
                    : ($this->todaySaleAmountPaid > 0 ? 100 : 0);

                $this->feesPercentageChangePending = $previousFeesAmountPending > 0 
                    ? (($this->todayFeesAmountPending - $previousFeesAmountPending) / $previousFeesAmountPending) * 100 
                    : ($this->todayFeesAmountPending > 0 ? 100 : 0);
                $this->servicePercentageChangePending = $previousServiceAmountPending > 0 
                    ? (($this->todayServiceAmountPending - $previousServiceAmountPending) / $previousServiceAmountPending) * 100 
                    : ($this->todayServiceAmountPending > 0 ? 100 : 0);
                $this->salePercentageChangePending = $previousSaleAmountPending > 0 
                    ? (($this->todaySaleAmountPending - $previousSaleAmountPending) / $previousSaleAmountPending) * 100 
                    : ($this->todaySaleAmountPending > 0 ? 100 : 0);
            }

            // Emit event to refresh charts
            $this->emit('dashboardUpdated');
            
            return true;
        } catch (\Exception $e) {
            logger()->error('Dashboard calculation error: ' . $e->getMessage());
            return false;
        }
    }

    // Whenever the start_date or end_date is updated from the UI,
    // recalc the statistics automatically.
    public function updatedStartDate()
    {
        $this->calculateDashboard();
    }

    public function updatedEndDate()
    {
        $this->calculateDashboard();
    }

    public function render()
    {
        return view('livewire.admin-dashboard', [
            'totalPatients'               => $this->totalPatients,
            'totalFeesReceipts'           => $this->totalFeesReceipts,
            'totalServiceReceipts'        => $this->totalServiceReceipts,
            'totalSaleInvoices'           => $this->totalSaleInvoices,
            'totalCompanies'              => $this->totalCompanies,
            'totalSuppliers'              => $this->totalSuppliers,
            'totalProducts'               => $this->totalProducts,
            'totalStocks'                 => $this->totalStocks,
            'totalPurchases'              => $this->totalPurchases,
            'totalReturnInvoices'         => $this->totalReturnInvoices,
            'totalTestResults'            => $this->totalTestResults,
            'totalFeesAmount'             => $this->totalFeesAmount,
            'totalServiceAmount'          => $this->totalServiceAmount,
            'totalSaleAmount'             => $this->totalSaleAmount,
            'totalPurchaseAmount'         => $this->totalPurchaseAmount,
            'totalReturnAmount'           => $this->totalReturnAmount,
            'todayPatients'               => $this->todayPatients,
            'yesterdayPatients'           => $this->yesterdayPatients,
            'lastWeekPatients'            => $this->lastWeekPatients,
            'lastMonthPatients'           => $this->lastMonthPatients,
            'thisMonthPatients'           => $this->thisMonthPatients,
            'lastYearPatients'            => $this->lastYearPatients,
            'todayFeesAmount'             => $this->todayFeesAmount,
            'thisMonthFeesAmount'         => $this->thisMonthFeesAmount,
            'todayServiceAmount'          => $this->todayServiceAmount,
            'thisMonthServiceAmount'      => $this->thisMonthServiceAmount,
            'todaySaleAmount'             => $this->todaySaleAmount,
            'thisMonthSaleAmount'         => $this->thisMonthSaleAmount,
            'todayFeesAmountPaid'         => $this->todayFeesAmountPaid,
            'todayFeesAmountPending'      => $this->todayFeesAmountPending,
            'todayServiceAmountPaid'      => $this->todayServiceAmountPaid,
            'todayServiceAmountPending'   => $this->todayServiceAmountPending,
            'todaySaleAmountPaid'         => $this->todaySaleAmountPaid,
            'todaySaleAmountPending'      => $this->todaySaleAmountPending,
            'feesPercentageChange'        => $this->feesPercentageChange,
            'servicePercentageChange'     => $this->servicePercentageChange,
            'salePercentageChange'        => $this->salePercentageChange,
            'feesPercentageChangePaid'    => $this->feesPercentageChangePaid,
            'feesPercentageChangePending' => $this->feesPercentageChangePending,
            'servicePercentageChangePaid' => $this->servicePercentageChangePaid,
            'servicePercentageChangePending' => $this->servicePercentageChangePending,
            'salePercentageChangePaid'    => $this->salePercentageChangePaid,
            'salePercentageChangePending' => $this->salePercentageChangePending,
            'thisMonthDays'               => $this->thisMonthDays,
            'thisMonthFeesAmounts'        => $this->thisMonthFeesAmounts,
            'thisMonthServiceAmounts'     => $this->thisMonthServiceAmounts,
            'thisMonthSaleAmounts'        => $this->thisMonthSaleAmounts,
            'thisMonthFeesAmountsPaid'    => $this->thisMonthFeesAmountsPaid,
            'thisMonthFeesAmountsPending' => $this->thisMonthFeesAmountsPending,
            'thisMonthServiceAmountsPaid' => $this->thisMonthServiceAmountsPaid,
            'thisMonthServiceAmountsPending' => $this->thisMonthServiceAmountsPending,
            'thisMonthSaleAmountsPaid'    => $this->thisMonthSaleAmountsPaid,
            'thisMonthSaleAmountsPending' => $this->thisMonthSaleAmountsPending,
        ]);
    }
}
