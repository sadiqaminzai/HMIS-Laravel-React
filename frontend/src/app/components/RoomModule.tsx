import React from 'react';
import { useTranslation } from 'react-i18next';
import { BedDouble, CalendarCheck } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { TabbedModulePage, type ModuleTab } from './TabbedModulePage';
import { RoomManagement } from './RoomManagement';
import { RoomBookingManagement } from './RoomBookingManagement';

interface RoomModuleProps {
  hospital: Hospital;
  userRole: UserRole;
}

/** Rooms and room bookings share one Reception entry with tabs. */
export function RoomModule({ hospital, userRole }: RoomModuleProps) {
  const { t } = useTranslation();
  const tabs: ModuleTab[] = [
    {
      key: 'room-bookings',
      label: t('ui.roomBookings'),
      icon: <CalendarCheck className="w-3.5 h-3.5" />,
      anyPermissions: ['view_room_bookings', 'manage_room_bookings'],
      render: () => <RoomBookingManagement hospital={hospital} userRole={userRole} />,
    },
    {
      key: 'rooms',
      label: t('ui.rooms'),
      icon: <BedDouble className="w-3.5 h-3.5" />,
      anyPermissions: ['view_rooms', 'manage_rooms'],
      render: () => <RoomManagement hospital={hospital} userRole={userRole} />,
    },
  ];

  return (
    <TabbedModulePage
      title={t('ui.rooms')}
      subtitle="Room master records and patient bookings"
      tabs={tabs}
    />
  );
}
