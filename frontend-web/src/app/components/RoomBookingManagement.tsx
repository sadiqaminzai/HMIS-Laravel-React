import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Printer } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { listRoomBookings, createRoomBooking, updateRoomBooking, deleteRoomBooking, listRooms, getRoomBookingAvailability } from '../../api/rooms';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface RoomBookingManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

interface BookingItem {
  id: string;
  hospitalId: string;
  roomId: string;
  roomNumber: string;
  patientId: string;
  patientName: string;
  doctorId?: string;
  doctorName?: string;
  bookingDate: string;
  checkInDate: string;
  checkOutDate?: string;
  bedNumber?: string;
  bedsToBook: number;
  totalCost: number;
  discountAmount: number;
  status: 'Pending' | 'Confirmed' | 'Checked-in' | 'Checked-out' | 'Cancelled';
  paymentStatus: 'pending' | 'paid' | 'partial' | 'cancelled';
  remarks?: string;
  isActive: boolean;
}

interface RoomOption {
  id: string;
  hospitalId: string;
  roomNumber: string;
  cost_per_bed?: number;
  total_beds?: number;
  available_beds?: number;
}

interface AvailabilityState {
  allBeds: string[];
  unavailableBeds: string[];
  availableBeds: string[];
  occupiedCount: number;
  availableCount: number;
  suggestedBeds: string[];
}

type ReceiptSize = 'a4' | '58mm' | '76mm' | '80mm';

const toDateInputValue = (value?: string): string => {
  if (!value) return '';
  const raw = String(value).trim();
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const parseBedNumbers = (value?: string): string[] => {
  if (!value) return [];
  return String(value)
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const mapBooking = (b: any): BookingItem => ({
  id: String(b.id),
  hospitalId: String(b.hospital_id),
  roomId: String(b.room_id),
  roomNumber: b.room?.room_number || String(b.room_id),
  patientId: String(b.patient_id),
  patientName: b.patient?.name || String(b.patient_id),
  doctorId: b.doctor_id ? String(b.doctor_id) : undefined,
  doctorName: b.doctor?.name,
  bookingDate: b.booking_date,
  checkInDate: toDateInputValue(b.check_in_date),
  checkOutDate: toDateInputValue(b.check_out_date) || undefined,
  bedNumber: b.bed_number || undefined,
  bedsToBook: Number(b.beds_to_book || 1),
  totalCost: Number(b.total_cost || 0),
  discountAmount: Number(b.discount_amount || 0),
  status: b.status,
  paymentStatus: b.payment_status,
  remarks: b.remarks || undefined,
  isActive: Boolean(b.is_active),
});

export function RoomBookingManagement({ hospital, userRole }: RoomBookingManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const { hospitals } = useHospitals();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { hasPermission } = useAuth();

  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<BookingItem | null>(null);
  const [printBooking, setPrintBooking] = useState<BookingItem | null>(null);
  const [receiptSize, setReceiptSize] = useState<ReceiptSize>(() => {
    const saved = localStorage.getItem('room_booking_receipt_size');
    if (saved === '58mm' || saved === '76mm' || saved === '80mm' || saved === 'a4') return saved;
    return '80mm';
  });
  const [form, setForm] = useState({
    hospitalId: currentHospital.id,
    roomId: '',
    patientId: '',
    doctorId: '',
    bookingDate: new Date().toISOString().slice(0, 10),
    checkInDate: new Date().toISOString().slice(0, 10),
    checkOutDate: '',
    bedNumber: '',
    bedsToBook: '1',
    discountPercent: '0',
    status: 'Pending' as BookingItem['status'],
    paymentStatus: 'pending' as BookingItem['paymentStatus'],
    remarks: '',
    isActive: true,
  });

  const calculateNightsAndTotal = () => {
    const inDate = form.checkInDate ? new Date(form.checkInDate) : null;
    const outDate = form.checkOutDate ? new Date(form.checkOutDate) : null;
    const nights = inDate && outDate
      ? Math.max(1, Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;
    const room = roomOptions.find((r) => r.id === form.roomId && r.hospitalId === form.hospitalId);
    const estimatedBase = Number(room?.cost_per_bed ?? 0) * Number(form.bedsToBook || 1) * nights;
    const discountAmount = (estimatedBase * Math.max(0, Number(form.discountPercent || 0))) / 100;
    const estimatedTotal = Math.max(0, estimatedBase - discountAmount);
    return { nights, estimatedBase, estimatedTotal, discountAmount };
  };

  const costPreview = calculateNightsAndTotal();

  const loadOptions = async () => {
    try {
      const rooms = await listRooms({
        ...(userRole === 'super_admin' && selectedHospitalId !== 'all' ? { hospital_id: selectedHospitalId } : {}),
        per_page: 100,
      });
      setRoomOptions((rooms.data ?? []).map((r) => ({
        id: String(r.id),
        hospitalId: String(r.hospital_id),
        roomNumber: r.room_number,
        cost_per_bed: Number(r.cost_per_bed ?? 0),
        total_beds: Number(r.total_beds ?? 0),
        available_beds: Number(r.available_beds ?? 0),
      })));
    } catch {
      setRoomOptions([]);
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const result = await listRoomBookings({
        ...(userRole === 'super_admin' && selectedHospitalId !== 'all' ? { hospital_id: selectedHospitalId } : {}),
        search: search || undefined,
        per_page: 100,
      });
      setBookings((result.data ?? []).map(mapBooking));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load room bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospitalId]);

  const filtered = useMemo(() => {
    if (!search) return bookings;
    const q = search.toLowerCase();
    return bookings.filter((b) =>
      b.roomNumber.toLowerCase().includes(q) ||
      b.patientName.toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q) ||
      b.paymentStatus.toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage]);

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
      hospitalId: selectedHospitalId === 'all' ? currentHospital.id : selectedHospitalId,
      roomId: '',
      patientId: '',
      doctorId: '',
      bookingDate: new Date().toISOString().slice(0, 10),
      checkInDate: new Date().toISOString().slice(0, 10),
      checkOutDate: '',
      bedNumber: '',
      bedsToBook: '1',
      discountPercent: '0',
      status: 'Pending',
      paymentStatus: 'pending',
      remarks: '',
      isActive: true,
    });
    setAvailability(null);
  };

  const openCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (item: BookingItem) => {
    setEditing(item);
    setForm({
      hospitalId: item.hospitalId,
      roomId: item.roomId,
      patientId: item.patientId,
      doctorId: item.doctorId || '',
      bookingDate: toDateInputValue(item.bookingDate),
      checkInDate: toDateInputValue(item.checkInDate),
      checkOutDate: toDateInputValue(item.checkOutDate),
      bedNumber: item.bedNumber || '',
      bedsToBook: String(item.bedsToBook),
      discountPercent: '0',
      status: item.status,
      paymentStatus: item.paymentStatus,
      remarks: item.remarks || '',
      isActive: item.isActive,
    });
    setAvailability(null);
    setIsModalOpen(true);
  };

  const selectedRoomOption = roomOptions.find((r) => r.id === form.roomId && r.hospitalId === form.hospitalId);
  const selectedBedNumbers = useMemo(() => parseBedNumbers(form.bedNumber), [form.bedNumber]);

  const setSelectedBedNumbers = (beds: string[]) => {
    setForm((prev) => ({ ...prev, bedNumber: beds.join(', ') }));
  };

  const toggleBedSelection = (bed: string) => {
    if (!availability) return;
    if (availability.unavailableBeds.includes(bed)) return;

    const limit = Math.max(1, Number(form.bedsToBook || 1));
    const isSelected = selectedBedNumbers.includes(bed);

    if (isSelected) {
      setSelectedBedNumbers(selectedBedNumbers.filter((b) => b !== bed));
      return;
    }

    if (selectedBedNumbers.length >= limit) {
      toast.error(`You can only select ${limit} bed(s).`);
      return;
    }

    setSelectedBedNumbers([...selectedBedNumbers, bed]);
  };

  useEffect(() => {
    if (!isModalOpen || !form.roomId || !form.checkInDate) {
      setAvailability(null);
      return;
    }

    const run = async () => {
      setAvailabilityLoading(true);
      try {
        const data = await getRoomBookingAvailability({
          room_id: form.roomId,
          check_in_date: form.checkInDate,
          check_out_date: form.checkOutDate || undefined,
          beds_to_book: Number(form.bedsToBook || 1),
          ignore_booking_id: editing?.id,
        });

        setAvailability({
          allBeds: data.all_beds ?? [],
          unavailableBeds: data.unavailable_beds ?? [],
          availableBeds: data.available_beds ?? [],
          occupiedCount: Number(data.occupied_count ?? 0),
          availableCount: Number(data.available_count ?? 0),
          suggestedBeds: data.suggested_beds ?? [],
        });
      } catch {
        setAvailability(null);
      } finally {
        setAvailabilityLoading(false);
      }
    };

    run();
  }, [isModalOpen, form.roomId, form.checkInDate, form.checkOutDate, form.bedsToBook, editing?.id]);

  const applySuggestedBeds = () => {
    if (!availability?.suggestedBeds?.length) {
      toast.error('No suggested beds available for this period');
      return;
    }

    const count = Math.max(1, Number(form.bedsToBook || 1));
    const selected = availability.suggestedBeds.slice(0, count);
    setSelectedBedNumbers(selected);
  };

  useEffect(() => {
    const limit = Math.max(1, Number(form.bedsToBook || 1));
    if (selectedBedNumbers.length <= limit) return;

    setSelectedBedNumbers(selectedBedNumbers.slice(0, limit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.bedsToBook]);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.checkOutDate && form.checkOutDate < form.checkInDate) {
      toast.error('Check-out date cannot be before check-in date');
      return;
    }

    const selectedBeds = parseBedNumbers(form.bedNumber);

    if (selectedBeds.length !== Number(form.bedsToBook || 1)) {
      toast.error('Please select bed numbers equal to Beds To Book.');
      return;
    }

    const payload = {
      hospital_id: userRole === 'super_admin' ? form.hospitalId : currentHospital.id,
      room_id: form.roomId,
      patient_id: form.patientId,
      doctor_id: form.doctorId || undefined,
      booking_date: form.bookingDate,
      check_in_date: form.checkInDate,
      check_out_date: form.checkOutDate || undefined,
      bed_number: form.bedNumber || undefined,
      beds_to_book: Number(form.bedsToBook || 1),
      discount_amount: calculateNightsAndTotal().discountAmount,
      status: form.status,
      payment_status: form.paymentStatus,
      remarks: form.remarks || undefined,
      is_active: form.isActive,
    };

    try {
      if (editing) {
        await updateRoomBooking(editing.id, payload);
        toast.success('Booking updated');
      } else {
        await createRoomBooking(payload as any);
        toast.success('Booking created');
      }
      setIsModalOpen(false);
      resetForm();
      loadBookings();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save room booking');
    }
  };

  const removeBooking = async (id: string) => {
    try {
      await deleteRoomBooking(id);
      toast.success('Booking deleted');
      loadBookings();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete booking');
    }
  };

  const quickStatusUpdate = async (item: BookingItem, status: BookingItem['status']) => {
    try {
      await updateRoomBooking(item.id, {
        hospital_id: item.hospitalId,
        room_id: item.roomId,
        patient_id: item.patientId,
        doctor_id: item.doctorId || undefined,
        booking_date: item.bookingDate,
        check_in_date: item.checkInDate,
        status,
        beds_to_book: item.bedsToBook,
        discount_amount: item.discountAmount,
        payment_status: item.paymentStatus,
        bed_number: item.bedNumber,
        remarks: item.remarks,
        is_active: item.isActive,
        check_out_date: status === 'Checked-out' ? (toDateInputValue(item.checkOutDate) || new Date().toISOString().slice(0, 10)) : toDateInputValue(item.checkOutDate),
      } as any);
      toast.success(`Booking marked as ${status}`);
      loadBookings();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update status');
    }
  };

  const filteredPatients = patients.filter((p) => p.hospitalId === form.hospitalId);
  const filteredDoctors = doctors.filter((d) => d.hospitalId === form.hospitalId);
  const filteredRooms = roomOptions.filter((r) => r.hospitalId === form.hospitalId);

  const openPrintReceipt = (item: BookingItem) => {
    setPrintBooking(item);
  };

  const resolveHospitalLogoUrl = (logo?: string): string => {
    if (!logo) return '';
    if (logo.startsWith('http')) return logo;
    const normalized = logo.startsWith('/') ? logo : `/${logo}`;
    if (normalized.startsWith('/storage/')) return normalized;
    return `/storage${normalized}`;
  };

  const printReceipt = (item: BookingItem, size: ReceiptSize = receiptSize) => {
    const hospitalInfo = hospitals.find((h) => h.id === item.hospitalId) || currentHospital;
    const brandColor = hospitalInfo.brandColor || '#2563eb';
    const logoUrl = resolveHospitalLogoUrl(hospitalInfo.logo);
    const isCompactReceipt = size !== 'a4';
    const ticketWidth = isCompactReceipt ? size : '190mm';
    const pageRule = isCompactReceipt
      ? `@page { size: ${size} auto; margin: 0; }`
      : '@page { size: A4; margin: 10mm; }';
    const nights = item.checkOutDate
      ? Math.max(1, Math.ceil((new Date(item.checkOutDate).getTime() - new Date(item.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 1;

    const receiptHtml = `
      <html>
        <head>
          <title>Room Booking Receipt</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #111827;
              margin: 0;
              background: ${isCompactReceipt ? '#ffffff' : '#f3f4f6'};
              padding: ${isCompactReceipt ? '0' : '12px'};
            }
            .ticket {
              width: ${ticketWidth};
              margin: 0 auto;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: ${isCompactReceipt ? '0' : '10px'};
              overflow: hidden;
              box-shadow: ${isCompactReceipt ? 'none' : '0 4px 14px rgba(0, 0, 0, 0.08)'};
            }
            .head {
              border-top: 4px solid ${brandColor};
              text-align: center;
              padding: ${isCompactReceipt ? '8px 8px 7px' : '10px 10px 8px'};
            }
            .logo {
              max-width: ${isCompactReceipt ? '32mm' : '40mm'};
              max-height: ${isCompactReceipt ? '14mm' : '18mm'};
              object-fit: contain;
              margin: 0 auto 6px;
              display: block;
            }
            .hospital {
              font-size: ${isCompactReceipt ? '11px' : '13px'};
              font-weight: 700;
              margin-bottom: 3px;
            }
            .meta {
              font-size: ${isCompactReceipt ? '8px' : '9px'};
              color: #4b5563;
              line-height: 1.35;
            }
            .title {
              margin-top: 7px;
              font-size: ${isCompactReceipt ? '9px' : '10px'};
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: ${brandColor};
            }
            .line {
              border-top: 1px dashed #d1d5db;
              margin: 0 10px;
            }
            .content {
              padding: ${isCompactReceipt ? '7px 8px 8px' : '12px 16px 16px'};
            }
            .row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 8px;
              font-size: ${isCompactReceipt ? '9px' : '12px'};
              margin: 6px 0;
              line-height: 1.4;
              page-break-inside: avoid;
            }
            .key {
              color: #4b5563;
              text-align: left;
              flex: 1;
              font-weight: 500;
            }
            .val {
              text-align: right;
              font-weight: 600;
              flex: 1.5;
              max-width: 60%;
              color: #111827;
              word-break: break-word;
            }
            .remarks-block {
              margin-top: 10px;
              padding-top: 8px;
              border-top: 1px dashed #d1d5db;
              font-size: ${isCompactReceipt ? '9px' : '12px'};
              page-break-inside: avoid;
            }
            .remarks-block .key {
              color: #4b5563;
              font-weight: 500;
              margin-bottom: 3px;
              text-align: left;
            }
            .remarks-block .val {
              font-weight: 400;
              font-style: italic;
              color: #111827;
              text-align: left;
              word-break: break-word;
            }
            .amount {
              margin-top: 10px;
              border-top: 1px solid #e5e7eb;
              padding-top: 10px;
              page-break-inside: avoid;
            }
            .amount .total {
              font-size: ${isCompactReceipt ? '11px' : '14px'};
              color: ${brandColor};
              font-weight: 700;
            }
            .footer {
              margin-top: 12px;
              border-top: 1px dashed #d1d5db;
              padding-top: 8px;
              text-align: center;
              font-size: ${isCompactReceipt ? '7px' : '10px'};
              color: #6b7280;
              line-height: 1.35;
              page-break-inside: avoid;
            }

            @media print {
              html, body {
                width: ${ticketWidth};
                background: #ffffff;
                padding: 0;
                margin: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .ticket {
                box-shadow: none;
                border: none;
                width: ${ticketWidth};
                margin: 0;
                padding: 0 !important;
              }
              ${pageRule}
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="head">
              ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Hospital Logo" />` : ''}
              <div class="hospital">${hospitalInfo.name}</div>
              <div class="meta">${hospitalInfo.address || ''}</div>
              <div class="meta">${hospitalInfo.phone || ''} ${hospitalInfo.email ? `| ${hospitalInfo.email}` : ''}</div>
              <div class="title">Room Booking Receipt</div>
            </div>
            <div class="line"></div>
            <div class="content">
              <div class="row"><div class="key">Receipt Date</div><div class="val">${new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</div></div>
              <div class="row"><div class="key">Room</div><div class="val">${item.roomNumber}</div></div>
              <div class="row"><div class="key">Patient</div><div class="val">${item.patientName}</div></div>
              <div class="row"><div class="key">Doctor</div><div class="val">${item.doctorName || 'N/A'}</div></div>
              <div class="row"><div class="key">Booking Date</div><div class="val">${new Date(item.bookingDate).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</div></div>
              <div class="row"><div class="key">Check In</div><div class="val">${new Date(item.checkInDate).toLocaleDateString('en-US', { dateStyle: 'short' })}</div></div>
              <div class="row"><div class="key">Check Out</div><div class="val">${item.checkOutDate ? new Date(item.checkOutDate).toLocaleDateString('en-US', { dateStyle: 'short' }) : 'Open'}</div></div>
              <div class="row"><div class="key">Nights / Beds</div><div class="val">${nights} / ${item.bedsToBook}</div></div>
              <div class="row"><div class="key">Status</div><div class="val">${item.status}</div></div>
              <div class="row"><div class="key">Payment</div><div class="val">${item.paymentStatus}</div></div>

              <div class="amount">
                <div class="row"><div class="key">Discount</div><div class="val">${item.discountAmount.toFixed(2)}</div></div>
                <div class="row"><div class="key">Total</div><div class="val total">${item.totalCost.toFixed(2)}</div></div>
              </div>

              ${item.remarks ? `
              <div class="remarks-block">
                <div class="key">Remarks</div>
                <div class="val">${item.remarks}</div>
              </div>
              ` : ''}

              <div class="footer">
                Generated by ${hospitalInfo.name}<br/>
                ShifaaScript
              </div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  useEffect(() => {
    localStorage.setItem('room_booking_receipt_size', receiptSize);
  }, [receiptSize]);

  useEffect(() => {
    if (userRole !== 'super_admin') return;
    if (selectedHospitalId === 'all') {
      setForm((prev) => ({
        ...prev,
        hospitalId: prev.hospitalId || currentHospital.id,
      }));
      return;
    }
    setForm((prev) => ({ ...prev, hospitalId: selectedHospitalId }));
  }, [selectedHospitalId, currentHospital.id, userRole]);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Room Booking</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track patient room bookings and occupancy status.</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Booking
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by patient, room, status" className="w-full pl-10 pr-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" />
          </div>
          <button onClick={loadBookings} className="px-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">Refresh</button>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        Workflow: Pending to Confirmed to Checked-in to Checked-out. Final cost is calculated by server based on room price, bed count, stay duration, and discount.
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2">Room</th>
                <th className="px-4 py-2">Patient</th>
                <th className="px-4 py-2">Dates</th>
                <th className="px-4 py-2">Nights</th>
                <th className="px-4 py-2">Beds</th>
                <th className="px-4 py-2">Bed Numbers</th>
                <th className="px-4 py-2">Cost</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td className="px-4 py-6" colSpan={9}>Loading...</td></tr>
              ) : paginatedBookings.length === 0 ? (
                <tr><td className="px-4 py-6 text-center" colSpan={9}>No bookings found</td></tr>
              ) : paginatedBookings.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{item.roomNumber}</td>
                  <td className="px-4 py-2">{item.patientName}</td>
                  <td className="px-4 py-2">{item.checkInDate} {item.checkOutDate ? `to ${item.checkOutDate}` : ''}</td>
                  <td className="px-4 py-2">
                    {item.checkOutDate
                      ? Math.max(1, Math.ceil((new Date(item.checkOutDate).getTime() - new Date(item.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))
                      : 1}
                  </td>
                  <td className="px-4 py-2">{item.bedsToBook}</td>
                  <td className="px-4 py-2 text-[11px]">{item.bedNumber || '-'}</td>
                  <td className="px-4 py-2">{item.totalCost.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 w-fit">{item.status}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 w-fit">{item.paymentStatus}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {item.status === 'Pending' && (
                        <button onClick={() => quickStatusUpdate(item, 'Confirmed')} className="px-2 py-1 text-[10px] rounded bg-blue-100 text-blue-700 hover:bg-blue-200" title="Confirm booking">Confirm</button>
                      )}
                      {item.status === 'Confirmed' && (
                        <button onClick={() => quickStatusUpdate(item, 'Checked-in')} className="px-2 py-1 text-[10px] rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200" title="Check in">Check-in</button>
                      )}
                      {item.status === 'Checked-in' && (
                        <button onClick={() => quickStatusUpdate(item, 'Checked-out')} className="px-2 py-1 text-[10px] rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200" title="Check out">Check-out</button>
                      )}
                      <button onClick={() => openPrintReceipt(item)} className="p-1.5 text-indigo-700 hover:bg-indigo-50 rounded-md" title="Print receipt"><Printer className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => removeBooking(item.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{editing ? 'Edit Booking' : 'Add Booking'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title="Close"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitForm} className="p-5 grid grid-cols-12 gap-3">
              {userRole === 'super_admin' && selectedHospitalId === 'all' && (
                <div className="col-span-12">
                  <label className="text-xs font-medium">Hospital</label>
                  <select
                    title="Hospital"
                    value={form.hospitalId}
                    onChange={(e) => setForm((p) => ({ ...p, hospitalId: e.target.value, roomId: '', patientId: '', doctorId: '' }))}
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    required
                  >
                    {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-medium">Room</label>
                <select title="Room" value={form.roomId} onChange={(e) => setForm((p) => ({ ...p, roomId: e.target.value }))} required className="mt-1 w-full rounded border px-2 py-1 text-xs">
                  <option value="">Select room</option>
                  {filteredRooms.map((r) => <option key={r.id} value={r.id}>{r.roomNumber}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-medium">Patient</label>
                <select title="Patient" value={form.patientId} onChange={(e) => setForm((p) => ({ ...p, patientId: e.target.value }))} required className="mt-1 w-full rounded border px-2 py-1 text-xs">
                  <option value="">Select patient</option>
                  {filteredPatients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-medium">Doctor (optional)</label>
                <select title="Doctor" value={form.doctorId} onChange={(e) => setForm((p) => ({ ...p, doctorId: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1 text-xs">
                  <option value="">None</option>
                  {filteredDoctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-medium">Booking Date</label>
                <input title="Booking date" type="date" value={form.bookingDate} onChange={(e) => setForm((p) => ({ ...p, bookingDate: e.target.value }))} required className="mt-1 w-full rounded border px-2 py-1 text-xs" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="text-xs font-medium">Check In</label>
                <input title="Check in date" type="date" value={form.checkInDate} onChange={(e) => setForm((p) => ({ ...p, checkInDate: e.target.value }))} required className="mt-1 w-full rounded border px-2 py-1 text-xs" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="text-xs font-medium">Check Out</label>
                <input title="Check out date" type="date" value={form.checkOutDate} onChange={(e) => setForm((p) => ({ ...p, checkOutDate: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1 text-xs" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="text-xs font-medium">Selected Beds</label>
                <input title="Selected beds" value={selectedBedNumbers.join(', ')} readOnly className="mt-1 w-full rounded border px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700/40" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="text-xs font-medium">Beds To Book</label>
                <input title="Beds to book" type="number" min={1} value={form.bedsToBook} onChange={(e) => setForm((p) => ({ ...p, bedsToBook: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1 text-xs" />
              </div>
              {(hasPermission('add_discounts') || hasPermission('manage_discounts')) && (
                <div className="col-span-12 md:col-span-4">
                  <label className="text-xs font-medium">Discount (%)</label>
                  <input title="Discount percent" type="number" min={0} max={100} step="1" value={form.discountPercent} onChange={(e) => setForm((p) => ({ ...p, discountPercent: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1 text-xs" />
                </div>
              )}
              <div className="col-span-12 md:col-span-4">
                <label className="text-xs font-medium">Status</label>
                <select title="Booking status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as BookingItem['status'] }))} className="mt-1 w-full rounded border px-2 py-1 text-xs">
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Checked-in">Checked-in</option>
                  <option value="Checked-out">Checked-out</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-medium">Payment Status</label>
                <select title="Payment status" value={form.paymentStatus} onChange={(e) => setForm((p) => ({ ...p, paymentStatus: e.target.value as BookingItem['paymentStatus'] }))} className="mt-1 w-full rounded border px-2 py-1 text-xs">
                  <option value="pending">pending</option>
                  <option value="paid">paid</option>
                  <option value="partial">partial</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-medium">Remarks</label>
                <input title="Remarks" value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1 text-xs" />
              </div>
              <div className="col-span-12 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-700/30 text-xs">
                <div className="font-medium text-gray-700 dark:text-gray-200">Cost summary</div>
                <div className="text-gray-600 dark:text-gray-300">Estimated nights: {costPreview.nights}</div>
                <div className="text-gray-600 dark:text-gray-300">Estimated total: {costPreview.estimatedTotal.toFixed(2)} (final total is always calculated by server)</div>
              </div>
              <div className="col-span-12 rounded-md border border-blue-200 dark:border-blue-800 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-xs">
                <div className="font-medium text-blue-800 dark:text-blue-200">Bed availability</div>
                {!form.roomId || !form.checkInDate ? (
                  <div className="text-blue-700 dark:text-blue-300">Select room and check-in date to view live bed availability.</div>
                ) : availabilityLoading ? (
                  <div className="text-blue-700 dark:text-blue-300">Checking availability...</div>
                ) : availability ? (
                  <>
                    <div className="text-blue-700 dark:text-blue-300">Room capacity: {selectedRoomOption?.total_beds ?? 0} beds</div>
                    <div className="text-blue-700 dark:text-blue-300">Available in selected period: {availability.availableCount}</div>
                    <div className="text-blue-700 dark:text-blue-300">Unavailable beds: {availability.unavailableBeds.join(', ') || 'None'}</div>
                    <div className="text-blue-700 dark:text-blue-300">Suggested beds: {availability.suggestedBeds.join(', ') || 'None'}</div>
                    <fieldset className="mt-2">
                      <legend className="sr-only">Select available beds</legend>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Available beds">
                        {availability.allBeds.map((bed) => {
                          const isUnavailable = availability.unavailableBeds.includes(bed);
                          const isSelected = selectedBedNumbers.includes(bed);

                          return (
                            <label
                              key={bed}
                              className={`inline-flex items-center ${
                                isUnavailable ? 'cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              title={isUnavailable ? `${bed} is unavailable for selected period` : `Select ${bed}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleBedSelection(bed)}
                                disabled={isUnavailable}
                                aria-label={bed}
                                className="sr-only"
                              />
                              <span
                                className={`px-2 py-1 rounded text-[11px] border ${
                                  isUnavailable
                                    ? 'bg-gray-100 text-gray-400 border-gray-300 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'
                                    : isSelected
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100 dark:bg-gray-800 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/20'
                                }`}
                              >
                                {bed}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={applySuggestedBeds}
                        className="px-2 py-1 rounded bg-blue-600 text-white text-[11px]"
                      >
                        Use Suggested Beds
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBedNumbers([])}
                        className="px-2 py-1 rounded border border-blue-300 text-blue-700 text-[11px] dark:border-blue-700 dark:text-blue-300"
                      >
                        Clear Selection
                      </button>
                      <span className="text-[11px] text-blue-700 dark:text-blue-300">
                        Selected: {selectedBedNumbers.length} / {Math.max(1, Number(form.bedsToBook || 1))}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-rose-700 dark:text-rose-300">Unable to fetch availability right now.</div>
                )}
              </div>
              <div className="col-span-12 flex items-center gap-2 mt-1">
                <input id="booking-active" type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                <label htmlFor="booking-active" className="text-sm">Active</label>
              </div>
              <div className="col-span-12 flex items-center justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-2 text-sm rounded border">Cancel</button>
                <button type="submit" className="px-3 py-2 text-sm rounded bg-blue-600 text-white">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Print Receipt</h3>
              <button onClick={() => setPrintBooking(null)} className="p-1 text-gray-400 hover:text-gray-600" title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="text-gray-700 dark:text-gray-300">Room: <strong>{printBooking.roomNumber}</strong></div>
              <div className="text-gray-700 dark:text-gray-300">Patient: <strong>{printBooking.patientName}</strong></div>
              <div className="text-gray-700 dark:text-gray-300">Total Cost: <strong>{printBooking.totalCost.toFixed(2)}</strong></div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Receipt Size</label>
                <select
                  title="Receipt size"
                  value={receiptSize}
                  onChange={(e) => setReceiptSize(e.target.value as ReceiptSize)}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-xs"
                >
                  <option value="a4">A4 Invoice</option>
                  <option value="58mm">58mm Receipt</option>
                  <option value="76mm">76mm Receipt</option>
                  <option value="80mm">80mm Receipt</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setPrintBooking(null)} className="px-3 py-2 text-xs rounded border">Cancel</button>
                <button
                  onClick={() => {
                    printReceipt(printBooking, receiptSize);
                    setPrintBooking(null);
                  }}
                  className="px-3 py-2 text-xs rounded bg-indigo-600 text-white"
                >
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
