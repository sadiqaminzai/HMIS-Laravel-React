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
  const [currentPage, setCurrentPage] = useState(1);
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

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / itemsPerPage));

  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRooms.slice(start, start + itemsPerPage);
  }, [filteredRooms, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedHospitalId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
                setCurrentPage(1);
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

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2">{t('table.room')}</th>
                <th className="px-4 py-2">{t('table.type')}</th>
                <th className="px-4 py-2">{t('table.beds')}</th>
                <th className="px-4 py-2">{t('table.bedNumbers')}</th>
                <th className="px-4 py-2">{t('table.costPerBed')}</th>
                <th className="px-4 py-2">{t('table.status')}</th>
                <th className="px-4 py-2 text-center">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td className="px-4 py-6" colSpan={7}>Loading...</td></tr>
              ) : filteredRooms.length === 0 ? (
                <tr><td className="px-4 py-6 text-center" colSpan={7}>No rooms found</td></tr>
              ) : paginatedRooms.map((room) => (
                <tr key={room.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{room.roomNumber}</td>
                  <td className="px-4 py-2">{room.type}</td>
                  <td className="px-4 py-2">{room.availableBeds} / {room.totalBeds}</td>
                  <td className="px-4 py-2">
                    <div className="text-[11px] text-gray-600 dark:text-gray-300">
                      {generateRoomBeds(room.totalBeds).slice(0, 5).join(', ')}
                      {room.totalBeds > 5 ? ` +${room.totalBeds - 5} more` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2">{room.costPerBed.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${room.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {room.isActive ? t('ui.active') : t('ui.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setViewing(room)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title={t('ui.view')}>
                        <Eye className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <button onClick={() => openEdit(room)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md" title={t('ui.edit')}>
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => removeRoom(room.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md" title={t('ui.delete')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredRooms.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
            <span>Showing {paginatedRooms.length} of {filteredRooms.length} rooms</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >{t('ui.prev')}</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >{t('ui.next')}</button>
            </div>
          </div>
        )}
      </div>

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
