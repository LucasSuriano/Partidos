"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import type { PlayerStats } from '@/types';
import styles from './StatsTable.module.css';
import PlayerReportModal from './PlayerReportModal';
import { useTranslation } from 'react-i18next';

const PODIO_ICONS = ['🥇', '🥈', '🥉'];
const PODIO_CLASSES = ['podioGold', 'podioSilver', 'podioBronze'];


export default function StatsTable() {
  const { players, matches, badges, togglePlayerBadge, activeTournamentId } = useAppContext();
  const { user } = useAuth();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const { t } = useTranslation();

  const [managingBadgesForId, setManagingBadgesForId] = useState<string | null>(null);
  const managingBadgesFor = useMemo(() => players.find(p => p.id === managingBadgesForId) || null, [players, managingBadgesForId]);

  // ── Stats desde el servidor ────────────────────────────────────────────────
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);

  // Cache: evita refetch si el torneo y la cantidad de partidos no cambiaron
  const lastFetchKey = useRef<string>('');

  const fetchStats = useCallback(async (matchCount: number) => {
    if (!activeTournamentId) { setStats([]); return; }
    const key = `${activeTournamentId}:${matchCount}`;
    if (key === lastFetchKey.current) return;
    lastFetchKey.current = key;
    setStatsLoading(true);
    setStatsError(false);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : '';
      const res = await fetch(`${API_BASE}/api/stats?tournamentId=${activeTournamentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setStatsError(false);
      } else {
        console.error('Stats fetch failed:', res.status);
        lastFetchKey.current = ''; // permite reintentar
        setStatsError(true);
      }
    } catch (e) {
      console.error('Error fetching stats:', e);
      lastFetchKey.current = '';
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, [activeTournamentId]);

  const retryStats = useCallback(() => {
    lastFetchKey.current = '';
    setStatsError(false);
    fetchStats(matches.length);
  }, [fetchStats, matches.length]);

  // Un solo useEffect: se dispara cuando cambia el torneo o la cantidad de partidos
  useEffect(() => { fetchStats(matches.length); }, [fetchStats, matches.length]);
  // ──────────────────────────────────────────────────────────────────────────

  type SortField = 'name' | 'badge' | 'matchesPlayed' | 'wins' | 'winPercentage' | 'bestStreak' | 'worstStreak' | 'currentStreak';
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const enrichedStats = useMemo(() => {
    return stats.map((s, index) => {
      let badgeLabel = '';
      let badgeIcon = '';
      if (s.player.badges && s.player.badges.length > 0) {
        const badgeCounts: Record<string, number> = {};
        s.player.badges.forEach(b => {
          badgeCounts[b.badgeId] = (badgeCounts[b.badgeId] || 0) + 1;
        });
        const maxVotes = Math.max(...Object.values(badgeCounts));
        const winners = Object.keys(badgeCounts).filter(id => badgeCounts[id] === maxVotes);
        
        // Si hay empate, priorizar la primera insignia positiva
        let chosenId = winners[0];
        if (winners.length > 1) {
          const firstPositive = winners.find(id => {
            const def = badges.find(b => b.id === id);
            return def?.category === 'positiva';
          });
          if (firstPositive) chosenId = firstPositive;
        }

        const badgeDef = badges.find(b => b.id === chosenId);
        if (badgeDef) {
          badgeLabel = badgeDef.label;
          badgeIcon = badgeDef.icon;
        }
      }
      return {
        ...s,
        originalRank: index,
        badgeLabel,
        badgeIcon
      };
    });
  }, [stats]);

  const sortedStats = useMemo(() => {
    if (!sortField) return enrichedStats;

    return [...enrichedStats].sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      switch (sortField) {
        case 'name': valA = a.player.name.toLowerCase(); valB = b.player.name.toLowerCase(); break;
        case 'badge': valA = a.badgeLabel.toLowerCase(); valB = b.badgeLabel.toLowerCase(); break;
        case 'matchesPlayed': valA = a.matchesPlayed; valB = b.matchesPlayed; break;
        case 'wins': valA = a.wins; valB = b.wins; break;
        case 'winPercentage': valA = a.winPercentage; valB = b.winPercentage; break;
        case 'bestStreak': valA = a.bestStreak; valB = b.bestStreak; break;
        case 'worstStreak': valA = a.worstStreak; valB = b.worstStreak; break;
        case 'currentStreak':
          valA = a.currentStreak.type === 'WIN' ? a.currentStreak.count : a.currentStreak.type === 'LOSS' ? -a.currentStreak.count : 0;
          valB = b.currentStreak.type === 'WIN' ? b.currentStreak.count : b.currentStreak.type === 'LOSS' ? -b.currentStreak.count : 0;
          break;
        default: return 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      
      // Tie-breaker chain: Wins -> Draws -> WinRate -> Name
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.draws !== b.draws) return b.draws - a.draws;
      if (a.winPercentage !== b.winPercentage) return b.winPercentage - a.winPercentage;
      
      return a.player.name.localeCompare(b.player.name);
    });
  }, [enrichedStats, sortField, sortOrder]);

  const maxMatches = useMemo(() => Math.max(...stats.map(s => s.matchesPlayed), 1), [stats]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' || field === 'badge' ? 'asc' : 'desc');
    }
  };

  const handleToggleBadge = async (badgeId: string) => {
    if (!managingBadgesForId || !user) return;
    if (togglePlayerBadge) {
      await togglePlayerBadge(managingBadgesForId, badgeId, user.id);
    }
  };

  const handleCloseBadges = () => {
    setManagingBadgesForId(null);
  };

  const renderSortHeader = (label: string, field: SortField) => (
    <th className={styles.th} onClick={() => handleSort(field)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}
        <span style={{ fontSize: '0.8rem', opacity: sortField === field ? 1 : 0.3 }}>
          {sortField === field ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </div>
    </th>
  );

  if (players.length === 0) {
    return (
      <div className={`${styles.container} glass-panel ${styles.emptyState}`}>
        <h2>{t('statsTable.emptyState.title')}</h2>
        <p>{t('statsTable.emptyState.desc')}</p>
      </div>
    );
  }

  if (statsLoading && stats.length === 0) {
    return (
      <div className={`${styles.container} glass-panel ${styles.emptyState}`}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>⏳ Cargando estadísticas...</p>
      </div>
    );
  }

  if (statsError && stats.length === 0) {
    return (
      <div className={`${styles.container} glass-panel ${styles.emptyState}`}>
        <p style={{ fontSize: '2rem', margin: 0 }}>⚠️</p>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0.5rem 0 0.25rem' }}>
          No se pudieron cargar las estadísticas
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 1.25rem' }}>
          Verificá tu conexión e intentá de nuevo.
        </p>
        <button
          onClick={retryStats}
          style={{
            padding: '0.55rem 1.5rem',
            borderRadius: '10px',
            border: '1px solid rgba(99,102,241,0.4)',
            background: 'rgba(99,102,241,0.1)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
        >
          🔄 Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.stickyHead}>
            <tr>
              {renderSortHeader(t('statsTable.headers.player'), 'name')}
              {renderSortHeader(t('statsTable.headers.badge'), 'badge')}
              {renderSortHeader(t('statsTable.headers.played'), 'matchesPlayed')}
              {renderSortHeader(t('statsTable.headers.wld'), 'wins')}
              {renderSortHeader(t('statsTable.headers.winPct'), 'winPercentage')}
              {renderSortHeader(t('statsTable.headers.bestStreak'), 'bestStreak')}
              {renderSortHeader(t('statsTable.headers.worstStreak'), 'worstStreak')}
              {renderSortHeader(t('statsTable.headers.currentStreak'), 'currentStreak')}
              <th className={styles.th} style={{ textAlign: 'center' }}>{t('statsTable.headers.stats')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((s, index) => {
              const isPodio = s.originalRank < 3;
              const podioClass = isPodio ? styles[PODIO_CLASSES[s.originalRank] as keyof typeof styles] : '';
              const isEven = index % 2 === 1;

              return (
                <tr
                  key={s.player.id}
                  className={`${styles.tr} ${podioClass} ${isEven ? styles.trEven : ''}`}
                  style={{ animationDelay: `${index * 0.04}s` }}
                  onClick={() => setSelectedPlayerId(s.player.id)}
                >
                  {/* Jugador */}
                  <td className={styles.td}>
                    <div className={styles.playerName}>
                      <span className={styles.rankBadge}>
                        {isPodio ? PODIO_ICONS[s.originalRank] : `${s.originalRank + 1}.`}
                      </span>
                      {s.player.name}
                    </div>
                  </td>

                  {/* Perfil (Most voted badge) */}
                  <td className={styles.td}>
                    {s.badgeLabel ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title={`${s.badgeLabel}`}>
                        <span style={{ fontSize: '1.2rem' }}>{s.badgeIcon}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.badgeLabel}</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>-</span>
                    )}
                  </td>

                  {/* PJ con indicador de actividad */}
                  <td className={styles.td}>
                    <div className={styles.pjCell}>
                      <span className={styles.pjNumber}>{s.matchesPlayed}</span>
                      <span
                        className={styles.pjDot}
                        style={{
                          opacity: 0.3 + (s.matchesPlayed / maxMatches) * 0.7,
                          background: s.matchesPlayed / maxMatches > 0.7
                            ? 'var(--accent-primary)'
                            : s.matchesPlayed / maxMatches > 0.4
                              ? 'var(--warning)'
                              : 'var(--text-secondary)'
                        }}
                      />
                    </div>
                  </td>

                  {/* G - E - P */}
                  <td className={styles.td}>
                    <span className={`${styles.statPill} ${styles.pillWin}`}>{s.wins}</span>
                    <span style={{ margin: '0 4px', color: 'var(--text-secondary)' }}>-</span>
                    <span className={`${styles.statPill} ${styles.pillDraw}`}>{s.draws}</span>
                    <span style={{ margin: '0 4px', color: 'var(--text-secondary)' }}>-</span>
                    <span className={`${styles.statPill} ${styles.pillLoss}`}>{s.losses}</span>
                  </td>

                  {/* % Victoria con barra */}
                  <td className={styles.td}>
                    <div className={styles.winPctCell}>
                      <span className={styles.winPctText} style={{
                        color: s.winPercentage >= 60 ? 'var(--accent-primary)'
                          : s.winPercentage >= 50 ? '#86efac'
                            : s.winPercentage >= 35 ? 'var(--warning)'
                              : 'var(--danger)'
                      }}>
                        {s.winPercentage.toFixed(1)}%
                      </span>
                      <div className={styles.winPctTrack}>
                        <div
                          className={styles.winPctBar}
                          style={{
                            width: `${s.winPercentage}%`,
                            background: s.winPercentage >= 60 ? 'var(--accent-primary)'
                              : s.winPercentage >= 50 ? '#86efac'
                                : s.winPercentage >= 35 ? 'var(--warning)'
                                  : 'var(--danger)'
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Mejor Racha */}
                  <td className={styles.td}>
                    <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                      {s.bestStreak > 0 ? `${s.bestStreak} 🏆` : '-'}
                    </div>
                  </td>

                  {/* Peor Racha */}
                  <td className={styles.td}>
                    <div style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                      {s.worstStreak > 0 ? `${s.worstStreak} 💔` : '-'}
                    </div>
                  </td>

                  {/* Racha Actual */}
                  <td className={styles.td}>
                    {s.currentStreak.count > 0 && s.currentStreak.type !== 'DRAW' ? (
                      <span style={{
                        fontWeight: 'bold',
                        color: s.currentStreak.type === 'WIN' ? 'var(--accent-primary)' : 'var(--danger)'
                      }}>
                        {s.currentStreak.count}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>-</span>
                    )}
                  </td>

                  {/* Acciones (Reporte e Insignias) */}
                  <td className={styles.td} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        className={styles.reportButton}
                        onClick={(e) => { e.stopPropagation(); setSelectedPlayerId(s.player.id); }}
                        title="Ver reporte detallado"
                      >
                        {t('statsTable.viewReport')}
                      </button>
                      <button
                        className={styles.reportButton}
                        onClick={(e) => { e.stopPropagation(); setManagingBadgesForId(s.player.id); }}
                        title="Votar Insignias"
                        style={{ color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.08)' }}
                      >
                        🏅 Insignias
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedPlayerId && (
        <PlayerReportModal
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {/* ── Badges Modal ── */}
      {managingBadgesFor && (
        <div className={styles.badgesModalOverlay} onClick={handleCloseBadges}>
          <div className={styles.badgesModal} onClick={e => e.stopPropagation()}>
            <div className={styles.badgesHeader}>
              <div>
                <h3 className={styles.badgesTitle}>Insignias</h3>
                <p className={styles.badgesSubtitle}>{managingBadgesFor.name}</p>
              </div>
              <button className={styles.badgesCloseBtn} onClick={handleCloseBadges}>
                ✕
              </button>
            </div>

            <div className={styles.badgesList}>
              {badges.map(badge => {
                const badgeVotes = managingBadgesFor.badges?.filter(b => b.badgeId === badge.id) || [];
                const voteCount = badgeVotes.length;
                const iVoted = badgeVotes.some(b => b.userId === user?.id);

                return (
                  <div
                    key={badge.id}
                    className={`${styles.badgeItem} ${iVoted ? styles.badgeItemSelected : ''}`}
                    onClick={() => handleToggleBadge(badge.id)}
                  >
                    <span className={styles.badgeIcon}>{badge.icon}</span>
                    <div className={styles.badgeTextCol}>
                      <span className={styles.badgeName}>
                        {badge.label}
                        {voteCount > 0 && <span className={styles.voteBadge}>{voteCount}</span>}
                      </span>
                      <span className={styles.badgeDesc}>{badge.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
