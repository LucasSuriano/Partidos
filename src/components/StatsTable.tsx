"use client";

import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { calculateStats } from '@/lib/stats';
import styles from './StatsTable.module.css';
import PlayerReportModal from './PlayerReportModal';

export default function StatsTable() {
  const { players, matches } = useAppContext();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const stats = useMemo(() => calculateStats(players, matches), [players, matches]);

  if (players.length === 0) {
    return (
      <div className={`${styles.container} glass-panel ${styles.emptyState}`}>
        <h2>No hay jugadores registrados</h2>
        <p>Agrega jugadores en la pestaña "Jugadores" para comenzar.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
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
            {stats.map((s, index) => (
              <tr key={s.player.id} className={styles.tr}>
                <td className={styles.td}>
                  <div className={styles.playerName}>
                    {index + 1}. {s.player.name}
                  </div>
                </td>
                <td className={styles.td}>{s.matchesPlayed}</td>
                <td className={styles.td}>
                  <span className={`${styles.statPill} ${styles.pillWin}`}>{s.wins}</span>
                  <span style={{ margin: '0 4px', color:'var(--text-secondary)' }}>-</span>
                  <span className={`${styles.statPill} ${styles.pillDraw}`}>{s.draws}</span>
                  <span style={{ margin: '0 4px', color:'var(--text-secondary)' }}>-</span>
                  <span className={`${styles.statPill} ${styles.pillLoss}`}>{s.losses}</span>
                </td>
                <td className={styles.td}>
                  <div style={{ fontWeight: 'bold', color: s.winPercentage >= 50 ? 'var(--accent-primary)' : 'var(--danger)' }}>
                    {s.winPercentage.toFixed(1)}%
                  </div>
                </td>
                <td className={styles.td}>
                  <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                    {s.bestStreak > 0 ? `${s.bestStreak} 🏆` : '-'}
                  </div>
                </td>
                <td className={styles.td}>
                  <div style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                    {s.worstStreak > 0 ? `${s.worstStreak} 💔` : '-'}
                  </div>
                </td>
                <td className={styles.td}>
                  {s.currentStreak.count > 0 && s.currentStreak.type !== 'DRAW' ? (
                    <div style={{ 
                      color: s.currentStreak.type === 'WIN' ? 'var(--accent-primary)' : 'var(--danger)', 
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}>
                      {s.currentStreak.count}
                      {s.currentStreak.type === 'WIN' && s.currentStreak.count >= 3 && <span>🔥</span>}
                      {s.currentStreak.type === 'LOSS' && s.currentStreak.count >= 3 && <span>🍬</span>}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)' }}>-</div>
                  )}
                </td>
                <td className={styles.td} style={{ textAlign: 'center' }}>
                  <button 
                    className={styles.reportButton} 
                    onClick={() => setSelectedPlayerId(s.player.id)}
                    title="Ver reporte detallado"
                  >
                    📊 Ver Reporte
                  </button>
                </td>
              </tr>
            ))}
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
