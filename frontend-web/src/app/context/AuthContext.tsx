import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';
import api from '../../api/axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hospitalId: string | null;
  doctorId?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const clearAuth = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    delete api.defaults.headers.common['Authorization'];
  };

  // Check for existing session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');

    if (storedToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

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
        });
      return;
    }

  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.post('/login', { email, password });
      const { token, user: userData } = response.data;
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('auth_user', JSON.stringify(userData));
      localStorage.setItem('auth_token', token);
      // Optionally set default Authorization header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
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
      login: async () => ({ success: false, error: 'Auth context not ready' }),
      logout: () => {}
    };
  }
  return context;
}