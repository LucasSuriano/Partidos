"use client";

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Player } from '@/types';
import styles from './MatchBuilder.module.css';
import DatePicker from './DatePicker';

const TEAM_SIZE = 5;

interface TeamPanelProps {
  label: string;
  team: Player[];
  availablePlayers: Player[];
  variant: 'green' | 'red';
  onAdd: (player: Player) => void;
  onRemove: (playerId: string) => void;
}

function TeamPanel({ label, team, availablePlayers, variant, onAdd, onRemove }: TeamPanelProps) {
  const full = team.length === TEAM_SIZE;
  const progress = team.length / TEAM_SIZE;

  return (
    <div className={`${styles.teamBox} glass-panel ${full ? (variant === 'green' ? styles.teamBoxCompleteGreen : styles.teamBoxCompleteRed) : ''}`}>

      {/* Header */}
      <div className={styles.teamHeader}>
        <h3 className={`${styles.teamTitle} ${variant === 'red' ? styles.teamTitleRed : ''}`}>
          {full && <span className={styles.checkmark}>✓</span>}
          {label}
        </h3>
        <span className={`${styles.counter} ${full ? styles.counterFull : ''}`}>
          {team.length}/{TEAM_SIZE}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className={styles.progressTrack}>
        <div
          className={`${styles.progressBar} ${variant === 'red' ? styles.progressBarRed : ''}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Slots de jugadores seleccionados */}
      <div className={styles.slotList}>
        {Array.from({ length: TEAM_SIZE }).map((_, i) => {
          const player = team[i];
          return player ? (
            <div key={player.id} className={`${styles.slot} ${styles.slotFilled} ${variant === 'red' ? styles.slotFilledRed : ''}`}>
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
                className={`${styles.availableRow} ${variant === 'red' ? styles.availableRowRed : ''}`}
                onClick={() => onAdd(p)}
              >
                <span className={styles.availableName}>{p.name}</span>
                <span className={`${styles.addBtn} ${variant === 'red' ? styles.addBtnRed : ''}`}>+</span>
              </button>
            ))}
          </div>
        </>
      )}

      {full && (
        <div className={`${styles.completeMsg} ${variant === 'red' ? styles.completeMsgRed : ''}`}>
          ¡Equipo completo!
        </div>
      )}
    </div>
  );
}

export default function MatchBuilder({ onComplete }: { onComplete: () => void }) {
  const { players, addMatch } = useAppContext();

  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const availablePlayers = players.filter(
    p => !teamA.find(a => a.id === p.id) && !teamB.find(b => b.id === p.id)
  );

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
    addMatch(fullDate, teamA.map(p => p.id), teamB.map(p => p.id), 'A_WIN');
    onComplete();
  };

  const isComplete = teamA.length === TEAM_SIZE && teamB.length === TEAM_SIZE;

  return (
    <div className={styles.container}>

      {/* Fecha arriba */}
      <div className={`${styles.datePanelBox} glass-panel`}>
        <div className={styles.datePickerContainer}>
          <label className={styles.dateLabel}>Fecha del Partido</label>
          <DatePicker value={matchDate} onChange={setMatchDate} />
        </div>
      </div>

      {/* Equipos */}
      <div className={styles.teamsLayout}>
        <TeamPanel
          label="Equipo Ganador"
          team={teamA}
          availablePlayers={availablePlayers}
          variant="green"
          onAdd={(p) => addToTeam('A', p)}
          onRemove={(id) => removeFromTeam('A', id)}
        />
        <TeamPanel
          label="Equipo Perdedor"
          team={teamB}
          availablePlayers={availablePlayers}
          variant="red"
          onAdd={(p) => addToTeam('B', p)}
          onRemove={(id) => removeFromTeam('B', id)}
        />
      </div>

      {/* Botón guardar */}
      {isComplete ? (
        <button className={styles.submitBtn} onClick={handleSubmit}>
          Guardar Partido
        </button>
      ) : (
        <p className={styles.hint}>
          Selecciona {TEAM_SIZE} jugadores por equipo para continuar.
        </p>
      )}

    </div>
  );
}
