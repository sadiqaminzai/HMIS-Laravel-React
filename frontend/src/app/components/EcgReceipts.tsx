import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Loader2, Printer, Receipt, RotateCcw, Search, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { Hospital, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { ReturnPaymentDialog } from './ReturnPaymentDialog';
import { ReceiptDetailsModal, ReceiptDetails } from './ReceiptDetailsModal';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { useSettings } from '../context/SettingsContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { SearchableSelect } from './SearchableSelect';
import { AddButton } from './AddButton';
import { EcgServices } from './EcgServices';
import {
  CellNumber,
  CellStack,
  CellText,
  DataTableBody,
  DataTableCard,
  DataTableHead,
  DeleteIcon,
  EditIcon,
  ViewIcon,
  RowIcon,
  TableAction,
  TableEmpty,
  TableLoading,
  TablePill,
  Th,
  Tr,
  usePagination,
  useTableSort,
} from './DataTable';
import { POWERED_BY_TEXT } from '../utils/receiptBranding';
import { formatOnlyDate, getISODateInTimeZone } from '../utils/date';
import { formatAge } from '../utils/age';
import {
  EcgReceiptApi,
  EcgServiceApi,
  createEcgReceipt,
  deleteEcgReceipt,
  fetchEcgReceipts,
  fetchEcgServices,
  payEcgReceipt,
  reverseEcgPayment,
  updateEcgReceipt,
} from '../api/ecg';

interface EcgReceiptsProps {
  hospital: Hospital;
  userRole: UserRole;
}

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(value ?? 0)
  );

/** Payment state to pill colour, matching the ultrasound receipts desk. */
const paymentTone = (status: string): 'green' | 'amber' | 'red' =>
  status === 'paid' ? 'green' : status === 'partial' ? 'amber' : 'red';

const emptyForm = () => ({
  patientId: '',
  doctorId: '',
  ecgServiceId: '',
  serviceName: '',
  performedAt: new Date().toISOString().slice(0, 10),
  referredBy: '',
  notes: '',
  fee: '',
  discountEnabled: false,
  discountPercentage: '',
});

/**
 * ECG: a receipt desk backed by a study catalogue.
 *
 * There is deliberately no exam list or report template here: the trace is
 * printed by the machine and read outside ShifaaScript, so the only thing the
 * system owns is the money. The discount works exactly as it does on dental
 * receipts and patient surgeries, and is gated on the same rights, so a
 * hospital configures "who may discount" once rather than per module.
 */
export function EcgReceipts({ hospital, userRole }: EcgReceiptsProps) {
  const { hasPermission } = useAuth();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { getPrintPaperSize, loadHospitalSetting, getDefaultDiscounts } = useSettings();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } =
    useHospitalFilter(hospital, userRole);

  const [receipts, setReceipts] = useState<EcgReceiptApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<EcgReceiptApi | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [paying, setPaying] = useState<EcgReceiptApi | null>(null);
  const [method, setMethod] = useState('cash');
  const [activeTab, setActiveTab] = useState<'receipts' | 'types'>('receipts');
  const [types, setTypes] = useState<EcgServiceApi[]>([]);

  const canManage = hasPermission('manage_ecg_receipts');
  const canView = hasPermission('view_ecg_receipts') || canManage;
  const canCreate = hasPermission('add_ecg_receipts') || canManage;
  const canEdit = hasPermission('edit_ecg_receipts') || canManage;
  const canDelete = hasPermission('delete_ecg_receipts') || canManage;
  // The desk's own Take Payment right. It used to fall back to Manage, so
  // anyone who could manage receipts could also collect; Accounts > Payment
  // Collection has its own right and is unaffected.
  const canTakePayment = hasPermission('take_ecg_payment');
  // No fallback: undoing a payment is how cash gets taken and the trace erased,
  // so it is held explicitly or not at all.
  const canReversePayment = hasPermission('return_ecg_payment');
  // Without it the fee is the study's catalogue price, enforced on the server.
  const canSetFee = hasPermission('set_ecg_fee');
  const canPrintReceipt = hasPermission('print_ecg_receipt') || canTakePayment;
  // The catalogue tab is its own permission family, so a cashier who may
  // raise receipts does not automatically get to reprice every service.
  const canViewTypes = hasPermission('view_ecg_services')
    || hasPermission('manage_ecg_services')
    || hasPermission('add_ecg_services')
    || hasPermission('edit_ecg_services')
    || hasPermission('delete_ecg_services');
  // Same rights as the appointment and surgery discounts.
  const canApplyDiscount = hasPermission('add_discounts')
    || hasPermission('edit_discounts')
    || hasPermission('manage_discounts');

  const paperSize = getPrintPaperSize(currentHospital.id, 'ecg_receipt');
  const isThermal = paperSize !== 'a4' && paperSize !== 'a5';

  /**
   * The second line under a patient's name in the dropdown: ID, age, sex and
   * phone. SearchableSelect also matches typing against this, so the clerk can
   * find someone by phone number as well as by name.
   */
  const patientMeta = (p: { patientId?: string; age?: number; ageUnit?: string; gender?: string; phone?: string }) =>
    [
      p.patientId ? 'ID ' + p.patientId : null,
      formatAge(p.age, p.ageUnit, { compact: true, fallback: '' }) || null,
      p.gender || null,
      p.phone || null,
    ]
      .filter(Boolean)
      .join('  \u00b7  ');

  // Dating a charge decides which day-end sheet and which report it lands in,
  // so it is its own right. Without it the field stays on today.
  const canBackdateReceipt = hasPermission('backdate_receipts');


  /**
   * Today in the hospital's own timezone, not the browser's and not UTC.
   *
   * This used to be new Date().toISOString().slice(0,10), which is UTC: in
   * Kabul (UTC+4:30) every receipt raised between midnight and 04:30 defaulted
   * to YESTERDAY. The timezone comes from Settings > General > Date & Time.
   */
  const today = (tz: string = currentHospital.timezone || 'Asia/Kabul') => getISODateInTimeZone(tz);

  /** Hospital id sent to the API; only super admins may target another tenant. */
  const scopedHospitalId = useMemo(() => {
    if (userRole !== 'super_admin') return undefined;
    return isAllHospitals ? undefined : currentHospital.id;
  }, [userRole, isAllHospitals, currentHospital.id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchEcgReceipts(scopedHospitalId ? { hospital_id: scopedHospitalId } : {});
      setReceipts(rows);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load ECG receipts');
    } finally {
      setLoading(false);
    }
  }, [scopedHospitalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return receipts;
    return receipts.filter((row) =>
      [row.service_name, row.patient?.name, row.patient?.phone, row.referred_by, row.doctor?.name]
        .some((field) => String(field ?? '').toLowerCase().includes(term))
    );
  }, [receipts, searchTerm]);

  const outstanding = useMemo(
    () => filtered.filter((row) => row.payment_status !== 'paid').length,
    [filtered]
  );

  // Sorted and paged through the shared table, so this desk behaves like every
  // other listing. Newest first: the receipt just raised is the one being paid.
  const sort = useTableSort<any>(filtered, 'created_at', 'desc');
  const { page, setPage, totalPages, pageRows } = usePagination<any>(sort.rows, 20);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedHospitalId, setPage]);

  const hospitalPatients = useMemo(
    () => patients.filter((p) => isAllHospitals || String(p.hospitalId) === String(currentHospital.id)),
    [patients, isAllHospitals, currentHospital.id]
  );

  const hospitalDoctors = useMemo(
    () => doctors.filter((d) => isAllHospitals || String(d.hospitalId) === String(currentHospital.id)),
    [doctors, isAllHospitals, currentHospital.id]
  );

  // The catalogue feeding the Service field. Fetched active-only and once per
  // hospital rather than per modal open, so opening the form costs nothing.
  const loadTypes = useCallback(() => {
    // The whole catalogue, not just the active slice: a receipt being edited
    // may point at an entry that has since been retired, and its name still
    // has to render.
    fetchEcgServices(scopedHospitalId ? { hospital_id: scopedHospitalId } : {})
      .then(setTypes)
      .catch(() => {
        // A missing catalogue is not an error the cashier can act on: the
        // field falls back to free text below.
        setTypes([]);
      });
  }, [scopedHospitalId]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  /**
   * What the picker offers: active entries only, plus whichever entry this
   * receipt already points at. Without the second part, deactivating an entry
   * would blank the field on every existing receipt that used it.
   */
  const activeTypes = useMemo(() => {
    const live = types.filter((row) => row.is_active);
    const selectedId = form.ecgServiceId;

    if (!selectedId) return live;
    if (live.some((row) => String(row.id) === selectedId)) return live;

    const retired = types.find((row) => String(row.id) === selectedId);
    return retired ? [...live, retired] : live;
  }, [types, form.ecgServiceId]);

  // Settings load per hospital on demand; the default discount above needs it.
  useEffect(() => {
    loadHospitalSetting(currentHospital.id);
  }, [currentHospital.id, loadHospitalSetting]);

  /**
   * Mirrors DiscountService::computeFeeTotals so the modal shows the numbers
   * the server will store. The server still recomputes them -- this is a
   * preview, not the source of truth.
   */
  const feePreview = useMemo(() => {
    const gross = Math.max(0, Number(form.fee || 0));
    if (form.discountEnabled) {
      return { gross, percent: gross > 0 ? 100 : 0, discount: gross, net: 0 };
    }
    const percent = Math.min(100, Math.max(0, Number(form.discountPercentage || 0)));
    const discount = Math.min(gross, Math.round(((gross * percent) / 100) * 100) / 100);
    return { gross, percent, discount, net: Math.max(0, Math.round((gross - discount) * 100) / 100) };
  }, [form.fee, form.discountEnabled, form.discountPercentage]);

  const openModal = (row?: EcgReceiptApi) => {
    if (row) {
      setEditing(row);
      setForm({
        patientId: String(row.patient_id),
        doctorId: row.doctor_id ? String(row.doctor_id) : '',
        ecgServiceId: row.ecg_service_id ? String(row.ecg_service_id) : '',
        serviceName: row.service_name,
        performedAt: String(row.performed_at ?? '').slice(0, 10),
        referredBy: row.referred_by ?? '',
        notes: row.notes ?? '',
        fee: String(row.fee ?? ''),
        discountEnabled: Boolean(row.discount_enabled),
        discountPercentage: Number(row.discount_percentage ?? 0) > 0 ? String(row.discount_percentage) : '',
      });
    } else {
      setEditing(null);
      const seeded = getDefaultDiscounts(currentHospital.id).ecg;
      setForm({
        ...emptyForm(),
        // A new receipt is dated today; editing keeps whatever was saved.
        performedAt: today(),
        // The percentage field, not discountEnabled -- that flag is a full
        // waiver and would make every study free.
        discountPercentage: seeded > 0 ? String(seeded) : '',
      });
    }
    // The catalogue tab sits beside this one; re-reading it here means an
    // entry deactivated a moment ago is gone from the picker straight away.
    loadTypes();
    setIsModalOpen(true);
  };

  // One receipt per press: a slow save must not become two receipts.
  const { submitting: saving, guard } = useSubmitGuard();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.patientId || !form.serviceName.trim()) {
      toast.error('Please choose a patient and name the service.');
      return;
    }

    const payload = {
      ...(scopedHospitalId ? { hospital_id: scopedHospitalId } : {}),
      patient_id: form.patientId,
      doctor_id: form.doctorId || null,
      ecg_service_id: form.ecgServiceId || null,
      service_name: form.serviceName.trim(),
      performed_at: form.performedAt,
      referred_by: form.referredBy || null,
      notes: form.notes || null,
      fee: form.fee === '' ? 0 : Number(form.fee),
      discount_enabled: form.discountEnabled,
      discount_percentage: form.discountPercentage === '' ? 0 : Number(form.discountPercentage),
    };

    setIsSubmitting(true);
    try {
      if (editing) {
        await updateEcgReceipt(editing.id, payload);
        toast.success('ECG receipt updated');
      } else {
        await createEcgReceipt(payload);
        toast.success('ECG receipt created');
      }
      setIsModalOpen(false);
      setEditing(null);
      setForm({ ...emptyForm(), performedAt: today() });
      await loadData();
    } catch (error: any) {
      const errors = error?.response?.data?.errors;
      const first = errors ? (Object.values(errors)[0] as string[])?.[0] : null;
      toast.error(first || error?.response?.data?.message || 'Failed to save ECG receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (row: EcgReceiptApi) => {
    if (!window.confirm(`Delete ECG receipt for ${row.patient?.name ?? 'this patient'}?`)) return;
    try {
      await deleteEcgReceipt(row.id);
      toast.success('ECG receipt deleted');
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete ECG receipt');
    }
  };

  const payable = (row: EcgReceiptApi) => Number(row.net_amount ?? row.fee ?? 0);

  const takePayment = async (row: EcgReceiptApi) => {
    setBusyId(row.id);
    try {
      await payEcgReceipt(row.id, { paid_amount: payable(row), payment_method: method });
      setPaying(null);
      await loadData();
      toast.success('Payment recorded');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Payment failed');
    } finally {
      setBusyId(null);
    }
  };

  // The receipt open in the read-only details card.
  const [viewing, setViewing] = useState<EcgReceiptApi | null>(null);

  /** Everything the details card shows, from the row and its study. */
  const detailsFor = (row: EcgReceiptApi): ReceiptDetails => ({
    title: 'ECG Receipt',
    receiptNo: row.receipt_number || row.sequence_id || row.id,
    date: formatOnlyDate(row.performed_at, hospital.timezone, hospital.calendarType),
    paymentStatus: row.payment_status,
    patient: row.patient,
    doctorName: row.doctor?.name,
    referredBy: row.referred_by,
    itemsLabel: 'Study',
    items: [{
      name: row.service_name,
      description: row.ecg_service?.description
        ?? types.find((type) => String(type.id) === String(row.ecg_service_id ?? ''))?.description,
      fee: row.fee,
    }],
    fee: row.fee,
    discountAmount: row.discount_amount,
    discountPercentage: row.discount_percentage,
    fullWaiver: Boolean(row.discount_enabled),
    netAmount: payable(row),
    paidAmount: row.paid_amount,
    paymentMethod: row.payment_method,
    notes: row.notes,
    history: [
      { label: 'Created', who: row.created_by, when: row.created_at },
      { label: 'Last updated', who: row.updated_by, when: row.updated_at },
      { label: 'Payment taken', who: row.paid_by, when: row.paid_at },
    ],
  });

  // The receipt whose payment is being returned, while the dialog asks.
  const [returning, setReturning] = useState<EcgReceiptApi | null>(null);

  /** Put a collected payment back, once the dialog has a reason for it. */
  const confirmReturn = async (reason: string) => {
    if (!returning) return;
    const row = returning;

    setBusyId(row.id);
    try {
      await reverseEcgPayment(row.id, reason);
      setReturning(null);
      await loadData();
      toast.success('Payment returned');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not return the payment');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Fees card, in a window of its own so the application's stylesheet cannot
   * impose its page size. Modelled on the ultrasound receipt.
   */
  const printReceipt = (row: EcgReceiptApi) => {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) {
      window.alert('Please allow pop-ups for this site to print the receipt.');
      return;
    }

    const receiptNo = String(row.receipt_number || row.sequence_id || row.id);
    const paid = row.payment_status === 'paid';
    const discount = Number(row.discount_amount ?? 0);
    const percent = Number(row.discount_percentage ?? 0);

    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>ECG Receipt</title>
    <style>
      @page { size: ${isThermal ? `${paperSize} auto` : 'A4'}; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: ${isThermal ? paperSize : 'auto'}; margin: 0; padding: 0; background: #fff; }
      body { font-family: 'Segoe UI', Tahoma, Verdana, sans-serif; color: #000; font-size: ${isThermal ? '10.5px' : '12px'}; line-height: 1.3; padding: ${isThermal ? '2mm 0 0' : '12mm'}; }
      .center { text-align: center; }
      .name { font-size: 1.3em; font-weight: 700; text-transform: uppercase; line-height: 1.15; }
      .sub { font-size: 0.85em; }
      .title { text-align: center; font-weight: 700; text-transform: uppercase; font-size: 0.9em; letter-spacing: 0.12em; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; margin: 3px 0; }
      .cols { display: flex; gap: 4px; align-items: flex-start; }
      .col { flex: 1; min-width: 0; }
      .col-head { font-weight: 700; text-transform: uppercase; font-size: 0.72em; letter-spacing: 0.05em; border-bottom: 1px solid #000; margin-bottom: 2px; }
      .k { color: #000; font-size: 0.78em; }
      .v { color: #000; font-weight: 600; font-size: 0.85em; overflow-wrap: anywhere; }
      .sep { width: 1px; align-self: stretch; background: #000; }
      .line { display: flex; justify-content: space-between; padding: 2px 0; font-size: 0.9em; }
      .total { display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1em; border-top: 2px solid #000; margin-top: 6px; padding-top: 4px; }
      .foot { text-align: center; font-size: 0.78em; border-top: 1px dashed #000; padding-top: 4px; margin-top: 6px; }
      .brand { text-align: center; font-style: italic; font-weight: 600; font-size: 9px; color: #000; margin-top: 4px; }
    </style>
  </head>
  <body>
    <div class="center">
      <div class="name">${hospital.name || ''}</div>
      ${hospital.address ? `<div class="sub">${hospital.address}</div>` : ''}
      ${hospital.phone ? `<div class="sub">${hospital.phone}</div>` : ''}
    </div>

    <div class="title">ECG Receipt</div>

    <div class="cols">
      <div class="col">
        <div class="col-head">Patient</div>
        <div><span class="k">Name: </span><span class="v">${row.patient?.name ?? '-'}</span></div>
        <div><span class="k">ID: </span><span class="v">${row.patient?.patient_id ?? row.patient_id}</span></div>
        <!-- Age and Sex on their own lines: crammed together they wrapped
             awkwardly on the narrow thermal roll. -->
        <div><span class="k">Age: </span><span class="v">${row.patient?.age ?? '-'}</span></div>
        <div><span class="k">Sex: </span><span class="v">${row.patient?.gender ?? '-'}</span></div>
      </div>
      <div class="sep"></div>
      <div class="col">
        <div class="col-head">Receipt</div>
        <div><span class="k">No: </span><span class="v">${receiptNo}</span></div>
        <div><span class="k">Date: </span><span class="v">${formatOnlyDate(new Date().toISOString(), hospital.timezone, hospital.calendarType)}</span></div>
        <!-- Referred By belongs with the receipt details, not the patient's
             own particulars, and it keeps the two columns even in height. -->
        <div><span class="k">Referred By: </span><span class="v">${row.referred_by || row.doctor?.name || '-'}</span></div>
        ${paid ? '' : '<div><span class="k">Status: </span><span class="v">Unpaid</span></div>'}
      </div>
    </div>

    <div class="line" style="margin-top:6px;border-top:1px solid #000;padding-top:4px">
      <span class="v">${row.service_name}</span>
      <span class="v">${money(row.fee)}</span>
    </div>

    ${discount > 0 ? `<div class="line"><span class="v">Discount${percent > 0 ? ` (${percent}%)` : ''}</span><span class="v">-${money(discount)}</span></div>` : ''}

    <div class="total"><span>TOTAL</span><span>${money(payable(row))}</span></div>

    ${paid ? '' : '<div style="text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;border:1px solid #000;padding:2px 0;margin:6px 0;font-size:0.9em">Unpaid</div>'}

    <div class="foot">
      <div>Please keep this receipt for your examination.</div>
      <div class="brand">${POWERED_BY_TEXT}</div>
    </div>
    <script>
      window.onload = function () {
        setTimeout(function () { window.focus(); window.print(); window.close(); }, 250);
      };
    </script>
  </body>
</html>`);
    win.document.close();
  };

  const inputClass =
    'w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all';
  const labelClass = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5';

  if (!canView && !canCreate) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        You do not have permission to view ECG receipts.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Receipt first, because that is the desk; the catalogue behind it is
          maintained far less often. Hidden entirely from users with no rights
          over it rather than shown disabled. */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        {([
          { key: 'receipts' as const, label: 'Receipt', icon: <Receipt className="w-3.5 h-3.5" />, allowed: true },
          { key: 'types' as const, label: 'ECG Services', icon: <Activity className="w-3.5 h-3.5" />, allowed: canViewTypes },
        ]).filter((tab) => tab.allowed).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'types' ? (
        <EcgServices hospital={hospital} userRole={userRole} />
      ) : (
      <>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">ECG Receipts</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Raise the charge, take the fee and print the receipt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patient, service, phone..."
              className="w-56 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          {canCreate && <AddButton onClick={() => openModal()} label="Add ECG Receipt" />}
        </div>
      </div>

      <HospitalSelector
        userRole={userRole}
        selectedHospitalId={selectedHospitalId}
        onHospitalChange={setSelectedHospitalId}
      />

      {outstanding > 0 && (
        <p className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {outstanding} ECG receipt{outstanding === 1 ? "" : "s"} awaiting payment.
        </p>
      )}

      <DataTableCard
        total={filtered.length}
        shown={pageRows.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noun="receipts"
        maxHeight="calc(100vh - 320px)"
      >
        <DataTableHead>
          <Th sort={sort} field="performed_at">Receipt / Date</Th>
          <Th>Patient</Th>
          <Th sort={sort} field="service_name">Study</Th>
          <Th sort={sort} field="fee" align="right">Fee</Th>
          <Th sort={sort} field="discount_amount" align="right">Discount</Th>
          <Th sort={sort} field="net_amount" align="right">Net</Th>
          <Th sort={sort} field="payment_status">Payment</Th>
          <Th align="center">Actions</Th>
        </DataTableHead>
        <DataTableBody>
          {loading ? (
            <TableLoading colSpan={8} />
          ) : pageRows.length === 0 ? (
            <TableEmpty
              colSpan={8}
              message="No ECG receipts yet"
              hint={searchTerm ? undefined : 'Raise a receipt to get started.'}
              icon={<Receipt className="w-6 h-6 text-gray-400" />}
            />
          ) : (
            (pageRows as EcgReceiptApi[]).map((row) => (
              <Tr key={row.id}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <RowIcon tone="blue">
                      <Receipt className="w-4 h-4" />
                    </RowIcon>
                    <CellStack
                      primary={formatOnlyDate(row.performed_at, hospital.timezone, hospital.calendarType)}
                      secondary={`#${row.receipt_number || row.sequence_id || row.id}`}
                    />
                  </div>
                </td>
                <td className="px-4 py-2">
                  <CellStack
                    primary={row.patient?.name ?? '-'}
                    secondary={`${row.patient?.age ?? '-'} Y / ${row.patient?.gender ?? '-'}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <TablePill tone="purple">{row.service_name}</TablePill>
                  {row.referred_by && (
                    <div className="mt-0.5">
                      <CellText>Ref: {row.referred_by}</CellText>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <CellNumber>{money(row.fee)}</CellNumber>
                </td>
                <td className="px-4 py-2 text-right">
                  {Number(row.discount_amount ?? 0) > 0 ? (
                    <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400">
                      {money(row.discount_amount)}
                      {Number(row.discount_percentage ?? 0) > 0 && ` (${row.discount_percentage}%)`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <CellNumber tone="money">{money(payable(row))}</CellNumber>
                </td>
                <td className="px-4 py-2">
                  <TablePill tone={paymentTone(row.payment_status)}>{row.payment_status}</TablePill>
                  {row.paid_by && (
                    <div className="text-[10px] text-gray-500 mt-0.5">by {row.paid_by}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {canTakePayment && row.payment_status !== 'paid' && (
                      <TableAction
                        tone="success"
                        title="Take payment"
                        disabled={busyId === row.id}
                        onClick={() => setPaying(row)}
                      >
                        {busyId === row.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Wallet className="w-3.5 h-3.5" />
                        )}
                      </TableAction>
                    )}
                    <TableAction tone="view" title="View details" onClick={() => setViewing(row)}>
                      <ViewIcon />
                    </TableAction>
                    {canPrintReceipt && (
                      <TableAction tone="edit" title="Print receipt" onClick={() => printReceipt(row)}>
                        <Printer className="w-3.5 h-3.5" />
                      </TableAction>
                    )}
                    {canEdit && (
                      <TableAction tone="primary" title="Edit" onClick={() => openModal(row)}>
                        <EditIcon />
                      </TableAction>
                    )}
                    {canReversePayment && row.payment_status === 'paid' && (
                      <TableAction
                        tone="warning"
                        title="Reverse payment"
                        disabled={busyId === row.id}
                        onClick={() => setReturning(row)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </TableAction>
                    )}
                    {canDelete && (
                      <TableAction tone="delete" title="Delete" onClick={() => remove(row)}>
                        <DeleteIcon />
                      </TableAction>
                    )}
                  </div>
                </td>
              </Tr>
            ))
          )}
        </DataTableBody>
      </DataTableCard>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {editing ? 'Edit ECG Receipt' : 'Add ECG Receipt'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={guard(submit)} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Patient</label>
                <SearchableSelect
                  value={form.patientId}
                  onChange={(value) => setForm((p) => ({ ...p, patientId: value }))}
                  options={hospitalPatients.map((p) => ({
                    value: String(p.id),
                    label: p.name,
                    meta: patientMeta(p) || undefined,
                  }))}
                  placeholder="Search patient..."
                  required
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Doctor (optional)</label>
                <SearchableSelect
                  value={form.doctorId}
                  onChange={(value) => setForm((p) => ({ ...p, doctorId: value }))}
                  options={hospitalDoctors.map((d) => ({
                    value: String(d.id),
                    label: d.name,
                    meta: d.specialization || undefined,
                  }))}
                  placeholder="Search doctor..."
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Service</label>
                {/* The catalogue is the normal path, so the picker is always
                    shown -- it used to vanish when the catalogue was empty,
                    which read as a missing feature rather than as "nothing to
                    pick yet". The free-text box below appears only while the
                    catalogue is empty, so the desk keeps working. */}
                <SearchableSelect
                  value={form.ecgServiceId}
                  onChange={(value) => {
                    const picked = activeTypes.find((row) => String(row.id) === value);
                    setForm((p) => ({
                      ...p,
                      ecgServiceId: value,
                      // The name is copied, not referenced, so renaming a
                      // service later cannot rewrite receipts already printed.
                      serviceName: picked ? picked.name : p.serviceName,
                      fee: picked ? Number(picked.price || 0).toFixed(2) : p.fee,
                    }));
                  }}
                  options={activeTypes.map((row) => ({
                    value: String(row.id),
                    // A retired entry only appears here when this receipt
                    // already points at it, so say so rather than letting it
                    // look like a current choice.
                    label: row.name + (row.is_active ? '' : ' - inactive'),
                    meta: [
                      row.description?.trim() || null,
                      Number(row.price || 0) > 0 ? `${Number(row.price).toFixed(2)} AFN` : null,
                    ].filter(Boolean).join('  \u00b7  ') || undefined,
                  }))}
                  placeholder={activeTypes.length > 0 ? 'Search study...' : 'No ECG studies yet'}
                  disabled={activeTypes.length === 0}
                  emptyMessage="No ECG studies yet - add them in the ECG Services tab"
                />
                {activeTypes.length === 0 && (
                  <input
                    value={form.serviceName}
                    onChange={(e) => setForm((p) => ({ ...p, serviceName: e.target.value }))}
                    placeholder="e.g. Resting 12-lead ECG"
                    required
                    className={inputClass + ' mt-1.5'}
                  />
                )}
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Date</label>
                <input
                  type="date"
                  value={form.performedAt}
                  onChange={(e) => setForm((p) => ({ ...p, performedAt: e.target.value }))}
                  required
                  disabled={!canBackdateReceipt}
                  title={canBackdateReceipt ? undefined : 'Changing the receipt date requires the Change Receipt Date permission'}
                  className={inputClass + ' disabled:opacity-60 disabled:cursor-not-allowed'}
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Referred By (optional)</label>
                <input
                  value={form.referredBy}
                  onChange={(e) => setForm((p) => ({ ...p, referredBy: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className={labelClass}>Fee</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.fee}
                  disabled={!canSetFee}
                  title={canSetFee ? undefined : "The study's price applies; changing it requires the Set ECG Fee permission"}
                  onChange={(e) => setForm((p) => ({ ...p, fee: e.target.value }))}
                  // Money is settled to the fils on paper, so it reads that
                  // way in the form too. Normalised on blur rather than on
                  // every keystroke, which would fight the typist.
                  onBlur={() =>
                    setForm((p) => ({
                      ...p,
                      fee: p.fee === '' ? '' : Number(p.fee || 0).toFixed(2),
                    }))
                  }
                  className={inputClass + ' disabled:opacity-60 disabled:cursor-not-allowed'}
                />
              </div>
              {/* Percentage in, amount out -- hospitals announce campaigns as a
                  rate, and entering it the other way round means recomputing
                  the campaign by hand on every receipt. */}
              <div className="col-span-12 md:col-span-3">
                <label className={labelClass}>Discount %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.discountPercentage}
                  disabled={form.discountEnabled || !canApplyDiscount}
                  onChange={(e) => setForm((p) => ({ ...p, discountPercentage: e.target.value }))}
                  className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {!canApplyDiscount && (
                  <p className="text-[10px] text-gray-500 mt-0.5">No discount permission</p>
                )}
              </div>
              <div className="col-span-12">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/30">
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={form.discountEnabled}
                      onChange={(e) => setForm((p) => ({ ...p, discountEnabled: e.target.checked }))}
                      disabled={!canApplyDiscount}
                      className="disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    Full waiver (100% discount)
                  </label>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      Fee <span className="font-semibold text-gray-900 dark:text-white">{feePreview.gross.toFixed(2)}</span>
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Discount{' '}
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {feePreview.discount.toFixed(2)} ({feePreview.percent.toFixed(feePreview.percent % 1 === 0 ? 0 : 2)}%)
                      </span>
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Net: {feePreview.net.toFixed(2)} AFN
                    </span>
                  </div>
                </div>
              </div>
              <div className="col-span-12">
                <label className={labelClass}>Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="col-span-12 flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  // Both flags: `saving` is the synchronous ref lock from the
                  // guard, `isSubmitting` the existing state. State alone lets
                  // two clicks in the same frame through.
                  disabled={isSubmitting || saving}
                  className="px-4 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting || saving ? 'Saving…' : editing ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReceiptDetailsModal
        details={viewing ? detailsFor(viewing) : null}
        onClose={() => setViewing(null)}
        onPrint={viewing && canPrintReceipt ? () => printReceipt(viewing) : undefined}
      />

      <ReturnPaymentDialog
        open={Boolean(returning)}
        patientName={returning?.patient?.name}
        itemName={returning?.service_name}
        receiptNo={returning ? (returning.receipt_number || returning.sequence_id || returning.id) : null}
        amount={Number(returning?.paid_amount ?? returning?.net_amount ?? 0)}
        paidBy={returning?.paid_by}
        busy={Boolean(returning && busyId === returning.id)}
        onCancel={() => setReturning(null)}
        onConfirm={confirmReturn}
      />

      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm p-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Take Payment</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {paying.patient?.name} &mdash; {paying.service_name}
            </p>
            {Number(paying.discount_amount ?? 0) > 0 && (
              <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                Fee {money(paying.fee)} less discount {money(paying.discount_amount)}
                {Number(paying.discount_percentage ?? 0) > 0 && ` (${paying.discount_percentage}%)`}
              </p>
            )}
            <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{money(payable(paying))}</p>

            <label className="block mt-3 text-xs text-gray-600 dark:text-gray-300">
              Payment Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>

            {payable(paying) <= 0 && (
              <p className="mt-2 text-xs text-amber-600">
                This receipt has nothing left to collect. Set a fee on the receipt first.
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPaying(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => takePayment(paying)}
                disabled={busyId === paying.id || payable(paying) <= 0}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
