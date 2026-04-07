"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (!success) {
      setError(true);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.loginBox} glass-panel`}>
        <div className={styles.header}>
          <h1 className={styles.title}>Partidos 5v5</h1>
          <p className={styles.subtitle}>Inicia sesión para registrar estadísticas</p>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.formContainer}>
          {error && <div className={styles.errorBanner}>Usuario o contraseña incorrectos.</div>}
          <div className={styles.inputGroup}>
            <label>Usuario</label>
            <input 
              type="text" 
              placeholder="Ingresa tu usuario"
              value={username} 
              onChange={e => {setUsername(e.target.value); setError(false);}}
              className={styles.inputField} 
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={e => {setPassword(e.target.value); setError(false);}}
              className={styles.inputField} 
            />
          </div>
          <button type="submit" disabled={loading} className={styles.loginBtn}>
            {loading ? 'Cargando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
