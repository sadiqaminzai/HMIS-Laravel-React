import { GrandTotal, ModuleTally, PendingCharge, PharmacyBreakdown } from '../../api/paymentCollection';
import { POWERED_BY_TEXT } from './receiptBranding';

/** e.g. "18/08/2026 01:33 pm" -- date and time of day on one line. */
export const dateTime = (value: string) => {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '-';
  const date = at.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
  return `${date} ${time}`;
};

export const money = (value: number) =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * `YYYY-MM-DDTHH:mm` in the viewer's own clock.
 *
 * toISOString() would be wrong here: it converts to UTC, so in Kabul (+04:30)
 * "today at 00:00" becomes the previous day at 19:30 and the default window
 * silently starts five hours early.
 */
export const localStamp = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Never let a patient name or a reference close the document's own markup. */
const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** `2026-08-27T00:00` -> `27 Aug 2026, 12:00 am`, for the report header. */
const prettyStamp = (local: string) => {
  const at = new Date(local);
  if (Number.isNaN(at.getTime())) return local;
  return `${at.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}, ` +
    at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
};

/**
 * The printable handover sheet.
 *
 * Built as a standalone document in its own window: it must not depend on the
 * application stylesheet, which is not always present in a print window, and it
 * carries a signature block that has no place in the on-screen list.
 *
 * The three signature areas are the point of the page. A collector hands cash
 * to an administrator, and that transfer is what the hospital needs evidence
 * of -- the stamp panel in the middle is what makes the sheet a record rather
 * than a printout.
 */
export function buildReportHtml(opts: {
  hospital: { name?: string; address?: string; phone?: string };
  rows: PendingCharge[];
  breakdown: PharmacyBreakdown | null;
  modules: ModuleTally[];
  grandTotal: GrandTotal;
  from: string;
  to: string;
  submittedBy: string;
  moduleLabel: string;
}): string {
  const { hospital, rows, breakdown, modules, grandTotal, from, to, submittedBy, moduleLabel } = opts;

  // Footer grand totals are computed from the rows actually printed, so the
  // sheet can never claim a total the page above it does not support.
  const listedTotal = rows.reduce((sum, r) => sum + Number(r.net_amount || 0), 0);
  const listedPaid = rows.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0);
  const listedDue = rows.reduce((sum, r) => sum + Number(r.due_amount || 0), 0);

  const body = rows.length
    ? rows.map((r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(r.patient_name || '-')}${r.patient_code ? ` <span class="code">(${esc(r.patient_code)})</span>` : ''}</td>
        <td>${esc(r.reference)}</td>
        <td class="num">${money(Number(r.net_amount || 0))}</td>
        <td class="num paid">${money(Number(r.paid_amount || 0))}</td>
        <td class="num due">${money(Number(r.due_amount || 0))}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:18px">No charges in this period.</td></tr>';

  // The same panels the screen shows: one per module the collector holds, plus
  // the pharmacy pair. The six-row table this replaced ran the full width for
  // figures the reader takes in at a glance, and pushed the signature block
  // toward a second page.
  const panel = (title: string, meta: string, total: number, paid: number, due: number, note = '', emphasis = false) => `
    <table class="panel${emphasis ? ' panel-emph' : ''}">
      <tr><th>${esc(title)}<span class="pdocs">${esc(meta)}</span></th></tr>
      <tr><td class="pcell">
        <div class="pvalue">${money(total)}</div>
        <div class="pderiv">
          <span class="paid">${money(paid)}</span> paid &middot;
          <span class="due">${money(due)}</span> due
        </div>
        ${note ? `<div class="pderiv">${note}</div>` : ''}
      </td></tr>
    </table>`;

  const docs = (n: number) => `${n} doc${n === 1 ? '' : 's'}`;

  const modulePanels = modules
    // Pharmacy is represented by its own two panels.
    .filter((m) => !(m.module === 'pharmacy' && breakdown))
    .map((m) => panel(m.label, docs(m.entries), m.total_amount, m.paid_amount, m.due_amount))
    .join('');

  const pharmacyPanels = breakdown
    ? (['sales', 'purchase'] as const).map((family) => {
        const t = breakdown.totals[family];
        const invoice = breakdown.types.find((ty) => ty.family === family && ty.sign === 1);
        const ret = breakdown.types.find((ty) => ty.family === family && ty.sign === -1);
        return panel(
          family === 'sales' ? 'Pharmacy Sales' : 'Pharmacy Purchase',
          docs(t.entries),
          t.total_amount,
          t.paid_amount,
          t.due_amount,
          `${money(invoice?.total_amount ?? 0)} &minus; ${money(ret?.total_amount ?? 0)}`
        );
      }).join('')
    : '';

  const breakdownBlock = `<div class="panels">${
    panel('Totals', docs(grandTotal.entries), grandTotal.total_amount, grandTotal.paid_amount, grandTotal.due_amount, '', true)
  }${modulePanels}${pharmacyPanels}</div>`;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payment Collection Report</title>
    <style>
      /* Portrait: with Phone, Module, Payment and Date dropped, the sheet is
         seven narrow columns and no longer needs the width. Portrait also
         files and photocopies with the rest of the hospital's paperwork. */
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Tahoma, Verdana, sans-serif; color: #000; font-size: 10px; margin: 0; }
      .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
      .hname { font-size: 17px; font-weight: 700; text-transform: uppercase; }
      .hsub { font-size: 10px; }
      .doc { margin-top: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; font-size: 11px; }
      .modules { margin-top: 3px; font-size: 9.5px; line-height: 1.3; }
      .meta { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; }
      .grid th, .grid td { border: 1px solid #999; padding: 3px 5px; }
      .grid th { background: #eee; text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; }
      .num { text-align: right; }
      .paid { color: #067647; }
      .due { color: #b42318; }
      .tag { font-size: 8px; border: 1px solid #999; border-radius: 6px; padding: 0 3px; }
      .panels { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; page-break-inside: avoid; }
      .panel { border: 1px solid #999; border-collapse: collapse; min-width: 108px; flex: 1 1 108px; }
      .panel-emph { border-color: #000; border-width: 1.5px; }
      .panel th { background: #eee; text-align: left; padding: 2px 4px; font-size: 8px;
                  text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #999;
                  white-space: nowrap; }
      .pdocs { float: right; font-weight: 400; text-transform: none; letter-spacing: 0; color: #444;
               padding-left: 6px; }
      .pcell { padding: 3px 4px; vertical-align: top; }
      .pvalue { font-size: 12px; font-weight: 700; line-height: 1.15; }
      .pderiv { font-size: 7px; color: #666; white-space: nowrap; }
      /* The last row of the list, not a repeating page footer. */
      .grand td { border: 1px solid #000; background: #f2f2f2; font-weight: 700; font-size: 11px; padding: 5px; }
      .code { color: #555; font-size: 8.5px; }
      /* Kept whole on one page: a signature separated from the totals it
         attests to is not evidence of anything. */
      .signoff { margin-top: 20px; display: flex; gap: 14px; page-break-inside: avoid; }
      .sig { flex: 1; }
      .sig .role { font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
      .sig .who { font-size: 11px; margin-top: 2px; min-height: 14px; }
      .sig .line { border-bottom: 1px solid #000; height: 30px; }
      .sig .cap { font-size: 8.5px; color: #444; margin-top: 3px; }
      .stamp { flex: 1; border: 1px dashed #666; border-radius: 6px; min-height: 92px; display: flex;
               align-items: center; justify-content: center; text-align: center; }
      .stamp span { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: .1em; }
      .brand { text-align: center; font-style: italic; font-weight: 600; font-size: 9px; margin-top: 10px; }
    </style>
  </head>
  <body>
    <div class="head">
      <div class="hname">${esc(hospital.name)}</div>
      ${hospital.address ? `<div class="hsub">${esc(hospital.address)}</div>` : ''}
      ${hospital.phone ? `<div class="hsub">${esc(hospital.phone)}</div>` : ''}
      <div class="doc">Payment Collection Report</div>
      <!-- Under the title, on its own line: a collector with every module holds
           a list far too long for the middle of a three-column meta row, where
           it collided with the period and the print time. -->
      <div class="modules"><strong>Modules:</strong> ${esc(moduleLabel)}</div>
    </div>

    <div class="meta">
      <div><strong>Period:</strong> ${esc(prettyStamp(from))} &nbsp;&rarr;&nbsp; ${esc(prettyStamp(to))}</div>
      <div><strong>Printed:</strong> ${esc(prettyStamp(localStamp(new Date())))}</div>
    </div>

    <table class="grid">
      <thead>
        <tr>
          <th class="num" style="width:5%">#</th>
          <th style="width:40%">Patient</th>
          <th style="width:25%">Reference</th>
          <th class="num" style="width:10%">Amount</th>
          <th class="num" style="width:10%">Paid</th>
          <th class="num" style="width:10%">Due</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
      <tbody>
        <!-- Deliberately a body row, not a <tfoot>: the browser repeats a tfoot
             on every printed page, so a 200-row report carried a "GRAND TOTALS"
             line partway down each sheet that totalled the whole report. It
             belongs once, after the last record. -->
        <tr class="grand">
          <td colspan="3" style="text-align:right">GRAND TOTALS &mdash; ${rows.length} record${rows.length === 1 ? '' : 's'}</td>
          <td class="num">${money(listedTotal)}</td>
          <td class="num paid">${money(listedPaid)}</td>
          <td class="num due">${money(listedDue)}</td>
        </tr>
      </tbody>
    </table>

    ${breakdownBlock}

    <div class="signoff">
      <div class="sig">
        <div class="role">Submitted by</div>
        <div class="who">${esc(submittedBy)}</div>
        <div class="line"></div>
        <div class="cap">Signature &amp; date</div>
      </div>
      <div class="stamp"><span>Hospital Stamp</span></div>
      <div class="sig">
        <div class="role">Submitted to</div>
        <div class="who">&nbsp;</div>
        <div class="line"></div>
        <div class="cap">Name, signature &amp; date</div>
      </div>
    </div>

    <div class="brand">${esc(POWERED_BY_TEXT)}</div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`;
}
