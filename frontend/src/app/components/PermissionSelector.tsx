import React, { useMemo, useState } from 'react';
import { Search, X, CheckSquare, Square } from 'lucide-react';

export interface PermissionOption {
  id: string;
  name: string;
  displayName?: string;
  category?: string;
}

interface PermissionSelectorProps {
  permissions: PermissionOption[];
  selected: string[];
  onToggle: (permissionId: string) => void;
  onSetMany: (permissionIds: string[], checked: boolean) => void;
  disabled?: boolean;
}

/**
 * Action verbs that prefix a permission name. Order matters: longer, more
 * specific prefixes must be tried before shorter ones that are their prefix.
 */
const ACTIONS = [
  'view', 'add', 'edit', 'delete', 'export', 'print', 'import', 'manage',
  'create', 'register', 'schedule', 'update', 'dispense', 'enter', 'approve',
  'generate', 'record', 'reset', 'submit',
];

/**
 * Categories that are folded into a parent tab, so related permissions stay
 * under one main module. Pharmacy Finance panels (Sales Invoice, Sales Return,
 * Purchase Invoice, Purchase Return) belong under Pharmacy rather than forming
 * a tab of their own.
 */
const CATEGORY_TO_TAB: Record<string, string> = {
  // --- Reception ---------------------------------------------------------
  // Everything the front desk does, in one tab: registering a patient, booking
  // an appointment or a bed, scheduling an operation and taking the money for
  // any of it. Previously these were five separate tabs a supervisor had to
  // hunt across to configure one role.
  'Patient Management': 'Reception',
  Appointments: 'Reception',
  'Room Management': 'Reception',
  'Surgery Management': 'Reception',

  // --- Radiology ---------------------------------------------------------
  // Ultrasound and X-Ray are the two halves of one department, and a
  // supervisor configuring a radiographer had to cross two tabs to do it.
  // They keep their own panels inside the tab.
  Ultrasound: 'Radiology',
  ECG: 'Radiology',

  // --- Finance -----------------------------------------------------------
  // Taking and reversing money is finance work wherever the charge came from,
  // so the twelve collection rights sit with the money, not with the desk that
  // happens to raise the document.
  'Cash Collection': 'Finance',

  // --- Pharmacy ----------------------------------------------------------
  'Pharmacy Finance': 'Pharmacy',

  // --- Prescriptions -----------------------------------------------------
  Prescription: 'Prescriptions',

  // --- Settings ----------------------------------------------------------
  // Administration rather than clinical work: who exists, what they may see,
  // and how the system is configured.
  'User Management': 'Settings',
  RBAC: 'Settings',
  // Navigation deliberately keeps its own tab. It answers a different question
  // from the rest of Settings -- which menus a role can see at all -- and it is
  // the first place someone looks when a role cannot reach a screen.
  Hospitals: 'Settings',
  'Audit Log': 'Settings',
  Support: 'Settings',
};

/**
 * Permissions that are grouped by hand rather than by the shape of their name.
 *
 * Splitting on the leading verb put these in twelve separate one-checkbox
 * panels -- "Lab Payments / Manage" beside "Reverse Lab Payment / Reverse Lab
 * Payment (P..." -- which reads as twelve unrelated features instead of one
 * decision made six times. They are the same decision: for each revenue module,
 * may this role take money, and may it put money back.
 *
 * Labels are written as a pair per module so the two columns line up and the
 * asymmetry is obvious: a role with Collect but no Reverse is the normal case.
 */
const PERMISSION_PANEL: Record<string, { resource: string; label: string }> = {
  manage_appointment_payments:   { resource: 'payment_collection', label: 'Collect — OPD / Appointments' },
  manage_lab_payments:           { resource: 'payment_collection', label: 'Collect — Laboratory' },
  manage_ultrasound_payments:    { resource: 'payment_collection', label: 'Collect — Ultrasound' },
  manage_xray_payments:          { resource: 'payment_collection', label: 'Collect — X-Ray' },
  manage_surgery_payments:       { resource: 'payment_collection', label: 'Collect — Surgery' },
  manage_room_booking_payments:  { resource: 'payment_collection', label: 'Collect — Room Booking' },
  record_finance_payments:       { resource: 'payment_collection', label: 'Collect — Pharmacy' },

  reverse_appointment_payment:   { resource: 'payment_reversal', label: 'Reverse — OPD / Appointments' },
  reverse_lab_payment:           { resource: 'payment_reversal', label: 'Reverse — Laboratory' },
  reverse_ultrasound_payment:    { resource: 'payment_reversal', label: 'Reverse — Ultrasound' },
  reverse_xray_payment:          { resource: 'payment_reversal', label: 'Reverse — X-Ray' },
  reverse_surgery_payment:       { resource: 'payment_reversal', label: 'Reverse — Surgery' },
  reverse_room_booking_payment:  { resource: 'payment_reversal', label: 'Reverse — Room Booking' },
  reverse_finance_payment:       { resource: 'payment_reversal', label: 'Reverse — Pharmacy' },
  // Dental belongs with the other seven desks, not in two panels of its own.
  manage_dental_payments:        { resource: 'payment_collection', label: 'Collect — Dental' },
  reverse_dental_payment:        { resource: 'payment_reversal', label: 'Reverse — Dental' },
  manage_ecg_payments:           { resource: 'payment_collection', label: 'Collect — ECG' },
  reverse_ecg_payment:           { resource: 'payment_reversal', label: 'Reverse — ECG' },

  /*
   * Which pharmacy document types a collector may settle.
   *
   * These read as "view" rights but they are not: PharmacyFinanceController
   * requires the matching one before it will take money against that document
   * type. They used to sit in a "Finance (General)" panel on the Pharmacy tab,
   * which is a screen that no longer exists -- so they are filed with the
   * collection desk they actually gate.
   */
  view_finance_sales:            { resource: 'payment_documents', label: 'Sales Invoice' },
  view_finance_purchases:        { resource: 'payment_documents', label: 'Purchase Invoice' },
  view_finance_sales_returns:    { resource: 'payment_documents', label: 'Return In (Sales Return)' },
  view_finance_purchase_returns: { resource: 'payment_documents', label: 'Return Out (Purchase Return)' },
  edit_finance_payment_status:   { resource: 'payment_documents', label: 'Change Payment Status' },
  manage_finance:                { resource: 'payment_documents', label: 'Manage All (overrides the above)' },

  /*
   * Single rights folded into the record they belong to.
   *
   * Each of these was its own panel holding one checkbox, so "Print" appeared
   * as a feature in its own right beside the receipt it prints. Same decision,
   * same panel.
   */
  print_dental_receipt:          { resource: 'dental_receipts', label: 'Print' },
  print_ecg_receipt:             { resource: 'ecg_receipts', label: 'Print' },
  print_xray_receipt:            { resource: 'xray_receipts', label: 'Print' },
  print_ultrasound_receipt:      { resource: 'ultrasound_receipts', label: 'Print' },
  submit_ultrasound_result:      { resource: 'ultrasound_exams', label: 'Submit Result' },
  add_ultrasound_receipt:        { resource: 'ultrasound_receipts', label: 'Add' },
  edit_ultrasound_receipt:       { resource: 'ultrasound_receipts', label: 'Edit' },
  delete_ultrasound_exams:       { resource: 'ultrasound_exams', label: 'Delete' },
  delete_ultrasound_receipt:     { resource: 'ultrasound_receipts', label: 'Delete' },
  set_ultrasound_fee:            { resource: 'ultrasound_receipts', label: 'Set Fee' },

  /*
   * Setting the price and taking the money at the desk itself.
   *
   * Take/Return Payment here are the desk's own buttons. They are separate
   * from Accounts > Payment Collection (the Collect/Reverse rows on the
   * Accounts tab) and from managing the desk's records -- holding Manage no
   * longer implies collecting.
   */
  take_ultrasound_payment:       { resource: 'ultrasound_receipts', label: 'Take Payment' },
  return_ultrasound_payment:     { resource: 'ultrasound_receipts', label: 'Return Payment' },
  set_xray_fee:                  { resource: 'xray_receipts', label: 'Set Fee' },
  take_xray_payment:             { resource: 'xray_receipts', label: 'Take Payment' },
  return_xray_payment:           { resource: 'xray_receipts', label: 'Return Payment' },
  set_ecg_fee:                   { resource: 'ecg_receipts', label: 'Set Fee' },
  take_ecg_payment:              { resource: 'ecg_receipts', label: 'Take Payment' },
  return_ecg_payment:            { resource: 'ecg_receipts', label: 'Return Payment' },
  set_dental_fee:                { resource: 'dental_receipts', label: 'Set Fee' },
  take_dental_payment:           { resource: 'dental_receipts', label: 'Take Payment' },
  return_dental_payment:         { resource: 'dental_receipts', label: 'Return Payment' },
  complete_unpaid_ultrasound:    { resource: 'ultrasound_exams', label: 'Complete While Unpaid' },
  create_prescription:           { resource: 'prescriptions', label: 'Create' },
  print_prescription:            { resource: 'prescriptions', label: 'Print' },

  // The expense/income date right reads as a field on the register, not as a
  // module of its own.
  edit_expense_date:             { resource: 'expenses', label: 'Edit Date' },
  edit_other_income_date:        { resource: 'other_incomes', label: 'Edit Date' },

  // Discounting a receipt is one capability, applied in several places.
  add_discounts:                 { resource: 'receipt_discounts', label: 'Apply' },
  edit_discounts:                { resource: 'receipt_discounts', label: 'Change' },
  manage_discounts:              { resource: 'receipt_discounts', label: 'Manage All' },

  /*
   * Laboratory's loose rights, gathered onto the order they act on.
   *
   * Ten one-checkbox panels made the Laboratory tab read as ten features; they
   * are all decisions about a lab order.
   */
  // Lab Results tab: the laboratory's own work on an order.
  enter_lab_results:             { resource: 'lab_results', label: 'Enter Results' },
  override_lab_result_lock:      { resource: 'lab_results', label: 'Correct Closed Result' },
  update_lab_order_status:       { resource: 'lab_results', label: 'Update Status' },
  reverse_lab_order_status:      { resource: 'lab_results', label: 'Reverse Status' },
  print_lab_results:             { resource: 'lab_results', label: 'Print Result' },
  download_lab_results:          { resource: 'lab_results', label: 'Download Result (PDF)' },
  // Lab Orders tab: the counter's side -- the order, its money and its paper.
  cancel_paid_lab_order:         { resource: 'lab_orders', label: 'Cancel Paid Order' },
  view_unpaid_lab_orders:        { resource: 'lab_orders', label: 'View Unpaid Receipts' },
  print_unpaid_lab_receipt:      { resource: 'lab_orders', label: 'Print Unpaid Receipt' },
  lab_test_order_discount:       { resource: 'lab_orders', label: 'Apply Discount' },
  take_lab_payment:              { resource: 'lab_orders', label: 'Take Payment' },
  return_lab_payment:            { resource: 'lab_orders', label: 'Return Payment' },

  // Surgery's two loose fee rights belong to the patient surgery record.
  edit_surgery_cost:             { resource: 'patient_surgeries', label: 'Edit Cost' },
  edit_surgery_payment_status:   { resource: 'patient_surgeries', label: 'Change Payment Status' },

  /*
   * Navigation: one panel listing the menus, rather than six panels of one.
   *
   * Ticking one of these makes that top-level menu visible in the sidebar --
   * the group itself is still hidden unless the user also holds a right for
   * something inside it, which is what stops an empty menu appearing.
   */
  view_dashboard:                { resource: 'menus', label: 'Dashboard' },
  view_reception_menu:           { resource: 'menus', label: 'Reception' },
  view_laboratory_menu:          { resource: 'menus', label: 'Laboratory' },
  view_radiology_menu:           { resource: 'menus', label: 'Radiology' },
  view_pharmacy_menu:            { resource: 'menus', label: 'Pharmacy' },
  view_prescriptions_menu:       { resource: 'menus', label: 'Prescriptions' },
  view_dental_menu:              { resource: 'menus', label: 'Dental' },
  view_reports_menu:             { resource: 'menus', label: 'Reports' },
  view_accounts_menu:            { resource: 'menus', label: 'Accounts' },
  view_hr_menu:                  { resource: 'menus', label: 'HR' },
  view_hospitals_menu:           { resource: 'menus', label: 'Hospitals' },

  // The last few loose rights, each folded onto the record it acts on.
  override_appointment_fee:      { resource: 'appointments', label: 'Override Fee' },
  update_appointment_status:     { resource: 'appointments', label: 'Update Status' },
  manage_medicine_barcodes:      { resource: 'medicines', label: 'Manage Barcodes' },
  pharmacy_walk_in_sales:        { resource: 'transactions', label: 'Sell to Walk-in' },

  // Four settings pages, one panel: they are the same decision -- may this role
  // change how the system is configured -- asked about four screens.
  backdate_receipts:             { resource: 'hospital_settings', label: 'Change Receipt Date' },
  manage_default_discounts:      { resource: 'hospital_settings', label: 'Default Discounts' },
  manage_pharmacy_settings:      { resource: 'hospital_settings', label: 'Pharmacy Settings' },
  manage_print_settings:         { resource: 'hospital_settings', label: 'Print Settings' },

  /*
   * Reports, grouped the way the sidebar is.
   *
   * Splitting on the name alone gave eleven panels holding one "View" checkbox
   * each -- "Reports Pharmacy Expiry / View" beside "Reports Pharmacy Low Stock
   * / View" -- which reads as eleven unrelated features rather than one
   * question asked per desk. Two panels instead: which desks a role may open,
   * and which of the pharmacy reports within that desk.
   *
   * The labels drop the "Reports" prefix because the panel title already says
   * it; repeating it made every row start with the same word.
   */
  view_reports_general:      { resource: 'report_desks', label: 'General' },
  view_reports_reception:    { resource: 'report_desks', label: 'Reception' },
  view_reports_laboratory:   { resource: 'report_desks', label: 'Laboratory' },
  view_reports_surgery:      { resource: 'report_desks', label: 'Surgery' },
  view_reports_room_booking: { resource: 'report_desks', label: 'Room Booking' },
  view_reports_xray:         { resource: 'report_desks', label: 'X-Ray' },
  view_reports_ultrasound:   { resource: 'report_desks', label: 'Ultrasound' },
  view_reports_ecg:          { resource: 'report_desks', label: 'ECG' },
  view_reports_patient_history: { resource: 'report_desks', label: 'Patient History' },
  view_reports_expenses:     { resource: 'report_desks', label: 'Expenses' },
  view_reports_other_income: { resource: 'report_desks', label: 'Other Income' },

  // The pharmacy desk's own tabs, one right each. The desk-wide "all tabs"
  // right was retired with the broad report rights: the panel's own checkbox
  // already selects all six.
  view_reports_pharmacy_stock:      { resource: 'report_pharmacy', label: 'Available Stock' },
  view_reports_pharmacy_purchase:   { resource: 'report_pharmacy', label: 'Purchase' },
  view_reports_pharmacy_sales:      { resource: 'report_pharmacy', label: 'Sales' },
  view_reports_pharmacy_expiry:     { resource: 'report_pharmacy', label: 'Short Expiry' },
  view_reports_pharmacy_low_stock:  { resource: 'report_pharmacy', label: 'Low Stock' },
  view_reports_pharmacy_profit:     { resource: 'report_pharmacy', label: 'Profit' },
};

/**
 * Friendly panel titles. Anything not listed falls back to a title-cased
 * version of the resource key, so new permissions group sensibly on their own.
 */
const RESOURCE_LABELS: Record<string, string> = {
  dashboard_amounts: 'Dashboard — Amounts (Fees & Totals)',
  dashboard_counts: 'Dashboard — Counts',
  dashboard_charts: 'Dashboard — Charts',
  dashboard_lists: 'Dashboard — Recent Lists',
  payment_collection: 'Payment Collection — Take Money',
  payment_reversal: 'Payment Collection — Put Money Back',
  payment_documents: 'Payment Collection — Pharmacy Documents',
  receipt_discounts: 'Discounts on Receipts',
  menus: 'Menus Visible in the Sidebar',
  manufacturers: 'Manufacturers',
  medicine_types: 'Medicine Types',
  medicines: 'Medicines',
  suppliers: 'Suppliers',
  transactions: 'Invoices',
  stocks: 'Stocks',
  stock_reconciliation: 'Stock Reconciliation',
  finance_sales: 'Sales Invoice',
  finance_sales_returns: 'Sales Return',
  finance_purchases: 'Purchase Invoice',
  finance_purchase_returns: 'Purchase Return',
  finance_payments: 'Payments',
  finance_payment_status: 'Payment Status',
  finance: 'Finance (General)',
  lab_orders: 'Lab Orders',
  lab_results: 'Lab Results',
  lab_payments: 'Lab Payments',
  // Named after the tab it configures.
  test_templates: 'Test Management',
  ultrasound_exams: 'Ultrasound Exams',
  // Reception's side of ultrasound, split from the radiologist's exam rights
  // so the two jobs are configured in two places, as on the X-Ray desk.
  ultrasound_receipts: 'Ultrasound Receipts',
  ultrasound_receipt: 'Ultrasound Receipt',
  ultrasound_result: 'Ultrasound Result',
  ultrasound_types: 'Ultrasound Templates',
  xray_receipts: 'X-Ray Receipts',
  xray_receipt: 'X-Ray Receipt',
  dental_receipts: 'Dental Receipts',
  dental_services: 'Dental Services',
  ecg_receipts: 'ECG Receipts',
  ecg_services: 'ECG Studies',
  audit_logs: 'Audit Log',
  prescriptions: 'Prescriptions',
  prescription: 'Prescriptions',
  prescription_diagnoses: 'Diagnoses',
  treatment_sets: 'Treatment Sets',
  appointments: 'Appointments',
  appointment_status: 'Appointment Status',
  appointment_payments: 'Appointment Payments',
  patients: 'Patients',
  doctors: 'Doctors',
  users: 'Users',
  roles: 'Roles',
  permissions: 'Permissions',
  hospitals: 'Hospitals',
  hospital_settings: 'Hospital Settings',
  rooms: 'Rooms',
  room_bookings: 'Room Bookings',
  surgeries: 'Surgeries',
  surgery_types: 'Surgery Types',
  patient_surgeries: 'Patient Surgeries',
  discharge_summaries: 'Discharge Summaries',
  expenses: 'Expenses',
  expense_categories: 'Expense Categories',
  other_incomes: 'Other Incomes',
  other_income_categories: 'Other Income Categories',
  discounts: 'Discounts',
  ledger: 'Ledger',
  report_desks: 'Reports — Which Desks',
  report_pharmacy: 'Reports — Pharmacy Tabs',
  backups: 'Backups',
  contact_messages: 'Contact Messages',
  departments: 'Departments',
  designations: 'Designations',
  shifts: 'Shifts',
  employees: 'Employees',
  employee_attendances: 'Attendance',
  leave_requests: 'Leave Requests',
  salary_structures: 'Salary Structures',
  payroll_batches: 'Payroll Batches',
  payroll_items: 'Payroll Items',
  payroll: 'Payroll',
  payslips: 'Payslips',
};

const titleCase = (key: string) =>
  key.split('_').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * Which panel a dashboard permission belongs in.
 *
 * Every one of these is named `view_dashboard_<something>`, so the generic
 * splitter gave each its own resource -- and the Dashboard tab became thirty
 * panels holding one checkbox apiece. They divide naturally into what the
 * panel actually shows, and the suffix already says which: `count_` cards,
 * `chart_` charts, `recent_` lists, everything else a money figure.
 *
 * Derived rather than listed, so a dashboard permission added later files
 * itself without anyone remembering to update a map here.
 */
function dashboardResource(name: string): string | null {
  if (!name.startsWith('view_dashboard_')) return null;

  const suffix = name.slice('view_dashboard_'.length);
  if (!suffix) return null;                       // plain `view_dashboard`
  if (suffix.startsWith('count_')) return 'dashboard_counts';
  if (suffix.startsWith('chart_')) return 'dashboard_charts';
  if (suffix.startsWith('recent_')) return 'dashboard_lists';
  return 'dashboard_amounts';
}

/** Split `add_medicine_types` into its action and resource parts. */
function splitPermission(name: string): { action: string; resource: string } {
  for (const action of ACTIONS) {
    if (name === action) {
      return { action, resource: 'general' };
    }
    if (name.startsWith(`${action}_`)) {
      return { action, resource: name.slice(action.length + 1) };
    }
  }
  return { action: '', resource: name };
}

/** Short label for a checkbox once its panel already names the resource. */
function actionLabel(perm: PermissionOption, action: string): string {
  const override = PERMISSION_PANEL[perm.name];
  if (override) {
    return override.label;
  }
  if (action) {
    return titleCase(action);
  }

  const label = perm.displayName || titleCase(perm.name);

  // Inside a panel already titled "Dashboard — Amounts", a checkbox reading
  // "View Dashboard Appointment Fees" repeats two of its three words. The
  // stored display name is left alone; only what is shown here is trimmed.
  if (dashboardResource(perm.name)) {
    return label.replace(/^View Dashboard (Total - )?/i, '').trim() || label;
  }

  return label;
}

export function PermissionSelector({
  permissions,
  selected,
  onToggle,
  onSetMany,
  disabled = false,
}: PermissionSelectorProps) {
  const [activeTab, setActiveTab] = useState<string>('');
  const [search, setSearch] = useState('');

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  /** category -> resource -> permissions, with the search filter applied. */
  const tree = useMemo(() => {
    const term = search.trim().toLowerCase();
    const out: Record<string, Record<string, Array<PermissionOption & { action: string }>>> = {};

    for (const perm of permissions) {
      const haystack = `${perm.name} ${perm.displayName ?? ''}`.toLowerCase();
      if (term && !haystack.includes(term)) continue;

      const rawCategory = perm.category || 'General';
      const category = CATEGORY_TO_TAB[rawCategory] ?? rawCategory;
      const override = PERMISSION_PANEL[perm.name];
      const dashboardPanel = override ? null : dashboardResource(perm.name);
      const { action, resource } = override
        ? { action: '', resource: override.resource }
        : dashboardPanel
          ? { action: '', resource: dashboardPanel }
          : splitPermission(perm.name);

      out[category] = out[category] || {};
      out[category][resource] = out[category][resource] || [];
      out[category][resource].push({ ...perm, action });
    }

    return out;
  }, [permissions, search]);

  const categories = useMemo(() => Object.keys(tree).sort((a, b) => a.localeCompare(b)), [tree]);

  // Keep a valid tab selected as the filter narrows the tree.
  const currentTab = categories.includes(activeTab) ? activeTab : categories[0] ?? '';

  const countFor = (perms: PermissionOption[]) =>
    perms.reduce((n, p) => n + (selectedSet.has(p.id) ? 1 : 0), 0);

  const categoryPerms = (category: string) =>
    Object.values(tree[category] ?? {}).flat();

  const activePanels = useMemo(() => {
    const panels = tree[currentTab] ?? {};
    return Object.entries(panels).sort(([a], [b]) =>
      (RESOURCE_LABELS[a] ?? titleCase(a)).localeCompare(RESOURCE_LABELS[b] ?? titleCase(b))
    );
  }, [tree, currentTab]);

  if (permissions.length === 0) {
    return (
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center text-xs text-gray-500">
        No permissions available.
      </div>
    );
  }

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden flex flex-col">
      {/* Search + global actions */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permissions..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {selected.length} selected
        </span>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onSetMany(permissions.map((p) => p.id), false)}
          className="text-[11px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50"
        >
          Clear all
        </button>
      </div>

      {/* Module tabs */}
      <div className="flex gap-1 px-2 pt-2 overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {categories.map((category) => {
          const perms = categoryPerms(category);
          const count = countFor(perms);
          const isActive = category === currentTab;

          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveTab(category)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {category}
              <span
                className={`ms-1.5 text-[10px] px-1.5 py-0.5 rounded ${
                  count > 0
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {count}/{perms.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active module: one panel per resource */}
      <div className="p-3 max-h-[46vh] overflow-y-auto bg-gray-50/60 dark:bg-gray-900/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            {currentTab}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSetMany(categoryPerms(currentTab).map((p) => p.id), true)}
              className="text-[10px] px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Select all in module
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSetMany(categoryPerms(currentTab).map((p) => p.id), false)}
              className="text-[10px] px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Clear module
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {activePanels.map(([resource, perms]) => {
            const label = RESOURCE_LABELS[resource] ?? titleCase(resource);
            const count = countFor(perms);
            const allSelected = count === perms.length && count > 0;

            // Money rights are tinted apart from the rest. Granting Collect or
            // Reverse is a different kind of decision from granting Print, and
            // the panel should not look like every other panel on the page.
            const isMoney = resource === 'payment_collection' || resource === 'payment_reversal';

            return (
              <div
                key={resource}
                className={`rounded-md border ${
                  isMoney
                    ? 'bg-amber-50/70 dark:bg-amber-900/10 ring-1 ring-amber-200 dark:ring-amber-800/60'
                    : 'bg-white dark:bg-gray-800'
                } ${
                  count > 0
                    ? 'border-blue-300 dark:border-blue-700'
                    : isMoney
                      ? 'border-amber-300 dark:border-amber-800'
                      : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 truncate" title={label}>
                    {label}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSetMany(perms.map((p) => p.id), !allSelected)}
                    title={allSelected ? `Clear ${label}` : `Select all ${label}`}
                    className="shrink-0 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                  >
                    {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="p-2 grid grid-cols-2 gap-1">
                  {perms
                    .slice()
                    .sort((a, b) => actionLabel(a, a.action).localeCompare(actionLabel(b, b.action)))
                    .map((perm) => (
                      <label
                        key={perm.id}
                        title={perm.displayName || perm.name}
                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] ${
                          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={selectedSet.has(perm.id)}
                          onChange={() => onToggle(perm.id)}
                          className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="truncate text-gray-700 dark:text-gray-300">
                          {actionLabel(perm, perm.action)}
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        {activePanels.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-6">No permissions match your search.</p>
        )}
      </div>
    </div>
  );
}
