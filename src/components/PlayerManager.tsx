"use client";

import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { Player } from '@/types';
import styles from './PlayerManager.module.css';
import { useTranslation } from 'react-i18next';

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

function TierBadge({ tier, style }: { tier: string, style?: React.CSSProperties }) {
  let tierClass = '';
  let icon = '';
  switch (tier) {
    case 'S': tierClass = styles.tierS; icon = '⭐'; break;
    case 'A': tierClass = styles.tierA; icon = '⚡'; break;
    case 'B': tierClass = styles.tierB; icon = '🛡️'; break;
    case 'C': tierClass = styles.tierC; icon = '⚔️'; break;
    case 'D': tierClass = styles.tierD; icon = '🔧'; break;
    default: tierClass = ''; icon = ''; break;
  }
  return (
    <span className={`${styles.tierBadge} ${tierClass}`} style={style}>
      {icon && <span>{icon}</span>}
      {tier}
    </span>
  );
}

export default function PlayerManager() {
  const { players, matches, badges, addPlayer, removePlayer, updatePlayer, togglePlayerBadge } = useAppContext();
  const { user } = useAuth();
  const { isAdminOfActiveTournament } = useTournament();
  const isAdmin = isAdminOfActiveTournament;
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTier, setEditTier] = useState<string>('');
  const [editPosition, setEditPosition] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [managingBadgesForId, setManagingBadgesForId] = useState<string | null>(null);
  const managingBadgesFor = useMemo(() => players.find(p => p.id === managingBadgesForId) || null, [players, managingBadgesForId]);

  // Cálculo liviano: solo lo que necesita este componente (matchesPlayed, wins, losses, %)
  // Evita correr el motor de stats completo (Elo, rachas, relaciones) solo para mostrar las tarjetas
  const playerStatsMap = useMemo(() => {
    const map = new Map<string, { matchesPlayed: number; wins: number; losses: number; winPercentage: number }>();
    players.forEach(p => {
      const pm = matches.filter(m => m.teamA.includes(p.id) || m.teamB.includes(p.id));
      const wins = pm.filter(m =>
        (m.result === 'A_WIN' && m.teamA.includes(p.id)) ||
        (m.result === 'B_WIN' && m.teamB.includes(p.id))
      ).length;
      const losses = pm.filter(m =>
        (m.result === 'B_WIN' && m.teamA.includes(p.id)) ||
        (m.result === 'A_WIN' && m.teamB.includes(p.id))
      ).length;
      const mp = pm.length;
      map.set(p.id, { matchesPlayed: mp, wins, losses, winPercentage: mp > 0 ? (wins / mp) * 100 : 0 });
    });
    return map;
  }, [players, matches]);

  const maxMatches = useMemo(() => Math.max(...Array.from(playerStatsMap.values()).map(s => s.matchesPlayed), 1), [playerStatsMap]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await addPlayer(name.trim());
    setName('');
    setIsSubmitting(false);
  };

  const handleStartEdit = (player: Player) => {
    setEditingId(player.id);
    setEditName(player.name);
    setEditTier(player.tier || '');
    setEditPosition(player.position || '');
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await updatePlayer(id, { name: editName.trim(), tier: editTier || null, position: editPosition || null });
    setIsSubmitting(false);
    setEditingId(null);
  };

  const handleCancelEdit = () => { setEditingId(null); setEditName(''); setEditTier(''); setEditPosition(''); };

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

  const filtered = sortedPlayers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesPosition = filterPosition ? p.position === filterPosition : true;
    const matchesTier = filterTier ? p.tier === filterTier : true;
    return matchesSearch && matchesPosition && matchesTier;
  });

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
          <h2 className={styles.title}>{t('playerManager.title')}</h2>
          <p className={styles.subtitle}>
            {t('playerManager.subtitle', { total: players.length, active: activePlayers })}
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
            placeholder={t('playerManager.namePlaceholder')}
            className={styles.input}
          />
          <button type="submit" disabled={!name.trim() || isSubmitting} className={styles.btn}>
            {isSubmitting ? 'Agregando...' : t('playerManager.add')}
          </button>
        </form>
      )}

      {/* ── Search & Filters ── */}
      {(players.length > 4 || filterPosition || filterTier) && (
        <div className={styles.filtersContainer}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('playerManager.searchPlaceholder')}
              className={styles.searchInput}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
            )}
          </div>
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Todas las pos.</option>
            <option value="Arquero">Arquero</option>
            <option value="Defensa">Defensa</option>
            <option value="Mediocampista">Mediocampista</option>
            <option value="Delantero">Delantero</option>
          </select>
          {isAdmin && (
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">Todos los tiers</option>
              <option value="S">Tier S</option>
              <option value="A">Tier A</option>
              <option value="B">Tier B</option>
              <option value="C">Tier C</option>
              <option value="D">Tier D</option>
            </select>
          )}
        </div>
      )}

      {/* ── Player grid ── */}
      <div className={styles.playerList}>
        {filtered.map((player, i) => {
          const playerStats = playerStatsMap.get(player.id);
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
                <div className={styles.editWrapper} style={{flexDirection: 'column', gap: '8px', alignItems: 'flex-start'}}>
                  <div style={{display: 'flex', gap: '8px', width: '100%'}}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={styles.editInput}
                      style={{flex: 1}}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(player.id); if (e.key === 'Escape') handleCancelEdit(); }}
                    />
                    <div className={styles.editActions}>
                      <button onClick={() => handleSaveEdit(player.id)} className={styles.saveBtn} disabled={isSubmitting} title={t('playerManager.save')}>✓</button>
                      <button onClick={handleCancelEdit} className={styles.cancelBtn} title={t('playerManager.cancel')}>✕</button>
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{display: 'flex', gap: '8px', width: '100%'}}>
                      <select value={editPosition} onChange={(e) => setEditPosition(e.target.value)} className={styles.editInput} style={{flex: 1, padding: '4px'}}>
                        <option value="">Sin Posición</option>
                        <option value="Arquero">Arquero</option>
                        <option value="Defensor">Defensor</option>
                        <option value="Mediocampista">Mediocampista</option>
                        <option value="Delantero">Delantero</option>
                      </select>
                      <select value={editTier} onChange={(e) => setEditTier(e.target.value)} className={styles.editInput} style={{flex: 1, padding: '4px'}}>
                        <option value="">Sin Tier</option>
                        <option value="S">Tier S</option>
                        <option value="A">Tier A</option>
                        <option value="B">Tier B</option>
                        <option value="C">Tier C</option>
                        <option value="D">Tier D</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : isConfirming ? (
                /* ── Confirm delete mode ── */
                <div className={styles.confirmWrapper}>
                  <span className={styles.confirmText}>{t('playerManager.delete.warning', { name: player.name })}</span>
                  <div className={styles.confirmActions}>
                    <button onClick={() => handleConfirmDelete(player.id)} className={styles.confirmYes}>{t('playerManager.delete.confirm')}</button>
                    <button onClick={() => setConfirmDeleteId(null)} className={styles.confirmNo}>{t('playerManager.cancel')}</button>
                  </div>
                </div>
              ) : (
                /* ── Normal view ── */
                <>
                  {isAdmin && player.tier && (
                    <div style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      zIndex: 10
                    }}>
                      <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left' }}>
                        <TierBadge tier={player.tier} style={{ borderRadius: '16px 0 10px 0', borderTop: 'none', borderLeft: 'none' }} />
                      </div>
                    </div>
                  )}
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
                        title={activity === 'high' ? t('playerManager.activity.high') : activity === 'mid' ? t('playerManager.activity.mid') : t('playerManager.activity.low')}
                        style={{
                          background: activity === 'high' ? 'var(--accent-primary)'
                            : activity === 'mid' ? 'var(--warning)'
                              : 'var(--text-secondary)'
                        }}
                      />
                    </div>
                    {player.position && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: '#94a3b8' }}>
                          {player.position}
                        </span>
                      </div>
                    )}

                    {hasMatches ? (
                      <>
                        <div className={styles.cardMeta}>
                          <span>{matchCount} PJ</span>
                          <span>·</span>
                          <span style={{ color: winPct >= 50 ? 'var(--accent-primary)' : 'var(--danger)' }}>
                            {winPct.toFixed(0)}%
                          </span>
                          <span>·</span>
                          <span style={{ color: 'var(--accent-primary)' }}>{(playerStats?.wins ?? 0)}V</span>
                          <span style={{ color: 'var(--danger)' }}>{(playerStats?.losses ?? 0)}D</span>
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
                      <span className={styles.newBadge}>{t('playerManager.newPlayer')}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className={styles.cardActions}>
                    {isAdmin && (
                      <button onClick={() => handleStartEdit(player)} className={styles.editBtn} title={t('playerManager.editName')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => setManagingBadgesForId(player.id)}
                      className={styles.badgeBtn}
                      title={t('playerManager.voteBadges')}
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
                        title={hasMatches ? t('playerManager.cantDelete') : t('playerManager.deleteTitle')}
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
          <p className={styles.emptySearch}>{t('playerManager.emptySearch').replace('{{search}}', search)}</p>
        )}
        {players.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>{t('playerManager.emptyState')}</p>
        )}
      </div>

      {/* ── Badges Modal ── */}
      {managingBadgesFor && (
        <div className={styles.badgesModalOverlay} onClick={handleCloseBadges}>
          <div className={styles.badgesModal} onClick={e => e.stopPropagation()}>
            <div className={styles.badgesHeader}>
              <div>
                <h3 className={styles.badgesTitle}>{t('playerManager.badges.title')}</h3>
                <p className={styles.badgesSubtitle}>{managingBadgesFor.name}</p>
              </div>
              <button className={styles.badgesCloseBtn} onClick={handleCloseBadges}>
                ✕
              </button>
            </div>

            <div className={styles.badgesList}>
              {badges.map(badge => {
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
