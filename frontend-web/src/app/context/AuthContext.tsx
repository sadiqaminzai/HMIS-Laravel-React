import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';
import api from '../../api/axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleId?: string | null;
  hospitalId: string | null;
  doctorId?: string;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permissionName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const clearAuth = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    delete api.defaults.headers.common['Authorization'];
  };

  const moduleActions = ['view', 'add', 'edit', 'delete', 'export', 'print', 'import', 'manage'] as const;

  const menuToModules: Record<string, string[]> = {
    view_pharmacy_menu: ['manufacturers', 'medicine_types', 'medicines', 'suppliers', 'transactions', 'stocks', 'stock_reconciliation'],
    view_reception_menu: ['doctors', 'patients', 'appointments'],
    view_laboratory_menu: ['lab_orders', 'test_templates'],
    view_prescriptions_menu: ['prescriptions'],
  };

  const hasPermission = (permissionName: string) => {
    if (!permissionName) return false;

    const assigned = user?.permissions ?? [];
    if (assigned.includes(permissionName)) {
      return true;
    }

    const normalized = permissionName.trim();
    const match = /^(view|manage)_(.+)$/.exec(normalized);
    if (match) {
      const permissionType = match[1];
      const moduleName = match[2];
      if (permissionType === 'view') {
        const hasAnyModulePermission = moduleActions.some((action) => assigned.includes(`${action}_${moduleName}`));
        if (hasAnyModulePermission) {
          return true;
        }
      }

      if (permissionType === 'manage') {
        return false;
      }
    }

    if (normalized in menuToModules) {
      const modules = menuToModules[normalized] ?? [];
      const hasAnyMappedModulePermission = modules.some((moduleName) =>
        moduleActions.some((action) => assigned.includes(`${action}_${moduleName}`))
      );

      if (hasAnyMappedModulePermission) {
        return true;
      }
    }

    return false;
  };

  // Check for existing session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

      // Optimistically hydrate user to avoid redirect flicker on refresh
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User;
          setUser(parsedUser);
          setIsAuthenticated(true);
        } catch (_) {
          // ignore parse errors, will be corrected by /me
        }
      }

      api
        .get('/me')
        .then((response) => {
          const authedUser = response.data.user as User;
          setUser(authedUser);
          setIsAuthenticated(true);
          localStorage.setItem('auth_user', JSON.stringify(authedUser));
        })
        .catch(() => {
          clearAuth();
        })
        .finally(() => setAuthLoading(false));
      return;
    }

    setAuthLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.post('/login', { email, password });
      const { token, user: userData } = response.data;
      // Persist token immediately so follow-up calls can authenticate
      localStorage.setItem('auth_token', token);
      // Optionally set default Authorization header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Prefer fresh user payload from /me so permissions/role changes are reflected immediately
      // (and to keep localStorage consistent with backend reality)
      try {
        const me = await api.get('/me');
        const authedUser = me.data.user as User;
        setUser(authedUser);
        setIsAuthenticated(true);
        localStorage.setItem('auth_user', JSON.stringify(authedUser));
      } catch {
        // Fall back to login response payload
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('auth_user', JSON.stringify(userData));
      }
      return { success: true };
    } catch (error: any) {
      let message = 'Login failed';
      if (error.response && error.response.data && error.response.data.message) {
        message = error.response.data.message;
      }
      return { success: false, error: message };
    }
  };

  const logout = () => {
    api.post('/logout').catch(() => {
      // Best-effort logout; ignore API errors here
    });
    clearAuth();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, authLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During hot reload, this might be called before provider is ready
    // Return a safe default instead of throwing
    console.warn('useAuth called outside of AuthProvider - this may be due to hot reload');
    return {
      user: null,
      isAuthenticated: false,
      authLoading: false,
      login: async () => ({ success: false, error: 'Auth context not ready' }),
      logout: () => {},
      hasPermission: () => false,
    };
  }
  return context;
}