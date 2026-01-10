import React from 'react';
import { Building2 } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { useHospitals } from '../context/HospitalContext';

interface HospitalSelectorProps {
  userRole: UserRole;
  selectedHospitalId: string;
  onHospitalChange: (hospitalId: string) => void;
}

export function HospitalSelector({ 
  userRole, 
  selectedHospitalId, 
  onHospitalChange 
}: HospitalSelectorProps) {
  const { hospitals } = useHospitals();

  // Only show for super_admin
  if (userRole !== 'super_admin') {
    return null;
  }

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
      <Building2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
        Select Hospital
      </label>
      <select
        value={selectedHospitalId}
        onChange={(e) => onHospitalChange(e.target.value)}
        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
      >
        <option value="all">All Hospitals</option>
        {hospitals.map(h => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
    </div>
  );
}

// Custom hook for hospital filtering logic with "All Hospitals" support
export function useHospitalFilter(hospital: Hospital, userRole: UserRole) {
  const { hospitals } = useHospitals();
  const [selectedHospitalId, setSelectedHospitalId] = React.useState<string>(hospital.id);
  
  const currentHospital = userRole === 'super_admin' && selectedHospitalId !== 'all'
    ? hospitals.find(h => h.id === selectedHospitalId) || hospital
    : hospital;

  // Helper function to filter data by hospital
  const filterByHospital = React.useCallback(<T extends { hospitalId: string }>(data: T[]): T[] => {
    if (userRole !== 'super_admin') {
      // Non-super admin: filter by their assigned hospital
      return data.filter(item => item.hospitalId === hospital.id);
    }
    
    if (selectedHospitalId === 'all') {
      // Super admin viewing all hospitals: return all data
      return data;
    }
    
    // Super admin viewing specific hospital: filter by selected hospital
    return data.filter(item => item.hospitalId === selectedHospitalId);
  }, [userRole, hospital.id, selectedHospitalId]);

  const isAllHospitals = userRole === 'super_admin' && selectedHospitalId === 'all';

  return {
    selectedHospitalId,
    setSelectedHospitalId,
    currentHospital,
    filterByHospital,
    isAllHospitals
  };
}