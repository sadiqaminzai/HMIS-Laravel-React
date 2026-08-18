# Desktop Solution Analysis – HMIS ShifaaScript

## 1. Current Status

The `frontend-desktop/` directory is an **empty placeholder** (contains only `.gitkeep`).  
The README references `desktop/` as a future Electron-based app but no implementation exists yet.  
All functionality currently runs as a web application: a **Laravel 12 REST API** (backend) + a **React 18 SPA** (frontend-web).

---

## 2. Intended Architecture (as described in README)

```
HealthCareMIS/
├── backend/       Laravel 12 REST API (PHP)
├── web/           React 18 SPA (Vite build)
├── desktop/       Electron/Desktop App  ← not yet implemented
└── documents/     PDF docs & Schema
```

The planned desktop app would wrap the React SPA inside an **Electron shell** and communicate with the Laravel backend running locally on the same machine.

---

## 3. Bottlenecks in the Planned Desktop Solution

### 3.1 Backend Cannot Run Inside Electron Without Extra Work
Electron only bundles a Node.js + Chromium runtime.  
The Laravel backend is PHP-based and requires:
- A **PHP runtime** (php.exe on Windows, or a bundled PHP binary)
- A **web/app server** (PHP's built-in server, or a bundled nginx/Apache)
- A **database** (MySQL/MariaDB daemon, or SQLite file)

Bundling and managing all three processes on the user's machine is complex and fragile.  
Process start/stop, port conflicts, and startup order all need to be handled manually.

### 3.2 Hard-coded Production API URL
`frontend-web/.env.production` is committed to Git and contains:
```
VITE_API_BASE_URL=https://softcareitsolutions.com/HMIS/backend/public/api
VITE_PUBLIC_APP_URL=https://softcareitsolutions.com/HMIS
```
When `npm run build` is executed, Vite embeds this URL **directly into the compiled JavaScript bundle**.  
A desktop app using this build would always call the remote server instead of a local backend – defeating the purpose of a desktop/offline solution.

### 3.3 No Offline / Local-Data Capability
The entire frontend is designed around a REST API. There is:
- No Service Worker or PWA offline caching
- No IndexedDB or local SQLite data store
- No data-sync / conflict-resolution logic

If the backend is unreachable (network down, server restart), the app shows blank screens or API errors.

### 3.4 CORS Is Hard-coded to Specific Origins
`backend/config/cors.php` whitelists only:
```php
'allowed_origins' => [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://softcareitsolutions.com',
    'https://www.softcareitsolutions.com',
],
```
An Electron window serves requests from a `file://` origin (or a custom `app://` scheme).  
Unless `file://` or `app://` is added to this list, **every API call will be blocked by CORS**.

### 3.5 Source Code Is Exposed in the Electron Bundle
Electron packages application assets inside an **ASAR archive** (`app.asar`).  
ASAR is a simple concatenation format – any user can run:
```bash
npx asar extract app.asar extracted/
```
and read the full compiled JavaScript, including:
- API endpoint URLs
- Business logic
- Any secrets accidentally left in environment variables baked into the build

### 3.6 Large Installer Size
A typical Electron installer includes:
| Component | Approximate Size |
|-----------|-----------------|
| Chromium + Node.js runtime | ~120 MB |
| PHP runtime (bundled) | ~30–50 MB |
| React app bundle | ~5–15 MB |
| Database engine / SQLite | ~1–5 MB |
| **Total installer** | **~160–200 MB** |

This is significantly larger than a native desktop app and requires bandwidth to distribute updates.

### 3.7 No Auto-Update Mechanism
There is no `electron-updater` or update server configured.  
Users would need to manually download and reinstall every new version.

### 3.8 Demo Credentials Committed in Plain Text
The `notes` file and `backend/database/seeders/MultiRoleDemoSeeder.php` contain real account passwords (e.g., `admin123`, `doctor123`).  
When source code is bundled into a desktop installer, these credentials are shipped with every copy.

---

## 4. Online Dependency Analysis

| Component | Online Dependency? | Notes |
|-----------|-------------------|-------|
| React SPA (dev server) | **Yes** – npm install fetches packages from npmjs.com | Packages must be installed before going offline |
| React SPA (after build) | **No** – compiled JS/CSS is self-contained | Works offline once built |
| Laravel backend (install) | **Yes** – Composer fetches packages from packagist.org | Packages must be installed before going offline |
| Laravel backend (runtime) | **No** – runs on local PHP server | Works offline once installed |
| API calls from frontend | **Depends on config** – `.env.production` points to `softcareitsolutions.com` | Must be changed to `http://localhost` for offline/desktop use |
| Google Fonts / CDN assets | **None detected** – no external CDN links found in source | Safe |
| Authentication | **Local** – Laravel Sanctum tokens; no OAuth/SSO required | Safe |

**Key conclusion:** Once packages are installed and the build is compiled with a **local API URL**, the application itself has no mandatory internet dependency at runtime. However, the production build is currently wired to an external server.

---

## 5. Source Code Exposure in the Desktop

### What Is Exposed
| Asset | Exposure Level | Reason |
|-------|---------------|--------|
| Compiled React JS bundle | **High** – readable, partially reversible | Vite produces readable variable names unless a minifier + obfuscator is used |
| API base URL | **Exposed** – baked into bundle at build time | From `VITE_API_BASE_URL` in `.env.production` |
| Demo credentials (notes / seeders) | **Exposed** – shipped with source package | Included in Git history and installer |
| Laravel PHP source | **Medium** – requires separate bundle step | Not bundled by default; would need intentional inclusion |
| Database connection strings | **Low** – stored in `.env` (excluded from Git) | Safe if `.env` is not packaged |

### What Is NOT Exposed by Default
- The server-side `.env` file (excluded by `.gitignore`)
- Laravel's private encryption key (`APP_KEY` in `.env`)
- Database passwords (in `.env`)

---

## 6. Recommended Improvements

### 6.1 Architecture Alternatives to Reduce Complexity
- **Option A – PWA (Progressive Web App):** Convert the React SPA into a PWA using a Service Worker and IndexedDB cache. This adds offline capability without Electron overhead and avoids source-code packaging entirely.
- **Option B – Tauri (Rust shell):** Tauri produces smaller installers (~10–30 MB) than Electron and uses the OS's native WebView, eliminating the bundled Chromium. It also provides better security sandboxing.
- **Option C – Electron + bundled PHP:** If Electron is chosen, bundle a portable PHP binary (e.g., from [Windows PHP downloads](https://windows.php.net/downloads/releases/archives/)) and spawn the Laravel backend as a child process with an IPC health-check on startup.

### 6.2 Fix the API URL for Desktop / Local Use
Create a `.env.desktop` (or `.env.local`) with:
```
VITE_API_BASE_URL=http://localhost:8000/api
VITE_PUBLIC_APP_URL=http://localhost:8000
```
Build the desktop variant with `vite build --mode desktop`.  
This prevents the desktop app from calling the production server.

### 6.3 Fix CORS for Electron Origins
Add the Electron origin to `backend/config/cors.php` (or move the allowed origins to an environment variable):
```php
'allowed_origins' => [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8000',   // Local API-to-SPA
    env('CORS_ALLOWED_ORIGINS', ''),
],
```

### 6.4 Protect Source Code in the Electron Bundle
- Enable ASAR encryption using [Electron Forge](https://www.electronforge.io/) + `electron-packager` ASAR options.
- Use a JavaScript obfuscator (e.g., `javascript-obfuscator`) in the Vite build pipeline for the desktop variant.
- Move all sensitive strings (URLs, tokens) out of compiled code into a separate encrypted config file read at runtime.

### 6.5 Remove Committed Sensitive Data
| File | Issue | Fix |
|------|-------|-----|
| `notes` | Plaintext demo passwords committed to Git | Remove from repo; add to `.gitignore`; document credentials in a private channel |
| `frontend-web/.env.production` | Production URL committed to Git | Add `frontend-web/.env.production` to `.gitignore`; use CI/CD secrets injection |
| `backend/config/cors.php` | Production domain hardcoded | Replace with `env('CORS_ALLOWED_ORIGINS')` |

### 6.6 Add Auto-Update Support
If Electron is used, integrate `electron-updater` with a releases endpoint (GitHub Releases works) so the app can self-update without requiring users to manually reinstall.

### 6.7 Add a Desktop-Specific `.env` Mode to `.gitignore`
```
# in root .gitignore
frontend-web/.env.production
frontend-web/.env.local
frontend-web/.env.desktop
```
Only `.env.example` files (with placeholder values) should be committed.

### 6.8 SQLite for Portable Local Database
The backend's `database.php` already supports SQLite as a fallback:
```php
'default' => env('DB_CONNECTION', 'sqlite'),
'database' => env('DB_DATABASE', database_path('database.sqlite')),
```
For a desktop deployment, using SQLite eliminates the need to bundle or install a MySQL/MariaDB server, significantly simplifying setup.

### 6.9 Code-Splitting Is Already Partially Done (Keep It)
`frontend-web/vite.config.ts` already splits vendor chunks (`vendor-charts`, `vendor-i18n`, `vendor-icons`, `vendor-http`, `vendor-export-pdf`, `vendor-export-xlsx`, `vendor-date`).  
This is good practice and should be preserved and extended when adding the desktop build configuration.

---

## 7. Summary Table

| # | Bottleneck / Issue | Severity | Improvement |
|---|-------------------|----------|-------------|
| 1 | Desktop folder is empty – no implementation | Critical | Implement Electron or Tauri wrapper, or use PWA |
| 2 | Production API URL baked into build | High | Use `.env.desktop` with `localhost` URL |
| 3 | No offline data capability | High | Add PWA Service Worker + IndexedDB cache, or SQLite sync |
| 4 | CORS rejects `file://` / Electron origin | High | Add Electron origin or env-based CORS config |
| 5 | Source code readable in ASAR bundle | Medium | ASAR encryption + JS obfuscation |
| 6 | Demo credentials committed to Git | High | Remove `notes` file; add `.env.production` to `.gitignore` |
| 7 | No auto-update mechanism | Medium | Add `electron-updater` + GitHub Releases endpoint |
| 8 | Large Electron installer (~160–200 MB) | Medium | Consider Tauri (~10–30 MB) or PWA |
| 9 | PHP runtime must be bundled or installed | High | Bundle portable PHP binary or switch to Node.js backend |
| 10 | SQLite already supported but not the default for desktop | Low | Set `DB_CONNECTION=sqlite` in desktop `.env` |
