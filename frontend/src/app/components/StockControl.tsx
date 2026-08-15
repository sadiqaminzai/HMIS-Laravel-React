import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, SlidersHorizontal } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { TabbedModulePage, type ModuleTab } from './TabbedModulePage';
import { StockManagement } from './StockManagement';
import { StockAdjustment } from './StockAdjustment';

interface StockControlProps {
  hospital: Hospital;
  userRole: UserRole;
}

/** Current stock and stock adjustments share one sidebar entry as two tabs. */
export function StockControl({ hospital, userRole }: StockControlProps) {
  const { t } = useTranslation();
  const tabs: ModuleTab[] = [
    {
      key: 'stocks',
      label: t('ui.stocks'),
      icon: <Box className="w-3.5 h-3.5" />,
      anyPermissions: ['view_stocks', 'manage_stocks'],
      render: () => <StockManagement hospital={hospital} userRole={userRole} />,
    },
    {
      key: 'adjustments',
      label: t('ui.stockAdjustments'),
      icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
      anyPermissions: ['edit_stocks', 'manage_stocks'],
      render: () => <StockAdjustment hospital={hospital} userRole={userRole} />,
    },
  ];

  return (
    <TabbedModulePage
      title="Stock Control"
      subtitle="Current stock levels and manual adjustments"
      tabs={tabs}
    />
  );
}
