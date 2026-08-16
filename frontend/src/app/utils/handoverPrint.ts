import { POWERED_BY_TEXT } from './receiptBranding';

export interface HandoverLine {
  label: string;
  amount: number;
  entries?: number;
}

export interface HandoverDocument {
  hospitalName: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  from: string;
  to: string;
  /** Whose takings these are: a staff member for a shift handover, or the hospital. */
  submittedBy: string;
  generatedAt: string;
  currency: string;
  lines: HandoverLine[];
  totalAmount: number;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string)
  );

/**
 * The end-of-shift cash handover sheet.
 *
 * Always A4 in a window of its own: it is signed, stamped and filed, so it does
 * not follow the hospital's thermal receipt setting, and printing it in place
 * would inherit the application's layout.
 */
export const printHandoverReport = (doc: HandoverDocument): void => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    window.alert('Please allow pop-ups for this site to print the report.');
    return;
  }

  const rows = doc.lines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.label)}</td>
          <td class="num">${line.entries ?? ''}</td>
          <td class="num">${money(line.amount)}</td>
        </tr>`
    )
    .join('');

  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Finance Submission Report</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Tahoma, Verdana, sans-serif; color: #000; margin: 0; font-size: 12px; }
      .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; }
      .head .name { font-size: 20px; font-weight: 700; text-transform: uppercase; }
      .head .sub { font-size: 11px; }
      .title { text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; margin: 14px 0; }
      .meta { display: flex; gap: 24px; margin-bottom: 12px; }
      .meta .col { flex: 1; }
      .meta .row { display: flex; justify-content: space-between; padding: 2px 0; }
      .meta .k { opacity: 0.7; }
      .meta .v { font-weight: 600; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
      th { background: #f0f0f0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; }
      td.num, th.num { text-align: right; }
      tfoot td { font-weight: 700; font-size: 14px; }
      .sign { display: flex; gap: 32px; margin-top: 40px; }
      .sign .box { flex: 1; }
      .sign .line { border-bottom: 1px solid #000; height: 26px; margin-bottom: 4px; }
      .cap { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.8; }
      .stamp { margin-top: 26px; }
      .stamp .area { border: 1px dashed #000; height: 70px; width: 200px; }
      .brand { text-align: center; font-style: italic; font-size: 10px; opacity: 0.75; margin-top: 26px; }
    </style>
  </head>
  <body>
    <div class="head">
      <div class="name">${escapeHtml(doc.hospitalName)}</div>
      ${doc.hospitalAddress ? `<div class="sub">${escapeHtml(doc.hospitalAddress)}</div>` : ''}
      ${doc.hospitalPhone ? `<div class="sub">${escapeHtml(doc.hospitalPhone)}</div>` : ''}
    </div>

    <div class="title">Daily Finance Submission</div>

    <div class="meta">
      <div class="col">
        <div class="row"><span class="k">From Date</span><span class="v">${escapeHtml(doc.from)}</span></div>
        <div class="row"><span class="k">To Date</span><span class="v">${escapeHtml(doc.to)}</span></div>
      </div>
      <div class="col">
        <div class="row"><span class="k">Submitted By</span><span class="v">${escapeHtml(doc.submittedBy)}</span></div>
        <div class="row"><span class="k">Generated</span><span class="v">${escapeHtml(doc.generatedAt)}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Revenue Area</th><th class="num">Entries</th><th class="num">Amount (${escapeHtml(doc.currency)})</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="2">Total Amount</td><td class="num">${money(doc.totalAmount)}</td></tr>
      </tfoot>
    </table>

    <div class="sign">
      <div class="box">
        <div class="line"></div>
        <div class="cap">Submitted By - Name</div>
        <div class="line" style="margin-top:18px"></div>
        <div class="cap">Signature</div>
      </div>
      <div class="box">
        <div class="line"></div>
        <div class="cap">Received By - Name</div>
        <div class="line" style="margin-top:18px"></div>
        <div class="cap">Signature</div>
      </div>
    </div>

    <div class="stamp">
      <div class="cap" style="margin-bottom:4px">Official Stamp</div>
      <div class="area"></div>
    </div>

    <div class="brand">${POWERED_BY_TEXT}</div>
    <script>
      window.onload = function () {
        setTimeout(function () { window.focus(); window.print(); window.close(); }, 250);
      };
    </script>
  </body>
</html>`);
  win.document.close();
};
