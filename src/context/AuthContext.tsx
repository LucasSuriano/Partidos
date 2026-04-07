"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'admin' | 'user';

export interface User {
  username: string;
  role: Role;
}

interface AuthContextProps {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoaded(true);
  }, []);

  const login = async (username: string, pass: string): Promise<boolean> => {
    const u = username.trim();
    const p = pass.trim();
    
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', u)
        .eq('password', p);
        
      if (error) {
        console.error("Error validando usuario:", error);
        return false;
      }
      
      if (data && data.length === 1) {
        const loggedInUser: User = { username: data[0].username, role: data[0].role as Role };
        setUser(loggedInUser);
        localStorage.setItem('auth_user', JSON.stringify(loggedInUser));
        return true;
      }
    } catch (e) {
      console.error(e);
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  if (!isLoaded) return null; // Prevenir Hydration mismatch

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe estar dentro de AuthProvider");
  }
  return context;
};
