"use client";

import { useState } from 'react';
import styles from './page.module.css';
import StatsTable from '@/components/StatsTable';
import MatchBuilder from '@/components/MatchBuilder';
import PlayerManager from '@/components/PlayerManager';
import MatchHistory from '@/components/MatchHistory';
import TeamSimulator from '@/components/TeamSimulator';
import TournamentSelector from '@/components/TournamentSelector';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { AppProvider } from '@/context/AppContext';
import Login from '@/components/Login';

const NAV_ITEMS = [
  { id: 'STATS',      label: '📊 Estadísticas' },
  { id: 'HISTORY',   label: '🗂️ Historial' },
  { id: 'SIMULATOR', label: '⚽ Simulación' },
  { id: 'PLAYERS',   label: '👥 Jugadores' },
] as const;

type View = 'STATS' | 'NEW_MATCH' | 'PLAYERS' | 'HISTORY' | 'SIMULATOR';

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

function nameToHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function MainApp() {
  const [view, setView] = useState<View>('STATS');
  const { user, logout } = useAuth();
  const { activeTournament, clearActiveTournament, isAdminOfActiveTournament } = useTournament();

  const isAdmin = isAdminOfActiveTournament;
  const isSuperAdmin = user?.role === 'superadmin';
  const hue = user ? nameToHue(user.username) : 120;

  return (
    <AppProvider tournamentId={activeTournament?.id ?? null}>
      <div className={styles.pageRoot}>
        {/* ── Sticky header ── */}
        <header className={styles.header}>
          <div className={styles.headerInner}>

            {/* Brand + back to tournaments */}
            <div className={styles.brand}>
              <img
                src="/img/v987-24a.jpg"
                alt="Logo Entiendanla"
                className={styles.logoImage}
              />
              <span className={styles.title}>Entiendanla</span>
              <button
                className={styles.tournamentBackBtn}
                onClick={clearActiveTournament}
                title="Cambiar torneo"
              >
                <span className={styles.tournamentName}>{activeTournament?.name}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
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
            </nav>

            {/* Right section */}
            <div className={styles.userSection}>
              {/* Register match CTA (admin / superadmin) */}
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
                  {user ? getInitials(user.username) : '?'}
                </div>
                <span className={styles.username}>{user?.username}</span>
                {user?.role === 'admin' && <span className={styles.roleBadge}>admin</span>}
                {isSuperAdmin && <span className={styles.roleBadgeSuperadmin}>superadmin</span>}
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
          {view === 'SIMULATOR' && <TeamSimulator />}
          {view === 'NEW_MATCH' && isAdmin && <MatchBuilder onComplete={() => setView('STATS')} />}
          {view === 'PLAYERS'   && <PlayerManager />}
        </main>
      </div>
    </AppProvider>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { activeTournament } = useTournament();

  if (!user) return <Login />;

  // No tournament selected → show selector screen
  if (!activeTournament) return <TournamentSelector />;

  return <MainApp />;
}
