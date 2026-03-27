import api from './axios';

export interface PaginatedResponse<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface RoomPayload {
  hospital_id?: string;
  room_number: string;
  type: 'General' | 'Private' | 'Semi-Private' | 'ICU' | 'Emergency';
  total_beds: number;
  available_beds: number;
  cost_per_bed: number;
  is_active?: boolean;
}

export interface RoomBookingPayload {
  hospital_id?: string;
  room_id: string;
  patient_id: string;
  doctor_id?: string;
  booking_date: string;
  check_in_date: string;
  check_out_date?: string;
  bed_number?: string;
  beds_to_book: number;
  discount_amount?: number;
  status: 'Pending' | 'Confirmed' | 'Checked-in' | 'Checked-out' | 'Cancelled';
  payment_status: 'pending' | 'paid' | 'partial' | 'cancelled';
  remarks?: string;
  is_active?: boolean;
}

export interface RoomBookingAvailabilityResponse {
  all_beds: string[];
  unavailable_beds: string[];
  available_beds: string[];
  occupied_count: number;
  available_count: number;
  suggested_beds: string[];
}

const unwrap = <T>(res: any): PaginatedResponse<T> => {
  const payload = res?.data;
  if (Array.isArray(payload)) {
    return { data: payload as T[] };
  }
  return {
    data: (payload?.data ?? []) as T[],
    current_page: payload?.current_page,
    last_page: payload?.last_page,
    per_page: payload?.per_page,
    total: payload?.total,
  };
};

export async function listRooms(params?: Record<string, any>) {
  const res = await api.get('/rooms', { params });
  return unwrap<any>(res);
}

export async function createRoom(payload: RoomPayload) {
  const res = await api.post('/rooms', payload);
  return res.data;
}

export async function updateRoom(id: string, payload: Partial<RoomPayload>) {
  const res = await api.put(`/rooms/${id}`, payload);
  return res.data;
}

export async function deleteRoom(id: string) {
  const res = await api.delete(`/rooms/${id}`);
  return res.data;
}

export async function listRoomBookings(params?: Record<string, any>) {
  const res = await api.get('/room-bookings', { params });
  return unwrap<any>(res);
}

export async function createRoomBooking(payload: RoomBookingPayload) {
  const res = await api.post('/room-bookings', payload);
  return res.data;
}

export async function updateRoomBooking(id: string, payload: Partial<RoomBookingPayload>) {
  const res = await api.put(`/room-bookings/${id}`, payload);
  return res.data;
}

export async function deleteRoomBooking(id: string) {
  const res = await api.delete(`/room-bookings/${id}`);
  return res.data;
}

export async function getRoomBookingAvailability(params: {
  room_id: string;
  check_in_date: string;
  check_out_date?: string;
  beds_to_book?: number;
  ignore_booking_id?: string;
}) {
  const res = await api.get('/room-bookings/availability', { params });
  return res.data as RoomBookingAvailabilityResponse;
}
