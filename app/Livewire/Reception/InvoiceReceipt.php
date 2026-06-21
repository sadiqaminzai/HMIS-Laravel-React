<?php

namespace App\Livewire\Reception;

use App\Models\Pharmacy\SaleInvoice;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;
use Livewire\WithPagination;

class InvoiceReceipt extends Component
{
    use WithPagination;

    public $id, $invoice_no, $invoice_date, $patient_name, $payment_status, $payment_method,
        $total_amount, $total_discount, $total_quantity, $net_amount, $paid_amount, $due_amount,
        $discount_id, $discount_reason, $approved_by, $updated_by, $is_active, $is_delete;

    public $search_invoice_no, $search_invoice_date, $search_patient_name, $search_payment_status, $search_payment_method;
    public $isOpen = 0;
    public $selectedInvoice;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination
    public function showDetails($id)
    {
        $this->selectedInvoice = SaleInvoice::with(['patient', 'user'])->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }
    public function closeDetailsModal()
    {
        $this->selectedInvoice = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function openModal()
    {
        $this->isOpen = true;
        $this->dispatch('open-modal');
    }

    public function closeModal()
    {
        $this->resetInputFields();
        $this->dispatch('close-modal');
    }

    private function resetInputFields()
    {
        $this->id = '';
        $this->invoice_no = '';
        $this->invoice_date = '';
        $this->patient_name = '';
        $this->payment_status = '';
        $this->payment_method = '';
        $this->total_amount = '';
        $this->total_discount = '';
        $this->total_quantity = '';
        $this->net_amount = '';
        $this->paid_amount = '';
        $this->due_amount = '';
        $this->discount_id = '';
        $this->discount_reason = '';
        $this->approved_by = '';
        $this->updated_by = '';
        $this->is_active = '';
        $this->is_delete = '';
    }

    public function search()
    {
        $this->resetPage();
    }

    public function clearSearch()
    {
        $this->search_invoice_no = '';
        $this->search_invoice_date = '';
        $this->search_patient_name = '';
        $this->search_payment_status = '';
        $this->search_payment_method = '';
        $this->resetPage();
    }

    public function render()
    {
        $query = SaleInvoice::query();

        if ($this->search_invoice_no) {
            $query->where('invoice_no', 'like', '%' . $this->search_invoice_no . '%');
        }

        if ($this->search_invoice_date) {
            $query->where('invoice_date', 'like', '%' . $this->search_invoice_date . '%');
        }

        if ($this->search_patient_name) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->search_patient_name . '%');
            });
        }

        if ($this->search_payment_status) {
            $query->where('payment_status', 'like', '%' . $this->search_payment_status . '%');
        }

        if ($this->search_payment_method) {
            $query->where('payment_method', 'like', '%' . $this->search_payment_method . '%');
        }

        $invoices = $query->with('patient')
            ->orderBy('id', 'DESC')
            ->paginate(10);

        return view('livewire.reception.invoice-receipt', [
            'invoices' => $invoices,
        ]);
    }

    public function togglePaymentStatus($id)
    {
        $invoice = SaleInvoice::find($id);

        if ($invoice) {
            $newStatus = $invoice->payment_status === 'paid' ? 'pending' : 'paid';
            $invoice->update([
                'payment_status' => $newStatus,
                'paid_amount' => $newStatus === 'paid' ? $invoice->net_amount : 0,
                'due_amount' => $newStatus === 'paid' ? 0 : $invoice->net_amount,
                'approved_by' => Auth::id(),
            ]);

            $this->dispatch('success', message: 'Record updated successfully.');
        }
    }
}
