import React from 'react';
import { Phone } from 'lucide-react';
import { APP_VERSION, SUPPORT_NUMBERS, VENDOR_NAME } from '../constants/app';

/**
 * Shown at the bottom of the home dashboard for every role.
 *
 * Kept as its own component so the vendor line, version and support numbers are
 * defined in one place rather than repeated across the six role dashboards.
 */
export function AppFooter() {
  return (
    <footer className="mt-6 pt-3 border-t border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            Powered by{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-200">{VENDOR_NAME}</span>
          </span>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-600">&bull;</span>
          <span>Version {APP_VERSION}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="font-medium text-gray-600 dark:text-gray-300">Contact Us:</span>
          {SUPPORT_NUMBERS.map((number, index) => (
            <React.Fragment key={number}>
              {index > 0 && <span className="text-gray-300 dark:text-gray-600">,</span>}
              {/* tel: strips spaces so the dialler receives a clean number. */}
              <a
                href={`tel:${number.replace(/\s/g, '')}`}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {number}
              </a>
            </React.Fragment>
          ))}
        </div>
      </div>
    </footer>
  );
}
