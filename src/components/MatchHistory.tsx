"use client";

import { useAppContext } from '@/context/AppContext';
import { Match } from '@/types';
import styles from './MatchHistory.module.css';

export default function MatchHistory() {
  const { matches, players, removeMatch } = useAppContext();

  const getPlayerNames = (ids: string[]) => {
    return ids.map(id => {
      const p = players.find(player => player.id === id);
      return p ? p.name : 'Desconocido';
    }).join(', ');
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const sortedMatches = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (matches.length === 0) {
    return (
      <div className={`${styles.container} glass-panel ${styles.emptyState}`}>
        <h2>No se han jugado partidos aún</h2>
        <p>Registra un partido para que aparezca aquí el historial.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {sortedMatches.map(match => (
        <div key={match.id} className={styles.matchCard}>
          <div style={{ flex: 1 }}>
            <div className={styles.date}>{formatDate(match.date)}</div>
            <div className={styles.teamsLayout}>

              <div className={styles.team}>
                <div className={styles.teamName}>
                  Equipo Verde
                  {match.result === 'A_WIN' && <span className={`${styles.outcome} ${styles.outcomeWin}`}>Ganador</span>}
                  {match.result === 'DRAW' && <span className={`${styles.outcome} ${styles.outcomeDraw}`}>Empate</span>}
                </div>
                <div className={styles.playerNames}>{getPlayerNames(match.teamA)}</div>
              </div>

              <div className={styles.vs}>VS</div>

              <div className={styles.team} style={{ textAlign: 'right' }}>
                <div className={styles.teamName} style={{ color: 'var(--danger)' }}>
                  {match.result === 'DRAW' && <span className={`${styles.outcome} ${styles.outcomeDraw}`}>Empate</span>}
                  {match.result === 'B_WIN' && <span className={`${styles.outcome} ${styles.outcomeWin}`}>Ganador</span>}
                  Equipo Rojo
                </div>
                <div className={styles.playerNames}>{getPlayerNames(match.teamB)}</div>
              </div>

            </div>
          </div>

          <button
            className={styles.deleteBtn}
            onClick={() => confirm('¿Estás seguro de eliminar este partido? Se recalcularán las estadísticas.') && removeMatch(match.id)}
            title="Eliminar partido"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
