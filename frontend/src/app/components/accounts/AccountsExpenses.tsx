import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, Tags } from 'lucide-react';
import { Hospital, UserRole, Expense } from '../../types';
import { useExpenses } from '../../context/ExpenseContext';
import { useExpenseCategories } from '../../context/ExpenseCategoryContext';
import { TabbedModulePage, type ModuleTab } from '../TabbedModulePage';
import { MoneyEntryManagement, type MoneyEntryAdapter, type MoneyEntryView } from './MoneyEntryManagement';
import { MoneyCategoryManagement, type MoneyCategoryAdapter } from './MoneyCategoryManagement';
import { ExpenseInvoicePrint } from '../ExpenseInvoicePrint';

/**
 * Expenses, under Accounts.
 *
 * Entries and categories were two sidebar rows plus a third for the report.
 * The report moved to Reports, where every other report lives, and the two
 * data-entry screens became tabs -- the same shape as Pharmacy Master Data,
 * because they are the same kind of thing: a register and the reference list
 * it draws on.
 */
export function AccountsExpenses({ hospital }: { hospital: Hospital; userRole: UserRole }) {
  const { i18n } = useTranslation();
  const { expenses, addExpense, updateExpense, deleteExpense, loading } = useExpenses();
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    loading: categoriesLoading,
  } = useExpenseCategories();

  const [printing, setPrinting] = useState<Expense | null>(null);

  const byId = useMemo(() => new Map(expenses.map((expense) => [expense.id, expense])), [expenses]);

  const entries: MoneyEntryView[] = useMemo(
    () =>
      expenses.map((expense) => ({
        id: expense.id,
        hospitalId: expense.hospitalId,
        categoryId: expense.expenseCategoryId,
        sequenceId: expense.sequenceId,
        title: expense.title,
        amount: expense.amount,
        date: expense.expenseDate,
        paymentMethod: expense.paymentMethod,
        reference: expense.reference,
        documentUrl: expense.documentUrl,
        notes: expense.notes,
        status: expense.status,
        categoryName:
          expense.category?.name ?? categories.find((c) => c.id === expense.expenseCategoryId)?.name,
        createdBy: expense.createdBy,
        createdAt: expense.createdAt,
        updatedBy: expense.updatedBy,
        updatedAt: expense.updatedAt,
        approvedBy: expense.approvedBy,
        approvedAt: expense.approvedAt,
        rejectedBy: expense.rejectedBy,
        rejectedAt: expense.rejectedAt,
      })),
    [expenses, categories]
  );

  const entryAdapter: MoneyEntryAdapter = {
    labels: {
      singular: 'Expense',
      plural: 'Expenses',
      dateLabel: 'Expense Date',
      addLabel: 'Add expense',
      amountLabel: 'Amount',
    },
    permissions: {
      view: ['view_expenses', 'manage_expenses'],
      add: ['add_expenses', 'manage_expenses'],
      edit: ['edit_expenses', 'manage_expenses'],
      delete: ['delete_expenses', 'manage_expenses'],
      approve: ['approve_expenses', 'manage_expenses'],
      print: ['print_expenses', 'manage_expenses'],
      editDate: ['edit_expense_date', 'manage_expenses'],
    },
    entries,
    categories,
    loading,
    currency: 'AFN',
    language: i18n.language,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    save: async ({ id, values, amount, status, documentFile }) => {
      const payload = {
        hospitalId: hospital.id,
        expenseCategoryId: values.categoryId,
        title: values.title,
        amount,
        expenseDate: new Date(values.date),
        paymentMethod: values.paymentMethod || undefined,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
        status,
        documentFile,
      };

      if (id) {
        await updateExpense({ id, ...payload });
        return true;
      }

      return Boolean(await addExpense(payload));
    },
    setStatus: async (entry, status) => {
      const original = byId.get(entry.id);
      if (!original) return;

      // Every field is resent, not just the status: the update endpoint
      // validates the whole record, so a status-only payload would fail
      // validation on the fields it could not see.
      await updateExpense({
        id: original.id,
        hospitalId: original.hospitalId,
        expenseCategoryId: original.expenseCategoryId,
        title: original.title,
        amount: original.amount,
        expenseDate: original.expenseDate,
        paymentMethod: original.paymentMethod,
        reference: original.reference,
        notes: original.notes,
        status,
      });
    },
    remove: deleteExpense,
    print: (entry) => setPrinting(byId.get(entry.id) ?? null),
  };

  const categoryAdapter: MoneyCategoryAdapter = {
    labels: { singular: 'Expense Category', plural: 'Categories', addLabel: 'Add expense category' },
    permissions: {
      add: ['add_expense_categories', 'manage_expense_categories'],
      edit: ['edit_expense_categories', 'manage_expense_categories'],
      delete: ['delete_expense_categories', 'manage_expense_categories'],
    },
    categories,
    loading: categoriesLoading,
    hospitalId: hospital.id,
    save: async ({ id, name, description, status }) => {
      const payload = { hospitalId: hospital.id, name, description, status };
      if (id) {
        await updateCategory({ id, ...payload });
        return true;
      }
      return Boolean(await addCategory(payload));
    },
    remove: deleteCategory,
  };

  const tabs: ModuleTab[] = [
    {
      key: 'entries',
      label: 'Expenses',
      icon: <Receipt className="w-3.5 h-3.5" />,
      anyPermissions: ['view_expenses', 'manage_expenses'],
      render: () => <MoneyEntryManagement adapter={entryAdapter} />,
    },
    {
      key: 'categories',
      label: 'Categories',
      icon: <Tags className="w-3.5 h-3.5" />,
      anyPermissions: ['view_expense_categories', 'manage_expense_categories'],
      render: () => <MoneyCategoryManagement adapter={categoryAdapter} />,
    },
  ];

  return (
    <>
      <TabbedModulePage
        title="Expenses"
        subtitle={`What the hospital spends, and the categories it files them under — ${hospital.name}`}
        tabs={tabs}
      />
      {printing && (
        <ExpenseInvoicePrint
          expense={printing}
          hospital={hospital}
          categoryName={
            printing.category?.name ??
            categories.find((category) => category.id === printing.expenseCategoryId)?.name ??
            'Uncategorised'
          }
          onClose={() => setPrinting(null)}
        />
      )}
    </>
  );
}

export default AccountsExpenses;
