"use client";

import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { calculateStats } from '@/lib/stats';
import { Match, Player, PlayerStats } from '@/types';
import { useTournament } from '@/context/TournamentContext';
import styles from './TeamSimulator.module.css';
import { TacticalBoard, TacticalConfig, FinalPitchRenderer } from './TacticalBoard';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PairStats {
  idA: string;
  idB: string;
  togetherTotal: number;
  togetherWins: number;
  togetherWinPct: number;
  vsTotal: number;
  vsWins: number;
  vsWinPct: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAIRWISE STATS
// ─────────────────────────────────────────────────────────────────────────────

function computePairwise(ids: string[], matches: Match[]): Map<string, PairStats> {
  const map = new Map<string, PairStats>();
  const key = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);
  const getOrCreate = (a: string, b: string): PairStats => {
    const k = key(a, b);
    if (!map.has(k)) {
      map.set(k, {
        idA: a < b ? a : b,
        idB: a < b ? b : a,
        togetherTotal: 0, togetherWins: 0, togetherWinPct: 0,
        vsTotal: 0, vsWins: 0, vsWinPct: 0,
      });
    }
    return map.get(k)!;
  };
  const idSet = new Set(ids);
  matches.forEach(m => {
    const teamA = m.teamA.filter(id => idSet.has(id));
    const teamB = m.teamB.filter(id => idSet.has(id));
    const aWins = m.result === 'A_WIN';
    const bWins = m.result === 'B_WIN';
    const processSameTeam = (team: string[], teamWon: boolean) => {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const p = getOrCreate(team[i], team[j]);
          p.togetherTotal++;
          if (teamWon) p.togetherWins++;
        }
      }
    };
    processSameTeam(teamA, aWins);
    processSameTeam(teamB, bWins);
    teamA.forEach(pa => {
      teamB.forEach(pb => {
        const p = getOrCreate(pa, pb);
        p.vsTotal++;
        const canonA = pa < pb ? pa : pb;
        const canonWins = pa < pb ? aWins : bWins;
        if (canonA === p.idA && canonWins) p.vsWins++;
      });
    });
  });
  map.forEach(p => {
    p.togetherWinPct = p.togetherTotal > 0 ? (p.togetherWins / p.togetherTotal) * 100 : 50;
    p.vsWinPct       = p.vsTotal > 0       ? (p.vsWins       / p.vsTotal)       * 100 : 50;
  });
  return map;
}

function getPair(map: Map<string, PairStats>, a: string, b: string): PairStats | null {
  const k = a < b ? `${a}::${b}` : `${b}::${a}`;
  return map.get(k) ?? null;
}

function vsWinPctFor(map: Map<string, PairStats>, idA: string, idB: string): number {
  const p = getPair(map, idA, idB);
  if (!p || p.vsTotal === 0) return 50;
  return p.idA === idA ? p.vsWinPct : 100 - p.vsWinPct;
}

function togetherWinPct(map: Map<string, PairStats>, idA: string, idB: string): number {
  const p = getPair(map, idA, idB);
  if (!p || p.togetherTotal === 0) return 50;
  return p.togetherWinPct;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRENGTH SCORE
// ─────────────────────────────────────────────────────────────────────────────

function playerStrength(s: PlayerStats): number {
  const winScore  = s.winPercentage;
  const expBonus  = Math.min(s.matchesPlayed / 20, 1) * 10;
  const streakBonus = s.bestStreak * 1.5;
  return winScore + expBonus + streakBonus;
}

function teamChemistry(team: PlayerStats[], pairMap: Map<string, PairStats>): number {
  let total = 0, count = 0;
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const p = getPair(pairMap, team[i].player.id, team[j].player.id);
      const weight = p?.togetherTotal ?? 0;
      const pct    = p && p.togetherTotal > 0 ? p.togetherWinPct : 50;
      total  += pct * (weight + 1);
      count  += (weight + 1);
    }
  }
  return count > 0 ? total / count : 50;
}

function balanceScore(
  teamA: PlayerStats[], teamB: PlayerStats[],
  pairMap: Map<string, PairStats>
): number {
  const strA = teamA.length ? teamA.reduce((s, p) => s + playerStrength(p), 0) / teamA.length : 0;
  const strB = teamB.length ? teamB.reduce((s, p) => s + playerStrength(p), 0) / teamB.length : 0;
  const chemA = teamChemistry(teamA, pairMap);
  const chemB = teamChemistry(teamB, pairMap);
  return Math.pow(strA - strB, 2) + Math.pow(chemA - chemB, 2) * 0.1;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM BUILDING — combination-based with locks
// ─────────────────────────────────────────────────────────────────────────────

function fillBestBalance(
  teamA: PlayerStats[], teamB: PlayerStats[],
  unassigned: PlayerStats[],
  pairMap: Map<string, PairStats>,
  teamSize: number
): { teamA: PlayerStats[]; teamB: PlayerStats[] } {
  let bestScore = Infinity;
  let bestA: PlayerStats[] = [];
  let bestB: PlayerStats[] = [];

  const neededA = teamSize - teamA.length;
  const neededB = teamSize - teamB.length;

  if (unassigned.length > 12) {
    const sorted = [...unassigned].sort((a,b) => playerStrength(b) - playerStrength(a));
    const currA = [...teamA];
    const currB = [...teamB];
    for(const p of sorted) {
      if(currA.length < teamSize && currB.length < teamSize) {
         if(currA.length <= currB.length) currA.push(p); else currB.push(p);
      } else if (currA.length < teamSize) currA.push(p);
      else currB.push(p);
    }
    
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = teamA.length; i < currA.length; i++) {
        for (let j = teamB.length; j < currB.length; j++) {
           const newA = [...currA];
           const newB = [...currB];
           [newA[i], newB[j]] = [newB[j], newA[i]];
           const score = balanceScore(newA, newB, pairMap);
           if(score < bestScore - 0.01) {
             bestScore = score;
             currA[i] = newA[i];
             currB[j] = newB[j];
             improved = true;
           }
        }
      }
    }
    return { teamA: currA, teamB: currB };
  }

  function backtrack(index: number, currentA: PlayerStats[], currentB: PlayerStats[]) {
    if (currentA.length === neededA) {
      const remainingB = currentB.concat(unassigned.slice(index));
      const fullA = teamA.concat(currentA);
      const fullB = teamB.concat(remainingB);
      const score = balanceScore(fullA, fullB, pairMap);
      if (score < bestScore) {
        bestScore = score;
        bestA = [...currentA];
        bestB = [...remainingB];
      }
      return;
    }
    if (currentB.length === neededB) {
      const remainingA = currentA.concat(unassigned.slice(index));
      const fullA = teamA.concat(remainingA);
      const fullB = teamB.concat(currentB);
      const score = balanceScore(fullA, fullB, pairMap);
      if (score < bestScore) {
        bestScore = score;
        bestA = [...remainingA];
        bestB = [...currentB];
      }
      return;
    }
    
    currentA.push(unassigned[index]);
    backtrack(index + 1, currentA, currentB);
    currentA.pop();
    
    currentB.push(unassigned[index]);
    backtrack(index + 1, currentA, currentB);
    currentB.pop();
  }

  backtrack(0, [], []);
  
  return { teamA: teamA.concat(bestA), teamB: teamB.concat(bestB) };
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTABLE PAIRS 
// ─────────────────────────────────────────────────────────────────────────────

interface NotablePair {
  nameA: string; nameB: string; type: 'synergy' | 'rivalry' | 'nemesis';
  label: string; detail: string; pct: number; games: number;
}

function getNotablePairs(
  teamA: PlayerStats[], teamB: PlayerStats[],
  pairMap: Map<string, PairStats>
): { internal: NotablePair[]; clashes: NotablePair[] } {
  const internal: NotablePair[] = [];
  const clashes: NotablePair[] = [];

  const processTeam = (team: PlayerStats[]) => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const p = getPair(pairMap, team[i].player.id, team[j].player.id);
        if (!p || p.togetherTotal < 2) continue;
        const pct = p.togetherWinPct;
        if (pct >= 70 || pct <= 35) {
          internal.push({
            nameA: team[i].player.name, nameB: team[j].player.name,
            type: pct >= 70 ? 'synergy' : 'rivalry',
            label: pct >= 70 ? '🔥 Dupla ganadora' : '⚠️ Dupla complicada',
            detail: `${p.togetherWins}/${p.togetherTotal} juntos (${pct.toFixed(0)}%)`,
            pct, games: p.togetherTotal,
          });
        }
      }
    }
  };
  processTeam(teamA);
  processTeam(teamB);
  internal.sort((a, b) => Math.abs(b.pct - 50) - Math.abs(a.pct - 50));

  teamA.forEach(pa => {
    teamB.forEach(pb => {
      const p = getPair(pairMap, pa.player.id, pb.player.id);
      if (!p || p.vsTotal < 2) return;
      const aWinPct = vsWinPctFor(pairMap, pa.player.id, pb.player.id);
      if (aWinPct >= 70 || aWinPct <= 30) {
        const aWins = aWinPct >= 70;
        clashes.push({
          nameA: aWins ? pa.player.name : pb.player.name,
          nameB: aWins ? pb.player.name : pa.player.name,
          type: 'nemesis',
          label: aWins ? '⚔️ Domina históricamente' : '⚔️ Duelo desequilibrado',
          detail: `${aWins
            ? `${pa.player.name} gana ${aWinPct.toFixed(0)}% de cruces vs ${pb.player.name}`
            : `${pb.player.name} gana ${(100 - aWinPct).toFixed(0)}% de cruces vs ${pa.player.name}`
          } (${p.vsTotal} PJ)`,
          pct: Math.max(aWinPct, 100 - aWinPct), games: p.vsTotal,
        });
      }
    });
  });
  clashes.sort((a, b) => b.pct - a.pct);

  return { internal: internal.slice(0, 4), clashes: clashes.slice(0, 4) };
}

function generateExplanation(
  teamA: PlayerStats[], teamB: PlayerStats[],
  pairMap: Map<string, PairStats>, isPadel: boolean
): string[] {
  const avgA   = teamA.reduce((s, p) => s + playerStrength(p), 0) / teamA.length;
  const avgB   = teamB.reduce((s, p) => s + playerStrength(p), 0) / teamB.length;
  const chemA  = teamChemistry(teamA, pairMap);
  const chemB  = teamChemistry(teamB, pairMap);
  const diff   = Math.abs(avgA - avgB).toFixed(1);

  const topA = [...teamA].sort((a, b) => playerStrength(b) - playerStrength(a))[0];
  const topB = [...teamB].sort((a, b) => playerStrength(b) - playerStrength(a))[0];

  const lines: string[] = [];

  lines.push(
    isPadel
      ? `🎯 La simulación ordenó a los jugadores por nivel de juego y buscó el equilibrio perfecto analizando cruces y duplas históricas.`
      : `🎯 El algoritmo evaluó exhaustivamente las posibles combinaciones de jugadores para minimizar las diferencias de nivel entre los equipos.`
  );
  lines.push(
    isPadel 
      ? `📊 Nivel individual = % victorias + bono de experiencia + rachas. Química = promedio de % victorias cuando jugaron juntos como pareja.`
      : `📊 Puntaje de fuerza = % victorias + bono de exp. (hasta +10 pts) + bono de racha jugada (×1.5 por win). Química = win rate ponderado en dúo.`
  );
  lines.push(`⚖️ Fuerza promedio — Equipo A: ${avgA.toFixed(1)} pts · Equipo B: ${avgB.toFixed(1)} pts (diferencia: ${diff} pts).`);
  lines.push(`🤝 Química histórica — Equipo A: ${chemA.toFixed(1)}% win juntos · Equipo B: ${chemB.toFixed(1)}% win juntos.`);

  if (topA) lines.push(`⭐ Figura del Equipo A: ${topA.player.name} (${topA.winPercentage.toFixed(1)}% win, racha máx ${topA.bestStreak}, ${topA.matchesPlayed} PJ).`);
  if (topB) lines.push(`⭐ Figura del Equipo B: ${topB.player.name} (${topB.winPercentage.toFixed(1)}% win, racha máx ${topB.bestStreak}, ${topB.matchesPlayed} PJ).`);

  const winPctA = teamA.reduce((s, p) => s + p.winPercentage, 0) / teamA.length;
  const winPctB = teamB.reduce((s, p) => s + p.winPercentage, 0) / teamB.length;
  const favored = winPctA > winPctB ? 'A' : winPctA < winPctB ? 'B' : null;
  if (favored) {
    lines.push(`🏆 Ligero favorito matemático: Equipo ${favored} (${Math.abs(winPctA - winPctB).toFixed(1)}% más de victoria promedio).`);
  } else {
    lines.push(`🏆 Ambos equipos están matemáticamente empatados en victoria promedio.`);
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

type SimStep = 'selection' | 'distribution' | 'results';

export default function TeamSimulator() {
  const { players, matches } = useAppContext();
  const { activeTournament } = useTournament();

  const isPadel = activeTournament?.type_slug === 'paddle';
  const matchTypes = isPadel ? [2] : (activeTournament?.match_types?.length ? activeTournament.match_types.sort((a,b)=>a-b) : [5]);
  const [teamSize, setTeamSize] = useState<number>(matchTypes[0]);
  const totalRequired = teamSize * 2;

  const allStats = useMemo(() => {
    const stats = calculateStats(players, matches);
    return stats.sort((a, b) => 
      b.wins - a.wins || b.draws - a.draws || b.winPercentage - a.winPercentage || a.player.name.localeCompare(b.player.name)
    );
  }, [players, matches]);
  
  const [step, setStep] = useState<SimStep>('selection');

  // step 1: pool
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // step 2 & 3: teams
  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);
  const [tacticalConfig, setTacticalConfig] = useState<TacticalConfig | null>(null);

  // Computed states
  const selectedStats = useMemo(() => allStats.filter(s => selectedIds.has(s.player.id)), [allStats, selectedIds]);
  const teamA = useMemo(() => teamAIds.map(id => allStats.find(s => s.player.id === id)!), [teamAIds, allStats]);
  const teamB = useMemo(() => teamBIds.map(id => allStats.find(s => s.player.id === id)!), [teamBIds, allStats]);
  const unassigned = useMemo(() => selectedStats.filter(s => !teamAIds.includes(s.player.id) && !teamBIds.includes(s.player.id)), [selectedStats, teamAIds, teamBIds]);

  const pairMap = useMemo(() => computePairwise(Array.from(selectedIds), matches), [selectedIds, matches]);
  const fullPairMap = useMemo(() => computePairwise(players.map(p=>p.id), matches), [players, matches]);

  const explanation = useMemo(() => {
    if (step !== 'results') return [];
    return generateExplanation(teamA, teamB, fullPairMap, isPadel);
  }, [step, teamA, teamB, fullPairMap, isPadel]);

  const notablePairs = useMemo(() => {
    if (step !== 'results') return { internal: [], clashes: [] };
    return getNotablePairs(teamA, teamB, fullPairMap);
  }, [step, teamA, teamB, fullPairMap]);

  // Actions
  const handleTypeChange = (newSize: number) => {
    setTeamSize(newSize);
    setSelectedIds(new Set());
    setTeamAIds([]);
    setTeamBIds([]);
    setStep('selection');
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < totalRequired) next.add(id);
      return next;
    });
  };

  const moveToDistribution = () => {
    if (selectedIds.size === totalRequired) setStep('distribution');
  };

  const handleBackToSel = () => {
    setStep('selection');
  };

  const clearTeams = () => {
    setTeamAIds([]);
    setTeamBIds([]);
    setTacticalConfig(null);
  };

  const isFormed = teamAIds.length === teamSize && teamBIds.length === teamSize;

  if (players.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>👥</span>
        <h2>No hay jugadores registrados</h2>
        <p>Agrega jugadores en la pestaña "Jugadores" para usar el simulador.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{activeTournament?.type_icon || '⚽'} Simulación de Equipos</h1>
        {step === 'selection' && (
          <p className={styles.pageSubtitle}>
            Paso 1: Elegí a los {totalRequired} jugadores para el partido.
          </p>
        )}
        
        {step === 'selection' && matchTypes.length > 1 && (
          <div className={styles.formatSelector} style={{marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
            <span style={{color: '#94a3b8', fontSize: '0.9rem'}}>Formato:</span>
            {matchTypes.map(size => (
              <button
                key={size}
                className={styles.formatBtn}
                style={{
                  background: teamSize === size ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  color: teamSize === size ? '#10b981' : '#94a3b8',
                  border: `1px solid ${teamSize === size ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '6px',
                  padding: '4px 12px',
                  cursor: 'pointer'
                }}
                onClick={() => handleTypeChange(size)}
              >
                {size}v{size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Selection Step ── */}
      {step === 'selection' && (
        <div className={styles.pickerSection}>
          <div className={styles.pickerHeader}>
            <span className={styles.pickerLabel}>Jugadores seleccionados</span>
            <span className={`${styles.counter} ${selectedIds.size === totalRequired ? styles.counterFull : ''}`}>
              {selectedIds.size} / {totalRequired}
            </span>
          </div>

          <div className={styles.playerGrid}>
            {allStats.map((s, index) => {
              const isSelected  = selectedIds.has(s.player.id);
              const isDisabled  = !isSelected && selectedIds.size >= totalRequired;
              const strength    = playerStrength(s);
              const strengthPct = Math.min(strength, 120) / 120 * 100;

              return (
                <button
                  key={s.player.id}
                  className={`${styles.playerCard} ${isSelected ? styles.playerCardSelected : ''} ${isDisabled ? styles.playerCardDisabled : ''}`}
                  onClick={() => toggleSelection(s.player.id)}
                  disabled={isDisabled}
                >
                  {isSelected && <span className={styles.checkmark}>✓</span>}
                  <div className={styles.cardRank}>#{index + 1}</div>
                  <div className={styles.cardName}>{s.player.name}</div>
                  <div className={styles.cardStats}>
                    <span className={styles.statWin}>{s.winPercentage.toFixed(0)}%</span>
                    <span className={styles.statPJ}>{s.matchesPlayed} PJ</span>
                  </div>
                  <div className={styles.strengthBar}>
                    <div className={styles.strengthFill} style={{ width: `${strengthPct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className={styles.simulateWrapper}>
            <button
              className={styles.simulateBtn}
              onClick={moveToDistribution}
              disabled={selectedIds.size !== totalRequired}
            >
              {selectedIds.size < totalRequired
                ? `Falta elegir ${totalRequired - selectedIds.size} jugador${totalRequired - selectedIds.size !== 1 ? 'es' : ''}`
                : 'Siguiente: Distribuir Equipos →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Distribution Step ── */}
      {step === 'distribution' && (
        <TacticalBoard 
          players={selectedStats}
          teamSize={teamSize}
          pairMap={pairMap}
          fillBestBalance={fillBestBalance}
          onComplete={(newTeamA, newTeamB, config) => {
             setTeamAIds(newTeamA.map(p => p.player.id));
             setTeamBIds(newTeamB.map(p => p.player.id));
             setTacticalConfig(config);
             setStep('results');
          }}
          onBack={handleBackToSel}
          isPadel={isPadel}
        />
      )}

      {/* ── Results Step ── */}
      {step === 'results' && (
        <div className={styles.resultSection}>
          <div className={styles.modeBackRow} style={{marginBottom: '1rem'}}>
            <button className={styles.modeBackBtn} onClick={() => setStep('distribution')}>
              ← Volver a Distribución
            </button>
            <span className={styles.modeBadge}>
              📊 Análisis de Simulación
            </span>
          </div>

          {tacticalConfig && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
              <FinalPitchRenderer players={selectedStats} config={tacticalConfig} isPadel={isPadel} />
            </div>
          )}

          <div className={styles.teamsGrid}>
            <TeamCard label="Equipo A" color="green" dotColor={tacticalConfig?.colorA1} players={teamA} pairMap={fullPairMap} />
            <div className={styles.vsDivider}><span className={styles.vsText}>VS</span></div>
            <TeamCard label="Equipo B" color="blue" dotColor={tacticalConfig?.colorB1} players={teamB} pairMap={fullPairMap} />
          </div>

          {(notablePairs.internal.length > 0 || notablePairs.clashes.length > 0) && (
            <div className={styles.pairsSection}>
              <h3 className={styles.pairsSectionTitle}>🔍 Análisis Individual entre Jugadores</h3>
              {notablePairs.internal.length > 0 && (
                <div className={styles.pairsGroup}>
                  <span className={styles.pairsGroupLabel}>Compañeros destacados (dentro del mismo equipo)</span>
                  <div className={styles.pairsGrid}>
                    {notablePairs.internal.map((pair, i) => <PairCard key={i} pair={pair} />)}
                  </div>
                </div>
              )}
              {notablePairs.clashes.length > 0 && (
                <div className={styles.pairsGroup}>
                  <span className={styles.pairsGroupLabel}>Duelos históricos (equipos enfrentados)</span>
                  <div className={styles.pairsGrid}>
                    {notablePairs.clashes.map((pair, i) => <PairCard key={i} pair={pair} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={styles.explanationBox}>
            <h3 className={styles.explanationTitle}>📝 Resumen Estadístico</h3>
            <ul className={styles.explanationList}>
              {explanation.map((line, i) => <li key={i} className={styles.explanationItem}>{line}</li>)}
            </ul>
          </div>

          <div className={styles.resetWrapper}>
            <button className={styles.resetBtn} onClick={() => { setStep('selection'); setSelectedIds(new Set()); clearTeams(); }}>
              🔄 Nueva Simulación Desde Cero
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UI EXTRACTS
// ─────────────────────────────────────────────────────────────────────────────

// DistributionTeamPanel removed completely

function TeamCard({ label, color, dotColor, players, pairMap }: { label: string; color: 'green'|'blue'; dotColor?: string; players: PlayerStats[]; pairMap: Map<string, PairStats> }) {
  const avgWin      = players.length ? players.reduce((s, p) => s + p.winPercentage, 0) / players.length : 0;
  const totalPJ     = players.reduce((s, p) => s + p.matchesPlayed, 0);
  const avgStrength = players.length ? players.reduce((s, p) => s + playerStrength(p), 0) / players.length : 0;
  const chem        = teamChemistry(players, pairMap);
  const sorted      = [...players].sort((a, b) => playerStrength(b) - playerStrength(a));

  return (
    <div className={`${styles.teamCard} ${color === 'green' ? styles.teamCardGreen : styles.teamCardBlue}`}>
      <div className={styles.teamHeader}>
        {dotColor ? (
           <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: dotColor, marginRight: '8px', boxShadow: '0 0 8px rgba(0,0,0,0.5)' }}></span>
        ) : (
           <span className={styles.teamIcon}>{color === 'green' ? '🟢' : '🔵'}</span>
        )}
        <h2 className={styles.teamLabel}>{label}</h2>
      </div>
      <div className={styles.teamMetaRow}>
        <div className={styles.teamMeta}>
          <span className={styles.metaValue}>{avgWin.toFixed(1)}%</span>
          <span className={styles.metaLabel}>% Vic. prom.</span>
        </div>
        <div className={styles.teamMeta}>
          <span className={styles.metaValue}>{avgStrength.toFixed(0)}</span>
          <span className={styles.metaLabel}>Fuerza prom.</span>
        </div>
        <div className={styles.teamMeta}>
          <span className={styles.metaValue}>{chem.toFixed(0)}%</span>
          <span className={styles.metaLabel}>Química</span>
        </div>
        <div className={styles.teamMeta}>
          <span className={styles.metaValue}>{totalPJ}</span>
          <span className={styles.metaLabel}>PJ totales</span>
        </div>
      </div>
      <ul className={styles.playerList}>
        {sorted.map((s, i) => {
          const strength = playerStrength(s);
          const pct = Math.min(strength, 120) / 120 * 100;
          return (
            <li key={s.player.id} className={styles.playerRow}>
              <span className={styles.playerPos}>{i + 1}</span>
              <span className={styles.playerRowName}>{s.player.name}</span>
              <div className={styles.playerRowStats}>
                <span className={styles.playerRowWin}>{s.winPercentage.toFixed(0)}%</span>
                <span className={styles.playerRowPJ}>{s.matchesPlayed} PJ</span>
              </div>
              <div className={styles.miniBar}>
                <div className={styles.miniBarFill} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PairCard({ pair }: { pair: NotablePair }) {
  const isSynergy  = pair.type === 'synergy';
  const isClash    = pair.type === 'nemesis';
  const barColor   = isSynergy ? 'var(--accent-primary)' : isClash ? 'var(--danger)' : 'var(--warning)';
  const barWidth   = isSynergy ? pair.pct : isClash ? pair.pct : (100 - pair.pct);
  return (
    <div className={`${styles.pairCard} ${isSynergy ? styles.pairSynergy : isClash ? styles.pairNemesis : styles.pairWarning}`}>
      <div className={styles.pairLabel}>{pair.label}</div>
      <div className={styles.pairNames}>
        <span className={styles.pairNameA}>{pair.nameA}</span>
        <span className={styles.pairVs}>{isClash ? '⚔️' : '+'}</span>
        <span className={styles.pairNameB}>{pair.nameB}</span>
      </div>
      <div className={styles.pairDetail}>{pair.detail}</div>
      <div className={styles.pairBar}>
        <div className={styles.pairBarFill} style={{ width: `${barWidth}%`, background: barColor }} />
      </div>
    </div>
  );
}
