import api from './axios';

export interface PendingCharge {
  id: number;
  module: string;
  module_label: string;
  source_type: string;
  source_id: number;
  title: string;
  reference: string;
  payment_status: 'pending' | 'paid';
  patient_id: number | null;
  patient_name: string | null;
  patient_code: string | null;
  patient_phone: string | null;
  /** True for a retail pharmacy or lab customer with no hospital record. */
  is_walk_in: boolean;
  net_amount: number;
  paid_amount: number;
  due_amount: number;
  currency: string;
  status: string;
  posted_at: string | null;
  collected_at: string | null;
  /** When settled, or when raised if not. What the range filters on. */
  effective_at: string | null;
  supports_partial: boolean;
  can_reverse: boolean;
}

export interface ModuleTally {
  module: string;
  label: string;
  entries: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  /** Same as due_amount; the chips were written against this name. */
  due_total: number;
}

/** Every permitted module added together. Income only — see grandTotal(). */
export interface GrandTotal {
  entries: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
}

/** One pharmacy document type inside the reconciliation sheet. */
export interface PharmacyTypeTally {
  category: 'sales' | 'sales_return' | 'purchase' | 'purchase_return';
  label: string;
  /** Returns are deducted from the family they belong to, never across it. */
  family: 'sales' | 'purchase';
  /** +1 for an invoice, -1 for a return. */
  sign: 1 | -1;
  entries: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
}

export interface PharmacyBreakdown {
  types: PharmacyTypeTally[];
  totals: {
    sales: { label: string; entries: number; total_amount: number; paid_amount: number; due_amount: number };
    purchase: { label: string; entries: number; total_amount: number; paid_amount: number; due_amount: number };
  };
}

export interface PendingResponse {
  data: PendingCharge[];
  meta: { current_page: number; last_page: number; total: number };
  modules: ModuleTally[];
  /** Echoed back so the inputs show the window the server actually applied. */
  range: { from: string; to: string };
  /** Null unless the user may collect pharmacy money. */
  pharmacy_breakdown: PharmacyBreakdown | null;
  grand_total: GrandTotal;
  summary: {
    /** Outstanding inside the chosen window. */
    due_total: number;
    /** Standing debt across all time, so a narrow window cannot hide it. */
    due_total_all: number;
    entries: number;
    collected_in_range: number;
    collected_today: number;
  };
}

export type SortColumn = 'code' | 'name' | 'phone' | 'reference' | 'module' | 'status' | 'amount' | 'date';

export async function listPendingPayments(params: {
  hospital_id?: string | number;
  module?: string;
  search?: string;
  status?: 'all' | 'pending' | 'paid';
  sort?: SortColumn;
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  /** `YYYY-MM-DDTHH:mm`, as produced by a datetime-local input. */
  from?: string;
  to?: string;
}): Promise<PendingResponse> {
  const res = await api.get('/payment-collection/pending', { params });
  return res.data;
}

/**
 * Settle one charge, whichever module it came from.
 *
 * Each module kept its own payment endpoint on purpose -- that is where its
 * permission is enforced and its collector recorded -- but they were written at
 * different times and do not agree on a request body. Appointments, surgery and
 * room bookings take only a method; lab and ultrasound require an explicit
 * paid_amount; pharmacy calls the same field `amount`. Rather than teach the
 * collection screen those dialects, the difference is resolved here, once.
 */
export async function settlePendingCharge(
  charge: PendingCharge,
  options: { amount?: number; paymentMethod?: string } = {}
) {
  const method = options.paymentMethod || 'cash';
  // Anything not part-payable is settled in full: offering a smaller figure on
  // a module that cannot record one would leave the till and the document
  // disagreeing about what was taken.
  const amount = charge.supports_partial
    ? Math.min(Math.max(options.amount ?? charge.due_amount, 0), charge.due_amount)
    : charge.due_amount;

  switch (charge.source_type) {
    case 'appointment':
      return api.post(`/appointments/${charge.source_id}/payment`, { payment_method: method });

    case 'patient_surgery':
      return api.post(`/patient-surgeries/${charge.source_id}/payment`, { payment_method: method });

    case 'room_booking':
      return api.post(`/room-bookings/${charge.source_id}/payment`, { payment_method: method });

    case 'lab_order':
      return api.post(`/lab-orders/${charge.source_id}/payment`, {
        paid_amount: amount,
        payment_method: method,
      });

    case 'ultrasound_exam':
      return api.post(`/ultrasound-exams/${charge.source_id}/payment`, {
        paid_amount: amount,
        payment_method: method,
      });

    case 'xray_receipt':
      return api.post(`/xray-receipts/${charge.source_id}/payment`, {
        paid_amount: amount,
        payment_method: method,
      });

    case 'transaction':
      return api.post(`/pharmacy-finance/${charge.source_id}/payment`, {
        amount,
        payment_method: method,
      });

    default:
      throw new Error(`No payment route for ${charge.source_type}`);
  }
}

/**
 * Undo a collection, whichever module it came from.
 *
 * Kept apart from settlePendingCharge because it is a different right, not a
 * different argument: a collector takes money, a supervisor puts it back. The
 * endpoints are as inconsistent as the payment ones -- three spell it
 * /payment/reverse, lab says reset-payment, ultrasound reverse-payment, and
 * pharmacy has no reverse route at all, only a status change that checks
 * reverse_finance_payment internally.
 *
 * Lab, ultrasound and X-Ray REQUIRE a reason -- reversing a collection is the one
 * action on this screen that money can disappear through, so it is recorded
 * against the person who did it. The others accept it harmlessly, and
 * pharmacy keeps it as the finance note.
 */
export async function reversePendingCharge(charge: PendingCharge, reason: string) {
  switch (charge.source_type) {
    case 'appointment':
      return api.post(`/appointments/${charge.source_id}/payment/reverse`, { reason });

    case 'patient_surgery':
      return api.post(`/patient-surgeries/${charge.source_id}/payment/reverse`, { reason });

    case 'room_booking':
      return api.post(`/room-bookings/${charge.source_id}/payment/reverse`, { reason });

    case 'lab_order':
      return api.post(`/lab-orders/${charge.source_id}/reset-payment`, { reason });

    case 'ultrasound_exam':
      return api.post(`/ultrasound-exams/${charge.source_id}/reverse-payment`, { reason });

    case 'xray_receipt':
      return api.post(`/xray-receipts/${charge.source_id}/reverse-payment`, { reason });

    case 'transaction':
      return api.put(`/pharmacy-finance/${charge.source_id}/status`, { payment_status: 'pending', finance_note: reason });

    default:
      throw new Error(`No reversal route for ${charge.source_type}`);
  }
}
