import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, X, RefreshCw, ToggleRight, Printer, FileText, Stethoscope, Scissors, Users } from 'lucide-react';
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
  collectPatientSurgeryPayment,
  reversePatientSurgeryPayment,
} from '../../api/surgeries';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';
import { poweredByHtml } from '../utils/receiptBranding';

type TabKey = 'types' | 'surgeries' | 'patientSurgeries' | 'dischargeSummary';
import { AddButton } from './AddButton';

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
  verificationToken?: string;
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
  verificationToken: item.verification_token || undefined,
});


/**
 * Coloured chip for the surgery table's status and payment columns.
 *
 * Plain text gave a cancelled operation and a completed one identical weight;
 * colour lets the row be read at a glance, and the palette matches the badges
 * used elsewhere in the app.
 */
function StatusBadge({ value }: { value?: string }) {
  const key = String(value || '').toLowerCase();

  const tone =
    key === 'paid' || key === 'completed' || key === 'active'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : key === 'pending' || key === 'scheduled' || key === 'partial'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : key === 'in_progress'
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
          : key === 'cancelled' || key === 'unpaid' || key === 'inactive'
            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize whitespace-nowrap ${tone}`}>
      {key ? key.replace(/_/g, ' ') : '—'}
    </span>
  );
}

export function SurgeryManagement({ hospital, userRole }: SurgeryManagementProps) {
  const { t } = useTranslation();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const { getPrintPaperSize, loadHospitalSetting } = useSettings();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { user, hasPermission } = useAuth();
  // These screens previously had no permission checks at all.
  const canAddTypes = hasPermission('add_surgery_types') || hasPermission('manage_surgery_types');
  const canEditTypes = hasPermission('edit_surgery_types') || hasPermission('manage_surgery_types');
  const canDeleteTypes = hasPermission('delete_surgery_types') || hasPermission('manage_surgery_types');
  // Cost and payment status decide what the hospital is owed, so they are
  // gated separately from the ability to schedule an operation. Enforced again
  // in PatientSurgeryController -- disabling an input is a hint, not a control.
  const canSetSurgeryCost = hasPermission('edit_surgery_cost')
    || hasPermission('manage_patient_surgeries');
  const canSetSurgeryPayment = hasPermission('edit_surgery_payment_status')
    || hasPermission('manage_patient_surgeries');
  // Collecting and reversing are separate rights. Reverse has no fallback:
  // undoing a payment is how cash gets taken and the trace erased, so it is
  // held explicitly or not at all.
  const canCollectSurgeryFee = hasPermission('manage_surgery_payments')
    || hasPermission('manage_patient_surgeries');
  const canReverseSurgeryFee = hasPermission('reverse_surgery_payment');

  const canAddSurgeries = hasPermission('add_surgeries') || hasPermission('manage_surgeries');
  const canEditSurgeries = hasPermission('edit_surgeries') || hasPermission('manage_surgeries');
  const canDeleteSurgeries = hasPermission('delete_surgeries') || hasPermission('manage_surgeries');
  const canAddPatientSurgeries = hasPermission('add_patient_surgeries') || hasPermission('manage_patient_surgeries');
  const canEditPatientSurgeries = hasPermission('edit_patient_surgeries') || hasPermission('manage_patient_surgeries');
  const canDeletePatientSurgeries = hasPermission('delete_patient_surgeries') || hasPermission('manage_patient_surgeries');
  const canPrintPatientSurgeries = hasPermission('print_patient_surgeries') || hasPermission('view_patient_surgeries') || hasPermission('manage_patient_surgeries');

  // Patient Surgeries is the day-to-day tab; types and surgeries are setup
  // data that is configured once.
  const [activeTab, setActiveTab] = useState<TabKey>('patientSurgeries');
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
    // Paid by default: the receipt is normally raised at the counter when the
    // patient pays, so pending was the wrong starting point for most entries.
    paymentStatus: 'paid' as PatientSurgeryItem['paymentStatus'],
    cost: '',
    notes: '',
    isActive: true,
  });
    // Seeded from the hospital's configured size rather than localStorage: a
    // value cached in one browser used to override the hospital-wide setting,
    // so the same receipt printed differently on different machines.
    const [receiptSize, setReceiptSize] = useState<'a4' | 'a5' | '58mm' | '76mm' | '80mm'>('80mm');

  // Follow the hospital-wide paper size (Settings > General > Print Settings).
  const configuredPaperSize = getPrintPaperSize(currentHospital.id, 'surgery_receipt');
  useEffect(() => {
    loadHospitalSetting(currentHospital.id);
  }, [currentHospital.id, loadHospitalSetting]);
  useEffect(() => {
    setReceiptSize(configuredPaperSize);
  }, [configuredPaperSize, currentHospital.id]);

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

    const printSurgeryReceipt = (item: PatientSurgeryItem, size: 'a4' | 'a5' | '58mm' | '76mm' | '80mm' = receiptSize) => {
      const isCompactReceipt = size !== 'a4' && size !== 'a5';
      const ticketWidth = isCompactReceipt ? size : (size === 'a5' ? '128mm' : '190mm');
      const pageRule = isCompactReceipt
        ? `@page { size: ${size} auto; margin: 0; }`
        : `@page { size: ${size === 'a5' ? 'A5' : 'A4'}; margin: 10mm; }`;

      const patientSerial =
        patients.find((p) => String(p.id) === String(item.patientId))?.patientId || item.patientId || 'N/A';
      
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
                margin-bottom: 12px;
              }
              .meta-block {
                width: 48%;
              }
              .label {
                font-size: ${isCompactReceipt ? '8px' : '9px'};
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: #000000;
                font-weight: 600;
                margin-bottom: 1px;
              }
              .hospital-contact {
                margin: 1px 0 0;
                font-size: ${isCompactReceipt ? '9px' : '11px'};
                color: #000000;
              }
              .value {
                font-weight: bold;
                font-size: ${isCompactReceipt ? '11px' : '13px'};
                margin: 0;
                color: #000000;
              }
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
                /* Extra room at the top only: thermal paper is pulled past the
                   print head before printing starts, so the first line loses
                   its ascenders and the hospital name clipped. */
                .ticket { border: none; box-shadow: none; margin: 0; padding: ${isCompactReceipt ? '3mm 6px 6px' : '0'}; width: ${ticketWidth}; }
                ${pageRule}
              }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="header">
                <h1 class="hospital-name">${hospital.name}</h1>
                ${hospital.address ? `<p class="hospital-contact">${hospital.address}</p>` : ''}
                ${hospital.phone ? `<p class="hospital-contact">${hospital.phone}</p>` : ''}
                <p class="dept">Surgery Department</p>
                <div style="margin-top: 6px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Invoice</div>
              </div>
              
              <div class="meta-row">
                <div class="meta-block">
                  <div class="label">Patient ID</div>
                  <div class="value">${patientSerial}</div>
                  <div class="label" style="margin-top: 8px;">Patient Name</div>
                  <div class="value">${item.patientName}</div>
                </div>
                <div class="meta-block" style="text-align: right;">
                  <div class="label">Invoice No / Date</div>
                  <div class="value" style="font-size: ${isCompactReceipt ? '11px' : '15px'}">${item.id}</div>
                  <div style="font-size: ${isCompactReceipt ? '10px' : '14px'}">${item.surgeryDate}</div>
                  <div class="label" style="margin-top: 8px;">Surgeon</div>
                  <div class="value">${item.doctorName || 'N/A'}</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="font-size: ${isCompactReceipt ? '9px' : '12px'}; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Description</th>
                    <th class="text-right" style="font-size: ${isCompactReceipt ? '9px' : '12px'}; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div class="value" style="font-size: ${isCompactReceipt ? '11px' : '14px'};">${item.surgeryName}</div>
                      ${item.notes ? `<div class="notes" style="font-size: ${isCompactReceipt ? '9px' : '12px'};">${item.notes}</div>` : ''}
                    </td>
                    <td class="text-right value" style="font-size: ${isCompactReceipt ? '11px' : '14px'};">${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>

              <div class="totals">
                <div>
                  <span>Total Amount:</span>
                  <span>${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div class="footer">
                <p style="margin:0 0 2px 0; font-size: ${isCompactReceipt ? '9px' : '11px'}">Printed on: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                ${poweredByHtml(isCompactReceipt)}
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
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('modules.surgeriesTitle')}</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('modules.surgeriesSubtitle')}</p>
        </div>
        <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />
      </div>

      {/* Same underline tab style as the Master Data / Invoices modules. */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4 min-w-max overflow-x-auto" aria-label="Surgery sections">
          {([
            ['types', t('ui.surgeryTypes'), Stethoscope],
            ['surgeries', t('ui.surgeries'), Scissors],
            ['patientSurgeries', t('ui.patientSurgeries'), Users],
            ['dischargeSummary', t('ui.dischargeSummary'), FileText],
          ] as const).map(([key, label, Icon]) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key as TabKey)}
                aria-current={isActive ? 'page' : undefined}
                className={`group inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 pb-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search..."
              aria-label="Search surgeries"
              className="w-40 pl-8 pr-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button onClick={loadAll} className="px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />{t('ui.refresh')}</button>
          {activeTab === 'types' && canAddTypes && <AddButton onClick={() => { setEditingType(null); setTypeForm({ name: '', description: '', isActive: true }); setIsTypeModalOpen(true); }} label={t('ui.addType')} />}
          {activeTab === 'surgeries' && canAddSurgeries && <AddButton onClick={() => { setEditingSurgery(null); setSurgeryForm({ name: '', typeId: '', cost: '0', description: '', isActive: true }); setIsSurgeryModalOpen(true); }} label="Add Surgery" />}
          {activeTab === 'patientSurgeries' && canAddPatientSurgeries && <AddButton onClick={() => { setEditingPatientSurgery(null); setPatientSurgeryForm({ patientId: '', doctorId: '', surgeryId: '', surgeryDate: new Date().toISOString().slice(0, 10), status: 'scheduled', paymentStatus: 'paid', cost: '', notes: '', isActive: true }); setIsPatientSurgeryModalOpen(true); }} label="Add Patient Surgery" />}
          {activeTab === 'dischargeSummary' && canEditPatientSurgeries && <AddButton onClick={openNewDischargeModal} label="Add Discharge" />}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                {activeTab === 'types' && <><th className="px-4 py-2">{t('table.name')}</th><th className="px-4 py-2">{t('table.description')}</th><th className="px-4 py-2">{t('common.status')}</th></>}
                {activeTab === 'surgeries' && <><th className="px-4 py-2">{t('table.name')}</th><th className="px-4 py-2">{t('table.type')}</th><th className="px-4 py-2">{t('table.cost')}</th><th className="px-4 py-2">{t('common.status')}</th></>}
                {activeTab === 'patientSurgeries' && <><th className="px-4 py-2">{t('table.patient')}</th><th className="px-4 py-2">{t('table.surgery')}</th><th className="px-4 py-2">{t('table.date')}</th><th className="px-4 py-2">{t('common.status')}</th><th className="px-4 py-2">{t('table.payment')}</th><th className="px-4 py-2">{t('table.cost')}</th></>}
                {activeTab === 'dischargeSummary' && <><th className="px-4 py-2">{t('table.patient')}</th><th className="px-4 py-2">{t('table.surgery')}</th><th className="px-4 py-2">{t('table.dischargeDate')}</th><th className="px-4 py-2">{t('table.createdBy')}</th><th className="px-4 py-2">{t('table.completedBy')}</th><th className="px-4 py-2">{t('table.summary')}</th></>}
                <th className="px-4 py-2 text-center">{t('common.actions')}</th>
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
                      <td className="px-4 py-2">{row.isActive ? t('ui.active') : t('ui.inactive')}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {canEditTypes && (<button onClick={() => { setEditingType(row); setTypeForm({ name: row.name, description: row.description || '', isActive: row.isActive }); setIsTypeModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Pencil className="w-4 h-4" /></button>)}
                          {canDeleteTypes && (<button onClick={async () => { try { await deleteSurgeryType(row.id); toast.success('Surgery type deleted'); loadAll(); } catch (e: any) { toast.error(e?.response?.data?.message || 'Delete failed'); } }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"><Trash2 className="w-4 h-4" /></button>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeTab === 'surgeries' && (paginatedRows as SurgeryItem[]).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.name}</td>
                      <td className="px-4 py-2">{row.typeName || row.typeId}</td>
                      <td className="px-4 py-2">{row.cost.toFixed(2)}</td>
                      <td className="px-4 py-2">{row.isActive ? t('ui.active') : t('ui.inactive')}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {canEditSurgeries && (<button onClick={() => { setEditingSurgery(row); setSurgeryForm({ name: row.name, typeId: row.typeId, cost: String(row.cost), description: row.description || '', isActive: row.isActive }); setIsSurgeryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Pencil className="w-4 h-4" /></button>)}
                          {canDeleteSurgeries && (<button onClick={async () => { try { await deleteSurgery(row.id); toast.success('Surgery deleted'); loadAll(); } catch (e: any) { toast.error(e?.response?.data?.message || 'Delete failed'); } }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"><Trash2 className="w-4 h-4" /></button>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeTab === 'patientSurgeries' && (paginatedRows as PatientSurgeryItem[]).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.patientName}</td>
                      <td className="px-4 py-2">{row.surgeryName}</td>
                      <td className="px-4 py-2">{row.surgeryDate}</td>
                      <td className="px-4 py-2"><StatusBadge value={row.status} /></td>
                      <td className="px-4 py-2"><StatusBadge value={row.paymentStatus} /></td>
                      <td className="px-4 py-2">{row.cost.toFixed(2)}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {canPrintPatientSurgeries && (<button onClick={() => { setEditingPatientSurgery(row); setShowInvoiceModal(true); }} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-md" title={t('ui.printInvoice')}><Printer className="w-4 h-4" /></button>)}
                          {/* A real sliding switch: the knob sits left on
                              pending (amber) and right on paid (green), so the
                              state is readable without opening the row. The old
                              control was a fixed icon that never moved. */}
                          {(canCollectSurgeryFee || canReverseSurgeryFee) && (() => {
                            const isPaid = String(row.paymentStatus) === 'paid';
                            const allowed = isPaid ? canReverseSurgeryFee : canCollectSurgeryFee;
                            return (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isPaid}
                                disabled={!allowed}
                                title={isPaid
                                  ? (canReverseSurgeryFee ? 'Reverse payment to pending' : 'Payment collected')
                                  : (canCollectSurgeryFee ? 'Mark as paid' : 'Payment pending')}
                                aria-label={isPaid ? 'Reverse payment to pending' : 'Mark as paid'}
                                onClick={async () => {
                                  try {
                                    // Collecting and reversing are separate
                                    // rights, so they are separate calls -- the
                                    // old toggle rode on "can edit surgeries"
                                    // and recorded no collector.
                                    const updated = isPaid
                                      ? await reversePatientSurgeryPayment(row.id)
                                      : await collectPatientSurgeryPayment(row.id);
                                    setPatientSurgeries((prev) => prev.map((item) => item.id === row.id ? mapPatientSurgery(updated) : item));
                                    toast.success(isPaid ? 'Payment reversed' : 'Payment collected');
                                  } catch (e: any) {
                                    toast.error(e?.response?.data?.message
                                      || (e?.response?.status === 403
                                        ? 'You do not have permission to change payment on surgeries.'
                                        : 'Toggle failed'));
                                  }
                                }}
                                className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                  isPaid ? 'bg-emerald-500' : 'bg-amber-400'
                                }`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                  isPaid ? 'translate-x-5' : 'translate-x-0.5'
                                }`} />
                              </button>
                            );
                          })()}
                          {canEditPatientSurgeries && (<button onClick={() => { const normalizedDate = String(row.surgeryDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10); setEditingPatientSurgery(row); setPatientSurgeryForm({ patientId: row.patientId, doctorId: row.doctorId || '', surgeryId: row.surgeryId, surgeryDate: normalizedDate, status: row.status, paymentStatus: row.paymentStatus, cost: String(row.cost), notes: row.notes || '', isActive: true }); setIsPatientSurgeryModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Pencil className="w-4 h-4" /></button>)}
                          {canDeletePatientSurgeries && (<button onClick={async () => { try { await deletePatientSurgery(row.id); toast.success('Patient surgery deleted'); loadAll(); } catch (e: any) { toast.error(e?.response?.data?.message || 'Delete failed'); } }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"><Trash2 className="w-4 h-4" /></button>)}
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
              >{t('ui.prev')}</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >{t('ui.next')}</button>
            </div>
          </div>
        )}
      </div>

      {isTypeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{editingType ? 'Edit Surgery Type' : 'Add Surgery Type'}</h2>
              <button onClick={() => setIsTypeModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title={t('ui.close')}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveType} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.name')}</label><input value={typeForm.name} onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" /></div>
              <div className="col-span-12"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.description')}</label><input value={typeForm.description} onChange={(e) => setTypeForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" /></div>
              <div className="col-span-12 flex items-center gap-2"><input id="type-active" type="checkbox" checked={typeForm.isActive} onChange={(e) => setTypeForm((p) => ({ ...p, isActive: e.target.checked }))} /><label htmlFor="type-active" className="text-sm">{t('ui.active')}</label></div>
              <div className="col-span-12 flex items-center justify-end gap-2"><button type="button" onClick={() => setIsTypeModalOpen(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button><button type="submit" className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs disabled:opacity-60 disabled:cursor-not-allowed">{editingType ? t('ui.update') : t('ui.create')}</button></div>
            </form>
          </div>
        </div>
      )}

      {isSurgeryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{editingSurgery ? t('ui.editSurgery') : t('ui.addSurgery')}</h2>
              <button onClick={() => setIsSurgeryModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title={t('ui.close')}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveSurgery} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.name')}</label><input value={surgeryForm.name} onChange={(e) => setSurgeryForm((p) => ({ ...p, name: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" /></div>
              <div className="col-span-12"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.type')}</label><select value={surgeryForm.typeId} onChange={(e) => setSurgeryForm((p) => ({ ...p, typeId: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"><option value="">{t('ui.selectType')}</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="col-span-12 md:col-span-6"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Cost</label><input type="number" min={0} step="0.01" value={surgeryForm.cost} onChange={(e) => setSurgeryForm((p) => ({ ...p, cost: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" /></div>
              <div className="col-span-12 md:col-span-6 flex items-end gap-2 pb-2"><input id="surgery-active" type="checkbox" checked={surgeryForm.isActive} onChange={(e) => setSurgeryForm((p) => ({ ...p, isActive: e.target.checked }))} /><label htmlFor="surgery-active" className="text-sm">{t('ui.active')}</label></div>
              <div className="col-span-12"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.description')}</label><input value={surgeryForm.description} onChange={(e) => setSurgeryForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" /></div>
              <div className="col-span-12 flex items-center justify-end gap-2"><button type="button" onClick={() => setIsSurgeryModalOpen(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button><button type="submit" className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs disabled:opacity-60 disabled:cursor-not-allowed">{editingSurgery ? t('ui.update') : t('ui.create')}</button></div>
            </form>
          </div>
        </div>
      )}

      {isPatientSurgeryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl border border-gray-200 dark:border-gray-700">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{editingPatientSurgery ? 'Edit Patient Surgery' : 'Add Patient Surgery'}</h2>
              <button onClick={() => setIsPatientSurgeryModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title={t('ui.close')}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={savePatientSurgery} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.patient')}</label><select value={patientSurgeryForm.patientId} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, patientId: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"><option value="">Select patient</option>{filteredPatients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="col-span-12 md:col-span-6"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Doctor (optional)</label><select value={patientSurgeryForm.doctorId} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, doctorId: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"><option value="">None</option>{filteredDoctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div className="col-span-12 md:col-span-6"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.surgery')}</label><select value={patientSurgeryForm.surgeryId} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, surgeryId: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"><option value="">Select surgery</option>{surgeries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="col-span-12 md:col-span-6"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Surgery Date</label><input type="date" value={patientSurgeryForm.surgeryDate} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, surgeryDate: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" /></div>
              <div className="col-span-12 md:col-span-4"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.status')}</label><select value={patientSurgeryForm.status} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, status: e.target.value as PatientSurgeryItem['status'] }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"><option value="scheduled">scheduled</option><option value="in_progress">in_progress</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select></div>
              <div className="col-span-12 md:col-span-4"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.paymentStatus')}</label><select value={patientSurgeryForm.paymentStatus} disabled={!canSetSurgeryPayment} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, paymentStatus: e.target.value as PatientSurgeryItem['paymentStatus'] }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"><option value="pending">pending</option><option value="paid">paid</option><option value="partial">partial</option><option value="cancelled">cancelled</option></select></div>
              <div className="col-span-12 md:col-span-4"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Cost (optional)</label><input type="number" min={0} step="0.01" value={patientSurgeryForm.cost} disabled={!canSetSurgeryCost} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, cost: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed" /></div>
              <div className="col-span-12"><label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.notes')}</label><input value={patientSurgeryForm.notes} onChange={(e) => setPatientSurgeryForm((p) => ({ ...p, notes: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" /></div>
              {/* Same toggle used on the medicine form, so Active reads the
                  same way everywhere rather than as a bare checkbox. */}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.status')}</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={patientSurgeryForm.isActive}
                  onClick={() => setPatientSurgeryForm((p) => ({ ...p, isActive: !p.isActive }))}
                  className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded border text-xs transition-colors ${
                    patientSurgeryForm.isActive
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span className="truncate">{patientSurgeryForm.isActive ? t('ui.active') : t('ui.inactive')}</span>
                  <span className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
                    patientSurgeryForm.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                      patientSurgeryForm.isActive ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </span>
                </button>
              </div>
              <div className="col-span-12 flex items-center justify-end gap-2"><button type="button" onClick={() => setIsPatientSurgeryModalOpen(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button><button type="submit" className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs disabled:opacity-60 disabled:cursor-not-allowed">{editingPatientSurgery ? t('ui.update') : t('ui.create')}</button></div>
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
              <button onClick={() => setIsDischargeModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title={t('ui.close')}><X className="w-5 h-5" /></button>
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
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Patient Surgery Case</label>
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
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
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
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Discharge Date</label>
                <input
                  type="date"
                  value={dischargeForm.dischargeDate}
                  onChange={(e) => setDischargeForm((prev) => ({ ...prev, dischargeDate: e.target.value }))}
                  required
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Discharge Status</label>
                <div className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 text-gray-700 capitalize">
                  {editingDischargeSurgery?.status || 'scheduled'}
                </div>
              </div>

              <div className="col-span-12 sm:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.createdBy')}</label>
                <input
                  value={dischargeForm.dischargeCreatedBy}
                  onChange={(e) => setDischargeForm((prev) => ({ ...prev, dischargeCreatedBy: e.target.value }))}
                  placeholder="Doctor or staff name"
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="col-span-12 sm:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Completed By</label>
                <input
                  value={dischargeForm.dischargeCompletedBy}
                  onChange={(e) => setDischargeForm((prev) => ({ ...prev, dischargeCompletedBy: e.target.value }))}
                  placeholder="Assigned doctor"
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="col-span-12">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.dischargeSummary')}</label>
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
                <button type="button" onClick={() => setIsDischargeModalOpen(false)} className="px-4 py-2 text-sm rounded border">{t('ui.cancel')}</button>
                <button type="submit" className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save Summary</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvoiceModal && editingPatientSurgery && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
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
                    <h2 className="text-xl font-bold text-gray-400 uppercase">{t('ui.invoice')}</h2>
                    <p className="text-sm text-gray-600">No: SURG-{editingPatientSurgery.id}</p>
                    <p className="text-sm text-gray-600">Date: {editingPatientSurgery.surgeryDate}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">{t('ui.patientDetails')}</h3>
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
                      <th className="text-left py-2 font-bold">{t('table.description')}</th>
                      <th className="text-right py-2 font-bold">{t('common.status')}</th>
                      <th className="text-right py-2 font-bold">{t('table.amount')}</th>
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
                      <span>{t('ui.totalAmount')}</span>
                      <span>{editingPatientSurgery.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600 capitalize italic">
                      <span>{t('ui.paymentStatus')}</span>
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
                    onChange={(e) => setReceiptSize(e.target.value as 'a4' | 'a5' | '80mm' | '76mm' | '58mm')}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="a4">A4 Invoice</option>
                    <option value="a5">A5 Invoice</option>
                    <option value="80mm">80mm Receipt</option>
                    <option value="76mm">76mm Receipt</option>
                    <option value="58mm">58mm Receipt</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 text-sm font-medium border rounded-md">{t('ui.close')}</button>
                  <button
                    onClick={() => printSurgeryReceipt(editingPatientSurgery)}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />{t('ui.print')}</button>
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

