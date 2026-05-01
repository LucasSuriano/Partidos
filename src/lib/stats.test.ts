import { describe, it, expect } from 'vitest';
import { calculateStats, getPlayerReport } from './stats';
import type { Player, Match } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makePlayer = (id: string, name = id): Player => ({ id, name, badges: [] });

const makeMatch = (
  id: string,
  teamA: string[],
  teamB: string[],
  result: 'A_WIN' | 'B_WIN' | 'DRAW',
  date = '2024-01-01'
): Match => ({
  id,
  date,
  teamA,
  teamB,
  result,
  scoreA: undefined,
  scoreB: undefined,
  metadata: undefined,
});

// ─── calculateStats ───────────────────────────────────────────────────────────
describe('calculateStats', () => {
  it('retorna lista vacía si no hay jugadores', () => {
    const result = calculateStats([], []);
    expect(result).toHaveLength(0);
  });

  it('retorna stats en cero si no hay partidos', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const result = calculateStats(players, []);

    expect(result).toHaveLength(2);
    const p1 = result.find(s => s.player.id === 'p1')!;
    expect(p1.matchesPlayed).toBe(0);
    expect(p1.wins).toBe(0);
    expect(p1.losses).toBe(0);
    expect(p1.draws).toBe(0);
    expect(p1.winPercentage).toBe(0);
    expect(p1.elo).toBe(1200);
  });

  it('registra victoria correctamente', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const matches = [makeMatch('m1', ['p1'], ['p2'], 'A_WIN')];
    const stats = calculateStats(players, matches);

    const p1 = stats.find(s => s.player.id === 'p1')!;
    const p2 = stats.find(s => s.player.id === 'p2')!;

    expect(p1.wins).toBe(1);
    expect(p1.losses).toBe(0);
    expect(p1.matchesPlayed).toBe(1);
    expect(p2.wins).toBe(0);
    expect(p2.losses).toBe(1);
    expect(p2.matchesPlayed).toBe(1);
  });

  it('registra empate correctamente', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const matches = [makeMatch('m1', ['p1'], ['p2'], 'DRAW')];
    const stats = calculateStats(players, matches);

    const p1 = stats.find(s => s.player.id === 'p1')!;
    const p2 = stats.find(s => s.player.id === 'p2')!;

    expect(p1.draws).toBe(1);
    expect(p1.wins).toBe(0);
    expect(p2.draws).toBe(1);
    expect(p2.wins).toBe(0);
  });

  it('calcula winPercentage correctamente', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const matches = [
      makeMatch('m1', ['p1'], ['p2'], 'A_WIN', '2024-01-01'),
      makeMatch('m2', ['p1'], ['p2'], 'A_WIN', '2024-01-02'),
      makeMatch('m3', ['p1'], ['p2'], 'B_WIN', '2024-01-03'),
    ];
    const stats = calculateStats(players, matches);
    const p1 = stats.find(s => s.player.id === 'p1')!;

    expect(p1.matchesPlayed).toBe(3);
    expect(p1.wins).toBe(2);
    expect(p1.losses).toBe(1);
    expect(p1.winPercentage).toBeCloseTo(66.67, 1);
  });

  it('calcula best streak (racha ganadora)', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const matches = [
      makeMatch('m1', ['p1'], ['p2'], 'A_WIN', '2024-01-01'),
      makeMatch('m2', ['p1'], ['p2'], 'A_WIN', '2024-01-02'),
      makeMatch('m3', ['p1'], ['p2'], 'A_WIN', '2024-01-03'),
      makeMatch('m4', ['p1'], ['p2'], 'B_WIN', '2024-01-04'),
    ];
    const stats = calculateStats(players, matches);
    const p1 = stats.find(s => s.player.id === 'p1')!;

    expect(p1.bestStreak).toBe(3);
  });

  it('calcula worst streak (racha perdedora)', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const matches = [
      makeMatch('m1', ['p1'], ['p2'], 'B_WIN', '2024-01-01'),
      makeMatch('m2', ['p1'], ['p2'], 'B_WIN', '2024-01-02'),
      makeMatch('m3', ['p1'], ['p2'], 'A_WIN', '2024-01-03'),
    ];
    const stats = calculateStats(players, matches);
    const p1 = stats.find(s => s.player.id === 'p1')!;

    expect(p1.worstStreak).toBe(2);
  });

  it('Elo del ganador sube y del perdedor baja', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const matches = [makeMatch('m1', ['p1'], ['p2'], 'A_WIN')];
    const stats = calculateStats(players, matches);

    const p1 = stats.find(s => s.player.id === 'p1')!;
    const p2 = stats.find(s => s.player.id === 'p2')!;

    expect(p1.elo).toBeGreaterThan(1200);
    expect(p2.elo).toBeLessThan(1200);
  });

  it('Elo se mantiene igual en empate entre iguales', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const matches = [makeMatch('m1', ['p1'], ['p2'], 'DRAW')];
    const stats = calculateStats(players, matches);

    const p1 = stats.find(s => s.player.id === 'p1')!;
    const p2 = stats.find(s => s.player.id === 'p2')!;

    // En empate entre iguales el Elo no cambia significativamente
    expect(p1.elo).toBeCloseTo(1200, 0);
    expect(p2.elo).toBeCloseTo(1200, 0);
  });

  it('no incluye en stats a jugadores que no aparecen en el array de players', () => {
    const players = [makePlayer('p1')];
    // p2 no está en players — no debería explotar
    const matches = [makeMatch('m1', ['p1'], ['p2'], 'A_WIN')];
    const stats = calculateStats(players, matches);

    expect(stats).toHaveLength(1);
    expect(stats[0].player.id).toBe('p1');
    expect(stats[0].wins).toBe(1);
  });
});

// ─── getPlayerReport ──────────────────────────────────────────────────────────
describe('getPlayerReport', () => {
  it('lanza error si el jugador no existe', () => {
    const players = [makePlayer('p1')];
    expect(() => getPlayerReport('no-existe', players, [])).toThrow();
  });

  it('retorna reporte con ceros si el jugador no jugó partidos', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const report = getPlayerReport('p1', players, []);

    expect(report.player.id).toBe('p1');
    expect(report.matchesPlayed).toBe(0);
    expect(report.wins).toBe(0);
    expect(report.bestTeammate).toBeNull();
    expect(report.nemesis).toBeNull();
  });

  it('identifica al mejor compañero', () => {
    const players = [makePlayer('p1'), makePlayer('p2'), makePlayer('p3')];
    const matches = [
      makeMatch('m1', ['p1', 'p2'], ['p3'], 'A_WIN', '2024-01-01'),
      makeMatch('m2', ['p1', 'p2'], ['p3'], 'A_WIN', '2024-01-02'),
      makeMatch('m3', ['p1', 'p3'], ['p2'], 'B_WIN', '2024-01-03'), // p3 como compañero, pierde
    ];
    const report = getPlayerReport('p1', players, matches);

    // p2 fue compañero en 2 victorias — debe ser el mejor compañero
    expect(report.bestTeammate).not.toBeNull();
    expect(report.bestTeammate!.players.some(p => p.id === 'p2')).toBe(true);
  });

  it('identifica al nemesis (quien más le ganó)', () => {
    const players = [makePlayer('p1'), makePlayer('p2'), makePlayer('p3')];
    const matches = [
      makeMatch('m1', ['p2'], ['p1'], 'A_WIN', '2024-01-01'), // p2 le gana a p1
      makeMatch('m2', ['p2'], ['p1'], 'A_WIN', '2024-01-02'), // p2 le gana a p1 de nuevo
      makeMatch('m3', ['p3'], ['p1'], 'A_WIN', '2024-01-03'), // p3 le gana a p1 una vez
    ];
    const report = getPlayerReport('p1', players, matches);

    expect(report.nemesis).not.toBeNull();
    expect(report.nemesis!.players.some(p => p.id === 'p2')).toBe(true);
  });
});
