import React from 'react';
import { 
  Stethoscope, 
  ArrowRight, 
  Shield, 
  Zap, 
  Users, 
  FileText, 
  Pill, 
  FlaskConical,
  Clock,
  CheckCircle2,
  Globe,
  Printer,
  QrCode,
  BarChart3,
  Lock,
  Heart,
  MapPin,
  Phone,
  Mail,
  Send,
  Linkedin,
  Github
} from 'lucide-react';
import { ContactForm } from './ContactForm';
import { useLandingTheme } from '../contexts/LandingThemeContext';
import { useLandingLanguage } from '../contexts/LandingLanguageContext';
import { LandingControls } from './LandingControls';
const heroBg = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2000';
const statsImage = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800';
const sadiqPhoto = 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200';
const razPhoto = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200';
const bilalPhoto = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const { theme } = useLandingTheme();
  const { t, isRTL } = useLandingLanguage();

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-white'}`}>
      {/* Header */}
      <header className={`border-b ${isDark ? 'border-gray-800 bg-gray-950/95' : 'border-gray-100 bg-white/95'} backdrop-blur-md sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl blur opacity-75"></div>
                <div className="relative w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-xl">
                  <Stethoscope className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  ShifaaScript
                </h1>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('footer.tagline')}</p>
              </div>
            </div>

            {/* Controls and Login Button */}
            <div className="flex items-center gap-4">
              <LandingControls />
              <button
                onClick={onGetStarted}
                className="group px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 flex items-center gap-2 hover:scale-105 text-sm"
              >
                Login
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Medical Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${heroBg})`,
            }}
          ></div>
          {/* Overlay for better text readability */}
          <div className={`absolute inset-0 ${isDark ? 'bg-gray-950/90' : 'bg-white/85'}`}></div>
          
          {/* Grid Pattern */}
          <div className={`absolute inset-0 ${isDark ? 'opacity-5' : 'opacity-3'}`} style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 ${isDark ? 'bg-gradient-to-r from-blue-950 to-purple-950 text-blue-200 border border-blue-800/50' : 'bg-white text-blue-700 border border-blue-200'} rounded-full font-medium mb-6 animate-fade-in shadow-lg backdrop-blur-sm`}>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">{t('hero.badge')}</span>
            </div>

            {/* Main Heading */}
            <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-5 leading-tight animate-fade-in-up`}>
              {t('hero.title')}
            </h1>

            {/* Subheading */}
            <p className={`text-base sm:text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'} max-w-2xl mx-auto mb-8 animate-fade-in-up animation-delay-200 leading-relaxed font-medium`}>
              {t('hero.description')}
            </p>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-400">
              <a
                href="#contact"
                className={`group px-8 py-4 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'} rounded-xl font-semibold shadow-xl transition-all duration-300 flex items-center gap-2 hover:scale-105 backdrop-blur-sm`}
              >
                <Mail className="w-5 h-5" />
                {t('hero.contactUs')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className={`py-10 px-4 sm:px-6 lg:px-8 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat Card 1 - Active Users */}
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105`}>
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent mb-1">
                  {t('hero.stats.facilities.number')}
                </div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('hero.stats.facilities.label')}
                </div>
              </div>
            </div>

            {/* Stat Card 2 - Prescriptions/Month */}
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105`}>
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent mb-1">
                  {t('hero.stats.prescriptions.number')}
                </div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('hero.stats.prescriptions.label')}
                </div>
              </div>
            </div>

            {/* Stat Card 3 - System Reliability */}
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105`}>
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent mb-1">
                  {t('hero.stats.uptime.number')}
                </div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('hero.stats.uptime.label')}
                </div>
              </div>
            </div>

            {/* Stat Card 4 - Support Available */}
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105`}>
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent mb-1">
                  {t('hero.stats.support.number')}
                </div>
                <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('hero.stats.support.label')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden ${isDark ? 'bg-gray-950' : 'bg-white'}`}>
        {/* Background Decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-1/2 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl`}></div>
          <div className={`absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl`}></div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <div className={`inline-flex items-center gap-2 px-4 py-2 ${isDark ? 'bg-blue-950/50 text-blue-300 border border-blue-800/50' : 'bg-blue-50 text-blue-700 border border-blue-200'} rounded-full text-sm font-medium mb-6 backdrop-blur-sm`}>
              <Zap className="w-4 h-4" />
              <span>Powerful Features</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              {t('features.title')}
            </h2>
            <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'} max-w-2xl mx-auto leading-relaxed`}>
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<FileText className="w-7 h-7" />}
              title={t('features.prescription.title')}
              description={t('features.prescription.desc')}
              gradient="from-blue-500 to-blue-600"
              isDark={isDark}
            />
            <FeatureCard
              icon={<Pill className="w-7 h-7" />}
              title={t('features.medicine.title')}
              description={t('features.medicine.desc')}
              gradient="from-purple-500 to-purple-600"
              isDark={isDark}
            />
            <FeatureCard
              icon={<FlaskConical className="w-7 h-7" />}
              title={t('features.lab.title')}
              description={t('features.lab.desc')}
              gradient="from-pink-500 to-pink-600"
              isDark={isDark}
            />
            <FeatureCard
              icon={<Users className="w-7 h-7" />}
              title={t('features.patient.title')}
              description={t('features.patient.desc')}
              gradient="from-green-500 to-green-600"
              isDark={isDark}
            />
            <FeatureCard
              icon={<Shield className="w-7 h-7" />}
              title={t('features.rbac.title')}
              description={t('features.rbac.desc')}
              gradient="from-orange-500 to-orange-600"
              isDark={isDark}
            />
            <FeatureCard
              icon={<Clock className="w-7 h-7" />}
              title={t('features.appointment.title')}
              description={t('features.appointment.desc')}
              gradient="from-teal-500 to-teal-600"
              isDark={isDark}
            />
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className={`py-16 px-4 sm:px-6 lg:px-8 ${isDark ? 'bg-gray-800' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left Content */}
            <div>
              <h2 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
                {t('excellence.title')}
              </h2>
              <p className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
                {t('excellence.subtitle')}
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm mb-0.5`}>{t('excellence.multiLang.title')}</h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('excellence.multiLang.desc')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm mb-0.5`}>{t('excellence.print.title')}</h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('excellence.print.desc')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm mb-0.5`}>{t('excellence.calendar.title')}</h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('excellence.calendar.desc')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm mb-0.5`}>{t('excellence.theme.title')}</h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('excellence.theme.desc')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm mb-0.5`}>{t('excellence.analytics.title')}</h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('excellence.analytics.desc')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Icon Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} p-5 rounded-xl shadow-md border text-center hover:shadow-lg transition-all hover:scale-105`}>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2 shadow-md">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{t('excellence.badge1')}</h3>
              </div>
              <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} p-5 rounded-xl shadow-md border text-center hover:shadow-lg transition-all hover:scale-105`}>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-2 shadow-md">
                  <Printer className="w-6 h-6 text-white" />
                </div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{t('excellence.badge2')}</h3>
              </div>
              <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} p-5 rounded-xl shadow-md border text-center hover:shadow-lg transition-all hover:scale-105`}>
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mx-auto mb-2 shadow-md">
                  <QrCode className="w-6 h-6 text-white" />
                </div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{t('excellence.badge3')}</h3>
              </div>
              <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} p-5 rounded-xl shadow-md border text-center hover:shadow-lg transition-all hover:scale-105`}>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mx-auto mb-2 shadow-md">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{t('excellence.badge4')}</h3>
              </div>
              <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} p-5 rounded-xl shadow-md border text-center hover:shadow-lg transition-all hover:scale-105`}>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-2 shadow-md">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{t('excellence.badge5')}</h3>
              </div>
              <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} p-5 rounded-xl shadow-md border text-center hover:shadow-lg transition-all hover:scale-105`}>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mx-auto mb-2 shadow-md">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{t('excellence.badge6')}</h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Developers Section */}
      <section className={`py-16 px-4 sm:px-6 lg:px-8 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
              {t('developers.title')}
            </h2>
            <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('developers.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Developer 1 */}
            <div className={`${isDark ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'} rounded-xl p-5 border hover:shadow-xl transition-all duration-300 hover:scale-105`}>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden shadow-lg border border-blue-600">
                  <img src={sadiqPhoto} alt="Sadiq AMIINZAI" className="w-full h-full object-cover" />
                </div>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-1`}>{t('developers.dev1.name')}</h3>
                <p className="text-sm text-blue-600 font-semibold mb-3">{t('developers.dev1.role')}</p>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <a href="tel:+93789681010" className={`${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'}`}>{t('developers.dev1.phone')}</a>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <a href="mailto:sadiq.aminzai2014@gmail.com" className={`${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'}`}>{t('developers.dev1.email')}</a>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 mt-3">
                  <a href="#" className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                    <Linkedin className="w-3.5 h-3.5 text-white" />
                  </a>
                  <a href="#" className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-900 transition-colors">
                    <Github className="w-3.5 h-3.5 text-white" />
                  </a>
                </div>
              </div>
            </div>

            {/* Developer 2 */}
            <div className={`${isDark ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'} rounded-xl p-5 border hover:shadow-xl transition-all duration-300 hover:scale-105`}>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden shadow-lg border border-purple-600">
                  <img src={razPhoto} alt="Raz" className="w-full h-full object-cover" />
                </div>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-1`}>{t('developers.dev2.name')}</h3>
                <p className="text-sm text-purple-600 font-semibold mb-3">{t('developers.dev2.role')}</p>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-purple-600" />
                    <a href="tel:+93701021319" className={`${isDark ? 'text-gray-300 hover:text-purple-400' : 'text-gray-700 hover:text-purple-600'}`}>{t('developers.dev2.phone')}</a>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-purple-600" />
                    <a href="mailto:raz.sahar2@gmail.com" className={`${isDark ? 'text-gray-300 hover:text-purple-400' : 'text-gray-700 hover:text-purple-600'}`}>{t('developers.dev2.email')}</a>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 mt-3">
                  <a href="#" className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                    <Linkedin className="w-3.5 h-3.5 text-white" />
                  </a>
                  <a href="#" className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-900 transition-colors">
                    <Github className="w-3.5 h-3.5 text-white" />
                  </a>
                </div>
              </div>
            </div>

            {/* Developer 3 */}
            <div className={`${isDark ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200'} rounded-xl p-5 border hover:shadow-xl transition-all duration-300 hover:scale-105`}>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden shadow-lg border border-pink-600">
                  <img src={bilalPhoto} alt="Bilal" className="w-full h-full object-cover" />
                </div>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-1`}>{t('developers.dev3.name')}</h3>
                <p className="text-sm text-pink-600 font-semibold mb-3">{t('developers.dev3.role')}</p>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-pink-600" />
                    <a href="tel:+93789795964" className={`${isDark ? 'text-gray-300 hover:text-pink-400' : 'text-gray-700 hover:text-pink-600'}`}>{t('developers.dev3.phone')}</a>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-pink-600" />
                    <a href="mailto:mohammadbilalniazi2016@gmail.com" className={`${isDark ? 'text-gray-300 hover:text-pink-400' : 'text-gray-700 hover:text-pink-600'}`}>{t('developers.dev3.email')}</a>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 mt-3">
                  <a href="#" className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                    <Linkedin className="w-3.5 h-3.5 text-white" />
                  </a>
                  <a href="#" className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-900 transition-colors">
                    <Github className="w-3.5 h-3.5 text-white" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className={`py-12 px-4 sm:px-6 lg:px-8 ${isDark ? 'bg-gray-800' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
              {t('contact.title')}
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('contact.subtitle')}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column - Contact Information & Map */}
            <div className="space-y-4">
              {/* Contact Information */}
              <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-5 shadow-md border`}>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>{t('contact.info')}</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-1 text-sm`}>{t('contact.address')}</h4>
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed space-y-2`}>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('contact.addressKabul')}</p>
                          <p>{t('contact.addressKabulText')}</p>
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('contact.addressKhost')}</p>
                          <p>{t('contact.addressKhostText')}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Phone className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-1 text-sm`}>{t('contact.phone')}</h4>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                        <a href="tel:+93789681010" className="hover:text-blue-600 transition-colors block">{t('contact.phone1')}</a>
                        <a href="tel:+93701021319" className="hover:text-blue-600 transition-colors block">{t('contact.phone2')}</a>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Mail className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-1 text-sm`}>{t('contact.email')}</h4>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                        <a href="mailto:sadiq.aminzai2014@gmail.com" className="hover:text-blue-600 transition-colors block">{t('contact.email1')}</a>
                        <a href="mailto:raz.sahar2@gmail.com" className="hover:text-blue-600 transition-colors block">{t('contact.email2')}</a>
                        <a href="mailto:mohammadbilalniazi2016@gmail.com" className="hover:text-blue-600 transition-colors block">{t('contact.email3')}</a>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-1 text-sm`}>{t('contact.hours')}</h4>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed whitespace-pre-line`}>
                        {t('contact.hoursText')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Google Maps Embed */}
                <div className="mt-4">
                  <div className="rounded-lg overflow-hidden shadow-sm border border-gray-200">
                    <iframe
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3301.5!2d69.9365!3d33.3342!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzPCsDIwJzAzLjEiTiA2OcKwNTYnMTEuNCJF!5e0!3m2!1sen!2s!4v1234567890"
                      width="100%"
                      height="200"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Burge-eSalam Plaza Location"
                    ></iframe>
                  </div>
                  <a
                    href="https://www.google.com/maps/search/Burge-eSalam+Plaza+Khost+Afghanistan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium text-xs"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {t('contact.viewMap')}
                  </a>
                </div>
              </div>
            </div>

            {/* Right Column - Contact Form */}
            <div className="h-full">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">ShifaaScript</h3>
                  <p className="text-xs text-gray-400">{t('footer.tagline')}</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 max-w-md mb-4">
                {t('footer.description')}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-500" />
                  <div>
                    <a href="tel:+93789681010" className="hover:text-white transition-colors">{t('footer.phone1')}</a>
                    <span className="mx-2">|</span>
                    <a href="tel:+93701021319" className="hover:text-white transition-colors">{t('footer.phone2')}</a>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <a href="mailto:sadiq.aminzai2014@gmail.com" className="hover:text-white transition-colors">sadiq.aminzai2014@gmail.com</a>
                    <a href="mailto:raz.sahar2@gmail.com" className="hover:text-white transition-colors">raz.sahar2@gmail.com</a>
                    <a href="mailto:mohammadbilalniazi2016@gmail.com" className="hover:text-white transition-colors">mohammadbilalniazi2016@gmail.com</a>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">{t('footer.products')}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.product1')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.product2')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.product3')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.product4')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.product5')}</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">{t('footer.support')}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#contact" className="hover:text-white transition-colors">{t('footer.contactUs')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.privacy')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.terms')}</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>{t('footer.copyright')}</p>
          </div>
        </div>
      </footer>

      {/* Custom Animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fade-in-up {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }
        
        .animation-delay-200 {
          animation-delay: 0.2s;
          opacity: 0;
          animation-fill-mode: forwards;
        }
        
        .animation-delay-400 {
          animation-delay: 0.4s;
          opacity: 0;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  isDark: boolean;
}

function FeatureCard({ icon, title, description, gradient, isDark }: FeatureCardProps) {
  return (
    <div className={`group relative p-5 ${isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-white'} rounded-2xl transition-all duration-500 overflow-hidden hover:scale-105`}>
      {/* Background Glow Effect */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`}></div>
      
      {/* Border */}
      <div className={`absolute inset-0 rounded-2xl ${isDark ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-gray-200 to-gray-100'} p-[1px]`}>
        <div className={`w-full h-full ${isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-white'} rounded-2xl`}></div>
      </div>
      
      {/* Gradient border on hover */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} p-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500`}>
        <div className={`w-full h-full ${isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-white'} rounded-2xl`}></div>
      </div>
      
      {/* Content - Centered */}
      <div className="relative z-10 text-center flex flex-col items-center">
        {/* Icon */}
        <div className={`inline-flex relative mb-3`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-xl blur opacity-50`}></div>
          <div className={`relative w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500 text-white`}>
            {icon}
          </div>
        </div>
        
        {/* Title */}
        <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2 group-hover:bg-gradient-to-r ${gradient} group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300`}>
          {title}
        </h3>
        
        {/* Description */}
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
          {description}
        </p>
      </div>
    </div>
  );
}