<?php

namespace App\Livewire\Pharmacy;

use App\Models\Pharmacy\Product;
use App\Models\Pharmacy\Stock as PharmacyStock;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;
use Barryvdh\DomPDF\PDF;
use Maatwebsite\Excel\Facades\Excel;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class StockQuantityReport extends Component
{
    use WithFileUploads, WithPagination;

    // Stock fields
    public $product_id, $batch_no, $threshold_type = '';

    // Search by: Product, Category, Batch No, Stock Status
    public $searchByProduct = '', $searchByCategory = '', $searchByBatchNo = '', $searchByStockStatus = '';
    public $searchResults = [];

    // Dynamic search fields
    public $search = '';
    public $isOpen = 0;
    public $selectedStock;
    public $sortField = 'quantity';
    public $sortDirection = 'asc';

    protected $paginationTheme = 'bootstrap';

    public function mount()
    {
        // Initialize with default values if needed
    }

    public function searchDetails()
    {
        $query = PharmacyStock::select('product_id', DB::raw('SUM(quantity) as total_quantity'))
            ->with(['product', 'user'])
            ->groupBy('product_id');

        if (!empty($this->searchByProduct)) {
            $query->where('product_id', $this->searchByProduct);
        }

        if (!empty($this->searchByBatchNo)) {
            $query->where('batch_no', $this->searchByBatchNo);
        }

        if (!empty($this->searchByCategory)) {
            $query->whereHas('product', function ($q) {
                $q->where('category_id', $this->searchByCategory);
            });
        }

        if (!empty($this->searchByStockStatus)) {
            $query = $this->applyStockStatusFilter($query, $this->searchByStockStatus);
        }

        $stockData = $query->get();
        
        // Add additional product information to each stock entry
        $this->searchResults = $stockData->map(function ($item) {
            $product = Product::find($item->product_id);
            $item->product_name = $product->name ?? 'N/A';
            $item->reorder_level = $product->reorder_level ?? 0;
            $item->ideal_stock = $product->ideal_stock ?? 0;
            $item->max_stock = $product->max_stock ?? 0;
            $item->status = $this->getStockStatus($item->total_quantity, $product);
            $item->status_class = $this->getStockStatusClass($item->status);
            
            return $item;
        });

        $this->dispatch('open-modal', 'searchModal');
    }

    public function closeSearchModal()
    {
        $this->selectedStock = null;
        $this->dispatch('close-modal', 'searchModal');
    }

    public function resetFilters()
    {
        $this->searchByProduct = '';
        $this->searchByCategory = '';
        $this->searchByBatchNo = '';
        $this->searchByStockStatus = '';
        $this->selectedStock = null;
        $this->searchResults = [];
        $this->search = '';
    }

    public function showDetails($productId)
    {
        $this->selectedStock = PharmacyStock::with(['product', 'user'])
            ->where('product_id', $productId)
            ->get();
            
        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeDetailsModal()
    {
        $this->selectedStock = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function sortBy($field)
    {
        if ($this->sortField === $field) {
            $this->sortDirection = $this->sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            $this->sortField = $field;
            $this->sortDirection = 'asc';
        }
    }

    public function render()
    {
        $products = Product::where('is_active', 1)->get();
        // Remove Category model reference
        
        // Build the query for stock quantity info
        $query = PharmacyStock::select('product_id', DB::raw('SUM(quantity) as total_quantity'))
            ->with(['product', 'user'])
            ->groupBy('product_id');

        // Add a search filter
        if ($this->search) {
            $query->whereHas('product', function ($subQuery) {
                $subQuery->where('name', 'like', '%' . $this->search . '%');
            });
        }

        // Order by the selected field
        $stockData = $query->get();
        
        // Add additional product information to each stock entry and apply sorting in PHP
        $stocks = $stockData->map(function ($item) {
            $product = Product::find($item->product_id);
            $item->product_name = $product->name ?? 'N/A';
            $item->reorder_level = $product->reorder_level ?? 0;
            $item->ideal_stock = $product->ideal_stock ?? 0;
            $item->max_stock = $product->max_stock ?? 0;
            $item->status = $this->getStockStatus($item->total_quantity, $product);
            $item->status_class = $this->getStockStatusClass($item->status);
            
            return $item;
        });

        // Apply sorting in PHP
        if ($this->sortField === 'product_name') {
            $stocks = $stocks->sortBy('product_name', SORT_NATURAL, $this->sortDirection === 'desc');
        } elseif ($this->sortField === 'total_quantity') {
            $stocks = $stocks->sortBy('total_quantity', SORT_NATURAL, $this->sortDirection === 'desc');
        } elseif ($this->sortField === 'status') {
            $stocks = $stocks->sortBy('status', SORT_NATURAL, $this->sortDirection === 'desc');
        }

        // Calculate stock statistics
        $outOfStockCount = $stocks->where('total_quantity', 0)->count();
        $lowStockCount = $stocks->filter(function ($item) {
            return $item->total_quantity > 0 && $item->total_quantity <= $item->reorder_level;
        })->count();
        $adequateStockCount = $stocks->filter(function ($item) {
            return $item->total_quantity > $item->reorder_level && $item->total_quantity <= $item->ideal_stock;
        })->count();
        $overStockCount = $stocks->filter(function ($item) {
            return $item->total_quantity > $item->ideal_stock;
        })->count();

        return view('livewire.pharmacy.stock-quantity-report', [
            'stocks' => $stocks->values(), 
            'products' => $products,
            'outOfStockCount' => $outOfStockCount,
            'lowStockCount' => $lowStockCount,
            'adequateStockCount' => $adequateStockCount,
            'overStockCount' => $overStockCount,
        ]);
    }

    // Helper methods for stock status
    private function getStockStatus($quantity, $product)
    {
        if ($quantity <= 0) {
            return 'Out of Stock';
        } elseif ($quantity <= ($product->reorder_level ?? 10)) {
            return 'Low Stock';
        } elseif ($quantity <= ($product->ideal_stock ?? 50)) {
            return 'Adequate';
        } else {
            return 'Overstocked';
        }
    }

    private function getStockStatusClass($status)
    {
        switch ($status) {
            case 'Out of Stock':
                return 'text-danger';
            case 'Low Stock':
                return 'text-warning';
            case 'Adequate':
                return 'text-success';
            case 'Overstocked':
                return 'text-info';
            default:
                return 'text-secondary';
        }
    }

    private function applyStockStatusFilter($query, $status)
    {
        $stocksWithProducts = PharmacyStock::select('product_id', DB::raw('SUM(quantity) as total_quantity'))
            ->groupBy('product_id')
            ->get();
            
        $filteredProductIds = $stocksWithProducts->filter(function ($stock) use ($status) {
            $product = Product::find($stock->product_id);
            $currentStatus = $this->getStockStatus($stock->total_quantity, $product);
            return $currentStatus === $status;
        })->pluck('product_id');
        
        return $query->whereIn('product_id', $filteredProductIds);
    }

    // export as PDF
    public function pdf()
    {
        $stockData = $this->buildExportQuery();
        
        // Add additional product information to each stock entry
        $stocks = $stockData->map(function ($item) {
            $product = Product::find($item->product_id);
            $item->product_name = $product->name ?? 'N/A';
            $item->reorder_level = $product->reorder_level ?? 0;
            $item->ideal_stock = $product->ideal_stock ?? 0;
            $item->max_stock = $product->max_stock ?? 0;
            $item->status = $this->getStockStatus($item->total_quantity, $product);
            $item->status_class = $this->getStockStatusClass($item->status);
            
            return $item;
        });

        $pdf = app(PDF::class)->loadView('livewire.pharmacy.stock-quantity-report-pdf', ['stocks' => $stocks]);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'stock-quantity-report.pdf');
    }

    // print logic
    public function print()
    {
        $stockData = $this->buildExportQuery();
        
        // Add additional product information to each stock entry
        $stocks = $stockData->map(function ($item) {
            $product = Product::find($item->product_id);
            $item->product_name = $product->name ?? 'N/A';
            $item->reorder_level = $product->reorder_level ?? 0;
            $item->ideal_stock = $product->ideal_stock ?? 0;
            $item->max_stock = $product->max_stock ?? 0;
            $item->status = $this->getStockStatus($item->total_quantity, $product);
            $item->status_class = $this->getStockStatusClass($item->status);
            
            return $item;
        });

        $pdf = app(PDF::class)->loadView('livewire.pharmacy.stock-quantity-report-print', ['stocks' => $stocks]);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'stock-quantity-report.pdf');
    }

    // export to Excel
    public function excel()
    {
        $stockData = $this->buildExportQuery();
        
        // Create a collection of stock data with product information
        $stocks = $stockData->map(function ($item) {
            $product = Product::find($item->product_id);
            
            return [
                'product_id' => $product->id,
                'product_name' => $product->name ?? 'N/A',
                'total_quantity' => $item->total_quantity,
                'status' => $this->getStockStatus($item->total_quantity, $product),
            ];
        });

        return Excel::download(new class($stocks) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            protected $stocks;

            public function __construct($stocks)
            {
                $this->stocks = $stocks;
            }

            public function collection()
            {
                return collect($this->stocks);
            }

            public function headings(): array
            {
                return [
                    'ID',
                    'Product Name',
                    'Total Quantity',
                    'Status',
                ];
            }
        }, 'stock-quantity-report.xlsx');
    }

    private function buildExportQuery()
    {
        $query = PharmacyStock::select('product_id', DB::raw('SUM(quantity) as total_quantity'))
            ->groupBy('product_id');

        if (!empty($this->searchByProduct)) {
            $query->where('product_id', $this->searchByProduct);
        }
        
        if (!empty($this->searchByBatchNo)) {
            $query->where('batch_no', $this->searchByBatchNo);
        }

        if (!empty($this->searchByCategory)) {
            $query->whereHas('product', function ($q) {
                $q->where('category_id', $this->searchByCategory);
            });
        }

        if (!empty($this->searchByStockStatus)) {
            $query = $this->applyStockStatusFilter($query, $this->searchByStockStatus);
        }

        return $query->get();
    }
}