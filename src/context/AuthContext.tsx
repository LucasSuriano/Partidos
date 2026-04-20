"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseNoAuth } from '../lib/supabase';
import styles from '../components/Login.module.css';
import type { Role } from '../types';

export type { Role };

export interface User {
  id: string;
  username: string;
  role: Role;
}

interface AuthContextProps {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<void>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // ── Usuarios manuales: sesión via localStorage (sincrónico) ──
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        setUser(parsed);
        setIsLoaded(true);

        // Validación en background: confirmar que el usuario aún existe en DB y actualizar última conexión
        supabaseNoAuth
          .from('users')
          .select('id, username')
          .eq('username', parsed.username)
          .then(({ data, error }) => {
            if (error || !data || data.length === 0) {
              setUser(null);
              localStorage.removeItem('auth_user');
            } else {
              // Actualizar last_sign_in_at en background
              supabaseNoAuth.from('users').update({
                last_sign_in_at: new Date().toISOString()
              }).eq('id', data[0].id).then(({ error: updateError }) => {
                if (updateError) console.error("Fallo actualizando last_sign_in_at (manual-bg):", updateError);
              });
            }
          });
      } catch {
        localStorage.removeItem('auth_user');
      }
    }

    // ── Usuarios de Google: sesión via Supabase Auth ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        // Solo procesamos sesiones de Google (emails reales, no @entiendanla.local)
        const email = session.user.email ?? '';
        const name = session.user.user_metadata?.full_name || email.split('@')[0] || 'Google User';

        let assignedRole: Role = 'user';
        let assignedId: string = session.user.id;

        try {
          const { data, error } = await supabaseNoAuth
            .from('users')
            .select('id, role')
            .eq('username', email);

          if (!error && data && data.length > 0) {
            assignedRole = data[0].role as Role;
            assignedId = data[0].id;

            // Actualizar last_sign_in en background
            supabaseNoAuth.from('users').update({
              last_sign_in_at: new Date().toISOString(),
              full_name: name,
              avatar_url: session.user.user_metadata?.avatar_url || ''
            }).eq('username', email).then(({ error: updateError }) => {
              if (updateError) console.error("Fallo actualizando last_sign_in_at:", updateError);
            });

          } else if (!error && (!data || data.length === 0)) {
            // Primer login con Google: crear registro en tabla users
            const { data: insertData, error: insertError } = await supabaseNoAuth.from('users').insert([{
              username: email,
              password: null as any,
              role: 'user',
              full_name: name,
              avatar_url: session.user.user_metadata?.avatar_url || '',
              last_sign_in_at: new Date().toISOString()
            }]).select('id');

            if (insertError) {
              console.error("Fallo la inserción en Supabase:", insertError);
            } else if (insertData && insertData.length > 0) {
              assignedId = insertData[0].id;
            }
          }
        } catch (err) {
          console.error("Error al obtener/guardar el rol del usuario Google:", err);
        }

        // Solo seteamos si no hay un usuario manual ya cargado
        if (!localStorage.getItem('auth_user')) {
          setUser({ id: assignedId, username: name, role: assignedRole });
        }

      } else if (event === 'SIGNED_OUT') {
        if (!localStorage.getItem('auth_user')) {
          setUser(null);
        }
      }

      // Marcamos como cargado una vez que llega el evento inicial de Google
      if (!localStorage.getItem('auth_user')) {
        setIsLoaded(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Login manual — delega al endpoint server-side que usa bcrypt.
   * La contraseña nunca viaja de vuelta al cliente.
   */
  const login = async (username: string, password: string): Promise<boolean> => {
    const u = username.trim();
    const p = password.trim();

    if (!p) return false;

    // Helper para determinar la URL de la API
    const getApiUrl = (path: string) => {
      if (typeof window !== 'undefined' && !window.location.href.includes('localhost:3000')) {
        return `https://partidos-ruby.vercel.app${path}`;
      }
      return path;
    };

    try {
      // Usamos la URL dinámica para que funcione tanto en local como en el APK
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });

      const json = await res.json();

      if (json.ok && json.user) {
        const loggedInUser: User = {
          id: json.user.id,
          username: json.user.username,
          role: json.user.role as Role
        };
        setUser(loggedInUser);
        localStorage.setItem('auth_user', JSON.stringify(loggedInUser));
        return true;
      }

      return false;
    } catch (e) {
      console.error('Error llamando a /api/auth/login:', e);
      return false;
    }
  };

  /**
   * Registro manual — delega al endpoint server-side que hashea con bcrypt.
   * Nunca se guarda la contraseña en texto plano.
   */
  const register = async (username: string, password: string): Promise<boolean> => {
    const u = username.trim();
    const p = password.trim();

    if (!p) return false;

    const getApiUrl = (path: string) => {
      if (typeof window !== 'undefined' && !window.location.href.includes('localhost:3000')) {
        return `https://partidos-ruby.vercel.app${path}`;
      }
      return path;
    };

    try {
      // Usamos la URL dinámica para que funcione tanto en local como en el APK
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });

      const json = await res.json();

      if (json.ok && json.user) {
        const registeredUser: User = {
          id: json.user.id,
          username: json.user.username,
          role: json.user.role as Role
        };
        setUser(registeredUser);
        localStorage.setItem('auth_user', JSON.stringify(registeredUser));
        return true;
      }

      return false;
    } catch (e) {
      console.error('Error llamando a /api/auth/register:', e);
      return false;
    }
  };

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    // Cerramos también sesión de Google si existe
    await supabase.auth.signOut();
  };

  if (!isLoaded) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.bgBlob1} />
        <div className={styles.bgBlob2} />
        <div className={styles.bgBlob3} />

        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '1.5rem', maxWidth: '320px', margin: 'auto' }}>
          <div className={styles.logoWrap} style={{ width: '64px', height: '64px', opacity: 0.9 }}>
            <img src="/logo.png" alt="Logo" className={styles.logo} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div className={styles.spinner} style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#10b981', width: '20px', height: '20px' }}></div>
            <span style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.03em' }}>Cargando sesión...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, register, logout }}>
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
