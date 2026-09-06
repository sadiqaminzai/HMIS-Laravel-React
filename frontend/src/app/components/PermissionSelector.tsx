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
  test_templates: 'Test Templates',
  ultrasound_exams: 'Ultrasound Exams',
  ultrasound_receipt: 'Ultrasound Receipt',
  ultrasound_result: 'Ultrasound Result',
  ultrasound_types: 'Ultrasound Templates',
  xray_receipts: 'X-Ray Receipts',
  xray_receipt: 'X-Ray Receipt',
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
  reports: 'Reports',
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
