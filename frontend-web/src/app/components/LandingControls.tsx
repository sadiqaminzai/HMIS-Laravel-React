import React from 'react';
import { Sun, Moon, Languages } from 'lucide-react';
import { useLandingTheme } from '../contexts/LandingThemeContext';
import { useLandingLanguage, Language } from '../contexts/LandingLanguageContext';

export function LandingControls() {
  const { theme, toggleTheme } = useLandingTheme();
  const { language, setLanguage } = useLandingLanguage();
  const [showLangMenu, setShowLangMenu] = React.useState(false);

  const languages: { code: Language; name: string; nativeName: string }[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'ps', name: 'Pashto', nativeName: 'پښتو' },
    { code: 'fa', name: 'Dari', nativeName: 'دری' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  ];

  const currentLang = languages.find(l => l.code === language);

  return (
    <div className="flex items-center gap-2">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={`p-2 rounded-lg transition-all duration-200 ${
          theme === 'dark'
            ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Language Selector */}
      <div className="relative">
        <button
          onClick={() => setShowLangMenu(!showLangMenu)}
          className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
            theme === 'dark'
              ? 'bg-gray-700 text-white hover:bg-gray-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Languages className="w-4 h-4" />
          <span className="text-sm font-medium">{currentLang?.nativeName}</span>
        </button>

        {showLangMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowLangMenu(false)}
            />
            <div
              className={`absolute top-full mt-2 right-0 rounded-lg shadow-xl overflow-hidden z-50 min-w-[160px] ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              }`}
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLangMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                    language === lang.code
                      ? theme === 'dark'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-600'
                      : theme === 'dark'
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{lang.nativeName}</div>
                  <div className={`text-xs ${
                    language === lang.code
                      ? theme === 'dark' ? 'text-blue-200' : 'text-blue-500'
                      : theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    {lang.name}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}