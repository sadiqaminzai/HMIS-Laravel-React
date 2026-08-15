import React from 'react';
import { Expense, Hospital, OtherIncome } from '../types';
import { ExpenseInvoicePrint } from './ExpenseInvoicePrint';

interface OtherIncomeInvoicePrintProps {
  hospital: Hospital;
  otherIncome: OtherIncome;
  categoryName: string;
  onClose: () => void;
}

export function OtherIncomeInvoicePrint({ hospital, otherIncome, categoryName, onClose }: OtherIncomeInvoicePrintProps) {
  const incomeAsExpense: Expense = {
    id: otherIncome.id,
    hospitalId: otherIncome.hospitalId,
    expenseCategoryId: otherIncome.otherIncomeCategoryId,
    sequenceId: otherIncome.sequenceId,
    title: otherIncome.title,
    amount: otherIncome.amount,
    expenseDate: otherIncome.incomeDate,
    paymentMethod: otherIncome.paymentMethod,
    reference: otherIncome.reference,
    documentUrl: otherIncome.documentUrl,
    notes: otherIncome.notes,
    status: otherIncome.status,
    createdAt: otherIncome.createdAt,
    createdBy: otherIncome.createdBy,
    updatedAt: otherIncome.updatedAt,
    updatedBy: otherIncome.updatedBy,
  };

  return (
    <ExpenseInvoicePrint
      hospital={hospital}
      expense={incomeAsExpense}
      categoryName={categoryName}
      voucherLabel="Other Income"
      onClose={onClose}
    />
  );
}
