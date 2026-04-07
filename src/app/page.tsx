"use client";

import { useState } from 'react';
import styles from './page.module.css';
import StatsTable from '@/components/StatsTable';
import MatchBuilder from '@/components/MatchBuilder';
import PlayerManager from '@/components/PlayerManager';
import MatchHistory from '@/components/MatchHistory';
import { useAuth } from '@/context/AuthContext';
import Login from '@/components/Login';

export default function Home() {
  const [view, setView] = useState<'STATS' | 'NEW_MATCH' | 'PLAYERS' | 'HISTORY'>('STATS');
  const { user, logout } = useAuth();

  if (!user) {
    return <Login />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className={styles.title}>Partidos 5v5</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Hola, <strong>{user.username}</strong> ({user.role})
            </span>
            <button onClick={logout} style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}>
              Salir
            </button>
          </div>
        </div>
        <div className={styles.actions}>
          <button 
            className={view === 'STATS' ? styles.btnPrimary : styles.btnSecondary} 
            onClick={() => setView('STATS')}
          >
            Estadísticas
          </button>
          {isAdmin && (
            <button 
              className={view === 'PLAYERS' ? styles.btnPrimary : styles.btnSecondary}
              onClick={() => setView('PLAYERS')}
            >
              Jugadores
            </button>
          )}
          <button 
            className={view === 'HISTORY' ? styles.btnPrimary : styles.btnSecondary}
            onClick={() => setView('HISTORY')}
          >
            Historial
          </button>
          {isAdmin && (
            <button 
              className={view === 'NEW_MATCH' ? styles.btnPrimary : styles.btnSecondary}
              onClick={() => setView('NEW_MATCH')}
            >
              + Registrar Partido
            </button>
          )}
        </div>
      </header>

      <main className={styles.mainGrid}>
        {view === 'STATS' && <StatsTable />}
        {view === 'HISTORY' && <MatchHistory />}
        {view === 'NEW_MATCH' && isAdmin && <MatchBuilder onComplete={() => setView('STATS')} />}
        {view === 'PLAYERS' && isAdmin && <PlayerManager />}
      </main>
    </div>
  );
}
