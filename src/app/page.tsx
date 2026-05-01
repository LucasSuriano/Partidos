"use client";

import { useState } from 'react';
import styles from './page.module.css';
import StatsTable from '@/components/StatsTable';
import MatchBuilder from '@/components/MatchBuilder';
import PlayerManager from '@/components/PlayerManager';
import MatchHistory from '@/components/MatchHistory';
import TeamSimulator from '@/components/TeamSimulator';
import TournamentSelector from '@/components/TournamentSelector';
import TournamentUsers from '@/components/TournamentUsers';
import TournamentSettings from '@/components/TournamentSettings';
import UserMenu from '@/components/UserMenu';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { AppProvider } from '@/context/AppContext';
import { ToastProvider } from '@/context/ToastContext';
import Login from '@/components/Login';
import Brand from '@/components/Brand';
import { useTranslation } from 'react-i18next';

const BASE_NAV_ITEMS = [
  { id: 'STATS',      label: '📊 Estadísticas' },
  { id: 'HISTORY',   label: '🗂️ Historial' },
  { id: 'SIMULATOR', label: 'Simulación' },
  { id: 'PLAYERS',   label: '👥 Jugadores' },
] as const;

type BaseView = 'STATS' | 'NEW_MATCH' | 'PLAYERS' | 'HISTORY' | 'SIMULATOR';
type View = BaseView | 'USERS' | 'CONFIG';

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
  const { user } = useAuth();
  const { activeTournament, clearActiveTournament, isAdminOfActiveTournament } = useTournament();
  const { t } = useTranslation();

  const isAdmin = isAdminOfActiveTournament;
  const isSuperAdmin = user?.role === 'superadmin';
  const hue = user ? nameToHue(user.username) : 120;

  const tIcon = activeTournament?.type_icon || '⚽';

  const navItems = [
    { id: 'STATS',      label: t('nav.stats') },
    { id: 'HISTORY',    label: t('nav.history') },
    { id: 'SIMULATOR',  label: `${tIcon} ${t('nav.simulator')}` },
    { id: 'PLAYERS',    label: t('nav.players') },
    ...(isAdmin ? [{ id: 'CONFIG', label: t('nav.config') }, { id: 'USERS', label: t('nav.users') }] : []),
  ];

  return (
    <ToastProvider>
      <AppProvider tournamentId={activeTournament?.id ?? null} tournamentTypeId={activeTournament?.type_id ?? null}>
      <div className={styles.pageRoot}>
        {/* ── Sticky header ── */}
        <header className={styles.header}>
          <div className={styles.headerInner}>

            {/* Brand + back to tournaments */}
            <div className={styles.brandContainer}>
              <Brand />
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
              {navItems.map(item => (
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
                  <span>{tIcon}</span>
                  <span className={styles.registerLabel}>{t('action.registerMatch')}</span>
                </button>
              )}

              {/* User menu (avatar + dropdown) */}
              <UserMenu hue={hue} />
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
          {view === 'CONFIG'    && isAdmin && <TournamentSettings />}
          {view === 'USERS'     && isAdmin && <TournamentUsers />}
        </main>
      </div>
      </AppProvider>
    </ToastProvider>
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
