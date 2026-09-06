$ErrorActionPreference = 'Stop'

$outputDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logoSource = 'E:\Commercial Projects\Clients Related Informations\Tarin Shefa OPD Clinic\TARIN SHEFA OPD CLINIC.jpeg'
$logoLocal = Join-Path $outputDir 'tarin-shefa-opd-clinic-logo.jpeg'
Copy-Item -LiteralPath $logoSource -Destination $logoLocal -Force

$proposalDocx = Join-Path $outputDir 'Tarin-Shefa-OPD-Clinic-Proposal.docx'
$proposalPdf = Join-Path $outputDir 'Tarin-Shefa-OPD-Clinic-Proposal.pdf'
$agreementDocx = Join-Path $outputDir 'Tarin-Shefa-OPD-Clinic-Service-Agreement.docx'
$agreementPdf = Join-Path $outputDir 'Tarin-Shefa-OPD-Clinic-Service-Agreement.pdf'

$navy = 1127215       # RGB(15, 47, 66) in Word BGR integer representation
$cyan = 12693248      # RGB(0, 175, 193)
$green = 5287936      # RGB(0, 176, 80)
$red = 15158332       # RGB(220, 32, 44)
$lightBlue = 16448245 # RGB(245, 250, 251)
$lightGray = 15790320 # RGB(240, 240, 240)
$darkGray = 5263440   # RGB(80, 80, 80)
$white = 16777215

$wdAlignLeft = 0
$wdAlignCenter = 1
$wdAlignRight = 2
$wdPageBreak = 7
$wdCollapseEnd = 0
$wdFormatDocumentDefault = 16
$wdExportFormatPDF = 17
$wdFieldPage = 33
$wdFieldNumPages = 26
$wdBorderBottom = -3
$wdLineStyleSingle = 1
$wdAutoFitWindow = 2
$wdRowHeightAtLeast = 1

function Set-PageLayout($doc) {
    $setup = $doc.PageSetup
    $setup.TopMargin = 50
    $setup.BottomMargin = 48
    $setup.LeftMargin = 55
    $setup.RightMargin = 55
    $setup.HeaderDistance = 22
    $setup.FooterDistance = 22
}

function Configure-BaseStyles($doc) {
    $normal = $doc.Styles.Item('Normal')
    $normal.Font.Name = 'Aptos'
    $normal.Font.Size = 10.5
    $normal.Font.Color = $darkGray
    $normal.ParagraphFormat.SpaceAfter = 6
    $normal.ParagraphFormat.LineSpacing = 14

    $h1 = $doc.Styles.Item('Heading 1')
    $h1.Font.Name = 'Aptos Display'
    $h1.Font.Size = 20
    $h1.Font.Bold = $true
    $h1.Font.Color = $navy
    $h1.ParagraphFormat.SpaceBefore = 10
    $h1.ParagraphFormat.SpaceAfter = 8

    $h2 = $doc.Styles.Item('Heading 2')
    $h2.Font.Name = 'Aptos Display'
    $h2.Font.Size = 14
    $h2.Font.Bold = $true
    $h2.Font.Color = $cyan
    $h2.ParagraphFormat.SpaceBefore = 8
    $h2.ParagraphFormat.SpaceAfter = 5
}

function Add-HeaderFooter($doc, [string]$shortTitle) {
    foreach ($section in $doc.Sections) {
        $header = $section.Headers.Item(1).Range
        $header.Text = "SOFTCARE IT SOLUTIONS  |  $shortTitle"
        $header.Font.Name = 'Aptos'
        $header.Font.Size = 8
        $header.Font.Bold = $true
        $header.Font.Color = $navy
        $header.ParagraphFormat.Alignment = $wdAlignRight
        $header.Borders.Item($wdBorderBottom).LineStyle = $wdLineStyleSingle
        $header.Borders.Item($wdBorderBottom).Color = $cyan

        $footer = $section.Footers.Item(1).Range
        $footer.Text = 'Confidential  |  '
        $footer.Font.Name = 'Aptos'
        $footer.Font.Size = 8
        $footer.Font.Color = $darkGray
        $footer.ParagraphFormat.Alignment = $wdAlignCenter
        $footer.Collapse($wdCollapseEnd)
        $footer.Fields.Add($footer, $wdFieldPage) | Out-Null
        $footer.InsertAfter(' of ')
        $footer.Collapse($wdCollapseEnd)
        $footer.Fields.Add($footer, $wdFieldNumPages) | Out-Null
    }
}

function Set-SelectionFont($sel, [string]$name = 'Aptos', [double]$size = 10.5, [int]$color = 5263440, [bool]$bold = $false) {
    $sel.Font.Name = $name
    $sel.Font.Size = $size
    $sel.Font.Color = $color
    $sel.Font.Bold = $bold
}

function Add-Paragraph($sel, [string]$text, [int]$align = 0, [bool]$bold = $false, [double]$size = 10.5, [int]$color = 5263440, [double]$after = 6) {
    $sel.ParagraphFormat.Alignment = $align
    $sel.ParagraphFormat.SpaceAfter = $after
    $sel.ParagraphFormat.LeftIndent = 0
    $sel.ParagraphFormat.FirstLineIndent = 0
    Set-SelectionFont $sel 'Aptos' $size $color $bold
    $sel.TypeText($text)
    $sel.TypeParagraph()
}

function Add-RTLParagraph($sel, [string]$text) {
    $sel.ParagraphFormat.Alignment = $wdAlignRight
    try { $sel.ParagraphFormat.ReadingOrder = 1 } catch {}
    Set-SelectionFont $sel 'Arial' 11 $navy $false
    $sel.TypeText($text)
    $sel.TypeParagraph()
    try { $sel.ParagraphFormat.ReadingOrder = 0 } catch {}
}

function Add-Heading1($sel, [string]$text) {
    $sel.Style = 'Heading 1'
    $sel.TypeText($text)
    $sel.TypeParagraph()
    $sel.Style = 'Normal'
}

function Add-Heading2($sel, [string]$text) {
    $sel.Style = 'Heading 2'
    $sel.TypeText($text)
    $sel.TypeParagraph()
    $sel.Style = 'Normal'
}

function Add-Bullet($sel, [string]$text) {
    $sel.Range.ListFormat.ApplyBulletDefault()
    Set-SelectionFont $sel 'Aptos' 10.5 $darkGray $false
    $sel.TypeText($text)
    $sel.TypeParagraph()
    $sel.Range.ListFormat.RemoveNumbers()
}

function Add-PageBreak($sel) {
    $sel.InsertBreak($wdPageBreak)
}

function Shade-Cell($cell, [int]$color) {
    $cell.Shading.BackgroundPatternColor = $color
}

function Format-Table($table, [int]$headerColor = 1127215) {
    $table.Borders.Enable = 1
    $table.AllowAutoFit = $true
    $table.AutoFitBehavior($wdAutoFitWindow)
    $table.Rows.HeightRule = $wdRowHeightAtLeast
    $table.Rows.Height = 22
    $table.Range.Font.Name = 'Aptos'
    $table.Range.Font.Size = 9
    $table.Range.Font.Color = $darkGray
    $table.Range.ParagraphFormat.SpaceAfter = 2
    $table.Range.ParagraphFormat.SpaceBefore = 2
    $table.Rows.Item(1).Range.Font.Bold = $true
    $table.Rows.Item(1).Range.Font.Color = $white
    Shade-Cell $table.Rows.Item(1).Cells.Item(1) $headerColor
    for ($i = 2; $i -le $table.Columns.Count; $i++) {
        Shade-Cell $table.Rows.Item(1).Cells.Item($i) $headerColor
    }
    for ($r = 2; $r -le $table.Rows.Count; $r++) {
        if (($r % 2) -eq 0) {
            for ($c = 1; $c -le $table.Columns.Count; $c++) {
                Shade-Cell $table.Rows.Item($r).Cells.Item($c) $lightBlue
            }
        }
    }
}

function Add-KeyValueTable($doc, $sel, [array]$rows) {
    $table = $doc.Tables.Add($sel.Range, $rows.Count, 2)
    for ($i = 0; $i -lt $rows.Count; $i++) {
        $table.Cell($i + 1, 1).Range.Text = $rows[$i][0]
        $table.Cell($i + 1, 2).Range.Text = $rows[$i][1]
    }
    $table.Borders.Enable = 0
    $table.Range.Font.Name = 'Aptos'
    $table.Range.Font.Size = 10
    for ($i = 1; $i -le $rows.Count; $i++) {
        $table.Cell($i, 1).Range.Font.Bold = $true
        $table.Cell($i, 1).Range.Font.Color = $navy
        Shade-Cell $table.Cell($i, 1) $lightBlue
    }
    $sel.SetRange($table.Range.End, $table.Range.End)
    $sel.TypeParagraph()
    return $table
}

function Add-ScopeTable($doc, $sel) {
    $rows = @(
        @('Module', 'Included capabilities', 'Planned access / notes'),
        @('Reception', 'Patient registration, front-desk workflow and reception finance/payment collection.', 'Requested coverage: 4 day-shift and 2 night-shift staff.'),
        @('Pharmacy', 'Medicine records, purchase and sales transactions, stock control and pharmacy reporting.', 'Requested coverage: 2 day-shift and 2 night-shift staff.'),
        @('Laboratory', 'Test ordering, sample workflow, results entry and laboratory reports.', 'Requested coverage: 2 day-shift and 2 night-shift staff.'),
        @('Doctor Prescription', 'Electronic prescriptions and access to relevant patient clinical history.', 'Requested coverage: 3 doctors across day/night operations.'),
        @('Ultrasound', 'Ultrasound workflow and reporting access.', 'One of the included doctor users; no separate user account allocation.'),
        @('Room Booking', 'Room availability and booking workflow.', 'Operated by authorized reception users.'),
        @('Surgery', 'Surgery scheduling/recording workflow within the agreed existing module.', 'Operated by authorized reception users.'),
        @('HR', 'HR module configuration and reasonable modifications based on confirmed clinic requirements.', 'Detailed requirements to be documented during discovery.'),
        @('Expenses', 'Expense recording/reporting configuration and reasonable modifications based on confirmed clinic requirements.', 'Detailed requirements to be documented during discovery.')
    )
    $table = $doc.Tables.Add($sel.Range, $rows.Count, 3)
    for ($r = 0; $r -lt $rows.Count; $r++) {
        for ($c = 0; $c -lt 3; $c++) {
            $table.Cell($r + 1, $c + 1).Range.Text = $rows[$r][$c]
        }
    }
    Format-Table $table $navy
    $sel.SetRange($table.Range.End, $table.Range.End)
    $sel.TypeParagraph()
    return $table
}

function Add-ExclusionTable($doc, $sel) {
    $rows = @(
        @('Excluded item', 'Commercial treatment'),
        @('X-Ray module', 'Not included in this proposal or the USD 1,800 implementation price.'),
        @('Dental module', 'Not included in this proposal or the USD 1,800 implementation price.'),
        @('Any other new module', 'Requires separate analysis, written quotation, approval and implementation schedule.')
    )
    $table = $doc.Tables.Add($sel.Range, $rows.Count, 2)
    for ($r = 0; $r -lt $rows.Count; $r++) {
        for ($c = 0; $c -lt 2; $c++) {
            $table.Cell($r + 1, $c + 1).Range.Text = $rows[$r][$c]
        }
    }
    Format-Table $table $red
    $sel.SetRange($table.Range.End, $table.Range.End)
    $sel.TypeParagraph()
    return $table
}

function Add-CommercialTable($doc, $sel) {
    $rows = @(
        @('Commercial item', 'Price', 'Billing / condition'),
        @('System implementation', 'USD 1,800', 'One-time fixed implementation price for the included scope and 16 initially configured named accounts.'),
        @('Maintenance + domain + hosting', 'USD 100/month', 'Applies while total active users remain at or below 24. Starts from production go-live and is billed monthly in advance.'),
        @('More than 24 active users', 'Revised quotation', 'Monthly infrastructure and maintenance price will be increased through a written quotation/addendum.'),
        @('Minor changes', 'Included in monthly maintenance', 'Small configuration, wording, field or report refinements that do not constitute a new module or major workflow redesign.'),
        @('New modules / major changes', 'Additional price', 'Subject to written requirements, quotation and client approval before work begins.')
    )
    $table = $doc.Tables.Add($sel.Range, $rows.Count, 3)
    for ($r = 0; $r -lt $rows.Count; $r++) {
        for ($c = 0; $c -lt 3; $c++) {
            $table.Cell($r + 1, $c + 1).Range.Text = $rows[$r][$c]
        }
    }
    Format-Table $table $cyan
    $sel.SetRange($table.Range.End, $table.Range.End)
    $sel.TypeParagraph()
    return $table
}

function Add-Cover($doc, $sel, [string]$documentType, [string]$subtitle, [string]$reference) {
    $sel.ParagraphFormat.Alignment = $wdAlignCenter
    $sel.ParagraphFormat.SpaceAfter = 12
    $shape = $sel.InlineShapes.AddPicture($logoLocal)
    $shape.LockAspectRatio = -1
    $shape.Height = 145
    $sel.TypeParagraph()
    Add-Paragraph $sel 'SHIFAASCRIPT HOSPITAL MANAGEMENT SYSTEM' $wdAlignCenter $true 11 $cyan 8
    Add-Paragraph $sel $documentType $wdAlignCenter $true 28 $navy 4
    Add-Paragraph $sel $subtitle $wdAlignCenter $false 13 $darkGray 18
    Add-Paragraph $sel 'Prepared for' $wdAlignCenter $false 10 $darkGray 2
    Add-Paragraph $sel 'TARIN SHEFA OPD CLINIC' $wdAlignCenter $true 18 $navy 6
    Add-RTLParagraph $sel 'ارزان قیمت د داود خان او ماموریت څلورلارو ترمنځ میرعلم ترین پلازا - کابل افغانستان'
    $sel.ParagraphFormat.Alignment = $wdAlignCenter
    Add-Paragraph $sel 'Prepared by SoftCare IT Solutions' $wdAlignCenter $true 11 $cyan 3
    Add-Paragraph $sel '06 September 2026' $wdAlignCenter $false 10 $darkGray 2
    Add-Paragraph $sel "Reference: $reference" $wdAlignCenter $false 9 $darkGray 18

    $box = $doc.Tables.Add($sel.Range, 1, 1)
    $box.Cell(1, 1).Range.Text = 'CONFIDENTIAL - FOR CLIENT REVIEW'
    $box.Cell(1, 1).Range.ParagraphFormat.Alignment = $wdAlignCenter
    $box.Cell(1, 1).Range.Font.Name = 'Aptos'
    $box.Cell(1, 1).Range.Font.Size = 9
    $box.Cell(1, 1).Range.Font.Bold = $true
    $box.Cell(1, 1).Range.Font.Color = $white
    Shade-Cell $box.Cell(1, 1) $navy
    $box.Borders.Enable = 0
    $sel.SetRange($box.Range.End, $box.Range.End)
    Add-PageBreak $sel
}

function Create-Proposal($word) {
    Write-Host 'Creating proposal content...'
    $doc = $word.Documents.Add()
    Set-PageLayout $doc
    Configure-BaseStyles $doc
    $sel = $word.Selection
    Add-Cover $doc $sel 'COMMERCIAL & TECHNICAL PROPOSAL' 'Implementation, training, hosting and ongoing support' 'SCI/TSOC/PROP/2026-0906'
    Write-Host 'Proposal cover complete.'
    Add-HeaderFooter $doc 'TARIN SHEFA OPD CLINIC - PROPOSAL'
    Write-Host 'Proposal header/footer complete.'

    Add-Heading1 $sel '1. Executive Summary'
    Add-Paragraph $sel 'SoftCare IT Solutions proposes to implement ShifaaScript as a secure, role-based Hospital Management System for Tarin Shefa OPD Clinic. The solution will connect reception, clinical, pharmacy, laboratory, operational and administrative workflows in one system, reduce duplicate records, improve accountability and support timely management reporting.'
    Add-Paragraph $sel 'The quoted implementation includes the modules and services defined in this proposal, role-based training, 16 initially configured named user accounts including one administrator, and production deployment. Ongoing maintenance, domain, hosting and routine operating support are provided for USD 100 per month while active users remain at or below 24.'

    Add-Heading2 $sel 'Proposal at a glance'
    Add-KeyValueTable $doc $sel @(
        @('Client', 'Tarin Shefa OPD Clinic'),
        @('Solution', 'ShifaaScript Hospital Management System'),
        @('Initial user limit', '16 named accounts in total, including one administrator'),
        @('One-time implementation', 'USD 1,800'),
        @('Monthly service', 'USD 100 up to and including 24 active users'),
        @('Training', 'Included for each authorized role'),
        @('Implementation schedule', 'To be finalized at kickoff after requirements confirmation')
    ) | Out-Null
    Write-Host 'Proposal executive summary complete.'

    Add-Heading1 $sel '2. Business Objectives'
    Add-Bullet $sel 'Create a single, controlled source of patient and operational information.'
    Add-Bullet $sel 'Apply role-based access so each department works only within its authorized responsibilities.'
    Add-Bullet $sel 'Improve patient registration, payment collection, prescription, laboratory, pharmacy and booking workflows.'
    Add-Bullet $sel 'Provide traceable records and practical reports for management oversight.'
    Add-Bullet $sel 'Support future growth through controlled user expansion and separately approved modules.'

    Add-Heading1 $sel '3. Included Functional Scope'
    Add-ScopeTable $doc $sel | Out-Null
    Write-Host 'Proposal scope table complete.'

    Add-Heading2 $sel 'Scope interpretation'
    Add-Paragraph $sel 'HR and Expenses are included as existing modules, with reasonable configuration and modification based on requirements documented during discovery. A request that materially changes the architecture, introduces a substantially new workflow, or creates a new module will follow the change-control and additional-pricing process.'

    Add-Heading1 $sel '4. Excluded Scope'
    Add-ExclusionTable $doc $sel | Out-Null
    Write-Host 'Proposal exclusions complete.'

    Add-Heading1 $sel '5. Users, Roles and Access Control'
    Add-Paragraph $sel 'The commercial scope provides 16 initially configured named user accounts, including one administrator. Permissions will be assigned by role, hospital/department and operational responsibility. Shared credentials are not recommended because they reduce auditability and accountability.'
    Add-Paragraph $sel 'Important roster clarification: the staffing figures supplied for Reception (6), Pharmacy (4), Laboratory (4) and Doctors (3) describe 17 operational staff positions before the administrator account. This exceeds the separately stated total of 16 users including Admin. Before go-live, the Clinic will confirm the final named-user roster and any legitimate multi-role assignments so the active-account count remains within the agreed limit. Any increase must be approved in writing.' $wdAlignLeft $true 10.5 $red 8
    Add-Paragraph $sel 'One of the included doctor accounts will also receive Ultrasound access. Reception accounts may receive Room Booking and Surgery permissions where authorized, without requiring separate accounts.'

    Add-Heading1 $sel '6. Implementation Approach'
    $phases = @(
        @('Phase', 'Activities', 'Output'),
        @('1. Discovery', 'Confirm workflows, roles, account roster, reports and HR/Expense requirements.', 'Approved requirements and implementation checklist.'),
        @('2. Configuration', 'Configure hospital profile, modules, permissions, numbering and operational settings.', 'Configured staging environment.'),
        @('3. Data preparation', 'Enter/import mutually agreed initial master data supplied in usable format by the Clinic.', 'Validated initial data set.'),
        @('4. Training & UAT', 'Role-based training and client user-acceptance testing.', 'Trained users and issue/acceptance log.'),
        @('5. Go-live', 'Production deployment, domain/hosting activation and controlled launch.', 'Operational production system.'),
        @('6. Support', 'Routine maintenance, issue resolution and eligible minor changes.', 'Ongoing monthly service.')
    )
    $phaseTable = $doc.Tables.Add($sel.Range, $phases.Count, 3)
    for ($r = 0; $r -lt $phases.Count; $r++) { for ($c = 0; $c -lt 3; $c++) { $phaseTable.Cell($r+1,$c+1).Range.Text = $phases[$r][$c] } }
    Format-Table $phaseTable $navy
    $sel.SetRange($phaseTable.Range.End, $phaseTable.Range.End)
    $sel.TypeParagraph()

    Add-Heading1 $sel '7. Training and Go-Live Support'
    Add-Bullet $sel 'Training will be delivered to each role group: Reception/Finance, Pharmacy, Laboratory, Doctors/Ultrasound and Administration.'
    Add-Bullet $sel 'Training will cover login/security, daily workflow, corrections, reports and escalation of technical issues.'
    Add-Bullet $sel 'The Clinic will nominate users, ensure attendance and provide suitable devices/connectivity for training.'
    Add-Bullet $sel 'Additional sessions caused by staff turnover or requested after completion may be quoted separately.'

    Add-Heading1 $sel '8. Commercial Offer'
    Add-CommercialTable $doc $sel | Out-Null
    Write-Host 'Proposal commercial table complete.'

    Add-Heading2 $sel 'Suggested implementation payment schedule'
    Add-KeyValueTable $doc $sel @(
        @('50% - Contract signing / kickoff', 'USD 900'),
        @('30% - Configured system ready for UAT', 'USD 540'),
        @('20% - Production go-live / acceptance', 'USD 360')
    ) | Out-Null
    Add-Paragraph $sel 'The above payment milestones are included in the accompanying draft agreement and may be changed only by mutual written approval before signature.' $wdAlignLeft $false 9 $darkGray 8

    Add-Heading1 $sel '9. Monthly Maintenance Coverage'
    Add-Bullet $sel 'Domain and hosting costs for the production system.'
    Add-Bullet $sel 'Routine application maintenance, security updates and reasonable operational support.'
    Add-Bullet $sel 'Routine backup administration subject to the selected hosting environment.'
    Add-Bullet $sel 'Minor changes that do not create a new module or materially redesign an approved workflow.'
    Add-Bullet $sel 'Monthly fee remains USD 100 while total active users are 24 or fewer; above 24 users requires a revised written quotation.'

    Add-Heading1 $sel '10. Assumptions and Client Responsibilities'
    Add-Bullet $sel 'The Clinic will provide accurate master data, approved forms, staff roster, process owners and timely decisions.'
    Add-Bullet $sel 'Computers, printers, local networking, power continuity and internet connectivity are the responsibility of the Clinic unless separately quoted.'
    Add-Bullet $sel 'The Clinic will protect credentials, promptly disable departed users and comply with applicable patient-confidentiality obligations.'
    Add-Bullet $sel 'Delivery dates depend on timely access to requirements, data, feedback, testing and approvals.'

    Add-Heading1 $sel '11. Proposal Validity and Acceptance'
    Add-Paragraph $sel 'This proposal is valid for 30 calendar days from 06 September 2026. Final work will be governed by the separately signed Service Agreement. This proposal is a commercial draft and should be reviewed by both parties before signature.'

    $accept = $doc.Tables.Add($sel.Range, 4, 2)
    $accept.Cell(1,1).Range.Text = 'For SoftCare IT Solutions'
    $accept.Cell(1,2).Range.Text = 'For Tarin Shefa OPD Clinic'
    $accept.Cell(2,1).Range.Text = "Name: ______________________________`nTitle: _______________________________"
    $accept.Cell(2,2).Range.Text = "Name: ______________________________`nTitle: _______________________________"
    $accept.Cell(3,1).Range.Text = "Signature: ___________________________"
    $accept.Cell(3,2).Range.Text = "Signature: ___________________________"
    $accept.Cell(4,1).Range.Text = "Date: _______________________________"
    $accept.Cell(4,2).Range.Text = "Date: _______________________________"
    Format-Table $accept $navy

    Write-Host 'Saving proposal DOCX...'
    $doc.SaveAs2($proposalDocx, $wdFormatDocumentDefault)
    Write-Host 'Exporting proposal PDF...'
    $doc.ExportAsFixedFormat($proposalPdf, $wdExportFormatPDF)
    $pages = $doc.ComputeStatistics(2)
    $doc.Close($false)
    return $pages
}

function Add-ContractClause($sel, [string]$number, [string]$title, [string]$text) {
    Add-Heading1 $sel "$number. $title"
    Add-Paragraph $sel $text
}

function Create-Agreement($word) {
    Write-Host 'Creating agreement content...'
    $doc = $word.Documents.Add()
    Set-PageLayout $doc
    Configure-BaseStyles $doc
    $sel = $word.Selection
    Add-Cover $doc $sel 'SOFTWARE IMPLEMENTATION & SERVICE AGREEMENT' 'ShifaaScript Hospital Management System' 'SCI/TSOC/AGR/2026-0906'
    Write-Host 'Agreement cover complete.'
    Add-HeaderFooter $doc 'TARIN SHEFA OPD CLINIC - AGREEMENT'
    Write-Host 'Agreement header/footer complete.'

    Add-Paragraph $sel 'This Software Implementation and Service Agreement (the "Agreement") is entered into on ____ / ____ / 2026 (the "Effective Date") by and between:' $wdAlignLeft $false 10.5 $darkGray 8
    Add-KeyValueTable $doc $sel @(
        @('Service Provider', 'SoftCare IT Solutions ("SoftCare"), represented by ______________________________, Title ______________________________.'),
        @('Client', 'Tarin Shefa OPD Clinic (the "Clinic"), represented by ______________________________, Title ______________________________.'),
        @('Client address', 'ارزان قیمت د داود خان او ماموریت څلورلارو ترمنځ میرعلم ترین پلازا - کابل افغانستان')
    ) | Out-Null
    Add-Paragraph $sel 'SoftCare and the Clinic are individually a "Party" and together the "Parties".'

    Add-ContractClause $sel '1' 'Purpose' 'The Clinic appoints SoftCare to configure, implement, host, train users on and maintain the ShifaaScript Hospital Management System according to this Agreement and its schedules. SoftCare accepts the appointment subject to timely cooperation, payment and access from the Clinic.'

    Add-ContractClause $sel '2' 'Agreement Documents and Priority' 'This Agreement includes Schedule A (Included and Excluded Scope), Schedule B (Users, Training and Delivery) and Schedule C (Fees and Maintenance). If documents conflict, the signed Agreement takes priority, followed by its schedules, followed by the accepted proposal. A later signed addendum overrides the conflicting earlier term.'

    Add-ContractClause $sel '3' 'Included System Scope' 'SoftCare will provide the included modules and access described in Schedule A. HR and Expenses will be reasonably configured and modified against requirements jointly documented during discovery. Work outside the included scope requires the written change-control process in Clause 9.'

    Add-ContractClause $sel '4' 'User Accounts and Role-Based Access' 'The initial deployment includes a maximum of 16 active named user accounts in total, including one administrator. Users will receive permissions according to approved roles. Ultrasound access may be assigned to an included doctor account, while Room Booking and Surgery access may be assigned to authorized reception accounts. Credentials must not be shared. The Clinic will approve the final named-user and permission roster before go-live.'
    Add-Paragraph $sel 'The operational staffing counts originally supplied by the Clinic describe 17 staff positions before the Admin account. Therefore, the Clinic must confirm multi-role assignments or revise the roster so the system contains no more than 16 active named accounts at initial go-live. A written addendum may increase the agreed account count.' $wdAlignLeft $true 10.5 $red 8

    Add-ContractClause $sel '5' 'Implementation and Cooperation' 'SoftCare will conduct discovery, configuration, agreed initial data setup, role training, user-acceptance support and production deployment. The detailed timeline will be agreed at kickoff. The Clinic will provide accurate data, forms, authorized contacts, process decisions, test users, feedback and approvals on time. A delay in Clinic dependencies extends affected delivery dates without placing SoftCare in breach.'

    Add-ContractClause $sel '6' 'User Acceptance and Go-Live' 'SoftCare will notify the Clinic when the configured system is ready for user-acceptance testing ("UAT"). The Clinic will test the agreed workflows and report reproducible material issues in writing. SoftCare will correct confirmed material non-conformities within a reasonable period. Go-live, productive use, or written confirmation constitutes acceptance. Minor issues that do not prevent normal use will be handled through support and will not prevent acceptance.'

    Add-ContractClause $sel '7' 'Training' 'SoftCare will provide initial training for each authorized role group: Reception/Finance, Pharmacy, Laboratory, Doctors/Ultrasound and Administration. The Clinic is responsible for attendance, appropriate devices, internet/power and internal coordination. Additional training required because of staff turnover, missed sessions or new scope may be charged separately after written approval.'

    Add-ContractClause $sel '8' 'Implementation Fee and Payment' 'The fixed one-time implementation fee is USD 1,800 for the included scope. Unless the Parties sign a different schedule, payment is due as follows: USD 900 (50%) on signing/kickoff; USD 540 (30%) when the configured system is ready for UAT; and USD 360 (20%) on production go-live or acceptance. SoftCare may pause work or access for overdue undisputed amounts after written notice. Each Party bears taxes and transaction charges allocated to it by applicable requirements.'

    Add-ContractClause $sel '9' 'Change Control' 'Monthly maintenance includes minor changes such as limited configuration, wording, field, layout or report refinements that do not create a new module, materially redesign a workflow, require substantial data migration or change the core architecture. X-Ray, Dental and every other new module are excluded. A major change or new module requires written requirements, a separate quotation, approval and an agreed schedule before work starts.'

    Add-ContractClause $sel '10' 'Monthly Maintenance, Domain and Hosting' 'From production go-live, the Clinic will pay USD 100 per month in advance for routine maintenance, domain, hosting and related routine operating support while total active users are 24 or fewer. If active users exceed 24, SoftCare may issue a revised quotation reflecting additional infrastructure and support requirements; the new price applies only after written agreement. Failure to pay an undisputed monthly invoice may result in suspension after reasonable written notice.'

    Add-ContractClause $sel '11' 'Support and Maintenance Standard' 'SoftCare will use commercially reasonable efforts to maintain the hosted application, apply routine security and software updates, administer routine backups in the selected hosting environment and address reproducible system issues. Maintenance does not include failures caused by Clinic devices, local networks, power, internet providers, unsupported third-party systems, misuse, shared credentials, unauthorized changes or events outside the reasonable control of SoftCare.'

    Add-ContractClause $sel '12' 'Clinic Responsibilities' 'The Clinic will: (a) provide lawful and accurate data; (b) designate authorized decision-makers; (c) maintain suitable devices, printers, local networking, connectivity and power; (d) manage user access and promptly disable departed personnel; (e) protect passwords and administrator credentials; (f) verify operational and financial entries; and (g) comply with applicable patient confidentiality, medical record and employment obligations.'

    Add-ContractClause $sel '13' 'Data Ownership, Access and Export' 'The Clinic owns the patient, clinical, financial, staffing and operational data entered into the system. SoftCare may access such data only as necessary to implement, host, support, secure or troubleshoot the service, or as otherwise authorized by the Clinic. On termination and settlement of undisputed dues, SoftCare will provide a reasonable export of Clinic data in an available standard format. Custom extraction, conversion or migration work may be quoted separately.'

    Add-ContractClause $sel '14' 'Software and Intellectual Property' 'SoftCare retains all ownership and intellectual-property rights in ShifaaScript, its source code, architecture, reusable components, documentation, methods and general improvements. Payment grants the Clinic a non-exclusive, non-transferable right to use the hosted system for its own operations during the Agreement, subject to payment and these terms. The Clinic may not copy, resell, reverse engineer, sublicense or provide the system to another organization without written permission from SoftCare.'

    Add-ContractClause $sel '15' 'Confidentiality and Security' 'Each Party will protect the non-public business, technical, financial and patient-related information of the other Party using reasonable safeguards and will disclose it only to personnel who need it for this Agreement. The Clinic remains responsible for selecting authorized users and lawful use of patient data. No internet-based system can be guaranteed completely free from interruption or security risk; each Party will promptly notify the other of a suspected incident relevant to the service.'

    Add-ContractClause $sel '16' 'Warranties and Limitations' 'SoftCare warrants that it will perform services with reasonable professional care and that the delivered system will substantially follow the agreed scope. Except for this express commitment, the service is provided subject to hosting, connectivity and third-party limitations. Neither Party is liable for indirect, incidental or consequential loss. The aggregate liability of SoftCare arising from this Agreement will not exceed the fees paid by the Clinic during the six months immediately preceding the event giving rise to the claim, except where such limitation is prohibited by applicable law.'

    Add-ContractClause $sel '17' 'Term, Suspension and Termination' 'This Agreement begins on the Effective Date. Implementation continues through acceptance, and monthly service continues until terminated. Either Party may terminate ongoing monthly service with 30 days of written notice after settling undisputed obligations. A material breach must be described in writing and, where curable, the breaching Party will have 15 days to cure. On termination, Clinic access may end after the effective termination date, subject to an agreed data-export period and payment of outstanding undisputed amounts.'

    Add-ContractClause $sel '18' 'Force Majeure' 'Neither Party is liable for delay or failure caused by events beyond reasonable control, including natural disaster, widespread power or telecommunications outage, government restriction, conflict, civil disturbance or major third-party infrastructure failure. The affected Party will notify the other when reasonably possible and resume performance when the event ends.'

    Add-ContractClause $sel '19' 'Notices and Dispute Resolution' 'Operational notices may be sent through the designated email or written communication channels of the Parties. The Parties will first attempt in good faith to resolve a dispute through authorized representatives. If unresolved, the dispute will be subject to the laws applicable in Afghanistan and the competent courts of Kabul, unless the Parties sign a different written dispute-resolution arrangement.'

    Add-ContractClause $sel '20' 'General Terms' 'Neither Party may assign this Agreement without the written consent of the other Party, except as part of a lawful business succession that assumes the obligations. If one provision is unenforceable, the remaining provisions continue. A waiver must be written. This Agreement and signed addenda form the entire agreement for the stated subject. Amendments must be in writing and signed by both Parties. Electronic/scanned counterparts may be used to document agreement, subject to applicable requirements.'

    Add-PageBreak $sel
    Add-Heading1 $sel 'Schedule A - Included and Excluded Scope'
    Add-ScopeTable $doc $sel | Out-Null
    Add-Heading2 $sel 'Excluded scope'
    Add-ExclusionTable $doc $sel | Out-Null

    Add-Heading1 $sel 'Schedule B - Users, Training and Delivery'
    Add-KeyValueTable $doc $sel @(
        @('Initial active accounts', '16 total, including one Admin account'),
        @('Maintenance threshold', 'USD 100/month while active users are 24 or fewer'),
        @('Reception coverage request', '4 day-shift + 2 night-shift staff; final account roster subject to the 16-user cap'),
        @('Pharmacy coverage request', '2 day-shift + 2 night-shift staff'),
        @('Laboratory coverage request', '2 day-shift + 2 night-shift staff'),
        @('Doctor coverage request', '3 doctors across day/night; one may also hold Ultrasound permission'),
        @('Role training', 'Included for each role group in the initial implementation'),
        @('Delivery dates', 'Confirmed at kickoff after requirements, data and roster readiness')
    ) | Out-Null

    Add-Heading1 $sel 'Schedule C - Fees and Maintenance'
    Add-CommercialTable $doc $sel | Out-Null
    Add-KeyValueTable $doc $sel @(
        @('Signing / kickoff', 'USD 900'),
        @('Ready for UAT', 'USD 540'),
        @('Go-live / acceptance', 'USD 360'),
        @('Monthly service from go-live', 'USD 100, payable monthly in advance')
    ) | Out-Null

    Add-Heading1 $sel 'Signatures'
    Add-Paragraph $sel 'The authorized representatives confirm that they have read, understood and agreed to this Agreement and its schedules.'
    $sign = $doc.Tables.Add($sel.Range, 6, 2)
    $sign.Cell(1,1).Range.Text = 'SOFTCARE IT SOLUTIONS'
    $sign.Cell(1,2).Range.Text = 'TARIN SHEFA OPD CLINIC'
    $sign.Cell(2,1).Range.Text = 'Name: __________________________________'
    $sign.Cell(2,2).Range.Text = 'Name: __________________________________'
    $sign.Cell(3,1).Range.Text = 'Title: ___________________________________'
    $sign.Cell(3,2).Range.Text = 'Title: ___________________________________'
    $sign.Cell(4,1).Range.Text = 'Signature: _______________________________'
    $sign.Cell(4,2).Range.Text = 'Signature: _______________________________'
    $sign.Cell(5,1).Range.Text = 'Date: ___________________________________'
    $sign.Cell(5,2).Range.Text = 'Date: ___________________________________'
    $sign.Cell(6,1).Range.Text = 'Company stamp:'
    $sign.Cell(6,2).Range.Text = 'Clinic stamp:'
    Format-Table $sign $navy
    $sign.Rows.Item(6).Height = 70

    Add-Paragraph $sel 'Drafting note: This agreement is a commercial draft for review and signature after both Parties confirm names, authority, dates, contacts, account roster and any required local legal/tax details.' $wdAlignLeft $false 8.5 $darkGray 4

    Write-Host 'Saving agreement DOCX...'
    $doc.SaveAs2($agreementDocx, $wdFormatDocumentDefault)
    Write-Host 'Exporting agreement PDF...'
    $doc.ExportAsFixedFormat($agreementPdf, $wdExportFormatPDF)
    $pages = $doc.ComputeStatistics(2)
    $doc.Close($false)
    return $pages
}

$word = $null
try {
    Write-Host 'Starting Microsoft Word automation...'
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    Write-Host 'Microsoft Word started.'
    $proposalPages = Create-Proposal $word
    Write-Host 'Proposal complete.'
    $agreementPages = Create-Agreement $word
    Write-Host 'Agreement complete.'
    Write-Output "Proposal pages: $proposalPages"
    Write-Output "Agreement pages: $agreementPages"
    Get-Item -LiteralPath $proposalDocx, $proposalPdf, $agreementDocx, $agreementPdf, $logoLocal |
        Select-Object FullName, Length, LastWriteTime
}
finally {
    if ($null -ne $word) {
        $word.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
