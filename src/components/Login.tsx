"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const { login, loginWithGoogle, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [debugMsg, setDebugMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    setDebugMsg('Conectando a Supabase...');
    
    try {
      let success = false;
      
      // Creamos un timeout por si Supabase se queda colgado indefinidamente
      const timeoutPromise = new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 8000)
      );

      const authPromise = isRegistering 
        ? register(username, password)
        : login(username, password);

      setDebugMsg(isRegistering ? 'Registrando usuario...' : 'Validando credenciales...');
      
      // Esperamos que termine de loguear o que pasen 8 segundos
      success = await Promise.race([authPromise, timeoutPromise]);
      
      setDebugMsg('Completado');
      setLoading(false);
      
      if (!success) {
        setError(true);
        setShakeKey(k => k + 1); // retrigger shake animation
      }
    } catch (err: any) {
      setLoading(false);
      setError(true);
      setDebugMsg('Error: ' + err.message);
      setShakeKey(k => k + 1);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgBlob1} />
      <div className={styles.bgBlob2} />
      <div className={styles.bgBlob3} />

      <div className={styles.card} key={shakeKey} data-error={error}>
        <div className={styles.brandSection}>
          <div className={styles.logoWrap}>
            <img src="/img/v987-24a.jpg" alt="Logo" className={styles.logo} />
          </div>
          <h1 className={styles.appName}>Entiendanla</h1>
          <p className={styles.tagline}>Gestión de partidos · Estadísticas · Historial</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {error && (
            <div className={styles.errorBanner}>
              <span>⚠️</span>
              <span>{isRegistering ? "Error al registrar (usuario ya existe)" : "Usuario o contraseña incorrectos."}</span>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="username" className={styles.label}>Usuario</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                id="username"
                type="text"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(false); }}
                className={styles.input}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Contraseña</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(false); }}
                className={styles.input}
                autoComplete={isRegistering ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className={styles.submitBtn}
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  {isRegistering ? <line x1="10" y1="12" x2="20" y2="12" /> : <polyline points="10 17 15 12 10 7"/>}
                  {isRegistering ? <line x1="15" y1="7" x2="15" y2="17" /> : <line x1="15" y1="12" x2="3" y2="12"/>}
                </svg>
                {isRegistering ? "Crear cuenta" : "Ingresar"}
              </>
            )}
          </button>
          
          {debugMsg && (
            <p style={{ textAlign: 'center', margin: 0, fontSize: '0.8rem', color: error ? '#f87171' : '#94a3b8' }}>
              {debugMsg}
            </p>
          )}
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '-0.2rem', marginBottom: '-0.5rem' }}>
          <button 
            type="button" 
            onClick={() => { setIsRegistering(!isRegistering); setError(false); }}
            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'underline' }}
          >
            {isRegistering ? "¿Ya tienes cuenta? Ingresa aquí" : "¿No tienes cuenta? Regístrate de cero"}
          </button>
        </div>

        <div className={styles.dividerBox}>
          <hr className={styles.dividerLine} />
          <span className={styles.dividerText}>o usa google</span>
          <hr className={styles.dividerLine} />
        </div>

        <button 
          type="button" 
          className={styles.googleBtn} 
          onClick={async () => {
            setLoading(true);
            try {
              await loginWithGoogle();
            } catch (e) {
              setLoading(false);
            }
          }}
          disabled={loading}
        >
          <svg className={styles.googleIcon} width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>

        {/* Footer */}
        <p className={styles.footer}>Entiendanla © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
