import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Printer,
  FileText,
  ChevronLeft,
  ChevronRight,
  ScanLine,
  LayoutTemplate,
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import '../../styles/quill-custom.css';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Hospital, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { UltrasoundReportPrint } from './UltrasoundReportPrint';
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

interface UltrasoundManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

type TabKey = 'exams' | 'templates';

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
  examinedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  referredBy: '',
  clinicalNotes: '',
  reportBody: '',
  impression: '',
  status: 'draft' as UltrasoundExamApi['status'],
  fee: '',
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

export function UltrasoundManagement({ hospital, userRole }: UltrasoundManagementProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } =
    useHospitalFilter(hospital, userRole);

  const [activeTab, setActiveTab] = useState<TabKey>('exams');
  const [exams, setExams] = useState<UltrasoundExamApi[]>([]);
  const [types, setTypes] = useState<UltrasoundTypeApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<UltrasoundExamApi | null>(null);
  const [examForm, setExamForm] = useState(emptyExamForm);
  const [patientSearch, setPatientSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examToDelete, setExamToDelete] = useState<UltrasoundExamApi | null>(null);
  const [printExam, setPrintExam] = useState<UltrasoundExamApi | null>(null);

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<UltrasoundTypeApi | null>(null);
  const [typeForm, setTypeForm] = useState(emptyTypeForm);
  const [typeToDelete, setTypeToDelete] = useState<UltrasoundTypeApi | null>(null);

  const canManageExams = hasPermission('manage_ultrasound_exams');
  const canCreateExams = hasPermission('add_ultrasound_exams') || canManageExams;
  const canEditExams = hasPermission('edit_ultrasound_exams') || canManageExams;
  const canDeleteExams = hasPermission('delete_ultrasound_exams') || canManageExams;
  const canPrintExams = hasPermission('print_ultrasound_exams') || canManageExams;

  const canManageTypes = hasPermission('manage_ultrasound_types');
  const canViewTypes = hasPermission('view_ultrasound_types') || canManageTypes;
  const canCreateTypes = hasPermission('add_ultrasound_types') || canManageTypes;
  const canEditTypes = hasPermission('edit_ultrasound_types') || canManageTypes;
  const canDeleteTypes = hasPermission('delete_ultrasound_types') || canManageTypes;

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, selectedHospitalId]);

  /* ------------------------------- Derived data ------------------------------ */

  const activeTypes = useMemo(() => types.filter((type) => type.is_active), [types]);

  const patientsForHospital = useMemo(
    () => patients.filter((p) => isAllHospitals || p.hospitalId === currentHospital.id),
    [patients, isAllHospitals, currentHospital.id]
  );

  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    if (!term) return patientsForHospital.slice(0, 200);
    return patientsForHospital
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          String(p.patientId ?? '').toLowerCase().includes(term) ||
          String(p.phone ?? '').toLowerCase().includes(term)
      )
      .slice(0, 200);
  }, [patientsForHospital, patientSearch]);

  const doctorsForHospital = useMemo(
    () => doctors.filter((d) => isAllHospitals || d.hospitalId === currentHospital.id),
    [doctors, isAllHospitals, currentHospital.id]
  );

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
    activeTab === 'exams' ? filteredExams : filteredTypes;
  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const pagedExams = filteredExams.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pagedTypes = filteredTypes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  /* --------------------------------- Exams ---------------------------------- */

  const openExamModal = (exam?: UltrasoundExamApi) => {
    setPatientSearch('');
    if (exam) {
      setEditingExam(exam);
      setExamForm({
        patientId: String(exam.patient_id),
        doctorId: exam.doctor_id ? String(exam.doctor_id) : '',
        ultrasoundTypeId: String(exam.ultrasound_type_id),
        examinedAt: format(new Date(exam.examined_at), "yyyy-MM-dd'T'HH:mm"),
        referredBy: exam.referred_by ?? '',
        clinicalNotes: exam.clinical_notes ?? '',
        reportBody: exam.report_body ?? '',
        impression: exam.impression ?? '',
        status: exam.status,
        fee: exam.fee != null ? String(exam.fee) : '',
      });
    } else {
      setEditingExam(null);
      setExamForm(emptyExamForm());
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
      toast.error('Please provide the examination date and time.');
      return;
    }

    const payload = {
      ...(scopedHospitalId ? { hospital_id: scopedHospitalId } : {}),
      patient_id: examForm.patientId,
      doctor_id: examForm.doctorId || null,
      ultrasound_type_id: examForm.ultrasoundTypeId,
      examined_at: examForm.examinedAt.replace('T', ' ') + ':00',
      referred_by: examForm.referredBy || null,
      clinical_notes: examForm.clinicalNotes || null,
      report_body: examForm.reportBody || null,
      impression: examForm.impression || null,
      status: examForm.status,
      fee: examForm.fee ? Number(examForm.fee) : 0,
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
      setExamForm(emptyExamForm());
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('ultrasound.title')}</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t('ultrasound.subtitle')} — {isAllHospitals ? 'All Hospitals' : currentHospital.name}
          </p>
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

          {activeTab === 'exams' && canCreateExams && (
            <button
              onClick={() => openExamModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('ultrasound.addExam')}
            </button>
          )}
          {activeTab === 'templates' && canCreateTypes && (
            <button
              onClick={() => openTypeModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('ultrasound.addTemplate')}
            </button>
          )}
        </div>
      </div>

      <HospitalSelector
        userRole={userRole}
        selectedHospitalId={selectedHospitalId}
        onHospitalChange={setSelectedHospitalId}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('exams')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'exams'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <ScanLine className="w-3.5 h-3.5" />
          {t('ultrasound.exams')}
        </button>
        {canViewTypes && (
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            {t('ultrasound.templates')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              {activeTab === 'exams' ? (
                <tr>
                  <th className="px-4 py-2">{t('auditLog.dateTime')}</th>
                  <th className="px-4 py-2">{t('ultrasound.patient')}</th>
                  <th className="px-4 py-2">{t('ultrasound.type')}</th>
                  <th className="px-4 py-2">{t('ultrasound.doctor')}</th>
                  <th className="px-4 py-2">{t('common.status')}</th>
                  <th className="px-4 py-2 text-center">{t('common.actions')}</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-2">{t('ultrasound.type')}</th>
                  <th className="px-4 py-2">{t('ultrasound.subtitle')}</th>
                  <th className="px-4 py-2">{t('ultrasound.defaultTemplate')}</th>
                  <th className="px-4 py-2">{t('common.status')}</th>
                  <th className="px-4 py-2 text-center">{t('common.actions')}</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {t('common.loading')}
                  </td>
                </tr>
              )}

              {!loading &&
                activeTab === 'exams' &&
                pagedExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-gray-400">
                          US-{exam.hospital_id}-{String(exam.sequence_id).padStart(4, '0')}
                        </span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {format(new Date(exam.examined_at), 'MMM dd, yyyy hh:mm a')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col max-w-[180px]">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {exam.patient?.name ?? '-'}
                        </span>
                        <span className="text-[10px] text-gray-500 truncate">
                          {exam.patient?.age ? `${exam.patient.age} Y` : ''}
                          {exam.patient?.gender ? ` / ${exam.patient.gender}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2">{exam.ultrasound_type?.name ?? '-'}</td>
                    <td className="px-4 py-2">{exam.doctor?.name ?? '-'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                          statusStyles[exam.status] ?? statusStyles.draft
                        }`}
                      >
                        {exam.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canPrintExams && (
                          <button
                            onClick={() => setPrintExam(exam)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-100 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-md transition-colors"
                            title="Preview / Print Report"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {canEditExams && (
                          <button
                            onClick={() => openExamModal(exam)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-md transition-colors"
                            title={t('ui.edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDeleteExams && (
                          <button
                            onClick={() => setExamToDelete(exam)}
                            className="p-1.5 text-rose-600 hover:bg-rose-100 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 rounded-md transition-colors"
                            title={t('ui.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading &&
                activeTab === 'templates' &&
                pagedTypes.map((type) => (
                  <tr key={type.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">{type.name}</span>
                        <span className="font-mono text-[10px] text-gray-400">{type.code || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 max-w-[260px] truncate" title={type.description ?? ''}>
                      {type.description || '—'}
                    </td>
                    <td className="px-4 py-2">
                      {type.default_template ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <FileText className="w-3.5 h-3.5" />
                          Configured
                        </span>
                      ) : (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                          type.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {type.is_active ? t('ui.active') : t('ui.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canEditTypes && (
                          <button
                            onClick={() => openTypeModal(type)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-md transition-colors"
                            title="Edit Template"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDeleteTypes && (
                          <button
                            onClick={() => setTypeToDelete(type)}
                            className="p-1.5 text-rose-600 hover:bg-rose-100 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 rounded-md transition-colors"
                            title="Delete Template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-2">
                        <ScanLine className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">
                        {activeTab === 'exams' ? t('ultrasound.noExams') : t('ultrasound.noTemplates')}
                      </p>
                      <p className="text-xs mt-0.5">
                        {searchTerm ? t('ui.tryAdjustingYourSearchTerms') : 'Create a new record to get started'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages} • {rows.length} records
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title={t('ui.previousPage')}
                aria-label={t('ui.previousPage')}
                className="p-1 px-2 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <ChevronLeft className="w-3 h-3 rtl:rotate-180" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title={t('ui.nextPage')}
                aria-label={t('ui.nextPage')}
                className="p-1 px-2 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <ChevronRight className="w-3 h-3 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Exam modal */}
      {isExamModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
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

            <form onSubmit={submitExam} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>
                  {t('ultrasound.patient')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Filter patients by name, ID or phone..."
                  className={`${inputClass} mb-1`}
                />
                <select
                  required
                  value={examForm.patientId}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, patientId: e.target.value }))}
                  title={t('ui.selectPatient')}
                  aria-label={t('ui.selectPatient')}
                  className={inputClass}
                >
                  <option value="">{t('ui.selectPatient')}</option>
                  {filteredPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.patientId} ({p.age} Y / {p.gender})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className={labelClass}>{t('ultrasound.doctor')}</label>
                <select
                  value={examForm.doctorId}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, doctorId: e.target.value }))}
                  title={t('ui.selectDoctor')}
                  aria-label={t('ui.selectDoctor')}
                  className={inputClass}
                >
                  <option value="">{t('ui.selectDoctor')}</option>
                  {doctorsForHospital.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialization}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className={labelClass}>
                  {t('ultrasound.examDateTime')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={examForm.examinedAt}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, examinedAt: e.target.value }))}
                  title="Examination date and time"
                  aria-label="Examination date and time"
                  className={inputClass}
                />
              </div>

              <div className="col-span-12 md:col-span-4">
                <label className={labelClass}>
                  {t('ultrasound.type')} <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={examForm.ultrasoundTypeId}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  title="Select Ultrasound Type"
                  aria-label="Select Ultrasound Type"
                  className={inputClass}
                >
                  <option value="">{t('ultrasound.selectType')}</option>
                  {activeTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {t('ultrasound.templateHint')}
                </p>
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className={labelClass}>{t('ultrasound.referredBy')}</label>
                <input
                  value={examForm.referredBy}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, referredBy: e.target.value }))}
                  placeholder="Referring physician"
                  className={inputClass}
                />
              </div>

              <div className="col-span-12 md:col-span-2">
                <label className={labelClass}>{t('ultrasound.fee')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={examForm.fee}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, fee: e.target.value }))}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>

              <div className="col-span-12 md:col-span-3">
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

              <div className="col-span-12 flex justify-end pt-3 gap-2 border-t border-gray-100 dark:border-gray-700 mt-1">
                <button
                  type="button"
                  onClick={() => setIsExamModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >{t('ui.cancel')}</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  {isSubmitting
                    ? editingExam
                      ? 'Updating...'
                      : t('ui.saving')
                    : editingExam
                      ? 'Update Exam'
                      : 'Save Exam'}
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
                  className={inputClass}
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
                <ReactQuill
                  value={typeForm.defaultTemplate}
                  onChange={(value) => setTypeForm((prev) => ({ ...prev, defaultTemplate: value }))}
                  placeholder="Liver:&#10;Gall Bladder:&#10;CBD:&#10;Impression:"
                  className="custom-quill-editor"
                  theme="snow"
                  modules={EDITOR_MODULES}
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  This content is loaded into the report editor whenever this type is selected on an exam.
                </p>
              </div>

              <div className="col-span-12 flex items-center gap-2">
                <input
                  id="ultrasound-type-active"
                  type="checkbox"
                  checked={typeForm.isActive}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="ultrasound-type-active" className="text-xs text-gray-700 dark:text-gray-300">
                  Active (available for selection on new exams)
                </label>
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
