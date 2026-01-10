import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';
import { mockUsers } from '../data/mockData';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hospitalId: string;
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

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const foundUser = mockUsers.find(u => u.email === email && u.password === password);

    if (foundUser) {
      const userData: User = {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
        hospitalId: foundUser.hospitalId,
        doctorId: (foundUser as any).doctorId,
      };
      
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('auth_user', JSON.stringify(userData));
      
      return { success: true };
    } else {
      return { success: false, error: 'Invalid email or password' };
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_user');
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