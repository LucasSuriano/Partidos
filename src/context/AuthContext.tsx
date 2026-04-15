"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseNoAuth } from '../lib/supabase';
import styles from '../components/Login.module.css';

export type Role = 'admin' | 'user';

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
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser); // Optimistic UI
      
      // Validación en segundo plano para evitar usuarios borrados en caché
      supabaseNoAuth
        .from('users')
        .select('username')
        .eq('username', parsedUser.username)
        .then(({ data, error }) => {
          if (error || !data || data.length === 0) {
            // El usuario fue eliminado de la tabla, invalidamos su sesión
            setUser(null);
            localStorage.removeItem('auth_user');
          }
        });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        const name = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Google User';
        const email = session.user.email;
        
        let assignedRole: Role = 'user';
        let assignedId: string = session.user.id;
        
        if (email) {
          try {
            const { data, error } = await supabaseNoAuth
              .from('users')
              .select('id, role')
              .eq('username', email);
              
            if (!error && data && data.length > 0) {
              assignedRole = data[0].role as Role;
              assignedId = data[0].id;
              // Disparamos la actualización en segundo plano (SIN AWAIT) para no congelar la pantalla del usuario
              supabaseNoAuth.from('users').update({
                last_sign_in_at: new Date().toISOString(),
                full_name: name,
                avatar_url: session.user.user_metadata?.avatar_url || ''
              }).eq('username', email).then(({ error: updateError }) => {
                if (updateError) console.error("Fallo actualizando last_sign_in_at:", updateError);
              });
              
            } else if (!error && (!data || data.length === 0)) {
              // Si no existe, lo insertamos con todos los campos profesionales y tomamos su id
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
            console.error("Error al obtener/guardar el rol del usuario:", err);
          }
        }
        
        setUser({ id: assignedId, username: name, role: assignedRole });
      } else if (event === 'SIGNED_OUT') {
        if (!localStorage.getItem('auth_user')) {
          setUser(null);
        }
      }
      setIsLoaded(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (username: string, pass: string): Promise<boolean> => {
    const u = username.trim();
    const p = pass.trim();
    
    if (!p) return false;
    
    try {
      const { data, error } = await supabaseNoAuth
        .from('users')
        .select('*')
        .eq('username', u)
        .eq('password', p);
        
      if (error) {
        console.error("Error validando usuario:", error);
        return false;
      }
      
      if (data && data.length === 1) {
        const loggedInUser: User = { id: data[0].id, username: data[0].username, role: data[0].role as Role };
        setUser(loggedInUser);
        localStorage.setItem('auth_user', JSON.stringify(loggedInUser));
        return true;
      }
    } catch (e) {
      console.error(e);
    }

    return false;
  };

  const register = async (username: string, pass: string): Promise<boolean> => {
    const u = username.trim();
    const p = pass.trim();
    
    if (!p) return false;
    
    try {
      const { error } = await supabaseNoAuth
        .from('users')
        .insert([{
          username: u,
          password: p,
          role: 'user',
          last_sign_in_at: new Date().toISOString()
        }]);
        
      if (error) {
        console.error("Error registrando usuario:", error);
        return false;
      }
      
      // Auto-login después de registrar satisfactoriamente
      return await login(u, p);
    } catch (e) {
      console.error(e);
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
    await supabase.auth.signOut();
  };

  if (!isLoaded) {
    return (
      <div className={styles.wrapper}>
        {/* Fondo animado idéntico al del Login */}
        <div className={styles.bgBlob1} />
        <div className={styles.bgBlob2} />
        <div className={styles.bgBlob3} />
        
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '1.5rem', maxWidth: '320px', margin: 'auto' }}>
           {/* Logo central */}
           <div className={styles.logoWrap} style={{ width: '64px', height: '64px', opacity: 0.9 }}>
             <img src="/img/v987-24a.jpg" alt="Logo" className={styles.logo} />
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
