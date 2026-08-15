# License Management System - Testing Guide

## Quick Start Testing Guide

### Test Users:

1. **Super Admin** (Bypasses all license checks):
   - Email: `super@admin.com`
   - Password: `admin123`
   - Result: ✅ No warnings, no blocks

2. **Warning Test** (10 days until expiry):
   - Email: `admin@city.com`
   - Password: `admin123`
   - Result: ⚠️ Shows warning modal on every login

3. **Valid License** (Expires 2027):
   - Email: `admin@green.com`
   - Password: `admin123`
   - Result: ✅ No warnings, no blocks

4. **Expired License** (Expired 5 days ago):
   - Email: `expired@hospital.com`
   - Password: `expired123`
   - Result: 🚫 Shows full-page "License Expired" screen, blocks dashboard access

## Overview
The License Management System is a comprehensive feature that controls access to the ShifaaScript application based on hospital license expiry dates. This feature is specifically designed for multi-tenant SaaS architecture.

## Features

### 1. **License Expiry Warning (15 Days Before Expiry)**
- Shows a modal warning when license expires within 15 days
- **Appears EVERY TIME** the user logs in during the countdown period (days 15, 14, 13...3, 2, 1, 0)
- Shows exact days remaining and expiry date
- Provides contact information for renewal
- **Excluded for**: Super Admin role

### 2. **License Expired Block**
- Completely blocks access to dashboard when license expires
- Shows a dedicated "License Expired" page
- Provides contact information for renewal
- Forces logout option
- **Excluded for**: Super Admin role

### 3. **Hospital-Specific Logic**
- Each hospital has its own license tracking
- License status is checked independently per hospital
- Super Admin can access all hospitals regardless of license status

## How to Test

### Test Scenario 1: License Expiring Soon (Warning Modal)

**Hospital**: City General Hospital (ID: 1)
**Current Status**: License expires in 10 days (automatically set in mockData.ts)

**Test Steps**:
1. Login with any hospital user (NOT super admin):
   - Email: `admin@city.com` | Password: `admin123` (Admin Role)
   - Email: `ahmed@city.com` | Password: `doctor123` (Doctor Role)
   - Email: `sarah@city.com` | Password: `reception123` (Receptionist Role)

2. After login, you should immediately see:
   - **Orange Warning Modal** with:
     - "License Expiry Warning" title
     - Days remaining counter (10 days)
     - Exact expiry date
     - Contact information (phone numbers and emails)
     - "I Understand" button

3. Click "I Understand" to close the modal and access the dashboard

4. **The modal will appear again EVERY TIME the user logs in** during the countdown period (days 15, 14, 13...3, 2, 1, 0)

5. **To test**:
   - Logout and login again → Modal appears again immediately
   - This ensures users are constantly reminded about the approaching expiry

### Test Scenario 2: License Expired (Access Blocked)

**To test expired license**:

1. Update the license expiry date to a past date:
   - Open `/src/app/data/mockData.ts`
   - Change line 14 from:
     ```typescript
     licenseExpiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
     ```
   - To:
     ```typescript
     licenseExpiryDate: '2025-01-01', // Past date
     ```

2. Login with any hospital user (NOT super admin):
   - Email: `admin@city.com` | Password: `admin123`

3. After login, you should see:
   - **Full-page "License Expired" screen**
   - Red/Orange gradient design
   - Hospital name and expiry date
   - Contact information for renewal
   - "Logout" button (dashboard is completely inaccessible)

4. You cannot access the dashboard until license is renewed

### Test Scenario 3: Super Admin (No Restrictions)

**Super Admin**: Bypasses ALL license checks

**Test Steps**:
1. Login as Super Admin:
   - Email: `super@admin.com` | Password: `admin123`

2. You should:
   - See NO license warnings
   - Have full access to dashboard
   - Be able to switch between hospitals
   - No license restrictions apply

### Test Scenario 4: Valid License (No Warnings)

**Hospital**: Metro Care Clinic (ID: 2)
**Status**: License valid until 2027

**Test Steps**:
1. Login with Metro Care user:
   - Email: `admin@green.com` | Password: `admin123`

2. You should:
   - See NO warnings or blocks
   - Have normal access to dashboard
   - No license-related messages

### Test Scenario 5: Expired License (Access Blocked)

**Hospital**: Expired Hospital (ID: 3)
**Status**: License expired 5 days ago

**Test Steps**:
1. Login with Expired Hospital user:
   - Email: `expired@hospital.com` | Password: `expired123`

2. You should:
   - See **Full-page "License Expired" screen**
   - Red/Orange gradient design
   - Hospital name and expiry date
   - Contact information for renewal
   - "Logout" button (dashboard is completely inaccessible)

3. You cannot access the dashboard until license is renewed

## Technical Implementation

### Components Created:
1. **`LicenseExpiryWarning.tsx`** - Modal for 15-day warning
2. **`LicenseExpired.tsx`** - Full-page expired license screen

### Hook Created:
**`useLicenseCheck.ts`** - Custom React hook that:
- Calculates days remaining
- Determines if license is expired or expiring soon
- Updates hourly automatically
- Returns license status object

### Logic Flow:
```
User Login
    ↓
Check User Role
    ↓
Is Super Admin? → YES → Full Access (No Checks)
    ↓
   NO
    ↓
Get User's Hospital
    ↓
Check License Expiry Date
    ↓
Expired? → YES → Show "License Expired" Page
    ↓
   NO
    ↓
Expiring Soon (≤15 days)? → YES → Show Warning Modal (Every Login)
    ↓
   NO
    ↓
Normal Dashboard Access
```

### Alert Frequency:
- **Warning Modal**: Appears on EVERY login during the warning period (15 days before expiry)
- **No localStorage tracking**: Modal shows every time without daily restrictions
- **User must acknowledge**: Click "I Understand" to access dashboard each time

## Customization

### Change Warning Period:
Edit `/src/app/hooks/useLicenseCheck.ts` line 52:
```typescript
const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 15; // Change 15 to your desired days
```

### Change Contact Information:
Edit the components:
- `LicenseExpiryWarning.tsx` (lines 78-108)
- `LicenseExpired.tsx` (lines 95-131)

### Add More Languages:
Edit `/src/i18n/config.ts` and add license translations for Pashto, Dari, and Arabic in their respective sections.

## Role-Based Access:

| Role | License Warning | License Expired Block |
|------|----------------|----------------------|
| Super Admin | ❌ No | ❌ No |
| Admin | ✅ Yes | ✅ Yes |
| Doctor | ✅ Yes | ✅ Yes |
| Receptionist | ✅ Yes | ✅ Yes |
| Lab Technician | ✅ Yes | ✅ Yes |
| Pharmacist | ✅ Yes | ✅ Yes |

## Important Notes:

1. **Super Admin Exception**: Super Admin NEVER sees license warnings or blocks
2. **Hospital-Specific**: Each hospital has independent license tracking
3. **Every Login Alert**: Warning modal appears on EVERY login during the warning period (not just once per day)
4. **Complete Block**: Expired license completely blocks dashboard access
5. **Contact Info**: All contact details are ShifaaScript's actual support contacts
6. **Dark Mode**: Both components fully support dark/light themes
7. **RTL Support**: Components support RTL for Arabic/Dari/Pashto languages
8. **Logout Available**: Users with expired licenses can logout to try different accounts
9. **Countdown Period**: Warning starts 15 days before expiry and continues daily (15, 14, 13...3, 2, 1, 0)

## Support Information:

**Phone Numbers**:
- +93 789 681 010
- +93 701 021 319

**Email Addresses**:
- sadiq.aminzai2014@gmail.com
- raz.sahar2@gmail.com
- mohammadbilalniazi2016@gmail.com

**Support Hours**:
- Saturday - Thursday: 8:00 AM - 5:00 PM (AFT)
- Friday: Closed