# ShifaaScript - Hospital Management System (Frontend)

This is the React Frontend for the ShifaaScript Multi-vendor Hospital System.

## 📂 Documentation
- **Database Schema:** Please refer to `DATABASE_SCHEMA.md` in the root directory for the complete Laravel 12 / MySQL schema.
- **Implementation Guide:** See `IMPLEMENTATION_GUIDE.md` for project details.

## 🚀 Setup & Installation (Local PC)

If you have downloaded this code and are trying to run it locally in your `HealthCareMIS/web` folder, follow these steps to fix the installation errors.

### 1. Fix Dependencies
The `package.json` file might have `react` listed under `peerDependencies`. You need to ensure they are in `dependencies`.

**Open `package.json` and locate this section:**
```json
"peerDependencies": {
  "react": "18.3.1",
  "react-dom": "18.3.1"
}
```

**Move them to the `dependencies` section so it looks like this:**
```json
"dependencies": {
  ... other packages ...
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "sonner": "2.0.3",
  ...
}
```
*Note: You can remove the `peerDependencies` section after moving them.*

### 2. Install Packages
Open your terminal (Command Prompt or PowerShell), navigate to your web folder, and run:

```bash
cd HealthCareMIS/web
npm install
```

**If you still see errors:**
Try running with the legacy peer deps flag:
```bash
npm install --legacy-peer-deps
```

### 3. Run the Application
Start the development server:

```bash
npm run dev
```
Access the app at `http://localhost:5173`.

## 📂 Project Structure (Recommended)

Since you are using XAMPP, your structure is good:

```
HealthCareMIS/
├── backend/       (Laravel 12 Project)
├── web/           (This React Project)
├── desktop/       (Electron/Desktop App)
└── documents/     (Store PDF docs & Schema here)
```

## 🛠 Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS v4, Shadcn UI
- **Build Tool:** Vite
- **Icons:** Lucide React
