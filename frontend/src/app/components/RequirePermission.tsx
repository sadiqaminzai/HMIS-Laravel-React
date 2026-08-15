import React from 'react';
import { useAuth } from '../context/AuthContext';

type RequirePermissionProps = {
  anyOf: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function RequirePermission({ anyOf, children, fallback }: RequirePermissionProps) {
  const { hasPermission } = useAuth();

  const allowed = anyOf.length === 0 || anyOf.some((p) => hasPermission(p));

  if (allowed) return <>{children}</>;

  return (
    <>
      {fallback ?? (
        <div className="max-w-xl mx-auto mt-10 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access denied</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            You don’t have permission to view this page.
          </p>
        </div>
      )}
    </>
  );
}
