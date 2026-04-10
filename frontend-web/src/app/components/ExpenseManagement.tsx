import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Expense, ExpenseCategory, Hospital, UserRole } from '../types';
import { useExpenses } from '../context/ExpenseContext';
import { useExpenseCategories } from '../context/ExpenseCategoryContext';
import { useHospitals } from '../context/HospitalContext';
import { Plus, Pencil, Trash2, Search, X, Check, XCircle, Printer, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { ExpenseInvoicePrint } from './ExpenseInvoicePrint';
import { toast } from 'sonner';


const getDocumentUrl = (path: string | undefined | null) => {
  if (!path) return '#';
  if (path.startsWith('http')) return path;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

interface ExpenseManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

export function ExpenseManagement({ hospital, userRole }: ExpenseManagementProps) {
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses();
  const { categories } = useExpenseCategories();
  const { hospitals } = useHospitals();

  const [editing, setEditing] = useState<Expense | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printExpense, setPrintExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [form, setForm] = useState({
    hospitalId: hospital.id,
    expenseCategoryId: '',
    title: '',
    amount: '',
    expenseDate: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: '',
    reference: '',
    notes: '',
  });

  const categoriesForHospital = useMemo(
    () => categories.filter((c) => c.hospitalId === form.hospitalId),
    [categories, form.hospitalId]
  );

  const expensesForHospital = useMemo(
    () => expenses.filter((e) => e.hospitalId === form.hospitalId),
    [expenses, form.hospitalId]
  );

  const sortedExpenses = useMemo(
    () => [...expensesForHospital].sort((a, b) => b.expenseDate.getTime() - a.expenseDate.getTime()),
    [expensesForHospital]
  );
  
  const filteredExpenses = useMemo(() => {
    return sortedExpenses.filter(expense => 
      expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedExpenses, searchTerm]);

  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredExpenses, currentPage]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

  const selectedHospital = hospitals.find((h) => h.id === form.hospitalId) || hospital;

  const resetForm = () => {
    setEditing(null);
    setIsSubmitting(false);
    setDocumentFile(null);
    setForm({
      hospitalId: hospital.id,
      expenseCategoryId: '',
      title: '',
      amount: '',
      expenseDate: format(new Date(), 'yyyy-MM-dd'),
      paymentMethod: '',
      reference: '',
      notes: '',
    });
  };

  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setEditing(expense);
      setDocumentFile(null);
      setForm({
        hospitalId: expense.hospitalId,
        expenseCategoryId: expense.expenseCategoryId,
        title: expense.title,
        amount: expense.amount.toString(),
        expenseDate: format(expense.expenseDate, 'yyyy-MM-dd'),
        paymentMethod: expense.paymentMethod || '',
        reference: expense.reference || '',
        notes: expense.notes || '',
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;

    try {
      await deleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
      toast.success('Expense deleted successfully');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete expense');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    const parsedAmount = parseFloat(form.amount || '0');
    if (!form.expenseCategoryId) {
      toast.error('Please select an expense category.');
      return;
    }
    const selectedCategory = categories.find((c) => c.id === form.expenseCategoryId);
    if (!selectedCategory || selectedCategory.hospitalId !== form.hospitalId) {
      toast.error('Please choose a category from the selected hospital.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid expense amount.');
      return;
    }

    const payload = {
      hospitalId: form.hospitalId,
      expenseCategoryId: form.expenseCategoryId,
      title: form.title,
      amount: parsedAmount,
      expenseDate: new Date(form.expenseDate),
      paymentMethod: form.paymentMethod || undefined,
      reference: form.reference || undefined,
      notes: form.notes || undefined,
      status: editing ? editing.status : 'pending' as Expense['status'],
      documentFile,
    };

    setIsSubmitting(true);

    try {
      if (editing) {
        await updateExpense({ id: editing.id, ...payload });
      } else {
        const created = await addExpense(payload);
        if (!created) {
          return;
        }
      }

      handleCloseModal();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (expense: Expense, status: Expense['status']) => {
    await updateExpense({
      id: expense.id,
      hospitalId: expense.hospitalId,
      expenseCategoryId: expense.expenseCategoryId,
      title: expense.title,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
      paymentMethod: expense.paymentMethod,
      reference: expense.reference,
      notes: expense.notes,
      status,
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track hospital expenses and manage approvals.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

       {/* Search Bar */}
       <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Search expenses..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          Showing {paginatedExpenses.length} of {filteredExpenses.length} records
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2">ID / Date</th>
                <th className="px-4 py-2">Title / Category</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-center">Docs</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-gray-400">{expense.hospitalId}-{expense.sequenceId}</span>
                        <span className="text-gray-900 dark:text-white font-medium">{format(expense.expenseDate, 'MMM dd, yyyy')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col max-w-[200px]">
                        <span className="font-medium text-gray-900 dark:text-white truncate" title={expense.title}>{expense.title}</span>
                        <span className="text-[10px] text-gray-500 truncate">{expense.category?.name || 'Uncategorized'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-bold text-gray-900 dark:text-white">
                    {expense.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase
                        ${expense.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                          expense.status === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {expense.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {expense.documentUrl ? (
                      <a 
                        href={getDocumentUrl(expense.documentUrl)} 
                        target="_blank" 
                        rel="noreferrer" 
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex p-1.5 text-blue-600 hover:bg-blue-50 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-md transition-colors"
                        title="View Document"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <button 
                            onClick={() => setPrintExpense(expense)}
                            className="p-1 px-2 text-indigo-600 hover:bg-indigo-50 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-md transition-colors"
                            title="Print Voucher"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleOpenModal(expense)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-md transition-colors"
                            title="Edit"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setExpenseToDelete(expense)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 rounded-md transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        {expense.status !== 'approved' && (
                            <button 
                                onClick={() => updateStatus(expense, 'approved')}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-md transition-colors"
                                title="Approve"
                            >
                                <Check className="w-4 h-4" />
                            </button>
                        )}
                        {expense.status !== 'rejected' && (
                            <button 
                                onClick={() => updateStatus(expense, 'rejected')}
                                className="p-1.5 text-red-600 hover:bg-red-50 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md transition-colors"
                                title="Reject"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-2">
                            <Search className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium">No expenses found</p>
                        <p className="text-xs mt-0.5">
                          {searchTerm ? 'Try adjusting your search terms' : 'Record a new expense to get started'}
                        </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Previous Page"
                aria-label="Previous Page"
                className="p-1 px-2 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Next Page"
                aria-label="Next Page"
                className="p-1 px-2 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Adding/Editing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {editing ? 'Edit Expense' : 'New Expense'}
              </h2>
              <button 
                onClick={handleCloseModal}
                title="Close"
                aria-label="Close modal"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 grid grid-cols-12 gap-3">
              {/* Row 1 / 2 based on feedback: Try to keep it compact (2 rows essentially for main inputs) */}
              
              {userRole === 'super_admin' && (
                <div className="col-span-12 md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Hospital <span className="text-red-500">*</span></label>
                  <select
                    value={form.hospitalId}
                    onChange={(e) => setForm((prev) => ({ ...prev, hospitalId: e.target.value, expenseCategoryId: '' }))}
                    title="Select Hospital"
                    aria-label="Select Hospital"
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  >
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className={`col-span-12 ${userRole === 'super_admin' ? 'md:col-span-3' : 'md:col-span-4'}`}>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={form.expenseDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
                  title="Select Date"
                  aria-label="Select Date"
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className={`col-span-12 ${userRole === 'super_admin' ? 'md:col-span-3' : 'md:col-span-4'}`}>
                 <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Category <span className="text-red-500">*</span></label>
                <select
                  required
                  title="Select Category"
                  aria-label="Select Category"
                  value={form.expenseCategoryId}
                  onChange={(e) => setForm((prev) => ({ ...prev, expenseCategoryId: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="">Select Category</option>
                  {categoriesForHospital.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

               <div className={`col-span-12 ${userRole === 'super_admin' ? 'md:col-span-3' : 'md:col-span-4'}`}>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={form.amount}
                      onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                      title="Enter Amount"
                      placeholder="0.00"
                      aria-label="Enter Amount"
                      className="w-full pl-6 pr-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>
              </div>


              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Title / Description <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="What is this expense for?"
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Payment Method</label>
                <input
                  list="paymentMethods"
                  value={form.paymentMethod}
                  onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  placeholder="Cash, Card..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
                <datalist id="paymentMethods">
                    <option value="Cash" />
                    <option value="Bank Transfer" />
                    <option value="Credit Card" />
                    <option value="Cheque" />
                </datalist>
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Reference / ID</label>
                <input
                  value={form.reference}
                  onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
                  placeholder="Optional..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional details..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Attachment</label>
                 <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer">
                        <span className="sr-only">Choose file</span>
                        <input type="file" className="block w-full text-xs text-gray-500
                        file:mr-4 file:py-1.5 file:px-4
                        file:rounded-md file:border-0
                        file:text-xs file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100
                        " 
                        accept=".pdf,.png,.jpg,.jpeg" 
                        onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                        />
                    </label>
                     {editing?.documentUrl && !documentFile && (
                      <a href={getDocumentUrl(editing.documentUrl)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline px-2 py-1 bg-gray-50 rounded border border-gray-200">
                        View Current
                      </a>
                    )}
                </div>
                {documentFile && <p className="text-[10px] text-green-600 mt-1 pl-1">Selected: {documentFile.name}</p>}
              </div>

              <div className="col-span-12 flex justify-end pt-3 gap-2 border-t border-gray-100 dark:border-gray-700 mt-1">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  {isSubmitting ? (editing ? 'Updating...' : 'Saving...') : (editing ? 'Update Expense' : 'Save Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printExpense && (
        <ExpenseInvoicePrint 
            hospital={selectedHospital}
            expense={printExpense}
            categoryName={printExpense.category?.name || categories.find(c => c.id === printExpense.expenseCategoryId)?.name || 'Unknown Category'}
            onClose={() => setPrintExpense(null)}
        />
      )}

      {expenseToDelete && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Delete Expense</h3>
              <button
                onClick={() => setExpenseToDelete(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete this expense?
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {expenseToDelete.title} ({expenseToDelete.amount.toFixed(2)})
              </p>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                onClick={() => setExpenseToDelete(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteExpense}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
