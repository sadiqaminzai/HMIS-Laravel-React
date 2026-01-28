import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PrescriptionVerificationPage } from './PrescriptionVerificationPage';
import { PatientCardVerificationPage } from './PatientCardVerificationPage';
import { LabReportVerificationPage } from './LabReportVerificationPage';

export function VerificationRoutes() {
  return (
    <Routes>
      <Route path="/verify/prescription/:token" element={<PrescriptionVerificationPage />} />
      <Route path="/verify/patient/:token" element={<PatientCardVerificationPage />} />
      <Route path="/verify/lab-report/:token" element={<LabReportVerificationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
