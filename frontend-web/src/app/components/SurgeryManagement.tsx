import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, RefreshCw, ToggleRight, Printer, FileText } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import '../../styles/quill-custom.css';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { DischargeSummaryPrint } from './DischargeSummaryPrint';
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
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

type TabKey = 'types' | 'surgeries' | 'patientSurgeries' | 'dischargeSummary';

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
  dischargeDate?: string;
  dischargeSummary?: string;
  dischargeCreatedBy?: string;
  dischargeCompletedBy?: string;
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
  hospitalId: String(item.hospital_id ?? item.hospitalId ?? ''),
  patientId: String(item.patient_id ?? item.patientId ?? ''),
  patientName: item.patient?.name || item.patient_name || item.patientName || String(item.patient_id ?? item.patientId ?? ''),
  doctorId: (item.doctor_id ?? item.doctorId) ? String(item.doctor_id ?? item.doctorId) : undefined,
  doctorName: item.doctor?.name,
  surgeryId: String(item.surgery_id ?? item.surgeryId ?? ''),
  surgeryName: item.surgery?.name || item.surgery_name || item.surgeryName || String(item.surgery_id ?? item.surgeryId ?? ''),
  surgeryDate: String(item.surgery_date ?? item.surgeryDate ?? '').slice(0, 10),
  status: item.status,
  paymentStatus: item.payment_status ?? item.paymentStatus,
  cost: Number(item.cost || 0),
  notes: item.notes || undefined,
  dischargeDate: item.discharge_date ? String(item.discharge_date).slice(0, 10) : undefined,
  dischargeSummary: item.discharge_summary || undefined,
  dischargeCreatedBy: item.discharge_created_by || undefined,
  dischargeCompletedBy: item.discharge_completed_by || undefined,
});

export function SurgeryManagement({ hospital, userRole }: SurgeryManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { user } = useAuth();

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
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
  const [editingDischargeSurgery, setEditingDischargeSurgery] = useState<PatientSurgeryItem | null>(null);
  const [dischargeForm, setDischargeForm] = useState({
    patientSurgeryId: '',
    dischargeDate: new Date().toISOString().slice(0, 10),
    dischargeSummary: '',
    dischargeCreatedBy: '',
    dischargeCompletedBy: '',
  });
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
    const [receiptSize, setReceiptSize] = useState<'a4' | '58mm' | '76mm' | '80mm'>(() => {
      const saved = localStorage.getItem('surgery_receipt_size');
      if (saved === '58mm' || saved === '76mm' || saved === '80mm' || saved === 'a4') return saved;
      return '80mm';
    });

  const [printingDischargeItem, setPrintingDischargeItem] = useState<PatientSurgeryItem | null>(null);

  const getAssignedDoctorName = (row?: PatientSurgeryItem | null) => {
    if (!row) return '';
    const byId = doctors.find((d) => String(d.id) === String(row.doctorId));
    return row.doctorName || byId?.name || '';
  };

  const buildDischargeTemplate = (row?: PatientSurgeryItem | null) => {
    const assignedDoctorName = getAssignedDoctorName(row) || 'Assigned doctor';

    return `
      <h3>Hospital Course</h3>
      <ul>
        <li>Patient remained clinically stable during admission.</li>
        <li>Pain and symptoms improved with treatment.</li>
        <li>No immediate post-operative complications were observed.</li>
      </ul>
      <h3>Discharge Instructions</h3>
      <ul>
        <li>Continue discharge medications as prescribed.</li>
        <li>Maintain wound care and hydration as advised.</li>
        <li>Return urgently for fever, bleeding, severe pain, or breathing difficulty.</li>
      </ul>
      <h3>Follow-up Plan</h3>
      <p>Follow up with ${assignedDoctorName} in 5-7 days or earlier if symptoms worsen.</p>
    `;
  };

  const getCurrentDischargeCase = () => {
    return (
      patientSurgeries.find((item) => item.id === dischargeForm.patientSurgeryId) ||
      editingDischargeSurgery ||
      null
    );
  };

  const resetDischargeTemplate = () => {
    const currentCase = getCurrentDischargeCase();
    setEditingDischargeSurgery(currentCase);
    setDischargeForm((prev) => ({
      ...prev,
      dischargeSummary: '',
    }));
  };

    useEffect(() => {
      localStorage.setItem('surgery_receipt_size', receiptSize);
    }, [receiptSize]);

    const printSurgeryReceipt = (item: PatientSurgeryItem, size: 'a4' | '58mm' | '76mm' | '80mm' = receiptSize) => {
      const isCompactReceipt = size !== 'a4';
      const ticketWidth = isCompactReceipt ? size : '190mm';
      const pageRule = isCompactReceipt
        ? `@page { size: ${size} auto; margin: 0; }`
        : '@page { size: A4; margin: 10mm; }';
      
      const receiptHtml = `
        <html>
          <head>
            <title>Surgery Invoice</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                color: #111827;
                margin: 0;
                background: ${isCompactReceipt ? '#ffffff' : '#f3f4f6'};
                padding: ${isCompactReceipt ? '0' : '20px'};
                font-size: ${isCompactReceipt ? '10px' : '14px'};
              }
              .ticket {
                width: ${ticketWidth};
                margin: 0 auto;
                background: #ffffff;
                border: ${isCompactReceipt ? 'none' : '1px solid #e5e7eb'};
                border-radius: ${isCompactReceipt ? '0' : '10px'};
                padding: ${isCompactReceipt ? '10px' : '30px'};
                box-shadow: ${isCompactReceipt ? 'none' : '0 4px 14px rgba(0, 0, 0, 0.08)'};
              }
              .header {
                text-align: center;
                border-bottom: 2px solid #1e3a8a;
                padding-bottom: 10px;
                margin-bottom: 15px;
              }
              .hospital-name {
                font-size: ${isCompactReceipt ? '14px' : '24px'};
                font-weight: bold;
                color: #1e3a8a;
                margin: 0 0 4px 0;
              }
              .dept {
                color: #000000;
                margin: 0;
              }
              .meta-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 15px;
                ${isCompactReceipt ? 'flex-direction: column; gap: 8px;' : ''}
              }
              .meta-block {
                ${isCompactReceipt ? 'width: 100%;' : 'width: 48%;'}
              }
              .label {
                font-size: 10px;
                text-transform: uppercase;
                color: #000000;
                font-weight: bold;
                margin-bottom: 2px;
              }
              .value { font-weight: bold; margin: 0; color: #000000; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th { text-align: left; border-bottom: 2px solid #e5e7eb; padding: 6px 0; color: #000000; }
              th.text-right, td.text-right { text-align: right; }
              td { padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #000000; }
              .notes { font-size: ${isCompactReceipt ? '9px' : '12px'}; color: #000000; font-style: italic; margin-top: 2px; }
              .totals {
                border-top: 2px solid #1e3a8a;
                padding-top: 10px;
                text-align: right;
              }
              .totals div {
                display: flex;
                justify-content: ${isCompactReceipt ? 'space-between' : 'flex-end'};
                margin-bottom: 5px;
                font-weight: bold;
              }
              .totals span:first-child { width: 120px; color: #1e3a8a; }
              .footer { text-align: center; color: #000000; font-size: 10px; margin-top: 30px; }
              @media print {
                * {
                  color: #000000 !important;
                }
                body { background: #ffffff; padding: 0; }
                .ticket { border: none; box-shadow: none; margin: 0; padding: ${isCompactReceipt ? '6px' : '0'}; width: ${ticketWidth}; }
                ${pageRule}
              }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="header">
                <h1 class="hospital-name">${hospital.name}</h1>
                <p class="dept">Surgery Department</p>
                <div style="margin-top: 6px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Invoice</div>
              </div>
              
              <div class="meta-row">
                <div class="meta-block">
                  <div class="label">Patient Name</div>
                  <div class="value">${item.patientName}</div>
                </div>
                <div class="meta-block" style="${isCompactReceipt ? '' : 'text-align: right;'}">
                  <div class="label">Invoice No / Date</div>
                  <div class="value">SURG-${item.id}</div>
                  <div style="font-size: ${isCompactReceipt ? '10px' : '14px'}">${item.surgeryDate}</div>
                </div>
              </div>
              
              <div class="meta-row">
                <div class="meta-block">
                  <div class="label">Surgeon</div>
                  <div class="value">${item.doctorName || 'N/A'}</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div class="value">${item.surgeryName}</div>
                      <div class="notes">${item.notes || 'No notes'}</div>
                    </td>
                    <td class="text-right value">${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>

              <div class="totals">
                <div>
                  <span>Total Amount:</span>
                  <span>${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style="color: #16a34a; font-size: ${isCompactReceipt ? '10px' : '14px'}">
                  <span style="color: inherit">Payment Status:</span>
                  <span style="text-transform: uppercase; font-style: italic;">${item.paymentStatus}</span>
                </div>
              </div>

              <div class="footer">
                <p style="margin:0 0 2px 0">${hospital.address || ''}</p>
                <p style="margin:0">softcareitsolutions.com</p>
              </div>
            </div>
            <script>window.onload = function() { window.print(); window.close(); }</script>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=900,height=700');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
      }
    };

  const hospitalParam = userRole === 'super_admin'
    ? (selectedHospitalId !== 'all' ? selectedHospitalId : undefined)
    : currentHospital.id;

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

  const filteredDischargeSummaries = useMemo(() => {
    const term = search.toLowerCase().trim();
    const rows = patientSurgeries.filter((row) =>
      Boolean((row.dischargeSummary || '').replace(/<[^>]*>/g, '').trim()) || Boolean(row.dischargeDate)
    );

    if (!term) return rows;

    return rows.filter((row) =>
      row.patientName.toLowerCase().includes(term) ||
      row.surgeryName.toLowerCase().includes(term) ||
      (row.doctorName || '').toLowerCase().includes(term) ||
      (row.dischargeCreatedBy || '').toLowerCase().includes(term) ||
      (row.dischargeCompletedBy || '').toLowerCase().includes(term) ||
      (row.dischargeSummary || '').toLowerCase().includes(term)
    );
  }, [patientSurgeries, search]);

  const selectedRows = useMemo(() => {
    if (activeTab === 'types') return filteredTypes;
    if (activeTab === 'surgeries') return filteredSurgeries;
    if (activeTab === 'dischargeSummary') return filteredDischargeSummaries;
    return filteredPatientSurgeries;
  }, [activeTab, filteredTypes, filteredSurgeries, filteredPatientSurgeries, filteredDischargeSummaries]);

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

  const openDischargeModal = (row: PatientSurgeryItem) => {
    const assignedDoctorName = getAssignedDoctorName(row);
    setEditingDischargeSurgery(row);
    setDischargeForm({
      patientSurgeryId: row.id,
      dischargeDate: row.dischargeDate || new Date().toISOString().slice(0, 10),
      dischargeSummary: row.dischargeSummary || buildDischargeTemplate(row),
      dischargeCreatedBy: row.dischargeCreatedBy || user?.name || '',
      dischargeCompletedBy: row.dischargeCompletedBy || assignedDoctorName,
    });
    setIsDischargeModalOpen(true);
  };

  const openNewDischargeModal = () => {
    const firstCase = patientSurgeries[0];
    const assignedDoctorName = getAssignedDoctorName(firstCase);
    setEditingDischargeSurgery(firstCase || null);
    setDischargeForm({
      patientSurgeryId: firstCase?.id || '',
      dischargeDate: new Date().toISOString().slice(0, 10),
      dischargeSummary: buildDischargeTemplate(firstCase),
      dischargeCreatedBy: user?.name || '',
      dischargeCompletedBy: assignedDoctorName,
    });
    setIsDischargeModalOpen(true);
  };

  const saveDischargeSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSurgery = editingDischargeSurgery || patientSurgeries.find((item) => item.id === dischargeForm.patientSurgeryId);
    if (!targetSurgery) {
      toast.error('Please select a patient surgery case');
      return;
    }

    const summaryText = dischargeForm.dischargeSummary.replace(/<[^>]*>/g, '').trim();
    if (!summaryText) {
      toast.error('Discharge summary is required');
      return;
    }

    const payload = {
      hospital_id: targetSurgery.hospitalId,
      patient_id: targetSurgery.patientId,
      doctor_id: targetSurgery.doctorId || undefined,
      surgery_id: targetSurgery.surgeryId,
      surgery_date: targetSurgery.surgeryDate,
      status: targetSurgery.status,
      payment_status: targetSurgery.paymentStatus,
      cost: targetSurgery.cost,
      notes: targetSurgery.notes || undefined,
      is_active: true,
      discharge_date: dischargeForm.dischargeDate || undefined,
      discharge_summary: dischargeForm.dischargeSummary,
      discharge_created_by: dischargeForm.dischargeCreatedBy || undefined,
      discharge_completed_by: dischargeForm.dischargeCompletedBy || undefined,
    };

    try {
      const updated = await updatePatientSurgery(targetSurgery.id, payload);
      const normalized = mapPatientSurgery(updated);
      setPatientSurgeries((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
      setIsDischargeModalOpen(false);
      setEditingDischargeSurgery(null);
      toast.success('Discharge summary saved');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save discharge summary');
    }
  };

  const printDischargeSummary = (item: PatientSurgeryItem) => { setPrintingDischargeItem(item); };

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
          {activeTab === 'dischargeSummary' && <button onClick={openNewDischargeModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add Discharge Summary</button>}
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
        <button onClick={() => setActiveTab('dischargeSummary')} className={`px-3 py-2 text-sm rounded ${activeTab === 'dischargeSummary' ? 'bg-blue-600 text-white' : 'border'}`}>Discharge Summary</button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                {activeTab === 'types' && <><th className="px-4 py-2">Name</th><th className="px-4 py-2">Description</th><th className="px-4 py-2">Status</th></>}
                {activeTab === 'surgeries' && <><th className="px-4 py-2">Name</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Cost</th><th className="px-4 py-2">Status</th></>}
                {activeTab === 'patientSurgeries' && <><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Surgery</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Payment</th><th className="px-4 py-2">Cost</th></>}
                {activeTab === 'dischargeSummary' && <><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Surgery</th><th className="px-4 py-2">Discharge Date</th><th className="px-4 py-2">Created By</th><th className="px-4 py-2">Completed By</th><th className="px-4 py-2">Summary</th></>}
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
                          <button onClick={() => { const normalizedDate = String(row.surgeryDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10); setEditingPatientSurgery(row); setPatientSurgeryForm({ patientId: row.patientId, doctorId: row.doctorId || '', surgeryId: row.surgeryId, surgeryDate: normalizedDate, status: row.status, paymentStatus: row.paymentStatus, cost: String(row.cost), notes: row.notes || '', isActive: true }); setIsPatientSurgeryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Pencil className="w-4 h-4" /></button>
                          <button onClick={async () => { try { await deletePatientSurgery(row.id); toast.success('Patient surgery deleted'); loadAll(); } catch (e: any) { toast.error(e?.response?.data?.message || 'Delete failed'); } }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeTab === 'dischargeSummary' && (paginatedRows as PatientSurgeryItem[]).map((row) => {
                    const summaryPlain = (row.dischargeSummary || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.patientName}</td>
                        <td className="px-4 py-2">{row.surgeryName}</td>
                        <td className="px-4 py-2">{row.dischargeDate || '-'}</td>
                        <td className="px-4 py-2">{row.dischargeCreatedBy || '-'}</td>
                        <td className="px-4 py-2">{row.dischargeCompletedBy || '-'}</td>
                        <td className="px-4 py-2 max-w-[320px] truncate" title={summaryPlain}>{summaryPlain || '-'}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openDischargeModal(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title="Edit discharge summary"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => printDischargeSummary(row)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md" title="Print discharge summary"><Printer className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {isDischargeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[55] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[72vh] border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editingDischargeSurgery ? 'Edit Discharge Summary' : 'Add Discharge Summary'}</h2>
              </div>
              <button onClick={() => setIsDischargeModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title="Close"><X className="w-5 h-5" /></button>
            </div>
            <style>
              {`
                .discharge-editor .ql-toolbar.ql-snow {
                  border: 0;
                  border-bottom: 1px solid #e5e7eb;
                  background: #f8fafc;
                }
                .discharge-editor .ql-container.ql-snow {
                  border: 0;
                }
                .discharge-editor .ql-editor {
                  min-height: 120px;
                  max-height: 170px;
                  overflow-y: auto;
                  font-size: 14px;
                  line-height: 1.55;
                }
              `}
            </style>
            <form onSubmit={saveDischargeSummary} className="p-4 sm:p-5 grid grid-cols-12 gap-3 overflow-y-auto max-h-[calc(72vh-86px)]">
              <div className="col-span-12">
                <label className="text-xs font-medium">Patient Surgery Case</label>
                <select
                  value={dischargeForm.patientSurgeryId}
                  onChange={(e) => {
                    const selected = patientSurgeries.find((item) => item.id === e.target.value);
                    const assignedDoctorName = getAssignedDoctorName(selected);
                    setEditingDischargeSurgery(selected || null);
                    setDischargeForm((prev) => ({
                      ...prev,
                      patientSurgeryId: e.target.value,
                      dischargeDate: selected?.dischargeDate || prev.dischargeDate,
                      dischargeSummary: selected?.dischargeSummary || buildDischargeTemplate(selected),
                      dischargeCreatedBy: selected?.dischargeCreatedBy || user?.name || prev.dischargeCreatedBy,
                      dischargeCompletedBy: selected?.dischargeCompletedBy || assignedDoctorName,
                    }));
                  }}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select surgery case</option>
                  {patientSurgeries.map((row) => (
                    <option key={row.id} value={row.id}>
                      SURG-{row.id} | {row.patientName} | {row.surgeryName} | {row.surgeryDate}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-12 sm:col-span-6">
                <label className="text-xs font-medium">Discharge Date</label>
                <input
                  type="date"
                  value={dischargeForm.dischargeDate}
                  onChange={(e) => setDischargeForm((prev) => ({ ...prev, dischargeDate: e.target.value }))}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <label className="text-xs font-medium">Discharge Status</label>
                <div className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 text-gray-700 capitalize">
                  {editingDischargeSurgery?.status || 'scheduled'}
                </div>
              </div>

              <div className="col-span-12 sm:col-span-6">
                <label className="text-xs font-medium">Created By</label>
                <input
                  value={dischargeForm.dischargeCreatedBy}
                  onChange={(e) => setDischargeForm((prev) => ({ ...prev, dischargeCreatedBy: e.target.value }))}
                  placeholder="Doctor or staff name"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="col-span-12 sm:col-span-6">
                <label className="text-xs font-medium">Completed By</label>
                <input
                  value={dischargeForm.dischargeCompletedBy}
                  onChange={(e) => setDischargeForm((prev) => ({ ...prev, dischargeCompletedBy: e.target.value }))}
                  placeholder="Assigned doctor"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="col-span-12">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Discharge Summary</label>
                  <button
                    type="button"
                    onClick={resetDischargeTemplate}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Reset Template
                  </button>
                </div>
                <div className="mt-1 bg-white rounded-lg border border-gray-300">
                  <ReactQuill
                    theme="snow"
                    value={dischargeForm.dischargeSummary}
                    placeholder="Edit the generated discharge summary here..."
                    onChange={(value) => setDischargeForm((prev) => ({ ...prev, dischargeSummary: value }))}
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        [{ size: ['small', false, 'large', 'huge'] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ color: [] }, { background: [] }],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        [{ align: [] }],
                        ['link', 'blockquote', 'code-block'],
                        ['clean'],
                      ],
                    }}
                    formats={[
                      'header',
                      'size',
                      'bold',
                      'italic',
                      'underline',
                      'strike',
                      'color',
                      'background',
                      'list',
                      'bullet',
                      'align',
                      'link',
                      'blockquote',
                      'code-block',
                    ]}
                    className="discharge-editor"
                  />
                </div>
              </div>

              <div className="col-span-12 flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsDischargeModalOpen(false)} className="px-4 py-2 text-sm rounded border">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save Summary</button>
              </div>
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
                      <p className="font-bold">{editingPatientSurgery.doctorName || 'N/A'}</p>
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

                <div className="mt-16 text-center text-xs text-gray-800">
                  <p>{hospital.address || ''}</p>
                  <p>softcareitsolutions.com</p>
                </div>
              </div>
            </div>

<div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between gap-2">
                <div>
                  <select
                    title="Receipt Size"
                    value={receiptSize}
                    onChange={(e) => setReceiptSize(e.target.value as 'a4' | '80mm' | '76mm' | '58mm')}
                    className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                  >
                    <option value="a4">A4 Invoice</option>
                    <option value="80mm">80mm Receipt</option>
                    <option value="76mm">76mm Receipt</option>
                    <option value="58mm">58mm Receipt</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 text-sm font-medium border rounded-md">Close</button>
                  <button
                    onClick={() => printSurgeryReceipt(editingPatientSurgery)}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </div>
            </div>
          </div>

          
        </div>
      )}
      {printingDischargeItem && (
        <DischargeSummaryPrint
          hospital={hospital}
          patient={patients.find((p) => String(p.id) === String(printingDischargeItem.patientId))}
          doctor={doctors.find((d) => String(d.id) === String(printingDischargeItem.doctorId))}
          surgeryItem={printingDischargeItem}
          printedBy={user?.name || 'System'}
          onClose={() => setPrintingDischargeItem(null)}
        />
      )}
    </div>
  );
}

