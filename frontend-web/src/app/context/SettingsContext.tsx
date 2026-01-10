import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../../api/axios';

export type DateFormat = 'gregorian' | 'hijri_shamsi';

export interface PatientIdConfig {
  autoGenerate: boolean;
  prefix: string;
  startNumber: number;
  digits: number;
}

export interface HospitalSetting {
  hospitalId: string;
  defaultDoctorId?: string;
  defaultToWalkIn: boolean;
  patientIdConfig: PatientIdConfig;
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
  getDefaultToWalkIn: (hospitalId: string) => boolean;
  getPatientIdConfig: (hospitalId: string) => PatientIdConfig;
  generatePatientId: (hospitalId: string, currentCount: number) => string;
  loadHospitalSetting: (hospitalId: string) => Promise<void>;
  saveHospitalSetting: (hospitalId: string, payload: Partial<HospitalSetting>) => Promise<void>;
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
  getDefaultToWalkIn: () => false,
  getPatientIdConfig: () => defaultPatientIdConfig,
  generatePatientId: () => 'P0001',
  loadHospitalSetting: async () => {},
  saveHospitalSetting: async () => {}
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

  const [settingsByHospital, setSettingsByHospital] = useState<Record<string, HospitalSetting>>({});

  const loadHospitalSetting = async (hospitalId: string) => {
    if (!hospitalId) return;
    if (settingsByHospital[hospitalId]) return;
    try {
      const { data } = await api.get(`/hospital-settings/${hospitalId}`);
      setSettingsByHospital((prev) => ({
        ...prev,
        [hospitalId]: normalizeSetting(data)
      }));
    } catch (error) {
      console.error('Failed to load hospital setting', error);
    }
  };

  const saveHospitalSetting = async (hospitalId: string, payload: Partial<HospitalSetting>) => {
    const body: any = {};
    if (payload.defaultDoctorId !== undefined) body.default_doctor_id = payload.defaultDoctorId || null;
    if (payload.defaultToWalkIn !== undefined) body.default_to_walk_in = payload.defaultToWalkIn;
    if (payload.patientIdConfig) {
      body.patient_id_prefix = payload.patientIdConfig.prefix;
      body.patient_id_start = payload.patientIdConfig.startNumber;
      body.patient_id_digits = payload.patientIdConfig.digits;
      body.auto_generate_patient_ids = payload.patientIdConfig.autoGenerate;
    }

    const { data } = await api.put(`/hospital-settings/${hospitalId}`, body);
    setSettingsByHospital((prev) => ({
      ...prev,
      [hospitalId]: normalizeSetting(data)
    }));
  };

  const normalizeSetting = (raw: any): HospitalSetting => {
    return {
      hospitalId: String(raw.hospital_id ?? raw.id ?? ''),
      defaultDoctorId: raw.default_doctor_id ? String(raw.default_doctor_id) : undefined,
      defaultToWalkIn: Boolean(raw.default_to_walk_in),
      patientIdConfig: {
        autoGenerate: raw.auto_generate_patient_ids ?? true,
        prefix: raw.patient_id_prefix ?? 'P',
        startNumber: Number(raw.patient_id_start ?? 1),
        digits: Number(raw.patient_id_digits ?? 5),
      },
    };
  };

  const getHospitalSetting = (hospitalId: string): HospitalSetting => {
    return settingsByHospital[hospitalId] || {
      hospitalId,
      defaultDoctorId: undefined,
      defaultToWalkIn: false,
      patientIdConfig: { ...defaultPatientIdConfig },
    };
  };

  const getDefaultDoctorId = (hospitalId: string) => {
    return getHospitalSetting(hospitalId).defaultDoctorId;
  };

  const getDefaultToWalkIn = (hospitalId: string) => {
    return getHospitalSetting(hospitalId).defaultToWalkIn;
  };

  const getPatientIdConfig = (hospitalId: string): PatientIdConfig => {
    return getHospitalSetting(hospitalId).patientIdConfig;
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
      getDefaultToWalkIn,
      getPatientIdConfig,
      generatePatientId,
      loadHospitalSetting,
      saveHospitalSetting
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  return context;
}
