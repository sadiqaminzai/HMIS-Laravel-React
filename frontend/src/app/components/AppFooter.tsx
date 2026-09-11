import React from 'react';
import { Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION, SUPPORT_NUMBERS, VENDOR_NAME } from '../constants/app';

/**
 * Shown at the bottom of the home dashboard for every role.
 *
 * Kept as its own component so the vendor line, version and support numbers are
 * defined in one place rather than repeated across the role dashboards.
 */
export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="mt-6 pt-3 border-t border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* The vendor name is a proper noun and stays in Latin script, so it
              is marked LTR: inside a Pashto sentence an RTL run would otherwise
              drag its punctuation to the wrong end. */}
          <span>
            {t('ui.poweredBy', 'Powered by')}{' '}
            <span dir="ltr" className="font-semibold text-gray-700 dark:text-gray-200">
              {VENDOR_NAME}
            </span>
          </span>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-600">&bull;</span>
          <span>
            {t('ui.version', 'Version')} <span dir="ltr">{APP_VERSION}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="font-medium text-gray-600 dark:text-gray-300">
            {t('ui.contactUs', 'Contact Us')}:
          </span>
          {SUPPORT_NUMBERS.map((number, index) => (
            <React.Fragment key={number}>
              {index > 0 && <span className="text-gray-300 dark:text-gray-600">,</span>}
              {/* tel: strips spaces so the dialler receives a clean number.
                  dir="ltr" keeps the leading +93 at the front: a phone number
                  is read left-to-right even in an RTL paragraph, and without
                  this the plus sign jumped to the end. */}
              <a
                dir="ltr"
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
