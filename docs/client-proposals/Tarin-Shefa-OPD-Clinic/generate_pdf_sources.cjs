const fs = require('fs');
const path = require('path');

const dir = __dirname;
const logo = 'tarin-shefa-opd-clinic-logo.jpeg';

const scopeRows = [
  ['Reception', 'Patient registration, front-desk workflow and reception finance/payment collection.', '4 day-shift + 2 night-shift staff requested.'],
  ['Pharmacy', 'Medicine records, purchases, sales, stock control and pharmacy reports.', '2 day-shift + 2 night-shift staff requested.'],
  ['Laboratory', 'Test ordering, sample workflow, results entry and laboratory reports.', '2 day-shift + 2 night-shift staff requested.'],
  ['Doctor Prescription', 'Electronic prescriptions and relevant patient clinical history.', '3 doctors across day/night operations.'],
  ['Ultrasound', 'Ultrasound workflow and reporting access.', 'One included doctor user; no separate account.'],
  ['Room Booking', 'Room availability and booking workflow.', 'Operated by authorized reception users.'],
  ['Surgery', 'Surgery scheduling/recording within the existing agreed module.', 'Operated by authorized reception users.'],
  ['HR', 'Configuration and reasonable modifications against confirmed requirements.', 'Requirements documented during discovery.'],
  ['Expenses', 'Expense recording/reporting and reasonable modifications.', 'Requirements documented during discovery.'],
];

const exclusions = [
  ['X-Ray module', 'Not included in the USD 1,800 implementation price.'],
  ['Dental module', 'Not included in the USD 1,800 implementation price.'],
  ['Any other new module', 'Separate analysis, quotation, approval and implementation schedule required.'],
];

const commercial = [
  ['System implementation', 'USD 1,800', 'One-time price for included scope and 16 initially configured named accounts.'],
  ['Maintenance + domain + hosting', 'USD 100/month', 'While active users remain at or below 24; begins at production go-live.'],
  ['More than 24 active users', 'Revised quotation', 'Price changes only through a written quotation/addendum.'],
  ['Minor changes', 'Included', 'Small refinements that do not create a new module or major redesign.'],
  ['New modules / major changes', 'Additional price', 'Written requirements, quotation and approval required.'],
];

const css = `
  @page { size: A4; margin: 18mm 16mm 17mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #303A46; font: 10.2pt/1.48 Arial, "Segoe UI", sans-serif; background: #fff; }
  .page { min-height: 258mm; position: relative; }
  .cover { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 4mm; page-break-after: always; }
  .logo { width: 43mm; height: 43mm; object-fit: contain; }
  .eyebrow { margin-top: 5mm; color: #00AFC1; font-size: 10pt; font-weight: 800; letter-spacing: .8px; }
  .cover h1 { max-width: 170mm; margin: 4mm auto 1mm; color: #0F2F66; font-size: 25pt; line-height: 1.12; letter-spacing: .2px; }
  .subtitle { color: #68717D; font-size: 12pt; margin-bottom: 12mm; }
  .prepared { color: #68717D; font-size: 9pt; }
  .client { color: #0F2F66; font-size: 18pt; font-weight: 800; margin: 1mm 0 2mm; }
  .address { direction: rtl; color: #0F2F66; font: 11pt/1.7 Arial, sans-serif; max-width: 170mm; }
  .provider { color: #00AFC1; font-weight: 800; margin-top: 10mm; }
  .meta { color: #68717D; font-size: 9pt; margin-top: 1mm; }
  .confidential { width: 100%; margin-top: 12mm; background: #0F2F66; color: white; padding: 3mm; font-size: 9pt; font-weight: 800; letter-spacing: .7px; }
  .header { color: #0F2F66; font-size: 8pt; font-weight: 800; text-align: right; border-bottom: 2px solid #00AFC1; padding-bottom: 2mm; margin-bottom: 5mm; }
  h2 { color: #0F2F66; font-size: 17pt; line-height: 1.2; margin: 5mm 0 2mm; break-after: avoid; }
  h3 { color: #00AFC1; font-size: 12pt; margin: 4mm 0 1.5mm; break-after: avoid; }
  p { margin: 0 0 2.5mm; }
  ul { margin: 1.5mm 0 3mm 6mm; padding-left: 5mm; }
  li { margin-bottom: 1.5mm; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 8.6pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { background: #0F2F66; color: white; text-align: left; padding: 2.2mm; border: 1px solid #C9D9DF; }
  td { padding: 2.1mm; vertical-align: top; border: 1px solid #C9D9DF; }
  tr:nth-child(even) td { background: #F1F8FA; }
  .red th { background: #DC202C; }
  .cyan th { background: #00AFC1; }
  .kv td:first-child { width: 29%; color: #0F2F66; font-weight: 800; background: #F1F8FA; }
  .note { margin: 3mm 0; padding: 3mm; border: 1.5px solid #DC202C; background: #FFF2F3; color: #A4131D; font-weight: 700; }
  .break { page-break-before: always; }
  .sign td { width: 50%; height: 13mm; }
  .sign tr:first-child td { background: #0F2F66; color: white; font-weight: 800; }
  .small { color: #68717D; font-size: 8.5pt; }
  .footer { color: #68717D; text-align: center; font-size: 8pt; margin-top: 8mm; border-top: 1px solid #C9D9DF; padding-top: 2mm; }
`;

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function table(headers, rows, className = '') {
  return `<table class="${className}"><thead><tr>${headers.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function kv(rows) { return `<table class="kv"><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`; }

function header(title) { return `<div class="header">SOFTCARE IT SOLUTIONS &nbsp; | &nbsp; ${esc(title)}</div>`; }
function footer() { return `<div class="footer">Confidential client document &nbsp; | &nbsp; SoftCare IT Solutions</div>`; }

function cover(type, subtitle, ref) {
  return `<section class="page cover">
    <img class="logo" src="${logo}" alt="Tarin Shefa OPD Clinic logo">
    <div class="eyebrow">SHIFAASCRIPT HOSPITAL MANAGEMENT SYSTEM</div>
    <h1>${esc(type)}</h1><div class="subtitle">${esc(subtitle)}</div>
    <div class="prepared">Prepared for</div><div class="client">TARIN SHEFA OPD CLINIC</div>
    <div class="address">ارزان قیمت د داود خان او ماموریت څلورلارو ترمنځ میرعلم ترین پلازا - کابل افغانستان</div>
    <div class="provider">Prepared by SoftCare IT Solutions</div>
    <div class="meta">06 September 2026</div><div class="meta">Reference: ${esc(ref)}</div>
    <div class="confidential">CONFIDENTIAL - FOR CLIENT REVIEW</div>
  </section>`;
}

function shell(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

const proposal = shell('Tarin Shefa OPD Clinic Proposal', `
  ${cover('COMMERCIAL & TECHNICAL PROPOSAL', 'Implementation, training, hosting and ongoing support', 'SCI/TSOC/PROP/2026-0906')}
  <main>${header('TARIN SHEFA OPD CLINIC - PROPOSAL')}
  <h2>1. Executive Summary</h2>
  <p>SoftCare IT Solutions proposes to implement ShifaaScript as a secure, role-based Hospital Management System for Tarin Shefa OPD Clinic. The solution connects reception, clinical, pharmacy, laboratory, operational and administrative workflows in one system, reduces duplicate records and improves accountability and reporting.</p>
  <p>The implementation includes the modules and services defined below, role-based training, 16 initially configured named user accounts including one administrator, and production deployment. Maintenance, domain, hosting and routine support are USD 100 per month while active users remain at or below 24.</p>
  <h3>Proposal at a glance</h3>${kv([
    ['Client','Tarin Shefa OPD Clinic'],['Solution','ShifaaScript Hospital Management System'],['Initial user limit','16 named accounts, including one administrator'],['One-time implementation','USD 1,800'],['Monthly service','USD 100 up to and including 24 active users'],['Training','Included for each authorized role'],['Schedule','Finalized at kickoff after requirements confirmation']
  ])}
  <h2>2. Business Objectives</h2><ul><li>One controlled source of patient and operational information.</li><li>Role-based access aligned with departmental responsibilities.</li><li>Improved registration, payment, prescription, laboratory, pharmacy and booking workflows.</li><li>Traceable records and practical management reports.</li><li>Controlled future expansion through approved users and modules.</li></ul>
  <h2 class="break">3. Included Functional Scope</h2>${table(['Module','Included capabilities','Planned access / notes'], scopeRows)}
  <h3>Scope interpretation</h3><p>HR and Expenses are included as existing modules, with reasonable configuration and modification based on requirements documented during discovery. Material architecture changes, substantially new workflows and new modules follow the change-control and additional-pricing process.</p>
  <h2>4. Excluded Scope</h2>${table(['Excluded item','Commercial treatment'], exclusions, 'red')}
  <h2>5. Users, Roles and Access Control</h2><p>The deployment provides 16 initially configured named accounts, including one administrator. Permissions are assigned by role and responsibility. Shared credentials are not recommended because they reduce auditability and accountability.</p>
  <div class="note">IMPORTANT: The supplied role figures describe 17 operational staff positions before Admin. Before go-live, the Clinic must confirm its named-user roster and legitimate multi-role assignments so initial active accounts remain within the agreed total of 16 including Admin. Any increase requires written approval.</div>
  <p>One doctor account will also receive Ultrasound access. Authorized reception accounts may receive Room Booking and Surgery permissions without separate accounts.</p>
  <h2>6. Implementation Approach</h2>${table(['Phase','Activities','Output'],[
    ['1. Discovery','Confirm workflows, roles, roster, reports and HR/Expense needs.','Approved requirements/checklist.'],['2. Configuration','Configure profile, modules, permissions, numbering and settings.','Configured staging environment.'],['3. Data preparation','Enter/import agreed initial master data supplied in usable format.','Validated initial data set.'],['4. Training & UAT','Role training and client user-acceptance testing.','Trained users and acceptance log.'],['5. Go-live','Production deployment and domain/hosting activation.','Operational production system.'],['6. Support','Routine maintenance, issues and eligible minor changes.','Ongoing monthly service.']
  ])}
  <h2>7. Training and Go-Live Support</h2><ul><li>Training for Reception/Finance, Pharmacy, Laboratory, Doctors/Ultrasound and Administration.</li><li>Login/security, daily workflow, corrections, reports and issue escalation.</li><li>The Clinic nominates users and provides suitable devices/connectivity.</li><li>Extra sessions after completion or due to staff turnover may be quoted separately.</li></ul>
  <h2 class="break">8. Commercial Offer</h2>${table(['Commercial item','Price','Billing / condition'], commercial, 'cyan')}
  <h3>Suggested implementation payment schedule</h3>${kv([['50% - Signing / kickoff','USD 900'],['30% - Ready for UAT','USD 540'],['20% - Go-live / acceptance','USD 360']])}
  <p class="small">These milestones are included in the accompanying draft agreement and may be changed by mutual written approval before signature.</p>
  <h2>9. Monthly Maintenance Coverage</h2><ul><li>Production domain and hosting.</li><li>Routine maintenance, security updates and reasonable operational support.</li><li>Routine backup administration subject to the selected hosting environment.</li><li>Minor changes that do not create a new module or materially redesign a workflow.</li><li>USD 100 monthly while active users are 24 or fewer; above 24 requires a revised quotation.</li></ul>
  <h2>10. Assumptions and Client Responsibilities</h2><ul><li>Provide accurate data, forms, roster, process owners and timely decisions.</li><li>Computers, printers, local network, power and internet are the Clinic responsibility unless quoted.</li><li>Protect credentials, disable departed users and comply with confidentiality obligations.</li><li>Delivery dates depend on timely requirements, data, feedback, testing and approvals.</li></ul>
  <h2>11. Proposal Validity and Acceptance</h2><p>This proposal is valid for 30 calendar days from 06 September 2026. Final work is governed by the separately signed Service Agreement. This commercial draft should be reviewed by both Parties before signature.</p>
  ${table(['For SoftCare IT Solutions','For Tarin Shefa OPD Clinic'],[['Name: __________________________','Name: __________________________'],['Title: ___________________________','Title: ___________________________'],['Signature: ______________________','Signature: ______________________'],['Date: ___________________________','Date: ___________________________'],['Company stamp:','','Clinic stamp:']].map(r=>r.slice(0,2)), 'sign')}
  ${footer()}</main>`);

const clauses = [
  ['1. Purpose','The Clinic appoints SoftCare to configure, implement, host, train users on and maintain ShifaaScript according to this Agreement and its schedules. SoftCare accepts subject to timely cooperation, payment and access.'],
  ['2. Agreement Documents and Priority','This Agreement includes Schedule A (Scope), Schedule B (Users, Training and Delivery) and Schedule C (Fees and Maintenance). In conflict, the signed Agreement takes priority, then its schedules, then the proposal. A later signed addendum overrides a conflicting earlier term.'],
  ['3. Included System Scope','SoftCare provides the modules in Schedule A. HR and Expenses receive reasonable configuration and modification against jointly documented requirements. Work outside scope uses Clause 9 change control.'],
  ['4. User Accounts and Role-Based Access','Initial deployment includes 16 active named accounts including one administrator. Access follows approved roles. Ultrasound may be assigned to an included doctor; Room Booking and Surgery to authorized reception users. Credentials must not be shared.'],
  ['5. Implementation and Cooperation','SoftCare conducts discovery, configuration, agreed initial data setup, training, UAT support and deployment. Timeline is agreed at kickoff. The Clinic provides accurate data, forms, authorized contacts, decisions, test users, feedback and approvals. Clinic-caused dependency delays extend affected dates.'],
  ['6. User Acceptance and Go-Live','SoftCare notifies readiness for UAT. The Clinic tests agreed workflows and reports reproducible material issues in writing. SoftCare corrects confirmed material non-conformities within a reasonable period. Go-live, productive use or written confirmation constitutes acceptance. Minor issues do not prevent acceptance.'],
  ['7. Training','Initial role-group training is included for Reception/Finance, Pharmacy, Laboratory, Doctors/Ultrasound and Administration. The Clinic ensures attendance, devices, internet/power and coordination. Additional training due to turnover, missed sessions or new scope may be charged after approval.'],
  ['8. Implementation Fee and Payment','The one-time fee is USD 1,800: USD 900 (50%) on signing/kickoff; USD 540 (30%) when ready for UAT; and USD 360 (20%) on go-live or acceptance, unless changed in writing. SoftCare may pause work/access for overdue undisputed amounts after notice.'],
  ['9. Change Control','Maintenance includes minor configuration, wording, field, layout or report refinements that do not create a new module or major redesign. X-Ray, Dental and other new modules are excluded. Major changes require written requirements, separate quotation, approval and schedule.'],
  ['10. Monthly Maintenance, Domain and Hosting','From go-live, the Clinic pays USD 100 monthly in advance for routine maintenance, domain, hosting and routine support while active users are 24 or fewer. Above 24, a revised quotation applies only after written agreement. Overdue undisputed invoices may result in suspension after notice.'],
  ['11. Support and Maintenance Standard','SoftCare uses commercially reasonable efforts to maintain the application, apply updates, administer routine backups and address reproducible issues. Maintenance excludes Clinic devices/networks/power/internet, unsupported third parties, misuse, shared credentials, unauthorized changes and events outside SoftCare control.'],
  ['12. Clinic Responsibilities','The Clinic provides lawful/accurate data, decision-makers, suitable equipment/connectivity, user administration, credential protection, entry verification and compliance with applicable patient confidentiality, medical record and employment obligations.'],
  ['13. Data Ownership, Access and Export','The Clinic owns its patient, clinical, financial, staffing and operational data. SoftCare accesses it only to implement, host, support, secure or troubleshoot, or as authorized. After termination and settlement of undisputed dues, SoftCare provides a reasonable standard-format export; custom migration may be quoted.'],
  ['14. Software and Intellectual Property','SoftCare retains ShifaaScript, source code, architecture, reusable components, documentation, methods and general improvements. The Clinic receives a non-exclusive, non-transferable right to use the hosted system for its own operations during the Agreement. Copying, resale, reverse engineering, sublicensing or third-party provision requires written permission.'],
  ['15. Confidentiality and Security','Each Party reasonably protects the other’s non-public business, technical, financial and patient information and limits disclosure to personnel who need it. The Clinic controls authorized users and lawful patient-data use. Relevant suspected incidents must be reported promptly.'],
  ['16. Warranties and Limitations','SoftCare warrants reasonable professional care and substantial conformity with scope. Service remains subject to hosting, connectivity and third parties. Neither Party is liable for indirect, incidental or consequential loss. SoftCare aggregate liability is capped at fees paid in the prior six months, except where prohibited by law.'],
  ['17. Term, Suspension and Termination','The Agreement begins on the Effective Date. Monthly service continues until terminated. Either Party may terminate with 30 days written notice after settling undisputed obligations. A curable material breach receives 15 days to cure. Termination includes an agreed data-export period.'],
  ['18. Force Majeure','Neither Party is liable for delay/failure beyond reasonable control, including disaster, widespread outage, government restriction, conflict, civil disturbance or major third-party failure. The affected Party notifies and resumes when possible.'],
  ['19. Notices and Dispute Resolution','Operational notices use designated written channels. Parties first seek good-faith resolution. Unresolved disputes are subject to laws applicable in Afghanistan and competent courts of Kabul unless another written arrangement is signed.'],
  ['20. General Terms','Assignment requires consent except lawful succession assuming obligations. Unenforceability of one provision does not affect the rest. Waivers and amendments must be written. This Agreement and signed addenda form the entire agreement. Electronic/scanned counterparts may document agreement subject to applicable requirements.'],
];

const agreement = shell('Tarin Shefa OPD Clinic Service Agreement', `
  ${cover('SOFTWARE IMPLEMENTATION & SERVICE AGREEMENT', 'ShifaaScript Hospital Management System', 'SCI/TSOC/AGR/2026-0906')}
  <main>${header('TARIN SHEFA OPD CLINIC - AGREEMENT')}
  <p>This Software Implementation and Service Agreement (the “Agreement”) is entered into on ____ / ____ / 2026 (the “Effective Date”) by and between:</p>
  ${kv([['Service Provider','SoftCare IT Solutions (“SoftCare”), represented by ____________________, Title ____________________.'],['Client','Tarin Shefa OPD Clinic (the “Clinic”), represented by ____________________, Title ____________________.'],['Client address','ارزان قیمت د داود خان او ماموریت څلورلارو ترمنځ میرعلم ترین پلازا - کابل افغانستان']])}
  <p>SoftCare and the Clinic are individually a “Party” and together the “Parties”.</p>
  ${clauses.map((c, i) => `${i === 10 ? '<div class="break"></div>' : ''}<h2>${esc(c[0])}</h2><p>${esc(c[1])}</p>${i===3?'<div class="note">IMPORTANT: Supplied staffing figures describe 17 operational positions before Admin. The Clinic must finalize multi-role assignments or revise the roster so initial deployment remains within 16 active named accounts including Admin. Any increase requires written approval.</div>':''}`).join('')}
  <h2 class="break">Schedule A - Included and Excluded Scope</h2>${table(['Module','Included capabilities','Planned access / notes'], scopeRows)}
  <h3>Excluded scope</h3>${table(['Excluded item','Commercial treatment'], exclusions, 'red')}
  <h2>Schedule B - Users, Training and Delivery</h2>${kv([['Initial active accounts','16 total, including one Admin account'],['Maintenance threshold','USD 100/month while active users are 24 or fewer'],['Reception request','4 day + 2 night staff; final roster subject to 16-user cap'],['Pharmacy request','2 day + 2 night staff'],['Laboratory request','2 day + 2 night staff'],['Doctor request','3 doctors; one may also hold Ultrasound permission'],['Role training','Included for each initial role group'],['Delivery dates','Confirmed after requirements, data and roster readiness']])}
  <h2 class="break">Schedule C - Fees and Maintenance</h2>${table(['Commercial item','Price','Billing / condition'], commercial, 'cyan')}${kv([['Signing / kickoff','USD 900'],['Ready for UAT','USD 540'],['Go-live / acceptance','USD 360'],['Monthly service from go-live','USD 100, payable monthly in advance']])}
  <h2>Signatures</h2><p>Authorized representatives confirm that they have read, understood and agreed to this Agreement and its schedules.</p>
  ${table(['SOFTCARE IT SOLUTIONS','TARIN SHEFA OPD CLINIC'],[['Name: __________________________','Name: __________________________'],['Title: ___________________________','Title: ___________________________'],['Signature: ______________________','Signature: ______________________'],['Date: ___________________________','Date: ___________________________'],['Company stamp:','Clinic stamp:']], 'sign')}
  <p class="small">Drafting note: Review before signature. Both Parties should confirm legal names, representative authority, effective date, contacts, account roster and required local legal/tax details.</p>
  ${footer()}</main>`);

fs.writeFileSync(path.join(dir, 'Tarin-Shefa-OPD-Clinic-Proposal.print.html'), proposal, 'utf8');
fs.writeFileSync(path.join(dir, 'Tarin-Shefa-OPD-Clinic-Service-Agreement.print.html'), agreement, 'utf8');
console.log('PDF print sources generated.');
