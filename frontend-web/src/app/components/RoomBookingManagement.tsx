import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, X, Printer, Eye, CalendarCheck } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { listRoomBookings, createRoomBooking, updateRoomBooking, deleteRoomBooking, listRooms, getRoomBookingAvailability } from '../../api/rooms';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { ModalOverlay, ModalPanel, DetailModalHeader, DetailRow } from './ui/ModalParts';
import { TabActionsSlot, useIsEmbedded } from './TabbedModulePage';
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

type ReceiptSize = 'a4' | 'a5' | '58mm' | '76mm' | '80mm';

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
  const { t } = useTranslation();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const { getPrintPaperSize, loadHospitalSetting } = useSettings();
  const { hospitals } = useHospitals();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { hasPermission } = useAuth();
  const embedded = useIsEmbedded();
  const canAdd = hasPermission('add_room_bookings') || hasPermission('manage_room_bookings');
  const canEdit = hasPermission('edit_room_bookings') || hasPermission('manage_room_bookings');
  const canDelete = hasPermission('delete_room_bookings') || hasPermission('manage_room_bookings');

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
  const [viewing, setViewing] = useState<BookingItem | null>(null);
  const [receiptSize, setReceiptSize] = useState<ReceiptSize>(() => {
    const saved = localStorage.getItem('room_booking_receipt_size');
    if (saved === '58mm' || saved === '76mm' || saved === '80mm' || saved === 'a4') return saved;
    return '80mm';
  });

  // The hospital-wide paper size (Settings > General > Print Settings) is the source of
  // truth; it overrides the remembered per-user choice when the hospital changes.
  const configuredPaperSize = getPrintPaperSize(currentHospital.id, 'room_booking_receipt');
  useEffect(() => {
    loadHospitalSetting(currentHospital.id);
  }, [currentHospital.id, loadHospitalSetting]);
  useEffect(() => {
    setReceiptSize(configuredPaperSize as ReceiptSize);
  }, [configuredPaperSize, currentHospital.id]);
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
    const isCompactReceipt = size !== 'a4' && size !== 'a5';
    const ticketWidth = isCompactReceipt ? size : (size === 'a5' ? '128mm' : '190mm');
    const pageRule = isCompactReceipt
      ? `@page { size: ${size} auto; margin: 0; }`
      : `@page { size: ${size === 'a5' ? 'A5' : 'A4'}; margin: 10mm; }`;
    const nights = item.checkOutDate
      ? Math.max(1, Math.ceil((new Date(item.checkOutDate).getTime() - new Date(item.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 1;

    const receiptHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Room Booking Receipt</title>
    <style>
      :root {
        --brand-color: ${brandColor};
      }
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: #111827;
        margin: 0;
        background: ${isCompactReceipt ? '#ffffff' : '#f3f4f6'};
        padding: ${isCompactReceipt ? '0' : '20px'};
        line-height: 1.5;
        ${pageRule}
      }
      * { box-sizing: border-box; }
      .ticket {
        width: ${ticketWidth};
        margin: 0 auto;
        background: #ffffff;
        border: ${isCompactReceipt ? 'none' : '1px solid #e5e7eb'};
        border-radius: ${isCompactReceipt ? '0' : '8px'};
        overflow: hidden;
        box-shadow: ${isCompactReceipt ? 'none' : '0 10px 25px -5px rgba(0, 0, 0, 0.1)'};
        page-break-inside: avoid;
      }
      .head {
        background-color: ${isCompactReceipt ? 'transparent' : 'var(--brand-color)'};
        color: ${isCompactReceipt ? '#111827' : '#ffffff'};
        text-align: center;
        padding: ${isCompactReceipt ? '12px 8px 8px' : '24px 20px'};
        ${isCompactReceipt ? 'border-bottom: 2px dashed #d1d5db;' : ''}
        page-break-inside: avoid;
      }
      .logo {
        max-width: ${isCompactReceipt ? '36mm' : '50mm'};
        max-height: ${isCompactReceipt ? '16mm' : '24mm'};
        object-fit: contain;
        margin: 0 auto 10px;
        display: block;
        ${!isCompactReceipt ? 'filter: brightness(0) invert(1);' : ''}
      }
      .hospital {
        font-size: ${isCompactReceipt ? '14px' : '20px'};
        font-weight: 800;
        margin-bottom: 4px;
      }
      .meta {
        font-size: ${isCompactReceipt ? '10px' : '13px'};
        color: ${isCompactReceipt ? '#4b5563' : 'rgba(255, 255, 255, 0.9)'};
        line-height: 1.4;
      }
      .title-banner {
        text-align: center;
        padding: ${isCompactReceipt ? '10px 0' : '16px 0'};
        background: ${isCompactReceipt ? 'transparent' : '#f8fafc'};
        border-bottom: 1px solid ${isCompactReceipt ? 'transparent' : '#e5e7eb'};
      }
      .title {
        font-size: ${isCompactReceipt ? '12px' : '15px'};
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: ${isCompactReceipt ? 'var(--brand-color)' : '#475569'};
        margin: 0;
      }
      .content { padding: ${isCompactReceipt ? '12px' : '24px'}; }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: ${isCompactReceipt ? '4px 0' : '8px 0'};
        border-bottom: 1px dotted #e5e7eb;
        font-size: ${isCompactReceipt ? '11px' : '13px'};
        page-break-inside: avoid;
      }
      .row:last-child { border-bottom: none; }
      .key { color: #6b7280; text-align: left; flex: 1; font-weight: 500; }
      .val { text-align: right; font-weight: 600; flex: 1.5; color: #111827; word-break: break-word; }
      .amount-card {
        margin-top: ${isCompactReceipt ? '16px' : '24px'};
        background: ${isCompactReceipt ? 'transparent' : '#f8fafc'};
        border-radius: ${isCompactReceipt ? '0' : '8px'};
        padding: ${isCompactReceipt ? '12px 0 0' : '16px'};
        border-top: ${isCompactReceipt ? '2px dashed #d1d5db' : '1px solid #e5e7eb'};
        page-break-inside: avoid;
      }
      .amount-card .row { border-bottom: none; padding: ${isCompactReceipt ? '3px 0' : '6px 0'}; }
      .amount-card .total-row {
        margin-top: ${isCompactReceipt ? '6px' : '10px'};
        padding-top: ${isCompactReceipt ? '8px' : '12px'};
        border-top: ${isCompactReceipt ? '1px solid #000' : '2px solid #e2e8f0'};
      }
      .amount-card .total-key { font-size: ${isCompactReceipt ? '13px' : '16px'}; font-weight: 700; color: #0f172a; }
      .amount-card .total-val { font-size: ${isCompactReceipt ? '15px' : '20px'}; font-weight: 800; color: var(--brand-color); }
      .footer {
        margin-top: ${isCompactReceipt ? '16px' : '24px'};
        padding: ${isCompactReceipt ? '12px 0' : '20px'};
        text-align: center;
        font-size: ${isCompactReceipt ? '9px' : '11px'};
        color: #64748b;
        background-color: ${isCompactReceipt ? 'transparent' : '#f8fafc'};
        border-top: ${isCompactReceipt ? '1px dashed #d1d5db' : '1px solid #e5e7eb'};
        page-break-inside: avoid;
      }
      @media print {
        html, body {
          width: ${ticketWidth};
          background: #ffffff;
          padding: 0 !important;
          margin: 0 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          height: auto;
        }
        .ticket {
          box-shadow: none;
          border: none;
          border-radius: 0;
          width: ${ticketWidth};
          margin: 0;
          padding: 0;
          page-break-inside: avoid;
        }
        .head { page-break-inside: avoid; }
        .row, .amount-card, .footer { page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="ticket">
      <div class="head">
        ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Hospital Logo" />` : ''}
        <div class="hospital">${hospitalInfo.name}</div>
        <div class="meta">${hospitalInfo.address || ''}</div>
        <div class="meta">${hospitalInfo.phone || ''}</div>
      </div>
      
      <div class="title-banner">
        <h1 class="title">Room Booking Receipt</h1>
      </div>
      
      ${!isCompactReceipt && item.patientName ? `<div class="row" style="border: none; padding: 0;"><div class="val" style="text-align: center; color: var(--brand-color); font-size: 14px;">Patient: ${item.patientName}</div></div>` : ''}
      
      <div class="content">
        <div class="row">
          <div class="key">Receipt Date</div>
          <div class="val">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
        <div class="row">
          <div class="key">Patient Name</div>
          <div class="val">${item.patientName}</div>
        </div>
        <div class="row">
          <div class="key">Room No.</div>
          <div class="val">${item.roomNumber || 'N/A'}</div>
        </div>
        <div class="row">
          <div class="key">Attending Doctor</div>
          <div class="val">${item.doctorName || 'N/A'}</div>
        </div>
        <div class="row">
          <div class="key">Check In</div>
          <div class="val">${new Date(item.checkInDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</div>
        </div>
        <div class="row">
          <div class="key">Check Out</div>
          <div class="val">${item.checkOutDate ? new Date(item.checkOutDate).toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'Open'}</div>
        </div>
        <div class="row">
          <div class="key">Status</div>
          <div class="val">${item.status}</div>
        </div>
        <div class="row">
          <div class="key">Payment</div>
          <div class="val">${item.paymentStatus}</div>
        </div>

        <div class="amount-card">
          <div class="row total-row">
            <div class="key total-key">Total Amount</div>
            <div class="val total-val">${(item.totalCost || 0).toFixed(2)}</div>
          </div>
        </div>

      </div>
      <div class="footer">
        Generated by <strong>${hospitalInfo.name}</strong><br/>
        Powered by ShifaaScript HMIS
      </div>
    </div>
    <script>
      window.onload = function() { 
        setTimeout(function() {
          window.print(); 
          window.close(); 
        }, 200);
      }
    </script>
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
    <div className={embedded ? 'space-y-2' : 'space-y-3'}>
      {!embedded && (
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Room Booking</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Track patient room bookings and occupancy status.</p>
        </div>
      )}

      <TabActionsSlot>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bookings..."
              aria-label="Search bookings"
              className="w-44 pl-8 pr-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button onClick={loadBookings} className="px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs">{t('ui.refresh')}</button>
          {canAdd && (
            <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Booking
            </button>
          )}
        </div>
      </TabActionsSlot>

      {!embedded && (
        <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />
      )}

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        Workflow: Pending to Confirmed to Checked-in to Checked-out. Final cost is calculated by server based on room price, bed count, stay duration, and discount.
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2">{t('table.room')}</th>
                <th className="px-4 py-2">{t('table.patient')}</th>
                <th className="px-4 py-2">{t('table.dates')}</th>
                <th className="px-4 py-2">{t('table.nights')}</th>
                <th className="px-4 py-2">{t('table.beds')}</th>
                <th className="px-4 py-2">{t('table.bedNumbers')}</th>
                <th className="px-4 py-2">{t('table.cost')}</th>
                <th className="px-4 py-2">{t('table.status')}</th>
                <th className="px-4 py-2 text-center">{t('table.actions')}</th>
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
                      <button onClick={() => setViewing(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md" title={t('ui.view')}><Eye className="w-4 h-4" /></button>
                      {canEdit && (<button onClick={() => openEdit(item)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md" title={t('ui.edit')}><Pencil className="w-4 h-4" /></button>)}
                      {canDelete && (<button onClick={() => removeBooking(item.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md" title={t('ui.delete')}><Trash2 className="w-4 h-4" /></button>)}
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
            >{t('ui.prev')}</button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >{t('ui.next')}</button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{editing ? 'Edit Booking' : 'Add Booking'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title={t('ui.close')}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitForm} className="p-5 grid grid-cols-12 gap-3">
              {userRole === 'super_admin' && selectedHospitalId === 'all' && (
                <div className="col-span-12">
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.hospital')}</label>
                  <select
                    title={t('ui.hospital')}
                    value={form.hospitalId}
                    onChange={(e) => setForm((p) => ({ ...p, hospitalId: e.target.value, roomId: '', patientId: '', doctorId: '' }))}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  >
                    {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Room</label>
                <select title="Room" value={form.roomId} onChange={(e) => setForm((p) => ({ ...p, roomId: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all">
                  <option value="">Select room</option>
                  {filteredRooms.map((r) => <option key={r.id} value={r.id}>{r.roomNumber}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.patient')}</label>
                <select title={t('ui.patient')} value={form.patientId} onChange={(e) => setForm((p) => ({ ...p, patientId: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all">
                  <option value="">Select patient</option>
                  {filteredPatients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Doctor (optional)</label>
                <select title={t('ui.doctor')} value={form.doctorId} onChange={(e) => setForm((p) => ({ ...p, doctorId: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all">
                  <option value="">None</option>
                  {filteredDoctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Booking Date</label>
                <input title="Booking date" type="date" value={form.bookingDate} onChange={(e) => setForm((p) => ({ ...p, bookingDate: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Check In</label>
                <input title="Check in date" type="date" value={form.checkInDate} onChange={(e) => setForm((p) => ({ ...p, checkInDate: e.target.value }))} required className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Check Out</label>
                <input title="Check out date" type="date" value={form.checkOutDate} onChange={(e) => setForm((p) => ({ ...p, checkOutDate: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Selected Beds</label>
                <input title="Selected beds" value={selectedBedNumbers.join(', ')} readOnly className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Beds To Book</label>
                <input title="Beds to book" type="number" min={1} value={form.bedsToBook} onChange={(e) => setForm((p) => ({ ...p, bedsToBook: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              {(hasPermission('add_discounts') || hasPermission('manage_discounts')) && (
                <div className="col-span-12 md:col-span-4">
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Discount (%)</label>
                  <input title="Discount percent" type="number" min={0} max={100} step="1" value={form.discountPercent} onChange={(e) => setForm((p) => ({ ...p, discountPercent: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
                </div>
              )}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.status')}</label>
                <select title="Booking status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as BookingItem['status'] }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all">
                  <option value="Pending">{t('ui.pending')}</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Checked-in">Checked-in</option>
                  <option value="Checked-out">Checked-out</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.paymentStatus')}</label>
                <select title="Payment status" value={form.paymentStatus} onChange={(e) => setForm((p) => ({ ...p, paymentStatus: e.target.value as BookingItem['paymentStatus'] }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all">
                  <option value="pending">pending</option>
                  <option value="paid">paid</option>
                  <option value="partial">partial</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Remarks</label>
                <input title="Remarks" value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
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
                <label htmlFor="booking-active" className="text-sm">{t('ui.active')}</label>
              </div>
              <div className="col-span-12 flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
                <button type="submit" className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs disabled:opacity-60 disabled:cursor-not-allowed">{editing ? t('ui.update') : t('ui.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('ui.printReceipt')}</h3>
              <button onClick={() => setPrintBooking(null)} className="p-1 text-gray-400 hover:text-gray-600" title={t('ui.close')}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="text-gray-700 dark:text-gray-300">Room: <strong>{printBooking.roomNumber}</strong></div>
              <div className="text-gray-700 dark:text-gray-300">Patient: <strong>{printBooking.patientName}</strong></div>
              <div className="text-gray-700 dark:text-gray-300">Total Cost: <strong>{printBooking.totalCost.toFixed(2)}</strong></div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Receipt Size</label>
                <select
                  title="Receipt size"
                  value={receiptSize}
                  onChange={(e) => setReceiptSize(e.target.value as ReceiptSize)}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="a4">A4 Invoice</option>
                  <option value="a5">A5 Invoice</option>
                  <option value="58mm">58mm Receipt</option>
                  <option value="76mm">76mm Receipt</option>
                  <option value="80mm">80mm Receipt</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setPrintBooking(null)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
                <button
                  onClick={() => {
                    printReceipt(printBooking, receiptSize);
                    setPrintBooking(null);
                  }}
                  className="px-3 py-2 text-xs rounded bg-indigo-600 text-white"
                >{t('ui.printReceipt')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ModalOverlay open={!!viewing}>
        <ModalPanel size="md" scroll>
          <DetailModalHeader
            title="Booking Details"
            icon={<CalendarCheck className="w-4 h-4" />}
            gradient="from-blue-600 to-blue-700"
            onClose={() => setViewing(null)}
          />
          {viewing && (
            <div className="p-4 space-y-3">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{viewing.patientName}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">Room {viewing.roomNumber}</p>
              </div>
              <div>
                <DetailRow label={t('ui.patient')} value={viewing.patientName} />
                <DetailRow label={t('ui.doctor')} value={viewing.doctorName || '—'} />
                <DetailRow label="Room" value={viewing.roomNumber} />
                <DetailRow label="Bed(s)" value={viewing.bedNumber || '—'} />
                <DetailRow label="Beds Booked" value={viewing.bedsToBook} />
                <DetailRow label="Check In" value={viewing.checkInDate || '—'} />
                <DetailRow label="Check Out" value={viewing.checkOutDate || '—'} />
                <DetailRow label={t('ui.discount')} value={viewing.discountAmount.toFixed(2)} />
                <DetailRow label="Total Cost" value={viewing.totalCost.toFixed(2)} />
                <DetailRow label={t('ui.status')} value={viewing.status} />
                <DetailRow label={t('ui.payment')} value={viewing.paymentStatus} />
                <DetailRow label={t('ui.remarks')} value={viewing.remarks || '—'} />
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                {canEdit && (
                  <button
                    onClick={() => { const b = viewing; setViewing(null); openEdit(b); }}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs"
                  >{t('ui.edit')}</button>
                )}
                <button
                  onClick={() => setViewing(null)}
                  className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                >{t('ui.close')}</button>
              </div>
            </div>
          )}
        </ModalPanel>
      </ModalOverlay>
    </div>
  );
}
