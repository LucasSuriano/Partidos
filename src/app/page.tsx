"use client";

import { useState } from 'react';
import styles from './page.module.css';
import StatsTable from '@/components/StatsTable';
import MatchBuilder from '@/components/MatchBuilder';
import PlayerManager from '@/components/PlayerManager';
import MatchHistory from '@/components/MatchHistory';
import { useAuth } from '@/context/AuthContext';
import Login from '@/components/Login';

const NAV_ITEMS = [
  { id: 'STATS',   label: '📊 Estadísticas' },
  { id: 'HISTORY', label: '🗂️ Historial' },
] as const;

type View = 'STATS' | 'NEW_MATCH' | 'PLAYERS' | 'HISTORY';

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

// Consistent hue from string
function nameToHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

export default function Home() {
  const [view, setView] = useState<View>('STATS');
  const { user, logout } = useAuth();

  if (!user) return <Login />;

  const isAdmin = user.role === 'admin';
  const hue = nameToHue(user.username);

  return (
    <div className={styles.pageRoot}>
      {/* ── Sticky header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>

          {/* Brand */}
          <div className={styles.brand}>
            <img
              src="/img/v987-24a.jpg"
              alt="Logo Entiendanla"
              className={styles.logoImage}
            />
            <span className={styles.title}>Entiendanla</span>
          </div>

          {/* Nav tabs */}
          <nav className={styles.nav}>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`${styles.navTab} ${view === item.id ? styles.navTabActive : ''}`}
                onClick={() => setView(item.id as View)}
              >
                {item.label}
              </button>
            ))}
            {isAdmin && (
              <button
                className={`${styles.navTab} ${view === 'PLAYERS' ? styles.navTabActive : ''}`}
                onClick={() => setView('PLAYERS')}
              >
                👥 Jugadores
              </button>
            )}
          </nav>

          {/* Right section */}
          <div className={styles.userSection}>
            {/* Register match CTA (admin only) */}
            {isAdmin && (
              <button
                className={`${styles.registerBtn} ${view === 'NEW_MATCH' ? styles.registerBtnActive : ''}`}
                onClick={() => setView('NEW_MATCH')}
              >
                <span>⚽</span>
                <span className={styles.registerLabel}>Registrar Partido</span>
              </button>
            )}

            {/* Avatar + role */}
            <div className={styles.avatarChip}>
              <div
                className={styles.avatar}
                style={{
                  background: `hsl(${hue} 50% 25%)`,
                  borderColor: `hsl(${hue} 65% 45%)`,
                  color: `hsl(${hue} 80% 80%)`
                }}
              >
                {getInitials(user.username)}
              </div>
              <span className={styles.username}>{user.username}</span>
              {isAdmin && <span className={styles.roleBadge}>admin</span>}
            </div>

            {/* Logout icon button */}
            <button onClick={logout} className={styles.logoutBtn} title="Cerrar sesión">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>

        </div>
      </header>

      {/* ── Main content ── */}
      <main className={styles.mainContent}>
        {view === 'STATS'     && <StatsTable />}
        {view === 'HISTORY'   && <MatchHistory />}
        {view === 'NEW_MATCH' && isAdmin && <MatchBuilder onComplete={() => setView('STATS')} />}
        {view === 'PLAYERS'   && isAdmin && <PlayerManager />}
      </main>
    </div>
  );
}
