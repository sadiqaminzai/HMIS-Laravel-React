import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../api/axios';
import { Hospital, Transaction } from '../../types';

interface VerificationResponse {
  transaction: any;
  hospital: any;
  patient?: any | null;
  supplier?: any | null;
}

const mapHospital = (h: any): Hospital => ({
  id: String(h.id),
  name: h.name,
  code: h.code ?? h.slug ?? '',
  address: h.address ?? '',
  phone: h.phone ?? '',
  email: h.email ?? '',
  license: h.license ?? '',
  licenseIssueDate: h.license_issue_date ?? '',
  licenseExpiryDate: h.license_expiry_date ?? '',
  status: (h.status ?? 'active') as Hospital['status'],
  logo: h.logo_url ?? h.logo_path ?? '',
  brandColor: h.brand_color ?? '#2563eb',
  createdAt: h.created_at ? new Date(h.created_at) : undefined,
});

const mapTransaction = (t: any): Transaction => ({
  id: String(t.id),
  hospitalId: String(t.hospital_id),
  serialNo: t.serial_no !== undefined && t.serial_no !== null ? Number(t.serial_no) : undefined,
  supplierId: t.supplier_id !== undefined && t.supplier_id !== null ? String(t.supplier_id) : undefined,
  supplierName: t.supplier_name ?? undefined,
  patientId: t.patient_id !== undefined && t.patient_id !== null ? String(t.patient_id) : undefined,
  patientName: t.patient_name ?? undefined,
  trxType: (t.trx_type ?? 'purchase') as Transaction['trxType'],
  grandTotal: Number(t.grand_total ?? 0),
  totalDiscount: Number(t.total_discount ?? 0),
  totalTax: Number(t.total_tax ?? 0),
  paidAmount: Number(t.paid_amount ?? 0),
  dueAmount: Number(t.due_amount ?? 0),
  verificationToken: t.verification_token ?? undefined,
  createdBy: t.created_by ?? undefined,
  updatedBy: t.updated_by ?? undefined,
  createdAt: t.created_at ? new Date(t.created_at) : undefined,
  updatedAt: t.updated_at ? new Date(t.updated_at) : undefined,
  details: Array.isArray(t.details)
    ? t.details.map((d: any) => ({
        id: String(d.id),
        trxId: String(d.trx_id ?? d.trxId ?? d.transaction_id ?? ''),
        medicineId: String(d.medicine_id ?? ''),
        medicineName: d.medicine?.brand_name ?? d.medicine_name ?? 'Medicine',
        batchNo: d.batch_no ?? undefined,
        expiryDate: d.expiry_date ? new Date(d.expiry_date) : undefined,
        qtty: Number(d.qtty ?? 0),
        bonus: Number(d.bonus ?? 0),
        price: Number(d.price ?? 0),
        discount: Number(d.discount ?? 0),
        tax: Number(d.tax ?? 0),
        amount: Number(d.amount ?? 0),
      }))
    : [],
});

export function TransactionVerificationPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<VerificationResponse | null>(null);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    api
      .get(`/verify/transactions/${token}`)
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setPayload(data);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Unable to verify this transaction.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const hospital = payload?.hospital ? mapHospital(payload.hospital) : null;
  const transaction = payload?.transaction ? mapTransaction(payload.transaction) : null;

  const formattedType = useMemo(() => {
    if (!transaction) return '';
    return transaction.trxType.replace('_', ' ').toUpperCase();
  }, [transaction]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-600">Loading verification...</div>
      </div>
    );
  }

  if (error || !transaction || !hospital) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-600">{error || 'Verification not found.'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-blue-600">
          <h1 className="text-white font-semibold text-lg">Verified Transaction</h1>
          <p className="text-white/85 text-xs mt-0.5">{hospital.name}</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Invoice</p>
              <p className="font-semibold text-gray-900">#{transaction.serialNo ?? transaction.id}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Type</p>
              <p className="font-semibold text-gray-900">{formattedType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Date</p>
              <p className="font-semibold text-gray-900">{transaction.createdAt ? transaction.createdAt.toLocaleString() : '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Patient</p>
              <p className="font-semibold text-gray-900">{transaction.patientName || payload?.patient?.name || 'Walk-in Customer'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Supplier</p>
              <p className="font-semibold text-gray-900">{transaction.supplierName || payload?.supplier?.name || '-'}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Medicine</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(transaction.details || []).map((detail) => (
                  <tr key={detail.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{detail.medicineName || 'Medicine'}</td>
                    <td className="px-3 py-2 text-right">{detail.qtty}</td>
                    <td className="px-3 py-2 text-right">{Number(detail.price || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{Number(detail.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
                {(transaction.details || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-500">No item details found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Grand Total</p>
              <p className="font-semibold text-gray-900">{transaction.grandTotal.toFixed(2)}</p>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Paid</p>
              <p className="font-semibold text-green-700">{transaction.paidAmount.toFixed(2)}</p>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Due</p>
              <p className="font-semibold text-red-700">{transaction.dueAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
