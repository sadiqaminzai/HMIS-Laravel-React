import React, { createContext, useContext, useState, useEffect } from 'react';

export type DateFormat = 'gregorian' | 'hijri_shamsi';

interface PatientIdConfig {
  autoGenerate: boolean;
  prefix: string;
  startNumber: number;
  digits: number;
}

interface Settings {
  dateFormat: DateFormat;
  defaultDoctorId?: { [hospitalId: string]: string }; // Hospital-specific default doctor
  patientIdConfig?: { [hospitalId: string]: PatientIdConfig }; // Hospital-specific patient ID config
  defaultToWalkIn?: boolean; // Default to walk-in patient mode in prescription creation
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
  getDefaultDoctorId: (hospitalId: string) => string | undefined;
  setDefaultDoctorId: (hospitalId: string, doctorId: string) => void;
  getPatientIdConfig: (hospitalId: string) => PatientIdConfig;
  setPatientIdConfig: (hospitalId: string, config: PatientIdConfig) => void;
  generatePatientId: (hospitalId: string, currentCount: number) => string;
}

const defaultPatientIdConfig: PatientIdConfig = {
  autoGenerate: true,
  prefix: 'P',
  startNumber: 1,
  digits: 5
};

const defaultSettings: Settings = {
  dateFormat: 'gregorian',
  defaultDoctorId: {},
  patientIdConfig: {},
  defaultToWalkIn: false
};

// Create context with default value
const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  getDefaultDoctorId: () => undefined,
  setDefaultDoctorId: () => {},
  getPatientIdConfig: () => defaultPatientIdConfig,
  setPatientIdConfig: () => {},
  generatePatientId: () => 'P0001'
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem('app_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all required fields exist
        return {
          dateFormat: parsed.dateFormat || 'gregorian',
          defaultDoctorId: parsed.defaultDoctorId || {},
          patientIdConfig: parsed.patientIdConfig || {},
          defaultToWalkIn: parsed.defaultToWalkIn || false
        };
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem('app_settings');
      } catch (e) {
        console.error('Error clearing localStorage:', e);
      }
    }
    // Default settings
    return { ...defaultSettings };
  });

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('app_settings', JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving settings to localStorage:', error);
      }
      return updated;
    });
  };

  const getDefaultDoctorId = (hospitalId: string) => {
    return settings.defaultDoctorId?.[hospitalId];
  };

  const setDefaultDoctorId = (hospitalId: string, doctorId: string) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        defaultDoctorId: {
          ...prev.defaultDoctorId,
          [hospitalId]: doctorId,
        },
      };
      try {
        localStorage.setItem('app_settings', JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving settings to localStorage:', error);
      }
      return updated;
    });
  };

  const getPatientIdConfig = (hospitalId: string): PatientIdConfig => {
    return settings.patientIdConfig?.[hospitalId] || defaultPatientIdConfig;
  };

  const setPatientIdConfig = (hospitalId: string, config: PatientIdConfig) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        patientIdConfig: {
          ...prev.patientIdConfig,
          [hospitalId]: config,
        },
      };
      try {
        localStorage.setItem('app_settings', JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving settings to localStorage:', error);
      }
      return updated;
    });
  };

  const generatePatientId = (hospitalId: string, currentCount: number): string => {
    const config = getPatientIdConfig(hospitalId);
    const number = (config.startNumber + currentCount).toString().padStart(config.digits, '0');
    return `${config.prefix}${number}`;
  };

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      updateSettings, 
      getDefaultDoctorId, 
      setDefaultDoctorId,
      getPatientIdConfig,
      setPatientIdConfig,
      generatePatientId
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  return context;
}
