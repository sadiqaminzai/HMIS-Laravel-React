# ShifaaScript Desktop — Design Spec

**Date:** 2026-06-23
**Status:** Approved design → ready for implementation planning
**Author:** Brainstorming session (Claude Code)

---

## 1. Overview

Rebuild the existing **ShifaaScript HMIS** (currently a React/Vite web app in
`frontend-web/` backed by a Laravel/MySQL API) as a **native Windows desktop
application** that runs **completely offline** on a single clinic machine.

The desktop app is a fresh C#/WPF build — it does **not** wrap or reuse the
React code. It owns its own embedded database and has no dependency on the
Laravel server, MySQL, or any network connection.

### Goals
- Native Windows desktop app, completely offline, single machine.
- Feature parity with the web app's clinical/admin modules (see §5).
- Local embedded database; no server, no network.
- Remove all QR codes; printed documents carry a 1D barcode instead.
- Built **module by module**, each phase producing a runnable, verified app.

### Non-goals
- Multi-tenant / multi-hospital operation (collapsed to a single clinic — see §4).
- Online sync, cloud, or central reporting.
- The web landing page, contact form, and license-server features.
- macOS / Linux support (Windows-only).

---

## 2. Technology Stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime / UI | **WPF on .NET 8** | Mature Windows LOB framework |
| UI pattern | **MVVM** via CommunityToolkit.Mvvm | Source-generated commands/observables |
| Database | **SQL Server LocalDB** | Embedded, file-based, offline |
| Data access | **EF Core 8** (code-first) | Migrations + seeding |
| Charts | **LiveCharts2** | Dashboard statistics |
| Barcode | **ZXing.Net** | Code128 of MRN / report number |
| PDF export | **QuestPDF** | Reports / document export |
| Excel export | **ClosedXML** | Tabular report export |
| Password hashing | **BCrypt.Net-Next** | Local user auth |
| DI | **Microsoft.Extensions.DependencyInjection** | Wire VMs/services |
| Logging | **Serilog** (file sink) | Local logs |
| Tests | **xUnit** + **FluentAssertions** | Domain + data layer |

> LocalDB requires the SQL Server Express LocalDB runtime to be installed on
> the target machine. This is bundled/checked by the installer (Phase 7).

---

## 3. Solution Architecture

Layered single solution, built module by module.

```
C:\xampp\htdocs\HMIS\desktop\
  ShifaaScript.Desktop.sln
  src/
    ShifaaScript.Domain/      # Entities, enums, value objects, domain rules
    ShifaaScript.Data/        # DbContext, EF migrations, seeders, repositories
    ShifaaScript.App/         # WPF: Views, ViewModels, Services, Controls, App shell
  tests/
    ShifaaScript.Tests/       # xUnit: domain + data layer
```

- **Domain** — POCO entities and enums. No EF/WPF dependency.
- **Data** — `ShifaaScriptDbContext`, configurations, migrations, seed data,
  repository/query services. Depends on Domain.
- **App** — WPF UI. Views (XAML) + ViewModels (MVVM) + Services (auth, print,
  export, backup, settings, navigation). Depends on Domain + Data via DI.
- **Tests** — unit tests for domain logic and data/repository behaviour.

### Cross-cutting services (in App)
- `AuthService` — login, current-user/session, password hashing.
- `PermissionService` — evaluates the RBAC matrix for navigation + actions.
- `NavigationService` — view/viewmodel routing inside the shell.
- `PrintService` — `FixedDocument` + `PrintDialog`, barcode rendering.
- `ExportService` — PDF (QuestPDF) and Excel (ClosedXML).
- `BackupService` — backup/restore the LocalDB.
- `SettingsService` — clinic profile/branding/print headers/currency.

---

## 4. Data Model (single-clinic, offline)

Schema is ported from `frontend-web/DATABASE_SCHEMA.md` and the live React
modules, adapted for a single offline clinic:

- The multi-tenant **`hospitals`** table collapses into a single **Clinic
  Profile** row in settings. `hospital_id` foreign keys are dropped from all
  entities.
- All `softDeletes`/timestamps preserved as `IsDeleted`, `CreatedAt`,
  `UpdatedAt` columns.

### Core entities (EF Core, code-first)
- **Identity/RBAC:** `User`, `Role`, `Permission`, `RolePermission`.
- **People:** `Patient`, `Doctor` (DoctorProfile merged), `Appointment`.
- **Clinical:** `Prescription`, `PrescriptionItem`, `LabTest`, `TestTemplate`,
  `TestResult`, `TestResultDetail`.
- **Pharmacy/Inventory:** `Medicine`, `MedicineType`, `Manufacturer`,
  `Supplier`, `Stock`, `StockTransaction`.
- **Finance:** `ExpenseCategory`, `Expense`, plus transaction/receipt records.
- **System:** `ClinicProfile` (settings/branding), `AppSetting`, `AuditLog`.

Exact column lists are derived per-entity during each phase from
`DATABASE_SCHEMA.md` and the corresponding React component's fields.

### Seed data
- 6 roles + permission matrix (§6).
- Demo users from `notes` (super_admin/admin/doctor/receptionist/pharmacist/
  lab_technician), BCrypt-hashed.

---

## 5. Module Inventory (web routes → desktop modules)

Mapped from the 28 routes in `frontend-web/src/app/App.tsx`:

| Group | Desktop modules |
|---|---|
| **Auth & shell** | Offline Login, main window (sidebar + header), role-gated navigation |
| **Dashboard** | Stat cards + charts |
| **Front desk** | Patients, Doctors, Appointments |
| **Clinical** | Prescriptions (list / create / next-visits / print), Lab Tests, Test Management, Lab Results, Lab Report print |
| **Pharmacy/Inventory** | Medicines, Medicine Types, Manufacturers, Suppliers, Stock, Transactions |
| **Finance** | Expense Categories, Expense Entries, Expense Report |
| **Reports** | Cross-module reporting + PDF/Excel export |
| **Settings** | General/Clinic Profile, Users, Roles, Permissions, Backups |

**Dropped/collapsed:** Hospital Management → single Clinic Profile; Contact
Messages → removed (web landing-page feature).

---

## 6. Cross-cutting Concerns

### Authentication & RBAC
- Local `users` table; BCrypt password verification at login.
- Roles: `super_admin`, `admin`, `doctor`, `receptionist`, `pharmacist`,
  `lab_technician`.
- Permission matrix ported from `frontend-web/PERMISSIONS_MATRIX.md`, enforced
  in navigation visibility and command `CanExecute`.

### QR removal / barcodes
- No QR generation anywhere (web used `qrcode`, `qrcode.react`).
- Printed **patient card**, **prescription**, and **lab report** show a
  **Code128 barcode** encoding the MRN / report number (ZXing.Net), plus the
  human-readable number beneath it.

### Printing & export
- Printing: WPF `FixedDocument` + `PrintDialog` with clinic header/branding.
- Export: QuestPDF (PDF) and ClosedXML (Excel) from Reports and list screens.

### Backup / restore
- `BackupService` backs up and restores the LocalDB file/`.bak`. Surfaced in
  Settings → Backups. Core to the offline model.

### Settings / branding
- `ClinicProfile`: name, logo, address, currency, print header/footer. Applied
  to all printed documents.

### Validation, errors, logging
- Input validation in ViewModels (data annotations + rules).
- Central error handling with user-facing dialogs; Serilog to local log files.

---

## 7. Testing Strategy

- **Domain:** unit-test business rules (e.g. age calc, queue numbering,
  stock decrement, permission evaluation).
- **Data:** EF Core against SQLite in-memory / LocalDB test instance for
  repository/query behaviour and migration sanity.
- **Smoke per phase:** the app builds, launches, logs in, and the phase's
  screens perform CRUD against LocalDB before the phase is considered done.

---

## 8. Phased Build Plan ("one by one")

Each phase has its own implementation plan and ends with a runnable, verified app.

0. **Foundation** — solution + 3 projects + tests; EF Core + LocalDB; full
   schema migration; seed roles/users; app shell, login, role-gated navigation.
1. **Patients** — full CRUD + patient card print (barcode). Proves the vertical slice.
2. **Doctors + Appointments** — CRUD, scheduling, queue numbers.
3. **Prescriptions** — create / list / next-visits / print.
4. **Lab** — tests, test templates, result entry, lab report print.
5. **Pharmacy/Inventory** — medicines, types, manufacturers, suppliers, stock, transactions.
6. **Finance + Reports** — expenses (categories/entries/report) + cross-module reports & export.
7. **Settings & polish** — users, roles, permissions, clinic profile, backups; dashboard; installer (incl. LocalDB runtime check).

---

## 9. Risks / Open Items
- **LocalDB dependency:** target machine needs the LocalDB runtime; the Phase 7
  installer must detect/install it. (Alternative if this proves painful: switch
  to SQLite — revisit only if LocalDB blocks.)
- **Schema fidelity:** some web fields are stored as JSON (e.g.
  `medical_history`, `availability_schedule`); decide per-entity whether to keep
  JSON columns or normalize during each phase.
- **Print layout parity:** matching the web print templates exactly is iterative;
  treat per-document layout as part of each phase.

---

## 10. Decisions Log
- Build approach: **C# / WPF native rebuild** (not React reuse).
- Operation: **completely offline, single machine**.
- Database: **SQL Server LocalDB + EF Core**.
- QR codes: **removed**, replaced by **Code128 barcode** on printed docs.
- Scope: **single clinic** (multi-hospital collapsed to Clinic Profile; Contact
  Messages dropped).
- Location: new **`C:\xampp\htdocs\HMIS\desktop\`** folder.
