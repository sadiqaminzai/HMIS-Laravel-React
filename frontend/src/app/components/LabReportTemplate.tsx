import React from 'react';
import { LabTest, Hospital, TestTemplate, TestResult } from '../types';
import { QRCodeCanvas } from 'qrcode.react';
import { formatDate } from '../utils/date';
import { buildVerificationUrl } from '../utils/verification';
// One branding string for every printout, rather than each report
// spelling the company name its own way.
import { POWERED_BY_TEXT } from '../utils/receiptBranding';
import { printNameOr } from '../utils/printName';
import { formatAge, formatAgeLong } from '../utils/age';

interface LabReportTemplateProps {
  test: LabTest;
  hospital: Hospital;
  testTemplates?: TestTemplate[];
}

/**
 * Brand palette, taken from the hospital logo: a cyan crescent over a red hand,
 * on near-black navy type. The red is reserved for the two things that must
 * catch the eye -- the tail on each rule, and a result outside its range.
 */
const BRAND = {
  cyan: '#35B7CE',
  cyanDark: '#1E8FA3',
  cyanTint: '#EAF8FB',
  red: '#EE3B33',
  navy: '#22354B',
  ink: '#1A2734',
  muted: '#5B6B7C',
  line: '#C9D6E0',
  lineSoft: '#E6EDF2',
  white: '#FFFFFF',
};

/**
 * Wash of the accent for the table heading strip.
 *
 * Derived from whatever colour the hospital has configured rather than being a
 * second stored value, so the strip can never drift out of step with the rule
 * and headings above it. Falls back to the stock tint if the field holds
 * something that is not a hex colour.
 */
function accentTint(hex: string, alpha = 0.1): string {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return BRAND.cyanTint;

  let body = match[1];
  if (body.length === 3) body = body.split('').map((c) => c + c).join('');

  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Decide whether a result sits outside its reference range.
 *
 * Ranges are free text typed by whoever built the template, so only the shapes
 * that actually occur are handled -- "4000 - 11000", "0-5", "< 6.0", "> 30" --
 * and anything else (or any non-numeric result such as "Negative") yields no
 * verdict at all. Guessing would be worse than staying silent: an arrow against
 * a normal value is a clinical error, so the bar for drawing one is a range and
 * a result that both parse cleanly.
 */
function rangeVerdict(result: string, normalRange: string): 'high' | 'low' | null {
  const value = Number(String(result ?? '').trim().replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;

  const range = String(normalRange ?? '').trim().replace(/,/g, '');
  if (!range) return null;

  // "4000.0 - 11000.0", "0–5", "13.5 to 17.5"
  const pair = range.match(/^(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)$/i);
  if (pair) {
    const min = Number(pair[1]);
    const max = Number(pair[2]);
    if (value < min) return 'low';
    if (value > max) return 'high';
    return null;
  }

  const under = range.match(/^<\s*=?\s*(-?\d+(?:\.\d+)?)$/);
  if (under) return value > Number(under[1]) ? 'high' : null;

  const over = range.match(/^>\s*=?\s*(-?\d+(?:\.\d+)?)$/);
  if (over) return value < Number(over[1]) ? 'low' : null;

  return null;
}

export function LabReportTemplate({ test, hospital, testTemplates = [] }: LabReportTemplateProps) {
  /**
   * One configurable colour for the whole sheet: the hospital name, the LAB
   * REPORT mark, both rules, and the column headings with their tint.
   *
   * It comes from Hospital Details > Brand Color so a site can match its own
   * letterhead. Everything accented is driven from this single value -- nothing
   * is hard-coded alongside it -- so changing the field changes the report and
   * cannot leave one element behind in a colour nobody chose.
   */
  const accent = hospital?.brandColor || BRAND.cyanDark;
  const accentWash = accentTint(accent);
  const patientIdentifier = test.patientDisplayId || '-';
  const verificationUrl = buildVerificationUrl('lab-report', test.verificationToken);
  const qrValue = verificationUrl || `LAB-${test.testNumber}-${patientIdentifier}`;

  // One page per test, in the order the tests were ordered in.
  const groups: Array<{ testName: string; templateId: string; results: TestResult[] }> = [];
  (test.testResults || []).forEach((result) => {
    const existing = groups.find((g) => g.testName === result.testName);
    if (existing) {
      existing.results.push(result);
    } else {
      groups.push({
        testName: result.testName,
        templateId: String(result.testTemplateId ?? ''),
        results: [result],
      });
    }
  });

  const collectionDate = formatDate(test.sampleCollectedAt, hospital?.timezone, hospital?.calendarType);
  const reportingDate = formatDate(test.reportedAt, hospital?.timezone, hospital?.calendarType);

  // Left column is the person, right column is the specimen and its paperwork.
  const meta: Array<[string, string]> = [
    ['Name', printNameOr(test.patientName)],
    ['Gender', test.patientGender || '-'],
    ['Age', formatAgeLong(test.patientAge, test.patientAgeUnit)],
    ['Contact', test.patientPhone || '-'],
  ];
  const meta2: Array<[string, string]> = [
    ['Patient Code', patientIdentifier],
    ['Referred By', printNameOr(test.doctorName)],
    ['Collection Date', collectionDate || '-'],
    ['Reporting Date', reportingDate || '-'],
  ];

  const metaCell = (label: string, value: string) => (
    <div key={label} style={{ display: 'flex', gap: '6px', lineHeight: 1.45 }}>
      <span style={{ color: BRAND.muted, minWidth: '78px', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: BRAND.ink, fontWeight: 600 }}>{value}</span>
    </div>
  );

  return (
    <div
      id={`report-${test.id}`}
      className="lab-report"
      style={{
        backgroundColor: BRAND.white,
        color: BRAND.ink,
        fontFamily: 'Arial, "Segoe UI", Helvetica, sans-serif',
        fontSize: '11px',
      }}
    >
      <style>{`
        /* Each test is a page of its own: a fixed body height lets the footer sit
           on the sheet edge instead of floating up under short results. Matches
           A4 less the 15mm @page margin the print window sets. */
        .lab-report .report-page {
          height: 267mm;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          page-break-after: always;
          break-after: page;
        }
        .lab-report .report-page:last-child { page-break-after: auto; break-after: auto; }
        .lab-report table { border-collapse: collapse; width: 100%; }
        /* Tight rows: the reference reports fit 15 parameters on one page, which
           only works if a row is type height plus a hairline, not a padded cell. */
        .lab-report .param-row td { padding: 2.2px 8px; border-bottom: 1px solid ${BRAND.lineSoft}; }
        .lab-report .quill-body p { margin: 0 0 4px 0; line-height: 1.45; }
        .lab-report .quill-body p:last-child { margin-bottom: 0; }
        .lab-report .quill-body ul, .lab-report .quill-body ol { margin: 0 0 4px 18px; padding: 0; }
        .lab-report .quill-body li { margin: 0 0 2px 0; line-height: 1.4; }
        .lab-report .quill-body .ql-align-center { text-align: center; }
        .lab-report .quill-body .ql-align-right { text-align: right; }
        .lab-report .quill-body .ql-align-justify { text-align: justify; }
        @media print {
          .lab-report .report-page { height: 267mm; }
        }
      `}</style>

      {groups.map((group, groupIndex) => {
        const template = testTemplates.find((tpl) => String(tpl.id) === group.templateId);
        const description = template?.description?.trim();
        const isLast = groupIndex === groups.length - 1;

        return (
          <div className="report-page" key={`${group.testName}-${groupIndex}`}>
            {/* ---------- Header: logo and identity left, LAB REPORT right ---------- */}
            {/* flex-end drops the right-hand block off the very top edge, so it
                settles level with the contact lines rather than the name. */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', minWidth: 0, paddingLeft: '5px' }}>
                {hospital?.logo && (
                  <img
                    src={hospital.logo}
                    alt=""
                    style={{ height: '82px', width: 'auto', objectFit: 'contain', flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      // A serif face gives the name the weight of a letterhead;
                      // the rest of the sheet stays sans for legibility at 10px.
                      fontFamily: 'Georgia, "Times New Roman", "Palatino Linotype", serif',
                      fontSize: '25px',
                      fontWeight: 700,
                      letterSpacing: '0.01em',
                      color: accent,
                      lineHeight: 1.12,
                      textTransform: 'uppercase',
                    }}
                  >
                    {hospital?.name}
                  </div>
                  {/* Black, not grey: thermal and laser output thins mid-greys to
                      the point of vanishing, and this is the line a patient rings. */}
                  <div style={{ fontSize: '11.5px', color: BRAND.ink, marginTop: '5px', lineHeight: 1.55 }}>
                    {hospital?.address}
                  </div>
                  <div style={{ fontSize: '11.5px', color: BRAND.ink, lineHeight: 1.55 }}>
                    {[hospital?.phone && `Phone: ${hospital.phone}`, hospital?.email && `Email: ${hospital.email}`]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, paddingBottom: '2px' }}>
                <div
                  style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    color: accent,
                    lineHeight: 1.25,
                  }}
                >
                  LAB REPORT
                </div>
                {/* Set quietly in black: the number identifies the sheet but
                    should not compete with the mark above it. */}
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: BRAND.ink,
                    marginTop: '2px',
                  }}
                >
                  {test.testNumber}
                </div>
              </div>
            </div>

            {/* Brand rule: cyan body with a red tail, echoing the logo. */}
            <div style={{ display: 'flex', marginTop: '8px' }}>
              <div style={{ height: '3px', backgroundColor: accent, flex: '1 1 auto' }} />
              <div style={{ height: '3px', backgroundColor: BRAND.red, width: '72px' }} />
            </div>

            {/* ---------- Patient / sample block ---------- */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '9px 0 10px',
                borderBottom: `1px solid ${BRAND.line}`,
                fontSize: '10.5px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 0' }}>
                {meta.map(([label, value]) => metaCell(label, value))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 0' }}>
                {meta2.map(([label, value]) => metaCell(label, value))}
              </div>
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <QRCodeCanvas value={qrValue} size={62} />
                <div style={{ fontSize: '7px', color: BRAND.muted, marginTop: '2px', letterSpacing: '0.08em' }}>
                  SCAN TO VERIFY
                </div>
              </div>
            </div>

            {/* ---------- Test title, centred ---------- */}
            <div style={{ textAlign: 'center', margin: '14px 0 8px' }}>
              <div
                style={{
                  display: 'inline-block',
                  fontSize: '14px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: BRAND.navy,
                  padding: '3px 22px 5px',
                  borderBottom: `2px solid ${accent}`,
                }}
              >
                {group.testName}
              </div>
            </div>

            {/* ---------- Parameters ---------- */}
            <table>
              <thead>
                <tr style={{ backgroundColor: accentWash }}>
                  {[
                    ['INVESTIGATION', 'left', '42%'],
                    ['RESULT', 'left', '18%'],
                    ['UNIT', 'left', '16%'],
                    ['NORMAL RANGE', 'right', '24%'],
                  ].map(([label, align, width]) => (
                    <th
                      key={label}
                      style={{
                        textAlign: align as 'left' | 'right',
                        width,
                        padding: '5px 8px',
                        fontSize: '9.5px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: accent,
                        borderTop: `1px solid ${BRAND.line}`,
                        borderBottom: `1px solid ${BRAND.line}`,
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.results.map((result, idx) => {
                  const verdict = rangeVerdict(result.result, result.normalRange);
                  return (
                    <tr className="param-row" key={`${result.parameterName}-${idx}`}>
                      <td style={{ fontSize: '10.5px', color: BRAND.ink }}>{result.parameterName}</td>
                      <td style={{ fontSize: '10.5px', fontWeight: 700, color: verdict ? BRAND.red : BRAND.ink }}>
                        {result.result || '-'}
                        {verdict && (
                          <span style={{ marginLeft: '5px', fontWeight: 700 }}>{verdict === 'high' ? '↑' : '↓'}</span>
                        )}
                      </td>
                      <td style={{ fontSize: '10px', color: BRAND.muted }}>{result.unit || ''}</td>
                      <td style={{ fontSize: '10px', color: BRAND.muted, textAlign: 'right' }}>
                        {result.normalRange || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Per-parameter notes, listed under the table so they never widen it. */}
            {group.results.some((r) => r.remarks?.trim()) && (
              <div style={{ marginTop: '8px', fontSize: '9.5px', color: BRAND.muted, lineHeight: 1.5 }}>
                {group.results
                  .filter((r) => r.remarks?.trim())
                  .map((r, idx) => (
                    <div key={idx}>
                      <span style={{ fontWeight: 700, color: BRAND.ink }}>{r.parameterName}:</span> {r.remarks}
                    </div>
                  ))}
              </div>
            )}

            {description && (
              <div style={{ marginTop: '12px', fontSize: '9.5px', color: BRAND.muted, lineHeight: 1.55 }}>
                <div style={{ fontWeight: 700, color: BRAND.navy, marginBottom: '2px' }}>Description:</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{description}</div>
              </div>
            )}

            {/* Overall remarks and signatures belong to the report, not to any one
                test, so they are printed once, at the end. */}
            {isLast && test.remarks && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontWeight: 700, color: BRAND.navy, fontSize: '10.5px', marginBottom: '4px' }}>
                  Lab Technician Remarks
                </div>
                <div
                  className="quill-body"
                  style={{
                    fontSize: '10px',
                    color: BRAND.ink,
                    borderLeft: `3px solid ${accent}`,
                    paddingLeft: '9px',
                  }}
                  dangerouslySetInnerHTML={{ __html: test.remarks }}
                />
              </div>
            )}

            {/* margin-top:auto pins everything below to the foot of the sheet. */}
            <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
              {isLast && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', marginBottom: '12px' }}>
                  {[
                    ['Performed By', test.completedBy || test.assignedToName || 'Lab Technician'],
                    ['Verified By', ''],
                  ].map(([label, value]) => (
                    <div key={label} style={{ flex: '0 0 210px', textAlign: 'center' }}>
                      <div style={{ height: '26px' }} />
                      <div style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: '3px' }}>
                        <div style={{ fontSize: '9.5px', fontWeight: 700, color: BRAND.navy }}>{label}</div>
                        <div style={{ fontSize: '9px', color: BRAND.muted }}>{value || ' '}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex' }}>
                <div style={{ height: '2px', backgroundColor: BRAND.red, width: '72px' }} />
                <div style={{ height: '2px', backgroundColor: accent, flex: '1 1 auto' }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '5px 2px 0',
                  fontSize: '8.5px',
                  color: BRAND.muted,
                }}
              >
                {/* The hospital's address and numbers are already set out in full
                    at the top of every page; repeating them here only crowded the
                    foot of the sheet. */}
                <span>{POWERED_BY_TEXT}</span>
                <span>
                  Page {groupIndex + 1} of {groups.length}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
