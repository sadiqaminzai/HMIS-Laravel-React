import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PrescriptionVerificationPage } from './PrescriptionVerificationPage';
import { PatientCardVerificationPage } from './PatientCardVerificationPage';
import { LabReportVerificationPage } from './LabReportVerificationPage';
import { TransactionVerificationPage } from './TransactionVerificationPage';

export function VerificationRoutes() {
  return (
    <Routes>
      <Route path="/verify/prescription/:token" element={<PrescriptionVerificationPage />} />
      <Route path="/verify/patient/:token" element={<PatientCardVerificationPage />} />
      <Route path="/verify/lab-report/:token" element={<LabReportVerificationPage />} />
      <Route path="/verify/transaction/:token" element={<TransactionVerificationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
