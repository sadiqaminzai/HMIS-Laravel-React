import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stethoscope, Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Toaster } from 'sonner';

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Login failed');
    }
  };

  // Demo credentials helper
  const demoCredentials = [
    { role: 'Super Admin', email: 'superadmin@shifaascript.com', password: 'admin123' },
    { role: 'Admin', email: 'admin@hospital.com', password: 'admin123' },
    { role: 'Doctor', email: 'sarah.johnson@hospital.com', password: 'doctor123' },
    { role: 'Receptionist', email: 'receptionist@hospital.com', password: 'reception123' },
    { role: 'Lab Technician', email: 'labtech@hospital.com', password: 'lab123' },
    { role: 'Pharmacist', email: 'pharmacist@hospital.com', password: 'pharmacy123' },
  ];

  const quickLogin = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <Toaster richColors closeButton />
      
      {/* Centered Login Card */}
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Stethoscope className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ShifaaScript</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Doctor Prescription System</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Welcome Back</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">Sign in to your account to continue</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="admin@hospital.com"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Remember me</span>
              </label>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Forgot password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo Credentials */}
        <div className="mt-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-lg border border-amber-200 dark:border-amber-800 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-semibold text-amber-900 dark:text-amber-100">Quick Demo Login</h3>
          </div>
          
          <div className="space-y-1.5">
            {demoCredentials.map((cred, index) => (
              <button
                key={index}
                onClick={() => quickLogin(cred.email, cred.password)}
                className="w-full text-left px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-sm transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 rounded flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">{cred.role}</span>
                </div>
                <LogIn className="w-3 h-3 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              </button>
            ))}
          </div>
          
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 text-center">
            👆 Click any role to login instantly
          </p>
        </div>
      </div>
    </div>
  );
}