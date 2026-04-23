"use client";

import React, { useState, useMemo } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  DragStartEvent, DragEndEvent
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { PlayerStats } from '@/types';
import styles from './TacticalBoard.module.css';
import { JerseySVG, JerseyPattern } from './JerseySVG';

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
}

interface Formation {
  id: string; name: string;
  pos: {x: number, y: number}[]; // Left half relative coords (x: 0-50%)
}

const FORMATIONS: Record<number, Formation[]> = {
  2: [
    { id: 'paralela', name: 'Paralela', pos: [{x: 25, y: 30}, {x: 25, y: 70}] },
    { id: '1v1', name: 'Australiana', pos: [{x: 10, y: 50}, {x: 35, y: 50}] }
  ],
  5: [
    { id: '1-2-1', name: 'Rombo (1-2-1)', pos: [{x: 8, y: 50}, {x: 20, y: 50}, {x: 32, y: 23}, {x: 32, y: 77}, {x: 45, y: 50}] },
    { id: '2-2', name: 'Cuadrado (2-2)', pos: [{x: 8, y: 50}, {x: 22, y: 25}, {x: 22, y: 75}, {x: 40, y: 25}, {x: 40, y: 75}] },
    { id: '1-3', name: 'Ofensiva (1-3)', pos: [{x: 8, y: 50}, {x: 20, y: 50}, {x: 40, y: 15}, {x: 44, y: 50}, {x: 40, y: 85}] },
    { id: '3-1', name: 'Muro defensivo (3-1)', pos: [{x: 8, y: 50}, {x: 25, y: 15}, {x: 25, y: 50}, {x: 25, y: 85}, {x: 42, y: 50}] }
  ],
  7: [
    { id: '2-3-1', name: 'Equilibrada (2-3-1)', pos: [{x: 4, y: 50}, {x: 15, y: 30}, {x: 15, y: 70}, {x: 28, y: 20}, {x: 25, y: 50}, {x: 28, y: 80}, {x: 40, y: 50}] },
    { id: '3-2-1', name: 'Defensiva (3-2-1)', pos: [{x: 4, y: 50}, {x: 15, y: 20}, {x: 12, y: 50}, {x: 15, y: 80}, {x: 28, y: 35}, {x: 28, y: 65}, {x: 42, y: 50}] },
    { id: '2-2-2', name: 'Ofensiva (2-2-2)', pos: [{x: 4, y: 50}, {x: 15, y: 30}, {x: 15, y: 70}, {x: 26, y: 30}, {x: 26, y: 70}, {x: 40, y: 35}, {x: 40, y: 65}] },
    { id: '1-3-2', name: 'Ultra Ofensiva (1-3-2)', pos: [{x: 4, y: 50}, {x: 15, y: 50}, {x: 26, y: 20}, {x: 26, y: 50}, {x: 26, y: 80}, {x: 40, y: 35}, {x: 40, y: 65}] },
    { id: '3-1-2', name: 'Contraataque (3-1-2)', pos: [{x: 4, y: 50}, {x: 15, y: 20}, {x: 12, y: 50}, {x: 15, y: 80}, {x: 26, y: 50}, {x: 40, y: 35}, {x: 40, y: 65}] }
  ],
  11: [
    { id: '4-4-2', name: '4-4-2 Clásico', pos: [{x: 4, y: 50}, {x: 14, y: 15}, {x: 12, y: 35}, {x: 12, y: 65}, {x: 14, y: 85}, {x: 30, y: 15}, {x: 26, y: 35}, {x: 26, y: 65}, {x: 30, y: 85}, {x: 44, y: 35}, {x: 44, y: 65}] },
    { id: '4-3-3', name: '4-3-3 Ofensivo', pos: [{x: 4, y: 50}, {x: 14, y: 15}, {x: 12, y: 35}, {x: 12, y: 65}, {x: 14, y: 85}, {x: 24, y: 50}, {x: 30, y: 25}, {x: 30, y: 75}, {x: 40, y: 15}, {x: 44, y: 50}, {x: 40, y: 85}] },
    { id: '4-2-3-1', name: '4-2-3-1 Moderno', pos: [{x: 4, y: 50}, {x: 14, y: 15}, {x: 12, y: 35}, {x: 12, y: 65}, {x: 14, y: 85}, {x: 24, y: 35}, {x: 24, y: 65}, {x: 34, y: 20}, {x: 36, y: 50}, {x: 34, y: 80}, {x: 45, y: 50}] },
    { id: '3-5-2', name: '3-5-2 Carrileros', pos: [{x: 4, y: 50}, {x: 12, y: 25}, {x: 10, y: 50}, {x: 12, y: 75}, {x: 26, y: 12}, {x: 24, y: 50}, {x: 30, y: 30}, {x: 30, y: 70}, {x: 26, y: 88}, {x: 44, y: 35}, {x: 44, y: 65}] },
    { id: '5-3-2', name: '5-3-2 Defensivo', pos: [{x: 4, y: 50}, {x: 15, y: 12}, {x: 12, y: 30}, {x: 10, y: 50}, {x: 12, y: 70}, {x: 15, y: 88}, {x: 28, y: 25}, {x: 26, y: 50}, {x: 28, y: 75}, {x: 44, y: 35}, {x: 44, y: 65}] },
    { id: '4-4-2-rombo', name: '4-4-2 Rombo', pos: [{x: 4, y: 50}, {x: 14, y: 15}, {x: 12, y: 35}, {x: 12, y: 65}, {x: 14, y: 85}, {x: 22, y: 50}, {x: 28, y: 25}, {x: 28, y: 75}, {x: 36, y: 50}, {x: 44, y: 35}, {x: 44, y: 65}] },
    { id: '3-4-3', name: '3-4-3 Ofensivo', pos: [{x: 4, y: 50}, {x: 12, y: 25}, {x: 10, y: 50}, {x: 12, y: 75}, {x: 26, y: 15}, {x: 24, y: 35}, {x: 24, y: 65}, {x: 26, y: 85}, {x: 40, y: 20}, {x: 44, y: 50}, {x: 40, y: 80}] },
    { id: '4-1-4-1', name: '4-1-4-1 Posesión', pos: [{x: 4, y: 50}, {x: 14, y: 15}, {x: 12, y: 35}, {x: 12, y: 65}, {x: 14, y: 85}, {x: 22, y: 50}, {x: 32, y: 15}, {x: 30, y: 35}, {x: 30, y: 65}, {x: 32, y: 85}, {x: 45, y: 50}] }
  ]
};

function getFormationsForSize(size: number): Formation[] {
  if (FORMATIONS[size]) return FORMATIONS[size];
  const genericCoords = Array.from({length: size}).map((_, i) => ({ x: 10 + (Math.random() * 30), y: 10 + (Math.random() * 80) }));
  return [{ id: 'generic', name: `Genérica (${size}v${size})`, pos: genericCoords }];
}

export function TacticalBoard({ players, teamSize, pairMap, fillBestBalance, onComplete, onBack }: TacticalBoardProps) {
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 }}));

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

  const poolPlayers = players.filter(p => locations[p.player.id] === 'pool');
  const activeDragPlayer = activeDragId ? players.find(p => p.player.id === activeDragId) : null;
  const activeTeamContext = activeDragPlayer ? (locations[activeDragPlayer.player.id].startsWith('teamA') ? 'A' : locations[activeDragPlayer.player.id].startsWith('teamB') ? 'B' : null) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.boardContainer}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} className={styles.backBtn}>← Volver a Selección</button>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
             {!isComplete && (
               <button onClick={handleAiCompletion} className={styles.aiBtn}>🪄 Completar con IA</button>
             )}
             <button onClick={() => {
                const init: Record<string, string> = {};
                players.forEach(p => { init[p.player.id] = 'pool'; });
                setLocations(init);
             }} className={styles.clearBtn}>Limpiar Todo</button>
          </div>
        </div>

        {/* Configuration Bars */}
        <div className={styles.configRows}>
           <div className={styles.teamConfigBar} style={{ borderLeftColor: colorA1 }}>
              <span className={styles.teamConfigLabel}>Equipo A</span>
              <select className={styles.configSelect} value={fmtA} onChange={e=>setFmtA(e.target.value)}>
                {formations.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <input type="color" value={colorA1} onChange={e=>setColorA1(e.target.value)} title="Color Principal" className={styles.colorPicker}/>
              <input type="color" value={colorA2} onChange={e=>setColorA2(e.target.value)} title="Color Secundario" className={styles.colorPicker}/>
              <select className={styles.configSelect} value={patA} onChange={e=>setPatA(e.target.value as JerseyPattern)}>
                <option value="solid">Liso</option>
                <option value="stripes">Rayas Vet.</option>
                <option value="hoops">Franjas Hor.</option>
                <option value="halves">Mitades</option>
                <option value="chevron">Pico en V</option>
                <option value="sash">Banda cruzada</option>
                <option value="band">Franja ancha</option>
              </select>
           </div>
           
           <div className={styles.teamConfigBar} style={{ borderLeftColor: colorB1 }}>
              <span className={styles.teamConfigLabel}>Equipo B</span>
              <select className={styles.configSelect} value={fmtB} onChange={e=>setFmtB(e.target.value)}>
                {formations.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <input type="color" value={colorB1} onChange={e=>setColorB1(e.target.value)} title="Color Principal" className={styles.colorPicker}/>
              <input type="color" value={colorB2} onChange={e=>setColorB2(e.target.value)} title="Color Secundario" className={styles.colorPicker}/>
              <select className={styles.configSelect} value={patB} onChange={e=>setPatB(e.target.value as JerseyPattern)}>
                <option value="solid">Liso</option>
                <option value="stripes">Rayas Vet.</option>
                <option value="hoops">Franjas Hor.</option>
                <option value="halves">Mitades</option>
                <option value="chevron">Pico en V</option>
                <option value="sash">Banda cruzada</option>
                <option value="band">Franja ancha</option>
              </select>
           </div>
        </div>

        {/* Pitch Area */}
        <div className={styles.pitchWrapper}>
          <div className={styles.grassTexture} />
          <div className={styles.lineCenter} />
          <div className={styles.lineCircle} />
          <div className={styles.goalAreaLeft} />
          <div className={styles.goalAreaRight} />

          {/* Render Slots Map */}
          {formationA.pos.map((coord, i) => {
             const locId = `teamA-${i}`;
             const ply = players.find(p => locations[p.player.id] === locId);
             return <PitchSlot key={locId} id={locId} x={coord.x} y={coord.y} player={ply} 
                       teamColor1={colorA1} teamColor2={colorA2} teamPattern={patA} />;
          })}
          {formationB.pos.map((coord, i) => {
             const locId = `teamB-${i}`;
             // mirror horizontal for right side
             const mirroredX = 100 - coord.x;
             const ply = players.find(p => locations[p.player.id] === locId);
             return <PitchSlot key={locId} id={locId} x={mirroredX} y={coord.y} player={ply} 
                       teamColor1={colorB1} teamColor2={colorB2} teamPattern={patB} />;
          })}
        </div>

        {/* Bench / Pool Area */}
        <DroppablePool id="pool">
           <div className={styles.benchTitle}>BOLSA DE JUGADORES ({poolPlayers.length})</div>
           <div className={styles.benchGrid}>
             {poolPlayers.map(p => (
               <DraggableBenchCard key={p.player.id} player={p} />
             ))}
             {poolPlayers.length === 0 && <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Todos asignados en cancha.</span>}
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
             📊 Analizar Equipos Formados
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

function PitchSlot({ id, x, y, player, teamColor1, teamColor2, teamPattern, readOnly = false }: { 
  id: string; x: number; y: number; player?: PlayerStats; 
  teamColor1: string; teamColor2: string; teamPattern: JerseyPattern;
  readOnly?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: readOnly });
  
  return (
    <div ref={setNodeRef} className={`${styles.slot} ${isOver ? styles.slotOver : ''} ${readOnly ? styles.slotReadOnly : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
      {player ? (
         <DraggableToken player={player} c1={teamColor1} c2={teamColor2} pat={teamPattern} readOnly={readOnly} />
      ) : (
         !readOnly && <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.75rem', fontWeight: 'bold' }}>{id.includes('teamA') ? 'A' : 'B'}</span>
      )}
    </div>
  );
}

function DraggableToken({ player, c1, c2, pat, readOnly = false }: { player: PlayerStats; c1: string; c2: string; pat: JerseyPattern; readOnly?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: player.player.id, disabled: readOnly });
  
  return (
    <div ref={setNodeRef} {...(readOnly ? {} : listeners)} {...(readOnly ? {} : attributes)} className={`${styles.playerTokenWrapper} ${isDragging ? styles.tokenDragging : ''} ${readOnly ? styles.tokenReadOnly : ''}`}>
       <JerseySVG primaryColor={c1} secondaryColor={c2} pattern={pat} width={48} height={48} />
       <div className={styles.jerseyLabel}>
          <span className={styles.jerseyName}>{player.player.name}</span>
          <span className={styles.jerseyStat}>{player.winPercentage.toFixed(0)}</span>
       </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// READ ONLY RENDERER FOR RESULTS SECTION
// ─────────────────────────────────────────────────────────────────────────────
export function FinalPitchRenderer({ players, config }: { players: PlayerStats[], config: TacticalConfig }) {
  const formations = getFormationsForSize(config.teamSize);
  const formationA = formations.find(f => f.id === config.fmtA) || formations[0];
  const formationB = formations.find(f => f.id === config.fmtB) || formations[0];

  return (
    <div className={styles.pitchWrapper} style={{ maxWidth: '800px', marginBottom: '2rem' }}>
      <div className={styles.grassTexture} />
      <div className={styles.lineCenter} />
      <div className={styles.lineCircle} />
      <div className={styles.goalAreaLeft} />
      <div className={styles.goalAreaRight} />

      {formationA.pos.map((coord, i) => {
         const locId = `teamA-${i}`;
         const ply = players.find(p => config.locations[p.player.id] === locId);
         return <PitchSlot key={locId} id={locId} x={coord.x} y={coord.y} player={ply} 
                   teamColor1={config.colorA1} teamColor2={config.colorA2} teamPattern={config.patA} readOnly={true} />;
      })}
      {formationB.pos.map((coord, i) => {
         const locId = `teamB-${i}`;
         const mirroredX = 100 - coord.x;
         const ply = players.find(p => config.locations[p.player.id] === locId);
         return <PitchSlot key={locId} id={locId} x={mirroredX} y={coord.y} player={ply} 
                   teamColor1={config.colorB1} teamColor2={config.colorB2} teamPattern={config.patB} readOnly={true} />;
      })}
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
