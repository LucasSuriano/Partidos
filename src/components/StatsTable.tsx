"use client";

import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { calculateStats } from '@/lib/stats';
import styles from './StatsTable.module.css';
import PlayerReportModal from './PlayerReportModal';

const PODIO_ICONS = ['🥇', '🥈', '🥉'];
const PODIO_CLASSES = ['podioGold', 'podioSilver', 'podioBronze'];


export default function StatsTable() {
  const { players, matches } = useAppContext();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const stats = useMemo(() => calculateStats(players, matches), [players, matches]);
  const maxMatches = useMemo(() => Math.max(...stats.map(s => s.matchesPlayed), 1), [stats]);

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
              <th className={styles.th}>Jugador</th>
              <th className={styles.th}>PJ</th>
              <th className={styles.th}>G - E - P</th>
              <th className={styles.th}>% Victoria</th>
              <th className={styles.th}>Mejor Racha</th>
              <th className={styles.th}>Peor Racha</th>
              <th className={styles.th}>Racha Actual</th>
              <th className={styles.th} style={{ textAlign: 'center' }}>Estadísticas Individuales</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, index) => {
              const isPodio = index < 3;
              const podioClass = isPodio ? styles[PODIO_CLASSES[index] as keyof typeof styles] : '';
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
                        {isPodio ? PODIO_ICONS[index] : `${index + 1}.`}
                      </span>
                      {s.player.name}
                    </div>
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
