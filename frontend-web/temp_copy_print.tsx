  const escapeHtml = (value: string) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const handlePrintInvoice = async (transaction: Transaction | null = selectedTransaction, forceA4 = false) => {
    if (!transaction) return;
    const trx = transaction;

    const resolvedTemplate: 'sale' | 'purchase' | 'supplier' =
      trx.trxType === 'purchase' || trx.trxType === 'purchase_return'
        ? (trx.supplierId ? 'supplier' : 'purchase')
        : 'sale';

    setPrintTemplate(resolvedTemplate);

    const targetSize: 'a4' | '58mm' | '76mm' | '80mm' = forceA4 ? 'a4' : receiptSize;
    const printWindow = window.open('', '_blank', 'width=1200,height=920');
    if (!printWindow) {
      toast.error('Unable to open print preview. Please allow popups for this site.');
      return;
    }

    const hospitalInfo = getHospital(trx.hospitalId);
    const transactionDetails = trx.details || [];
    const totalsSummary = calculateTotalsSummary(transactionDetails);
    const netTotal = calculateTotals(transactionDetails);
    const grossTotal = transactionDetails.reduce((sum, detail) => sum + Number(detail.price || 0) * Number(detail.qtty || 0), 0);
    const totalQuantity = transactionDetails.reduce((sum, detail) => sum + Number(detail.qtty || 0), 0);
    const logoDataUrl = await loadImageAsDataUrl(hospitalInfo?.logo);

    const patient = patients.find((p) => p.id === trx.patientId);
    const supplier = suppliers.find((s) => s.id === trx.supplierId);
    const billedToName =
      resolvedTemplate === 'sale'
        ? (patient?.name || trx.patientName || getPatientDisplay(trx.patientId) || 'Walk-in Customer')
        : (supplier?.name || trx.supplierName || getSupplierDisplay(trx.supplierId) || 'Supplier');
    const billedToAddress = resolvedTemplate === 'sale' ? (patient?.address || '') : (supplier?.address || '');
    const billedToPhone = resolvedTemplate === 'sale' ? (patient?.phone || '') : (supplier?.contactInfo || '');

    const invoiceHeading = resolvedTemplate === 'sale' ? 'SALES INVOICE' : resolvedTemplate === 'purchase' ? 'PURCHASE INVOICE' : 'SUPPLIER INVOICE';
    const hospitalName = hospitalInfo?.name || getHospitalName(trx.hospitalId);
    const hospitalAddress = hospitalInfo?.address || '';
    const hospitalContact = [hospitalInfo?.phone || '', hospitalInfo?.email || ''].filter(Boolean).join(' | ');

    const invoiceDate = trx.createdAt
      ? formatOnlyDate(trx.createdAt, hospitalInfo?.timezone || 'Asia/Kabul', (hospitalInfo?.calendarType as 'gregorian' | 'shamsi') || 'gregorian')
      : formatOnlyDate(new Date(), hospitalInfo?.timezone || 'Asia/Kabul', (hospitalInfo?.calendarType as 'gregorian' | 'shamsi') || 'gregorian');
    const createdAt = trx.createdAt ? new Date(trx.createdAt).toLocaleString() : '-';
    const updatedAt = trx.updatedAt ? new Date(trx.updatedAt).toLocaleString() : '-';

    const logoMarkup = logoDataUrl || hospitalInfo?.logo
      ? `<img src="${logoDataUrl || hospitalInfo?.logo}" alt="Hospital logo" class="hospital-logo" />`
      : ``;

    const rowsMarkupA4 = transactionDetails.length
      ? transactionDetails
          .map((detail) => {
            const amount = Number(detail.amount ?? calculateLineAmount(detail));
            const qty = Number(detail.qtty || 0);
            const discount = Number(detail.discount || 0);
            const tax = Number(detail.tax || 0);
            const netPrice = qty > 0 ? amount / qty : Number(detail.price || 0);
            const itemName = detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown');

            return `
              <tr>
                <td>
                  <div class="product-details">
                    <span class="product-name">${escapeHtml(itemName)}</span>
                  </div>
                </td>
                <td class="text-center" style="color: #2563eb;">${escapeHtml(detail.batchNo || 'N/A')}</td>
                <td class="text-center">${escapeHtml(detail.expiryDate ? getExpiryDisplay(detail.expiryDate, trx.hospitalId) : '-')}</td>
                <td class="text-center"><strong>${qty}</strong></td>
                <td class="text-center">${Number(detail.bonus || 0)}</td>
                <td class="text-center">${Number(detail.price || 0).toFixed(2)}</td>
                <td class="text-center ${discount > 0 ? 'accent-red' : ''}">${discount > 0 ? `${discount}%` : '-'}</td>
                <td class="text-center ${tax > 0 ? 'accent-blue' : ''}">${tax > 0 ? `${tax}%` : '-'}</td>
                <td class="text-center">${netPrice.toFixed(2)}</td>
                <td class="text-right amount">${amount.toFixed(2)}</td>
              </tr>
            `;
          })
          .join('')
      : '<tr><td colspan="10" class="empty-row">No items found for this transaction.</td></tr>';

    const rowsMarkupCompact = transactionDetails.length
      ? transactionDetails
          .map((detail, index) => {
            const amount = Number(detail.amount ?? calculateLineAmount(detail));
            const itemName = detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown');
            return `
              <tr>
                <td>${index + 1}</td>
                <td class="item">${escapeHtml(itemName)}</td>
                <td class="num">${Number(detail.qtty || 0)}</td>
                <td class="num">${Number(detail.price || 0).toFixed(2)}</td>
                <td class="num strong">${amount.toFixed(2)}</td>
              </tr>
            `;
          })
          .join('')
      : '<tr><td colspan="5" class="empty">No items</td></tr>';

    let html = '';

    if (targetSize === 'a4') {
      html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(invoiceHeading)}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { box-sizing: border-box; }
              body {
                margin: 0;
                background: #ffffff;
                color: #0f172a;
                font-family: Arial, Helvetica, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .screen-note {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                color: #64748b;
                font-size: 14px;
              }
              @media screen {
                .invoice { display: none; }
                .screen-note { display: flex; }
              }
              @media print {
                .screen-note { display: none !important; }
                .invoice { display: block; }
              }
              .invoice {
                width: 100%;
                max-width: 900px;
                min-height: calc(297mm - 30mm);
                margin: 0 auto;
                padding: 10px 20px;
              }
              /* Header */
              .header {
                display: flex;
                align-items: center;
                gap: 20px;
                padding-bottom: 12px;
                padding-top: 10px;
              }
              .hospital-logo {
                width: auto;
                max-width: 120px;
                height: 60px;
                object-fit: contain;
                margin-left: 10px;
              }
              .hospital-name {
                margin: 0;
                font-size: 24px;
                line-height: 1.1;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #0d3b66;
              }
              .hospital-meta {
                margin-top: 4px;
                font-size: 12px;
                color: #475569;
                line-height: 1.4;
              }
              /* Brand Divider */
              .brand-divider {
                border-top: 3px solid #0d3b66;
                margin-bottom: 2px;
              }
              .brand-divider-thin {
                border-top: 1px solid #0d3b66;
                margin-bottom: 24px;
              }
              /* Top Section */
              .top-section {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 24px;
                padding: 0 10px;
              }
              .bill-to-panel {
                width: 45%;
                background: #f8fafc;
                border-radius: 6px;
                padding: 16px 20px;
              }
              .bill-to-title {
                font-size: 11px;
                color: #64748b;
                text-transform: uppercase;
                font-weight: 700;
                margin-bottom: 12px;
                letter-spacing: 0.5px;
              }
              .party-name {
                margin: 0;
                font-size: 16px;
                font-weight: 800;
                color: #0f172a;
              }
              .party-meta {
                margin-top: 8px;
                font-size: 12px;
                color: #475569;
                line-height: 1.6;
              }
              .invoice-info {
                text-align: right;
                width: 45%;
                padding-top: 16px;
              }
              .invoice-title {
                margin: 0 0 20px;
                font-size: 24px;
                font-weight: 900;
                color: #0d3b66;
                letter-spacing: 0.5px;
                text-transform: uppercase;
              }
              .invoice-row {
                display: flex;
                justify-content: flex-end;
                gap: 24px;
                margin-bottom: 10px;
                font-size: 12px;
                color: #475569;
              }
              .invoice-row strong { 
                color: #0f172a; 
                min-width: 90px; 
                text-align: right;
                font-weight: 800;
              }
              /* Table */
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 30px;
              }
              thead th {
                border-top: 1px solid #cbd5e1;
                border-bottom: 1px solid #cbd5e1;
                color: #0f172a;
                font-size: 10px;
                font-weight: 900;
                text-transform: uppercase;
                text-align: left;
                padding: 12px 6px;
              }
              tbody td {
                border-bottom: 1px solid #e2e8f0;
                padding: 12px 6px;
                font-size: 11px;
                color: #334155;
                vertical-align: middle;
              }
              .product-details {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding-left: 4px;
              }
              .product-name {
                font-size: 11px;
                font-weight: 700;
                color: #0f172a;
                text-transform: uppercase;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .amount { font-weight: 900; font-size: 12px; color: #0f172a; }
              .accent-red { color: #dc2626; font-weight: 700; }
              .accent-blue { color: #2563eb; font-weight: 700; }
              .empty-row { text-align: center; padding: 20px 8px; color: #64748b; }
              
              /* Summary / Totals */
              .summary-box {
                display: flex;
                justify-content: space-between;
                border-top: 2px solid #0d3b66;
                padding: 20px 10px;
                border-bottom: 1px solid #e2e8f0;
              }
              .summary-left {
                display: flex;
                gap: 40px;
              }
              .stat-col {
                display: flex;
                flex-direction: column;
                gap: 10px;
                text-align: center;
              }
              .stat-label {
                font-size: 10px;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 700;
              }
              .stat-value {
                font-size: 16px;
                font-weight: 900;
                color: #0f172a;
              }
              .stat-value.red { color: #dc2626; }
              .stat-value.blue { color: #2563eb; }
              .summary-right {
                width: 250px;
                display: flex;
                flex-direction: column;
                gap: 16px;
              }
              .total-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 11px;
                color: #475569;
                text-transform: uppercase;
                font-weight: 700;
              }
              .total-row strong {
                font-size: 16px;
                font-weight: 900;
                color: #0f172a;
              }
              .total-row.net strong { font-size: 18px; color: #0f172a; }
              .total-row.paid {
                padding-bottom: 16px;
                border-bottom: 1px solid #e2e8f0;
              }
              .total-row.paid strong { color: #059669; }
              .total-row.balance strong { color: #dc2626; font-size: 16px; }
              
              /* Footer */
              .footer {
                margin-top: 60px;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                padding: 0 10px;
              }
              .audit {
                font-size: 10px;
                color: #64748b;
                line-height: 1.6;
                font-style: italic;
              }
              .signature {
                width: 220px;
                border-top: 1px solid #0f172a;
                padding-top: 10px;
                text-align: center;
                font-size: 12px;
                font-weight: 700;
                color: #475569;
                text-transform: uppercase;
              }
              .brand-foot {
                margin-top: 40px;
                text-align: center;
