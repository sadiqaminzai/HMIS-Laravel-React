import React, { useEffect, useMemo, useState } from 'react';
import { Hospital, UserRole, ExpenseCategory } from '../types';
import { useExpenseCategories } from '../context/ExpenseCategoryContext';
import { useHospitals } from '../context/HospitalContext';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

interface ExpenseCategoriesProps {
  hospital: Hospital;
  userRole: UserRole;
}

export function ExpenseCategories({ hospital, userRole }: ExpenseCategoriesProps) {
  const { categories, addCategory, updateCategory, deleteCategory } = useExpenseCategories();
  const { hospitals } = useHospitals();
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [form, setForm] = useState({
    hospitalId: hospital.id,
    name: '',
    description: '',
    status: 'active' as ExpenseCategory['status'],
  });

  const categoriesForHospital = useMemo(
    () => categories.filter((c) => c.hospitalId === form.hospitalId),
    [categories, form.hospitalId]
  );

  const totalPages = Math.max(1, Math.ceil(categoriesForHospital.length / itemsPerPage));
  const paginatedCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return categoriesForHospital.slice(startIndex, startIndex + itemsPerPage);
  }, [categoriesForHospital, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [form.hospitalId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetForm = () => {
    setEditing(null);
    setIsSubmitting(false);
    setForm({
      hospitalId: hospital.id,
      name: '',
      description: '',
      status: 'active',
    });
  };

  const handleOpenModal = (category?: ExpenseCategory) => {
    if (category) {
      setEditing(category);
      setForm({
        hospitalId: category.hospitalId,
        name: category.name,
        description: category.description || '',
        status: category.status,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (editing) {
        await updateCategory({
          id: editing.id,
          hospitalId: form.hospitalId,
          name: form.name,
          description: form.description,
          status: form.status,
        });
      } else {
        const created = await addCategory({
          hospitalId: form.hospitalId,
          name: form.name,
          description: form.description,
          status: form.status,
        });

        if (!created) {
          return;
        }
      }

      handleCloseModal();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save expense category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expense Categories</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create and manage expense categories.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedCategories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{category.name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{category.description || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      category.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' 
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {category.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <button 
                            onClick={() => handleOpenModal(category)} 
                            className="p-1.5 text-blue-600 hover:bg-blue-50 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-md transition-colors"
                            title="Edit"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => deleteCategory(category.id)} 
                            className="p-1.5 text-rose-600 hover:bg-rose-50 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 rounded-md transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedCategories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-2">
                            <Search className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium">No categories found</p>
                        <p className="text-xs mt-0.5">Create a new category to get started.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl border border-gray-200 dark:border-gray-700 flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {editing ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button 
                onClick={handleCloseModal}
                title="Close"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 grid grid-cols-12 gap-3">
              {userRole === 'super_admin' && (
                <div className="col-span-12 md:col-span-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Hospital <span className="text-red-500">*</span></label>
                  <select
                    value={form.hospitalId}
                    onChange={(e) => setForm((prev) => ({ ...prev, hospitalId: e.target.value }))}
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
              
              <div className={`col-span-12 ${userRole === 'super_admin' ? 'md:col-span-5' : 'md:col-span-8'}`}>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Category Name <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Utilities, Rent, Salaries"
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="col-span-12 md:col-span-3"> {/* Status - usually short */}
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ExpenseCategory['status'] }))}
                  title="Select Status"
                  aria-label="Select Status"
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="col-span-12">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="col-span-12 flex justify-end pt-2 gap-2 border-t border-gray-100 dark:border-gray-700 mt-1">
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
                  {isSubmitting ? (editing ? 'Updating...' : 'Saving...') : (editing ? 'Update Category' : 'Save Category')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
