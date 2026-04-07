import React from 'react';
import { LabTest, Hospital } from '../types';
import { QRCodeCanvas } from 'qrcode.react';
import { formatDate } from '../utils/date';
import { buildVerificationUrl } from '../utils/verification';


interface LabReportTemplateProps {
  test: LabTest;
  hospital: Hospital;
}

export function LabReportTemplate({ test, hospital }: LabReportTemplateProps) {
  const brandColor = hospital?.brandColor || '#2563eb';
  const verificationUrl = buildVerificationUrl('lab-report', test.verificationToken);
  const qrValue = verificationUrl || `LAB-${test.testNumber}-${test.patientId}`;

  // Explicit hex colors
  const colors = {
    white: '#ffffff',
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',
    black: '#000000',
  };

  return (
    <div
      id={`report-${test.id}`}
      style={{
        backgroundColor: colors.white,
        color: colors.gray900,
        padding: '16px',
        width: '100%',
        maxWidth: '56rem', // max-w-4xl
        margin: '0 auto',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}
    >
      <div
        style={{
          paddingBottom: '16px',
          marginBottom: '16px',
          borderBottom: `2px solid ${colors.gray800}`,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <div style={{ flex: '1 1 0%', minWidth: '200px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', lineHeight: '32px', color: brandColor, margin: 0 }}>
            {hospital.name}
          </h1>
          <p style={{ fontSize: '14px', lineHeight: '20px', marginTop: '4px', color: colors.gray600, margin: '4px 0 0 0' }}>
            {hospital.address}
          </p>
          <p style={{ fontSize: '14px', lineHeight: '20px', color: colors.gray600, margin: 0 }}>
            Phone: {hospital.phone}
          </p>
          <p style={{ fontSize: '14px', lineHeight: '20px', color: colors.gray600, margin: 0 }}>
            Email: {hospital.email}
          </p>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <QRCodeCanvas value={qrValue} size={100} />
          <p style={{ fontSize: '10px', marginTop: '6px', color: colors.gray500, fontWeight: 'bold', letterSpacing: '0.05em' }}>SCAN TO VERIFY</p>
        </div>
      </div>

      {/* Report Title */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', color: colors.gray900, margin: 0 }}>
          Laboratory Test Report
        </h2>
        <p style={{ fontSize: '14px', marginTop: '4px', color: colors.gray600, margin: '4px 0 0 0' }}>
          Test Number: {test.testNumber}
        </p>
      </div>

      {/* Patient & Test Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px', fontSize: '14px' }}>
        <div>
          <h3 
            style={{ 
              fontWeight: '600', 
              marginBottom: '8px', 
              paddingBottom: '4px',
              borderBottom: `1px solid ${colors.gray300}`,
              color: colors.gray900,
              margin: '0 0 8px 0'
            }}
          >
            Patient Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex' }}><span style={{ fontWeight: '500', width: '128px' }}>Name:</span> <span>{test.patientName}</span></div>
            <div style={{ display: 'flex' }}><span style={{ fontWeight: '500', width: '128px' }}>Age:</span> <span>{test.patientAge} Years</span></div>
            <div style={{ display: 'flex' }}><span style={{ fontWeight: '500', width: '128px' }}>Gender:</span> <span style={{ textTransform: 'capitalize' }}>{test.patientGender}</span></div>
            <div style={{ display: 'flex' }}><span style={{ fontWeight: '500', width: '128px' }}>Patient ID:</span> <span>{test.patientDisplayId || test.patientId}</span></div>
          </div>
        </div>
        <div>
          <h3 
            style={{ 
              fontWeight: '600', 
              marginBottom: '8px', 
              paddingBottom: '4px',
              borderBottom: `1px solid ${colors.gray300}`,
              color: colors.gray900,
              margin: '0 0 8px 0'
            }}
          >
            Test Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex' }}><span style={{ fontWeight: '500', width: '128px' }}>Ordered By:</span> <span>{test.doctorName}</span></div>
            <div style={{ display: 'flex' }}><span style={{ fontWeight: '500', width: '128px' }}>Sample Date:</span> <span>{formatDate(test.sampleCollectedAt, hospital.timezone, hospital.calendarType)}</span></div>
            <div style={{ display: 'flex' }}><span style={{ fontWeight: '500', width: '128px' }}>Report Date:</span> <span>{formatDate(test.reportedAt, hospital.timezone, hospital.calendarType)}</span></div>
            <div style={{ display: 'flex' }}><span style={{ fontWeight: '500', width: '128px' }}>Priority:</span> <span style={{ textTransform: 'uppercase', fontWeight: '600' }}>{test.priority}</span></div>
          </div>
        </div>
      </div>

      {/* Test Results */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontWeight: '600', marginBottom: '12px', fontSize: '16px', color: colors.gray900, margin: '0 0 12px 0' }}>Test Results</h3>
        
        {test.testResults?.reduce((acc, result) => {
          if (!acc[result.testName]) acc[result.testName] = [];
          acc[result.testName].push(result);
          return acc;
        }, {} as Record<string, typeof test.testResults>) && 
         Object.entries(test.testResults?.reduce((acc, result) => {
            if (!acc[result.testName]) acc[result.testName] = [];
            acc[result.testName].push(result);
            return acc;
          }, {} as Record<string, typeof test.testResults>) || {}).map(([testName, results]) => (
          <div key={testName} style={{ marginBottom: '16px' }}>
            {/* Test Name */}
            <div 
              style={{ 
                padding: '8px 12px', 
                fontWeight: '600', 
                fontSize: '14px', 
                marginBottom: '8px',
                backgroundColor: colors.gray100, 
                color: colors.gray900,
                borderLeft: `4px solid ${brandColor}` 
              }}
            >
              {testName}
            </div>

            {/* Parameters Table */}
            <div style={{ overflowX: 'auto' }}>
              <table 
                style={{ 
                  width: '100%', 
                  fontSize: '12px', 
                  border: `1px solid ${colors.gray300}`,
                  borderCollapse: 'collapse',
                  minWidth: '500px'
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: colors.gray50 }}>
                    <th style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Parameter</th>
                    <th style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Result</th>
                    <th style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Unit</th>
                    <th style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Normal Range</th>
                    <th style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {results?.map((result, idx) => (
                    <tr key={idx}>
                      <td style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', fontWeight: '500' }}>{result.parameterName}</td>
                      <td style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', fontWeight: '600' }}>{result.result || '-'}</td>
                      <td style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', color: colors.gray600 }}>{result.unit}</td>
                      <td style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', color: colors.gray600 }}>{result.normalRange}</td>
                      <td style={{ border: `1px solid ${colors.gray300}`, padding: '6px 8px', color: colors.gray600 }}>{result.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Remarks */}
      {test.remarks && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px', color: colors.gray900, margin: '0 0 8px 0' }}>Lab Technician Remarks:</h3>
          <div 
            style={{ 
              padding: '12px', 
              borderRadius: '0.25rem', // rounded
              fontSize: '14px', 
              backgroundColor: colors.gray50, 
              color: colors.gray700, 
              border: `1px solid ${colors.gray200}` 
            }}
          >
            {test.remarks}
          </div>
        </div>
      )}

      {/* Instructions */}
      {test.instructions && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px', color: colors.gray900, margin: '0 0 8px 0' }}>Special Instructions:</h3>
          <div style={{ fontSize: '14px', color: colors.gray700 }}>
            {test.instructions}
          </div>
        </div>
      )}

      {/* Footer */}
      <div 
        style={{ 
          paddingTop: '16px', 
          marginTop: '32px', 
          borderTop: `2px solid ${colors.gray800}` 
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px', fontSize: '14px' }}>
          <div>
            <p style={{ fontWeight: '600', color: colors.gray900, margin: 0 }}>Completed By:</p>
            <p style={{ fontSize: '12px', marginTop: '4px', color: colors.gray600, margin: '4px 0 0 0' }}>{test.completedBy || test.assignedToName || 'Lab Technician'}</p>
            <div 
              style={{ 
                marginTop: '32px', 
                paddingTop: '4px', 
                borderTop: `1px solid ${colors.gray400}` 
              }}
            >
              <p style={{ fontSize: '12px', color: colors.gray600, margin: 0 }}>Signature & Stamp</p>
            </div>
          </div>
          <div>
            <p style={{ fontWeight: '600', color: colors.gray900, margin: 0 }}>Completed At:</p>
            <p style={{ fontSize: '12px', marginTop: '4px', color: colors.gray600, margin: '4px 0 0 0' }}>{test.reportedAt ? formatDate(test.reportedAt, hospital?.timezone || 'Asia/Kabul', hospital?.calendarType as any) : '-'}</p>
            <div 
              style={{ 
                marginTop: '32px', 
                paddingTop: '4px', 
                borderTop: `1px solid ${colors.gray400}` 
              }}
            >
              <p style={{ fontSize: '12px', color: colors.gray600, margin: 0 }}>Signature & Stamp</p>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '16px', fontSize: '12px', textAlign: 'center', color: colors.gray500 }}>
          This is a computer-generated report. For any queries, please contact the laboratory.
        </div>
      </div>
    </div>
  );
}
