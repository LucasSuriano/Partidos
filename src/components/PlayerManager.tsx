"use client";

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import styles from './PlayerManager.module.css';

export default function PlayerManager() {
  const { players, matches, addPlayer, removePlayer, updatePlayer } = useAppContext();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      addPlayer(name.trim());
      setName('');
    }
  };

  const handleStartEdit = (player: any) => {
    setEditingId(player.id);
    setEditName(player.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (editName.trim()) {
      await updatePlayer(id, editName.trim());
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (id: string, playerName: string) => {
    const hasMatches = matches.some(m => m.teamA.includes(id) || m.teamB.includes(id));
    if (hasMatches) {
      alert(`No se puede eliminar a ${playerName} porque ya tiene partidos registrados.`);
      return;
    }
    if (confirm(`¿Estás seguro de que deseas eliminar a ${playerName}?`)) {
      removePlayer(id);
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
          placeholder="Nombre del nuevo jugador"
          className={styles.input}
        />
        <button type="submit" disabled={!name.trim()} className={styles.btn}>
          Agregar
        </button>
      </form>

      <div className={styles.playerList}>
        {players.map(player => (
          <div key={player.id} className={styles.playerCard}>
            {editingId === player.id ? (
              <div className={styles.editWrapper}>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={styles.editInput}
                  autoFocus
                />
                <div className={styles.editActions}>
                  <button onClick={() => handleSaveEdit(player.id)} className={styles.saveBtn} title="Guardar">
                    ✓
                  </button>
                  <button onClick={handleCancelEdit} className={styles.cancelBtn} title="Cancelar">
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span>{player.name}</span>
                <div className={styles.cardActions}>
                  <button onClick={() => handleStartEdit(player)} className={styles.editBtn} title="Editar">
                    ✎
                  </button>
                  <button 
                    onClick={() => handleDelete(player.id, player.name)} 
                    className={styles.deleteBtn} 
                    title={matches.some(m => m.teamA.includes(player.id) || m.teamB.includes(player.id)) 
                      ? "No se puede eliminar: tiene partidos registrados" 
                      : "Eliminar jugador"
                    }
                    style={{ 
                      opacity: matches.some(m => m.teamA.includes(player.id) || m.teamB.includes(player.id)) ? 0.2 : 0.5,
                      cursor: matches.some(m => m.teamA.includes(player.id) || m.teamB.includes(player.id)) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {players.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>No hay jugadores registrados.</p>
        )}
      </div>
    </div>
  );
}
