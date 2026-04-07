"use client";

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import styles from './PlayerManager.module.css';

export default function PlayerManager() {
  const { players, addPlayer, removePlayer } = useAppContext();
  const [name, setName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      addPlayer(name.trim());
      setName('');
    }
  };

  return (
    <div className={styles.container}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Gestionar Jugadores</h2>
      
      <form onSubmit={handleAdd} className={`${styles.addForm} glass-panel`}>
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del jugador"
          className={styles.input}
        />
        <button type="submit" disabled={!name.trim()} className={styles.btn}>
          Agregar
        </button>
      </form>

      <div className={styles.playerList}>
        {players.map(player => (
          <div key={player.id} className={styles.playerCard}>
            <span>{player.name}</span>
            <button onClick={() => removePlayer(player.id)} className={styles.deleteBtn} title="Eliminar">
              ✕
            </button>
          </div>
        ))}
        {players.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>No hay jugadores registrados.</p>
        )}
      </div>
    </div>
  );
}
