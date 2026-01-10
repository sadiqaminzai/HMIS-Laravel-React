import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Hospital, LabTest } from '../types';

interface LabReportPrintProps {
  test: LabTest;
  hospital: Hospital;
}

export function LabReportPrint({ test, hospital }: LabReportPrintProps) {
  // Brand color or default blue
  const brandColor = hospital.brandColor || '#1e40af';

  // Generate QR Code data
  const qrData = `LAB TEST REPORT\nTest#: ${test.testNumber}\nPatient: ${test.patientName}\nTest: ${test.testName}\nDate: ${test.createdAt.toLocaleDateString()}\nHospital: ${hospital.name}`;

  // Parse test results into table format
  const parseResults = (resultString: string) => {
    if (!resultString) return [];
    const lines = resultString.split('\n').filter(line => line.trim());
    return lines.map(line => {
      // Parse format: "TestName: Result (Normal: Range) - Remarks"
      const match = line.match(/^(.+?):\s*(.+?)(?:\s*\(Normal:\s*(.+?)\))?(?:\s*-\s*(.+))?$/);
      if (match) {
        return {
          testName: match[1].trim(),
          result: match[2].trim(),
          normalRange: match[3]?.trim() || '-',
          remarks: match[4]?.trim() || '-'
        };
      }
      return null;
    }).filter(Boolean);
  };

  const parsedResults = parseResults(test.result || '');

  return (
    <div className="report-container bg-white p-6 max-w-5xl mx-auto">
      {/* Compact Header with QR */}
      <div 
        className="report-header flex justify-between items-start pb-3 border-b-2 mb-3"
        style={{ borderColor: brandColor }}
      >
        <div className="header-left flex-1">
          <div className="hospital-name text-xl font-bold" style={{ color: brandColor }}>{hospital.name}</div>
          <div className="text-[10px] text-gray-600 leading-tight">{hospital.address} • {hospital.phone}</div>
          <div className="report-title text-sm font-bold text-gray-900 mt-1.5">LABORATORY TEST REPORT</div>
        </div>
        <div className="header-right">
          <div className="border border-gray-300 p-1 rounded inline-block">
            <QRCodeCanvas value={qrData} size={60} />
          </div>
        </div>
      </div>

      {/* Ultra-Compact Patient & Test Information - Single Row */}
      <div className="info-compact border border-gray-300 rounded mb-3">
        {/* Patient Info Row */}
        <div className="grid grid-cols-4 gap-2 p-2 border-b border-gray-200 bg-gray-50">
          <div className="col-span-4">
            <div className="text-[9px] font-bold uppercase mb-1" style={{ color: brandColor }}>Patient Information</div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Patient Name</div>
            <div className="text-[10px] text-gray-900 font-medium">{test.patientName}</div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Patient ID</div>
            <div className="text-[10px] text-gray-900 font-medium">{test.patientId}</div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Age</div>
            <div className="text-[10px] text-gray-900 font-medium">{test.patientAge} Years</div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Gender</div>
            <div className="text-[10px] text-gray-900 font-medium">{test.patientGender === 'male' ? 'Male' : 'Female'}</div>
          </div>
        </div>

        {/* Test Info Row */}
        <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50">
          <div className="col-span-4">
            <div className="text-[9px] font-bold uppercase mb-1" style={{ color: brandColor }}>Test Information</div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Test Number</div>
            <div className="text-[10px] text-gray-900 font-medium">{test.testNumber}</div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Test Name</div>
            <div className="text-[10px] text-gray-900 font-medium">{test.testName}</div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Test Type</div>
            <div className="text-[10px] text-gray-900 font-medium">{test.testType}</div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Sample Collection</div>
            <div className="text-[10px] text-gray-900 font-medium">
              {test.sampleCollectedAt?.toLocaleDateString()} {test.sampleCollectedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Requested By</div>
            <div className="text-[10px] text-gray-900 font-medium">{test.doctorName}</div>
          </div>
          <div>
            <div className="text-[8px] font-semibold text-gray-500 uppercase">Report Date</div>
            <div className="text-[10px] text-gray-900 font-medium">
              {test.reportedAt?.toLocaleDateString()} {test.reportedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Results Table */}
      <div className="results-section mb-3">
        <div className="text-[10px] font-bold uppercase mb-1.5" style={{ color: brandColor }}>Laboratory Test Results</div>
        <div className="overflow-hidden rounded border border-gray-300">
          <table className="results-table w-full border-collapse">
            <thead className="text-white" style={{ backgroundColor: brandColor }}>
              <tr>
                <th className="text-left py-1.5 px-2 text-[9px] font-semibold uppercase tracking-wide w-[30%]">
                  Test Parameter
                </th>
                <th className="text-left py-1.5 px-2 text-[9px] font-semibold uppercase tracking-wide w-[20%]">
                  Result
                </th>
                <th className="text-left py-1.5 px-2 text-[9px] font-semibold uppercase tracking-wide w-[25%]">
                  Normal Range
                </th>
                <th className="text-left py-1.5 px-2 text-[9px] font-semibold uppercase tracking-wide w-[25%]">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {parsedResults.length > 0 ? (
                parsedResults.map((row: any, index: number) => (
                  <tr
                    key={index}
                    className={`border-b border-gray-200 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="py-1.5 px-2 text-[10px] font-semibold text-gray-900">{row.testName}</td>
                    <td className="py-1.5 px-2 text-[10px] font-bold" style={{ color: brandColor }}>{row.result}</td>
                    <td className="py-1.5 px-2 text-[10px] text-gray-700">{row.normalRange}</td>
                    <td className="py-1.5 px-2 text-[10px] text-gray-700">{row.remarks}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-[10px] text-gray-400">
                    No test results available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compact Remarks */}
      {test.remarks && (
        <div className="remarks-section bg-amber-50 border-l-2 border-amber-500 p-2 mb-3 rounded">
          <div className="remarks-title text-[9px] font-bold text-amber-900 mb-1">
            Lab Technician Remarks / Observations
          </div>
          <div className="remarks-content text-[10px] text-amber-900 leading-snug">{test.remarks}</div>
        </div>
      )}

      {/* Compact Signatures */}
      <div className="signature-section flex justify-between mt-4 pt-3 border-t border-dashed border-gray-300">
        <div className="signature-box text-center">
          <div className="signature-line w-40 border-t-2 border-gray-900 mb-1"></div>
          <div className="signature-label text-[9px] font-semibold text-gray-700">Lab Technician</div>
          <div className="signature-name text-[10px] text-gray-600">{test.assignedToName || 'Lab Department'}</div>
        </div>
        <div className="signature-box text-center">
          <div className="signature-line w-40 border-t-2 border-gray-900 mb-1"></div>
          <div className="signature-label text-[9px] font-semibold text-gray-700">Reviewed By</div>
          <div className="signature-name text-[10px] text-gray-600">{test.doctorName}</div>
        </div>
      </div>

      {/* Compact Footer */}
      <div className="footer mt-4 pt-3 border-t border-gray-200 text-center">
        <p className="text-[9px] text-gray-500">This is a computer-generated laboratory report from {hospital.name}</p>
        <p className="text-[9px] text-gray-500">Laboratory Department • {hospital.address} • {hospital.phone}</p>
        <p className="text-[8px] font-semibold text-red-600 mt-1.5">
          ⚠ CONFIDENTIAL MEDICAL REPORT - For authorized medical personnel only
        </p>
      </div>
    </div>
  );
}

// Print-specific styles (to be injected when printing)
export const getPrintStyles = (hospital: Hospital) => {
  const brandColor = hospital.brandColor || '#1e40af';
  
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 15px; line-height: 1.3; color: #1f2937; }
  .report-container { max-width: 210mm; margin: 0 auto; background: white; padding: 20px !important; }
  
  /* Compact Header */
  .report-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid ${brandColor}; margin-bottom: 12px; }
  .header-left { flex: 1; }
  .hospital-name { font-size: 20px; font-weight: bold; color: ${brandColor}; margin-bottom: 3px; line-height: 1.2; }
  .report-title { font-size: 13px; font-weight: bold; color: #111827; margin-top: 6px; letter-spacing: 0.5px; }
  .header-right { text-align: center; }
  
  /* Ultra-Compact Info Section */
  .info-compact { border: 1px solid #d1d5db; border-radius: 4px; margin-bottom: 12px; }
  .info-compact > div { padding: 8px; }
  .info-compact .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  
  /* Compact Results Table */
  .results-section { margin-bottom: 12px; }
  .results-table { width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; }
  .results-table thead { background: ${brandColor}; color: white; }
  .results-table th { padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .results-table tbody tr { border-bottom: 1px solid #e5e7eb; }
  .results-table tbody tr:nth-child(even) { background: #f9fafb; }
  .results-table td { padding: 6px 8px; font-size: 10px; color: #374151; line-height: 1.3; }
  .results-table td:first-child { font-weight: 600; color: #1f2937; }
  .results-table td:nth-child(2) { font-weight: 700; color: ${brandColor}; }
  
  /* Compact Remarks */
  .remarks-section { background: #fef3c7; border-left: 2px solid #f59e0b; padding: 8px; margin-bottom: 12px; border-radius: 3px; }
  .remarks-title { font-size: 9px; font-weight: 700; color: #92400e; margin-bottom: 4px; }
  .remarks-content { font-size: 10px; color: #78350f; line-height: 1.4; }
  
  /* Compact Signatures */
  .signature-section { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 12px; border-top: 1px dashed #d1d5db; }
  .signature-box { text-align: center; }
  .signature-line { width: 160px; border-top: 2px solid #111827; margin-bottom: 4px; }
  .signature-label { font-size: 9px; font-weight: 600; color: #374151; }
  .signature-name { font-size: 10px; color: #6b7280; margin-top: 2px; }
  
  /* Compact Footer */
  .footer { margin-top: 15px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; }
  .footer p { font-size: 9px; color: #9ca3af; margin: 2px 0; line-height: 1.3; }
  
  /* Print-specific styles */
  @media print { 
    @page { 
      size: A4;
      margin: 0;
    }
    body * { 
      visibility: hidden;
    } 
    .report-container, .report-container * { 
      visibility: visible;
    }
    .report-container { 
      position: fixed;
      left: 0;
      top: 0;
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 20mm !important;
      background: white;
      box-shadow: none;
      border: none;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      z-index: 9999;
    }
    .results-table { 
      page-break-inside: avoid; 
    }
    .footer {
      margin-top: auto;
    }
  }
`;
};