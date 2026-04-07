"use client";

import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getPlayerReport } from '@/lib/stats';
import styles from './PlayerReportModal.module.css';
import { RelationStats } from '@/types';

interface PlayerReportModalProps {
  playerId: string;
  onClose: () => void;
}

export default function PlayerReportModal({ playerId, onClose }: PlayerReportModalProps) {
  const { players, matches } = useAppContext();

  const report = useMemo(() => {
    try {
      return getPlayerReport(playerId, players, matches);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [playerId, players, matches]);

  if (!report) return null;

  const renderTable = (data: RelationStats[]) => (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Jugador</th>
            <th className={styles.th}>PJ</th>
            <th className={styles.th}>G - E - P</th>
            <th className={styles.th}>%</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.player.id}>
              <td className={styles.td}>
                <span className={styles.playerName}>{item.player.name}</span>
              </td>
              <td className={styles.td}>{item.total}</td>
              <td className={styles.td}>
                <div className={styles.stats}>
                  <span className={`${styles.statValue} ${styles.win}`}>{item.wins}</span>
                  <span className={styles.draw}>-</span>
                  <span className={`${styles.statValue} ${styles.draw}`}>{item.draws}</span>
                  <span className={styles.draw}>-</span>
                  <span className={`${styles.statValue} ${styles.loss}`}>{item.losses}</span>
                </div>
              </td>
              <td className={styles.td}>
                <span style={{ 
                  fontWeight: 'bold', 
                  color: item.winPercentage >= 50 ? 'var(--accent-primary)' : 'var(--danger)' 
                }}>
                  {item.winPercentage.toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Reporte: {report.player.name}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.sections}>
          <div className={styles.section}>
            <h3>Como Compañeros</h3>
            {report.teammates.length > 0 ? renderTable(report.teammates) : <p>Sin datos todavía.</p>}
          </div>

          <div className={styles.section}>
            <h3>Como Rivales</h3>
            {report.opponents.length > 0 ? renderTable(report.opponents) : <p>Sin datos todavía.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
