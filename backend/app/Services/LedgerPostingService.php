<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Expense;
use App\Models\LabOrder;
use App\Models\LedgerEntry;
use App\Models\PatientSurgery;
use App\Models\RoomBooking;
use App\Models\Transaction;

class LedgerPostingService
{
    public function upsertAppointmentSnapshot(Appointment $appointment): LedgerEntry
    {
        $netAmount = (float) ($appointment->total_amount ?? 0);
        [$paidAmount, $dueAmount] = $this->resolveUntrackedPaymentSplit($netAmount, (string) ($appointment->payment_status ?? 'pending'));

        return $this->upsertSnapshot(
            (int) $appointment->hospital_id,
            'appointment',
            (int) $appointment->id,
            [
                'entry_direction' => 'income',
                'module' => 'appointments',
                'category' => 'consultation',
                'title' => 'Appointment #' . (string) ($appointment->appointment_number ?? $appointment->id),
                'patient_id' => $appointment->patient_id ? (int) $appointment->patient_id : null,
                'supplier_id' => null,
                'amount' => (float) ($appointment->original_fee_amount ?? $netAmount),
                'discount_amount' => (float) ($appointment->discount_amount ?? 0),
                'tax_amount' => 0,
                'net_amount' => $netAmount,
                'paid_amount' => $paidAmount,
                'due_amount' => $dueAmount,
                'status' => (string) ($appointment->payment_status ?? 'pending'),
                'currency' => (string) ($appointment->currency ?? 'AFN'),
                'posted_at' => $appointment->appointment_date ?? $appointment->created_at ?? now(),
                'posted_by' => null,
                'voided_at' => null,
                'metadata' => [
                    'appointment_status' => $appointment->status,
                    'doctor_id' => $appointment->doctor_id,
                ],
            ]
        );
    }

    public function voidAppointmentSnapshot(Appointment $appointment, ?string $actor = null): void
    {
        $this->voidSnapshot((int) $appointment->hospital_id, 'appointment', (int) $appointment->id, $actor);
    }

    public function upsertLabOrderSnapshot(LabOrder $labOrder): LedgerEntry
    {
        $netAmount = (float) ($labOrder->total_amount ?? 0);
        $discountAmount = (float) ($labOrder->discount_amount ?? 0);
        $grossAmount = max(0, $netAmount + $discountAmount);
        $paidAmount = min((float) ($labOrder->paid_amount ?? 0), $netAmount);
        $dueAmount = max(0, $netAmount - $paidAmount);

        return $this->upsertSnapshot(
            (int) $labOrder->hospital_id,
            'lab_order',
            (int) $labOrder->id,
            [
                'entry_direction' => 'income',
                'module' => 'laboratory',
                'category' => 'lab_test',
                'title' => 'Lab Order #' . (string) ($labOrder->order_number ?? $labOrder->id),
                'patient_id' => $labOrder->patient_id ? (int) $labOrder->patient_id : null,
                'supplier_id' => null,
                'amount' => $grossAmount,
                'discount_amount' => $discountAmount,
                'tax_amount' => 0,
                'net_amount' => $netAmount,
                'paid_amount' => $paidAmount,
                'due_amount' => $dueAmount,
                'status' => (string) ($labOrder->payment_status ?? 'pending'),
                'currency' => 'AFN',
                'posted_at' => $labOrder->created_at ?? now(),
                'posted_by' => $labOrder->updated_by ?? $labOrder->created_by,
                'voided_at' => null,
                'metadata' => [
                    'order_status' => $labOrder->status,
                    'doctor_id' => $labOrder->doctor_id,
                    'is_walk_in' => (bool) ($labOrder->is_walk_in ?? false),
                    'payment_method' => $labOrder->payment_method,
                ],
            ]
        );
    }

    public function voidLabOrderSnapshot(LabOrder $labOrder, ?string $actor = null): void
    {
        $this->voidSnapshot((int) $labOrder->hospital_id, 'lab_order', (int) $labOrder->id, $actor);
    }

    public function upsertRoomBookingSnapshot(RoomBooking $booking): LedgerEntry
    {
        $netAmount = (float) ($booking->total_cost ?? 0);
        [$paidAmount, $dueAmount] = $this->resolveUntrackedPaymentSplit($netAmount, (string) ($booking->payment_status ?? 'pending'));

        return $this->upsertSnapshot(
            (int) $booking->hospital_id,
            'room_booking',
            (int) $booking->id,
            [
                'entry_direction' => 'income',
                'module' => 'room_booking',
                'category' => 'room_fee',
                'title' => 'Room Booking #' . (string) $booking->id,
                'patient_id' => $booking->patient_id ? (int) $booking->patient_id : null,
                'supplier_id' => null,
                'amount' => $netAmount,
                'discount_amount' => (float) ($booking->discount_amount ?? 0),
                'tax_amount' => 0,
                'net_amount' => $netAmount,
                'paid_amount' => $paidAmount,
                'due_amount' => $dueAmount,
                'status' => (string) ($booking->payment_status ?? 'pending'),
                'currency' => 'AFN',
                'posted_at' => $booking->booking_date ?? $booking->created_at ?? now(),
                'posted_by' => $booking->updated_by ?? $booking->created_by,
                'voided_at' => null,
                'metadata' => [
                    'room_id' => $booking->room_id,
                    'doctor_id' => $booking->doctor_id,
                    'booking_status' => $booking->status,
                    'beds_to_book' => $booking->beds_to_book,
                    'bed_number' => $booking->bed_number,
                ],
            ]
        );
    }

    public function voidRoomBookingSnapshot(RoomBooking $booking, ?string $actor = null): void
    {
        $this->voidSnapshot((int) $booking->hospital_id, 'room_booking', (int) $booking->id, $actor);
    }

    public function upsertPatientSurgerySnapshot(PatientSurgery $patientSurgery): LedgerEntry
    {
        $netAmount = (float) ($patientSurgery->cost ?? 0);
        [$paidAmount, $dueAmount] = $this->resolveUntrackedPaymentSplit($netAmount, (string) ($patientSurgery->payment_status ?? 'pending'));

        return $this->upsertSnapshot(
            (int) $patientSurgery->hospital_id,
            'patient_surgery',
            (int) $patientSurgery->id,
            [
                'entry_direction' => 'income',
                'module' => 'surgery',
                'category' => 'surgery_fee',
                'title' => 'Patient Surgery #' . (string) $patientSurgery->id,
                'patient_id' => $patientSurgery->patient_id ? (int) $patientSurgery->patient_id : null,
                'supplier_id' => null,
                'amount' => $netAmount,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'net_amount' => $netAmount,
                'paid_amount' => $paidAmount,
                'due_amount' => $dueAmount,
                'status' => (string) ($patientSurgery->payment_status ?? 'pending'),
                'currency' => 'AFN',
                'posted_at' => $patientSurgery->surgery_date ?? $patientSurgery->created_at ?? now(),
                'posted_by' => $patientSurgery->updated_by ?? $patientSurgery->created_by,
                'voided_at' => null,
                'metadata' => [
                    'doctor_id' => $patientSurgery->doctor_id,
                    'surgery_id' => $patientSurgery->surgery_id,
                    'surgery_status' => $patientSurgery->status,
                ],
            ]
        );
    }

    public function voidPatientSurgerySnapshot(PatientSurgery $patientSurgery, ?string $actor = null): void
    {
        $this->voidSnapshot((int) $patientSurgery->hospital_id, 'patient_surgery', (int) $patientSurgery->id, $actor);
    }

    public function upsertTransactionSnapshot(Transaction $transaction): LedgerEntry
    {
        $direction = match ((string) $transaction->trx_type) {
            'sales', 'purchase_return' => 'income',
            'purchase', 'sales_return' => 'expense',
            default => 'adjustment',
        };

        $status = (float) $transaction->due_amount > 0
            ? ((float) $transaction->paid_amount > 0 ? 'partial' : 'pending')
            : 'paid';

        return $this->upsertSnapshot(
            (int) $transaction->hospital_id,
            'transaction',
            (int) $transaction->id,
            [
                'entry_direction' => $direction,
                'module' => 'pharmacy',
                'category' => (string) $transaction->trx_type,
                'title' => 'Transaction #' . (string) ($transaction->serial_no ?? $transaction->id),
                'patient_id' => $transaction->patient_id ? (int) $transaction->patient_id : null,
                'supplier_id' => $transaction->supplier_id ? (int) $transaction->supplier_id : null,
                'amount' => (float) $transaction->grand_total,
                'discount_amount' => (float) ($transaction->total_discount ?? 0),
                'tax_amount' => (float) ($transaction->total_tax ?? 0),
                'net_amount' => (float) $transaction->grand_total,
                'paid_amount' => (float) ($transaction->paid_amount ?? 0),
                'due_amount' => (float) ($transaction->due_amount ?? 0),
                'status' => $status,
                'posted_at' => $transaction->created_at ?? now(),
                'posted_by' => $transaction->updated_by ?? $transaction->created_by,
                'voided_at' => null,
                'metadata' => [
                    'trx_type' => $transaction->trx_type,
                    'serial_no' => $transaction->serial_no,
                ],
            ]
        );
    }

    public function voidTransactionSnapshot(Transaction $transaction, ?string $actor = null): void
    {
        $this->voidSnapshot((int) $transaction->hospital_id, 'transaction', (int) $transaction->id, $actor);
    }

    public function upsertExpenseSnapshot(Expense $expense): LedgerEntry
    {
        return $this->upsertSnapshot(
            (int) $expense->hospital_id,
            'expense',
            (int) $expense->id,
            [
                'entry_direction' => 'expense',
                'module' => 'expenses',
                'category' => $expense->category?->name,
                'title' => (string) $expense->title,
                'patient_id' => null,
                'supplier_id' => null,
                'amount' => (float) $expense->amount,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'net_amount' => (float) $expense->amount,
                'paid_amount' => (float) $expense->amount,
                'due_amount' => 0,
                'status' => (string) $expense->status,
                'posted_at' => $expense->expense_date ?? $expense->created_at ?? now(),
                'posted_by' => $expense->updated_by ?? $expense->created_by,
                'voided_at' => null,
                'metadata' => [
                    'expense_category_id' => $expense->expense_category_id,
                    'sequence_id' => $expense->sequence_id,
                    'reference' => $expense->reference,
                    'payment_method' => $expense->payment_method,
                ],
            ]
        );
    }

    public function voidExpenseSnapshot(Expense $expense, ?string $actor = null): void
    {
        $this->voidSnapshot((int) $expense->hospital_id, 'expense', (int) $expense->id, $actor);
    }

    private function upsertSnapshot(int $hospitalId, string $sourceType, int $sourceId, array $values): LedgerEntry
    {
        return LedgerEntry::updateOrCreate(
            [
                'hospital_id' => $hospitalId,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'event_type' => 'snapshot',
                'revision' => 1,
            ],
            array_merge([
                'currency' => 'AFN',
            ], $values)
        );
    }

    private function voidSnapshot(int $hospitalId, string $sourceType, int $sourceId, ?string $actor = null): void
    {
        LedgerEntry::query()
            ->where('hospital_id', $hospitalId)
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->where('event_type', 'snapshot')
            ->where('revision', 1)
            ->update([
                'status' => 'voided',
                'voided_at' => now(),
                'posted_by' => $actor,
                'due_amount' => 0,
            ]);
    }

    private function resolveUntrackedPaymentSplit(float $netAmount, string $paymentStatus): array
    {
        $status = strtolower($paymentStatus);

        if ($status === 'paid') {
            return [$netAmount, 0.0];
        }

        if ($status === 'cancelled' || $status === 'voided') {
            return [0.0, 0.0];
        }

        // For modules without explicit paid_amount, keep due conservative to avoid overstating cash-in.
        return [0.0, $netAmount];
    }
}
