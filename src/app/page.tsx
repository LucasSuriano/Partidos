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
        <div className={styles.headerTop}>
          <div className={styles.titleContainer}>
            <img 
              src="/img/v987-24a.jpg" 
              alt="Logo Entiendanla" 
              className={styles.logoImage} 
            />
            <h1 className={styles.title}>Entiendanla</h1>
          </div>
          <div className={styles.userSection}>
            <span className={styles.userInfo}>
              Hola, <strong>{user.username}</strong> ({user.role})
            </span>
            <button onClick={logout} className={styles.logoutBtn}>
              Salir
            </button>
          </div>
        </div>
        <div className={styles.actions}>
          <button 
            className={view === 'STATS' ? styles.btnSecondaryActive : styles.btnSecondary} 
            onClick={() => setView('STATS')}
          >
            Estadísticas
          </button>
          {isAdmin && (
            <button 
              className={view === 'PLAYERS' ? styles.btnSecondaryActive : styles.btnSecondary}
              onClick={() => setView('PLAYERS')}
            >
              Jugadores
            </button>
          )}
          <button 
            className={view === 'HISTORY' ? styles.btnSecondaryActive : styles.btnSecondary}
            onClick={() => setView('HISTORY')}
          >
            Historial
          </button>
          {isAdmin && (
            <button 
              className={view === 'NEW_MATCH' ? styles.btnSpecialActive : styles.btnSpecial}
              onClick={() => setView('NEW_MATCH')}
            >
              Registrar Partido
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
