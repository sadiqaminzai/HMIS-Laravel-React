import React, { createContext, useContext, useState } from 'react';
import { Hospital } from '../types';
import { mockHospitals } from '../data/mockData';

interface HospitalContextType {
  hospitals: Hospital[];
  updateHospital: (hospital: Hospital) => void;
  addHospital: (hospital: Hospital) => void;
  getHospital: (id: string) => Hospital | undefined;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

export function HospitalProvider({ children }: { children: React.ReactNode }) {
  const [hospitals, setHospitals] = useState<Hospital[]>(mockHospitals);

  const updateHospital = (updatedHospital: Hospital) => {
    setHospitals(prev => prev.map(h => h.id === updatedHospital.id ? updatedHospital : h));
  };

  const addHospital = (newHospital: Hospital) => {
    setHospitals(prev => [...prev, newHospital]);
  };

  const getHospital = (id: string) => {
    return hospitals.find(h => h.id === id);
  };

  return (
    <HospitalContext.Provider value={{ hospitals, updateHospital, addHospital, getHospital }}>
      {children}
    </HospitalContext.Provider>
  );
}

export function useHospitals() {
  const context = useContext(HospitalContext);
  if (context === undefined) {
    // Return safe default during hot reload or context loss
    console.warn('useHospitals called outside of HospitalProvider');
    return {
      hospitals: mockHospitals,
      updateHospital: () => console.warn('HospitalContext not ready'),
      addHospital: () => console.warn('HospitalContext not ready'),
      getHospital: (id: string) => mockHospitals.find(h => h.id === id)
    };
  }
  return context;
}
