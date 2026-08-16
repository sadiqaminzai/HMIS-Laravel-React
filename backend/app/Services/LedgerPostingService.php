<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Expense;
use App\Models\LabOrder;
use App\Models\LedgerEntry;
use App\Models\OtherIncome;
use App\Models\PayrollBatch;
use App\Models\PayrollItem;
use App\Models\PatientSurgery;
use App\Models\RoomBooking;
use App\Models\Transaction;
use App\Models\UltrasoundExam;

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
                // Every other module records who took the money; appointments
                // hardcoded null, so registration fees could never be attributed
                // to the desk that collected them and landed in the handover
                // report's Unattributed row for ever.
                'posted_by' => $appointment->updated_by ?? $appointment->created_by,
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

    /**
     * Radiology / ultrasound income.
     *
     * This was never posted, so ultrasound fees were invisible to every
     * financial report and to the dashboard's Revenue -- money the hospital had
     * genuinely earned simply did not appear anywhere.
     *
     * Settlement now comes from the exam's own payment_status, set when
     * reception takes the money. It previously had to be inferred from the
     * clinical status, which meant an exam reported before it was paid for
     * counted as collected income.
     */
    public function upsertUltrasoundExamSnapshot(UltrasoundExam $exam): LedgerEntry
    {
        $netAmount = (float) ($exam->fee ?? 0);
        $isSettled = (string) $exam->payment_status === 'paid';

        return $this->upsertSnapshot(
            (int) $exam->hospital_id,
            'ultrasound_exam',
            (int) $exam->id,
            [
                'entry_direction' => 'income',
                'module' => 'radiology',
                'category' => 'ultrasound',
                'title' => 'Ultrasound #' . (string) ($exam->sequence_id ?? $exam->id),
                'patient_id' => $exam->patient_id ? (int) $exam->patient_id : null,
                'supplier_id' => null,
                'amount' => $netAmount,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'net_amount' => $netAmount,
                'paid_amount' => $isSettled ? (float) ($exam->paid_amount ?? $netAmount) : 0,
                'due_amount' => $isSettled ? 0 : $netAmount,
                'status' => $isSettled ? 'paid' : 'pending',
                'currency' => 'AFN',
                // Paid_at where known: an exam reported days after payment
                // belongs in the day's takings for the day it was collected.
                'posted_at' => $exam->paid_at ?? $exam->examined_at ?? $exam->created_at ?? now(),
                'posted_by' => $exam->updated_by ?? $exam->created_by,
                'voided_at' => null,
                'metadata' => [
                    'ultrasound_type_id' => $exam->ultrasound_type_id,
                    'doctor_id' => $exam->doctor_id,
                ],
            ]
        );
    }

    public function voidUltrasoundExamSnapshot(UltrasoundExam $exam, ?string $actor = null): void
    {
        $this->voidSnapshot((int) $exam->hospital_id, 'ultrasound_exam', (int) $exam->id, $actor);
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

    public function upsertOtherIncomeSnapshot(OtherIncome $otherIncome): LedgerEntry
    {
        return $this->upsertSnapshot(
            (int) $otherIncome->hospital_id,
            'other_income',
            (int) $otherIncome->id,
            [
                'entry_direction' => 'income',
                'module' => 'other_income',
                'category' => $otherIncome->category?->name,
                'title' => (string) $otherIncome->title,
                'patient_id' => null,
                'supplier_id' => null,
                'amount' => (float) $otherIncome->amount,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'net_amount' => (float) $otherIncome->amount,
                'paid_amount' => (float) $otherIncome->amount,
                'due_amount' => 0,
                'status' => (string) $otherIncome->status,
                'posted_at' => $otherIncome->income_date ?? $otherIncome->created_at ?? now(),
                'posted_by' => $otherIncome->updated_by ?? $otherIncome->created_by,
                'voided_at' => null,
                'metadata' => [
                    'other_income_category_id' => $otherIncome->other_income_category_id,
                    'sequence_id' => $otherIncome->sequence_id,
                    'reference' => $otherIncome->reference,
                    'payment_method' => $otherIncome->payment_method,
                ],
            ]
        );
    }

    public function voidOtherIncomeSnapshot(OtherIncome $otherIncome, ?string $actor = null): void
    {
        $this->voidSnapshot((int) $otherIncome->hospital_id, 'other_income', (int) $otherIncome->id, $actor);
    }

    public function upsertPayrollItemSnapshot(PayrollBatch $payrollBatch, PayrollItem $payrollItem): LedgerEntry
    {
        $netAmount = (float) ($payrollItem->final_amount ?? 0);
        $isPaid = strtolower((string) ($payrollItem->status ?? 'pending')) === 'paid';
        $paidAmount = $isPaid ? $netAmount : 0.0;
        $dueAmount = $isPaid ? 0.0 : $netAmount;

        $employeeName = trim((string) ($payrollItem->employee?->first_name ?? '') . ' ' . (string) ($payrollItem->employee?->last_name ?? ''));
        $title = 'Salary #' . (string) ($payrollItem->slip_number ?? $payrollItem->id) . ($employeeName !== '' ? ' - ' . $employeeName : '');

        return $this->upsertSnapshot(
            (int) $payrollItem->hospital_id,
            'payroll_item',
            (int) $payrollItem->id,
            [
                'entry_direction' => 'expense',
                'module' => 'salary',
                'category' => 'payroll',
                'title' => $title,
                'patient_id' => null,
                'supplier_id' => null,
                'amount' => $netAmount,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'net_amount' => $netAmount,
                'paid_amount' => $paidAmount,
                'due_amount' => $dueAmount,
                'status' => (string) ($payrollItem->status ?? 'pending'),
                'currency' => (string) ($payrollBatch->currency ?? 'AFN'),
                'posted_at' => $payrollItem->paid_at ?? $payrollBatch->posted_at ?? now(),
                'posted_by' => $payrollBatch->posted_by ?? $payrollItem->updated_by ?? $payrollItem->created_by,
                'voided_at' => null,
                'metadata' => [
                    'payroll_batch_id' => $payrollBatch->id,
                    'payroll_month' => $payrollBatch->payroll_month,
                    'employee_id' => $payrollItem->employee_id,
                    'salary_structure_id' => $payrollItem->salary_structure_id,
                    'slip_number' => $payrollItem->slip_number,
                    'payment_method' => $payrollItem->payment_method,
                ],
            ]
        );
    }

    public function voidPayrollItemSnapshot(PayrollItem $payrollItem, ?string $actor = null): void
    {
        $this->voidSnapshot((int) $payrollItem->hospital_id, 'payroll_item', (int) $payrollItem->id, $actor);
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
