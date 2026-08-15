import React from 'react';
import { useTranslation } from 'react-i18next';
import { Factory, Pill, Truck, Boxes } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { TabbedModulePage, type ModuleTab } from './TabbedModulePage';
import { ManufacturerManagement } from './ManufacturerManagement';
import { MedicineTypeManagement } from './MedicineTypeManagement';
import { MedicineManagement } from './MedicineManagement';
import { SupplierManagement } from './SupplierManagement';

interface PharmacyMasterDataProps {
  hospital: Hospital;
  userRole: UserRole;
}

/**
 * Manufacturers, medicine types, medicines and suppliers are reference data that
 * is set up once and rarely revisited, so they share one sidebar entry.
 */
export function PharmacyMasterData({ hospital, userRole }: PharmacyMasterDataProps) {
  const { t } = useTranslation();
  const tabs: ModuleTab[] = [
    {
      key: 'medicines',
      label: t('ui.medicines'),
      icon: <Pill className="w-3.5 h-3.5" />,
      anyPermissions: ['view_medicines', 'manage_medicines', 'dispense_medicines'],
      render: () => <MedicineManagement hospital={hospital} userRole={userRole} />,
    },
    {
      key: 'medicine-types',
      label: t('ui.medicineTypes'),
      icon: <Boxes className="w-3.5 h-3.5" />,
      anyPermissions: ['view_medicine_types', 'manage_medicine_types'],
      render: () => <MedicineTypeManagement hospital={hospital} userRole={userRole} />,
    },
    {
      key: 'manufacturers',
      label: t('ui.manufacturers'),
      icon: <Factory className="w-3.5 h-3.5" />,
      anyPermissions: ['view_manufacturers', 'manage_manufacturers'],
      render: () => <ManufacturerManagement hospital={hospital} userRole={userRole} />,
    },
    {
      key: 'suppliers',
      label: t('ui.suppliers'),
      icon: <Truck className="w-3.5 h-3.5" />,
      anyPermissions: ['view_suppliers', 'manage_suppliers'],
      render: () => <SupplierManagement hospital={hospital} userRole={userRole} />,
    },
  ];

  return (
    <TabbedModulePage
      title="Master Data"
      subtitle="Medicines, types, manufacturers and suppliers"
      tabs={tabs}
    />
  );
}
