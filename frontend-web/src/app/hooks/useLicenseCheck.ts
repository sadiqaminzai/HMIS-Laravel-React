import { useState, useEffect } from 'react';
import { Hospital } from '../types';

export interface LicenseStatus {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  expiryDate: string;
}

/**
 * Custom hook to check license status
 * Returns license status information for a given hospital
 */
export function useLicenseCheck(hospital: Hospital | null): LicenseStatus {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining: 0,
    expiryDate: '',
  });

  useEffect(() => {
    if (!hospital || !hospital.licenseExpiryDate) {
      setLicenseStatus({
        isExpired: false,
        isExpiringSoon: false,
        daysRemaining: 0,
        expiryDate: '',
      });
      return;
    }

    const checkLicenseStatus = () => {
      const now = new Date();
      const expiryDate = new Date(hospital.licenseExpiryDate);
      
      // Reset time to start of day for accurate day calculation
      now.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);

      // Calculate difference in days
      const timeDiff = expiryDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      const isExpired = daysRemaining < 0;
      const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 15;

      setLicenseStatus({
        isExpired,
        isExpiringSoon,
        daysRemaining: Math.max(0, daysRemaining),
        expiryDate: hospital.licenseExpiryDate,
      });
    };

    checkLicenseStatus();

    // Check license status every hour
    const interval = setInterval(checkLicenseStatus, 1000 * 60 * 60);

    return () => clearInterval(interval);
  }, [hospital]);

  return licenseStatus;
}

/**
 * Utility function to calculate days between two dates
 */
export function calculateDaysRemaining(expiryDateString: string): number {
  const now = new Date();
  const expiryDate = new Date(expiryDateString);
  
  now.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  const timeDiff = expiryDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  return daysRemaining;
}

/**
 * Utility function to check if license is expired
 */
export function isLicenseExpired(expiryDateString: string): boolean {
  const daysRemaining = calculateDaysRemaining(expiryDateString);
  return daysRemaining < 0;
}

/**
 * Utility function to check if license is expiring soon (within 15 days)
 */
export function isLicenseExpiringSoon(expiryDateString: string): boolean {
  const daysRemaining = calculateDaysRemaining(expiryDateString);
  return daysRemaining >= 0 && daysRemaining <= 15;
}

/**
 * Get warning display status from localStorage
 * Returns true if warning should be shown for today
 */
export function shouldShowWarningToday(hospitalId: string): boolean {
  const storageKey = `license_warning_shown_${hospitalId}`;
  const lastShownDate = localStorage.getItem(storageKey);
  const today = new Date().toDateString();

  // If never shown or shown on a different day, return true
  return lastShownDate !== today;
}

/**
 * Mark warning as shown for today
 */
export function markWarningShownToday(hospitalId: string): void {
  const storageKey = `license_warning_shown_${hospitalId}`;
  const today = new Date().toDateString();
  localStorage.setItem(storageKey, today);
}
