"use client";

import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import styles from './MatchHistory.module.css';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function MatchHistory() {
  const { matches, players, removeMatch } = useAppContext();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const getPlayers = (ids: string[]) =>
    ids.map(id => players.find(p => p.id === id)?.name ?? 'Desconocido');

  const formatDateLabel = (isoString: string) => {
    const d = new Date(isoString);
    const dia = DIAS[d.getUTCDay()];
    const num = d.getUTCDate();
    const mes = MESES_CORTOS[d.getUTCMonth()];
    const año = d.getUTCFullYear();
    return `${dia} ${num} ${mes}. ${año}`;
  };

  const getMonthKey = (isoString: string) => {
    const d = new Date(isoString);
    return `${MESES_LARGOS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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
        <span className={styles.emptyIcon}>⚽</span>
        <h2>No se han jugado partidos aún</h2>
        <p>Registra un partido para que aparezca aquí el historial.</p>
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
            const labelA = isDraw ? 'Empate' : match.result === 'A_WIN' ? 'Equipo Ganador' : 'Equipo Perdedor';
            const labelB = isDraw ? 'Empate' : match.result === 'B_WIN' ? 'Equipo Ganador' : 'Equipo Perdedor';
            
            const teamAColor = isDraw ? 'Amber' : match.result === 'A_WIN' ? 'Green' : 'Red';
            const teamBColor = isDraw ? 'Amber' : match.result === 'B_WIN' ? 'Green' : 'Red';

            return (
              <div
                key={match.id}
                className={styles.matchCard}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                {/* Tinte de fondo split */}
                <div className={styles[`splitBg${teamAColor}Left`]} />
                <div className={styles[`splitBg${teamBColor}Right`]} />

                <div className={styles.cardInner}>
                  {/* Cabecera */}
                  <div className={styles.cardHeader}>
                    <div className={styles.matchNumber}>Partido #{num}</div>
                    <div className={styles.dateLabel}>{formatDateLabel(match.date)}</div>
                    {isAdmin && (
                      <button
                        className={styles.deleteBtn}
                        onClick={() =>
                          confirm('¿Estás seguro de eliminar este partido?') &&
                          removeMatch(match.id)
                        }
                        title="Eliminar partido"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Cuerpo: equipos */}
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

                    {/* VS central */}
                    <div className={styles.vsSeparator}>
                      <span className={styles.vsIcon}>⚽</span>
                      <span className={styles.vsText}>VS</span>
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
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
