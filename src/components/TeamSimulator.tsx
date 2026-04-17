"use client";

import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { calculateStats } from '@/lib/stats';
import { Match, Player, PlayerStats } from '@/types';
import styles from './TeamSimulator.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PairStats {
  idA: string;
  idB: string;
  // As teammates
  togetherTotal: number;
  togetherWins: number;
  togetherWinPct: number; // A's win% when on same team as B
  // As opponents — from A's perspective
  vsTotal: number;
  vsWins: number; // A wins vs B
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

    // Teammates within same team
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

    // Opponents across teams
    teamA.forEach(pa => {
      teamB.forEach(pb => {
        const p = getOrCreate(pa, pb);
        p.vsTotal++;
        // Store from canonical idA's perspective
        const canonA = pa < pb ? pa : pb;
        const canonWins = pa < pb ? aWins : bWins;
        if (canonA === p.idA && canonWins) p.vsWins++;
      });
    });
  });

  // Compute percentages
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

// Win % of idA vs idB (from A's perspective)
function vsWinPctFor(map: Map<string, PairStats>, idA: string, idB: string): number {
  const p = getPair(map, idA, idB);
  if (!p || p.vsTotal === 0) return 50;
  return p.idA === idA ? p.vsWinPct : 100 - p.vsWinPct;
}

// Win % of idA when paired with idB
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

// Team chemistry: average together-win% across all teammate pairs (weighted by games together)
function teamChemistry(team: PlayerStats[], pairMap: Map<string, PairStats>): number {
  let total = 0, count = 0;
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const p = getPair(pairMap, team[i].player.id, team[j].player.id);
      const weight = p?.togetherTotal ?? 0;
      const pct    = p && p.togetherTotal > 0 ? p.togetherWinPct : 50;
      total  += pct * (weight + 1); // +1 so unplayed pairs still count
      count  += (weight + 1);
    }
  }
  return count > 0 ? total / count : 50;
}

// Balance score: penalises strength imbalance, rewards chemistry equality
function balanceScore(
  teamA: PlayerStats[], teamB: PlayerStats[],
  pairMap: Map<string, PairStats>
): number {
  const strA = teamA.reduce((s, p) => s + playerStrength(p), 0) / teamA.length;
  const strB = teamB.reduce((s, p) => s + playerStrength(p), 0) / teamB.length;
  const chemA = teamChemistry(teamA, pairMap);
  const chemB = teamChemistry(teamB, pairMap);
  // Lower is better: sum of squared differences
  return Math.pow(strA - strB, 2) + Math.pow(chemA - chemB, 2) * 0.1;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM BUILDING — snake draft + chemistry-swap optimisation
// ─────────────────────────────────────────────────────────────────────────────

function buildBalancedTeams(
  selected: PlayerStats[],
  pairMap: Map<string, PairStats>
): { teamA: PlayerStats[]; teamB: PlayerStats[] } {
  // 1. Snake draft seed
  const sorted = [...selected].sort((a, b) => playerStrength(b) - playerStrength(a));
  let teamA: PlayerStats[] = [];
  let teamB: PlayerStats[] = [];
  sorted.forEach((player, i) => {
    const pick = i % 4;
    if (pick === 0 || pick === 3) teamA.push(player);
    else teamB.push(player);
  });

  // 2. Greedy swap optimisation
  let best = balanceScore(teamA, teamB, pairMap);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < teamA.length; i++) {
      for (let j = 0; j < teamB.length; j++) {
        const newA = [...teamA];
        const newB = [...teamB];
        [newA[i], newB[j]] = [newB[j], newA[i]];
        const score = balanceScore(newA, newB, pairMap);
        if (score < best - 0.01) {
          best = score;
          teamA = newA;
          teamB = newB;
          improved = true;
        }
      }
    }
  }

  return { teamA, teamB };
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTABLE PAIRS — synergies & rivalries
// ─────────────────────────────────────────────────────────────────────────────

interface NotablePair {
  nameA: string;
  nameB: string;
  type: 'synergy' | 'rivalry' | 'nemesis';
  label: string;
  detail: string;
  pct: number;
  games: number;
}

function getNotablePairs(
  teamA: PlayerStats[], teamB: PlayerStats[],
  pairMap: Map<string, PairStats>,
  playerById: Map<string, Player>
): { internal: NotablePair[]; clashes: NotablePair[] } {
  const internal: NotablePair[] = [];
  const clashes: NotablePair[] = [];

  // Internal synergies within each team
  const processTeam = (team: PlayerStats[]) => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const p = getPair(pairMap, team[i].player.id, team[j].player.id);
        if (!p || p.togetherTotal < 2) continue;
        const pct = p.togetherWinPct;
        if (pct >= 70 || pct <= 35) {
          internal.push({
            nameA: team[i].player.name,
            nameB: team[j].player.name,
            type: pct >= 70 ? 'synergy' : 'rivalry',
            label: pct >= 70 ? '🔥 Dupla ganadora' : '⚠️ Dupla complicada',
            detail: `${p.togetherWins}/${p.togetherTotal} juntos (${pct.toFixed(0)}%)`,
            pct,
            games: p.togetherTotal,
          });
        }
      }
    }
  };
  processTeam(teamA);
  processTeam(teamB);
  internal.sort((a, b) => Math.abs(b.pct - 50) - Math.abs(a.pct - 50));

  // Cross-team clashes (nemesis / victim)
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
            ? `${pa.player.name} gana ${aWinPct.toFixed(0)}% de sus cruces vs ${pb.player.name}`
            : `${pb.player.name} gana ${(100 - aWinPct).toFixed(0)}% de sus cruces vs ${pa.player.name}`
          } (${p.vsTotal} PJ)`,
          pct: Math.max(aWinPct, 100 - aWinPct),
          games: p.vsTotal,
        });
      }
    });
  });
  clashes.sort((a, b) => b.pct - a.pct);

  return {
    internal: internal.slice(0, 5),
    clashes:  clashes.slice(0, 5),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLANATION — extended with pairwise analysis
// ─────────────────────────────────────────────────────────────────────────────

function generateExplanation(
  teamA: PlayerStats[], teamB: PlayerStats[],
  pairMap: Map<string, PairStats>
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
    `🎯 El draft inicial ordenó a los jugadores por puntaje de fuerza y los distribuyó en serpentina. Luego, un optimizador probó todos los intercambios posibles para minimizar la diferencia de fuerza Y la diferencia de química de equipo.`
  );
  lines.push(
    `📊 Puntaje de fuerza = % victorias + bono de experiencia (hasta +10 pts con 20 PJ) + bono de racha histórica (×1.5 por win). Química = promedio ponderado de % de victorias jugando juntos.`
  );
  lines.push(
    `⚖️ Fuerza promedio — Equipo A: ${avgA.toFixed(1)} pts · Equipo B: ${avgB.toFixed(1)} pts (diferencia: ${diff} pts).`
  );
  lines.push(
    `🤝 Química histórica — Equipo A: ${chemA.toFixed(1)}% win juntos · Equipo B: ${chemB.toFixed(1)}% win juntos.`
  );

  if (topA) lines.push(
    `⭐ Figura del Equipo A: ${topA.player.name} (${topA.winPercentage.toFixed(1)}% victorias, racha récord ${topA.bestStreak}, ${topA.matchesPlayed} PJ).`
  );
  if (topB) lines.push(
    `⭐ Figura del Equipo B: ${topB.player.name} (${topB.winPercentage.toFixed(1)}% victorias, racha récord ${topB.bestStreak}, ${topB.matchesPlayed} PJ).`
  );

  const winPctA = teamA.reduce((s, p) => s + p.winPercentage, 0) / teamA.length;
  const winPctB = teamB.reduce((s, p) => s + p.winPercentage, 0) / teamB.length;
  const favored = winPctA > winPctB ? 'A' : winPctA < winPctB ? 'B' : null;
  if (favored) {
    lines.push(
      `🏆 Ligero favorito en papel: Equipo ${favored} (${Math.abs(winPctA - winPctB).toFixed(1)}% más de victoria promedio), pero el partido se gana en la cancha.`
    );
  } else {
    lines.push(`🏆 Ambos equipos están perfectamente igualados en % de victoria promedio. ¡Va a ser un partido muy parejo!`);
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL BUILDER — sub-component
// ─────────────────────────────────────────────────────────────────────────────

const MANUAL_TEAM_SIZE = 5;

function ManualBuilder({ allStats, pairMap, onReset }: {
  allStats: PlayerStats[];
  pairMap: Map<string, PairStats>;
  onReset: () => void;
}) {
  const [teamA, setTeamA] = useState<PlayerStats[]>([]);
  const [teamB, setTeamB] = useState<PlayerStats[]>([]);
  const [revealed, setRevealed] = useState(false);

  const assignedIds = useMemo(
    () => new Set([...teamA.map(p => p.player.id), ...teamB.map(p => p.player.id)]),
    [teamA, teamB]
  );

  const available = useMemo(
    () => allStats.filter(s => !assignedIds.has(s.player.id)),
    [allStats, assignedIds]
  );

  const addTo = (team: 'A' | 'B', s: PlayerStats) => {
    if (revealed) return;
    if (team === 'A' && teamA.length < MANUAL_TEAM_SIZE) setTeamA(prev => [...prev, s]);
    if (team === 'B' && teamB.length < MANUAL_TEAM_SIZE) setTeamB(prev => [...prev, s]);
  };

  const removeFrom = (team: 'A' | 'B', id: string) => {
    if (revealed) return;
    if (team === 'A') setTeamA(prev => prev.filter(p => p.player.id !== id));
    if (team === 'B') setTeamB(prev => prev.filter(p => p.player.id !== id));
  };

  const isComplete = teamA.length === MANUAL_TEAM_SIZE && teamB.length === MANUAL_TEAM_SIZE;

  // Use parent pairMap for the analysis (it contains all match history)
  const notablePairs = useMemo(() => {
    if (!revealed || !isComplete) return { internal: [], clashes: [] };
    return getNotablePairs(teamA, teamB, pairMap, new Map(allStats.map(s => [s.player.id, s.player])));
  }, [revealed, isComplete, teamA, teamB, pairMap, allStats]);

  const explanation = useMemo(() => {
    if (!revealed || !isComplete) return [];
    return generateExplanation(teamA, teamB, pairMap);
  }, [revealed, isComplete, teamA, teamB, pairMap]);

  return (
    <>
      {!revealed && (
        <>
          {/* ── Team panels ── */}
          <div className={styles.manualLayout}>
            {/* Team A panel */}
            <ManualTeamPanel
              label="Equipo A"
              color="green"
              team={teamA}
              available={available}
              onAdd={(s) => addTo('A', s)}
              onRemove={(id) => removeFrom('A', id)}
            />
            {/* Team B panel */}
            <ManualTeamPanel
              label="Equipo B"
              color="blue"
              team={teamB}
              available={available}
              onAdd={(s) => addTo('B', s)}
              onRemove={(id) => removeFrom('B', id)}
            />
          </div>

          <div className={styles.simulateWrapper}>
            <button
              className={styles.simulateBtn}
              onClick={() => setRevealed(true)}
              disabled={!isComplete}
            >
              {!isComplete
                ? `Faltan jugadores (A: ${teamA.length}/5 · B: ${teamB.length}/5)`
                : '📊 Ver Análisis'}
            </button>
          </div>
        </>
      )}

      {revealed && isComplete && (
        <div className={styles.resultSection}>
          <div className={styles.teamsGrid}>
            <TeamCard label="Equipo A" color="green" players={teamA} pairMap={pairMap} />
            <div className={styles.vsDivider}><span className={styles.vsText}>VS</span></div>
            <TeamCard label="Equipo B" color="blue" players={teamB} pairMap={pairMap} />
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
            <h3 className={styles.explanationTitle}>📋 Análisis de los equipos</h3>
            <ul className={styles.explanationList}>
              {explanation.map((line, i) => (
                <li key={i} className={styles.explanationItem}>{line}</li>
              ))}
            </ul>
          </div>

          <div className={styles.resetWrapper}>
            <button className={styles.resetBtn} onClick={() => { setTeamA([]); setTeamB([]); setRevealed(false); }}>
              ✏️ Rehacer equipos
            </button>
            <button className={styles.resetBtn} onClick={onReset}>
              🔄 Nueva Simulación
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ManualTeamPanel({ label, color, team, available, onAdd, onRemove }: {
  label: string;
  color: 'green' | 'blue';
  team: PlayerStats[];
  available: PlayerStats[];
  onAdd: (s: PlayerStats) => void;
  onRemove: (id: string) => void;
}) {
  const full = team.length === MANUAL_TEAM_SIZE;
  const isGreen = color === 'green';

  return (
    <div className={`${styles.manualTeamBox} ${isGreen ? styles.manualTeamGreen : styles.manualTeamBlue}`}>
      <div className={styles.manualTeamHeader}>
        <span className={styles.teamIcon}>{isGreen ? '🟢' : '🔵'}</span>
        <h3 className={styles.manualTeamTitle}>{label}</h3>
        <span className={`${styles.counter} ${full ? styles.counterFull : ''}`}>
          {team.length}/{MANUAL_TEAM_SIZE}
        </span>
      </div>

      {/* Progress bar */}
      <div className={styles.manualProgressTrack}>
        <div
          className={`${styles.manualProgressBar} ${isGreen ? styles.manualProgressGreen : styles.manualProgressBlue}`}
          style={{ width: `${(team.length / MANUAL_TEAM_SIZE) * 100}%` }}
        />
      </div>

      {/* Current team roster */}
      <div className={styles.manualRoster}>
        {team.map((s, i) => (
          <div key={s.player.id} className={styles.manualRosterSlot}>
            <span className={styles.manualRosterNum}>{i + 1}</span>
            <span className={styles.manualRosterName}>{s.player.name}</span>
            <span className={styles.manualRosterStat}>{s.winPercentage.toFixed(0)}%</span>
            <button className={styles.manualRemoveBtn} onClick={() => onRemove(s.player.id)}>✕</button>
          </div>
        ))}
        {Array.from({ length: MANUAL_TEAM_SIZE - team.length }).map((_, i) => (
          <div key={`empty-${i}`} className={styles.manualRosterEmpty}>
            <span className={styles.manualRosterNum}>{team.length + i + 1}</span>
            <span className={styles.manualRosterPlaceholder}>Vacío</span>
          </div>
        ))}
      </div>

      {/* Available players */}
      {!full && available.length > 0 && (
        <>
          <div className={styles.manualDivider}>
            <span className={styles.manualDividerLabel}>Agregar jugador</span>
          </div>
          <div className={styles.manualAvailableList}>
            {available.map(s => (
              <button
                key={s.player.id}
                className={`${styles.manualAvailableRow} ${isGreen ? styles.manualAvailableGreen : styles.manualAvailableBlue}`}
                onClick={() => onAdd(s)}
              >
                <span className={styles.manualAvailableName}>{s.player.name}</span>
                <span className={styles.manualAvailableStat}>{s.winPercentage.toFixed(0)}%</span>
                <span className={`${styles.manualAddBtn} ${isGreen ? styles.manualAddGreen : styles.manualAddBlue}`}>+</span>
              </button>
            ))}
          </div>
        </>
      )}

      {full && (
        <div className={`${styles.manualCompleteMsg} ${isGreen ? styles.manualCompleteMsgGreen : styles.manualCompleteMsgBlue}`}>
          ¡Equipo completo!
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

type SimMode = null | 'auto' | 'manual';

export default function TeamSimulator() {
  const { players, matches } = useAppContext();
  const allStats = useMemo(() => {
    const stats = calculateStats(players, matches);
    return stats.sort((a, b) => {
      if (b.matchesPlayed !== a.matchesPlayed) {
        return b.matchesPlayed - a.matchesPlayed;
      }
      if (b.winPercentage !== a.winPercentage) {
        return b.winPercentage - a.winPercentage;
      }
      return a.player.name.localeCompare(b.player.name);
    });
  }, [players, matches]);
  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  const [mode, setMode] = useState<SimMode>(null);

  // ── AUTO mode state ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [simulated, setSimulated] = useState(false);

  const toggle = (id: string) => {
    if (simulated) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 10) { next.add(id); }
      return next;
    });
  };

  const selectedStats = useMemo(
    () => allStats.filter(s => selected.has(s.player.id)),
    [allStats, selected]
  );

  const pairMap = useMemo(
    () => computePairwise(Array.from(selected), matches),
    [selected, matches]
  );

  const result = useMemo(() => {
    if (!simulated || selectedStats.length !== 10) return null;
    return buildBalancedTeams(selectedStats, pairMap);
  }, [simulated, selectedStats, pairMap]);

  const explanation = useMemo(() => {
    if (!result) return [];
    return generateExplanation(result.teamA, result.teamB, pairMap);
  }, [result, pairMap]);

  const notablePairs = useMemo(() => {
    if (!result) return { internal: [], clashes: [] };
    return getNotablePairs(result.teamA, result.teamB, pairMap, playerById);
  }, [result, pairMap, playerById]);

  const handleSimulate = () => { if (selected.size === 10) setSimulated(true); };

  // Full pair map for manual mode (all players, all history)
  const fullPairMap = useMemo(
    () => computePairwise(players.map(p => p.id), matches),
    [players, matches]
  );

  const handleReset = () => {
    setMode(null);
    setSelected(new Set());
    setSimulated(false);
  };

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
        <h1 className={styles.pageTitle}>⚽ Simulación de Equipos</h1>
        {!mode && (
          <p className={styles.pageSubtitle}>
            Elegí cómo querés armar los equipos para el partido.
          </p>
        )}
      </div>

      {/* ── Mode picker ── */}
      {!mode && (
        <div className={styles.modePicker}>
          <button
            className={`${styles.modeCard} ${styles.modeCardAuto}`}
            onClick={() => setMode('auto')}
          >
            <span className={styles.modeIcon}>🤖</span>
            <span className={styles.modeTitle}>Automático</span>
            <span className={styles.modeDesc}>
              Seleccionás 10 jugadores y el algoritmo forma los equipos más equilibrados usando estadísticas, química histórica y head-to-head.
            </span>
          </button>

          <button
            className={`${styles.modeCard} ${styles.modeCardManual}`}
            onClick={() => setMode('manual')}
          >
            <span className={styles.modeIcon}>✋</span>
            <span className={styles.modeTitle}>Manual</span>
            <span className={styles.modeDesc}>
              Armás vos mismo los dos equipos eligiendo qué jugador va en cada lado. Después podés ver el análisis estadístico.
            </span>
          </button>
        </div>
      )}

      {/* ── Back button ── */}
      {mode && (
        <div className={styles.modeBackRow}>
          <button className={styles.modeBackBtn} onClick={handleReset}>
            ← Cambiar modo
          </button>
          <span className={styles.modeBadge}>
            {mode === 'auto' ? '🤖 Automático' : '✋ Manual'}
          </span>
        </div>
      )}

      {/* ── AUTO mode ── */}
      {mode === 'auto' && !simulated && (
        <div className={styles.pickerSection}>
          <div className={styles.pickerHeader}>
            <span className={styles.pickerLabel}>Jugadores seleccionados</span>
            <span className={`${styles.counter} ${selected.size === 10 ? styles.counterFull : ''}`}>
              {selected.size} / 10
            </span>
          </div>

          <div className={styles.playerGrid}>
            {allStats.map((s, index) => {
              const isSelected  = selected.has(s.player.id);
              const isDisabled  = !isSelected && selected.size >= 10;
              const strength    = playerStrength(s);
              const strengthPct = Math.min(strength, 120) / 120 * 100;

              return (
                <button
                  key={s.player.id}
                  className={`${styles.playerCard} ${isSelected ? styles.playerCardSelected : ''} ${isDisabled ? styles.playerCardDisabled : ''}`}
                  onClick={() => toggle(s.player.id)}
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
              onClick={handleSimulate}
              disabled={selected.size !== 10}
            >
              {selected.size < 10
                ? `Falta elegir ${10 - selected.size} jugador${10 - selected.size !== 1 ? 'es' : ''}`
                : '⚡ Generar Equipos'}
            </button>
          </div>
        </div>
      )}

      {mode === 'auto' && simulated && result && (
        <div className={styles.resultSection}>
          <div className={styles.teamsGrid}>
            <TeamCard label="Equipo A" color="green" players={result.teamA} pairMap={pairMap} />
            <div className={styles.vsDivider}><span className={styles.vsText}>VS</span></div>
            <TeamCard label="Equipo B" color="blue"  players={result.teamB} pairMap={pairMap} />
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
            <h3 className={styles.explanationTitle}>🧠 Por qué se armaron así los equipos</h3>
            <ul className={styles.explanationList}>
              {explanation.map((line, i) => (
                <li key={i} className={styles.explanationItem}>{line}</li>
              ))}
            </ul>
          </div>

          <div className={styles.resetWrapper}>
            <button className={styles.resetBtn} onClick={() => { setSelected(new Set()); setSimulated(false); }}>✏️ Reelegir jugadores</button>
            <button className={styles.resetBtn} onClick={handleReset}>🔄 Nueva Simulación</button>
          </div>
        </div>
      )}

      {/* ── MANUAL mode ── */}
      {mode === 'manual' && (
        <ManualBuilder
          allStats={allStats}
          pairMap={fullPairMap}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function TeamCard({
  label, color, players, pairMap,
}: {
  label: string;
  color: 'green' | 'blue';
  players: PlayerStats[];
  pairMap: Map<string, PairStats>;
}) {
  const avgWin      = players.reduce((s, p) => s + p.winPercentage, 0) / players.length;
  const totalPJ     = players.reduce((s, p) => s + p.matchesPlayed, 0);
  const avgStrength = players.reduce((s, p) => s + playerStrength(p), 0) / players.length;
  const chem        = teamChemistry(players, pairMap);
  const sorted      = [...players].sort((a, b) => playerStrength(b) - playerStrength(a));

  return (
    <div className={`${styles.teamCard} ${color === 'green' ? styles.teamCardGreen : styles.teamCardBlue}`}>
      <div className={styles.teamHeader}>
        <span className={styles.teamIcon}>{color === 'green' ? '🟢' : '🔵'}</span>
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
  const barColor   = isSynergy ? 'var(--accent-primary)'
                   : isClash   ? 'var(--danger)'
                   : 'var(--warning)';
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
