"use client";

import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { calculateStats } from '@/lib/stats';
import styles from './StatsTable.module.css';
import PlayerReportModal from './PlayerReportModal';

const PODIO_ICONS = ['🥇', '🥈', '🥉'];
const PODIO_CLASSES = ['podioGold', 'podioSilver', 'podioBronze'];


export default function StatsTable() {
  const { players, matches, badges } = useAppContext();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  type SortField = 'name' | 'badge' | 'matchesPlayed' | 'wins' | 'winPercentage' | 'bestStreak' | 'worstStreak' | 'currentStreak';
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const stats = useMemo(() => calculateStats(players, matches), [players, matches]);

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
      return 0;
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
        <h2>No hay jugadores registrados</h2>
        <p>Agrega jugadores en la pestaña &quot;Jugadores&quot; para comenzar.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.stickyHead}>
            <tr>
              {renderSortHeader('Jugador', 'name')}
              {renderSortHeader('Perfil', 'badge')}
              {renderSortHeader('PJ', 'matchesPlayed')}
              {renderSortHeader('G - E - P', 'wins')}
              {renderSortHeader('% Victoria', 'winPercentage')}
              {renderSortHeader('Mejor Racha', 'bestStreak')}
              {renderSortHeader('Peor Racha', 'worstStreak')}
              {renderSortHeader('Racha Actual', 'currentStreak')}
              <th className={styles.th} style={{ textAlign: 'center' }}>Estadísticas</th>
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

                  {/* Reporte individual */}
                  <td className={styles.td} style={{ textAlign: 'center' }}>
                    <button
                      className={styles.reportButton}
                      onClick={(e) => { e.stopPropagation(); setSelectedPlayerId(s.player.id); }}
                      title="Ver reporte detallado"
                    >
                      📊 Ver Reporte
                    </button>
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
    </div>
  );
}
