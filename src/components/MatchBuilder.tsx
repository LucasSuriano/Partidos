"use client";

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Player, MatchResult } from '@/types';
import styles from './MatchBuilder.module.css';

export default function MatchBuilder({ onComplete }: { onComplete: () => void }) {
  const { players, addMatch } = useAppContext();

  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
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
    if (teamA.length !== 5 || teamB.length !== 5 || !result || !matchDate) return;

    // Convert current local date from input "YYYY-MM-DD" to full ISO string to keep sortability format
    const fullDate = new Date(`${matchDate}T12:00:00Z`).toISOString();

    addMatch(
      fullDate,
      teamA.map(p => p.id),
      teamB.map(p => p.id),
      result
    );
    onComplete();
  };

  const isComplete = teamA.length === 5 && teamB.length === 5;

  return (
    <div className={styles.container}>
      <div className={styles.teamsLayout}>
        {/* Team A */}
        <div className={`${styles.teamBox} glass-panel`}>
          <h3 className={styles.teamTitle}>Equipo Verde ({teamA.length}/5)</h3>
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
          <h3 className={styles.teamTitle} style={{ color: 'var(--danger)' }}>Equipo Rojo ({teamB.length}/5)</h3>
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

      {isComplete ? (
        <div className={`${styles.unselectedBox} glass-panel`}>
          <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Resultado del Partido</h3>
          <div className={styles.controls}>
            <button
              className={`${styles.resultBtn} ${styles.btnA} ${result === 'A_WIN' ? styles.active : ''}`}
              onClick={() => setResult('A_WIN')}
            >
              Ganó equipo verde
            </button>
            <button
              className={`${styles.resultBtn} ${styles.btnDraw} ${result === 'DRAW' ? styles.active : ''}`}
              onClick={() => setResult('DRAW')}
            >
              Empate
            </button>
            <button
              className={`${styles.resultBtn} ${styles.btnB} ${result === 'B_WIN' ? styles.active : ''}`}
              onClick={() => setResult('B_WIN')}
            >
              Ganó equipo rojo
            </button>
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Fecha del Partido</label>
            <input
              type="date"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--panel-border)',
                padding: '0.75rem',
                borderRadius: '8px',
                color: 'white',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <button
            className={styles.submitBtn}
            disabled={!result}
            onClick={handleSubmit}
          >
            Guardar Partido
          </button>
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Selecciona 5 jugadores por equipo para continuar.</p>
      )}

    </div>
  );
}
