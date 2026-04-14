"use client";

import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { calculateStats } from '@/lib/stats';
import { PREDEFINED_BADGES } from '@/types';
import styles from './PlayerManager.module.css';

// Generate a consistent hue from a name string
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PlayerManager() {
  const { players, matches, addPlayer, removePlayer, updatePlayer, togglePlayerBadge } = useAppContext();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [managingBadgesForId, setManagingBadgesForId] = useState<string | null>(null);
  const managingBadgesFor = useMemo(() => players.find(p => p.id === managingBadgesForId) || null, [players, managingBadgesForId]);

  const stats = useMemo(() => calculateStats(players, matches), [players, matches]);
  const maxMatches = useMemo(() => Math.max(...stats.map(s => s.matchesPlayed), 1), [stats]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      addPlayer(name.trim());
      setName('');
    }
  };

  const handleStartEdit = (player: { id: string; name: string }) => {
    setEditingId(player.id);
    setEditName(player.name);
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (editName.trim()) {
      await updatePlayer(id, editName.trim());
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => { setEditingId(null); setEditName(''); };

  const handleDeleteClick = (id: string) => {
    const hasMatches = matches.some(m => m.teamA.includes(id) || m.teamB.includes(id));
    if (hasMatches) return; // button is disabled; nothing to do
    setConfirmDeleteId(id === confirmDeleteId ? null : id);
  };

  const handleConfirmDelete = (id: string) => {
    removePlayer(id);
    setConfirmDeleteId(null);
  };

  const handleToggleBadge = async (badgeId: string) => {
    if (!managingBadgesForId || !user) return;
    if (togglePlayerBadge) {
      await togglePlayerBadge(managingBadgesForId, badgeId, user.id);
    }
  };

  const handleCloseBadges = () => {
    setManagingBadgesForId(null);
  };

  // Sort: matches played desc, then alphabetical
  const sortedPlayers = [...players].sort((a, b) => {
    const cA = matches.filter(m => m.teamA.includes(a.id) || m.teamB.includes(a.id)).length;
    const cB = matches.filter(m => m.teamA.includes(b.id) || m.teamB.includes(b.id)).length;
    if (cB !== cA) return cB - cA;
    return a.name.localeCompare(b.name);
  });

  const filtered = sortedPlayers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const activePlayers = players.filter(p =>
    matches.some(m => m.teamA.includes(p.id) || m.teamB.includes(p.id))
  ).length;

  const getActivityLevel = (matchCount: number): 'high' | 'mid' | 'low' => {
    const ratio = matchCount / maxMatches;
    if (ratio >= 0.6) return 'high';
    if (ratio >= 0.25) return 'mid';
    return 'low';
  };

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.title}>Gestionar Jugadores</h2>
          <p className={styles.subtitle}>
            {players.length} jugadores · {activePlayers} activos
          </p>
        </div>
      </div>

      {/* ── Add form (Admin Only) ── */}
      {isAdmin && (
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
      )}

      {/* ── Search ── */}
      {players.length > 4 && (
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className={styles.searchInput}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
          )}
        </div>
      )}

      {/* ── Player grid ── */}
      <div className={styles.playerList}>
        {filtered.map((player, i) => {
          const playerStats = stats.find(s => s.player.id === player.id);
          const matchCount = playerStats?.matchesPlayed ?? 0;
          const winPct = playerStats?.winPercentage ?? 0;
          const hasMatches = matchCount > 0;
          const hue = nameToHue(player.name);
          const activity = getActivityLevel(matchCount);
          const isConfirming = confirmDeleteId === player.id;

          return (
            <div
              key={player.id}
              className={`${styles.playerCard} ${isConfirming ? styles.cardConfirm : ''}`}
              style={{ animationDelay: `${i * 0.035}s` }}
            >
              {editingId === player.id ? (
                /* ── Edit mode ── */
                <div className={styles.editWrapper}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={styles.editInput}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(player.id); if (e.key === 'Escape') handleCancelEdit(); }}
                  />
                  <div className={styles.editActions}>
                    <button onClick={() => handleSaveEdit(player.id)} className={styles.saveBtn} title="Guardar">✓</button>
                    <button onClick={handleCancelEdit} className={styles.cancelBtn} title="Cancelar">✕</button>
                  </div>
                </div>
              ) : isConfirming ? (
                /* ── Confirm delete mode ── */
                <div className={styles.confirmWrapper}>
                  <span className={styles.confirmText}>¿Eliminar a <strong>{player.name}</strong>?</span>
                  <div className={styles.confirmActions}>
                    <button onClick={() => handleConfirmDelete(player.id)} className={styles.confirmYes}>Sí, eliminar</button>
                    <button onClick={() => setConfirmDeleteId(null)} className={styles.confirmNo}>Cancelar</button>
                  </div>
                </div>
              ) : (
                /* ── Normal view ── */
                <>
                  {/* Avatar */}
                  <div
                    className={styles.avatar}
                    style={{ background: `hsl(${hue} 65% 30%)`, borderColor: `hsl(${hue} 65% 45%)` }}
                  >
                    <span style={{ color: `hsl(${hue} 80% 80%)` }}>{getInitials(player.name)}</span>
                  </div>

                  {/* Info */}
                  <div className={styles.cardInfo}>
                    <div className={styles.nameLine}>
                      <span className={styles.playerName}>{player.name}</span>
                      <span
                        className={styles.activityDot}
                        title={activity === 'high' ? 'Muy activo' : activity === 'mid' ? 'Activo' : 'Nuevo/Ocasional'}
                        style={{
                          background: activity === 'high' ? 'var(--accent-primary)'
                            : activity === 'mid' ? 'var(--warning)'
                            : 'var(--text-secondary)'
                        }}
                      />
                    </div>

                    {hasMatches ? (
                      <>
                        <div className={styles.cardMeta}>
                          <span>{matchCount} PJ</span>
                          <span>·</span>
                          <span style={{ color: winPct >= 50 ? 'var(--accent-primary)' : 'var(--danger)' }}>
                            {winPct.toFixed(0)}%
                          </span>
                          <span>·</span>
                          <span style={{ color: 'var(--accent-primary)' }}>{playerStats?.wins}V</span>
                          <span style={{ color: 'var(--danger)' }}>{playerStats?.losses}D</span>
                        </div>
                        <div className={styles.winBar}>
                          <div
                            className={styles.winBarFill}
                            style={{
                              width: `${winPct}%`,
                              background: winPct >= 60 ? 'var(--accent-primary)'
                                : winPct >= 40 ? 'var(--warning)'
                                : 'var(--danger)'
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <span className={styles.newBadge}>Nuevo jugador</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className={styles.cardActions}>
                    {isAdmin && (
                      <button onClick={() => handleStartEdit(player)} className={styles.editBtn} title="Editar nombre">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                    <button 
                      onClick={() => setManagingBadgesForId(player.id)} 
                      className={styles.badgeBtn} 
                      title="Votar insignias"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 15l-2 5l9-9l-9-9l2 5h-12v8h12z" />
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteClick(player.id)}
                        className={styles.deleteBtn}
                        disabled={hasMatches}
                        title={hasMatches ? 'No se puede eliminar: tiene partidos' : 'Eliminar jugador'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && players.length > 0 && (
          <p className={styles.emptySearch}>No se encontraron jugadores con &quot;{search}&quot;.</p>
        )}
        {players.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>No hay jugadores registrados.</p>
        )}
      </div>

      {/* ── Badges Modal ── */}
      {managingBadgesFor && (
        <div className={styles.badgesModalOverlay} onClick={handleCloseBadges}>
          <div className={styles.badgesModal} onClick={e => e.stopPropagation()}>
            <div className={styles.badgesHeader}>
              <div>
                <h3 className={styles.badgesTitle}>Votar Insignias</h3>
                <p className={styles.badgesSubtitle}>{managingBadgesFor.name}</p>
              </div>
              <button className={styles.badgesCloseBtn} onClick={handleCloseBadges}>
                ✕
              </button>
            </div>
            
            <div className={styles.badgesList}>
              {PREDEFINED_BADGES.map(badge => {
                const badgeVotes = managingBadgesFor.badges?.filter(b => b.badgeId === badge.id) || [];
                const voteCount = badgeVotes.length;
                const iVoted = badgeVotes.some(b => b.userId === user?.id);

                return (
                  <div 
                    key={badge.id}
                    className={`${styles.badgeItem} ${iVoted ? styles.badgeItemSelected : ''}`}
                    onClick={() => handleToggleBadge(badge.id)}
                  >
                    <span className={styles.badgeIcon}>{badge.icon}</span>
                    <div className={styles.badgeTextCol}>
                      <span className={styles.badgeName}>
                        {badge.label}
                        {voteCount > 0 && <span className={styles.voteBadge}>{voteCount}</span>}
                      </span>
                      <span className={styles.badgeDesc}>{badge.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
