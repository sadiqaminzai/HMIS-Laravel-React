import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Scan, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Hospital, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { AddButton } from './AddButton';
import { formatDate } from '../utils/date';
import { ModalOverlay, ModalPanel, DetailModalHeader, DetailRow } from './ui/ModalParts';
import {
  CellNumber,
  CellText,
  DataTableBody,
  DataTableCard,
  DataTableHead,
  DeleteIcon,
  EditIcon,
  RowIcon,
  TableAction,
  TableActions,
  TableEmpty,
  TableLoading,
  TablePill,
  Th,
  Tr,
  usePagination,
  useTableSort,
  ViewIcon,
} from './DataTable';
import {
  XrayTypeApi,
  createXrayType,
  deleteXrayType,
  fetchXrayTypes,
  updateXrayType,
} from '../api/xray';

interface XrayTypesProps {
  hospital: Hospital;
  userRole: UserRole;
}

const emptyForm = () => ({
  name: '',
  description: '',
  price: '',
  isActive: true,
});

/**
 * The X-Ray study catalogue.
 *
 * Deliberately the same shape as the ultrasound types desk: a receipt picks a
 * study from here and inherits its price, instead of someone retyping both on
 * every receipt.
 */
export function XrayTypes({ hospital, userRole }: XrayTypesProps) {
  const { hasPermission } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } =
    useHospitalFilter(hospital, userRole);

  const [types, setTypes] = useState<XrayTypeApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<XrayTypeApi | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<XrayTypeApi | null>(null);

  const canManage = hasPermission('manage_xray_types');
  const canView = hasPermission('view_xray_types') || canManage;
  const canCreate = hasPermission('add_xray_types') || canManage;
  const canEdit = hasPermission('edit_xray_types') || canManage;
  const canDelete = hasPermission('delete_xray_types') || canManage;

  /** Only a super admin may target another tenant. */
  const scopedHospitalId = useMemo(() => {
    if (userRole !== 'super_admin') return undefined;
    return isAllHospitals ? undefined : currentHospital.id;
  }, [userRole, isAllHospitals, currentHospital.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTypes(await fetchXrayTypes(scopedHospitalId ? { hospital_id: scopedHospitalId } : {}));
    } catch {
      toast.error('Failed to load X-Ray types');
    } finally {
      setLoading(false);
    }
  }, [scopedHospitalId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return types;
    return types.filter((row) =>
      [row.name, row.description].some((v) => (v || '').toLowerCase().includes(term))
    );
  }, [types, searchTerm]);

  const sort = useTableSort(filtered, 'name', 'asc');
  const { page, setPage, totalPages, pageRows } = usePagination(sort.rows, 25);

  const openModal = (row?: XrayTypeApi) => {
    if (row) {
      setEditing(row);
      setForm({
        name: row.name || '',
        description: row.description || '',
        price: row.price != null ? Number(row.price).toFixed(2) : '',
        isActive: !!row.is_active,
      });
    } else {
      setEditing(null);
      setForm(emptyForm());
    }
    setIsModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.name.trim()) {
      toast.error('Study name is required');
      return;
    }

    const payload = {
      ...(userRole === 'super_admin' ? { hospital_id: currentHospital.id } : {}),
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: form.price ? Number(form.price) : 0,
      is_active: form.isActive,
    };

    setIsSubmitting(true);
    try {
      if (editing) {
        await updateXrayType(editing.id, payload);
        toast.success('X-Ray type updated');
      } else {
        await createXrayType(payload);
        toast.success('X-Ray type created');
      }
      setIsModalOpen(false);
      load();
    } catch (error: any) {
      const errors = error?.response?.data?.errors;
      toast.error(
        errors
          ? String(Object.values(errors).flat()[0])
          : error?.response?.data?.message || 'Save failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (row: XrayTypeApi) => {
    if (!window.confirm('Delete "' + row.name + '"? Receipts already raised for it are kept.')) {
      return;
    }

    setBusyId(row.id);
    try {
      await deleteXrayType(row.id);
      toast.success('X-Ray type deleted');
      load();
    } catch (error: any) {
      // The server refuses when receipts exist and says to deactivate instead.
      toast.error(error?.response?.data?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const inputClass =
    'w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all';
  const labelClass = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5';

  if (!canView && !canCreate) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        You do not have permission to view X-Ray types.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">X-Ray Types</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            The studies this hospital offers, and what each one costs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {userRole === 'super_admin' && (
            <HospitalSelector
              selectedHospitalId={selectedHospitalId}
              onHospitalChange={setSelectedHospitalId}
              userRole={userRole}
            />
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search study..."
              className="w-56 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          {canCreate && <AddButton onClick={() => openModal()} label="Add X-Ray type" />}
        </div>
      </div>

      <DataTableCard
        total={filtered.length}
        shown={pageRows.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noun="types"
      >
        {/* DataTableHead supplies its own <tr>. Wrapping these in another one
            nests <tr> inside <tr>, which the browser splits into two rows so
            the header stops lining up with the body. */}
        <DataTableHead>
          <Th align="center">#</Th>
          <Th sort={sort} field="name">Study</Th>
          <Th>Description</Th>
          <Th sort={sort} field="price" align="right">Price</Th>
          <Th sort={sort} field="is_active" align="center">Status</Th>
          <Th align="center">Actions</Th>
        </DataTableHead>
        <DataTableBody>
          {loading ? (
            <TableLoading colSpan={6} />
          ) : pageRows.length === 0 ? (
            <TableEmpty colSpan={6} message="No X-Ray types yet." />
          ) : (
            pageRows.map((row, index) => (
              <Tr key={row.id}>
                <td className="px-4 py-2 text-center">
                  {/* A running row number. This used to print sort_order,
                      which is always 0 now that the field is gone. */}
                  <CellText>{(page - 1) * 25 + index + 1}</CellText>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <RowIcon tone="purple">
                      <Scan className="w-3.5 h-3.5" />
                    </RowIcon>
                    <span className="text-xs font-medium text-gray-900 dark:text-white">
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 max-w-xs truncate">
                  <CellText>{row.description || '-'}</CellText>
                </td>
                <td className="px-4 py-2 text-right">
                  <CellNumber tone="money">{Number(row.price || 0).toFixed(2)}</CellNumber>
                </td>
                <td className="px-4 py-2 text-center">
                  <TablePill tone={row.is_active ? "green" : "gray"}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </TablePill>
                </td>
                <td className="px-4 py-2">
                  <TableActions>
                    <TableAction tone="view" title="View" onClick={() => setViewing(row)}>
                      <ViewIcon />
                    </TableAction>
                    {canEdit && (
                      <TableAction tone="edit" title="Edit" onClick={() => openModal(row)}>
                        <EditIcon />
                      </TableAction>
                    )}
                    {canDelete && (
                      <TableAction
                        tone="delete"
                        title="Delete"
                        onClick={() => remove(row)}
                        disabled={busyId === row.id}
                      >
                        {busyId === row.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <DeleteIcon />
                        )}
                      </TableAction>
                    )}
                  </TableActions>
                </td>
              </Tr>
            ))
          )}
        </DataTableBody>
      </DataTableCard>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {editing ? 'Edit X-Ray Type' : 'Add X-Ray Type'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submit} className="p-4 space-y-3">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12">
                  <label className={labelClass}>
                    Study Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Chest PA"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                <div className="col-span-12">
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    className={inputClass}
                  />
                </div>

                <div className="col-span-12 md:col-span-6">
                  <label className={labelClass}>Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    onBlur={() =>
                      setForm((p) => ({
                        ...p,
                        price: p.price === '' ? '' : Number(p.price || 0).toFixed(2),
                      }))
                    }
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>

                <div className="col-span-12 md:col-span-6">
                  <label className={labelClass}>Status</label>
                  {/* Styled with inputClass so it is exactly the height and
                      width of the Price field beside it -- a labelled form
                      control, not a pill floating next to an input. */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.isActive}
                    onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                    className={inputClass + ' flex items-center justify-between gap-2 text-left cursor-pointer'}
                  >
                    <span className="font-medium">{form.isActive ? 'Active' : 'Inactive'}</span>
                    <span
                      className={'relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ' +
                        (form.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')}
                    >
                      <span
                        className={'inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ' +
                          (form.isActive ? 'translate-x-[1.0625rem]' : 'translate-x-0.5')}
                      />
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {editing ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalOverlay open={!!viewing}>
        <ModalPanel size="md">
          <DetailModalHeader
            title="X-Ray Type Details"
            icon={<Scan className="w-4 h-4" />}
            gradient="from-sky-600 to-blue-700"
            onClose={() => setViewing(null)}
          />
          {viewing && (
            <div className="p-4 space-y-3">
              {/* Name on the left, live status on the right. The description
                  is not repeated here -- it has its own row below. */}
              <div className="flex items-center justify-between gap-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900/40 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{viewing.name}</h3>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={'inline-block h-2.5 w-2.5 rounded-full ' +
                      (viewing.is_active ? 'bg-emerald-500' : 'bg-red-500')}
                  />
                  <span
                    className={'text-xs font-semibold ' +
                      (viewing.is_active
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400')}
                  >
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </span>
                </span>
              </div>
              <div>
                <DetailRow
                  label="Description"
                  value={
                    <span dir="auto" className="block max-w-[16rem]">
                      {viewing.description || '—'}
                    </span>
                  }
                />
                <DetailRow label="Price" value={Number(viewing.price || 0).toFixed(2)} />
                <DetailRow label="Created By" value={viewing.created_by || '—'} />
                <DetailRow
                  label="Created At"
                  value={
                    viewing.created_at
                      ? formatDate(viewing.created_at, currentHospital.timezone, currentHospital.calendarType)
                      : '—'
                  }
                />
                <DetailRow label="Last Updated By" value={viewing.updated_by || '—'} />
                <DetailRow
                  label="Last Updated At"
                  value={
                    viewing.updated_at
                      ? formatDate(viewing.updated_at, currentHospital.timezone, currentHospital.calendarType)
                      : '—'
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      const row = viewing;
                      setViewing(null);
                      openModal(row);
                    }}
                    className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </ModalPanel>
      </ModalOverlay>
    </div>
  );
}
