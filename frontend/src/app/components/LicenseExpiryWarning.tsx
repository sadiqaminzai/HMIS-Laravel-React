import React from 'react';
import { AlertTriangle, X, Phone, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LicenseExpiryWarningProps {
  expiryDate: string;
  daysRemaining: number;
  onClose: () => void;
}

export function LicenseExpiryWarning({ expiryDate, daysRemaining, onClose }: LicenseExpiryWarningProps) {
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {t('license.warning.title', 'License Expiry Warning')}
              </h2>
              <p className="text-white/90 text-sm">
                {t('license.warning.subtitle', 'Action Required')}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-4">
            {/* Days Remaining Alert */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-3 flex-shrink-0">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-0.5">
                  {daysRemaining}
                </div>
                <div className="text-xs font-medium text-orange-700 dark:text-orange-300">
                  {daysRemaining === 1 
                    ? t('license.warning.dayRemaining', 'Day Remaining')
                    : t('license.warning.daysRemaining', 'Days Remaining')}
                </div>
              </div>
            </div>

            {/* Expiry Message */}
            <div className="flex-1 space-y-2">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {t('license.warning.message', 'Your license will expire on')}
              </p>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-2 text-center">
                <p className="text-base font-bold text-red-600 dark:text-red-400">
                  {formatDate(expiryDate)}
                </p>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-xs text-red-800 dark:text-red-300 text-center leading-relaxed">
              {t('license.warning.renewMessage', 'Please renew your license before expiry to avoid service interruption. Contact us for renewal.')}
            </p>
          </div>

          {/* Contact Information */}
          <div className="border-t dark:border-gray-700 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center">
              {t('license.contact.title', 'Contact for Renewal')}
            </p>
            
            <div className="flex items-center justify-center gap-6">
              {/* Phone Numbers */}
              <div className="flex items-center gap-2 text-xs">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="flex gap-1.5">
                  <a 
                    href="tel:+93789681010" 
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    +93 789 681 010
                  </a>
                  <span className="text-gray-400">|</span>
                  <a 
                    href="tel:+93701021319" 
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    +93 701 021 319
                  </a>
                </div>
              </div>

              {/* Emails */}
              <div className="flex items-center gap-2 text-xs">
                <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div className="flex gap-1.5">
                  <a 
                    href="mailto:sadiq.aminzai2014@gmail.com" 
                    className="text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    sadiq.aminzai2014@gmail.com
                  </a>
                  <span className="text-gray-400">|</span>
                  <a 
                    href="mailto:raz.sahar2@gmail.com" 
                    className="text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    raz.sahar2@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg text-sm"
          >
            {t('license.warning.understand', 'I Understand')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}