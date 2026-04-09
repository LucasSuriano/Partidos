"use client";

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Player } from '@/types';
import styles from './MatchBuilder.module.css';
import DatePicker from './DatePicker';

export default function MatchBuilder({ onComplete }: { onComplete: () => void }) {
  const { players, addMatch } = useAppContext();

  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const availablePlayers = players.filter(
    p => !teamA.find(a => a.id === p.id) && !teamB.find(b => b.id === p.id)
  );

  const addToTeam = (team: 'A' | 'B', player: Player) => {
    if (team === 'A' && teamA.length < 5) setTeamA(prev => [...prev, player]);
    if (team === 'B' && teamB.length < 5) setTeamB(prev => [...prev, player]);
  };

  const removeFromTeam = (team: 'A' | 'B', playerId: string) => {
    if (team === 'A') setTeamA(prev => prev.filter(p => p.id !== playerId));
    if (team === 'B') setTeamB(prev => prev.filter(p => p.id !== playerId));
  };

  const handleSubmit = () => {
    if (teamA.length !== 5 || teamB.length !== 5 || !matchDate) return;

    // El Equipo Ganador (A) siempre gana. Convertir fecha local YYYY-MM-DD a ISO.
    const fullDate = new Date(`${matchDate}T12:00:00Z`).toISOString();

    addMatch(
      fullDate,
      teamA.map(p => p.id),
      teamB.map(p => p.id),
      'A_WIN'
    );
    onComplete();
  };

  const isComplete = teamA.length === 5 && teamB.length === 5;

  return (
    <div className={styles.container}>

      {/* Fecha arriba */}
      <div className={`${styles.unselectedBox} glass-panel`}>
        <div className={styles.datePickerContainer}>
          <label className={styles.dateLabel}>Fecha del Partido</label>
          <DatePicker value={matchDate} onChange={setMatchDate} />
        </div>
      </div>

      {/* Equipos */}
      <div className={styles.teamsLayout}>
        {/* Team A */}
        <div className={`${styles.teamBox} glass-panel`}>
          <h3 className={styles.teamTitle}>Equipo Ganador ({teamA.length}/5)</h3>
          <div className={styles.playerList}>
            {teamA.map(p => (
              <div key={p.id} className={`${styles.chip} ${styles.chipSelected}`}>
                {p.name}
                <button className={`${styles.chipAction} ${styles.chipActionRemove}`} onClick={() => removeFromTeam('A', p.id)}>-</button>
              </div>
            ))}
          </div>
          {teamA.length < 5 && availablePlayers.length > 0 && (
            <div className={styles.unselectedGrid}>
              {availablePlayers.map(p => (
                <button key={p.id} className={styles.chip} onClick={() => addToTeam('A', p)}>
                  {p.name} <span className={styles.chipAction}>+</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Team B */}
        <div className={`${styles.teamBox} glass-panel`}>
          <h3 className={styles.teamTitle} style={{ color: 'var(--danger)' }}>Equipo Perdedor ({teamB.length}/5)</h3>
          <div className={styles.playerList}>
            {teamB.map(p => (
              <div key={p.id} className={`${styles.chip} ${styles.chipSelected}`}>
                {p.name}
                <button className={`${styles.chipAction} ${styles.chipActionRemove}`} onClick={() => removeFromTeam('B', p.id)}>-</button>
              </div>
            ))}
          </div>
          {teamB.length < 5 && availablePlayers.length > 0 && (
            <div className={styles.unselectedGrid}>
              {availablePlayers.map(p => (
                <button key={p.id} className={styles.chip} onClick={() => addToTeam('B', p)}>
                  {p.name} <span className={styles.chipAction} style={{ background: 'var(--danger)' }}>+</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Botón guardar */}
      {isComplete ? (
        <button className={styles.submitBtn} onClick={handleSubmit}>
          Guardar Partido
        </button>
      ) : (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          Selecciona 5 jugadores por equipo para continuar.
        </p>
      )}

    </div>
  );
}
