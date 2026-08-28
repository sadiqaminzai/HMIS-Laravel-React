import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, X, Eye, BedDouble } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { listRooms, createRoom, updateRoom, deleteRoom } from '../../api/rooms';
import { useAuth } from '../context/AuthContext';
import { ModalOverlay, ModalPanel, DetailModalHeader, DetailRow } from './ui/ModalParts';
import { TabActionsSlot, useIsEmbedded } from './TabbedModulePage';
import { toast } from 'sonner';
import { AddButton } from './AddButton';
import {
  ActivePill,
  CellNumber,
  CellStack,
  CellText,
  DataTableBody,
  DataTableCard,
  DataTableHead,
  DeleteIcon,
  EditIcon,
  RowIcon,
  TableAction,
  TableActions,
  TableEmpty,
  TableLoading,
  TablePill,
  Th,
  Tr,
  ViewIcon,
  usePagination,
  useTableSort,
} from './DataTable';

interface RoomManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

type RoomType = 'General' | 'Private' | 'Semi-Private' | 'ICU' | 'Emergency';

interface RoomItem {
  id: string;
  hospitalId: string;
  roomNumber: string;
  type: RoomType;
  totalBeds: number;
  availableBeds: number;
  costPerBed: number;
  isActive: boolean;
}

const roomTypes: RoomType[] = ['General', 'Private', 'Semi-Private', 'ICU', 'Emergency'];

const generateRoomBeds = (totalBeds: number) => {
  const beds: string[] = [];
  const total = Math.max(0, Number(totalBeds || 0));
  for (let i = 1; i <= total; i++) {
    beds.push(`Bed-${i}`);
  }
  return beds;
};

const mapRoom = (r: any): RoomItem => ({
  id: String(r.id),
  hospitalId: String(r.hospital_id),
  roomNumber: r.room_number,
  type: r.type,
  totalBeds: Number(r.total_beds ?? 0),
  availableBeds: Number(r.available_beds ?? 0),
  costPerBed: Number(r.cost_per_bed ?? 0),
  isActive: Boolean(r.is_active),
});

export function RoomManagement({ hospital, userRole }: RoomManagementProps) {
  const { t } = useTranslation();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const { hasPermission } = useAuth();
  const embedded = useIsEmbedded();
  const canAdd = hasPermission('add_rooms') || hasPermission('manage_rooms');
  const canEdit = hasPermission('edit_rooms') || hasPermission('manage_rooms');
  const canDelete = hasPermission('delete_rooms') || hasPermission('manage_rooms');

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoomItem | null>(null);
  const [viewing, setViewing] = useState<RoomItem | null>(null);
  const [form, setForm] = useState({
    roomNumber: '',
    type: 'General' as RoomType,
    totalBeds: '1',
    availableBeds: '1',
    costPerBed: '0',
    isActive: true,
  });

  const loadRooms = async () => {
    setLoading(true);
    try {
      const result = await listRooms({
        ...(userRole === 'super_admin' && selectedHospitalId !== 'all' ? { hospital_id: selectedHospitalId } : {}),
        search: search || undefined,
        per_page: 100,
      });
      setRooms((result.data ?? []).map(mapRoom));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospitalId]);

  const filteredRooms = useMemo(() => {
    if (!search) return rooms;
    const q = search.toLowerCase();
    return rooms.filter((r) => r.roomNumber.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
  }, [rooms, search]);

  // Column sorting and paging now come from the shared table, so this list
  // behaves the same as Doctor Management rather than being sorted only by
  // whatever order the API happened to return.
  const sort = useTableSort(filteredRooms, 'roomNumber');
  const { page, setPage, totalPages, pageRows: paginatedRooms } = usePagination(sort.rows);

  useEffect(() => {
    setPage(1);
  }, [search, selectedHospitalId, setPage]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      roomNumber: '',
      type: 'General',
      totalBeds: '1',
      availableBeds: '1',
      costPerBed: '0',
      isActive: true,
    });
  };

  const openCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (room: RoomItem) => {
    setEditing(room);
    setForm({
      roomNumber: room.roomNumber,
      type: room.type,
      totalBeds: String(room.totalBeds),
      availableBeds: String(room.availableBeds),
      costPerBed: String(room.costPerBed),
      isActive: room.isActive,
    });
    setIsModalOpen(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalBeds = Number(form.totalBeds || 0);
    const availableBeds = Number(form.availableBeds || 0);

    if (availableBeds > totalBeds) {
      toast.error('Available beds cannot exceed total beds');
      return;
    }

    const payload = {
      hospital_id: userRole === 'super_admin' && selectedHospitalId !== 'all' ? selectedHospitalId : currentHospital.id,
      room_number: form.roomNumber,
      type: form.type,
      total_beds: totalBeds,
      available_beds: availableBeds,
      cost_per_bed: Number(form.costPerBed || 0),
      is_active: form.isActive,
    };

    try {
      if (editing) {
        await updateRoom(editing.id, payload);
        toast.success('Room updated');
      } else {
        await createRoom(payload);
        toast.success('Room created');
      }
      setIsModalOpen(false);
      resetForm();
      loadRooms();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save room');
    }
  };

  const removeRoom = async (id: string) => {
    try {
      await deleteRoom(id);
      toast.success('Room deleted');
      loadRooms();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete room');
    }
  };

  return (
    <div className={embedded ? 'space-y-2' : 'space-y-3'}>
      {!embedded && (
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('ui.rooms')}</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Manage room master records and capacity details.</p>
        </div>
      )}

      {/* Compact toolbar; inside a tabbed page it renders on the tab row. */}
      <TabActionsSlot>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search rooms..."
              aria-label="Search rooms"
              className="w-44 pl-8 pr-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={loadRooms}
            className="px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
          >{t('ui.refresh')}</button>
          {canAdd && (
            <AddButton onClick={openCreate} label={t('ui.addRoom')} />
          )}
        </div>
      </TabActionsSlot>

      {!embedded && (
        <HospitalSelector
          userRole={userRole}
          selectedHospitalId={selectedHospitalId}
          onHospitalChange={setSelectedHospitalId}
        />
      )}

      <DataTableCard
        total={filteredRooms.length}
        shown={paginatedRooms.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noun="rooms"
        maxHeight={embedded ? 'calc(100vh - 300px)' : 'calc(100vh - 220px)'}
      >
        <DataTableHead>
          <Th sort={sort} field="roomNumber">{t('table.room')}</Th>
          <Th sort={sort} field="type">{t('table.type')}</Th>
          <Th sort={sort} field="availableBeds">{t('table.beds')}</Th>
          <Th>{t('table.bedNumbers')}</Th>
          <Th sort={sort} field="costPerBed">{t('table.costPerBed')}</Th>
          <Th sort={sort} field="isActive">{t('table.status')}</Th>
          <Th align="center">{t('table.actions')}</Th>
        </DataTableHead>
        <DataTableBody>
          {loading ? (
            <TableLoading colSpan={7} />
          ) : paginatedRooms.length === 0 ? (
            <TableEmpty colSpan={7} message="No rooms found" icon={<BedDouble className="w-6 h-6 text-gray-400" />} />
          ) : (
            paginatedRooms.map((room) => (
              <Tr key={room.id}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <RowIcon tone="blue">
                      <BedDouble className="w-4 h-4" />
                    </RowIcon>
                    <CellStack
                      primary={room.roomNumber}
                      secondary={`${room.availableBeds} of ${room.totalBeds} free`}
                    />
                  </div>
                </td>
                <td className="px-4 py-2">
                  <TablePill tone="purple">{room.type}</TablePill>
                </td>
                <td className="px-4 py-2">
                  <CellNumber>{room.availableBeds} / {room.totalBeds}</CellNumber>
                </td>
                <td className="px-4 py-2">
                  <CellText>
                    {generateRoomBeds(room.totalBeds).slice(0, 5).join(', ')}
                    {room.totalBeds > 5 ? ` +${room.totalBeds - 5} more` : ''}
                  </CellText>
                </td>
                <td className="px-4 py-2">
                  <CellNumber tone="money">{room.costPerBed.toFixed(2)}</CellNumber>
                </td>
                <td className="px-4 py-2">
                  <ActivePill active={room.isActive} />
                </td>
                <td className="px-4 py-2 text-center">
                  <TableActions>
                    <TableAction tone="view" title={t('ui.view')} onClick={() => setViewing(room)}>
                      <ViewIcon />
                    </TableAction>
                    {canEdit && (
                      <TableAction tone="edit" title={t('ui.edit')} onClick={() => openEdit(room)}>
                        <EditIcon />
                      </TableAction>
                    )}
                    {canDelete && (
                      <TableAction tone="delete" title={t('ui.delete')} onClick={() => removeRoom(room.id)}>
                        <DeleteIcon />
                      </TableAction>
                    )}
                  </TableActions>
                </td>
              </Tr>
            ))
          )}
        </DataTableBody>
      </DataTableCard>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{editing ? t('ui.editRoom') : t('ui.addRoom')}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title={t('ui.close')}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitForm} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Room Number</label>
                <input value={form.roomNumber} onChange={(e) => setForm((p) => ({ ...p, roomNumber: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.type')}</label>
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as RoomType }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all">
                  {roomTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Total Beds</label>
                <input type="number" min={1} value={form.totalBeds} onChange={(e) => setForm((p) => ({ ...p, totalBeds: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Available Beds</label>
                <input type="number" min={0} value={form.availableBeds} onChange={(e) => setForm((p) => ({ ...p, availableBeds: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Cost Per Bed</label>
                <input type="number" min={0} step="0.01" value={form.costPerBed} onChange={(e) => setForm((p) => ({ ...p, costPerBed: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div className="col-span-12 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-700/30 text-xs text-gray-600 dark:text-gray-300">
                Bed numbers for this room: {generateRoomBeds(Number(form.totalBeds || 0)).join(', ') || 'No beds'}
              </div>
              <div className="col-span-12 flex items-center gap-2 mt-1">
                <input id="room-active" type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                <label htmlFor="room-active" className="text-sm">{t('ui.active')}</label>
              </div>
              <div className="col-span-12 flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
                <button type="submit" className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs disabled:opacity-60 disabled:cursor-not-allowed">{editing ? t('ui.update') : t('ui.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ModalOverlay open={!!viewing}>
        <ModalPanel size="md">
          <DetailModalHeader
            title="Room Details"
            icon={<BedDouble className="w-4 h-4" />}
            gradient="from-blue-600 to-blue-700"
            onClose={() => setViewing(null)}
          />
          {viewing && (
            <div className="p-4 space-y-3">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Room {viewing.roomNumber}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">{viewing.type}</p>
              </div>
              <div>
                <DetailRow label={t('ui.roomNumber')} value={viewing.roomNumber} />
                <DetailRow label={t('ui.type')} value={viewing.type} />
                <DetailRow label="Total Beds" value={viewing.totalBeds} />
                <DetailRow label="Bed Numbers" value={viewing.bedNumbers || '—'} />
                <DetailRow label="Cost / Bed" value={viewing.costPerBed.toFixed(2)} />
                <DetailRow
                  label={t('ui.status')}
                  value={
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${viewing.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {viewing.isActive ? t('ui.active') : t('ui.inactive')}
                    </span>
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {canEdit && (
                  <button
                    onClick={() => { const r = viewing; setViewing(null); openEdit(r); }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />{t('ui.edit')}</button>
                )}
                <button
                  onClick={() => setViewing(null)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-medium"
                >{t('ui.close')}</button>
              </div>
            </div>
          )}
        </ModalPanel>
      </ModalOverlay>
    </div>
  );
}
