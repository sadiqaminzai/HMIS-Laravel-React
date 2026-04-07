import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, RefreshCw, ToggleRight, Printer, FileText } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import {
  listSurgeryTypes,
  createSurgeryType,
  updateSurgeryType,
  deleteSurgeryType,
  listSurgeries,
  createSurgery,
  updateSurgery,
  deleteSurgery,
  listPatientSurgeries,
  createPatientSurgery,
  updatePatientSurgery,
  deletePatientSurgery,
  togglePatientSurgeryPaymentStatus,
} from '../../api/surgeries';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { toast } from 'sonner';

type TabKey = 'types' | 'surgeries' | 'patientSurgeries';

interface SurgeryManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

interface SurgeryTypeItem {
  id: string;
  hospitalId: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface SurgeryItem {
  id: string;
  hospitalId: string;
  name: string;
  typeId: string;
  typeName?: string;
  cost: number;
  description?: string;
  isActive: boolean;
}

interface PatientSurgeryItem {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  doctorId?: string;
  doctorName?: string;
  surgeryId: string;
  surgeryName: string;
  surgeryDate: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'partial' | 'cancelled';
  cost: number;
  notes?: string;
}

const mapType = (item: any): SurgeryTypeItem => ({
  id: String(item.id),
  hospitalId: String(item.hospital_id),
  name: item.name,
  description: item.description || undefined,
  isActive: Boolean(item.is_active),
});

const mapSurgery = (item: any): SurgeryItem => ({
  id: String(item.id),
  hospitalId: String(item.hospital_id),
  name: item.name,
  typeId: String(item.type_id),
  typeName: item.type?.name,
  cost: Number(item.cost || 0),
  description: item.description || undefined,
  isActive: Boolean(item.is_active),
});

const mapPatientSurgery = (item: any): PatientSurgeryItem => ({
  id: String(item.id),
  hospitalId: String(item.hospital_id),
  patientId: String(item.patient_id),
  patientName: item.patient?.name || String(item.patient_id),
  doctorId: item.doctor_id ? String(item.doctor_id) : undefined,
  doctorName: item.doctor?.name,
  surgeryId: String(item.surgery_id),
  surgeryName: item.surgery?.name || String(item.surgery_id),
  surgeryDate: item.surgery_date,
  status: item.status,
  paymentStatus: item.payment_status,
  cost: Number(item.cost || 0),
  notes: item.notes || undefined,
});

export function SurgeryManagement({ hospital, userRole }: SurgeryManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const { patients } = usePatients();
  const { doctors } = useDoctors();

  const [activeTab, setActiveTab] = useState<TabKey>('types');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [types, setTypes] = useState<SurgeryTypeItem[]>([]);
  const [surgeries, setSurgeries] = useState<SurgeryItem[]>([]);
  const [patientSurgeries, setPatientSurgeries] = useState<PatientSurgeryItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<SurgeryTypeItem | null>(null);
  const [typeForm, setTypeForm] = useState({ name: '', description: '', isActive: true });

  const [isSurgeryModalOpen, setIsSurgeryModalOpen] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState<SurgeryItem | null>(null);
  const [surgeryForm, setSurgeryForm] = useState({ name: '', typeId: '', cost: '0', description: '', isActive: true });

  const [isPatientSurgeryModalOpen, setIsPatientSurgeryModalOpen] = useState(false);
  const [editingPatientSurgery, setEditingPatientSurgery] = useState<PatientSurgeryItem | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [patientSurgeryForm, setPatientSurgeryForm] = useState({
    patientId: '',
    doctorId: '',
    surgeryId: '',
    surgeryDate: new Date().toISOString().slice(0, 10),
    status: 'scheduled' as PatientSurgeryItem['status'],
    paymentStatus: 'pending' as PatientSurgeryItem['paymentStatus'],
    cost: '',
    notes: '',
    isActive: true,
  });

  const hospitalParam = userRole === 'super_admin' && selectedHospitalId !== 'all' ? selectedHospitalId : undefined;

  const loadAll = async () => {
    setLoading(true);
    try {
      const [typesRes, surgeriesRes, patientSurgeriesRes] = await Promise.all([
        listSurgeryTypes({ hospital_id: hospitalParam, search: search || undefined, per_page: 100 }),
        listSurgeries({ hospital_id: hospitalParam, search: search || undefined, per_page: 100 }),
        listPatientSurgeries({ hospital_id: hospitalParam, search: search || undefined, per_page: 100 }),
      ]);
      setTypes((typesRes.data ?? []).map(mapType));
      setSurgeries((surgeriesRes.data ?? []).map(mapSurgery));
      setPatientSurgeries((patientSurgeriesRes.data ?? []).map(mapPatientSurgery));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load surgery data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospitalId]);

  const filteredPatients = patients.filter((p) => selectedHospitalId === 'all' || p.hospitalId === currentHospital.id || p.hospitalId === selectedHospitalId);
  const filteredDoctors = doctors.filter((d) => selectedHospitalId === 'all' || d.hospitalId === currentHospital.id || d.hospitalId === selectedHospitalId);

  const filteredTypes = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return types;
    return types.filter((row) =>
      row.name.toLowerCase().includes(term) ||
      (row.description || '').toLowerCase().includes(term)
    );
  }, [types, search]);

  const filteredSurgeries = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return surgeries;
    return surgeries.filter((row) =>
      row.name.toLowerCase().includes(term) ||
      (row.typeName || '').toLowerCase().includes(term)
    );
  }, [surgeries, search]);

  const filteredPatientSurgeries = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return patientSurgeries;
    return patientSurgeries.filter((row) =>
      row.patientName.toLowerCase().includes(term) ||
      row.surgeryName.toLowerCase().includes(term) ||
      (row.doctorName || '').toLowerCase().includes(term)
    );
  }, [patientSurgeries, search]);

  const selectedRows = useMemo(() => {
    if (activeTab === 'types') return filteredTypes;
    if (activeTab === 'surgeries') return filteredSurgeries;
    return filteredPatientSurgeries;
  }, [activeTab, filteredTypes, filteredSurgeries, filteredPatientSurgeries]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(selectedRows.length / itemsPerPage));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return selectedRows.slice(start, start + itemsPerPage);
  }, [selectedRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search, selectedHospitalId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentHospitalId = userRole === 'super_admin' && selectedHospitalId !== 'all' ? selectedHospitalId : currentHospital.id;

  const saveType = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      hospital_id: currentHospitalId,
      name: typeForm.name,
      description: typeForm.description || undefined,
      is_active: typeForm.isActive,
    };
    try {
      if (editingType) {
        await updateSurgeryType(editingType.id, payload);
        toast.success('Surgery type updated');
      } else {
        await createSurgeryType(payload);
        toast.success('Surgery type created');
      }
      setIsTypeModalOpen(false);
      setEditingType(null);
      setTypeForm({ name: '', description: '', isActive: true });
      loadAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save surgery type');
    }
  };

  const saveSurgery = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      hospital_id: currentHospitalId,
      name: surgeryForm.name,
      type_id: surgeryForm.typeId,
      cost: Number(surgeryForm.cost || 0),
      description: surgeryForm.description || undefined,
      is_active: surgeryForm.isActive,
    };
    try {
      if (editingSurgery) {
        await updateSurgery(editingSurgery.id, payload);
        toast.success('Surgery updated');
      } else {
        await createSurgery(payload);
        toast.success('Surgery created');
      }
      setIsSurgeryModalOpen(false);
      setEditingSurgery(null);
      setSurgeryForm({ name: '', typeId: '', cost: '0', description: '', isActive: true });
      loadAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save surgery');
    }
  };

  const savePatientSurgery = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      hospital_id: currentHospitalId,
      patient_id: patientSurgeryForm.patientId,
      doctor_id: patientSurgeryForm.doctorId || undefined,
      surgery_id: patientSurgeryForm.surgeryId,
      surgery_date: patientSurgeryForm.surgeryDate,
      status: patientSurgeryForm.status,
      payment_status: patientSurgeryForm.paymentStatus,
      cost: patientSurgeryForm.cost === '' ? undefined : Number(patientSurgeryForm.cost),
      notes: patientSurgeryForm.notes || undefined,
      is_active: patientSurgeryForm.isActive,
    };
    try {
      if (editingPatientSurgery) {
        await updatePatientSurgery(editingPatientSurgery.id, payload);
        toast.success('Patient surgery updated');
      } else {
        await createPatientSurgery(payload);
        toast.success('Patient surgery created');
      }
      setIsPatientSurgeryModalOpen(false);
      setEditingPatientSurgery(null);
      setPatientSurgeryForm({
        patientId: '',
        doctorId: '',
        surgeryId: '',
        surgeryDate: new Date().toISOString().slice(0, 10),
        status: 'scheduled',
        paymentStatus: 'pending',
        cost: '',
        notes: '',
        isActive: true,
      });
      loadAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save patient surgery');
    }
  };

  useEffect(() => {
    if (!patientSurgeryForm.surgeryId) return;
    if (patientSurgeryForm.cost !== '') return;

    const selected = surgeries.find((s) => s.id === patientSurgeryForm.surgeryId);
    if (!selected) return;

    setPatientSurgeryForm((prev) => ({ ...prev, cost: String(selected.cost ?? 0) }));
  }, [patientSurgeryForm.surgeryId, patientSurgeryForm.cost, surgeries]);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Surgery Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage surgery types, surgeries, and patient surgery scheduling.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="px-3 py-2 rounded border text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Refresh</button>
          {activeTab === 'types' && <button onClick={() => { setEditingType(null); setTypeForm({ name: '', description: '', isActive: true }); setIsTypeModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add Type</button>}
          {activeTab === 'surgeries' && <button onClick={() => { setEditingSurgery(null); setSurgeryForm({ name: '', typeId: '', cost: '0', description: '', isActive: true }); setIsSurgeryModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add Surgery</button>}
          {activeTab === 'patientSurgeries' && <button onClick={() => { setEditingPatientSurgery(null); setPatientSurgeryForm({ patientId: '', doctorId: '', surgeryId: '', surgeryDate: new Date().toISOString().slice(0, 10), status: 'scheduled', paymentStatus: 'pending', cost: '', notes: '', isActive: true }); setIsPatientSurgeryModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add Patient Surgery</button>}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setActiveTab('types')} className={`px-3 py-2 text-sm rounded ${activeTab === 'types' ? 'bg-blue-600 text-white' : 'border'}`}>Surgery Types</button>
        <button onClick={() => setActiveTab('surgeries')} className={`px-3 py-2 text-sm rounded ${activeTab === 'surgeries' ? 'bg-blue-600 text-white' : 'border'}`}>Surgeries</button>
        <button onClick={() => setActiveTab('patientSurgeries')} className={`px-3 py-2 text-sm rounded ${activeTab === 'patientSurgeries' ? 'bg-blue-600 text-white' : 'border'}`}>Patient Surgeries</button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                {activeTab === 'types' && <><th className="px-4 py-2">Name</th><th className="px-4 py-2">Description</th><th className="px-4 py-2">Status</th></>}
                {activeTab === 'surgeries' && <><th className="px-4 py-2">Name</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Cost</th><th className="px-4 py-2">Status</th></>}
                {activeTab === 'patientSurgeries' && <><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Surgery</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Payment</th><th className="px-4 py-2">Cost</th></>}
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td className="px-4 py-6" colSpan={7}>Loading...</td></tr>
              ) : selectedRows.length === 0 ? (
                <tr><td className="px-4 py-6 text-center" colSpan={7}>No records found</td></tr>
              ) : (
                <>
                  {activeTab === 'types' && (paginatedRows as SurgeryTypeItem[]).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.name}</td>
                      <td className="px-4 py-2">{row.description || '-'}</td>
                      <td className="px-4 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setEditingType(row); setTypeForm({ name: row.name, description: row.description || '', isActive: row.isActive }); setIsTypeModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Pencil className="w-4 h-4" /></button>
                          <button onClick={async () => { try { await deleteSurgeryType(row.id); toast.success('Surgery type deleted'); loadAll(); } catch (e: any) { toast.error(e?.response?.data?.message || 'Delete failed'); } }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeTab === 'surgeries' && (paginatedRows as SurgeryItem[]).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.name}</td>
                      <td className="px-4 py-2">{row.typeName || row.typeId}</td>
                      <td className="px-4 py-2">{row.cost.toFixed(2)}</td>
                      <td className="px-4 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setEditingSurgery(row); setSurgeryForm({ name: row.name, typeId: row.typeId, cost: String(row.cost), description: row.description || '', isActive: row.isActive }); setIsSurgeryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Pencil className="w-4 h-4" /></button>
                          <button onClick={async () => { try { await deleteSurgery(row.id); toast.success('Surgery deleted'); loadAll(); } catch (e: any) { toast.error(e?.response?.data?.message || 'Delete failed'); } }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeTab === 'patientSurgeries' && (paginatedRows as PatientSurgeryItem[]).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.patientName}</td>
                      <td className="px-4 py-2">{row.surgeryName}</td>
                      <td className="px-4 py-2">{row.surgeryDate}</td>
                      <td className="px-4 py-2">{row.status}</td>
                      <td className="px-4 py-2">{row.paymentStatus}</td>
                      <td className="px-4 py-2">{row.cost.toFixed(2)}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setEditingPatientSurgery(row); setShowInvoiceModal(true); }} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-md" title="Print Invoice"><Printer className="w-4 h-4" /></button>
                          <button onClick={async () => { try { const updated = await togglePatientSurgeryPaymentStatus(row.id); setPatientSurgeries((prev) => prev.map((item) => item.id === row.id ? mapPatientSurgery(updated) : item)); toast.success('Payment status toggled'); } catch (e: any) { toast.error(e?.response?.data?.message || 'Toggle failed'); } }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md" title="Toggle payment pending/paid"><ToggleRight className="w-4 h-4" /></button>
                          <button onClick={() => { setEditingPatientSurgery(row); setPatientSurgeryForm({ patientId: row.patientId, doctorId: row.doctorId || '', surgeryId: row.surgeryId, surgeryDate: row.surgeryDate, status: row.status, paymentStatus: row.paymentStatus, cost: String(row.cost), notes: row.notes || '', isActive: true }); setIsPatientSurgeryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Pencil className="w-4 h-4" /></button>
                          <button onClick={async () => { try { await deletePatientSurgery(row.id); toast.success('Patient surgery deleted'); loadAll(); } catch (e: any) { toast.error(e?.response?.data?.message || 'Delete failed'); } }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {!loading && selectedRows.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
            <span>Showing {paginatedRows.length} of {selectedRows.length} rows</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Prev
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isTypeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{editingType ? 'Edit Surgery Type' : 'Add Surgery Type'}</h2>
              <button onClick={() => setIsTypeModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title="Close"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveType} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12"><label className="text-xs font-medium">Name</label><input value={typeForm.name} onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))} required className="mt-1 w-full rounded border px-3 py-2 text-sm" /></div>
              <div className="col-span-12"><label className="text-xs font-medium">Description</label><input value={typeForm.description} onChange={(e) => setTypeForm((p) => ({ ...p, description: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></div>
              <div className="col-span-12 flex items-center gap-2"><input id="type-active" type="checkbox" checked={typeForm.isActive} onChange={(e) => setTypeForm((p) => ({ ...p, isActive: e.target.checked }))} /><label htmlFor="type-active" className="text-sm">Active</label></div>
              <div className="col-span-12 flex items-center justify-end gap-2"><button type="button" onClick={() => setIsTypeModalOpen(false)} className="px-3 py-2 text-sm rounded border">Cancel</button><button type="submit" className="px-3 py-2 text-sm rounded bg-blue-600 text-white">{editingType ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {isSurgeryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{editingSurgery ? 'Edit Surgery' : 'Add Surgery'}</h2>
              <button onClick={() => setIsSurgeryModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title="Close"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveSurgery} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12"><label className="text-xs font-medium">Name</label><input value={surgeryForm.name} onChange={(e) => setSurgeryForm((p) => ({ ...p, name: e.target.value }))} required className="mt-1 w-full rounded border px-3 py-2 text-sm" /></div>
              <div className="col-span-12"><label className="text-xs font-medium">Type</label><select value={surgeryForm.typeId} onChange={(e) => setSurgeryForm((p) => ({ ...p, typeId: e.target.value }))} required className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="">Select type</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="col-span-12 md:col-span-6"><label className="text-xs font-medium">Cost</label><input type="number" min={0} step="0.01" value={surgeryForm.cost} onChange={(e) => setSurgeryForm((p) => ({ ...p, cost: e.target.value }))} required className="mt-1 w-full rounded border px-3 py-2 text-sm" /></div>
              <div className="col-span-12 md:col-span-6 flex items-end gap-2 pb-2"><input id="surgery-active" type="checkbox" checked={surgeryForm.isActive} onChange={(e) => setSurgeryForm((p) => ({ ...p, isActive: e.target.checked }))} /><label htmlFor="surgery-active" className="text-sm">Active</label></div>
              <div className="col-span-12"><label className="text-xs font-medium">Description</label><input value={surgeryForm.description} onChange={(e) => setSurgeryForm((p) => ({ ...p, description: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></div>
              <div className="col-span-12 flex items-center justify-end gap-2"><button type="button" onClick={() => setIsSurgeryModalOpen(false)} className="px-3 py-2 text-sm rounded border">Cancel</button><button type="submit" className="px-3 py-2 text-sm rounded bg-blue-600 text-white">{editingSurgery ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {isPatientSurgeryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{editingPatientSurgery ? 'Edit Patient Surgery' : 'Add Patient Surgery'}</h2>
              <button onClick={() => setIsPatientSurgeryModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title="Close"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={savePatientSurgery} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6"><label className="text-xs font-medium">Patient</label><select value={patientSurgeryForm.patientId} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, patientId: e.target.value }))} required className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="">Select patient</option>{filteredPatients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="col-span-12 md:col-span-6"><label className="text-xs font-medium">Doctor (optional)</label><select value={patientSurgeryForm.doctorId} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, doctorId: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="">None</option>{filteredDoctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div className="col-span-12 md:col-span-6"><label className="text-xs font-medium">Surgery</label><select value={patientSurgeryForm.surgeryId} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, surgeryId: e.target.value }))} required className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="">Select surgery</option>{surgeries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="col-span-12 md:col-span-6"><label className="text-xs font-medium">Surgery Date</label><input type="date" value={patientSurgeryForm.surgeryDate} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, surgeryDate: e.target.value }))} required className="mt-1 w-full rounded border px-3 py-2 text-sm" /></div>
              <div className="col-span-12 md:col-span-4"><label className="text-xs font-medium">Status</label><select value={patientSurgeryForm.status} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, status: e.target.value as PatientSurgeryItem['status'] }))} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="scheduled">scheduled</option><option value="in_progress">in_progress</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select></div>
              <div className="col-span-12 md:col-span-4"><label className="text-xs font-medium">Payment Status</label><select value={patientSurgeryForm.paymentStatus} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, paymentStatus: e.target.value as PatientSurgeryItem['paymentStatus'] }))} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="pending">pending</option><option value="paid">paid</option><option value="partial">partial</option><option value="cancelled">cancelled</option></select></div>
              <div className="col-span-12 md:col-span-4"><label className="text-xs font-medium">Cost (optional)</label><input type="number" min={0} step="0.01" value={patientSurgeryForm.cost} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, cost: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></div>
              <div className="col-span-12"><label className="text-xs font-medium">Notes</label><input value={patientSurgeryForm.notes} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></div>
              <div className="col-span-12 flex items-center gap-2"><input id="ps-active" type="checkbox" checked={patientSurgeryForm.isActive} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, isActive: e.target.checked }))} /><label htmlFor="ps-active" className="text-sm">Active</label></div>
              <div className="col-span-12 flex items-center justify-end gap-2"><button type="button" onClick={() => setIsPatientSurgeryModalOpen(false)} className="px-3 py-2 text-sm rounded border">Cancel</button><button type="submit" className="px-3 py-2 text-sm rounded bg-blue-600 text-white">{editingPatientSurgery ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showInvoiceModal && editingPatientSurgery && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Surgery Invoice
              </h2>
              <button onClick={() => setShowInvoiceModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 max-h-[70vh] overflow-y-auto">
              <div id="surgery-invoice-print" className="bg-white text-black p-8 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h1 className="text-2xl font-bold text-blue-900">{hospital.name}</h1>
                    <p className="text-sm text-gray-600">Surgery Department</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold text-gray-400 uppercase">Invoice</h2>
                    <p className="text-sm text-gray-600">No: SURG-{editingPatientSurgery.id}</p>
                    <p className="text-sm text-gray-600">Date: {editingPatientSurgery.surgeryDate}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Patient Details</h3>
                    <p className="font-bold">{editingPatientSurgery.patientName}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Surgeon</h3>
                    <p className="font-bold">Dr. {editingPatientSurgery.doctorName || 'N/A'}</p>
                  </div>
                </div>

                <table className="w-full mb-8">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2 font-bold">Description</th>
                      <th className="text-right py-2 font-bold">Status</th>
                      <th className="text-right py-2 font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-50">
                      <td className="py-4">
                        <p className="font-bold">{editingPatientSurgery.surgeryName}</p>
                        <p className="text-xs text-gray-500 italic">{editingPatientSurgery.notes || 'No notes'}</p>
                      </td>
                      <td className="py-4 text-right capitalize">{editingPatientSurgery.status}</td>
                      <td className="py-4 text-right">{editingPatientSurgery.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-1/2 space-y-2 font-bold">
                    <div className="flex justify-between text-lg text-blue-900 pt-2 border-t-2 border-blue-900">
                      <span>Total Amount</span>
                      <span>{editingPatientSurgery.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600 capitalize italic">
                      <span>Payment Status</span>
                      <span>{editingPatientSurgery.paymentStatus}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-16 text-center text-xs text-gray-400">
                  <p>Computer generated invoice - no signature required.</p>
                  <p>Thank you for choosing {hospital.name}.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 text-sm font-medium border rounded-md">Close</button>
              <button
                onClick={() => setTimeout(() => window.print(), 100)}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>

          <style>
            {`
              @media print {
                html, body {
                  height: auto !important;
                  overflow: visible !important;
                  background: white !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                body * {
                  visibility: hidden;
                }
                #surgery-invoice-print, #surgery-invoice-print * {
                  visibility: visible !important;
                }
                /* Break out of the fixed modal container for printing */
                .fixed.inset-0 {
                  position: absolute !important;
                  display: block !important;
                  height: auto !important;
                  min-height: 100vh !important;
                  width: 100% !important;
                  overflow: visible !important;
                  background: transparent !important;
                }
                .max-h-\\[70vh\\] {
                  max-height: none !important;
                  overflow: visible !important;
                }
                #surgery-invoice-print {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  padding: 20mm !important;
                  margin: 0 !important;
                  box-sizing: border-box !important;
                }
                @page { margin: 0; size: auto; }
              }
            `}
          </style>
        </div>
      )}
    </div>
  );
}
