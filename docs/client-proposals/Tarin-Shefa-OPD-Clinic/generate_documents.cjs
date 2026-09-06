const fs = require('fs');
const path = require('path');
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextDirection,
  TextRun,
  VerticalAlign,
  WidthType,
} = require('./.docgen/node_modules/docx');

const outputDir = __dirname;
const logoPath = path.join(outputDir, 'tarin-shefa-opd-clinic-logo.jpeg');
const proposalPath = path.join(outputDir, 'Tarin-Shefa-OPD-Clinic-Proposal.docx');
const agreementPath = path.join(outputDir, 'Tarin-Shefa-OPD-Clinic-Service-Agreement.docx');

const C = {
  navy: '0F2F66',
  cyan: '00AFC1',
  green: '2E9E57',
  red: 'DC202C',
  ink: '303A46',
  gray: '68717D',
  pale: 'F1F8FA',
  paleRed: 'FFF2F3',
  white: 'FFFFFF',
  line: 'C9D9DF',
};

const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: C.line },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: C.line },
  left: { style: BorderStyle.SINGLE, size: 4, color: C.line },
  right: { style: BorderStyle.SINGLE, size: 4, color: C.line },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: C.line },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: C.line },
};

function run(text, options = {}) {
  return new TextRun({ text, font: options.font || 'Aptos', size: options.size || 21, color: options.color || C.ink, bold: options.bold || false, italics: options.italics || false });
}

function p(text, options = {}) {
  const children = Array.isArray(text) ? text : [run(text, options)];
  return new Paragraph({
    children,
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: { before: options.before || 0, after: options.after ?? 120, line: options.line || 300 },
    indent: options.indent,
    bidirectional: options.bidirectional || false,
    keepNext: options.keepNext || false,
    pageBreakBefore: options.pageBreakBefore || false,
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [run(text, { size: 34, color: C.navy, bold: true })],
    spacing: { before: 220, after: 120 },
    keepNext: true,
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [run(text, { size: 26, color: C.cyan, bold: true })],
    spacing: { before: 160, after: 80 },
    keepNext: true,
  });
}

function bullet(text) {
  return new Paragraph({
    children: [run(text)],
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 70, line: 285 },
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function cell(text, options = {}) {
  const paragraphs = Array.isArray(text)
    ? text
    : [p([run(String(text), { size: options.size || 18, color: options.color || C.ink, bold: options.bold || false })], { after: 30, line: 250 })];
  return new TableCell({
    children: paragraphs,
    shading: options.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: options.fill } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 100, right: 100 },
    width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
    textDirection: options.rtl ? TextDirection.RIGHT_TO_LEFT : undefined,
  });
}

function dataTable(headers, rows, widths, headerColor = C.navy) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((text, i) => cell(text, { width: widths[i], fill: headerColor, color: C.white, bold: true, size: 18 })),
  });
  const bodyRows = rows.map((row, r) => new TableRow({
    cantSplit: true,
    children: row.map((text, i) => cell(text, { width: widths[i], fill: r % 2 === 0 ? C.pale : C.white, size: 17 })),
  }));
  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: thinBorders,
    layout: 'fixed',
  });
}

function keyValue(rows) {
  return new Table({
    rows: rows.map((row, i) => new TableRow({
      cantSplit: true,
      children: [
        cell(row[0], { width: 2500, fill: C.pale, color: C.navy, bold: true, size: 18 }),
        cell(row[1], { width: 6200, fill: i % 2 === 0 ? C.white : 'FBFDFE', size: 18 }),
      ],
    })),
    width: { size: 8700, type: WidthType.DXA },
    borders: thinBorders,
    layout: 'fixed',
  });
}

function note(text, color = C.red, fill = C.paleRed) {
  return new Table({
    rows: [new TableRow({ children: [cell([p([run('IMPORTANT: ', { bold: true, color }), run(text, { color })], { after: 0, line: 285 })], { width: 8700, fill })] })],
    width: { size: 8700, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color },
      bottom: { style: BorderStyle.SINGLE, size: 8, color },
      left: { style: BorderStyle.SINGLE, size: 8, color },
      right: { style: BorderStyle.SINGLE, size: 8, color },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
  });
}

function header(title) {
  return new Header({ children: [
    new Paragraph({
      children: [run('SOFTCARE IT SOLUTIONS', { size: 16, color: C.navy, bold: true }), run(`  |  ${title}`, { size: 16, color: C.gray })],
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.cyan, space: 4 } },
      spacing: { after: 60 },
    }),
  ] });
}

function footer() {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [run('Confidential  |  ', { size: 16, color: C.gray }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.gray }), run(' of ', { size: 16, color: C.gray }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.gray })],
  })] });
}

function cover(documentType, subtitle, reference) {
  return [
    p([new ImageRun({ data: fs.readFileSync(logoPath), transformation: { width: 170, height: 170 }, type: 'jpg' })], { alignment: AlignmentType.CENTER, after: 180 }),
    p([run('SHIFAASCRIPT HOSPITAL MANAGEMENT SYSTEM', { size: 22, color: C.cyan, bold: true })], { alignment: AlignmentType.CENTER, after: 100 }),
    p([run(documentType, { size: 48, color: C.navy, bold: true })], { alignment: AlignmentType.CENTER, after: 100, line: 320 }),
    p([run(subtitle, { size: 25, color: C.gray })], { alignment: AlignmentType.CENTER, after: 320 }),
    p([run('Prepared for', { size: 19, color: C.gray })], { alignment: AlignmentType.CENTER, after: 40 }),
    p([run('TARIN SHEFA OPD CLINIC', { size: 34, color: C.navy, bold: true })], { alignment: AlignmentType.CENTER, after: 80 }),
    p([run('ارزان قیمت د داود خان او ماموریت څلورلارو ترمنځ میرعلم ترین پلازا - کابل افغانستان', { font: 'Arial', size: 21, color: C.navy })], { alignment: AlignmentType.CENTER, bidirectional: true, after: 260 }),
    p([run('Prepared by SoftCare IT Solutions', { size: 22, color: C.cyan, bold: true })], { alignment: AlignmentType.CENTER, after: 50 }),
    p([run('06 September 2026', { size: 19, color: C.gray })], { alignment: AlignmentType.CENTER, after: 40 }),
    p([run(`Reference: ${reference}`, { size: 17, color: C.gray })], { alignment: AlignmentType.CENTER, after: 260 }),
    new Table({
      width: { size: 8700, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: [new TableRow({ children: [cell('CONFIDENTIAL - FOR CLIENT REVIEW', { width: 8700, fill: C.navy, color: C.white, bold: true })] })],
    }),
    pageBreak(),
  ];
}

const scopeRows = [
  ['Reception', 'Patient registration, front-desk workflow and reception finance/payment collection.', 'Requested coverage: 4 day-shift and 2 night-shift staff.'],
  ['Pharmacy', 'Medicine records, purchase and sales transactions, stock control and pharmacy reporting.', 'Requested coverage: 2 day-shift and 2 night-shift staff.'],
  ['Laboratory', 'Test ordering, sample workflow, results entry and laboratory reports.', 'Requested coverage: 2 day-shift and 2 night-shift staff.'],
  ['Doctor Prescription', 'Electronic prescriptions and access to relevant patient clinical history.', 'Requested coverage: 3 doctors across day/night operations.'],
  ['Ultrasound', 'Ultrasound workflow and reporting access.', 'One included doctor user; no separate user allocation.'],
  ['Room Booking', 'Room availability and booking workflow.', 'Operated by authorized reception users.'],
  ['Surgery', 'Surgery scheduling/recording within the agreed existing module.', 'Operated by authorized reception users.'],
  ['HR', 'HR module configuration and reasonable modifications based on confirmed requirements.', 'Detailed requirements documented during discovery.'],
  ['Expenses', 'Expense recording/reporting configuration and reasonable modifications based on confirmed requirements.', 'Detailed requirements documented during discovery.'],
];

const exclusionRows = [
  ['X-Ray module', 'Not included in the USD 1,800 implementation price.'],
  ['Dental module', 'Not included in the USD 1,800 implementation price.'],
  ['Any other new module', 'Requires separate analysis, written quotation, approval and implementation schedule.'],
];

const commercialRows = [
  ['System implementation', 'USD 1,800', 'One-time price for included scope and 16 initially configured named accounts.'],
  ['Maintenance + domain + hosting', 'USD 100/month', 'Applies while active users remain at or below 24; begins at production go-live.'],
  ['More than 24 active users', 'Revised quotation', 'Price increases only through written quotation/addendum.'],
  ['Minor changes', 'Included', 'Small refinements that do not create a new module or major workflow redesign.'],
  ['New modules / major changes', 'Additional price', 'Written requirements, quotation and approval required before work begins.'],
];

function signatureTable() {
  return dataTable(
    ['For SoftCare IT Solutions', 'For Tarin Shefa OPD Clinic'],
    [
      ['Name: __________________________\n\nTitle: ___________________________', 'Name: __________________________\n\nTitle: ___________________________'],
      ['Signature: ______________________', 'Signature: ______________________'],
      ['Date: ___________________________', 'Date: ___________________________'],
      ['Company stamp:\n\n\n', 'Clinic stamp:\n\n\n'],
    ],
    [4350, 4350],
    C.navy,
  );
}

function commonStyles() {
  return {
    default: { document: { run: { font: 'Aptos', size: 21, color: C.ink }, paragraph: { spacing: { after: 120, line: 300 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Aptos Display', size: 34, bold: true, color: C.navy }, paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Aptos Display', size: 26, bold: true, color: C.cyan }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 1 } },
    ],
  };
}

function documentOptions(title, shortTitle, children) {
  return {
    creator: 'SoftCare IT Solutions',
    title,
    subject: 'ShifaaScript Hospital Management System',
    description: `${title} for Tarin Shefa OPD Clinic`,
    styles: commonStyles(),
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 220 } } } }] }] },
    sections: [{
      properties: { page: { margin: { top: 800, right: 820, bottom: 760, left: 820, header: 330, footer: 330 } } },
      headers: { default: header(shortTitle) },
      footers: { default: footer() },
      children,
    }],
  };
}

function proposalChildren() {
  return [
    ...cover('COMMERCIAL & TECHNICAL PROPOSAL', 'Implementation, training, hosting and ongoing support', 'SCI/TSOC/PROP/2026-0906'),
    h1('1. Executive Summary'),
    p('SoftCare IT Solutions proposes to implement ShifaaScript as a secure, role-based Hospital Management System for Tarin Shefa OPD Clinic. The solution will connect reception, clinical, pharmacy, laboratory, operational and administrative workflows in one system, reduce duplicate records, improve accountability and support timely management reporting.'),
    p('The quoted implementation includes the modules and services defined in this proposal, role-based training, 16 initially configured named user accounts including one administrator, and production deployment. Ongoing maintenance, domain, hosting and routine operating support are provided for USD 100 per month while active users remain at or below 24.'),
    h2('Proposal at a glance'),
    keyValue([
      ['Client', 'Tarin Shefa OPD Clinic'],
      ['Solution', 'ShifaaScript Hospital Management System'],
      ['Initial user limit', '16 named accounts in total, including one administrator'],
      ['One-time implementation', 'USD 1,800'],
      ['Monthly service', 'USD 100 up to and including 24 active users'],
      ['Training', 'Included for each authorized role'],
      ['Implementation schedule', 'Finalized at kickoff after requirements confirmation'],
    ]),
    h1('2. Business Objectives'),
    bullet('Create a single, controlled source of patient and operational information.'),
    bullet('Apply role-based access so each department works only within authorized responsibilities.'),
    bullet('Improve patient registration, payment collection, prescription, laboratory, pharmacy and booking workflows.'),
    bullet('Provide traceable records and practical reports for management oversight.'),
    bullet('Support future growth through controlled user expansion and separately approved modules.'),
    h1('3. Included Functional Scope'),
    dataTable(['Module', 'Included capabilities', 'Planned access / notes'], scopeRows, [1600, 3900, 3200]),
    h2('Scope interpretation'),
    p('HR and Expenses are included as existing modules, with reasonable configuration and modification based on requirements documented during discovery. A request that materially changes the architecture, introduces a substantially new workflow, or creates a new module follows the change-control and additional-pricing process.'),
    h1('4. Excluded Scope'),
    dataTable(['Excluded item', 'Commercial treatment'], exclusionRows, [2500, 6200], C.red),
    h1('5. Users, Roles and Access Control'),
    p('The commercial scope provides 16 initially configured named user accounts, including one administrator. Permissions will be assigned by role, department and operational responsibility. Shared credentials are not recommended because they reduce auditability and accountability.'),
    note('The supplied staffing figures for Reception (6), Pharmacy (4), Laboratory (4) and Doctors (3) describe 17 operational staff positions before the administrator account. Before go-live, the Clinic must confirm its final named-user roster and any legitimate multi-role assignments so the active-account count remains within the agreed total of 16. Any increase requires written approval.'),
    p('One included doctor account will also receive Ultrasound access. Authorized reception accounts may receive Room Booking and Surgery permissions without requiring separate accounts.'),
    h1('6. Implementation Approach'),
    dataTable(['Phase', 'Activities', 'Output'], [
      ['1. Discovery', 'Confirm workflows, roles, roster, reports and HR/Expense requirements.', 'Approved requirements and checklist.'],
      ['2. Configuration', 'Configure hospital profile, modules, permissions, numbering and settings.', 'Configured staging environment.'],
      ['3. Data preparation', 'Enter/import mutually agreed initial master data supplied in usable format.', 'Validated initial data set.'],
      ['4. Training & UAT', 'Role-based training and client user-acceptance testing.', 'Trained users and acceptance log.'],
      ['5. Go-live', 'Production deployment, domain/hosting activation and controlled launch.', 'Operational production system.'],
      ['6. Support', 'Routine maintenance, issue resolution and eligible minor changes.', 'Ongoing monthly service.'],
    ], [1500, 4300, 2900]),
    h1('7. Training and Go-Live Support'),
    bullet('Training for Reception/Finance, Pharmacy, Laboratory, Doctors/Ultrasound and Administration.'),
    bullet('Coverage of login/security, daily workflow, corrections, reports and issue escalation.'),
    bullet('The Clinic will nominate users, ensure attendance and provide suitable devices/connectivity.'),
    bullet('Extra sessions caused by staff turnover or requested later may be quoted separately.'),
    h1('8. Commercial Offer'),
    dataTable(['Commercial item', 'Price', 'Billing / condition'], commercialRows, [2800, 1600, 4300], C.cyan),
    h2('Suggested implementation payment schedule'),
    keyValue([
      ['50% - Contract signing / kickoff', 'USD 900'],
      ['30% - Configured system ready for UAT', 'USD 540'],
      ['20% - Production go-live / acceptance', 'USD 360'],
    ]),
    p('These payment milestones are included in the accompanying draft agreement and may be changed by mutual written approval before signature.', { size: 18, color: C.gray }),
    h1('9. Monthly Maintenance Coverage'),
    bullet('Domain and hosting costs for the production system.'),
    bullet('Routine application maintenance, security updates and reasonable operational support.'),
    bullet('Routine backup administration subject to the selected hosting environment.'),
    bullet('Minor changes that do not create a new module or materially redesign an approved workflow.'),
    bullet('USD 100 monthly while active users are 24 or fewer; above 24 requires a revised quotation.'),
    h1('10. Assumptions and Client Responsibilities'),
    bullet('Provide accurate master data, approved forms, staff roster, process owners and timely decisions.'),
    bullet('Clinic computers, printers, local networking, power and internet are excluded unless quoted.'),
    bullet('Protect credentials, disable departed users and comply with patient-confidentiality duties.'),
    bullet('Delivery dates depend on timely requirements, data, feedback, testing and approvals.'),
    h1('11. Proposal Validity and Acceptance'),
    p('This proposal is valid for 30 calendar days from 06 September 2026. Final work will be governed by the separately signed Service Agreement. This is a commercial draft and should be reviewed by both Parties before signature.'),
    signatureTable(),
  ];
}

function clause(number, title, text) {
  return [h1(`${number}. ${title}`), p(text)];
}

function agreementChildren() {
  const clauses = [
    ['1', 'Purpose', 'The Clinic appoints SoftCare to configure, implement, host, train users on and maintain the ShifaaScript Hospital Management System according to this Agreement and its schedules. SoftCare accepts the appointment subject to timely cooperation, payment and access from the Clinic.'],
    ['2', 'Agreement Documents and Priority', 'This Agreement includes Schedule A (Included and Excluded Scope), Schedule B (Users, Training and Delivery) and Schedule C (Fees and Maintenance). If documents conflict, the signed Agreement takes priority, followed by its schedules, followed by the accepted proposal. A later signed addendum overrides a conflicting earlier term.'],
    ['3', 'Included System Scope', 'SoftCare will provide the modules and access described in Schedule A. HR and Expenses will be reasonably configured and modified against requirements jointly documented during discovery. Work outside the included scope requires the written change-control process in Clause 9.'],
    ['4', 'User Accounts and Role-Based Access', 'The initial deployment includes a maximum of 16 active named user accounts in total, including one administrator. Users receive permissions according to approved roles. Ultrasound may be assigned to an included doctor account; Room Booking and Surgery may be assigned to authorized reception accounts. Credentials must not be shared. The Clinic approves the final user and permission roster before go-live.'],
    ['5', 'Implementation and Cooperation', 'SoftCare will conduct discovery, configuration, agreed initial data setup, role training, user-acceptance support and production deployment. The detailed timeline will be agreed at kickoff. The Clinic will provide accurate data, forms, authorized contacts, process decisions, test users, feedback and approvals on time. Delay in Clinic dependencies extends affected delivery dates without placing SoftCare in breach.'],
    ['6', 'User Acceptance and Go-Live', 'SoftCare will notify the Clinic when the configured system is ready for user-acceptance testing (UAT). The Clinic will test the agreed workflows and report reproducible material issues in writing. SoftCare will correct confirmed material non-conformities within a reasonable period. Go-live, productive use or written confirmation constitutes acceptance. Minor issues that do not prevent normal use will be handled through support and will not prevent acceptance.'],
    ['7', 'Training', 'SoftCare will provide initial training for Reception/Finance, Pharmacy, Laboratory, Doctors/Ultrasound and Administration. The Clinic is responsible for attendance, appropriate devices, internet/power and internal coordination. Additional training due to staff turnover, missed sessions or new scope may be charged after written approval.'],
    ['8', 'Implementation Fee and Payment', 'The fixed one-time implementation fee is USD 1,800. Unless the Parties sign another schedule, payment is due as follows: USD 900 (50%) on signing/kickoff; USD 540 (30%) when ready for UAT; and USD 360 (20%) on production go-live or acceptance. SoftCare may pause work or access for overdue undisputed amounts after written notice. Each Party bears taxes and transaction charges allocated to it by applicable requirements.'],
    ['9', 'Change Control', 'Monthly maintenance includes minor configuration, wording, field, layout or report refinements that do not create a new module, materially redesign a workflow, require substantial migration or change core architecture. X-Ray, Dental and every other new module are excluded. Major changes and new modules require written requirements, a separate quotation, approval and schedule before work starts.'],
    ['10', 'Monthly Maintenance, Domain and Hosting', 'From production go-live, the Clinic will pay USD 100 per month in advance for routine maintenance, domain, hosting and related routine operating support while active users are 24 or fewer. Above 24 users, SoftCare may issue a revised quotation reflecting additional infrastructure and support; the new price applies after written agreement. Undisputed overdue monthly invoices may result in suspension after reasonable notice.'],
    ['11', 'Support and Maintenance Standard', 'SoftCare will use commercially reasonable efforts to maintain the hosted application, apply routine security and software updates, administer routine backups in the selected hosting environment and address reproducible system issues. Maintenance excludes failures caused by Clinic devices, local networks, power, internet providers, unsupported third parties, misuse, shared credentials, unauthorized changes or events outside SoftCare control.'],
    ['12', 'Clinic Responsibilities', 'The Clinic will provide lawful and accurate data; designate decision-makers; maintain suitable devices, printers, local networking, connectivity and power; manage user access and disable departed personnel; protect credentials; verify operational and financial entries; and comply with applicable patient confidentiality, medical record and employment obligations.'],
    ['13', 'Data Ownership, Access and Export', 'The Clinic owns patient, clinical, financial, staffing and operational data entered into the system. SoftCare may access it only as needed to implement, host, support, secure or troubleshoot the service, or as authorized. On termination and settlement of undisputed dues, SoftCare will provide a reasonable export in an available standard format. Custom extraction, conversion or migration may be quoted separately.'],
    ['14', 'Software and Intellectual Property', 'SoftCare retains ownership and intellectual-property rights in ShifaaScript, source code, architecture, reusable components, documentation, methods and general improvements. Payment grants the Clinic a non-exclusive, non-transferable right to use the hosted system for its own operations during the Agreement. The Clinic may not copy, resell, reverse engineer, sublicense or provide it to another organization without written permission from SoftCare.'],
    ['15', 'Confidentiality and Security', 'Each Party will protect the non-public business, technical, financial and patient-related information of the other Party using reasonable safeguards and disclose it only to personnel who need it for this Agreement. The Clinic remains responsible for authorized users and lawful patient-data use. No internet-based system can be guaranteed completely free from interruption or security risk; each Party will promptly notify the other of a relevant suspected incident.'],
    ['16', 'Warranties and Limitations', 'SoftCare warrants reasonable professional care and substantial conformity with the agreed scope. The service remains subject to hosting, connectivity and third-party limitations. Neither Party is liable for indirect, incidental or consequential loss. SoftCare aggregate liability will not exceed fees paid by the Clinic in the six months before the event giving rise to the claim, except where prohibited by applicable law.'],
    ['17', 'Term, Suspension and Termination', 'This Agreement begins on the Effective Date. Implementation continues through acceptance, and monthly service continues until terminated. Either Party may terminate ongoing monthly service with 30 days of written notice after settling undisputed obligations. A curable material breach receives 15 days to cure after written notice. On termination, access may end after the effective date, subject to an agreed data-export period and payment of outstanding undisputed amounts.'],
    ['18', 'Force Majeure', 'Neither Party is liable for delay or failure caused by events beyond reasonable control, including natural disaster, widespread power or telecommunications outage, government restriction, conflict, civil disturbance or major third-party infrastructure failure. The affected Party will notify the other when reasonably possible and resume performance when the event ends.'],
    ['19', 'Notices and Dispute Resolution', 'Operational notices may use the designated email or written channels of the Parties. The Parties first attempt in good faith to resolve a dispute through authorized representatives. If unresolved, the dispute is subject to the laws applicable in Afghanistan and competent courts of Kabul, unless the Parties sign another dispute-resolution arrangement.'],
    ['20', 'General Terms', 'Neither Party may assign this Agreement without written consent of the other, except through lawful business succession that assumes the obligations. If one provision is unenforceable, the rest continues. A waiver must be written. This Agreement and signed addenda are the entire agreement for the stated subject. Amendments must be written and signed. Electronic/scanned counterparts may document agreement subject to applicable requirements.'],
  ];

  const intro = [
    ...cover('SOFTWARE IMPLEMENTATION & SERVICE AGREEMENT', 'ShifaaScript Hospital Management System', 'SCI/TSOC/AGR/2026-0906'),
    p('This Software Implementation and Service Agreement (the “Agreement”) is entered into on ____ / ____ / 2026 (the “Effective Date”) by and between:'),
    keyValue([
      ['Service Provider', 'SoftCare IT Solutions (“SoftCare”), represented by ______________________________, Title ______________________________.'],
      ['Client', 'Tarin Shefa OPD Clinic (the “Clinic”), represented by ______________________________, Title ______________________________.'],
      ['Client address', 'ارزان قیمت د داود خان او ماموریت څلورلارو ترمنځ میرعلم ترین پلازا - کابل افغانستان'],
    ]),
    p('SoftCare and the Clinic are individually a “Party” and together the “Parties”.'),
  ];

  const body = clauses.flatMap(([n, t, text]) => clause(n, t, text));
  body.splice(8, 0, note('The supplied staffing figures describe 17 operational staff positions before Admin. The Clinic must finalize multi-role assignments or revise the roster so initial deployment remains within 16 active named accounts including Admin. Any increase requires written approval.'));

  return [
    ...intro,
    ...body,
    pageBreak(),
    h1('Schedule A - Included and Excluded Scope'),
    dataTable(['Module', 'Included capabilities', 'Planned access / notes'], scopeRows, [1600, 3900, 3200]),
    h2('Excluded scope'),
    dataTable(['Excluded item', 'Commercial treatment'], exclusionRows, [2500, 6200], C.red),
    h1('Schedule B - Users, Training and Delivery'),
    keyValue([
      ['Initial active accounts', '16 total, including one Admin account'],
      ['Maintenance threshold', 'USD 100/month while active users are 24 or fewer'],
      ['Reception request', '4 day-shift + 2 night-shift staff; final roster subject to 16-user cap'],
      ['Pharmacy request', '2 day-shift + 2 night-shift staff'],
      ['Laboratory request', '2 day-shift + 2 night-shift staff'],
      ['Doctor request', '3 doctors across day/night; one may also hold Ultrasound permission'],
      ['Role training', 'Included for each role group in the initial implementation'],
      ['Delivery dates', 'Confirmed at kickoff after requirements, data and roster readiness'],
    ]),
    h1('Schedule C - Fees and Maintenance'),
    dataTable(['Commercial item', 'Price', 'Billing / condition'], commercialRows, [2800, 1600, 4300], C.cyan),
    keyValue([
      ['Signing / kickoff', 'USD 900'],
      ['Ready for UAT', 'USD 540'],
      ['Go-live / acceptance', 'USD 360'],
      ['Monthly service from go-live', 'USD 100, payable monthly in advance'],
    ]),
    h1('Signatures'),
    p('The authorized representatives confirm that they have read, understood and agreed to this Agreement and its schedules.'),
    signatureTable(),
    p('Drafting note: This commercial agreement should be reviewed before signature. Both Parties should confirm legal names, representative authority, effective date, contacts, account roster and any required local legal or tax details.', { size: 17, color: C.gray, italics: true }),
  ];
}

async function main() {
  if (!fs.existsSync(logoPath)) throw new Error(`Missing logo: ${logoPath}`);
  const proposal = new Document(documentOptions('Commercial & Technical Proposal', 'TARIN SHEFA OPD CLINIC - PROPOSAL', proposalChildren()));
  const agreement = new Document(documentOptions('Software Implementation & Service Agreement', 'TARIN SHEFA OPD CLINIC - AGREEMENT', agreementChildren()));
  fs.writeFileSync(proposalPath, await Packer.toBuffer(proposal));
  fs.writeFileSync(agreementPath, await Packer.toBuffer(agreement));
  for (const target of [proposalPath, agreementPath]) {
    const stat = fs.statSync(target);
    console.log(`${target}\t${stat.size} bytes`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
