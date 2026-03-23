import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { listRooms, createRoom, updateRoom, deleteRoom } from '../../api/rooms';
import { toast } from 'sonner';

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
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoomItem | null>(null);
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
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Room Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage room master records and capacity details.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Room
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <HospitalSelector
          userRole={userRole}
          selectedHospitalId={selectedHospitalId}
          onHospitalChange={setSelectedHospitalId}
        />
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by room number or type"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
        </div>
        <button
          onClick={loadRooms}
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2">Room</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Beds</th>
                <th className="px-4 py-2">Cost / Bed</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td className="px-4 py-6" colSpan={6}>Loading...</td></tr>
              ) : filteredRooms.length === 0 ? (
                <tr><td className="px-4 py-6 text-center" colSpan={6}>No rooms found</td></tr>
              ) : filteredRooms.map((room) => (
                <tr key={room.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{room.roomNumber}</td>
                  <td className="px-4 py-2">{room.type}</td>
                  <td className="px-4 py-2">{room.availableBeds} / {room.totalBeds}</td>
                  <td className="px-4 py-2">{room.costPerBed.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${room.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {room.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(room)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeRoom(room.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{editing ? 'Edit Room' : 'Add Room'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitForm} className="p-5 grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-medium">Room Number</label>
                <input value={form.roomNumber} onChange={(e) => setForm((p) => ({ ...p, roomNumber: e.target.value }))} required className="mt-1 w-full rounded border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-medium">Type</label>
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as RoomType }))} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                  {roomTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="text-xs font-medium">Total Beds</label>
                <input type="number" min={1} value={form.totalBeds} onChange={(e) => setForm((p) => ({ ...p, totalBeds: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="text-xs font-medium">Available Beds</label>
                <input type="number" min={0} value={form.availableBeds} onChange={(e) => setForm((p) => ({ ...p, availableBeds: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="text-xs font-medium">Cost Per Bed</label>
                <input type="number" min={0} step="0.01" value={form.costPerBed} onChange={(e) => setForm((p) => ({ ...p, costPerBed: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-12 flex items-center gap-2 mt-1">
                <input id="room-active" type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                <label htmlFor="room-active" className="text-sm">Active</label>
              </div>
              <div className="col-span-12 flex items-center justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-2 text-sm rounded border">Cancel</button>
                <button type="submit" className="px-3 py-2 text-sm rounded bg-blue-600 text-white">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
