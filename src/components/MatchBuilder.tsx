"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Player, MatchResult, MatchMetadata, PadelMetadata, FootballMetadata } from '@/types';
import styles from './MatchBuilder.module.css';
import DatePicker from './DatePicker';
import CustomSelect from './CustomSelect';
import { useTournament } from '@/context/TournamentContext';
import { useTranslation } from 'react-i18next';

interface TeamPanelProps {
  label: string;
  team: Player[];
  availablePlayers: Player[];
  variant: 'green' | 'red' | 'draw';
  onAdd: (player: Player) => void;
  onRemove: (playerId: string) => void;
  teamSize: number;
}

function TeamPanel({ label, team, availablePlayers, variant, onAdd, onRemove, teamSize }: TeamPanelProps) {
  const { t } = useTranslation();
  const full = team.length === teamSize;
  const progress = team.length / teamSize;
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
          {team.length}/{teamSize}
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
        {Array.from({ length: teamSize }).map((_, i) => {
          const player = team[i];
          return player ? (
            <div key={player.id} className={`${styles.slot} ${styles.slotFilled} ${isRed ? styles.slotFilledRed : ''} ${isDraw ? styles.slotFilledDraw : ''}`}>
              <span className={styles.slotNumber}>{i + 1}</span>
              <span className={styles.slotName}>{player.name}</span>
              <button
                className={styles.removeBtn}
                onClick={() => onRemove(player.id)}
                title={t('matchBuilder.panel.remove')}
              >
                ✕
              </button>
            </div>
          ) : (
            <div key={`empty-${i}`} className={styles.slotEmpty}>
              <span className={styles.slotNumber}>{i + 1}</span>
              <span className={styles.slotPlaceholder}>{t('matchBuilder.panel.empty')}</span>
            </div>
          );
        })}
      </div>

      {/* Separador y lista de disponibles */}
      {!full && availablePlayers.length > 0 && (
        <>
          <div className={styles.divider}>
            <span className={styles.dividerLabel}>{t('matchBuilder.panel.available')}</span>
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
          {t('matchBuilder.panel.complete')}
        </div>
      )}
    </div>
  );
}

export default function MatchBuilder({ onComplete }: { onComplete: () => void }) {
  const { players, matches, addMatch } = useAppContext();
  const { activeTournament } = useTournament();
  const { t } = useTranslation();

  const isPadel = activeTournament?.type_slug === 'paddle';
  const matchTypes = isPadel ? [2] : (activeTournament?.match_types?.length ? activeTournament.match_types.sort((a,b)=>a-b) : [5]);
  const [teamSize, setTeamSize] = useState<number>(matchTypes[0]);

  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [matchDate, setMatchDate] = useState<string>(todayStr);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [scoreA, setScoreA] = useState<string>('');
  const [scoreB, setScoreB] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [mvpId, setMvpId] = useState<string>('');
  
  const [padelSets, setPadelSets] = useState<{ scoreA: string; scoreB: string }[]>([
    { scoreA: '', scoreB: '' },
    { scoreA: '', scoreB: '' },
    { scoreA: '', scoreB: '' },
    { scoreA: '', scoreB: '' },
    { scoreA: '', scoreB: '' }
  ]);

  const handlePadelSetChange = (index: number, field: 'scoreA' | 'scoreB', value: string) => {
    const newSets = [...padelSets];
    newSets[index][field] = value;
    setPadelSets(newSets);
  };

  // Link scores with result selection
  useEffect(() => {
    if (isPadel) return;

    const valA = parseInt(scoreA, 10);
    const valB = parseInt(scoreB, 10);

    if (!isNaN(valA) && !isNaN(valB)) {
      if (valA > valB) setResult('A_WIN');
      else if (valB > valA) setResult('B_WIN');
      else setResult('DRAW');
    }
  }, [scoreA, scoreB, isPadel]);

  const handleTypeChange = (newSize: number) => {
    setTeamSize(newSize);
    setTeamA([]);
    setTeamB([]);
    setResult(null);
  };

  const available = players
    .filter(p => !teamA.find(a => a.id === p.id) && !teamB.find(b => b.id === p.id))
    .sort((a, b) => {
      const attendanceA = matches.filter(m => m.teamA.includes(a.id) || m.teamB.includes(a.id)).length;
      const attendanceB = matches.filter(m => m.teamA.includes(b.id) || m.teamB.includes(b.id)).length;
      if (attendanceB !== attendanceA) return attendanceB - attendanceA;
      return a.name.localeCompare(b.name);
    });

  const addTo = (team: 'A' | 'B', player: Player) => {
    if (team === 'A' && teamA.length < teamSize) setTeamA(prev => [...prev, player]);
    if (team === 'B' && teamB.length < teamSize) setTeamB(prev => [...prev, player]);
  };

  const removeFrom = (team: 'A' | 'B', playerId: string) => {
    if (team === 'A') setTeamA(prev => prev.filter(p => p.id !== playerId));
    if (team === 'B') setTeamB(prev => prev.filter(p => p.id !== playerId));
  };

  const handleSubmit = () => {
    let finalResult = result;
    let finalScoreA: number | undefined = parseInt(scoreA, 10);
    let finalScoreB: number | undefined = parseInt(scoreB, 10);
    let metadata: MatchMetadata;

    if (isPadel) {
      let setsA = 0;
      let setsB = 0;
      const validSets = padelSets.filter(s => s.scoreA !== '' && s.scoreB !== '');
      
      validSets.forEach(s => {
        const a = parseInt(s.scoreA, 10);
        const b = parseInt(s.scoreB, 10);
        if (!isNaN(a) && !isNaN(b)) {
           if (a > b) setsA++;
           else if (b > a) setsB++;
        }
      });
      
      finalScoreA = setsA;
      finalScoreB = setsB;
      
      if (setsA > setsB) finalResult = 'A_WIN';
      else if (setsB > setsA) finalResult = 'B_WIN';
      else if (validSets.length > 0) finalResult = 'DRAW';

      const padelMeta: PadelMetadata = {
        sport: 'padel',
        video_url: videoUrl || null,
        mvp_id: mvpId || null,
        sets: validSets.map(s => ({ scoreA: parseInt(s.scoreA, 10), scoreB: parseInt(s.scoreB, 10) }))
      };
      metadata = padelMeta;
    } else {
      const footballMeta: FootballMetadata = {
        sport: 'football',
        video_url: videoUrl || null,
        mvp_id: mvpId || null,
      };
      metadata = footballMeta;
    }

    if (teamA.length !== teamSize || teamB.length !== teamSize || !matchDate || !finalResult) return;
    const fullDate = new Date(`${matchDate}T12:00:00Z`).toISOString();
    
    if (!isPadel) {
      if (isNaN(finalScoreA as number)) finalScoreA = undefined;
      if (isNaN(finalScoreB as number)) finalScoreB = undefined;
    }

    addMatch(fullDate, teamA.map(p => p.id), teamB.map(p => p.id), finalResult, finalScoreA, finalScoreB, metadata);
    onComplete();
  };

  const teamsFull = teamA.length === teamSize && teamB.length === teamSize;
  const validPadelSets = padelSets.filter(s => s.scoreA !== '' && s.scoreB !== '').length;
  const canSubmit = teamsFull && (isPadel ? validPadelSets > 0 : !!result);

  return (
    <div className={styles.container}>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{activeTournament?.type_icon || '⚽'} {t('matchBuilder.title')}</h1>
        <p className={styles.pageSubtitle}>{t('matchBuilder.subtitle')}</p>
        
        {matchTypes.length > 1 && (
          <div className={styles.formatSelector}>
            <span className={styles.formatLabel}>{t('matchBuilder.format')}</span>
            <div className={styles.formatGroup}>
              {matchTypes.map(size => (
                <button
                  key={size}
                  className={`${styles.formatBtn} ${teamSize === size ? styles.formatBtnActive : ''}`}
                  onClick={() => handleTypeChange(size)}
                >
                  {size}v{size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`${styles.datePanelBox} glass-panel`}>
        <div className={styles.datePickerContainer}>
          <label className={styles.dateLabel}>{t('matchBuilder.dateLabel')}</label>
          <DatePicker value={matchDate} onChange={setMatchDate} />
        </div>
      </div>

      {teamsFull && isPadel && (
        <div className={`${styles.resultPicker} glass-panel`}>
          <span className={styles.resultPickerLabel} style={{ marginBottom: '0.5rem', display: 'block' }}>{t('matchBuilder.padel.setsTitle')}</span>
          <div className={styles.padelSetsWrapper} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {padelSets.map((set, index) => (
              <div key={index} className={styles.scoreInputsWrapper} style={{ gap: '10px' }}>
                <div className={styles.scoreInputBox} style={{ flex: '1', padding: '10px' }}>
                  <span className={styles.scoreTeamName} style={{ fontSize: '0.75rem', opacity: 0.7 }}>{t('matchBuilder.padel.teamA')}{index + 1})</span>
                  <input
                    type="number"
                    min="0"
                    className={styles.scoreInput}
                    value={set.scoreA}
                    onChange={e => handlePadelSetChange(index, 'scoreA', e.target.value)}
                    placeholder="0"
                    style={{ padding: '4px', fontSize: '1.1rem', marginTop: '4px', textAlign: 'center' }}
                  />
                </div>
                <span className={styles.scoreSeparator} style={{ fontSize: '1.2rem' }}>—</span>
                <div className={styles.scoreInputBox} style={{ flex: '1', padding: '10px' }}>
                  <span className={styles.scoreTeamName} style={{ fontSize: '0.75rem', opacity: 0.7 }}>{t('matchBuilder.padel.teamB')}{index + 1})</span>
                  <input
                    type="number"
                    min="0"
                    className={styles.scoreInput}
                    value={set.scoreB}
                    onChange={e => handlePadelSetChange(index, 'scoreB', e.target.value)}
                    placeholder="0"
                    style={{ padding: '4px', fontSize: '1.1rem', marginTop: '4px', textAlign: 'center' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent-primary)', background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '8px' }}>
            {t('matchBuilder.padel.autoCalc')}
          </div>
        </div>
      )}

      {teamsFull && !isPadel && (
        <div className={`${styles.resultPicker} glass-panel`}>
          <span className={styles.resultPickerLabel}>{t('matchBuilder.resultTitle')}</span>
          <div className={styles.resultOptions}>
            <button
              className={`${styles.resultOption} ${result === 'A_WIN' ? styles.resultOptionActiveGreen : ''}`}
              onClick={() => setResult('A_WIN')}
            >
              <span className={styles.resultOptionIcon}>🟢</span>
              <span className={styles.resultOptionText}>{t('matchBuilder.winA')}</span>
            </button>
            <button
              className={`${styles.resultOption} ${result === 'DRAW' ? styles.resultOptionActiveDraw : ''}`}
              onClick={() => setResult('DRAW')}
            >
              <span className={styles.resultOptionIcon}>🤝</span>
              <span className={styles.resultOptionText}>{t('matchBuilder.draw')}</span>
            </button>
            <button
              className={`${styles.resultOption} ${result === 'B_WIN' ? styles.resultOptionActiveRed : ''}`}
              onClick={() => setResult('B_WIN')}
            >
              <span className={styles.resultOptionIcon}>🔴</span>
              <span className={styles.resultOptionText}>{t('matchBuilder.winB')}</span>
            </button>
          </div>

          <div className={styles.scoreSection}>
            <span className={styles.scoreLabel}>{t('matchBuilder.scoreLabel')}</span>
            <div className={styles.scoreInputsWrapper}>
              <div className={styles.scoreInputBox}>
                <span className={styles.scoreTeamName}>{t('matchBuilder.teamA')}</span>
                <input 
                  type="number" 
                  min="0" 
                  className={styles.scoreInput} 
                  value={scoreA} 
                  onChange={e => setScoreA(e.target.value)} 
                  placeholder="0"
                />
              </div>
              <span className={styles.scoreSeparator}>—</span>
              <div className={styles.scoreInputBox}>
                <span className={styles.scoreTeamName}>{t('matchBuilder.teamB')}</span>
                <input 
                  type="number" 
                  min="0" 
                  className={styles.scoreInput} 
                  value={scoreB} 
                  onChange={e => setScoreB(e.target.value)} 
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <span className={styles.scoreLabel} style={{ marginBottom: '0.6rem', display: 'block' }}>{t('matchBuilder.mvpLabel')}</span>
              <CustomSelect 
                options={[...teamA, ...teamB].map(p => ({ id: p.id, label: p.name }))}
                value={mvpId}
                onChange={setMvpId}
                placeholder={t('matchBuilder.mvpPlaceholder')}
                icon="⭐"
              />
            </div>
            <div>
              <span className={styles.scoreLabel} style={{ marginBottom: '0.6rem', display: 'block' }}>{t('matchBuilder.videoLabel')}</span>
              <input 
                type="url" 
                className={styles.scoreInput} 
                style={{ width: '100%', fontSize: '0.9rem', textAlign: 'left', height: '45px', padding: '0 1rem' }}
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/..."
              />
            </div>
          </div>
        </div>
      )}

      <div className={styles.teamsLayout}>
        <TeamPanel
          label={t('matchBuilder.teamA')}
          variant={result === 'A_WIN' ? 'green' : result === 'B_WIN' ? 'red' : result === 'DRAW' ? 'draw' : 'green'}
          team={teamA}
          teamSize={teamSize}
          availablePlayers={available}
          onAdd={(p) => addTo('A', p)}
          onRemove={(id) => removeFrom('A', id)}
        />
        <TeamPanel
          label={t('matchBuilder.teamB')}
          variant={result === 'B_WIN' ? 'green' : result === 'A_WIN' ? 'red' : result === 'DRAW' ? 'draw' : 'green'}
          team={teamB}
          teamSize={teamSize}
          availablePlayers={available}
          onAdd={(p) => addTo('B', p)}
          onRemove={(id) => removeFrom('B', id)}
        />
      </div>

      {canSubmit ? (
        <button
          className={`${styles.submitBtn} ${result === 'DRAW' ? styles.submitBtnDraw : ''}`}
          onClick={handleSubmit}
        >
          {result === 'DRAW' ? t('matchBuilder.submitDraw') : t('matchBuilder.submitMatch')}
        </button>
      ) : (
        <p className={styles.hint}>
          {t('matchBuilder.hint', { size: teamSize })}
        </p>
      )}

    </div>
  );
}
