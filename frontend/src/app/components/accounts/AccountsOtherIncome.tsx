import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeDollarSign, Tags } from 'lucide-react';
import { Hospital, UserRole, OtherIncome } from '../../types';
import { useOtherIncomes } from '../../context/OtherIncomeContext';
import { useOtherIncomeCategories } from '../../context/OtherIncomeCategoryContext';
import { TabbedModulePage, type ModuleTab } from '../TabbedModulePage';
import { MoneyEntryManagement, type MoneyEntryAdapter, type MoneyEntryView } from './MoneyEntryManagement';
import { MoneyCategoryManagement, type MoneyCategoryAdapter } from './MoneyCategoryManagement';
import { OtherIncomeInvoicePrint } from '../OtherIncomeInvoicePrint';

/**
 * Other Income, under Accounts. The mirror of AccountsExpenses -- same two
 * tabs, same register, money coming in rather than going out.
 */
export function AccountsOtherIncome({ hospital }: { hospital: Hospital; userRole: UserRole }) {
  const { i18n } = useTranslation();
  const { otherIncomes, addOtherIncome, updateOtherIncome, deleteOtherIncome, loading } = useOtherIncomes();
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    loading: categoriesLoading,
  } = useOtherIncomeCategories();

  const [printing, setPrinting] = useState<OtherIncome | null>(null);

  const byId = useMemo(() => new Map(otherIncomes.map((income) => [income.id, income])), [otherIncomes]);

  const entries: MoneyEntryView[] = useMemo(
    () =>
      otherIncomes.map((income) => ({
        id: income.id,
        hospitalId: income.hospitalId,
        categoryId: income.otherIncomeCategoryId,
        sequenceId: income.sequenceId,
        title: income.title,
        amount: income.amount,
        date: income.incomeDate,
        paymentMethod: income.paymentMethod,
        reference: income.reference,
        documentUrl: income.documentUrl,
        notes: income.notes,
        status: income.status,
        categoryName:
          income.category?.name ?? categories.find((c) => c.id === income.otherIncomeCategoryId)?.name,
        createdBy: income.createdBy,
        createdAt: income.createdAt,
        updatedBy: income.updatedBy,
        updatedAt: income.updatedAt,
        approvedBy: income.approvedBy,
        approvedAt: income.approvedAt,
        rejectedBy: income.rejectedBy,
        rejectedAt: income.rejectedAt,
      })),
    [otherIncomes, categories]
  );

  const entryAdapter: MoneyEntryAdapter = {
    labels: {
      singular: 'Income Entry',
      plural: 'Income Entries',
      dateLabel: 'Income Date',
      addLabel: 'Add income entry',
      amountLabel: 'Amount',
    },
    permissions: {
      view: ['view_other_incomes', 'manage_other_incomes'],
      add: ['add_other_incomes', 'manage_other_incomes'],
      edit: ['edit_other_incomes', 'manage_other_incomes'],
      delete: ['delete_other_incomes', 'manage_other_incomes'],
      approve: ['approve_other_incomes', 'manage_other_incomes'],
      print: ['print_other_incomes', 'manage_other_incomes'],
      editDate: ['edit_other_income_date', 'manage_other_incomes'],
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
        otherIncomeCategoryId: values.categoryId,
        title: values.title,
        amount,
        incomeDate: new Date(values.date),
        paymentMethod: values.paymentMethod || undefined,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
        status,
        documentFile,
      };

      if (id) {
        await updateOtherIncome({ id, ...payload });
        return true;
      }

      return Boolean(await addOtherIncome(payload));
    },
    setStatus: async (entry, status) => {
      const original = byId.get(entry.id);
      if (!original) return;

      // The whole record is resent: the update endpoint validates every field,
      // so a status-only payload would fail on the ones it could not see.
      await updateOtherIncome({
        id: original.id,
        hospitalId: original.hospitalId,
        otherIncomeCategoryId: original.otherIncomeCategoryId,
        title: original.title,
        amount: original.amount,
        incomeDate: original.incomeDate,
        paymentMethod: original.paymentMethod,
        reference: original.reference,
        notes: original.notes,
        status,
      });
    },
    remove: deleteOtherIncome,
    print: (entry) => setPrinting(byId.get(entry.id) ?? null),
  };

  const categoryAdapter: MoneyCategoryAdapter = {
    labels: { singular: 'Income Category', plural: 'Categories', addLabel: 'Add income category' },
    permissions: {
      add: ['add_other_income_categories', 'manage_other_income_categories'],
      edit: ['edit_other_income_categories', 'manage_other_income_categories'],
      delete: ['delete_other_income_categories', 'manage_other_income_categories'],
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
      label: 'Other Income',
      icon: <BadgeDollarSign className="w-3.5 h-3.5" />,
      anyPermissions: ['view_other_incomes', 'manage_other_incomes'],
      render: () => <MoneyEntryManagement adapter={entryAdapter} />,
    },
    {
      key: 'categories',
      label: 'Categories',
      icon: <Tags className="w-3.5 h-3.5" />,
      anyPermissions: ['view_other_income_categories', 'manage_other_income_categories'],
      render: () => <MoneyCategoryManagement adapter={categoryAdapter} />,
    },
  ];

  return (
    <>
      <TabbedModulePage
        title="Other Income"
        subtitle={`Income raised outside the clinical modules — ${hospital.name}`}
        tabs={tabs}
      />
      {printing && (
        <OtherIncomeInvoicePrint
          otherIncome={printing}
          hospital={hospital}
          categoryName={
            printing.category?.name ??
            categories.find((category) => category.id === printing.otherIncomeCategoryId)?.name ??
            'Uncategorised'
          }
          onClose={() => setPrinting(null)}
        />
      )}
    </>
  );
}

export default AccountsOtherIncome;
