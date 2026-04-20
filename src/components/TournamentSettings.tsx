import { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import styles from './TournamentSettings.module.css';

const FOOTBALL_OPTIONS = [
  { value: 5, label: 'Fútbol 5 (5v5)' },
  { value: 7, label: 'Fútbol 7 (7v7)' },
  { value: 11, label: 'Fútbol 11 (11v11)' }
];

export default function TournamentSettings() {
  const { activeTournament, updateTournamentConfig, isAdminOfActiveTournament } = useTournament();
  
  // Initialize with tournament's config, or default to [5]
  const [matchTypes, setMatchTypes] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (activeTournament) {
      setMatchTypes(activeTournament.match_types && activeTournament.match_types.length > 0 ? activeTournament.match_types : [5]);
    }
  }, [activeTournament]);

  if (!isAdminOfActiveTournament) {
    return (
      <div className={styles.container}>
        <div className={styles.errorBox}>
          No tienes permisos para ver esta sección.
        </div>
      </div>
    );
  }

  const toggleType = (val: number) => {
    setMatchTypes(prev => {
      if (prev.includes(val)) {
        // Prevent removing the last option
        if (prev.length === 1) return prev;
        return prev.filter(v => v !== val);
      } else {
        return [...prev, val].sort((a, b) => a - b);
      }
    });
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    const success = await updateTournamentConfig(matchTypes);
    setIsSaving(false);
    setSaveStatus(success ? 'success' : 'error');
    if (success) {
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>⚙️ Configuración del Torneo</h1>
        <p className={styles.pageSubtitle}>Administra las reglas y modalidades de este torneo. Estos cambios afectarán a todos los participantes.</p>
      </div>

      <div className={styles.card}>
        {activeTournament?.type_slug === 'paddle' ? (
          <>
            <h2 className={styles.cardTitle}>Formatos de Partido (Pádel)</h2>
            <p className={styles.cardDesc}>
              El pádel se juega por defecto en modalidad 2v2 (Parejas). Actualmente, la plataforma no soporta otras modalidades para este deporte.
            </p>
            <div className={styles.optionsGrid} style={{ opacity: 0.5 }}>
              <div className={`${styles.optionCard} ${styles.optionCardSelected}`} style={{ cursor: 'default' }}>
                <div className={styles.checkbox}>
                  <span className={styles.checkIcon}>✓</span>
                </div>
                <div className={styles.optionContent}>
                  <span className={styles.optionLabel}>Pádel Dobles (2v2)</span>
                  <span className={styles.optionSub}>4 jugadores en cancha</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.cardTitle}>Formatos de Partido (Fútbol)</h2>
            <p className={styles.cardDesc}>
              Selecciona las modalidades de juego que están permitidas en este torneo. Puedes tener más de una activa a la vez. Cuando haya más de una, la aplicación te pedirá elegir el formato al registrar un partido o simular.
            </p>

            <div className={styles.optionsGrid}>
              {FOOTBALL_OPTIONS.map(opt => {
                const isSelected = matchTypes.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.optionCard} ${isSelected ? styles.optionCardSelected : ''}`}
                    onClick={() => toggleType(opt.value)}
                  >
                    <div className={styles.checkbox}>
                      {isSelected && <span className={styles.checkIcon}>✓</span>}
                    </div>
                    <div className={styles.optionContent}>
                      <span className={styles.optionLabel}>{opt.label}</span>
                      <span className={styles.optionSub}>{opt.value * 2} jugadores en cancha</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={styles.actionsBox}>
              {saveStatus === 'success' && <span className={styles.statusSuccess}>¡Cambios guardados con éxito!</span>}
              {saveStatus === 'error' && <span className={styles.statusError}>Error al guardar. Intenta nuevamente.</span>}
              
              <button 
                className={styles.saveBtn} 
                onClick={handleSave} 
                disabled={isSaving}
              >
                {isSaving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
