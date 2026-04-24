"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { Match, MatchResult } from '@/types';
import styles from './MatchHistory.module.css';
import DatePicker from './DatePicker';
import CustomSelect from './CustomSelect';
import { useTranslation } from 'react-i18next';

export default function MatchHistory() {
  const { matches, players, removeMatch, updateMatchResult } = useAppContext();
  const { user } = useAuth();
  const { activeTournament, isAdminOfActiveTournament } = useTournament();
  const { t, i18n } = useTranslation();
  const isAdmin = isAdminOfActiveTournament;
  const tIcon = activeTournament?.type_icon || '⚽';

  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<MatchResult>('A_WIN');
  const [editScoreA, setEditScoreA] = useState<string>('');
  const [editScoreB, setEditScoreB] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editVideoUrl, setEditVideoUrl] = useState<string>('');
  const [editMvpId, setEditMvpId] = useState<string>('');

  const handleEditClick = (match: Match) => {
    setEditingMatchId(match.id);
    setEditResult(match.result);
    setEditScoreA(match.scoreA != null ? match.scoreA.toString() : '');
    setEditScoreB(match.scoreB != null ? match.scoreB.toString() : '');
    setEditDate(match.date.split('T')[0]);
    setEditVideoUrl(match.metadata?.video_url || '');
    setEditMvpId(match.metadata?.mvp_id || '');
  };

  const handleSaveEdit = async () => {
    if (!editingMatchId) return;
    let parsedA: number | undefined = parseInt(editScoreA, 10);
    let parsedB: number | undefined = parseInt(editScoreB, 10);
    if (isNaN(parsedA)) parsedA = undefined;
    if (isNaN(parsedB)) parsedB = undefined;
    
    // Si se editó la fecha, asegurarnos de enviarla en formato ISO
    let isoDate = undefined;
    if (editDate) {
      isoDate = new Date(`${editDate}T12:00:00Z`).toISOString();
    }

    const currentMatch = matches.find(m => m.id === editingMatchId);
    const newMetadata = {
      ...currentMatch?.metadata,
      video_url: editVideoUrl || null,
      mvp_id: editMvpId || null
    };

    await updateMatchResult(editingMatchId, editResult, parsedA, parsedB, isoDate, newMetadata);
    setEditingMatchId(null);
  };

  // Link scores with result selection (Edit Mode)
  useEffect(() => {
    const isPadel = activeTournament?.type_slug === 'paddle';
    if (isPadel || !editingMatchId) return;

    const valA = parseInt(editScoreA, 10);
    const valB = parseInt(editScoreB, 10);

    if (!isNaN(valA) && !isNaN(valB)) {
      if (valA > valB) setEditResult('A_WIN');
      else if (valB > valA) setEditResult('B_WIN');
      else setEditResult('DRAW');
    }
  }, [editScoreA, editScoreB, activeTournament, editingMatchId]);

  const getPlayers = (ids: string[]) =>
    ids.map(id => players.find(p => p.id === id)?.name ?? t('matchHistory.unknown'));

  const formatDateLabel = (isoString: string) => {
    const d = new Date(isoString);
    const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const formatted = formatter.format(d);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const getMonthKey = (isoString: string) => {
    const d = new Date(isoString);
    const formatter = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const formatted = formatter.format(d);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const sortedMatches = [...matches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Agrupar por mes
  const groupedMatches: { monthLabel: string; entries: typeof sortedMatches }[] = [];
  sortedMatches.forEach(match => {
    const label = getMonthKey(match.date);
    const last = groupedMatches[groupedMatches.length - 1];
    if (last && last.monthLabel === label) {
      last.entries.push(match);
    } else {
      groupedMatches.push({ monthLabel: label, entries: [match] });
    }
  });

  // Número correlativo total (más reciente = mayor número)
  const totalMatches = sortedMatches.length;

  if (matches.length === 0) {
    return (
      <div className={`${styles.container} glass-panel ${styles.emptyState}`}>
        <span className={styles.emptyIcon}>{tIcon}</span>
        <h2>{t('matchHistory.emptyState.title')}</h2>
        <p>{t('matchHistory.emptyState.desc')}</p>
      </div>
    );
  }

  let matchCounter = totalMatches;

  return (
    <div className={styles.container}>
      {groupedMatches.map(({ monthLabel, entries }) => (
        <div key={monthLabel} className={styles.monthGroup}>
          {/* ── Separador de mes ── */}
          <div className={styles.monthDivider}>
            <span className={styles.monthDividerLine} />
            <span className={styles.monthLabel}>📅 {monthLabel}</span>
            <span className={styles.monthDividerLine} />
          </div>

          {entries.map((match, i) => {
            const num = matchCounter--;
            const teamAPlayers = getPlayers(match.teamA);
            const teamBPlayers = getPlayers(match.teamB);

            const isDraw = match.result === 'DRAW';
            const labelA = isDraw ? t('matchHistory.result.draw') : match.result === 'A_WIN' ? t('matchHistory.result.winner') : t('matchHistory.result.loser');
            const labelB = isDraw ? t('matchHistory.result.draw') : match.result === 'B_WIN' ? t('matchHistory.result.winner') : t('matchHistory.result.loser');
            
            const teamAColor = isDraw ? 'Amber' : match.result === 'A_WIN' ? 'Green' : 'Red';
            const teamBColor = isDraw ? 'Amber' : match.result === 'B_WIN' ? 'Green' : 'Red';

            return (
              <div
                key={match.id}
                className={styles.matchCard}
                style={{ 
                  animationDelay: `${i * 0.06}s`,
                  zIndex: editingMatchId === match.id ? 100 : 1
                }}
              >
                {/* Tinte de fondo split */}
                <div className={styles[`splitBg${teamAColor}Left`]} />
                <div className={styles[`splitBg${teamBColor}Right`]} />

                <div className={styles.cardInner}>
                  {/* Cabecera */}
                  <div className={styles.cardHeader}>
                    <div className={styles.headerLeft}>
                      <div className={styles.matchNumber}>{t('matchHistory.matchNumber')}{num}</div>
                    </div>

                    <div className={styles.dateLabel}>
                      {editingMatchId === match.id ? (
                        <DatePicker value={editDate} onChange={setEditDate} />
                      ) : (
                        formatDateLabel(match.date)
                      )}
                    </div>
                    
                    <div className={styles.headerRight}>
                      {match.metadata?.video_url && (
                        <a 
                          href={match.metadata.video_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={styles.videoLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          🎥 <span className={styles.videoText}>{t('matchHistory.viewVideo')}</span>
                        </a>
                      )}

                      {isAdmin && (
                        <div className={styles.adminActions}>
                          <button
                            className={styles.editBtn}
                            onClick={() => handleEditClick(match)}
                            title={t('matchHistory.editTitle')}
                          >
                            ✏️
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() =>
                              confirm(t('matchHistory.deleteConfirm')) &&
                              removeMatch(match.id)
                            }
                            title={t('matchHistory.deleteTitle')}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cuerpo: equipos o Edición */}
                  {editingMatchId === match.id ? (
                    <div className={styles.editPanel}>
                      <div className={styles.editResultOptions}>
                        <button className={`${styles.editOption} ${editResult === 'A_WIN' ? styles.editOptionActiveGreen : ''}`} onClick={() => setEditResult('A_WIN')}>{t('matchHistory.edit.winA')}</button>
                        <button className={`${styles.editOption} ${editResult === 'DRAW' ? styles.editOptionActiveDraw : ''}`} onClick={() => setEditResult('DRAW')}>{t('matchHistory.edit.draw')}</button>
                        <button className={`${styles.editOption} ${editResult === 'B_WIN' ? styles.editOptionActiveRed : ''}`} onClick={() => setEditResult('B_WIN')}>{t('matchHistory.edit.winB')}</button>
                      </div>
                      <div className={styles.editScores}>
                        <input type="number" min="0" value={editScoreA} onChange={e => setEditScoreA(e.target.value)} placeholder="0" className={styles.editInput} />
                        <span className={styles.editScoreSeparator}>-</span>
                        <input type="number" min="0" value={editScoreB} onChange={e => setEditScoreB(e.target.value)} placeholder="0" className={styles.editInput} />
                      </div>
                      
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1.5fr)', 
                        gap: '1.5rem', 
                        width: '100%', 
                        maxWidth: '800px',
                        background: 'rgba(0,0,0,0.15)',
                        padding: '1.25rem',
                        borderRadius: '16px',
                        border: '1px solid var(--panel-border)',
                        marginTop: '0.5rem'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '0.05em' }}>{t('matchHistory.edit.mvp')}</span>
                          <CustomSelect 
                            options={[...match.teamA, ...match.teamB].map(id => ({ 
                              id, 
                              label: players.find(p => p.id === id)?.name || t('matchHistory.unknown') 
                            }))}
                            value={editMvpId}
                            onChange={setEditMvpId}
                            placeholder={t('matchHistory.edit.none')}
                            icon="🏅"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '0.05em' }}>{t('matchHistory.edit.video')}</span>
                          <input 
                            type="url" 
                            value={editVideoUrl} 
                            onChange={e => setEditVideoUrl(e.target.value)} 
                            placeholder="https://youtube.com/..."
                            style={{ 
                              background: 'rgba(255,255,255,0.04)', 
                              border: '1px solid var(--panel-border)', 
                              borderRadius: '10px', 
                              padding: '0 1rem', 
                              color: 'var(--text-primary)', 
                              fontSize: '0.9rem',
                              height: '45px',
                              width: '100%',
                              transition: 'all 0.2s'
                            }}
                          />
                        </div>
                      </div>

                      <div className={styles.editActions} style={{ marginTop: '0.5rem' }}>
                        <button onClick={handleSaveEdit} className={styles.saveEditBtn}>{t('matchHistory.edit.save')}</button>
                        <button onClick={() => setEditingMatchId(null)} className={styles.cancelEditBtn}>{t('matchHistory.edit.cancel')}</button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.teamsRow}>
                      {/* Equipo A */}
                      <div className={styles.teamSide}>
                        <div className={styles.teamLabel}>
                          <span className={styles[`teamName${teamAColor}`]}>{labelA}</span>
                        </div>
                        <div className={styles.chips}>
                          {teamAPlayers.map((name, idx) => (
                            <span key={idx} className={`${styles.chip} ${styles[`chip${teamAColor}`]}`}>
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* VS central o Score */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        {match.scoreA != null && match.scoreB != null ? (
                          <>
                            <div className={styles.scorePill}>
                              <div className={styles.scoreBox}>{match.scoreA}</div>
                              <div className={styles.scoreSeparator} />
                              <div className={styles.scoreBox}>{match.scoreB}</div>
                            </div>
                            {match.metadata?.sets && match.metadata.sets.length > 0 && (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {match.metadata.sets.map((setInfo: any, sIdx: number) => (
                                  <div key={sIdx} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'rgba(255,255,255,0.8)' }}>
                                    {setInfo.scoreA}-{setInfo.scoreB}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className={styles.vsSeparator}>
                            <span className={styles.vsIcon}>{tIcon}</span>
                            <span className={styles.vsText}>VS</span>
                          </div>
                        )}

                        {match.metadata?.mvp_id && (
                          <div style={{ 
                            marginTop: '0',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            background: 'rgba(245, 158, 11, 0.1)', 
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            padding: '2px 10px', 
                            borderRadius: '20px',
                            color: '#f59e0b',
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}>
                            ⭐ MVP: {players.find(p => p.id === match.metadata?.mvp_id)?.name || t('matchHistory.unknown')}
                          </div>
                        )}
                      </div>

                      {/* Equipo B */}
                      <div className={`${styles.teamSide} ${styles.teamSideRight}`}>
                        <div className={`${styles.teamLabel} ${styles.teamLabelRight}`}>
                          <span className={styles[`teamName${teamBColor}`]}>{labelB}</span>
                        </div>
                        <div className={`${styles.chips} ${styles.chipsRight}`}>
                          {teamBPlayers.map((name, idx) => (
                            <span key={idx} className={`${styles.chip} ${styles[`chip${teamBColor}`]}`}>
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
