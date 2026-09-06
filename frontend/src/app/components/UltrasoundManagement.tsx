import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatAge } from '../utils/age';
import { format } from 'date-fns';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Printer,
  FileText,
  ScanLine,
  LayoutTemplate,
  Receipt,
  Save,
  ClipboardCheck,
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import {
  ActivePill,
  CellStack,
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
} from './DataTable';
import ReactQuill from 'react-quill-new';
import { UltrasoundReceipts } from './UltrasoundReceipts';
import 'react-quill-new/dist/quill.snow.css';
import '../../styles/quill-custom.css';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Hospital, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getISODateInTimeZone } from '../utils/date';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { UltrasoundReportPrint } from './UltrasoundReportPrint';
import { AddButton } from './AddButton';
import {
  UltrasoundExamApi,
  UltrasoundTypeApi,
  createUltrasoundExam,
  createUltrasoundType,
  deleteUltrasoundExam,
  deleteUltrasoundType,
  listUltrasoundExams,
  listUltrasoundTypes,
  updateUltrasoundExam,
  updateUltrasoundType,
} from '../api/ultrasound';

type TabKey = 'receipts' | 'exams' | 'templates';

interface UltrasoundManagementProps {
  hospital: Hospital;
  userRole: UserRole;
  /** Set by the route, so each sidebar entry lands on its own tab. */
  initialTab?: TabKey;
}

const ITEMS_PER_PAGE = 10;

/** Toolbar shared by both rich text editors in this module. */
const EDITOR_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean'],
  ],
};

const emptyExamForm = () => ({
  patientId: '',
  doctorId: '',
  ultrasoundTypeId: '',
  examinedAt: format(new Date(), 'yyyy-MM-dd'),
  referredBy: '',
  clinicalNotes: '',
  reportBody: '',
  impression: '',
  status: 'draft' as UltrasoundExamApi['status'],
  fee: '',
  discountPercentage: '',
});

const emptyTypeForm = () => ({
  name: '',
  code: '',
  description: '',
  defaultTemplate: '',
  price: '',
  sortOrder: '0',
  isActive: true,
});

const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export function UltrasoundManagement({ hospital, userRole, initialTab }: UltrasoundManagementProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { getPrintPaperSize, loadHospitalSetting, getDefaultDiscounts } = useSettings();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } =
    useHospitalFilter(hospital, userRole);

  // Settings load per hospital on demand; the default discount below is read
  // from whatever this fetch brings back.
  useEffect(() => {
    loadHospitalSetting(currentHospital.id);
  }, [currentHospital.id, loadHospitalSetting]);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'exams');
  const [exams, setExams] = useState<UltrasoundExamApi[]>([]);
  const [types, setTypes] = useState<UltrasoundTypeApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<UltrasoundExamApi | null>(null);
  const [examForm, setExamForm] = useState(emptyExamForm);
  // Gross minus the discount, for display only -- UltrasoundExamController
  // recomputes both from the fee it stores.
  const ultrasoundNetPreview = (() => {
    const fee = Number(examForm.fee) || 0;
    const percent = Math.min(Math.max(Number(examForm.discountPercentage) || 0, 0), 100);
    return Math.max(0, Math.round((fee - (fee * percent) / 100) * 100) / 100);
  })();

  const [patientSearch, setPatientSearch] = useState('');
  const [patientListOpen, setPatientListOpen] = useState(false);
  const [referrerListOpen, setReferrerListOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examToDelete, setExamToDelete] = useState<UltrasoundExamApi | null>(null);
  const [printExam, setPrintExam] = useState<UltrasoundExamApi | null>(null);

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<UltrasoundTypeApi | null>(null);
  const [typeForm, setTypeForm] = useState(emptyTypeForm);
  const [typeToDelete, setTypeToDelete] = useState<UltrasoundTypeApi | null>(null);

  const canManageExams = hasPermission('manage_ultrasound_exams');
  // An exam is raised as a receipt at the counter.
  const canCreateExams = hasPermission('add_ultrasound_receipt') || canManageExams;
  // Filing a report is the radiologist's act, and the record names whoever
  // does it -- so it has a permission of its own rather than falling back to
  // manage_ultrasound_exams, which reception holds.
  const canEditExams = hasPermission('submit_ultrasound_result');
  const canDeleteExams = hasPermission('delete_ultrasound_exams');
  // The narrow right: remove a receipt without also being able to edit every
  // exam and its result, which is what Manage would have granted.
  const canDeleteReceipt = hasPermission('delete_ultrasound_receipt');
  const canPrintExams = hasPermission('print_ultrasound_exams') || canManageExams;

  // Reception's side of the module. Kept separate from the exam permissions
  // so the desk that takes the fee never needs rights over the clinical report.
  const canTakeUltrasoundPayment = hasPermission('manage_ultrasound_payments') || canManageExams;
  const canReverseUltrasoundPayment = hasPermission('reverse_ultrasound_payment');
  const canPrintUltrasoundReceipt =
    hasPermission('print_ultrasound_receipt') || canTakeUltrasoundPayment;
  const canViewReceipts = canTakeUltrasoundPayment || canPrintUltrasoundReceipt;


  /**
   * Today in the hospital's own timezone, not the browser's and not UTC.
   *
   * This used to be new Date().toISOString().slice(0,10), which is UTC: in
   * Kabul (UTC+4:30) every receipt raised between midnight and 04:30 defaulted
   * to YESTERDAY. The timezone comes from Settings > General > Date & Time.
   */
  const today = (tz: string = currentHospital.timezone || 'Asia/Kabul') => getISODateInTimeZone(tz);

  const canSetUltrasoundFee = hasPermission('set_ultrasound_fee');
  // Dating an exam decides which day-end sheet and which report it lands in,
  // so it is its own right -- the same one the receipt desks use.
  const canBackdateExam = hasPermission('backdate_receipts');
  // Deciding the price and deciding to discount it are separate rights: the
  // desk that sets the fee is not always the one allowed to reduce it.
  const canApplyUltrasoundDiscount = hasPermission('add_discounts')
    || hasPermission('edit_discounts')
    || hasPermission('manage_discounts');

  // The exam list is the reporting desk's queue. Kept apart from the receipt
  // rights so a cashier does not get the clinical list along with the till.
  const canViewExamsTab = hasPermission('view_ultrasound_exams')
    || hasPermission('export_ultrasound_exams')
    || canCreateExams || canEditExams || canDeleteExams || canPrintExams || canManageExams;

  const canManageTypes = hasPermission('manage_ultrasound_types');
  const canViewTypes = hasPermission('view_ultrasound_types') || canManageTypes;
  const canCreateTypes = hasPermission('add_ultrasound_types') || canManageTypes;
  const canEditTypes = hasPermission('edit_ultrasound_types') || canManageTypes;
  const canDeleteTypes = hasPermission('delete_ultrasound_types') || canManageTypes;

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      return;
    }
    // Land on the first tab this user may actually open. Defaulting to Exams
    // unconditionally showed a template-only or cashier-only user an empty
    // screen they had no way to leave except through the sidebar.
    if (canViewReceipts) {
      setActiveTab('receipts');
    } else if (canViewExamsTab) {
      setActiveTab('exams');
    } else if (canViewTypes) {
      setActiveTab('templates');
    }
    // Runs once the permissions are known; the tab is the user's to change after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewReceipts, canViewExamsTab, canViewTypes, initialTab]);

  const receiptPaperSize = getPrintPaperSize(currentHospital.id, 'ultrasound_receipt');

  /** Hospital id sent to the API; only super admins may target another tenant. */
  const scopedHospitalId = useMemo(() => {
    if (userRole !== 'super_admin') return undefined;
    return isAllHospitals ? undefined : currentHospital.id;
  }, [userRole, isAllHospitals, currentHospital.id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = scopedHospitalId ? { hospital_id: scopedHospitalId } : {};
      const [examRows, typeRows] = await Promise.all([
        listUltrasoundExams(params),
        listUltrasoundTypes(params),
      ]);
      setExams(Array.isArray(examRows) ? examRows : []);
      setTypes(Array.isArray(typeRows) ? typeRows : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load ultrasound records');
    } finally {
      setLoading(false);
    }
  }, [scopedHospitalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ------------------------------- Derived data ------------------------------ */

  const activeTypes = useMemo(() => types.filter((type) => type.is_active), [types]);

  // Code and price ride along as searchable meta: staff who know a study by its
  // code should not have to remember the full name, and at the counter the price
  // is half of what identifies the study being asked for.
  const ultrasoundTypeOptions = useMemo(
    () => activeTypes.map((type) => ({
      value: String(type.id),
      label: type.name,
      meta: [type.code, Number(type.price ?? 0) > 0 ? Number(type.price).toFixed(2) : null]
        .filter(Boolean)
        .join(' · ') || undefined,
    })),
    [activeTypes]
  );

  const patientsForHospital = useMemo(
    () => patients.filter((p) => isAllHospitals || p.hospitalId === currentHospital.id),
    [patients, isAllHospitals, currentHospital.id]
  );

  /**
   * Newest first: reception almost always wants the patient registered
   * moments ago, and with no search term that used to be buried at the far end
   * of a 200-row list.
   */
  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    const byNewest = [...patientsForHospital].sort((a, b) => Number(b.id) - Number(a.id));
    if (!term) return byNewest.slice(0, 25);
    return byNewest
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          String(p.patientId ?? '').toLowerCase().includes(term) ||
          String(p.phone ?? '').toLowerCase().includes(term)
      )
      .slice(0, 25);
  }, [patientsForHospital, patientSearch]);

  /** What the combobox shows once a patient is chosen. */
  const selectedPatientLabel = useMemo(() => {
    if (!examForm.patientId) return '';
    const chosen = patientsForHospital.find((p) => String(p.id) === String(examForm.patientId));
    return chosen ? `${chosen.name} — ${chosen.patientId} (${formatAge(chosen.age, chosen.ageUnit)} / ${chosen.gender})` : '';
  }, [examForm.patientId, patientsForHospital]);

  /** Name only, for the reporting form's summary card. */
  const selectedPatientName = useMemo(() => {
    if (!examForm.patientId) return '';
    const chosen = patientsForHospital.find((p) => String(p.id) === String(examForm.patientId));
    return chosen ? chosen.name : '';
  }, [examForm.patientId, patientsForHospital]);

  /** ID, age and sex, under the name. */
  const selectedPatientDetail = useMemo(() => {
    if (!examForm.patientId) return '';
    const chosen = patientsForHospital.find((p) => String(p.id) === String(examForm.patientId));
    if (!chosen) return '';
    return [chosen.patientId, formatAge(chosen.age, chosen.ageUnit), chosen.gender]
      .filter(Boolean)
      .join('  \u00b7  ');
  }, [examForm.patientId, patientsForHospital]);

  const selectedTypeName = useMemo(() => {
    const chosen = types.find((type) => String(type.id) === String(examForm.ultrasoundTypeId));
    return chosen ? chosen.name : '';
  }, [types, examForm.ultrasoundTypeId]);

  const doctorsForHospital = useMemo(
    () => doctors.filter((d) => isAllHospitals || d.hospitalId === currentHospital.id),
    [doctors, isAllHospitals, currentHospital.id]
  );

  /** Doctors matching what has been typed into Referred By. */
  const referrerOptions = useMemo(() => {
    const term = examForm.referredBy.trim().toLowerCase();
    if (!term) return doctorsForHospital.slice(0, 25);
    return doctorsForHospital
      .filter(
        (d) =>
          d.name.toLowerCase().includes(term) ||
          String(d.specialization ?? '').toLowerCase().includes(term)
      )
      .slice(0, 25);
  }, [doctorsForHospital, examForm.referredBy]);

  const filteredExams = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return exams;
    return exams.filter(
      (e) =>
        (e.patient?.name ?? '').toLowerCase().includes(term) ||
        (e.doctor?.name ?? '').toLowerCase().includes(term) ||
        (e.ultrasound_type?.name ?? '').toLowerCase().includes(term) ||
        (e.referred_by ?? '').toLowerCase().includes(term) ||
        (e.impression ?? '').toLowerCase().includes(term) ||
        String(e.sequence_id).includes(term)
    );
  }, [exams, searchTerm]);

  /**
   * The specialist's queue: exams reception has settled.
   *
   * Unpaid exams stay on the receipts tab, so an exam cannot be examined and
   * reported before anyone has taken the fee. Users who cannot see the receipts
   * tab keep the unfiltered list, otherwise an exam they are responsible for
   * would exist on no tab they can reach.
   */
  const examQueue = useMemo(
    () => filteredExams.filter((exam) => exam.payment_status === 'paid'),
    [filteredExams]
  );

  const filteredTypes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return types;
    return types.filter(
      (type) =>
        type.name.toLowerCase().includes(term) ||
        (type.code ?? '').toLowerCase().includes(term) ||
        (type.description ?? '').toLowerCase().includes(term)
    );
  }, [types, searchTerm]);

  const rows: Array<UltrasoundExamApi | UltrasoundTypeApi> =
    activeTab === 'exams' ? examQueue : filteredTypes;
  // Sorted and paged through the shared table, so the column headers work here
  // the same way they do on Doctor Management. Exams default to newest first;
  // the template catalogue reads alphabetically.
  const sort = useTableSort<any>(
    rows,
    activeTab === 'exams' ? 'examined_at' : 'name',
    activeTab === 'exams' ? 'desc' : 'asc'
  );
  const { page, setPage, totalPages, pageRows } = usePagination<any>(sort.rows, ITEMS_PER_PAGE);
  // Paginates the same list the page counts, and the same list the paid filter
  // produced. Slicing filteredExams here meant the rows ignored that filter
  // entirely while the page count respected it.
  const pagedExams = pageRows as UltrasoundExamApi[];
  const pagedTypes = pageRows as UltrasoundTypeApi[];

  // Declared after usePagination on purpose: referencing setPage in a hook
  // above it would read the binding before it is initialised.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, activeTab, selectedHospitalId, setPage]);

  /* --------------------------------- Exams ---------------------------------- */

  /**
   * Reception raises the bill; the specialist writes the report. On the
   * receipts tab the modal shows only what the counter needs -- who the patient
   * is, what examination, and what it costs. The clinical fields are not merely
   * hidden from view: reception has no reason to fill them, and an empty report
   * saved from here would look like a report that had been written.
   */
  const isReceptionForm = activeTab === 'receipts';

  const openExamModal = (exam?: UltrasoundExamApi) => {
    setPatientSearch('');
    setPatientListOpen(false);
    if (exam) {
      setEditingExam(exam);
      setExamForm({
        patientId: String(exam.patient_id),
        doctorId: exam.doctor_id ? String(exam.doctor_id) : '',
        ultrasoundTypeId: String(exam.ultrasound_type_id),
        examinedAt: getISODateInTimeZone(currentHospital.timezone || 'Asia/Kabul', new Date(exam.examined_at)),
        referredBy: exam.referred_by ?? '',
        clinicalNotes: exam.clinical_notes ?? '',
        reportBody: exam.report_body ?? '',
        impression: exam.impression ?? '',
        status: exam.status,
        fee: exam.fee != null ? String(exam.fee) : '',
        discountPercentage: exam.discount_percentage ? String(Number(exam.discount_percentage)) : '',
      });
    } else {
      setEditingExam(null);
      const seeded = getDefaultDiscounts(currentHospital.id).ultrasound;
      setExamForm({
        ...emptyExamForm(),
        // A new exam is dated today; editing keeps whatever was saved.
        examinedAt: today(),
        // A standing rate belongs in the percentage field. There is a
        // discount_enabled flag on the row too, but that one is a full waiver.
        discountPercentage: seeded > 0 ? String(seeded) : '',
      });
    }
    setIsExamModalOpen(true);
  };

  /**
   * Selecting a type loads its template into the editor. On an existing exam we
   * only overwrite the saved report when the user confirms, so edits are never
   * silently discarded.
   */
  const handleTypeChange = (typeId: string) => {
    const selected = types.find((type) => String(type.id) === typeId);
    const template = selected?.default_template ?? '';
    const currentBody = examForm.reportBody?.replace(/<[^>]*>/g, '').trim();

    if (currentBody && template) {
      const confirmed = window.confirm(
        'Load the report template for this ultrasound type? This will replace the current report content.'
      );
      if (!confirmed) {
        setExamForm((prev) => ({ ...prev, ultrasoundTypeId: typeId }));
        return;
      }
    }

    setExamForm((prev) => ({
      ...prev,
      ultrasoundTypeId: typeId,
      reportBody: template || prev.reportBody,
      fee: prev.fee || (selected?.price ? String(selected.price) : ''),
    }));
  };

  const submitExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!examForm.patientId) {
      toast.error('Please select a patient.');
      return;
    }
    if (!examForm.ultrasoundTypeId) {
      toast.error('Please select an ultrasound type.');
      return;
    }
    if (!examForm.examinedAt) {
      toast.error('Please provide the examination date.');
      return;
    }

    const payload = {
      ...(scopedHospitalId ? { hospital_id: scopedHospitalId } : {}),
      patient_id: examForm.patientId,
      doctor_id: examForm.doctorId || null,
      ultrasound_type_id: examForm.ultrasoundTypeId,
      // The field is date-only now. This used to append ':00' to a
      // datetime-local value; on a plain date it produced '2026-08-16:00',
      // which the backend rejected as not a date.
      examined_at: examForm.examinedAt.includes('T')
        ? examForm.examinedAt.replace('T', ' ') + ':00'
        : `${examForm.examinedAt} 00:00:00`,
      referred_by: examForm.referredBy || null,
      clinical_notes: examForm.clinicalNotes || null,
      report_body: examForm.reportBody || null,
      impression: examForm.impression || null,
      // Submitting the report is what completes the exam. A radiologist
      // finishing their work should not have to remember a second step, and a
      // draft left behind by a forgotten dropdown reads as unfinished work in
      // the queue. A cancelled exam stays cancelled.
      status:
        !isReceptionForm && examForm.status === 'draft' ? 'completed' : examForm.status,
      fee: examForm.fee ? Number(examForm.fee) : 0,
      discount_percentage: examForm.discountPercentage ? Number(examForm.discountPercentage) : 0,
    };

    setIsSubmitting(true);
    try {
      if (editingExam) {
        await updateUltrasoundExam(editingExam.id, payload);
        toast.success('Ultrasound exam updated');
      } else {
        await createUltrasoundExam(payload);
        toast.success('Ultrasound exam created');
      }
      setIsExamModalOpen(false);
      setEditingExam(null);
      const seeded = getDefaultDiscounts(currentHospital.id).ultrasound;
      setExamForm({
        ...emptyExamForm(),
        // A new exam is dated today; editing keeps whatever was saved.
        examinedAt: today(),
        // A standing rate belongs in the percentage field. There is a
        // discount_enabled flag on the row too, but that one is a full waiver.
        discountPercentage: seeded > 0 ? String(seeded) : '',
      });
      await loadData();
    } catch (error: any) {
      const errors = error?.response?.data?.errors;
      const first = errors ? (Object.values(errors)[0] as string[])?.[0] : null;
      toast.error(first || error?.response?.data?.message || 'Failed to save ultrasound exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteExam = async () => {
    if (!examToDelete) return;
    try {
      await deleteUltrasoundExam(examToDelete.id);
      setExamToDelete(null);
      toast.success('Ultrasound exam deleted');
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete ultrasound exam');
    }
  };

  /* -------------------------------- Templates -------------------------------- */

  const openTypeModal = (type?: UltrasoundTypeApi) => {
    if (type) {
      setEditingType(type);
      setTypeForm({
        name: type.name,
        code: type.code ?? '',
        description: type.description ?? '',
        defaultTemplate: type.default_template ?? '',
        price: type.price != null ? String(type.price) : '',
        sortOrder: String(type.sort_order ?? 0),
        isActive: type.is_active,
      });
    } else {
      setEditingType(null);
      setTypeForm(emptyTypeForm());
    }
    setIsTypeModalOpen(true);
  };

  const submitType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!typeForm.name.trim()) {
      toast.error('Please provide a name for the ultrasound type.');
      return;
    }

    const payload = {
      ...(scopedHospitalId ? { hospital_id: scopedHospitalId } : {}),
      name: typeForm.name.trim(),
      code: typeForm.code || null,
      description: typeForm.description || null,
      default_template: typeForm.defaultTemplate || null,
      price: typeForm.price ? Number(typeForm.price) : 0,
      sort_order: typeForm.sortOrder ? Number(typeForm.sortOrder) : 0,
      is_active: typeForm.isActive,
    };

    setIsSubmitting(true);
    try {
      if (editingType) {
        await updateUltrasoundType(editingType.id, payload);
        toast.success('Report template updated');
      } else {
        await createUltrasoundType(payload);
        toast.success('Report template created');
      }
      setIsTypeModalOpen(false);
      setEditingType(null);
      setTypeForm(emptyTypeForm());
      await loadData();
    } catch (error: any) {
      const errors = error?.response?.data?.errors;
      const first = errors ? (Object.values(errors)[0] as string[])?.[0] : null;
      toast.error(first || error?.response?.data?.message || 'Failed to save report template');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteType = async () => {
    if (!typeToDelete) return;
    try {
      await deleteUltrasoundType(typeToDelete.id);
      setTypeToDelete(null);
      toast.success('Report template deleted');
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete report template');
    }
  };

  /* ---------------------------------- View ---------------------------------- */

  const inputClass =
    'w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all';
  const labelClass = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5';

  return (
    <div className="space-y-3">
      {/* Radiology is now two modalities in the sidebar rather than a flat list
          of ultrasound screens, so the three desks live here as tabs. A tab the
          user has no permission for is not offered at all. */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        {([
          { key: 'receipts' as TabKey, label: t('nav.ultrasoundReceipts'), icon: <Receipt className="w-3.5 h-3.5" />, allowed: canViewReceipts },
          { key: 'exams' as TabKey, label: t('nav.ultrasound'), icon: <ScanLine className="w-3.5 h-3.5" />, allowed: canViewExamsTab },
          { key: 'templates' as TabKey, label: t('nav.ultrasoundTemplates'), icon: <LayoutTemplate className="w-3.5 h-3.5" />, allowed: canViewTypes },
        ]).filter((tab) => tab.allowed).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {activeTab === 'receipts'
              ? 'Ultrasound Receipts'
              : activeTab === 'templates'
                ? 'Ultrasound Report Templates'
                : 'Ultrasound Exams'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`${t('common.search')}...`}
              className="w-56 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Only on Receipts: an exam enters the system as a paid order, so
              the exam list is a work queue rather than somewhere to create. */}
          {activeTab === 'receipts' && canCreateExams && (
            <AddButton onClick={() => openExamModal()} label="Add ultrasound receipt" />
          )}
          {activeTab === 'templates' && canCreateTypes && (
            <AddButton onClick={() => openTypeModal()} label={t('ultrasound.addTemplate')} />
          )}
        </div>
      </div>

      <HospitalSelector
        userRole={userRole}
        selectedHospitalId={selectedHospitalId}
        onHospitalChange={setSelectedHospitalId}
      />

      {activeTab === 'receipts' ? (
        <UltrasoundReceipts
          hospital={currentHospital}
          exams={filteredExams}
          paperSize={receiptPaperSize}
          canTakePayment={canTakeUltrasoundPayment}
          canReversePayment={canReverseUltrasoundPayment}
          canPrintReceipt={canPrintUltrasoundReceipt}
          canDelete={canDeleteReceipt || canDeleteExams || canManageExams}
          onChanged={loadData}
        />
      ) : (
      <>
      <DataTableCard
        total={rows.length}
        shown={pageRows.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        maxHeight="calc(100vh - 300px)"
      >
        <DataTableHead>
          {activeTab === 'exams' ? (
            <>
              <Th sort={sort} field="examined_at">{t('auditLog.dateTime')}</Th>
              <Th>{t('ultrasound.patient')}</Th>
              <Th>{t('ultrasound.type')}</Th>
              <Th sort={sort} field="referred_by">{t('ultrasound.referredBy')}</Th>
              <Th sort={sort} field="status">{t('common.status')}</Th>
              <Th align="center">{t('common.actions')}</Th>
            </>
          ) : (
            <>
              <Th sort={sort} field="name">{t('ultrasound.type')}</Th>
              <Th sort={sort} field="description">{t('ultrasound.subtitle')}</Th>
              <Th>{t('ultrasound.defaultTemplate')}</Th>
              <Th sort={sort} field="is_active">{t('common.status')}</Th>
              <Th align="center">{t('common.actions')}</Th>
            </>
          )}
        </DataTableHead>
        <DataTableBody>
          {loading && <TableLoading colSpan={6} />}

          {!loading && activeTab === 'exams' && pagedExams.map((exam) => (
            <Tr key={exam.id}>
              <td className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <RowIcon tone="blue">
                    <ScanLine className="w-4 h-4" />
                  </RowIcon>
                  <CellStack
                    primary={format(new Date(exam.examined_at), 'MMM dd, yyyy')}
                    secondary={`#${exam.sequence_id}`}
                  />
                </div>
              </td>
              <td className="px-4 py-2">
                <div className="max-w-[180px]">
                  <CellStack
                    primary={exam.patient?.name ?? '-'}
                    secondary={`${exam.patient?.age ? formatAge(exam.patient.age, (exam.patient as any)?.ageUnit) : ''}${exam.patient?.gender ? ` / ${exam.patient.gender}` : ''}`}
                  />
                </div>
              </td>
              <td className="px-4 py-2">
                <TablePill tone="purple">{exam.ultrasound_type?.name ?? '-'}</TablePill>
              </td>
              <td className="px-4 py-2">
                <CellText>{exam.referred_by || exam.doctor?.name || '-'}</CellText>
              </td>
              <td className="px-4 py-2">
                <TablePill tone={exam.status === 'completed' ? 'green' : exam.status === 'cancelled' ? 'red' : 'amber'}>
                  {exam.status}
                </TablePill>
              </td>
              <td className="px-4 py-2 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  {canPrintExams && (
                    <TableAction tone="primary" title="Preview / Print Report" onClick={() => setPrintExam(exam)}>
                      <Printer className="w-3.5 h-3.5" />
                    </TableAction>
                  )}
                  {canEditExams && (
                    <button
                      onClick={() => openExamModal(exam)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-md transition-colors"
                      title={exam.status === 'completed' ? 'View / edit report' : 'Submit report'}
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {exam.status === 'completed' ? 'Report' : 'Submit Report'}
                      </span>
                    </button>
                  )}
                  {canDeleteExams && (
                    <TableAction tone="delete" title={t('ui.delete')} onClick={() => setExamToDelete(exam)}>
                      <DeleteIcon />
                    </TableAction>
                  )}
                </div>
              </td>
            </Tr>
          ))}

          {!loading && activeTab === 'templates' && pagedTypes.map((type) => (
            <Tr key={type.id}>
              <td className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <RowIcon tone="purple">
                    <LayoutTemplate className="w-4 h-4" />
                  </RowIcon>
                  <CellStack primary={type.name} secondary={type.code || '—'} />
                </div>
              </td>
              <td className="px-4 py-2 max-w-[260px]">
                <div className="truncate text-[10px] text-gray-600 dark:text-gray-400" title={type.description ?? ''}>
                  {type.description || '—'}
                </div>
              </td>
              <td className="px-4 py-2">
                {type.default_template ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                    <FileText className="w-3.5 h-3.5" />
                    Configured
                  </span>
                ) : (
                  <CellText>Not set</CellText>
                )}
              </td>
              <td className="px-4 py-2">
                <ActivePill active={type.is_active} />
              </td>
              <td className="px-4 py-2 text-center">
                <TableActions>
                  {canEditTypes && (
                    <TableAction tone="edit" title="Edit Template" onClick={() => openTypeModal(type)}>
                      <EditIcon />
                    </TableAction>
                  )}
                  {canDeleteTypes && (
                    <TableAction tone="delete" title="Delete Template" onClick={() => setTypeToDelete(type)}>
                      <DeleteIcon />
                    </TableAction>
                  )}
                </TableActions>
              </td>
            </Tr>
          ))}

          {!loading && rows.length === 0 && (
            <TableEmpty
              colSpan={6}
              message={activeTab === 'exams' ? t('ultrasound.noExams') : t('ultrasound.noTemplates')}
              hint={searchTerm ? t('ui.tryAdjustingYourSearchTerms') : 'Create a new record to get started'}
              icon={<ScanLine className="w-6 h-6 text-gray-400" />}
            />
          )}
        </DataTableBody>
      </DataTableCard>
      </>
      )}

      {/* Exam modal */}
      {isExamModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          {/* Narrower and taller: six short fields spread over a 4xl card
              left every input stranded in white space and the whole form on
              two shallow rows. Two per row down a narrow card reads as a form
              rather than a toolbar. */}
          {/* scrollbar-gutter reserves the scrollbar's track whether or not one
              is showing. Without it, opening a dropdown made the card taller
              than the viewport, the scrollbar appeared, and every field inside
              jumped narrower by its width -- then back again on close. */}
          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full ${
              isReceptionForm ? 'max-w-xl' : 'max-w-5xl'
            } max-h-[92vh] overflow-y-auto border border-gray-200 dark:border-gray-700`}
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {editingExam ? t('ultrasound.editExam') : t('ultrasound.newExam')}
              </h2>
              <button
                onClick={() => setIsExamModalOpen(false)}
                title={t('ui.close')}
                aria-label="Close modal"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={submitExam}
              className="p-5 grid grid-cols-12 gap-x-4 gap-y-3"
            >
              {/* One field, not a filter box feeding a separate dropdown.
                  Typing narrows the list; empty shows the most recently
                  registered patients, which is what reception needs. */}
              {/* Reporting works on an exam reception already booked: the
                  patient, referrer and study are settled facts by now, so they
                  are shown as a summary rather than as three editable pickers
                  the radiologist could change by accident. */}
              {!isReceptionForm && (
              <div className="col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-px rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700">
                <div className="bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('ultrasound.patient')}
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {selectedPatientName || '—'}
                  </div>
                  {selectedPatientDetail && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {selectedPatientDetail}
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('ultrasound.referredBy')}
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {examForm.referredBy || '—'}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('ultrasound.type')}
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {selectedTypeName || '—'}
                  </div>
                </div>
              </div>
              )}

              {isReceptionForm && (
              <>
              <div className="col-span-12 md:col-span-6 relative">
                <label className={labelClass}>
                  {t('ultrasound.patient')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={selectedPatientLabel || patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setPatientListOpen(true);
                    // Typing after a choice means they are changing it.
                    if (examForm.patientId) {
                      setExamForm((prev) => ({ ...prev, patientId: '' }));
                    }
                  }}
                  onFocus={() => setPatientListOpen(true)}
                  onBlur={() => window.setTimeout(() => setPatientListOpen(false), 150)}
                  placeholder="Search by name, ID or phone..."
                  className={inputClass}
                  autoComplete="off"
                />
                {!examForm.patientId && (
                  <input type="text" required value="" onChange={() => {}} tabIndex={-1}
                    aria-hidden="true"
                    className="absolute opacity-0 h-0 w-0 pointer-events-none" />
                )}
                {patientListOpen && (
                  <ul className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
                    {filteredPatients.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setExamForm((prev) => ({ ...prev, patientId: String(p.id) }));
                            setPatientSearch('');
                            setPatientListOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        >
                          {/* Name on its own line; the details that tell two
                              patients of the same name apart go quietly
                              underneath rather than trailing off the row. */}
                          <div className="text-xs font-medium text-gray-900 dark:text-white">{p.name}</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            ID {p.patientId} · {formatAge(p.age, p.ageUnit)} / {p.gender}
                            {p.phone ? ` · ${p.phone}` : ''}
                          </div>
                        </button>
                      </li>
                    ))}
                    {filteredPatients.length === 0 && (
                      <li className="px-3 py-2 text-xs text-gray-500">No matching patient.</li>
                    )}
                  </ul>
                )}
              </div>

              <div className={`col-span-12 relative md:col-span-6`}>
                <label className={labelClass}>{t('ultrasound.referredBy')}</label>
                <input
                  value={examForm.referredBy}
                  onChange={(e) => {
                    setExamForm((prev) => ({ ...prev, referredBy: e.target.value }));
                    setReferrerListOpen(true);
                  }}
                  onFocus={() => setReferrerListOpen(true)}
                  onBlur={() => window.setTimeout(() => setReferrerListOpen(false), 150)}
                  placeholder="Referring physician"
                  className={inputClass}
                  autoComplete="off"
                />
                {referrerListOpen && referrerOptions.length > 0 && (
                  <ul className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
                    {referrerOptions.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setExamForm((prev) => ({ ...prev, referredBy: d.name }));
                            setReferrerListOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        >
                          <div className="text-xs font-medium text-gray-900 dark:text-white">{d.name}</div>
                          {(d.specialization || d.registrationNumber) && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              {[d.specialization, d.registrationNumber && `Reg. ${d.registrationNumber}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>
                  {t('ultrasound.type')} <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={examForm.ultrasoundTypeId}
                  options={ultrasoundTypeOptions}
                  onChange={handleTypeChange}
                  placeholder={t('ultrasound.selectType')}
                  title={t('ultrasound.type')}
                  disabled={!isReceptionForm}
                  required
                />

              </div>
              </>
              )}

              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>
                  {t('ultrasound.date', 'Date')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={examForm.examinedAt}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, examinedAt: e.target.value }))}
                  disabled={!canBackdateExam}
                  title={canBackdateExam ? 'Examination date' : 'Changing the date requires the Change Receipt Date permission'}
                  aria-label="Examination date"
                  className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                />
              </div>

              {/* Kept for reception: who sent the patient is billing
                  information, unlike the reporting radiologist. Free text let
                  the same doctor be spelled three ways, so it now picks from
                  the doctor list while still accepting an outside referrer. */}
              {/* Financial field: whoever raises the order is not necessarily
                  allowed to decide what it costs. Without the permission the
                  price is inherited from the ultrasound type. */}
              {!isReceptionForm ? null : (
              <div className="col-span-12 md:col-span-4">
                <label className={labelClass}>{t('ultrasound.fee')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={examForm.fee}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, fee: e.target.value }))}
                  onBlur={() =>
                    setExamForm((prev) => ({
                      ...prev,
                      fee: prev.fee === '' ? '' : Number(prev.fee || 0).toFixed(2),
                    }))
                  }
                  placeholder="0.00"
                  disabled={!canSetUltrasoundFee}
                  className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                />
              </div>
              )}

              {/* Gross, discount and net, in that order, so the receipt and
                  this form tell the same story. The net is derived here only
                  as a preview -- the server recomputes it. */}
              {!isReceptionForm ? null : (
              <div className="col-span-12 md:col-span-4">
                <label className={labelClass}>{t('ultrasound.discountPercent', 'Discount %')}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={examForm.discountPercentage}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, discountPercentage: e.target.value }))}
                  placeholder="0"
                  disabled={!canApplyUltrasoundDiscount}
                  className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                />
              </div>
              )}

              {!isReceptionForm ? null : (
              <div className="col-span-12 md:col-span-4">
                <label className={labelClass}>{t('ultrasound.netAmount', 'Net Amount')}</label>
                {/* Always read-only: it is fee minus discount, and the server
                    recomputes it on save. Dimmed when the user can move
                    neither input, so it reads as inert rather than broken. */}
                <div
                  className={`${inputClass} bg-gray-50 dark:bg-gray-900/40 font-semibold tabular-nums ${
                    canSetUltrasoundFee || canApplyUltrasoundDiscount
                      ? ''
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  {ultrasoundNetPreview.toFixed(2)}
                </div>
              </div>
              )}

              {/* Status is no longer set by hand on the reporting form:
                  submitting the report is what completes it (see submitExam).
                  The picker stays only for a cancelled exam, which is the one
                  transition submitting cannot express. */}
              {!isReceptionForm && examForm.status === 'cancelled' && (
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>
                  {t('common.status')} <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={examForm.status}
                  onChange={(e) =>
                    setExamForm((prev) => ({ ...prev, status: e.target.value as UltrasoundExamApi['status'] }))
                  }
                  title="Exam status"
                  aria-label="Exam status"
                  className={inputClass}
                >
                  <option value="draft">{t('ultrasound.status.draft')}</option>
                  <option value="completed">{t('ultrasound.status.completed')}</option>
                  <option value="cancelled">{t('ultrasound.status.cancelled')}</option>
                </select>
              </div>
              )}

              {!isReceptionForm && (
              <div className="col-span-12">
                <label className={labelClass}>{t('ultrasound.clinicalNotes')}</label>
                <textarea
                  rows={2}
                  value={examForm.clinicalNotes}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, clinicalNotes: e.target.value }))}
                  placeholder="Reason for the examination..."
                  className={`${inputClass} resize-none`}
                />
              </div>
              )}

              {!isReceptionForm && (
              <div className="col-span-12">
                <label className={labelClass}>{t('ultrasound.report')}</label>
                <ReactQuill
                  value={examForm.reportBody}
                  onChange={(value) => setExamForm((prev) => ({ ...prev, reportBody: value }))}
                  placeholder="Select an ultrasound type to load its template, then edit the findings..."
                  className="custom-quill-editor"
                  theme="snow"
                  modules={EDITOR_MODULES}
                />
              </div>
              )}

              {!isReceptionForm && (
              <div className="col-span-12">
                <label className={labelClass}>{t('ultrasound.impression')}</label>
                <textarea
                  rows={2}
                  value={examForm.impression}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, impression: e.target.value }))}
                  placeholder="Summary / conclusion..."
                  className={`${inputClass} resize-none`}
                />
              </div>
              )}

              <div className="col-span-12 flex justify-end pt-3 gap-2 border-t border-gray-100 dark:border-gray-700 mt-1">
                <button
                  type="button"
                  onClick={() => setIsExamModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >{t('ui.cancel')}</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSubmitting ? t('ui.saving') : t('ui.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template modal */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {editingType ? t('ultrasound.editTemplate') : t('ultrasound.newTemplate')}
              </h2>
              <button
                onClick={() => setIsTypeModalOpen(false)}
                title={t('ui.close')}
                aria-label="Close modal"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitType} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-5">
                <label className={labelClass}>{t('ui.name')}<span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Abdomen"
                  className={inputClass}
                />
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className={labelClass}>{t('ui.code')}</label>
                <input
                  value={typeForm.code}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="US-ABD"
                  className={inputClass}
                />
              </div>

              <div className="col-span-12 md:col-span-2">
                <label className={labelClass}>{t('ui.price')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={typeForm.price}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  disabled={!canSetUltrasoundFee}
                  className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                />
              </div>

              <div className="col-span-12 md:col-span-2">
                <label className={labelClass}>Sort Order</label>
                <input
                  type="number"
                  min="0"
                  value={typeForm.sortOrder}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="col-span-12">
                <label className={labelClass}>{t('ui.description')}</label>
                <input
                  value={typeForm.description}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Short description of this study"
                  className={inputClass}
                />
              </div>

              <div className="col-span-12">
                <label className={labelClass}>{t('ultrasound.defaultTemplate')}</label>
                <div className="[&_.ql-editor]:min-h-[260px]">
                  <ReactQuill
                    value={typeForm.defaultTemplate}
                    onChange={(value) => setTypeForm((prev) => ({ ...prev, defaultTemplate: value }))}
                    placeholder="Liver:&#10;Gall Bladder:&#10;CBD:&#10;Impression:"
                    className="custom-quill-editor"
                    theme="snow"
                    modules={EDITOR_MODULES}
                  />
                </div>
              </div>

              <div className="col-span-12 md:col-span-4">
                <label className={labelClass}>{t('ui.status')}</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={typeForm.isActive}
                  onClick={() => setTypeForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded border text-xs transition-colors ${
                    typeForm.isActive
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span className="truncate">{typeForm.isActive ? t('ui.active') : t('ui.inactive')}</span>
                  <span className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
                    typeForm.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                      typeForm.isActive ? 'translate-x-4' : 'translate-x-1'
                    }`} />
                  </span>
                </button>
              </div>

              <div className="col-span-12 flex justify-end pt-3 gap-2 border-t border-gray-100 dark:border-gray-700 mt-1">
                <button
                  type="button"
                  onClick={() => setIsTypeModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >{t('ui.cancel')}</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  {isSubmitting ? 'Saving...' : editingType ? 'Update Template' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmations */}
      {examToDelete && (
        <ConfirmDelete
          title={t('ultrasound.deleteExam')}
          message={t('ultrasound.deleteExamConfirm')}
          detail={`${examToDelete.patient?.name ?? 'Patient'} — ${examToDelete.ultrasound_type?.name ?? ''}`}
          onCancel={() => setExamToDelete(null)}
          onConfirm={confirmDeleteExam}
        />
      )}

      {typeToDelete && (
        <ConfirmDelete
          title="Delete Report Template"
          message={t('ultrasound.deleteTemplateConfirm')}
          detail={typeToDelete.name}
          onCancel={() => setTypeToDelete(null)}
          onConfirm={confirmDeleteType}
        />
      )}

      {printExam && (
        <UltrasoundReportPrint
          hospital={isAllHospitals ? hospital : currentHospital}
          exam={printExam}
          onClose={() => setPrintExam(null)}
        />
      )}
    </div>
  );
}

interface ConfirmDeleteProps {
  title: string;
  message: string;
  detail?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDelete({ title, message, detail, onCancel, onConfirm }: ConfirmDeleteProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onCancel} title={t('ui.close')} aria-label={t('ui.close')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
          {detail && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{detail}</p>}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >{t('ui.cancel')}</button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700">{t('ui.delete')}</button>
        </div>
      </div>
    </div>
  );
}
