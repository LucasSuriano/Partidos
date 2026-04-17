"use client";

import React, { useState, useEffect } from 'react';
import styles from './TournamentSelector.module.css';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Tournament } from '@/types';

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function nameToHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface AppUser { id: string; username: string; }

interface CreateModalProps {
  onClose: () => void;
  onCreated: (t: Tournament) => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const { createTournament } = useTournament();
  const { user: currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('users')
      .select('id, username')
      .order('username')
      .then(({ data }) => {
        if (data) setUsers(data as AppUser[]);
        setLoadingUsers(false);
        // Default owner = current superadmin
        if (data && currentUser) {
          const self = data.find((u: AppUser) => u.id === currentUser.id);
          if (self) setOwnerId(self.id);
        }
      });
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    if (!ownerId) { setError('Tenés que designar un dueño'); return; }
    setLoading(true);
    const result = await createTournament(name.trim(), description.trim(), ownerId);
    setLoading(false);
    if (result) {
      onCreated(result);
    } else {
      setError('No se pudo crear el torneo. Intentá de nuevo.');
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalIcon}>🏆</span>
          <h2 className={styles.modalTitle}>Nuevo Torneo</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nombre del torneo *</label>
            <input
              className={styles.formInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Torneo Primavera 2025"
              autoFocus
              maxLength={60}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Descripción (opcional)</label>
            <textarea
              className={styles.formTextarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descripción o detalle del torneo..."
              rows={3}
              maxLength={200}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Dueño del torneo *</label>
            {loadingUsers ? (
              <div className={styles.formInput} style={{ color: '#475569' }}>Cargando usuarios...</div>
            ) : (
              <select
                className={styles.formSelect}
                value={ownerId}
                onChange={e => setOwnerId(e.target.value)}
              >
                <option value="">— Seleccioná un usuario —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            )}
            <p className={styles.formHint}>
              Este usuario podrá registrar partidos y gestionar jugadores en este torneo.
            </p>
          </div>
          {error && <p className={styles.formError}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.createBtn} disabled={loading || loadingUsers}>
              {loading ? <span className={styles.btnSpinner} /> : '⚽'}
              {loading ? 'Creando...' : 'Crear Torneo'}
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
      setMessage('Código no encontrado o inválido.');
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
      setMessage('Ya sos miembro de ese torneo.');
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
        setMessage('Ya enviaste una solicitud. Esperá que el owner la apruebe.');
      } else {
        // Re-submit if previously rejected
        await supabase
          .from('tournament_join_requests')
          .update({ status: 'pending', created_at: new Date().toISOString() })
          .eq('id', existingReq.id);
        setStatus('success');
        setMessage('¡Solicitud enviada! El owner del torneo deberá aprobarla.');
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
      setMessage('Error al enviar la solicitud. Intentá de nuevo.');
      return;
    }

    setStatus('success');
    setMessage('¡Solicitud enviada! El owner del torneo deberá aprobarla.');
    setCode('');
  };

  return (
    <div className={styles.joinWidget}>
      <p className={styles.joinLabel}>¿Tenés un código de invitación?</p>
      <form className={styles.joinForm} onSubmit={handleSubmit}>
        <input
          className={styles.joinInput}
          value={code}
          onChange={e => { setCode(e.target.value); setStatus('idle'); }}
          placeholder="Ej: LUJ-AB3K9"
          maxLength={12}
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          className={styles.joinBtn}
          disabled={!code.trim() || status === 'loading'}
        >
          {status === 'loading' ? <span className={styles.joinSpinner} /> : 'Unirse'}
        </button>
      </form>
      {status === 'success' && <p className={styles.joinSuccess}>{message}</p>}
      {status === 'error'   && <p className={styles.joinError}>{message}</p>}
    </div>
  );
}


export default function TournamentSelector() {
  const { tournaments, setActiveTournament, isLoading } = useTournament();
  const { user, logout } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

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
        <div className={styles.brand}>
          <img src="/img/v987-24a.jpg" alt="Logo" className={styles.logo} />
          <span className={styles.brandName}>Entiendanla</span>
        </div>
        <div className={styles.userChip}>
          <div
            className={styles.avatar}
            style={{
              background: `hsl(${hue} 50% 25%)`,
              borderColor: `hsl(${hue} 65% 45%)`,
              color: `hsl(${hue} 80% 80%)`
            }}
          >
            {user ? getInitials(user.username) : '?'}
          </div>
          <span className={styles.username}>{user?.username}</span>
          {user?.role === 'admin' && <span className={styles.roleBadgeAdmin}>admin</span>}
          {isSuperAdmin && <span className={styles.roleBadgeSuperadmin}>superadmin</span>}
          <button className={styles.logoutBtn} onClick={logout} title="Cerrar sesión">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Hero section */}
      <section className={styles.hero}>
        <div className={styles.heroIcon}>⚽</div>
        <h1 className={styles.heroTitle}>Seleccioná un Torneo</h1>
        <p className={styles.heroSubtitle}>
          {isLoading ? 'Cargando torneos...' : `${tournaments.length} torneo${tournaments.length !== 1 ? 's' : ''} disponible${tournaments.length !== 1 ? 's' : ''}`}
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
            <p>No tenés torneos asignados.</p>
            {isSuperAdmin && <p>Creá el primero con el botón de abajo.</p>}
            {!isSuperAdmin && user && <JoinWithCode userId={user.id} />}
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
                        {formatDate(t.created_at)}
                      </p>
                    )}
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
            <span className={styles.createLabel}>Nuevo Torneo</span>
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
