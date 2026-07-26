import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Check, XCircle, Ban } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { useLeaveRequests } from '../context/LeaveRequestContext';
import { useEmployees } from '../context/EmployeeContext';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { toast } from 'sonner';

interface LeaveRequestManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

export function LeaveRequestManagement({ hospital, userRole }: LeaveRequestManagementProps) {
  const {
    leaveRequests,
    addLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    loading,
  } = useLeaveRequests();
  const { employees } = useEmployees();
  const { hasPermission } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital } = useHospitalFilter(hospital, userRole);

  const canAdd = hasPermission('add_leave_requests') || hasPermission('manage_leave_requests');
  const canEdit = hasPermission('edit_leave_requests') || hasPermission('manage_leave_requests');
  const canDelete = hasPermission('delete_leave_requests') || hasPermission('manage_leave_requests');
  const canApprove = hasPermission('approve_leave_requests') || hasPermission('manage_leave_requests');
  const canCancel = hasPermission('manage_leave_requests') || hasPermission('edit_leave_requests');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    hospitalId: currentHospital.id,
    employeeId: '',
    leaveType: 'annual' as 'annual' | 'sick' | 'casual' | 'unpaid' | 'other',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    totalDays: '',
    reason: '',
  });

  const scopedLeaveRequests = useMemo(() => filterByHospital(leaveRequests), [leaveRequests, filterByHospital]);
  const scopedEmployees = useMemo(() => filterByHospital(employees), [employees, filterByHospital]);

  const filtered = useMemo(
    () => scopedLeaveRequests.filter((leaveRequest) => {
      const search = searchTerm.toLowerCase();
      return (
        (leaveRequest.employee?.fullName || '').toLowerCase().includes(search) ||
        (leaveRequest.employee?.employeeCode || '').toLowerCase().includes(search) ||
        leaveRequest.leaveType.toLowerCase().includes(search) ||
        leaveRequest.status.toLowerCase().includes(search) ||
        (leaveRequest.reason || '').toLowerCase().includes(search)
      );
    }),
    [scopedLeaveRequests, searchTerm]
  );

  const paginatedLeaveRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  React.useEffect(() => {
    setFormData((prev) => ({ ...prev, hospitalId: currentHospital.id }));
  }, [currentHospital.id]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openAdd = () => {
    if (!canAdd) {
      toast.warning('You are not authorized to add leave requests');
      return;
    }

    setEditingId(null);
    setFormData({
      hospitalId: currentHospital.id,
      employeeId: '',
      leaveType: 'annual',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      totalDays: '',
      reason: '',
    });
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    if (!canEdit) {
      toast.warning('You are not authorized to edit leave requests');
      return;
    }

    const record = leaveRequests.find((l) => l.id === id);
    if (!record) return;

    if (record.status !== 'pending') {
      toast.warning('Only pending leave requests can be edited');
      return;
    }

    setEditingId(record.id);
    setFormData({
      hospitalId: record.hospitalId,
      employeeId: record.employeeId,
      leaveType: record.leaveType,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
      totalDays: String(record.totalDays || ''),
      reason: record.reason || '',
    });
    setShowModal(true);
  };

  const onDelete = async (id: string) => {
    if (!canDelete) {
      toast.warning('You are not authorized to delete leave requests');
      return;
    }

    const confirmed = window.confirm('Delete this leave request?');
    if (!confirmed) return;

    try {
      await deleteLeaveRequest(id);
      toast.success('Leave request deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete leave request');
    }
  };

  const onApprove = async (id: string) => {
    if (!canApprove) {
      toast.warning('You are not authorized to approve leave requests');
      return;
    }

    try {
      await approveLeaveRequest(id);
      toast.success('Leave request approved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve leave request');
    }
  };

  const onReject = async (id: string) => {
    if (!canApprove) {
      toast.warning('You are not authorized to reject leave requests');
      return;
    }

    const rejectionReason = window.prompt('Enter rejection reason (optional)') || undefined;

    try {
      await rejectLeaveRequest(id, rejectionReason);
      toast.success('Leave request rejected');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject leave request');
    }
  };

  const onCancel = async (id: string) => {
    if (!canCancel) {
      toast.warning('You are not authorized to cancel leave requests');
      return;
    }

    const confirmed = window.confirm('Cancel this leave request?');
    if (!confirmed) return;

    try {
      await cancelLeaveRequest(id);
      toast.success('Leave request cancelled');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel leave request');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (userRole === 'super_admin' && !formData.hospitalId) {
      toast.error('Please select hospital');
      return;
    }

    if (!formData.employeeId) {
      toast.error('Please select employee');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        hospitalId: formData.hospitalId,
        employeeId: formData.employeeId,
        leaveType: formData.leaveType,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        totalDays: formData.totalDays ? Number(formData.totalDays) : undefined,
        reason: formData.reason || undefined,
      };

      if (editingId) {
        await updateLeaveRequest({ id: editingId, ...payload });
        toast.success('Leave request updated');
      } else {
        const created = await addLeaveRequest(payload);
        if (!created) return;
        toast.success('Leave request added');
      }

      setShowModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save leave request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leave Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Single-level leave request approval workflow.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-[10px] text-sm font-medium flex items-center gap-2 shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Leave Request
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            title="Search leave requests"
            placeholder="Search leave requests..."
            className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <HospitalSelector
          userRole={userRole}
          selectedHospitalId={selectedHospitalId}
          onHospitalChange={setSelectedHospitalId}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[12px] border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1080px]">
            <thead className="bg-gray-50/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 font-semibold sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="px-3 py-2.5 text-xs font-medium">Employee</th>
                <th className="px-3 py-2.5 text-xs font-medium">Type</th>
                <th className="px-3 py-2.5 text-xs font-medium">Start</th>
                <th className="px-3 py-2.5 text-xs font-medium">End</th>
                <th className="px-3 py-2.5 text-xs font-medium">Days</th>
                <th className="px-3 py-2.5 text-xs font-medium">Status</th>
                <th className="px-3 py-2.5 text-xs font-medium">Reason</th>
                <th className="px-3 py-2.5 text-xs font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedLeaveRequests.map((leaveRequest) => (
                <tr key={leaveRequest.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-100 dark:border-gray-800/50">
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900 dark:text-white font-medium">
                    <div>{leaveRequest.employee?.fullName || '-'}</div>
                    <div className="text-xs text-gray-500">{leaveRequest.employee?.employeeCode || ''}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{leaveRequest.leaveType}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{leaveRequest.startDate.toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{leaveRequest.endDate.toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{leaveRequest.totalDays}</td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <span className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold ${leaveRequest.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : leaveRequest.status === 'rejected'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : leaveRequest.status === 'cancelled'
                          ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {leaveRequest.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{leaveRequest.reason || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(leaveRequest.id)}
                        className="p-2.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-blue-600 hover:bg-blue-100"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(leaveRequest.id)}
                        className="p-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-red-600 hover:bg-red-100"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {leaveRequest.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onApprove(leaveRequest.id)}
                            className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors text-emerald-600 hover:bg-emerald-100"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onReject(leaveRequest.id)}
                            className="p-1.5 rounded bg-orange-50 text-orange-600 hover:bg-orange-100"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {(leaveRequest.status === 'pending' || leaveRequest.status === 'approved') && (
                        <button
                          onClick={() => onCancel(leaveRequest.id)}
                          className="p-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                          title="Cancel"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    No leave requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
            <div className="text-xs text-gray-500 dark:text-gray-400">Page {currentPage} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 transition-all">
          <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between rounded-t-lg sticky top-0 z-10">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {editingId ? 'Edit Leave Request' : 'Add Leave Request'}
                {userRole === 'super_admin' && (
                  <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">- {currentHospital.name}</span>
                )}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {userRole === 'super_admin' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Hospital</label>
                  <div className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200">
                    {currentHospital.name}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Leave Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Employee</label>
                    <select
                      value={formData.employeeId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, employeeId: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Employee"
                      required
                    >
                      <option value="">Select Employee</option>
                      {scopedEmployees.map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.fullName} ({employee.employeeCode || 'N/A'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Leave Type</label>
                    <select
                      value={formData.leaveType}
                      onChange={(e) => setFormData((prev) => ({ ...prev, leaveType: e.target.value as typeof formData.leaveType }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Leave type"
                    >
                      <option value="annual">Annual</option>
                      <option value="sick">Sick</option>
                      <option value="casual">Casual</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Total Days (optional)</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={formData.totalDays}
                      onChange={(e) => setFormData((prev) => ({ ...prev, totalDays: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Total leave days"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Leave start date"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Leave end date"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason</label>
                    <textarea
                      value={formData.reason}
                      onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Leave reason"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors font-medium text-xs shadow-sm flex items-center justify-center gap-1.5">
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
