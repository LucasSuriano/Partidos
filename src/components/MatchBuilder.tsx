"use client";

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Player, MatchResult } from '@/types';
import styles from './MatchBuilder.module.css';
import DatePicker from './DatePicker';

const TEAM_SIZE = 5;

interface TeamPanelProps {
  label: string;
  team: Player[];
  availablePlayers: Player[];
  variant: 'green' | 'red' | 'draw';
  onAdd: (player: Player) => void;
  onRemove: (playerId: string) => void;
}

function TeamPanel({ label, team, availablePlayers, variant, onAdd, onRemove }: TeamPanelProps) {
  const full = team.length === TEAM_SIZE;
  const progress = team.length / TEAM_SIZE;
  const isDraw = variant === 'draw';
  const isRed = variant === 'red';

  return (
    <div className={`${styles.teamBox} glass-panel ${full ? (isDraw ? styles.teamBoxCompleteDraw : isRed ? styles.teamBoxCompleteRed : styles.teamBoxCompleteGreen) : ''}`}>

      {/* Header */}
      <div className={styles.teamHeader}>
        <h3 className={`${styles.teamTitle} ${isRed ? styles.teamTitleRed : ''} ${isDraw ? styles.teamTitleDraw : ''}`}>
          {full && <span className={styles.checkmark}>✓</span>}
          {label}
        </h3>
        <span className={`${styles.counter} ${full ? (isDraw ? styles.counterFullDraw : styles.counterFull) : ''}`}>
          {team.length}/{TEAM_SIZE}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className={styles.progressTrack}>
        <div
          className={`${styles.progressBar} ${isRed ? styles.progressBarRed : ''} ${isDraw ? styles.progressBarDraw : ''}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Slots de jugadores seleccionados */}
      <div className={styles.slotList}>
        {Array.from({ length: TEAM_SIZE }).map((_, i) => {
          const player = team[i];
          return player ? (
            <div key={player.id} className={`${styles.slot} ${styles.slotFilled} ${isRed ? styles.slotFilledRed : ''} ${isDraw ? styles.slotFilledDraw : ''}`}>
              <span className={styles.slotNumber}>{i + 1}</span>
              <span className={styles.slotName}>{player.name}</span>
              <button
                className={styles.removeBtn}
                onClick={() => onRemove(player.id)}
                title="Quitar jugador"
              >
                ✕
              </button>
            </div>
          ) : (
            <div key={`empty-${i}`} className={styles.slotEmpty}>
              <span className={styles.slotNumber}>{i + 1}</span>
              <span className={styles.slotPlaceholder}>Vacío</span>
            </div>
          );
        })}
      </div>

      {/* Separador y lista de disponibles */}
      {!full && availablePlayers.length > 0 && (
        <>
          <div className={styles.divider}>
            <span className={styles.dividerLabel}>Disponibles</span>
          </div>
          <div className={styles.availableList}>
            {availablePlayers.map(p => (
              <button
                key={p.id}
                className={`${styles.availableRow} ${isRed ? styles.availableRowRed : ''} ${isDraw ? styles.availableRowDraw : ''}`}
                onClick={() => onAdd(p)}
              >
                <span className={styles.availableName}>{p.name}</span>
                <span className={`${styles.addBtn} ${isRed ? styles.addBtnRed : ''} ${isDraw ? styles.addBtnDraw : ''}`}>+</span>
              </button>
            ))}
          </div>
        </>
      )}

      {full && (
        <div className={`${styles.completeMsg} ${isRed ? styles.completeMsgRed : ''} ${isDraw ? styles.completeMsgDraw : ''}`}>
          ¡Equipo completo!
        </div>
      )}
    </div>
  );
}

export default function MatchBuilder({ onComplete }: { onComplete: () => void }) {
  const { players, matches, addMatch } = useAppContext();

  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState<MatchResult>('A_WIN');

  const isDraw = result === 'DRAW';

  const availablePlayers = players
    .filter(p => !teamA.find(a => a.id === p.id) && !teamB.find(b => b.id === p.id))
    .sort((a, b) => {
      const attendanceA = matches.filter(m => m.teamA.includes(a.id) || m.teamB.includes(a.id)).length;
      const attendanceB = matches.filter(m => m.teamA.includes(b.id) || m.teamB.includes(b.id)).length;
      if (attendanceB !== attendanceA) return attendanceB - attendanceA;
      return a.name.localeCompare(b.name);
    });

  const addToTeam = (team: 'A' | 'B', player: Player) => {
    if (team === 'A' && teamA.length < TEAM_SIZE) setTeamA(prev => [...prev, player]);
    if (team === 'B' && teamB.length < TEAM_SIZE) setTeamB(prev => [...prev, player]);
  };

  const removeFromTeam = (team: 'A' | 'B', playerId: string) => {
    if (team === 'A') setTeamA(prev => prev.filter(p => p.id !== playerId));
    if (team === 'B') setTeamB(prev => prev.filter(p => p.id !== playerId));
  };

  const handleSubmit = () => {
    if (teamA.length !== TEAM_SIZE || teamB.length !== TEAM_SIZE || !matchDate) return;
    const fullDate = new Date(`${matchDate}T12:00:00Z`).toISOString();
    addMatch(fullDate, teamA.map(p => p.id), teamB.map(p => p.id), result);
    onComplete();
  };

  const isComplete = teamA.length === TEAM_SIZE && teamB.length === TEAM_SIZE;

  // Labels y variantes dinámicos según resultado
  const labelA = isDraw ? 'Equipo A' : result === 'A_WIN' ? 'Equipo Ganador' : 'Equipo Perdedor';
  const labelB = isDraw ? 'Equipo B' : result === 'B_WIN' ? 'Equipo Ganador' : 'Equipo Perdedor';
  const variantA: 'green' | 'red' | 'draw' = isDraw ? 'draw' : result === 'A_WIN' ? 'green' : 'red';
  const variantB: 'green' | 'red' | 'draw' = isDraw ? 'draw' : result === 'B_WIN' ? 'green' : 'red';

  return (
    <div className={styles.container}>

      {/* Fecha arriba */}
      <div className={`${styles.datePanelBox} glass-panel`}>
        <div className={styles.datePickerContainer}>
          <label className={styles.dateLabel}>Fecha del Partido</label>
          <DatePicker value={matchDate} onChange={setMatchDate} />
        </div>
      </div>

      {/* Selector de resultado — visible cuando ambos equipos están completos */}
      {isComplete && (
        <div className={`${styles.resultPicker} glass-panel`}>
          <span className={styles.resultPickerLabel}>¿Cómo terminó el partido?</span>
          <div className={styles.resultOptions}>
            <button
              className={`${styles.resultOption} ${result === 'A_WIN' ? styles.resultOptionActiveGreen : ''}`}
              onClick={() => setResult('A_WIN')}
            >
              <span className={styles.resultOptionIcon}>🟢</span>
              <span className={styles.resultOptionText}>Gana Equipo A</span>
            </button>
            <button
              className={`${styles.resultOption} ${result === 'DRAW' ? styles.resultOptionActiveDraw : ''}`}
              onClick={() => setResult('DRAW')}
            >
              <span className={styles.resultOptionIcon}>🤝</span>
              <span className={styles.resultOptionText}>Empate</span>
            </button>
            <button
              className={`${styles.resultOption} ${result === 'B_WIN' ? styles.resultOptionActiveRed : ''}`}
              onClick={() => setResult('B_WIN')}
            >
              <span className={styles.resultOptionIcon}>🔴</span>
              <span className={styles.resultOptionText}>Gana Equipo B</span>
            </button>
          </div>
        </div>
      )}

      {/* Equipos */}
      <div className={styles.teamsLayout}>
        <TeamPanel
          label={labelA}
          team={teamA}
          availablePlayers={availablePlayers}
          variant={variantA}
          onAdd={(p) => addToTeam('A', p)}
          onRemove={(id) => removeFromTeam('A', id)}
        />
        <TeamPanel
          label={labelB}
          team={teamB}
          availablePlayers={availablePlayers}
          variant={variantB}
          onAdd={(p) => addToTeam('B', p)}
          onRemove={(id) => removeFromTeam('B', id)}
        />
      </div>

      {/* Botón guardar */}
      {isComplete ? (
        <button
          className={`${styles.submitBtn} ${isDraw ? styles.submitBtnDraw : ''}`}
          onClick={handleSubmit}
        >
          {isDraw ? '🤝 Guardar Empate' : '⚽ Guardar Partido'}
        </button>
      ) : (
        <p className={styles.hint}>
          Selecciona {TEAM_SIZE} jugadores por equipo para continuar.
        </p>
      )}

    </div>
  );
}
