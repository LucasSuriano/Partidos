"use client";

import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  DragStartEvent, DragEndEvent
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { PlayerStats } from '@/types';
import styles from './TacticalBoard.module.css';
import { JerseySVG, JerseyPattern } from './JerseySVG';
import { useTranslation } from 'react-i18next';

interface PairStats {
  idA: string; idB: string;
  togetherTotal: number; togetherWins: number; togetherWinPct: number;
  vsTotal: number; vsWins: number; vsWinPct: number;
}

export interface TacticalConfig {
  locations: Record<string, string>;
  fmtA: string; fmtB: string;
  colorA1: string; colorA2: string; patA: JerseyPattern;
  colorB1: string; colorB2: string; patB: JerseyPattern;
  teamSize: number;
}

interface TacticalBoardProps {
  players: PlayerStats[];
  teamSize: number;
  pairMap: Map<string, PairStats>;
  fillBestBalance: (
    teamA: PlayerStats[], teamB: PlayerStats[],
    unassigned: PlayerStats[], pairMap: Map<string, PairStats>, teamSize: number
  ) => { teamA: PlayerStats[]; teamB: PlayerStats[] };
  onComplete: (teamA: PlayerStats[], teamB: PlayerStats[], config: TacticalConfig) => void;
  onBack: () => void;
  isPadel?: boolean;
}

interface Formation {
  id: string; name: string;
  pos: {role: string, x: number, y: number}[]; // Left half relative coords (x: 0-50%)
  links?: [string, string][]; // Explicit adjacency map between roles
}

const FORMATIONS: Record<number, Formation[]> = {
  2: [
    { id: 'paralela', name: 'Paralela', pos: [{role: 'P1', x: 25, y: 30}, {role: 'P2', x: 25, y: 70}], links: [['P1', 'P2']] },
    { id: '1v1', name: 'Australiana', pos: [{role: 'P1', x: 10, y: 50}, {role: 'P2', x: 35, y: 50}], links: [['P1', 'P2']] }
  ],
  5: [
    { id: '1-2-1', name: 'Rombo (1-2-1)', pos: [{role: 'GK', x: 8, y: 50}, {role: 'CB', x: 20, y: 50}, {role: 'LW', x: 32, y: 23}, {role: 'RW', x: 32, y: 77}, {role: 'ST', x: 45, y: 50}], links: [['GK', 'CB'], ['CB', 'LW'], ['CB', 'RW'], ['LW', 'ST'], ['RW', 'ST'], ['LW', 'RW']] },
    { id: '2-2', name: 'Cuadrado (2-2)', pos: [{role: 'GK', x: 8, y: 50}, {role: 'LCB', x: 22, y: 25}, {role: 'RCB', x: 22, y: 75}, {role: 'LFW', x: 40, y: 25}, {role: 'RFW', x: 40, y: 75}], links: [['GK', 'LCB'], ['GK', 'RCB'], ['LCB', 'RCB'], ['LCB', 'LFW'], ['RCB', 'RFW'], ['LFW', 'RFW']] },
    { id: '1-3', name: 'Ofensiva (1-3)', pos: [{role: 'GK', x: 8, y: 50}, {role: 'CB', x: 20, y: 50}, {role: 'LW', x: 40, y: 15}, {role: 'ST', x: 44, y: 50}, {role: 'RW', x: 40, y: 85}], links: [['GK', 'CB'], ['CB', 'LW'], ['CB', 'ST'], ['CB', 'RW'], ['LW', 'ST'], ['ST', 'RW']] },
    { id: '3-1', name: 'Muro defensivo (3-1)', pos: [{role: 'GK', x: 8, y: 50}, {role: 'LCB', x: 25, y: 15}, {role: 'CB', x: 25, y: 50}, {role: 'RCB', x: 25, y: 85}, {role: 'ST', x: 42, y: 50}], links: [['GK', 'LCB'], ['GK', 'CB'], ['GK', 'RCB'], ['LCB', 'CB'], ['CB', 'RCB'], ['LCB', 'ST'], ['CB', 'ST'], ['RCB', 'ST']] }
  ],
  7: [
    { id: '2-3-1', name: 'Equilibrada (2-3-1)', pos: [{role: 'GK', x: 4, y: 50}, {role: 'LCB', x: 15, y: 30}, {role: 'RCB', x: 15, y: 70}, {role: 'LM', x: 28, y: 20}, {role: 'CM', x: 25, y: 50}, {role: 'RM', x: 28, y: 80}, {role: 'ST', x: 40, y: 50}], links: [['GK', 'LCB'], ['GK', 'RCB'], ['LCB', 'RCB'], ['LCB', 'LM'], ['LCB', 'CM'], ['RCB', 'CM'], ['RCB', 'RM'], ['LM', 'CM'], ['CM', 'RM'], ['LM', 'ST'], ['CM', 'ST'], ['RM', 'ST']] },
    { id: '3-2-1', name: 'Defensiva (3-2-1)', pos: [{role: 'GK', x: 4, y: 50}, {role: 'LB', x: 15, y: 20}, {role: 'CB', x: 12, y: 50}, {role: 'RB', x: 15, y: 80}, {role: 'LCM', x: 28, y: 35}, {role: 'RCM', x: 28, y: 65}, {role: 'ST', x: 42, y: 50}], links: [['GK', 'LB'], ['GK', 'CB'], ['GK', 'RB'], ['LB', 'CB'], ['CB', 'RB'], ['LB', 'LCM'], ['CB', 'LCM'], ['CB', 'RCM'], ['RB', 'RCM'], ['LCM', 'RCM'], ['LCM', 'ST'], ['RCM', 'ST']] },
    { id: '2-2-2', name: 'Ofensiva (2-2-2)', pos: [{role: 'GK', x: 4, y: 50}, {role: 'LCB', x: 15, y: 30}, {role: 'RCB', x: 15, y: 70}, {role: 'LCM', x: 26, y: 30}, {role: 'RCM', x: 26, y: 70}, {role: 'LST', x: 40, y: 35}, {role: 'RST', x: 40, y: 65}], links: [['GK', 'LCB'], ['GK', 'RCB'], ['LCB', 'RCB'], ['LCB', 'LCM'], ['RCB', 'RCM'], ['LCM', 'RCM'], ['LCM', 'LST'], ['LCM', 'RST'], ['RCM', 'LST'], ['RCM', 'RST'], ['LST', 'RST']] },
    { id: '1-3-2', name: 'Ultra Ofensiva (1-3-2)', pos: [{role: 'GK', x: 4, y: 50}, {role: 'CB', x: 15, y: 50}, {role: 'LM', x: 26, y: 20}, {role: 'CM', x: 26, y: 50}, {role: 'RM', x: 26, y: 80}, {role: 'LST', x: 40, y: 35}, {role: 'RST', x: 40, y: 65}], links: [['GK', 'CB'], ['CB', 'LM'], ['CB', 'CM'], ['CB', 'RM'], ['LM', 'CM'], ['CM', 'RM'], ['LM', 'LST'], ['CM', 'LST'], ['CM', 'RST'], ['RM', 'RST'], ['LST', 'RST']] },
    { id: '3-1-2', name: 'Contraataque (3-1-2)', pos: [{role: 'GK', x: 4, y: 50}, {role: 'LB', x: 15, y: 20}, {role: 'CB', x: 12, y: 50}, {role: 'RB', x: 15, y: 80}, {role: 'CDM', x: 26, y: 50}, {role: 'LST', x: 40, y: 35}, {role: 'RST', x: 40, y: 65}], links: [['GK', 'LB'], ['GK', 'CB'], ['GK', 'RB'], ['LB', 'CB'], ['CB', 'RB'], ['LB', 'CDM'], ['CB', 'CDM'], ['RB', 'CDM'], ['CDM', 'LST'], ['CDM', 'RST'], ['LST', 'RST']] }
  ],
  11: [
    { id: '4-4-2', name: '4-4-2 Clásico', pos: [{role: 'GK', x: 6, y: 50}, {role: 'LB', x: 18, y: 15}, {role: 'LCB', x: 16, y: 35}, {role: 'RCB', x: 16, y: 65}, {role: 'RB', x: 18, y: 85}, {role: 'LM', x: 30, y: 15}, {role: 'LCM', x: 26, y: 35}, {role: 'RCM', x: 26, y: 65}, {role: 'RM', x: 30, y: 85}, {role: 'LST', x: 44, y: 35}, {role: 'RST', x: 44, y: 65}], links: [['GK', 'LCB'], ['GK', 'RCB'], ['LB', 'LCB'], ['LCB', 'RCB'], ['RCB', 'RB'], ['LB', 'LM'], ['LCB', 'LCM'], ['RCB', 'RCM'], ['RB', 'RM'], ['LM', 'LCM'], ['LCM', 'RCM'], ['RCM', 'RM'], ['LCM', 'LST'], ['RCM', 'RST'], ['LM', 'LST'], ['RM', 'RST'], ['LST', 'RST']] },
    { id: '4-3-3', name: '4-3-3 Ofensivo', pos: [{role: 'GK', x: 6, y: 50}, {role: 'LB', x: 18, y: 15}, {role: 'LCB', x: 16, y: 35}, {role: 'RCB', x: 16, y: 65}, {role: 'RB', x: 18, y: 85}, {role: 'CDM', x: 24, y: 50}, {role: 'LCM', x: 30, y: 25}, {role: 'RCM', x: 30, y: 75}, {role: 'LW', x: 40, y: 15}, {role: 'ST', x: 44, y: 50}, {role: 'RW', x: 40, y: 85}], links: [['GK', 'LCB'], ['GK', 'RCB'], ['LB', 'LCB'], ['LCB', 'RCB'], ['RCB', 'RB'], ['LCB', 'CDM'], ['RCB', 'CDM'], ['LB', 'LCM'], ['RB', 'RCM'], ['CDM', 'LCM'], ['CDM', 'RCM'], ['LCM', 'LW'], ['RCM', 'RW'], ['LCM', 'ST'], ['RCM', 'ST'], ['LW', 'ST'], ['RW', 'ST']] },
    { id: '4-2-3-1', name: '4-2-3-1 Moderno', pos: [{role: 'GK', x: 6, y: 50}, {role: 'LB', x: 18, y: 15}, {role: 'LCB', x: 16, y: 35}, {role: 'RCB', x: 16, y: 65}, {role: 'RB', x: 18, y: 85}, {role: 'LDM', x: 24, y: 35}, {role: 'RDM', x: 24, y: 65}, {role: 'LM', x: 34, y: 20}, {role: 'CAM', x: 36, y: 50}, {role: 'RM', x: 34, y: 80}, {role: 'ST', x: 45, y: 50}], links: [['GK', 'LCB'], ['GK', 'RCB'], ['LB', 'LCB'], ['LCB', 'RCB'], ['RCB', 'RB'], ['LCB', 'LDM'], ['RCB', 'RDM'], ['LB', 'LDM'], ['RB', 'RDM'], ['LDM', 'RDM'], ['LDM', 'LM'], ['LDM', 'CAM'], ['RDM', 'CAM'], ['RDM', 'RM'], ['LM', 'CAM'], ['RM', 'CAM'], ['LM', 'ST'], ['CAM', 'ST'], ['RM', 'ST']] },
    { id: '3-5-2', name: '3-5-2 Carrileros', pos: [{role: 'GK', x: 6, y: 50}, {role: 'LCB', x: 18, y: 25}, {role: 'CB', x: 16, y: 50}, {role: 'RCB', x: 18, y: 75}, {role: 'LWB', x: 26, y: 12}, {role: 'CDM', x: 24, y: 50}, {role: 'LCM', x: 30, y: 30}, {role: 'RCM', x: 30, y: 70}, {role: 'RWB', x: 26, y: 88}, {role: 'LST', x: 44, y: 35}, {role: 'RST', x: 44, y: 65}], links: [['GK', 'LCB'], ['GK', 'CB'], ['GK', 'RCB'], ['LCB', 'CB'], ['CB', 'RCB'], ['LCB', 'LWB'], ['LCB', 'LCM'], ['CB', 'CDM'], ['RCB', 'RCM'], ['RCB', 'RWB'], ['CDM', 'LCM'], ['CDM', 'RCM'], ['LWB', 'LCM'], ['RWB', 'RCM'], ['LCM', 'LST'], ['RCM', 'RST'], ['LST', 'RST'], ['LCM', 'RST'], ['RCM', 'LST']] },
    { id: '5-3-2', name: '5-3-2 Defensivo', pos: [{role: 'GK', x: 6, y: 50}, {role: 'LWB', x: 20, y: 12}, {role: 'LCB', x: 16, y: 30}, {role: 'CB', x: 14, y: 50}, {role: 'RCB', x: 16, y: 70}, {role: 'RWB', x: 20, y: 88}, {role: 'LCM', x: 28, y: 25}, {role: 'CM', x: 26, y: 50}, {role: 'RCM', x: 28, y: 75}, {role: 'LST', x: 44, y: 35}, {role: 'RST', x: 44, y: 65}], links: [['GK', 'LCB'], ['GK', 'CB'], ['GK', 'RCB'], ['LWB', 'LCB'], ['LCB', 'CB'], ['CB', 'RCB'], ['RCB', 'RWB'], ['LCB', 'LCM'], ['CB', 'CM'], ['RCB', 'RCM'], ['LCM', 'CM'], ['CM', 'RCM'], ['LWB', 'LCM'], ['RWB', 'RCM'], ['LCM', 'LST'], ['CM', 'LST'], ['CM', 'RST'], ['RCM', 'RST'], ['LST', 'RST']] },
    { id: '4-4-2-rombo', name: '4-4-2 Rombo', pos: [{role: 'GK', x: 6, y: 50}, {role: 'LB', x: 18, y: 15}, {role: 'LCB', x: 16, y: 35}, {role: 'RCB', x: 16, y: 65}, {role: 'RB', x: 18, y: 85}, {role: 'CDM', x: 22, y: 50}, {role: 'LM', x: 28, y: 25}, {role: 'RM', x: 28, y: 75}, {role: 'CAM', x: 36, y: 50}, {role: 'LST', x: 44, y: 35}, {role: 'RST', x: 44, y: 65}], links: [['GK', 'LCB'], ['GK', 'RCB'], ['LB', 'LCB'], ['LCB', 'RCB'], ['RCB', 'RB'], ['LCB', 'CDM'], ['RCB', 'CDM'], ['LB', 'LM'], ['RB', 'RM'], ['CDM', 'LM'], ['CDM', 'RM'], ['LM', 'CAM'], ['RM', 'CAM'], ['CAM', 'LST'], ['CAM', 'RST'], ['LST', 'RST'], ['LM', 'LST'], ['RM', 'RST']] },
    { id: '3-4-3', name: '3-4-3 Ofensivo', pos: [{role: 'GK', x: 6, y: 50}, {role: 'LCB', x: 18, y: 25}, {role: 'CB', x: 16, y: 50}, {role: 'RCB', x: 18, y: 75}, {role: 'LM', x: 26, y: 15}, {role: 'LCM', x: 24, y: 35}, {role: 'RCM', x: 24, y: 65}, {role: 'RM', x: 26, y: 85}, {role: 'LW', x: 40, y: 20}, {role: 'ST', x: 44, y: 50}, {role: 'RW', x: 40, y: 80}], links: [['GK', 'LCB'], ['GK', 'CB'], ['GK', 'RCB'], ['LCB', 'CB'], ['CB', 'RCB'], ['LCB', 'LM'], ['LCB', 'LCM'], ['CB', 'LCM'], ['CB', 'RCM'], ['RCB', 'RCM'], ['RCB', 'RM'], ['LM', 'LCM'], ['LCM', 'RCM'], ['RCM', 'RM'], ['LM', 'LW'], ['LCM', 'LW'], ['LCM', 'ST'], ['RCM', 'ST'], ['RCM', 'RW'], ['RM', 'RW'], ['LW', 'ST'], ['ST', 'RW']] },
    { id: '4-1-4-1', name: '4-1-4-1 Posesión', pos: [{role: 'GK', x: 6, y: 50}, {role: 'LB', x: 18, y: 15}, {role: 'LCB', x: 16, y: 35}, {role: 'RCB', x: 16, y: 65}, {role: 'RB', x: 18, y: 85}, {role: 'CDM', x: 22, y: 50}, {role: 'LM', x: 32, y: 15}, {role: 'LCM', x: 30, y: 35}, {role: 'RCM', x: 30, y: 65}, {role: 'RM', x: 32, y: 85}, {role: 'ST', x: 45, y: 50}], links: [['GK', 'LCB'], ['GK', 'RCB'], ['LB', 'LCB'], ['LCB', 'RCB'], ['RCB', 'RB'], ['LCB', 'CDM'], ['RCB', 'CDM'], ['LB', 'LM'], ['CDM', 'LCM'], ['CDM', 'RCM'], ['RB', 'RM'], ['LM', 'LCM'], ['LCM', 'RCM'], ['RCM', 'RM'], ['LM', 'ST'], ['LCM', 'ST'], ['RCM', 'ST'], ['RM', 'ST']] }
  ]
};

function getFormationsForSize(size: number): Formation[] {
  if (FORMATIONS[size]) return FORMATIONS[size];
  const genericCoords = Array.from({length: size}).map((_, i) => ({ role: `P${i+1}`, x: 10 + (Math.random() * 30), y: 10 + (Math.random() * 80) }));
  return [{ id: 'generic', name: `Genérica (${size}v${size})`, pos: genericCoords, links: [] }];
}

export function TacticalBoard({ players, teamSize, pairMap, fillBestBalance, onComplete, onBack, isPadel }: TacticalBoardProps) {
  const { t } = useTranslation();
  const formations = getFormationsForSize(teamSize);
  
  const [fmtA, setFmtA] = useState(formations[0].id);
  const [fmtB, setFmtB] = useState(formations[0].id);
  
  const formationA = formations.find(f => f.id === fmtA) || formations[0];
  const formationB = formations.find(f => f.id === fmtB) || formations[0];

  // Team Design Config
  const [colorA1, setColorA1] = useState('#10b981'); // Emerald
  const [colorA2, setColorA2] = useState('#059669');
  const [patA, setPatA] = useState<JerseyPattern>('solid');

  const [colorB1, setColorB1] = useState('#3b82f6'); // Blue
  const [colorB2, setColorB2] = useState('#2563eb');
  const [patB, setPatB] = useState<JerseyPattern>('solid');

  const [locations, setLocations] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    players.forEach(p => { init[p.player.id] = 'pool'; });
    return init;
  });

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [swapSelected, setSwapSelected] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 }}));

  const handleSwapClick = useCallback((playerId: string) => {
    if (!swapSelected) {
      setSwapSelected(playerId);
      return;
    }
    if (swapSelected === playerId) { setSwapSelected(null); return; }
    setLocations(prev => {
      const next = { ...prev };
      const locA = next[swapSelected];
      const locB = next[playerId];
      next[swapSelected] = locB;
      next[playerId] = locA;
      return next;
    });
    setSwapSelected(null);
  }, [swapSelected]);


  const handleDragStart = (e: DragStartEvent) => { setActiveDragId(e.active.id as string); };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over) return;
    const playerId = active.id as string;
    const targetLoc = over.id as string;

    setLocations(prev => {
      if (prev[playerId] === targetLoc) return prev;
      const next = { ...prev };
      
      if (targetLoc !== 'pool') {
        const existingPlayerId = Object.keys(next).find(id => next[id] === targetLoc);
        const sourceLoc = next[playerId];
        if (existingPlayerId) {
          next[existingPlayerId] = sourceLoc; // Swap
        }
      }
      next[playerId] = targetLoc;
      return next;
    });
  };

  const handleAiCompletion = () => {
    const lockedA: PlayerStats[] = [];
    const lockedB: PlayerStats[] = [];
    const unass: PlayerStats[] = [];

    players.forEach(p => {
      const loc = locations[p.player.id];
      if (loc.startsWith('teamA')) lockedA.push(p);
      else if (loc.startsWith('teamB')) lockedB.push(p);
      else unass.push(p);
    });

    const { teamA, teamB } = fillBestBalance(lockedA, lockedB, unass, pairMap, teamSize);
    const nextLoc = { ...locations };
    
    const fillLocs = (team: PlayerStats[], prefix: string) => {
      const existingLocs = new Set(team.map(p => nextLoc[p.player.id]).filter(l => l.startsWith(prefix)));
      const newPlayers = team.filter(p => !nextLoc[p.player.id].startsWith(prefix));
      let slotIdx = 0;
      newPlayers.forEach(p => {
        while (existingLocs.has(`${prefix}-${slotIdx}`)) slotIdx++;
        nextLoc[p.player.id] = `${prefix}-${slotIdx}`;
        existingLocs.add(`${prefix}-${slotIdx}`);
      });
    };

    fillLocs(teamA, 'teamA');
    fillLocs(teamB, 'teamB');
    setLocations(nextLoc);
  };

  const formedA = players.filter(p => locations[p.player.id].startsWith('teamA'));
  const formedB = players.filter(p => locations[p.player.id].startsWith('teamB'));
  const isComplete = formedA.length === teamSize && formedB.length === teamSize;

  // Chemistry: players in each slot (for ChemistryLines)
  const assignmentsA = formationA.pos.map((_, i) => players.find(p => locations[p.player.id] === `teamA-${i}`));
  const assignmentsB = formationB.pos.map((_, i) => players.find(p => locations[p.player.id] === `teamB-${i}`));

  const poolPlayers = players.filter(p => locations[p.player.id] === 'pool');
  const activeDragPlayer = activeDragId ? players.find(p => p.player.id === activeDragId) : null;
  const activeTeamContext = activeDragPlayer ? (locations[activeDragPlayer.player.id].startsWith('teamA') ? 'A' : locations[activeDragPlayer.player.id].startsWith('teamB') ? 'B' : null) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.boardContainer}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} className={styles.backBtn}>{t('teamSimulator.back')}</button>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
             {!isComplete && (
               <button onClick={handleAiCompletion} className={styles.aiBtn}>{t('tacticalBoard.aiFill')}</button>
             )}
             <button onClick={() => {
                const init: Record<string, string> = {};
                players.forEach(p => { init[p.player.id] = 'pool'; });
                setLocations(init);
             }} className={styles.clearBtn}>{t('tacticalBoard.clearAll')}</button>
          </div>
        </div>

        {/* Configuration Bars */}
        <div className={styles.configRows}>
           <div className={styles.teamConfigBar} style={{ borderLeftColor: colorA1 }}>
              <span className={styles.teamConfigLabel}>{t('tacticalBoard.teamA')}</span>
              <select className={styles.configSelect} value={fmtA} onChange={e=>setFmtA(e.target.value)}>
                {formations.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <input type="color" value={colorA1} onChange={e=>setColorA1(e.target.value)} title="Color Principal" className={styles.colorPicker}/>
              <input type="color" value={colorA2} onChange={e=>setColorA2(e.target.value)} title="Color Secundario" className={styles.colorPicker}/>
              <select className={styles.configSelect} value={patA} onChange={e=>setPatA(e.target.value as JerseyPattern)}>
                <option value="solid">{t('tacticalBoard.patterns.solid')}</option>
                <option value="stripes">{t('tacticalBoard.patterns.stripes')}</option>
                <option value="hoops">{t('tacticalBoard.patterns.hoops')}</option>
                <option value="halves">{t('tacticalBoard.patterns.halves')}</option>
                <option value="chevron">{t('tacticalBoard.patterns.chevron')}</option>
                <option value="sash">{t('tacticalBoard.patterns.sash')}</option>
                <option value="band">{t('tacticalBoard.patterns.band')}</option>
              </select>
           </div>
           
           <div className={styles.teamConfigBar} style={{ borderLeftColor: colorB1 }}>
              <span className={styles.teamConfigLabel}>{t('tacticalBoard.teamB')}</span>
              <select className={styles.configSelect} value={fmtB} onChange={e=>setFmtB(e.target.value)}>
                {formations.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <input type="color" value={colorB1} onChange={e=>setColorB1(e.target.value)} title="Color Principal" className={styles.colorPicker}/>
              <input type="color" value={colorB2} onChange={e=>setColorB2(e.target.value)} title="Color Secundario" className={styles.colorPicker}/>
              <select className={styles.configSelect} value={patB} onChange={e=>setPatB(e.target.value as JerseyPattern)}>
                <option value="solid">{t('tacticalBoard.patterns.solid')}</option>
                <option value="stripes">{t('tacticalBoard.patterns.stripes')}</option>
                <option value="hoops">{t('tacticalBoard.patterns.hoops')}</option>
                <option value="halves">{t('tacticalBoard.patterns.halves')}</option>
                <option value="chevron">{t('tacticalBoard.patterns.chevron')}</option>
                <option value="sash">{t('tacticalBoard.patterns.sash')}</option>
                <option value="band">{t('tacticalBoard.patterns.band')}</option>
              </select>
           </div>
        </div>

        {/* Real-time comparison panel */}
        <ComparisonPanel
          formedA={formedA}
          formedB={formedB}
          teamSize={teamSize}
          colorA={colorA1}
          colorB={colorB1}
        />

        {/* Pitch Area */}
        <div className={`${styles.pitchWrapper} ${isPadel ? styles.padelCourtWrapper : ''}`}>
          {!isPadel && <div className={styles.grassTexture} />}

          {isPadel ? (
            <>
              <div className={styles.padelServiceLineLeft} />
              <div className={styles.padelServiceLineRight} />
              <div className={styles.padelCenterLineLeft} />
              <div className={styles.padelCenterLineRight} />
              <div className={styles.padelNet} />
            </>
          ) : (
            <>
              <div className={styles.lineCenter} />
              <div className={styles.lineCircle} />
              <div className={styles.centerSpot} />
              <div className={styles.penaltyAreaLeft} />
              <div className={styles.penaltyAreaRight} />
              <div className={styles.smallAreaLeft} />
              <div className={styles.smallAreaRight} />
              <div className={styles.penaltySpotLeft} />
              <div className={styles.penaltySpotRight} />
            </>
          )}

          {/* Formation lines SVG overlay */}
          <FormationLines formation={formationA} color={colorA1} />
          <FormationLines formation={formationB} color={colorB1} mirrorX />
          {/* Chemistry glow lines */}
          <ChemistryLines formation={formationA} assignments={assignmentsA} pairMap={pairMap} />
          <ChemistryLines formation={formationB} assignments={assignmentsB} pairMap={pairMap} mirrorX />

          {/* Render Slots Map */}
          {formationA.pos.map((coord, i) => {
             const locId = `teamA-${i}`;
             const ply = players.find(p => locations[p.player.id] === locId);
             return <PitchSlot key={locId} id={locId} x={coord.x} y={coord.y} player={ply}
                       teamColor1={colorA1} teamColor2={colorA2} teamPattern={patA}
                       role={coord.role} depthX={coord.x} swapSelected={swapSelected} onSwapClick={handleSwapClick} />;
          })}
          {formationB.pos.map((coord, i) => {
             const locId = `teamB-${i}`;
             const mirroredX = 100 - coord.x;
             const mirroredY = 100 - coord.y;
             const ply = players.find(p => locations[p.player.id] === locId);
             return <PitchSlot key={locId} id={locId} x={mirroredX} y={mirroredY} player={ply}
                       teamColor1={colorB1} teamColor2={colorB2} teamPattern={patB}
                       role={coord.role} depthX={coord.x} swapSelected={swapSelected} onSwapClick={handleSwapClick} />;
          })}

          {/* Pitch legend */}
          <div className={styles.pitchLegend}>
            <div className={styles.legendItem}>
              <div className={styles.legendLineDashed} />
              <span>Formación</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendLineGold} style={{ background: '#10b981' }} />
              <span>Química alta</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendLineGold} style={{ background: '#f59e0b' }} />
              <span>Química media</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendLineGold} style={{ background: '#ef4444' }} />
              <span>Química baja</span>
            </div>
          </div>

        </div>


        {/* Bench / Pool Area */}
        <DroppablePool id="pool">
           <div className={styles.benchTitle}>{t('tacticalBoard.pool').replace('{{count}}', poolPlayers.length.toString())}</div>
           <div className={styles.benchGrid}>
             {poolPlayers.map(p => (
               <DraggableBenchCard key={p.player.id} player={p} />
             ))}
             {poolPlayers.length === 0 && <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('tacticalBoard.allAssigned')}</span>}
           </div>
        </DroppablePool>

        <div className={styles.completionRow}>
           <button onClick={() => { 
             if(isComplete) {
               onComplete(formedA, formedB, {
                 locations, fmtA, fmtB, colorA1, colorA2, patA, colorB1, colorB2, patB, teamSize
               });
             }
           }} disabled={!isComplete}
             className={`${styles.generateBtn} ${isComplete ? styles.generateBtnReady : ''}`}>
             {t('tacticalBoard.analyze')}
           </button>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragPlayer ? (
          <div className={styles.dragOverlay}>
            <JerseySVG 
              primaryColor={activeTeamContext === 'A' ? colorA1 : activeTeamContext === 'B' ? colorB1 : '#475569'}
              secondaryColor={activeTeamContext === 'A' ? colorA2 : activeTeamContext === 'B' ? colorB2 : '#1e293b'}
              pattern={activeTeamContext === 'A' ? patA : activeTeamContext === 'B' ? patB : 'solid'}
              width={56} height={56}
            />
            <div className={styles.overlayName}>{activeDragPlayer.player.name.split(' ')[0]}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function PitchSlot({ id, x, y, player, teamColor1, teamColor2, teamPattern, readOnly = false, role, depthX, swapSelected, onSwapClick }: {
  id: string; x: number; y: number; player?: PlayerStats;
  teamColor1: string; teamColor2: string; teamPattern: JerseyPattern;
  readOnly?: boolean;
  role?: string;
  depthX?: number;
  swapSelected?: string | null;
  onSwapClick?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: readOnly });

  // Position label based on role or depth fallback
  const posLabel = !player && !readOnly 
    ? (role || (depthX !== undefined ? (depthX <= 10 ? 'GK' : depthX <= 22 ? 'DEF' : depthX <= 35 ? 'MID' : 'FWD') : null))
    : null;

  return (
    <div ref={setNodeRef} className={`${styles.slot} ${isOver ? styles.slotOver : ''} ${readOnly ? styles.slotReadOnly : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
      {player ? (
         <DraggableToken player={player} c1={teamColor1} c2={teamColor2} pat={teamPattern} readOnly={readOnly}
           isSwapSelected={swapSelected === player.player.id}
           onSwapClick={onSwapClick} />
      ) : (
         posLabel
           ? <span className={styles.slotPosLabel}>{posLabel}</span>
           : null
      )}
    </div>
  );
}

function DraggableToken({ player, c1, c2, pat, readOnly = false, isSwapSelected = false, onSwapClick }: {
  player: PlayerStats; c1: string; c2: string; pat: JerseyPattern;
  readOnly?: boolean; isSwapSelected?: boolean;
  onSwapClick?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: player.player.id, disabled: readOnly });
  const ratingColor = player.winPercentage >= 60 ? '#10b981' : player.winPercentage >= 40 ? '#f59e0b' : '#ef4444';

  const handleClick = (e: React.MouseEvent) => {
    if (!readOnly && onSwapClick) { e.stopPropagation(); onSwapClick(player.player.id); }
  };

  return (
    <div
      ref={setNodeRef} {...(readOnly ? {} : listeners)} {...(readOnly ? {} : attributes)}
      className={`${styles.playerTokenWrapper} ${isDragging ? styles.tokenDragging : ''} ${readOnly ? styles.tokenReadOnly : ''} ${isSwapSelected ? styles.tokenSwapSelected : ''}`}
      onClick={handleClick}
    >
      {!readOnly && (
        <div className={styles.hoverTooltip}>
          <span className={styles.hoverTooltipStat}>{player.winPercentage.toFixed(0)}% win</span>
          <span>{player.matchesPlayed} PJ</span>
        </div>
      )}
      <JerseySVG primaryColor={c1} secondaryColor={c2} pattern={pat} width={48} height={48} />
      <div className={styles.jerseyLabel}>
        <span className={styles.jerseyName}>{player.player.name}</span>
        <span className={styles.jerseyStat} style={{ color: ratingColor }}>{player.winPercentage.toFixed(0)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// READ ONLY RENDERER FOR RESULTS SECTION
// ─────────────────────────────────────────────────────────────────────────────
export function FinalPitchRenderer({ players, config, isPadel }: { players: PlayerStats[], config: TacticalConfig, isPadel?: boolean }) {
  const formations = getFormationsForSize(config.teamSize);
  const formationA = formations.find(f => f.id === config.fmtA) || formations[0];
  const formationB = formations.find(f => f.id === config.fmtB) || formations[0];

  return (
    <div className={`${styles.pitchWrapper} ${isPadel ? styles.padelCourtWrapper : ''}`} style={{ maxWidth: '800px', marginBottom: '2rem' }}>
      {!isPadel && <div className={styles.grassTexture} />}

      {isPadel ? (
        <>
          <div className={styles.padelServiceLineLeft} />
          <div className={styles.padelServiceLineRight} />
          <div className={styles.padelCenterLineLeft} />
          <div className={styles.padelCenterLineRight} />
          <div className={styles.padelNet} />
        </>
      ) : (
        <>
          <div className={styles.lineCenter} />
          <div className={styles.lineCircle} />
          <div className={styles.centerSpot} />
          <div className={styles.penaltyAreaLeft} />
          <div className={styles.penaltyAreaRight} />
          <div className={styles.smallAreaLeft} />
          <div className={styles.smallAreaRight} />
          <div className={styles.penaltySpotLeft} />
          <div className={styles.penaltySpotRight} />
        </>
      )}

      {/* Formation lines */}
      <FormationLines formation={formationA} color={config.colorA1} />
      <FormationLines formation={formationB} color={config.colorB1} mirrorX />

      {formationA.pos.map((coord, i) => {
         const locId = `teamA-${i}`;
         const ply = players.find(p => config.locations[p.player.id] === locId);
         return <PitchSlot key={locId} id={locId} x={coord.x} y={coord.y} player={ply}
                   teamColor1={config.colorA1} teamColor2={config.colorA2} teamPattern={config.patA} readOnly={true} role={coord.role} />;
      })}
      {formationB.pos.map((coord, i) => {
         const locId = `teamB-${i}`;
         const mirroredX = 100 - coord.x;
         const mirroredY = 100 - coord.y;
         const ply = players.find(p => config.locations[p.player.id] === locId);
         return <PitchSlot key={locId} id={locId} x={mirroredX} y={mirroredY} player={ply}
                   teamColor1={config.colorB1} teamColor2={config.colorB2} teamPattern={config.patB} readOnly={true} role={coord.role} />;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATION LINES — SVG overlay connecting players by proximity
// ─────────────────────────────────────────────────────────────────────────────
function FormationLines({ formation, color, mirrorX = false }: {
  formation: Formation;
  color: string;
  mirrorX?: boolean;
}) {
  if (!formation.links || formation.links.length === 0) return null;

  // Creamos un mapa de roles a coordenadas finales
  const roleToPos = new Map<string, {x: number, y: number}>();
  formation.pos.forEach(p => {
    roleToPos.set(p.role, { x: mirrorX ? 100 - p.x : p.x, y: mirrorX ? 100 - p.y : p.y });
  });

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
      {formation.links.map(([roleA, roleB], idx) => {
        const pA = roleToPos.get(roleA);
        const pB = roleToPos.get(roleB);
        if (!pA || !pB) return null;
        return (
          <line
            key={idx}
            x1={`${pA.x}%`} y1={`${pA.y}%`}
            x2={`${pB.x}%`} y2={`${pB.y}%`}
            stroke={color} strokeWidth="1.5" strokeOpacity="0.28" strokeDasharray="5 4"
          />
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHEMISTRY LINES — gold solid lines between players with >70% win rate together
// ─────────────────────────────────────────────────────────────────────────────
function ChemistryLines({ formation, assignments, pairMap, mirrorX = false }: {
  formation: Formation;
  assignments: (PlayerStats | undefined)[];
  pairMap: Map<string, PairStats>;
  mirrorX?: boolean;
}) {
  if (!formation.links || formation.links.length === 0) return null;

  const pts = formation.pos.map(p => ({ role: p.role, x: mirrorX ? 100 - p.x : p.x, y: mirrorX ? 100 - p.y : p.y }));
  
  const roleToIndex = new Map<string, number>();
  formation.pos.forEach((p, idx) => {
    roleToIndex.set(p.role, idx);
  });

  const lines: { pA: {x: number, y: number}; pB: {x: number, y: number}; color: string; filter?: string; strokeWidth: string; strokeOpacity: string }[] = [];

  for (const [roleA, roleB] of formation.links) {
    const idxA = roleToIndex.get(roleA);
    const idxB = roleToIndex.get(roleB);
    if (idxA === undefined || idxB === undefined) continue;

    const pA_assig = assignments[idxA];
    const pB_assig = assignments[idxB];
    if (!pA_assig || !pB_assig) continue;

    const k = pA_assig.player.id < pB_assig.player.id 
      ? `${pA_assig.player.id}::${pB_assig.player.id}` 
      : `${pB_assig.player.id}::${pA_assig.player.id}`;
      
    const pair = pairMap.get(k);
    if (!pair || pair.togetherTotal < 2) continue;
    
    const pct = pair.togetherWinPct;
    const color = pct >= 65 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
    const filter = pct >= 65 ? 'url(#glow-green)' : pct >= 40 ? 'url(#glow-gold)' : undefined;
    const strokeWidth = pct >= 65 ? "2.5" : pct >= 40 ? "2" : "1.5";
    const strokeOpacity = pct >= 65 ? "0.9" : pct >= 40 ? "0.8" : "0.5";
    
    lines.push({
      pA: pts[idxA],
      pB: pts[idxB],
      color,
      filter,
      strokeWidth,
      strokeOpacity
    });
  }

  if (lines.length === 0) return null;

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
      <defs>
        <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {lines.map(({ pA, pB, color, filter, strokeWidth, strokeOpacity }, idx) => (
        <line key={idx}
          x1={`${pA.x}%`} y1={`${pA.y}%`}
          x2={`${pB.x}%`} y2={`${pB.y}%`}
          stroke={color} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity}
          filter={filter} strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPARISON PANEL — real-time team stats while building
// ─────────────────────────────────────────────────────────────────────────────
function ComparisonPanel({ formedA, formedB, teamSize, colorA, colorB }: {
  formedA: PlayerStats[]; formedB: PlayerStats[];
  teamSize: number; colorA: string; colorB: string;
}) {
  const avgA = formedA.length > 0 ? formedA.reduce((s, p) => s + p.winPercentage, 0) / formedA.length : 0;
  const avgB = formedB.length > 0 ? formedB.reduce((s, p) => s + p.winPercentage, 0) / formedB.length : 0;
  const total = avgA + avgB || 1;
  const aWidth = (avgA / total) * 100;
  const progA = formedA.length / teamSize;
  const progB = formedB.length / teamSize;
  const imbalanced = formedA.length === teamSize && formedB.length === teamSize && Math.abs(avgA - avgB) > 15;
  const stronger = avgA > avgB ? 'A' : 'B';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', maxWidth: '900px', margin: '0 auto', width: '100%', gap: '0.4rem' }}>
      <div className={styles.comparisonPanel}>
        {/* Team A */}
        <div className={styles.compSide}>
          <span className={styles.compTeamLabel} style={{ color: colorA }}>{formedA.length}/{teamSize}</span>
          <div className={styles.compStat}>
            <span className={styles.compStatValue}>{avgA.toFixed(0)}%</span>
            <span className={styles.compStatLabel}>win</span>
          </div>
          <div className={styles.compProgressTrack}>
            <div className={styles.compProgressFill} style={{ width: `${progA * 100}%`, background: colorA }} />
          </div>
        </div>

        {/* Center — win probability */}
        <div className={styles.compCenter}>
          <div className={styles.compDualBar}>
            <div className={styles.compDualBarA} style={{ width: `${aWidth}%`, background: colorA }} />
            <div className={styles.compDualBarB} style={{ width: `${100 - aWidth}%`, background: colorB }} />
          </div>
          <span className={styles.compVsText}>VS</span>
          {formedA.length === teamSize && formedB.length === teamSize && (
            <span className={styles.winProbLabel}>{aWidth.toFixed(0)}% · {(100 - aWidth).toFixed(0)}%</span>
          )}
        </div>

        {/* Team B */}
        <div className={`${styles.compSide} ${styles.compSideRight}`}>
          <span className={styles.compTeamLabel} style={{ color: colorB }}>{formedB.length}/{teamSize}</span>
          <div className={styles.compStat}>
            <span className={styles.compStatValue}>{avgB.toFixed(0)}%</span>
            <span className={styles.compStatLabel}>win</span>
          </div>
          <div className={styles.compProgressTrack}>
            <div className={styles.compProgressFill} style={{ width: `${progB * 100}%`, background: colorB }} />
          </div>
        </div>
      </div>

      {imbalanced && (
        <div className={styles.imbalanceWarning}>
          ⚠️ Equipo {stronger} tiene ventaja significativa ({Math.abs(avgA - avgB).toFixed(0)}% de diferencia). Considerá redistribuir.
        </div>
      )}
    </div>
  );
}

function DroppablePool({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={styles.benchContainer} style={{ background: isOver ? 'rgba(30, 41, 59, 0.8)' : undefined }}>
      {children}
    </div>
  );
}

function DraggableBenchCard({ player }: { player: PlayerStats }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: player.player.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`${styles.benchCardWrapper} ${isDragging ? styles.benchCardDragging : ''}`}>
      <div className={styles.benchCard}>
        <span>{player.player.name}</span>
        <span className={styles.benchCardStat}>{player.winPercentage.toFixed(0)}%</span>
      </div>
    </div>
  );
}
