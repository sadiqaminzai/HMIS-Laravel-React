import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { useLandingLanguage } from '../contexts/LandingLanguageContext';
import { useLandingTheme } from '../contexts/LandingThemeContext';
import api from '../../api/axios';

export function ContactForm() {
  const { t } = useLandingLanguage();
  const { theme } = useLandingTheme();
  const isDark = theme === 'dark';
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  const validateForm = () => {
    const newErrors = {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
    };
    let isValid = true;

    // Full Name validation (at least 3 characters)
    if (formData.name.trim().length < 3) {
      newErrors.name = t('validation.nameMin');
      isValid = false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = t('validation.emailInvalid');
      isValid = false;
    }

    // Phone validation (exactly 10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = t('validation.phoneInvalid');
      isValid = false;
    }

    // Subject validation (5-20 characters)
    if (formData.subject.trim().length < 5 || formData.subject.trim().length > 20) {
      newErrors.subject = t('validation.subjectLength');
      isValid = false;
    }

    // Message validation (12-96 characters)
    if (formData.message.trim().length < 12 || formData.message.trim().length > 96) {
      newErrors.message = t('validation.messageLength');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error(t('validation.fixErrors'));
      return;
    }

    setLoading(true);

    try {
      await api.post('/contact-messages', formData);

      toast.success(t('validation.success'));
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      });
      setErrors({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || t('validation.fixErrors');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  return (
    <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-5 shadow-md border h-full`}>
      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>{t('contact.form.title')}</h3>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
            {t('contact.form.name')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`w-full px-3 py-2 text-sm border ${errors.name ? 'border-red-500' : isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${isDark ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-white text-gray-900'}`}
            placeholder={t('contact.form.namePlaceholder')}
            required
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
            {t('contact.form.email')} <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`w-full px-3 py-2 text-sm border ${errors.email ? 'border-red-500' : isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${isDark ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-white text-gray-900'}`}
            placeholder={t('contact.form.emailPlaceholder')}
            required
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
            {t('contact.form.phoneLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className={`w-full px-3 py-2 text-sm border ${errors.phone ? 'border-red-500' : isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${isDark ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-white text-gray-900'}`}
            placeholder={t('contact.form.phonePlaceholder')}
            required
          />
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
            {t('contact.form.subject')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            className={`w-full px-3 py-2 text-sm border ${errors.subject ? 'border-red-500' : isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${isDark ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-white text-gray-900'}`}
            placeholder={t('contact.form.subjectPlaceholder')}
            required
          />
          {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
        </div>

        <div>
          <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
            {t('contact.form.message')} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.message}
            onChange={(e) => handleChange('message', e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 text-sm border ${errors.message ? 'border-red-500' : isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all ${isDark ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-white text-gray-900'}`}
            placeholder={t('contact.form.messagePlaceholder')}
            required
          />
          {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('contact.form.sending')}
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              {t('contact.form.send')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}