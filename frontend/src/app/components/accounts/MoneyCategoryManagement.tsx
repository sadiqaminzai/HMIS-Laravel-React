import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Eye, Loader2, Pencil, Search, Tags, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { AddButton } from '../AddButton';
import { TabActionsSlot } from '../TabbedModulePage';
import { Modal } from './MoneyEntryManagement';
import { TABLE_HEAD_CLASS, Th, TR_CLASS } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { AuditTrail, CancelButton, ModalFooter, StatusToggle } from '../ui/FormControls';

/**
 * The expense / other-income category list.
 *
 * Same screen for both, for the same reason the registers share one: a
 * category is a name, a description and an on/off switch, and two copies of
 * that is two places to fix a bug.
 */

export interface MoneyCategoryView {
  id: string;
  hospitalId: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  /** How many entries reference this category, for the delete warning. */
  usageCount?: number;
  /** Who touched the record and when, shown at the foot of the details modal. */
  createdBy?: string | null;
  createdAt?: string | Date | null;
  updatedBy?: string | null;
  updatedAt?: string | Date | null;
}

export interface MoneyCategoryAdapter {
  labels: { singular: string; plural: string; addLabel: string };
  permissions: { add: string[]; edit: string[]; delete: string[] };
  categories: MoneyCategoryView[];
  loading: boolean;
  hospitalId: string;
  save: (args: {
    id?: string;
    name: string;
    description: string;
    status: 'active' | 'inactive';
  }) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

const inputClass =
  'w-full rounded-md border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-900 transition-all focus:border-transparent focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

const labelClass = 'mb-0.5 block text-[11px] font-medium text-gray-700 dark:text-gray-300';

export function MoneyCategoryManagement({ adapter }: { adapter: MoneyCategoryAdapter }) {
  const { hasPermission } = useAuth();
  const { labels } = adapter;

  const canAdd = adapter.permissions.add.some(hasPermission);
  const canEdit = adapter.permissions.edit.some(hasPermission);
  const canDelete = adapter.permissions.delete.some(hasPermission);

  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyCategoryView | null>(null);
  const [viewing, setViewing] = useState<MoneyCategoryView | null>(null);
  const [deleting, setDeleting] = useState<MoneyCategoryView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous ref lock. The `submitting` state alone cannot stop two clicks
  // landing in the same frame -- both read the old false -- which saved twice.
  const { submitting: locked, guard } = useSubmitGuard();
  const [removing, setRemoving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: 'active' as 'active' | 'inactive' });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const scoped = adapter.categories.filter((category) => category.hospitalId === adapter.hospitalId);
    const matched = term
      ? scoped.filter((category) =>
          [category.name, category.description].some((field) =>
            String(field ?? '').toLowerCase().includes(term)
          )
        )
      : scoped;

    return [...matched].sort((a, b) =>
      sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
  }, [adapter.categories, adapter.hospitalId, search, sortDir]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', status: 'active' });
    setFormOpen(true);
  };

  const openEdit = (category: MoneyCategoryView) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? '',
      status: category.status,
    });
    setFormOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error('Enter a category name');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await adapter.save({
        id: editing?.id,
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
      });
      if (ok) {
        toast.success(editing ? 'Category updated' : 'Category added');
        setFormOpen(false);
        setEditing(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await adapter.remove(deleting.id);
      toast.success('Category deleted');
      setDeleting(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete category');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3">
      <TabActionsSlot>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories..."
              className="w-56 rounded-md border border-gray-300 py-1.5 pl-8 pr-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          {canAdd && <AddButton onClick={openAdd} label={labels.addLabel} />}
        </div>
      </TabActionsSlot>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <Th>#</Th>
                <Th
                  onSort={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}
                  active
                  direction={sortDir}
                >
                  Name
                </Th>
                <Th>Description</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {adapter.loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-gray-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}

              {!adapter.loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center">
                    <Tags className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                    <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                      No categories found
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {search ? 'Try a different search term.' : 'Create a category to get started.'}
                    </p>
                  </td>
                </tr>
              )}

              {!adapter.loading &&
                rows.map((category, index) => (
                  <tr key={category.id} className={TR_CLASS}>
                    <td className="px-4 py-2 text-xs text-gray-400">{index + 1}</td>
                    <td className="px-4 py-2 text-xs font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300">
                      {category.description || '—'}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <StatusBadge status={category.status} />
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewing(category)}
                          title="View details"
                          className="rounded p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(category)}
                            title="Edit"
                            className="rounded p-1 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleting(category)}
                            title="Delete"
                            className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <Modal
          title={`${editing ? 'Edit' : 'Add'} ${labels.singular}`}
          onClose={() => setFormOpen(false)}
          width="max-w-lg"
        >
          <form onSubmit={guard(submit)} className="space-y-3">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className={inputClass}
                required
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <StatusToggle
                value={form.status}
                onChange={(status) => setForm((prev) => ({ ...prev, status }))}
                hint="Inactive categories stay on existing entries but are not offered for new ones."
              />
            </div>

            <ModalFooter onCancel={() => setFormOpen(false)} pending={submitting || locked} />
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={`${labels.singular} Details`} onClose={() => setViewing(null)} width="max-w-lg">
          <div className="space-y-3">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">{viewing.name}</div>
              <StatusBadge status={viewing.status} size="md" className="mt-1" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Description
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-xs text-gray-800 dark:text-gray-200">
                {viewing.description || '—'}
              </p>
            </div>

            <AuditTrail
              entries={[
                { label: 'Created by', who: viewing.createdBy, when: viewing.createdAt },
                { label: 'Updated by', who: viewing.updatedBy, when: viewing.updatedAt },
              ]}
            />

            {canEdit && (
              <div className="flex justify-end border-t border-gray-200 pt-3 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewing;
                    setViewing(null);
                    openEdit(target);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete Category" onClose={() => setDeleting(null)} width="max-w-md">
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
              <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <div className="text-xs text-red-800 dark:text-red-200">
                <p className="font-semibold">This cannot be undone.</p>
                <p className="mt-0.5">
                  “{deleting.name}” will be removed. Entries already filed under it keep their
                  reference, so the register stays readable.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <CancelButton onClick={() => setDeleting(null)} disabled={removing} />
              <button
                type="button"
                onClick={confirmDelete}
                disabled={removing}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
