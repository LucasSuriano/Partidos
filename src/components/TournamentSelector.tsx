"use client";

import React, { useState, useEffect } from 'react';
import styles from './TournamentSelector.module.css';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Tournament } from '@/types';
import UserMenu from './UserMenu';
import Brand from './Brand';
import { useTranslation } from 'react-i18next';

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function nameToHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function formatDate(iso?: string, lang: string = 'es-AR') {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat(lang, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

interface AppUser { id: string; username: string; }

interface CreateModalProps {
  onClose: () => void;
  onCreated: (t: Tournament) => void;
}
interface TournamentType { id: string; name: string; slug: string; icon: string; }

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const { createTournament } = useTournament();
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [types, setTypes] = useState<TournamentType[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id, username').order('username'),
      supabase.from('tournament_types').select('*').order('name')
    ]).then(([{ data: userData, error: userError }, { data: typeData, error: typeError }]) => {
      if (userError) console.error('Error loading users:', userError);
      if (typeError) {
        console.error('Error loading tournament types:', typeError);
        setError(t('tournamentSelector.errors.loadTypes'));
      }

      if (userData) {
        setUsers(userData as AppUser[]);
        if (currentUser) {
          const self = userData.find((u: AppUser) => u.id === currentUser.id);
          if (self) setOwnerId(self.id);
        }
      }
      
      if (typeData && typeData.length > 0) {
        setTypes(typeData as TournamentType[]);
        // Default to football if available, otherwise any basketball/padel or the first one
        const fallback = typeData.find((t: any) => t.slug.includes('foot')) || 
                         typeData.find((t: any) => t.slug.includes('pad')) || 
                         typeData[0];
        if (fallback) setTypeId(fallback.id);
      } else {
        setTypes([]);
      }
      setLoadingInitial(false);
    }).catch(err => {
      console.error('Initial load failed:', err);
      setLoadingInitial(false);
      setError(t('tournamentSelector.errors.connection'));
    });
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(t('tournamentSelector.errors.nameRequired')); return; }
    if (!ownerId) { setError(t('tournamentSelector.errors.ownerRequired')); return; }
    if (!typeId) { setError(t('tournamentSelector.errors.typeRequired')); return; }
    setLoading(true);
    const result = await createTournament(name.trim(), description.trim(), ownerId, typeId);
    setLoading(false);
    if (result) {
      onCreated(result);
    } else {
      setError(t('tournamentSelector.errors.createFailed'));
    }
  };

  const typeIcon = types.find(t => t.id === typeId)?.icon || '🏆';

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalIcon}>🏆</span>
          <h2 className={styles.modalTitle}>{t('tournamentSelector.modal.title')}</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('tournamentSelector.modal.nameLabel')}</label>
            <input
              className={styles.formInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('tournamentSelector.modal.namePlaceholder')}
              autoFocus
              maxLength={60}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('tournamentSelector.modal.descLabel')}</label>
            <textarea
              className={styles.formTextarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('tournamentSelector.modal.descPlaceholder')}
              rows={3}
              maxLength={200}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('tournamentSelector.modal.ownerLabel')}</label>
            {loadingInitial ? (
              <div className={styles.formInput} style={{ color: '#475569' }}>{t('tournamentSelector.modal.loadingUsers')}</div>
            ) : (
              <select
                className={styles.formSelect}
                value={ownerId}
                onChange={e => setOwnerId(e.target.value)}
              >
                <option value="">{t('tournamentSelector.modal.selectUser')}</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            )}
            <p className={styles.formHint}>
              {t('tournamentSelector.modal.ownerHint')}
            </p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('tournamentSelector.modal.typeLabel')}</label>
            {loadingInitial ? (
              <div className={styles.formInput} style={{ color: '#475569' }}>{t('tournamentSelector.modal.loadingTypes')}</div>
            ) : types.length === 0 ? (
              <div className={styles.formInput} style={{ color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}>
                {t('tournamentSelector.modal.noTypes')}
              </div>
            ) : (
              <select
                className={styles.formSelect}
                value={typeId}
                onChange={e => setTypeId(e.target.value)}
              >
                {types.map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                ))}
              </select>
            )}
          </div>
          {error && <p className={styles.formError}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('tournamentSelector.modal.cancel')}</button>
            <button type="submit" className={styles.createBtn} disabled={loading || loadingInitial}>
              {loading ? <span className={styles.btnSpinner} /> : typeIcon}
              {loading ? t('tournamentSelector.modal.creating') : t('tournamentSelector.modal.createBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinWithCode({ userId }: { userId: string }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setStatus('loading');
    setMessage('');

    // Find the invite
    const { data: invite, error: inviteErr } = await supabase
      .from('tournament_invites')
      .select('id, tournament_id')
      .eq('code', trimmed)
      .eq('is_active', true)
      .maybeSingle();

    if (inviteErr || !invite) {
      setStatus('error');
      setMessage(t('tournamentSelector.errors.invalidCode'));
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('user_tournaments')
      .select('user_id')
      .eq('user_id', userId)
      .eq('tournament_id', invite.tournament_id)
      .maybeSingle();

    if (existing) {
      setStatus('error');
      setMessage(t('tournamentSelector.errors.alreadyMember'));
      return;
    }

    // Check if already requested
    const { data: existingReq } = await supabase
      .from('tournament_join_requests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('tournament_id', invite.tournament_id)
      .maybeSingle();

    if (existingReq) {
      if (existingReq.status === 'pending') {
        setStatus('error');
        setMessage(t('tournamentSelector.errors.requestPending'));
      } else {
        // Re-submit if previously rejected
        await supabase
          .from('tournament_join_requests')
          .update({ status: 'pending', created_at: new Date().toISOString() })
          .eq('id', existingReq.id);
        setStatus('success');
        setMessage(t('tournamentSelector.join.success'));
        setCode('');
      }
      return;
    }

    // Create join request
    const { error: reqErr } = await supabase
      .from('tournament_join_requests')
      .insert([{ user_id: userId, tournament_id: invite.tournament_id, invite_code: trimmed }]);

    if (reqErr) {
      setStatus('error');
      setMessage(t('tournamentSelector.errors.joinFailed'));
      return;
    }

    setStatus('success');
    setMessage(t('tournamentSelector.join.success'));
    setCode('');
  };

  return (
    <div className={styles.joinWidget}>
      <p className={styles.joinLabel}>{t('tournamentSelector.join.label')}</p>
      <form className={styles.joinForm} onSubmit={handleSubmit}>
        <input
          className={styles.joinInput}
          value={code}
          onChange={e => { setCode(e.target.value); setStatus('idle'); }}
          placeholder={t('tournamentSelector.join.placeholder')}
          maxLength={12}
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          className={styles.joinBtn}
          disabled={!code.trim() || status === 'loading'}
        >
          {status === 'loading' ? <span className={styles.joinSpinner} /> : t('tournamentSelector.join.button')}
        </button>
      </form>
      {status === 'success' && <p className={styles.joinSuccess}>{message}</p>}
      {status === 'error'   && <p className={styles.joinError}>{message}</p>}
    </div>
  );
}


export default function TournamentSelector() {
  const { tournaments, setActiveTournament, isLoading } = useTournament();
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { t, i18n } = useTranslation();

  const isSuperAdmin = user?.role === 'superadmin';
  const hue = user ? nameToHue(user.username) : 120;

  const handleSelectTournament = (t: Tournament) => {
    setActiveTournament(t);
  };

  const handleCreated = (t: Tournament) => {
    setShowCreateModal(false);
    setActiveTournament(t);
  };

  return (
    <div className={styles.root}>
      {/* Background blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      {/* Top bar */}
      <header className={styles.topBar}>
        <Brand />
        <UserMenu hue={hue} />
      </header>

      {/* Hero section */}
      <section className={styles.hero}>
        <div className={styles.heroIcon}>🏆</div>
        <h1 className={styles.heroTitle}>{t('tournamentSelector.hero.title')}</h1>
        <p className={styles.heroSubtitle}>
          {isLoading ? t('tournamentSelector.hero.loading') : tournaments.length === 1 ? t('tournamentSelector.hero.oneTournamentAvailable') : t('tournamentSelector.hero.tournamentsAvailable', { count: tournaments.length })}
        </p>
      </section>

      {/* Tournament grid */}
      <main className={styles.grid}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.cardSkeleton}`} />
          ))
        ) : tournaments.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🔍</span>
            <p>{t('tournamentSelector.empty.noTournaments')}</p>
            {isSuperAdmin && <p>{t('tournamentSelector.empty.createFirst')}</p>}
          </div>
        ) : (
          tournaments.map(t => {
            const hueT = nameToHue(t.id);
            return (
              <button
                key={t.id}
                className={styles.card}
                onClick={() => handleSelectTournament(t)}
                style={{ '--card-hue': `${hueT}` } as React.CSSProperties}
              >
                <div className={styles.cardGlow} />
                <div className={styles.cardInitials}>
                  {getInitials(t.name)}
                </div>
                <div className={styles.cardBody}>
                  <h2 className={styles.cardName}>{t.name}</h2>
                  {t.description && <p className={styles.cardDesc}>{t.description}</p>}
                  <div className={styles.cardMeta}>
                    {t.owner_username && (
                      <p className={styles.cardOwner}>
                        <span>👑</span>
                        {t.owner_username}
                      </p>
                    )}
                    {t.created_at && (
                      <p className={styles.cardDate}>
                        <span className={styles.calIcon}>📅</span>
                        {formatDate(t.created_at, i18n.language)}
                      </p>
                    )}
                    <p className={styles.cardType}>
                      <span className={styles.typeIcon}>{t.type_icon || '🏆'}</span>
                      {t.type_name}
                    </p>
                  </div>
                </div>
                <div className={styles.cardArrow}>→</div>
              </button>
            );
          })
        )}

        {/* Create tournament button (superadmin only) */}
        {isSuperAdmin && (
          <button
            className={styles.createCard}
            onClick={() => setShowCreateModal(true)}
          >
            <div className={styles.createIcon}>+</div>
            <span className={styles.createLabel}>{t('tournamentSelector.createCard')}</span>
          </button>
        )}
      </main>

      {/* Join with code — always visible for non-superadmins */}
      {!isSuperAdmin && !isLoading && user && (
        <div className={styles.joinSection}>
          <JoinWithCode userId={user.id} />
        </div>
      )}

      {showCreateModal && (
        <CreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
