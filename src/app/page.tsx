"use client";

import { useState } from 'react';
import styles from './page.module.css';
import StatsTable from '@/components/StatsTable';
import MatchBuilder from '@/components/MatchBuilder';
import PlayerManager from '@/components/PlayerManager';
import MatchHistory from '@/components/MatchHistory';

export default function Home() {
  const [view, setView] = useState<'STATS' | 'NEW_MATCH' | 'PLAYERS' | 'HISTORY'>('STATS');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Partidos 5v5</h1>
        <div className={styles.actions}>
          <button 
            className={view === 'STATS' ? styles.btnPrimary : styles.btnSecondary} 
            onClick={() => setView('STATS')}
          >
            Estadísticas
          </button>
          <button 
            className={view === 'PLAYERS' ? styles.btnPrimary : styles.btnSecondary}
            onClick={() => setView('PLAYERS')}
          >
            Jugadores
          </button>
          <button 
            className={view === 'HISTORY' ? styles.btnPrimary : styles.btnSecondary}
            onClick={() => setView('HISTORY')}
          >
            Historial
          </button>
          <button 
            className={view === 'NEW_MATCH' ? styles.btnPrimary : styles.btnSecondary}
            onClick={() => setView('NEW_MATCH')}
          >
            + Registrar Partido
          </button>
        </div>
      </header>

      <main className={styles.mainGrid}>
        {view === 'STATS' && <StatsTable />}
        {view === 'HISTORY' && <MatchHistory />}
        {view === 'NEW_MATCH' && <MatchBuilder onComplete={() => setView('STATS')} />}
        {view === 'PLAYERS' && <PlayerManager />}
      </main>
    </div>
  );
}
