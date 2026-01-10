import React from 'react';
import { ShieldAlert, Phone, Mail, Calendar, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LicenseExpiredProps {
  expiryDate: string;
  hospitalName: string;
  onLogout: () => void;
}

export function LicenseExpired({ expiryDate, hospitalName, onLogout }: LicenseExpiredProps) {
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-red-900/20 dark:to-orange-900/20 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Main Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
          {/* Header with Icon - Compact */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 text-center relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}></div>
            </div>
            
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3 shadow-xl">
                <ShieldAlert className="w-9 h-9 text-white animate-pulse" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">
                {t('license.expired.title', 'License Expired')}
              </h1>
              <p className="text-white/90 text-base">
                {t('license.expired.subtitle', 'Service Access Suspended')}
              </p>
            </div>
          </div>

          {/* Content - Two Column Layout - Compact */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* LEFT COLUMN - Expiry Information */}
              <div className="space-y-4">
                {/* Hospital Info */}
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <h2 className="text-lg font-bold text-red-700 dark:text-red-300">
                        {hospitalName}
                      </h2>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
                      <Calendar className="w-4 h-4" />
                      <p className="font-semibold text-sm">
                        {t('license.expired.expiredOn', 'Expired on')}: {formatDate(expiryDate)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <p className="text-gray-700 dark:text-gray-300 text-center text-base leading-relaxed">
                    {t('license.expired.message', 'Your license has expired and access to the system has been suspended.')}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
                    {t('license.expired.renewInstructions', 'To renew your license and restore access, please contact our support team using the information below.')}
                  </p>
                </div>

                {/* Logout Button */}
                <button
                  onClick={onLogout}
                  className="w-full py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all hover:shadow-lg"
                >
                  {t('license.expired.logout', 'Logout')}
                </button>
              </div>

              {/* RIGHT COLUMN - Contact Information */}
              <div className="space-y-4">
                {/* Contact Section */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700 rounded-2xl p-4 border-2 border-blue-200 dark:border-gray-600 h-full">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white text-center mb-3">
                    {t('license.contact.title', 'Contact for Renewal')}
                  </h3>

                  <div className="space-y-3">
                    {/* Phone Numbers */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                          <Phone className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                            {t('license.contact.phone', 'Phone Numbers')}
                          </p>
                          <div className="flex gap-2 text-sm">
                            <a 
                              href="tel:+93789681010" 
                              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                            >
                              +93 789 681 010
                            </a>
                            <span className="text-gray-400">|</span>
                            <a 
                              href="tel:+93701021319" 
                              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                            >
                              +93 701 021 319
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-300 dark:border-gray-600"></div>

                    {/* Email Information */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-start gap-2">
                        <div className="w-9 h-9 bg-purple-100 dark:bg-purple-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1.5 text-sm">
                            {t('license.expired.email', 'Email')}
                          </h4>
                          <div className="space-y-0.5">
                            <a 
                              href="mailto:sadiq.aminzai2014@gmail.com" 
                              className="block text-purple-700 dark:text-purple-300 hover:underline text-xs"
                            >
                              sadiq.aminzai2014@gmail.com
                            </a>
                            <a 
                              href="mailto:raz.sahar2@gmail.com" 
                              className="block text-purple-700 dark:text-purple-300 hover:underline text-xs"
                            >
                              raz.sahar2@gmail.com
                            </a>
                            <a 
                              href="mailto:mohammadbilalniazi2016@gmail.com" 
                              className="block text-purple-700 dark:text-purple-300 hover:underline text-xs"
                            >
                              mohammadbilalniazi2016@gmail.com
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-300 dark:border-gray-600"></div>

                    {/* Support Hours */}
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {t('license.contact.supportHours', 'Support Hours')}:
                        </span>
                        {' '}
                        {t('license.contact.supportHoursDetails', 'Saturday - Thursday: 8:00 AM - 5:00 PM (AFT)')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note - Compact */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t('license.expired.footer', 'Thank you for choosing ShifaaScript. We look forward to serving you again.')}
          </p>
        </div>
      </div>
    </div>
  );
}