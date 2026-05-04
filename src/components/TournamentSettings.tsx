import { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import styles from './TournamentSettings.module.css';
import { useTranslation } from 'react-i18next';

const FOOTBALL_OPTIONS = [
  { value: 5, label: 'Fútbol 5 (5v5)' },
  { value: 6, label: 'Fútbol 6 (6v6)' },
  { value: 7, label: 'Fútbol 7 (7v7)' },
  { value: 8, label: 'Fútbol 8 (8v8)' },
  { value: 9, label: 'Fútbol 9 (9v9)' },
  { value: 10, label: 'Fútbol 10 (10v10)' },
  { value: 11, label: 'Fútbol 11 (11v11)' }
];

export default function TournamentSettings() {
  const { activeTournament, updateTournamentConfig, isAdminOfActiveTournament } = useTournament();
  const { t } = useTranslation();
  
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
          {t('tournamentSettings.noPermission')}
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
        <h1 className={styles.pageTitle}>⚙️ {t('tournamentSettings.title')}</h1>
        <p className={styles.pageSubtitle}>{t('tournamentSettings.subtitle')}</p>
      </div>

      <div className={styles.card}>
        {activeTournament?.type_slug === 'paddle' ? (
          <>
            <h2 className={styles.cardTitle}>{t('tournamentSettings.padel.title')}</h2>
            <p className={styles.cardDesc}>
              {t('tournamentSettings.padel.desc')}
            </p>
            <div className={styles.optionsGrid} style={{ opacity: 0.5 }}>
              <div className={`${styles.optionCard} ${styles.optionCardSelected}`} style={{ cursor: 'default' }}>
                <div className={styles.checkbox}>
                  <span className={styles.checkIcon}>✓</span>
                </div>
                <div className={styles.optionContent}>
                  <span className={styles.optionLabel}>{t('tournamentSettings.padel.optTitle')}</span>
                  <span className={styles.optionSub}>{t('tournamentSettings.padel.optSub')}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.cardTitle}>{t('tournamentSettings.football.title')}</h2>
            <p className={styles.cardDesc}>
              {t('tournamentSettings.football.desc')}
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
                      <span className={styles.optionLabel}>{t(`tournamentSettings.options.football${opt.value}`)}</span>
                      <span className={styles.optionSub}>{t('tournamentSettings.football.optSub', { val: opt.value * 2 })}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={styles.actionsBox}>
              {saveStatus === 'success' && <span className={styles.statusSuccess}>{t('tournamentSettings.success')}</span>}
              {saveStatus === 'error' && <span className={styles.statusError}>{t('tournamentSettings.error')}</span>}
              
              <button 
                className={styles.saveBtn} 
                onClick={handleSave} 
                disabled={isSaving}
              >
                {isSaving ? t('tournamentSettings.saving') : t('tournamentSettings.saveBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
