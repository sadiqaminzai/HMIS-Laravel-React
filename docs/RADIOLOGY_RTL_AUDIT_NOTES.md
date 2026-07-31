# Radiology, RTL, Prescription UI & Audit Log — Implementation Notes

Branch: `feature/radiology-rtl-audit` (off `main`)

---

## 1. Radiology module with Ultrasound sub-module

### Database

| Migration | Table | Purpose |
|---|---|---|
| `2026_07_31_000100_create_ultrasound_types_table` | `ultrasound_types` | Ultrasound study types, each owning a `default_template` (HTML) |
| `2026_07_31_000200_create_ultrasound_exams_table` | `ultrasound_exams` | Per-patient exams with the edited `report_body` saved against the patient |

Both tables are hospital-scoped (`hospital_id` FK, cascade), soft-deleting, and
`ultrasound_exams` carries a per-tenant `sequence_id` unique on
`(hospital_id, sequence_id)` — the same numbering scheme as Other Incomes.

### Models
- `App\Models\UltrasoundType` — `exams()` hasMany.
- `App\Models\UltrasoundExam` — `patient()`, `doctor()`, `ultrasoundType()`.

### Controllers & routes
- `UltrasoundTypeController` — CRUD. Refuses to delete a type that has exams
  (suggests deactivating instead), so historical reports keep their study name.
- `UltrasoundExamController` — CRUD plus `GET /ultrasound-exams/{id}/report`.
  Falls back to the type's template when `report_body` is submitted empty.

Routes follow the existing split read/write + `permission:` middleware style:

```
GET|POST|PUT|DELETE  api/ultrasound-types[/{id}]
GET|POST|PUT|DELETE  api/ultrasound-exams[/{id}]
GET                  api/ultrasound-exams/{id}/report
```

### Templates
`UltrasoundTypeSeeder` seeds 11 types per hospital — Abdomen, Pelvis,
Obstetrics, Gynecology, Kidney, Liver, Thyroid, Breast, Doppler, Soft Tissue,
Other — each with a section-based HTML template, e.g. Abdomen:

```
Liver:  Gall Bladder:  CBD:  Pancreas:  Spleen:  Kidneys:  Urinary Bladder:  Impression:
```

The system is configurable: templates are ordinary rows, editable in the UI
under **Radiology → Ultrasound → Report Templates**, and new types can be added
at any time.

### Frontend
- `src/app/api/ultrasound.ts` — typed client.
- `src/app/components/UltrasoundManagement.tsx` — two tabs (Exams / Report
  Templates). Selecting a type loads its template into a `react-quill-new`
  editor; on an exam that already has content the user is asked before the
  template overwrites it. Patient picker has a filter box; doctor, exam
  date-time, referred-by, fee, status, clinical notes and impression included.
- `src/app/components/UltrasoundReportPrint.tsx` — preview + print modal built
  on `react-to-print`, matching the prescription report header (hospital name,
  phone, email, logo, patient/exam info cards, findings, impression, signature).

Route: `/radiology/ultrasound`, gated by `RequirePermission`.

---

## 2. Multilingual layout & translations

### Direction switching
The old implementation had a dead `const [isRTL] = useState(false)` in
`App.tsx` that was never set, plus scattered `flex-row-reverse` overrides in
`Sidebar.tsx` — which is why the sidebar stayed on the left in Pashto.

Now a single effect in `AppContent` stamps the direction on the document:

```ts
document.documentElement.setAttribute('dir', isRtlLanguage(lang) ? 'rtl' : 'ltr');
document.documentElement.setAttribute('lang', lang);
```

`src/app/utils/direction.ts` owns the language list (`ps`, `fa`, `ar`, `ur`,
`he`, incl. region-tagged variants). Because `dir` drives flex/grid ordering
and logical properties natively, the sidebar moves right and content left with
no per-component branching. The manual reversals in `Sidebar.tsx` were removed
and replaced with Tailwind logical utilities (`ms-`, `ps-`, `border-s`,
`border-e`, `-end-3`, `text-start`) and `rtl:rotate-180` on directional chevrons.

`src/styles/rtl.css` covers what logical properties cannot: absolutely
positioned search icons, native select arrows, table alignment, Sonner toasts,
the Quill editor/toolbar, and forcing LTR on numeric/date inputs and monospace
fields so IDs and dates stay readable.

**Verified in-browser:** switching to `ps` sets `dir="rtl"`, and a flex probe
confirms the sidebar (first child) renders at the right edge with main content
on the left.

### Translations
- **"Other Incomes" fixed** — was the literal English `'Other Income'` in all
  three RTL blocks. Now `نور عایدات` (ps), `سایر عواید` (fa), `إيرادات أخرى` (ar).
- Audited every RTL block for the same bug class and found more keys that were
  **missing entirely** and silently falling back to English:
  `stockAdjustments` (ps); `suppliers`, `transactions`, `stocks`,
  `stockAdjustments` (fa, ar); `myProfile`, `accountSettings`, `changePassword`
  (all three). All filled in.
- New `nav.radiology`, `nav.ultrasound`, `nav.auditLog` plus full `ultrasound.*`
  and `auditLog.*` sections in English, Pashto, Dari and Arabic.
- Key parity across `nav`, `common`, `header`, `ultrasound`, `auditLog` is now
  100% for all four languages.

---

## 3. Prescription module UI

- Removed the **Create New** submenu; **View All** renamed to **Prescriptions**
  (`Sidebar.tsx`). The `/prescriptions/create` route is retained so existing
  links and bookmarks still resolve.
- Added a **+ Add Prescription** button to the top-right action group of the
  list page, shown only with create permission, navigating to the create form —
  the same pattern as every other module.
- Reduced header height: outer spacing `space-y-3 → space-y-2`, header gap
  `3 → 2`, title `text-lg → text-base`, and the subtitle now sits inline with
  the title instead of on its own line.

---

## 4. Audit Log

### Storage
`audit_logs` records user, role, module, action, record id + label, old/new
value snapshots (JSON), IP address, user agent, URL, method, description and
timestamp. `hospital_id` and `user_id` are nullable so failed logins are still
captured; both denormalised name and role are stored so the trail survives a
user rename or deletion.

### Automatic capture
- `App\Services\AuditLogger` — central writer. Best-effort by design: it never
  throws into the request that triggered it, and it redacts `password`,
  tokens and secrets before persisting.
- `App\Observers\AuditObserver` — generic create/update/delete/restore observer,
  attached from `AppServiceProvider` via an `AUDITED_MODELS` map (23 models).
  **No existing model was modified**; add a class to that map to start auditing it.
  - Touch-only saves and `last_login_at` bumps are filtered out as noise.
  - A password change on a `User` is emitted as its own `password_change` event
    rather than a generic update, with the value redacted.
- Login, logout and failed/blocked login are recorded in `AuthController`.
- Print and export happen in the browser, so `POST /audit-logs/events` accepts
  client-reported `print`/`export`/`view` events (validated against a whitelist).
  The ultrasound report print already reports itself.

### Access & UI
Read-only by design — there is no add/edit endpoint. Permissions:
`view_audit_logs`, `export_audit_logs`, `print_audit_logs`, `manage_audit_logs`.
The menu entry and the route are both hidden without `view_audit_logs`, and the
API returns 403 on direct access.

`AuditLogManagement.tsx` provides debounced search, module / action / user /
date-range filters, server-side pagination, a detail modal with full before/after
JSON, and Excel (`xlsx`) + PDF (`jspdf-autotable`) export of the filtered set.
Exporting is itself audited.

---

## 5. Applied to your database

These were run against the configured database:

- `php artisan migrate` — created the 3 new tables.
- `php artisan db:seed --class=RadiologyAuditPermissionsSeeder` — 20 new permissions.
- `php artisan db:seed --class=UltrasoundTypeSeeder` — 44 templates (11 × 4 hospitals).

`RolesPermissionsSeeder` was updated for fresh installs but **not executed** — it
truncates users, roles and permissions. `RadiologyAuditPermissionsSeeder` is the
additive equivalent, safe on an existing database.

Assign the new permissions to roles under **Settings → Roles**; only super admin
has them implicitly.

---

## Verification performed

- `php -l` clean on all new/changed PHP files.
- `php artisan route:list` — 11 ultrasound + 5 audit-log routes registered.
- `npm run build` — succeeds; `UltrasoundManagement`, `AuditLogManagement` and
  `auditLogs` chunks emitted.
- Ultrasound create → update → delete via tinker produced exactly 3 correct
  audit rows with accurate old/new value diffs.
- Password change produced a `password_change` entry with the value redacted.
- RTL confirmed live in the browser (`dir="rtl"`, sidebar right, content left).

Not verified: the authenticated UI end-to-end, which needs a login I can't perform.


---

# Follow-up round

## 6. Menu order
Radiology now sits directly after Laboratory as its own top-level module — the
two are related but remain separate main modules.

## 7. Doctors and prescriptions not showing

**Diagnosed, and they were two different things.**

- **Prescriptions:** not a bug. Demo Hospital genuinely has **0 prescriptions**
  in the database; all 3 existing prescriptions belong to Habib-Al-Shifa.
- **Doctors:** a real data fault. The app serves doctors from `users` where
  `role = 'doctor'` (appointments, prescriptions and lab orders were all
  re-pointed at `users` by the `*_doctor_fk_to_users` migrations), but there
  were **zero such users**. The 29 rows in the legacy `doctors` table were
  orphaned, and many were duplicates created by repeated profile syncs.

`php artisan doctors:backfill-users` fixes it. It collapses duplicate profiles
per hospital (name + registration number), creates one user each, links
`doctor_id`, and supports `--dry-run` and `--activate`. Accounts are created
**inactive with an unusable password** — activate and set passwords under
Settings → Users. Run against your database: 29 profiles → 8 doctors
(7 created, 1 linked, 21 duplicates collapsed).

Because the legacy data had two different doctors sharing one email address,
the command tracks addresses claimed during the run and falls back to a
`name.hN.dN@doctors.local` placeholder rather than violating the unique index.

### Bug this surfaced in the ultrasound module
The first cut of `ultrasound_exams.doctor_id` pointed at the `doctors` table,
which contradicts the convention above and would not have matched the user IDs
the frontend sends. Corrected: the FK now references `users`, the model relation
is `belongsTo(User::class)`, and validation checks for a `doctor` role user in
the same hospital.

## 8. Pharmacy Finance module

Operational and financial concerns are now separate:

- **Pharmacy → Invoices** (existing) creates documents from prescriptions.
- **Pharmacy Finance** (new top-level module) owns only the money.

`transactions` gained `payment_status` (pending/partial/paid), `payment_method`,
`payment_reference`, `payment_due_date`, `last_payment_at`, `finance_note` and
`settled_by`. Existing rows were backfilled from `due_amount` — all 7 resolved
to `paid`. `Transaction::syncPaymentState()` re-derives due amount and status so
the two can never disagree.

`PharmacyFinanceController` provides a filtered list, per-type summary totals,
payment recording (rejects overpayment and already-settled documents), manual
term overrides, and export. Every money movement writes an audit entry.

Access is **per document type**, so financial visibility can be split:

| Permission | Grants |
|---|---|
| `view_finance_sales` | Invoice figures |
| `view_finance_purchases` | Purchase figures |
| `view_finance_sales_returns` | Return In figures |
| `view_finance_purchase_returns` | Return Out figures |
| `record_finance_payments` | Record a payment |
| `edit_finance_payment_status` | Override status / due date |
| `export_finance`, `print_finance` | Export and print |
| `manage_finance` | Full access |

A cashier can therefore settle patient invoices without ever seeing supplier
purchase amounts. The UI shows only the tabs the user may see, with summary
cards (total / paid / due / outstanding), status and date filters, an
overdue-only toggle, pagination and Excel + PDF export.

## 9. Translations for high-traffic modules
Page titles, subtitles and every table header wired to i18n in Patients,
Doctors, Appointments, Lab Tests, Surgeries and Prescriptions, with new
`modules.*` and `table.*` key sets in all four languages. No untranslated
`<th>` remains in those files.

## Applied to your database (this round)
- `php artisan migrate` — payment fields on `transactions` (existing rows backfilled).
- `php artisan db:seed --class=PharmacyFinancePermissionsSeeder` — 10 permissions.
- `php artisan doctors:backfill-users` — 7 doctor accounts created, 1 linked.

Remaining manual step: activate the new doctor accounts and set their passwords,
then grant the new Radiology / Audit Log / Pharmacy Finance permissions to roles.


---

# Follow-up round 2

## 10. RTL was still broken — root cause found

My earlier "verified" claim was wrong. I had probed the flex behaviour by
mounting a test element on `document.body`, which sits *above* the offending
element, so the probe passed while the real app stayed LTR.

**Root cause:** `LandingLanguageProvider` wraps the entire application and
rendered `<div dir={isRTL ? 'rtl' : 'ltr'}>`. Its `isRTL` comes from its own
`landing-language` state (default `en`), completely separate from the app's
i18n language. That inner `dir="ltr"` overrode the `dir="rtl"` set on `<html>`
for every descendant — sidebar included.

**Fix:** the provider no longer forces a direction; it just supplies context.
The landing page, which has its own language switcher, now sets `dir` on its
own root element instead.

**Re-verified inside the real app tree** (probe mounted under `#root`):

| Direction | Sidebar X | Main X | Sidebar side |
|---|---|---|---|
| `ltr` (English) | 0 | 192 | LEFT |
| `rtl` (ps / fa / ar) | 608 | 0 | RIGHT |

Only `<html>` now carries a `dir` attribute; no descendant resets it.

## 11. Pharmacy Finance moved under Pharmacy
No longer a top-level module. It is now the last sub-item of the **Pharmacy**
group, labelled **Finance** (`nav.finance`: Finance / مالي چارې / مالی /
المالية). The route `/pharmacy-finance` is unchanged, and the Pharmacy group
now stays expanded when navigating to it.


---

# Follow-up round 3 — application-wide localization

## 12. Settings menu
The Settings submenu items (General, Backups, Contact Messages, Users, Roles,
Permissions) were hardcoded English `<span>` labels. All now use `nav.*` keys in
four languages. Audit Log already was.

## 13. Table headers — completed app-wide
The earlier pass only matched `<th>Text</th>`. Most headers are *sortable*, with
the label as a bare text line inside a flex div next to a sort icon, so they were
missed. A scan found **130 distinct header labels across 48 files**.

All are now translated via a shared `table.*` namespace (127 keys x 4 languages,
verified identical across all four). Remaining untranslated `<th>` in
non-print components: **0**.

## 14. Titles, tabs, buttons, form labels
A full extraction found **1,096 distinct hardcoded strings / 2,605 occurrences**.
Two passes were applied via a shared `ui.*` namespace (221 keys x 4 languages):

- **Pass 1** (918 strings): headings, labels, options, buttons, spans,
  paragraphs, `placeholder=` / `title=` attributes, and bare label lines.
- **Pass 2** (391 strings): object-literal tab labels (`label: 'Room Bookings'`),
  JSX `label="..."`, tuple tab arrays (`['types', 'Surgery Types', Icon]`),
  ternary modal titles (`{isAdd ? 'Add New Patient' : 'Edit Patient Details'}`),
  and labels carrying a required-asterisk span.

Occurrences reduced **2,605 -> 1,210 (54%)**. The remainder is a long tail of
module-specific one-off strings (931 distinct, mostly appearing once).

## Correctness safeguards used

Vite does not type-check, so a missing hook or a botched rewrite would only
surface as a runtime crash. Three checks were run after every pass:

1. **Print-literal guard** — `{t(...)}` inserted inside a backtick template
   literal would be emitted verbatim into printed HTML. Such insertions are
   detected and reverted to plain English; printed patient documents
   (prescriptions, lab reports, invoices, discharge summaries) are excluded
   from localization entirely.
2. **Hook ownership** — brace-matching every component to confirm each `t()`
   call sits in a scope that owns `const { t } = useTranslation()`. This caught
   **38 components** in the header pass and `ModalShell` in the UI pass that
   would otherwise have crashed.
3. **Module-scope guard** — `t()` at module scope would throw on import. Zero found.

Plus `npm run build` and a runtime harness importing all 58 lazy modules
(58/58 clean).

### One rollback
The first version of the UI pass used `str.replace()` on the whole regex match,
which also rewrote identical text inside attributes — turning
`className="..."` into `class{t('ui.name')}="..."` in 4 files. The build caught
it, the tree was restored from backup, and the script was rewritten to replace
by exact capture-group offsets. Re-verified: zero corrupted attributes.


---

# Data incident notes (2026-07-31)

## A. RBAC wipe — pre-existing, 2026-07-30 18:35

`RolesPermissionsSeeder` was run against the populated database the evening
before this work started. It truncated users, roles, permissions and all
role/permission assignments, re-seeded the permission catalogue and left only
the Super Admin. Hospitals and clinical data survived.

Evidence: `roles`, `model_has_roles`, `role_has_permissions`, `permission_role`
and `model_has_permissions` all exactly 0, while permissions/hospitals/doctors/
patients survived; super admin and every permission row stamped 2026-07-30 18:35.

**Restored** with `MultiRoleDemoSeeder` (non-destructive, updateOrCreate only):
5 roles with permission sets, plus admin / receptionist / pharmacist /
lab_technician users for Demo Hospital.

**Guardrail added.** `RolesPermissionsSeeder` now refuses to run when users or
roles exist. Interactive runs prompt; scripted runs are refused; `RBAC_RESET=1`
forces it. Verified: `php artisan db:seed` no longer wipes anything.

## B. Accidental full seed — caused while testing the guardrail

Running `php artisan db:seed` to prove the guard worked also executed the rest
of the seeder chain, which is idempotent but overwrites values:

| Effect | Resolution |
|---|---|
| Hospital 2 renamed "City Care Hospital", contact overwritten | restored to `Habib-Al-Shifa HealthCare Center`, phone `0777626845`, email `abdulwasi.adil@gmail.com`; address cleared (original unknown — re-enter) |
| 4 demo medicines injected into hospital 2 (ids 24–27) | deleted (had no stock or transaction references) |
| 4 demo transactions + 4 detail rows in hospital 1 (ids 8–11) | deleted |
| 2 patients / 7 medicines refreshed to seeder values | left as-is |

Logo, brand colour and licence on hospital 2 were not touched.

**Lesson:** never run a bare `db:seed` to test a single seeder — use
`--class=` and assert on table counts instead.

## C. Legacy doctor_id references — latent bug, now fixed

The `*_doctor_fk_to_users` migrations re-pointed `appointments`,
`prescriptions` and `lab_orders` at `users` but never remapped the stored
values, which remained legacy `doctors.id` numbers. They resolved to nothing
until user ids were recycled by the wipe — after which Habib-Al-Shifa records
resolved to **Dr. Lina Patel of Sunrise Community Hospital**, a different tenant.

`php artisan doctors:remap-clinical-ids` reads each value as a `doctors.id`,
resolves the matching user in the *same* hospital (by doctor_id link, then
email, then unambiguous name) and rewrites it. It refuses any remap that would
cross a hospital boundary and supports `--dry-run`.

Applied: 9 rows (3 appointments, 3 prescriptions, 3 lab orders) remapped from
the wrong-tenant user to Dr Momin (hospital 2). Cross-hospital mismatches
remaining: **0**.

## D. Answered: Demo Hospital appointments/prescriptions

Demo Hospital has **0 appointments and 0 prescriptions**, and never had any in
these tables — all existing records belong to Habib-Al-Shifa. One appointment
(id 4) was hard-deleted at some earlier point (AUTO_INCREMENT gap: next id 5,
max id 3); that predates this work.
