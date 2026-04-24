"use client";

import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getPlayerReport } from '@/lib/stats';
import styles from './PlayerReportModal.module.css';
import { RelationStats } from '@/types';
import { useTranslation } from 'react-i18next';

interface PlayerReportModalProps {
  playerId: string;
  onClose: () => void;
}

export default function PlayerReportModal({ playerId, onClose }: PlayerReportModalProps) {
  const { players, matches, badges } = useAppContext();
  const { t } = useTranslation();

  const report = useMemo(() => {
    try { return getPlayerReport(playerId, players, matches); }
    catch (e) { console.error(e); return null; }
  }, [playerId, players, matches]);

  if (!report) return null;

  const pct = (v: number) => `${v.toFixed(0)}%`;
  const winColor = (p: number) => p >= 60 ? 'var(--accent-primary)' : p >= 50 ? '#86efac' : p >= 35 ? 'var(--warning)' : 'var(--danger)';

  // Render a relation table with progress bar on %
  const renderTable = (data: RelationStats[], accentColor: string) => (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>{t('reportModal.headers.player')}</th>
            <th className={styles.th}>{t('reportModal.headers.played')}</th>
            <th className={styles.th}>{t('reportModal.headers.wld')}</th>
            <th className={styles.th}>{t('reportModal.headers.pct')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const rowColor = item.winPercentage === 100
              ? 'rgba(16,185,129,0.06)'
              : item.winPercentage === 0
                ? 'rgba(239,68,68,0.06)'
                : 'transparent';
            return (
              <tr key={item.player.id} style={{ background: rowColor }}>
                <td className={styles.td}>
                  <span className={styles.playerName}>{item.player.name}</span>
                </td>
                <td className={styles.td}>{item.total}</td>
                <td className={styles.td}>
                  <div className={styles.stats}>
                    <span className={`${styles.statValue} ${styles.win}`}>{item.wins}</span>
                    <span className={styles.draw}>-</span>
                    <span className={`${styles.statValue} ${styles.draw}`}>{item.draws}</span>
                    <span className={styles.draw}>-</span>
                    <span className={`${styles.statValue} ${styles.loss}`}>{item.losses}</span>
                  </div>
                </td>
                <td className={styles.td}>
                  <div className={styles.pctCell}>
                    <span style={{ fontWeight: 'bold', color: winColor(item.winPercentage), fontSize: '0.85rem' }}>
                      {pct(item.winPercentage)}
                    </span>
                    <div className={styles.pctTrack}>
                      <div className={styles.pctBar} style={{ width: `${item.winPercentage}%`, background: winColor(item.winPercentage) }} />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const teamAPct = report.teamARecord.total > 0 ? (report.teamARecord.wins / report.teamARecord.total) * 100 : 0;
  const teamBPct = report.teamBRecord.total > 0 ? (report.teamBRecord.wins / report.teamBRecord.total) * 100 : 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div>
            <div className={styles.headerMeta}>
              <span className={styles.rankBadge}>#{report.rank} {t('reportModal.of')} {report.totalPlayers}</span>
              <span className={styles.presenceBadge}>
                {report.matchesPlayed}/{report.totalMatchesInHistory} {t('reportModal.matches')} · {pct(report.presencePercentage)} {t('reportModal.presence')}
              </span>
            </div>
            <h2 className={styles.headerTitle}>{report.player.name}</h2>
            {(() => {
              if (!report.player.badges || report.player.badges.length === 0) return null;
              
              // Agrupar y sumar votos
              const badgeCounts: Record<string, number> = {};
              report.player.badges.forEach(b => {
                badgeCounts[b.badgeId] = (badgeCounts[b.badgeId] || 0) + 1;
              });

              const sortedBadges = Object.entries(badgeCounts)
                .sort((a, b) => {
                  const tie = b[1] - a[1];
                  if (tie !== 0) return tie;
                  // Tie-break: positive badge first
                  const defA = badges.find(bad => bad.id === a[0]);
                  const defB = badges.find(bad => bad.id === b[0]);
                  if (defA?.category === 'positiva' && defB?.category !== 'positiva') return -1;
                  if (defB?.category === 'positiva' && defA?.category !== 'positiva') return 1;
                  return 0;
                })
                .map(([badgeId]) => badgeId);

              return (
                <div className={styles.badgesContainer}>
                  {sortedBadges.map((badgeId, index) => {
                    const badgeDef = badges.find(b => b.id === badgeId);
                    if (!badgeDef) return null;
                    const count = badgeCounts[badgeId];
                    return (
                      <div key={badgeId} className={styles.badgeHex} style={{ animationDelay: `${index * 0.1}s` }} title={`${badgeDef.description} (${count} votos)`}>
                        <div className={styles.badgeHexIconWrapper}>
                          <span className={styles.badgeHexIcon}>{badgeDef.icon}</span>
                        </div>
                        <span className={styles.badgeHexLabel}>{badgeDef.label}</span>
                        <span className={styles.badgeVoteCountText}>{count} {count === 1 ? t('reportModal.vote') : t('reportModal.votes')}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── KPI strip ── */}
        <div className={styles.kpiStrip}>
          <div className={styles.kpiItem}>
            <span className={styles.kpiLabel}>{t('reportModal.kpi.wins')}</span>
            <span className={styles.kpiValue} style={{ color: 'var(--accent-primary)' }}>{report.wins}</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <span className={styles.kpiLabel}>{t('reportModal.kpi.draws')}</span>
            <span className={styles.kpiValue} style={{ color: 'var(--warning)' }}>{report.draws}</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <span className={styles.kpiLabel}>{t('reportModal.kpi.losses')}</span>
            <span className={styles.kpiValue} style={{ color: 'var(--danger)' }}>{report.losses}</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <span className={styles.kpiLabel}>{t('reportModal.kpi.winPct')}</span>
            <span className={styles.kpiValue} style={{ color: winColor(report.winPercentage) }}>
              {pct(report.winPercentage)}
            </span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <span className={styles.kpiLabel}>{t('reportModal.kpi.bestStreak')}</span>
            <span className={styles.kpiValue} style={{ color: 'var(--accent-primary)' }}>
              {report.bestStreak > 0 ? report.bestStreak : '-'}
            </span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <span className={styles.kpiLabel}>{t('reportModal.kpi.currentStreak')}</span>
            <span className={styles.kpiValue} style={{
              color: report.currentStreak.type === 'WIN' ? 'var(--accent-primary)'
                : report.currentStreak.type === 'LOSS' ? 'var(--danger)'
                  : 'var(--text-secondary)'
            }}>
              {report.currentStreak.count > 0 && report.currentStreak.type !== 'DRAW'
                ? `${report.currentStreak.count} ${report.currentStreak.type === 'WIN' ? 'V' : 'D'}`
                : '-'}
            </span>
          </div>
        </div>

        {/* ── Summary cards row 1: compa + nemesis ── */}
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('reportModal.summary.bestTeammate')}</span>
            <div className={styles.summaryContent}>
              <span className={styles.summaryValue}>
                {report.bestTeammate ? report.bestTeammate.players.map(p => p.name).join(', ') : '-'}
              </span>
              {report.bestTeammate && <span className={styles.summaryDetail}>{report.bestTeammate.matches} {t('reportModal.summary.winsTogether')}</span>}
            </div>
          </div>

          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('reportModal.summary.worstTeammate')}</span>
            <div className={styles.summaryContent}>
              <span className={styles.summaryValue}>
                {report.worstTeammate ? report.worstTeammate.players.map(p => p.name).join(', ') : '-'}
              </span>
              {report.worstTeammate && <span className={styles.summaryDetail}>{report.worstTeammate.matches} {t('reportModal.summary.lossesTogether')}</span>}
            </div>
          </div>

          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('reportModal.summary.favoriteVictim')}</span>
            <div className={styles.summaryContent}>
              <span className={styles.summaryValue} style={{ color: 'var(--accent-primary)' }}>
                {report.favoriteVictim ? report.favoriteVictim.players.map(p => p.name).join(', ') : '-'}
              </span>
              {report.favoriteVictim && <span className={styles.summaryDetail}>{report.favoriteVictim.winsAgainst} {t('reportModal.summary.timesWonAgainst')}</span>}
            </div>
          </div>

          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('reportModal.summary.nemesis')}</span>
            <div className={styles.summaryContent}>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>
                {report.nemesis ? report.nemesis.players.map(p => p.name).join(', ') : '-'}
              </span>
              {report.nemesis && <span className={styles.summaryDetail}>{report.nemesis.lossesAgainst} {t('reportModal.summary.timesWonAgainst')}</span>}
            </div>
          </div>
        </div>

        {/* ── Tables ── */}
        <div className={styles.sections}>
          <div className={styles.section}>
            <h3>{t('reportModal.sections.teammates')}</h3>
            {report.teammates.length > 0 ? renderTable(report.teammates, 'var(--accent-primary)') : <p>{t('reportModal.sections.noData')}</p>}
          </div>
          <div className={styles.section}>
            <h3>{t('reportModal.sections.opponents')}</h3>
            {report.opponents.length > 0 ? renderTable(report.opponents, 'var(--danger)') : <p>{t('reportModal.sections.noData')}</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
