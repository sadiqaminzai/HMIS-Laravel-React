import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Save, Trash2, Pencil, X, Search } from 'lucide-react';
import api from '../../api/axios';
import { Hospital, Medicine, MedicineSet, PrescriptionMedicine, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useAuth } from '../context/AuthContext';
import { useMedicines } from '../context/MedicineContext';
import { doseOptions, durationOptions, instructionOptions } from '../data/mockData';
import { toast } from 'sonner';

interface MedicineSetManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

interface MedicineSetFormItem {
  medicineId: string;
  medicineName: string;
  strength: string;
  dose: string;
  duration: string;
  instruction: PrescriptionMedicine['instruction'];
  quantity: number;
  type: string;
  sortOrder: number;
}

const emptyItem = (sortOrder = 0): MedicineSetFormItem => ({
  medicineId: '',
  medicineName: '',
  strength: '',
  dose: '',
  duration: '',
  instruction: '',
  quantity: 0,
  type: '',
  sortOrder,
});

const formatMedicineDisplay = (
  brand: string,
  generic?: string,
  type?: string,
  strength?: string,
  includeStrength: boolean = true
) => {
  const parts = [];
  if (type) parts.push(type);
  if (brand) parts.push(brand);
  if (generic) parts.push(`(${generic})`);
  if (includeStrength && strength) parts.push(strength);
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
};

export function MedicineSetManagement({ hospital, userRole = 'admin' }: MedicineSetManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const { hasPermission } = useAuth();
  const { medicines } = useMedicines();

  const canManage =
    hasPermission('manage_treatment_sets') ||
    hasPermission('add_treatment_sets') ||
    hasPermission('edit_treatment_sets') ||
    hasPermission('delete_treatment_sets') ||
    hasPermission('manage_prescriptions') ||
    hasPermission('add_prescriptions') ||
    hasPermission('edit_prescriptions') ||
    hasPermission('delete_prescriptions');

  const [sets, setSets] = useState<MedicineSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [items, setItems] = useState<MedicineSetFormItem[]>([emptyItem(0)]);
  const [openMedicineDropdownIndex, setOpenMedicineDropdownIndex] = useState<number | null>(null);
  const medicinesScrollRef = useRef<HTMLDivElement>(null);
  const shouldScrollMedicinesToBottomRef = useRef(false);

  const medicineOptions = useMemo(
    () =>
      medicines.filter(
        (medicine: Medicine) =>
          String(medicine.hospitalId) === String(currentHospital.id) && medicine.status === 'active'
      ),
    [medicines, currentHospital.id]
  );

  const resetForm = () => {
    setEditingSetId(null);
    setName('');
    setDescription('');
    setStatus('active');
    setItems([emptyItem(0)]);
    setOpenMedicineDropdownIndex(null);
  };

  const loadSets = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/medicine-sets', {
        params: {
          hospital_id: currentHospital.id,
        },
      });

      const records: any[] = data.data ?? data;
      const mapped: MedicineSet[] = records.map((set) => ({
        id: String(set.id),
        hospitalId: String(set.hospital_id),
        name: set.name ?? '',
        description: set.description ?? '',
        status: (set.status ?? 'active') as 'active' | 'inactive',
        items: (set.items ?? []).map((item: any) => ({
          id: String(item.id),
          medicineSetId: String(item.medicine_set_id),
          medicineId: item.medicine_id ? String(item.medicine_id) : undefined,
          medicineName: item.medicine_name ?? '',
          strength: item.strength ?? '',
          dose: item.dose ?? '',
          duration: item.duration ?? '',
          instruction: (item.instruction ?? '') as PrescriptionMedicine['instruction'],
          quantity: Number(item.quantity ?? 0),
          type: item.type ?? '',
          sortOrder: Number(item.sort_order ?? 0),
        })),
      }));

      setSets(mapped);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load treatment sets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSets();
  }, [currentHospital.id]);

  useEffect(() => {
    if (!shouldScrollMedicinesToBottomRef.current) return;

    const container = medicinesScrollRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      shouldScrollMedicinesToBottomRef.current = false;
    });
  }, [items.length]);

  const filteredSets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sets;

    return sets.filter(
      (set) =>
        set.name.toLowerCase().includes(term) ||
        (set.description || '').toLowerCase().includes(term) ||
        set.status.toLowerCase().includes(term)
    );
  }, [sets, search]);

  const startEdit = (set: MedicineSet) => {
    setEditingSetId(set.id);
    setName(set.name);
    setDescription(set.description || '');
    setStatus(set.status);
    setItems(
      set.items.length > 0
        ? set.items
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item, index) => ({
              medicineId: item.medicineId || '',
              medicineName: item.medicineName,
              strength: item.strength,
              dose: item.dose,
              duration: item.duration,
              instruction: item.instruction,
              quantity: item.quantity,
              type: item.type || '',
              sortOrder: Number(item.sortOrder ?? index),
            }))
        : [emptyItem(0)]
    );
  };

  const addItem = () => {
    shouldScrollMedicinesToBottomRef.current = true;
    setItems((previous) => [...previous, emptyItem(previous.length)]);
  };

  const removeItem = (index: number) => {
    setItems((previous) => {
      const next = previous.filter((_, currentIndex) => currentIndex !== index);
      return next.length > 0 ? next.map((item, currentIndex) => ({ ...item, sortOrder: currentIndex })) : [emptyItem(0)];
    });
  };

  const updateItem = (index: number, field: keyof MedicineSetFormItem, value: string | number) => {
    setItems((previous) =>
      previous.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const updateItemBatch = (index: number, updates: Partial<MedicineSetFormItem>) => {
    setItems((previous) =>
      previous.map((item, currentIndex) => (currentIndex === index ? { ...item, ...updates } : item))
    );
  };

  const getInstructionLabel = (value: string) => {
    return instructionOptions.find((option) => option.value === value)?.label || value;
  };

  const normalizeInstructionValue = (value: string) => {
    const match = instructionOptions.find((option) => option.label === value);
    return match ? match.value : value;
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error('You are not authorized to manage treatment sets');
      return;
    }

    if (!name.trim()) {
      toast.error('Treatment set name is required');
      return;
    }

    const validItems = items
      .map((item, index) => ({ ...item, sortOrder: index }))
      .filter((item) => item.medicineName.trim().length > 0);

    if (validItems.length === 0) {
      toast.error('Add at least one medicine line');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        hospital_id: currentHospital.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
        items: validItems.map((item) => ({
          medicine_id: item.medicineId || null,
          medicine_name: item.medicineName,
          strength: item.strength || null,
          dose: item.dose || null,
          duration: item.duration || null,
          instruction: item.instruction || null,
          quantity: Number(item.quantity ?? 0),
          type: item.type || null,
          sort_order: Number(item.sortOrder ?? 0),
        })),
      };

      if (editingSetId) {
        await api.put(`/medicine-sets/${editingSetId}`, payload);
        toast.success('Treatment set updated');
      } else {
        await api.post('/medicine-sets', payload);
        toast.success('Treatment set created');
      }

      await loadSets();
      resetForm();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save treatment set');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (setId: string) => {
    if (!canManage) {
      toast.error('You are not authorized to delete treatment sets');
      return;
    }

    if (!window.confirm('Delete this treatment set?')) return;

    try {
      await api.delete(`/medicine-sets/${setId}`);
      toast.success('Treatment set deleted');
      if (editingSetId === setId) {
        resetForm();
      }
      await loadSets();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete treatment set');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Treatment Sets</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Manage grouped medicine templates for {currentHospital.name}
          </p>
        </div>
        <button
          onClick={resetForm}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          New Set
        </button>
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <div className="grid grid-cols-1 xl:grid-cols-[30%_70%] gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sets..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs"
              />
            </div>
          </div>

          <div className="max-h-[62vh] overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 z-10">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold uppercase">Name</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase">Status</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-500">Loading...</td>
                  </tr>
                ) : filteredSets.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-500">No treatment sets found</td>
                  </tr>
                ) : (
                  filteredSets.map((set) => (
                    <tr key={set.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 align-top">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{set.name}</div>
                        <div className="text-xs text-gray-500">{set.items.length} medicine(s)</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${set.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {set.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => startEdit(set)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(set.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {editingSetId ? 'Edit Treatment Set' : 'Create Treatment Set'}
            </h2>
            {editingSetId && (
              <button onClick={resetForm} className="text-xs text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Set name"
              className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}
              title="Set status"
              className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="Description (optional)"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md"
          />

          <div
            ref={medicinesScrollRef}
            className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto ${
              items.length >= 5
                ? `${openMedicineDropdownIndex !== null ? 'max-h-[420px]' : 'max-h-[240px]'} overflow-y-auto`
                : 'overflow-y-visible'
            }`}
          >
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[25%]">Medicine Name</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[10%]">Strength</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[15%]">Dose</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[15%]">Duration</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[15%]">Instruction</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[10%]">Qty</th>
                  <th className="py-1.5 px-2 w-[10%]"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800">
                {items.map((item, index) => (
                  <tr key={`set-item-${index}`} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-0.5 px-2 align-top">
                      <MedicineSetItemMedicineInput
                        item={item}
                        index={index}
                        hospitalId={currentHospital.id}
                        medicineOptions={medicineOptions}
                        onUpdate={updateItem}
                        onUpdateBatch={updateItemBatch}
                        onDropdownToggle={(open) => setOpenMedicineDropdownIndex(open ? index : null)}
                      />
                    </td>
                    <td className="py-0.5 px-2 align-top">
                      <input
                        type="text"
                        value={item.strength}
                        onChange={(event) => updateItem(index, 'strength', event.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Auto-filled or enter"
                      />
                    </td>
                    <td className="py-0.5 px-2 align-top">
                      <input
                        list={`set-dose-options-${index}`}
                        type="text"
                        value={item.dose}
                        onChange={(event) => updateItem(index, 'dose', event.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Select/Type"
                      />
                      <datalist id={`set-dose-options-${index}`}>
                        {doseOptions.map((dose) => (
                          <option key={dose} value={dose} />
                        ))}
                      </datalist>
                    </td>
                    <td className="py-0.5 px-2 align-top">
                      <input
                        list={`set-duration-options-${index}`}
                        type="text"
                        value={item.duration}
                        onChange={(event) => updateItem(index, 'duration', event.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Select/Type"
                      />
                      <datalist id={`set-duration-options-${index}`}>
                        {durationOptions.map((duration) => (
                          <option key={duration} value={duration} />
                        ))}
                      </datalist>
                    </td>
                    <td className="py-0.5 px-2 align-top">
                      <input
                        list={`set-instruction-options-${index}`}
                        value={getInstructionLabel(item.instruction)}
                        onChange={(event) => updateItem(index, 'instruction', normalizeInstructionValue(event.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Select/Type"
                        title="Instruction"
                      />
                      <datalist id={`set-instruction-options-${index}`}>
                        {instructionOptions.map((option) => (
                          <option key={option.value} value={option.label} />
                        ))}
                      </datalist>
                    </td>
                    <td className="py-0.5 px-2 align-top">
                      <input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(event) => updateItem(index, 'quantity', Number(event.target.value || 0))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        aria-label="Set medicine quantity"
                      />
                    </td>
                    <td className="py-0.5 px-2 text-center align-top">
                      <button
                        onClick={() => removeItem(index)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="Remove medicine"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Medicine
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 text-xs font-medium"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : editingSetId ? 'Update Set' : 'Create Set'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MedicineSetItemMedicineInputProps {
  item: MedicineSetFormItem;
  index: number;
  hospitalId: string;
  medicineOptions: Medicine[];
  onUpdate: (index: number, field: keyof MedicineSetFormItem, value: string | number) => void;
  onUpdateBatch: (index: number, updates: Partial<MedicineSetFormItem>) => void;
  onDropdownToggle: (open: boolean) => void;
}

function MedicineSetItemMedicineInput({
  item,
  index,
  hospitalId,
  medicineOptions,
  onUpdate,
  onUpdateBatch,
  onDropdownToggle,
}: MedicineSetItemMedicineInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState(item.medicineName || '');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [remoteMedicines, setRemoteMedicines] = useState<Medicine[]>([]);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(item.medicineName || '');
  }, [item.medicineName]);

  const localMatches = medicineOptions.filter(
    (medicine) =>
      medicine.hospitalId === hospitalId &&
      medicine.status === 'active' &&
      searchTerm.length > 0 &&
      (medicine.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        medicine.genericName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredMedicines = localMatches.length > 0 ? localMatches : remoteMedicines;

  const updateDropdownPosition = React.useCallback(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 99999,
      });
    }
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown) return;

    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [showDropdown, updateDropdownPosition]);

  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2 || localMatches.length > 0) {
      setRemoteMedicines([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/medicines', {
          params: {
            search: term,
            hospital_id: hospitalId,
          },
        });

        if (!active) return;

        const records: any[] = data.data ?? data;
        const mapped = records.map((medicine) => ({
          id: String(medicine.id),
          hospitalId: String(medicine.hospital_id),
          manufacturerId: String(medicine.manufacturer_id),
          medicineTypeId: String(medicine.medicine_type_id),
          brandName: medicine.brand_name ?? '',
          genericName: medicine.generic_name ?? '',
          strength: medicine.strength ?? '',
          type: medicine.type ?? medicine.medicine_type?.name ?? medicine.medicine_type_name ?? '',
          stock: typeof medicine.stock === 'number' ? medicine.stock : medicine.stock ? Number(medicine.stock) : undefined,
          status: (medicine.status ?? 'active') as Medicine['status'],
          createdAt: medicine.created_at ? new Date(medicine.created_at) : undefined,
          updatedAt: medicine.updated_at ? new Date(medicine.updated_at) : undefined,
        })) as Medicine[];

        setRemoteMedicines(mapped);
      } catch {
        if (active) setRemoteMedicines([]);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [hospitalId, localMatches.length, searchTerm]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredMedicines.length]);

  useEffect(() => {
    if (dropdownRef.current && filteredMedicines.length > 0) {
      const highlightedElement = dropdownRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex, filteredMedicines.length]);

  const handleSelectMedicine = (medicine: Medicine) => {
    const medicineType = medicine.type || '';
    const displayName = formatMedicineDisplay(medicine.brandName, medicine.genericName, medicineType, medicine.strength, true);
    setSearchTerm(displayName);

    onUpdateBatch(index, {
      medicineId: medicine.id,
      medicineName: displayName,
      strength: medicine.strength || '',
      type: medicineType,
    });

    setShowDropdown(false);
    onDropdownToggle(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && filteredMedicines.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((previous) => (previous < filteredMedicines.length - 1 ? previous + 1 : previous));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((previous) => (previous > 0 ? previous - 1 : 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredMedicines[highlightedIndex]) {
          handleSelectMedicine(filteredMedicines[highlightedIndex]);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setShowDropdown(false);
        onDropdownToggle(false);
      }
    } else if (event.key === 'Escape') {
      setShowDropdown(false);
      onDropdownToggle(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={(event) => {
          const value = event.target.value;
          setSearchTerm(value);
          onUpdate(index, 'medicineName', value);
          onUpdate(index, 'medicineId', '');
          setShowDropdown(true);
          onDropdownToggle(true);

          const currentInput = inputRef.current;
          if (currentInput) {
            currentInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }}
        onFocus={() => {
          setShowDropdown(true);
          onDropdownToggle(true);

          const currentInput = inputRef.current;
          if (currentInput) {
            currentInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            setShowDropdown(false);
            onDropdownToggle(false);
          }, 250);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type medicine name..."
        aria-label="Medicine search"
        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-800 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        autoComplete="off"
      />

      {item.medicineId ? (
        <span className="absolute -top-2 right-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
          Pharmacy
        </span>
      ) : (
        <span className="absolute -top-2 right-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
          Manual
        </span>
      )}

      {showDropdown && searchTerm.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-2xl overflow-hidden max-h-[280px] min-h-[60px]"
          >
            {filteredMedicines.length > 0 ? (
              <div className="overflow-y-auto max-h-[280px]">
                {filteredMedicines.map((medicine, medicineIndex) => {
                  const isHighlighted = medicineIndex === highlightedIndex;
                  return (
                    <button
                      key={medicine.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSelectMedicine(medicine);
                      }}
                      onMouseEnter={() => setHighlightedIndex(medicineIndex)}
                      className={`w-full px-3 py-2 text-left border-b border-gray-100 last:border-b-0 transition-colors cursor-pointer ${
                        isHighlighted ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30'
                      }`}
                      data-index={medicineIndex}
                    >
                      <div className="font-semibold text-xs text-gray-900 dark:text-white">
                        {formatMedicineDisplay(medicine.brandName, medicine.genericName, medicine.type, medicine.strength)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                <div className="mb-1 font-medium">No medicines found for "{searchTerm}"</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">Try a different search term</div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
