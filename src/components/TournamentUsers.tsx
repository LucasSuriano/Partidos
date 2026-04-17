"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import styles from './TournamentUsers.module.css';

interface JoinRequest {
  id: string;
  user_id: string;
  username: string;
  created_at: string;
}

interface Member {
  user_id: string;
  username: string;
  role: string;
}

interface InviteCode {
  id: string;
  code: string;
  created_at: string;
}

function generateCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const head = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  let tail = '';
  for (let i = 0; i < 5; i++) tail += chars[Math.floor(Math.random() * chars.length)];
  return `${head}-${tail}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export default function TournamentUsers() {
  const { user } = useAuth();
  const { activeTournament } = useTournament();

  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeTournament) return;
    setLoading(true);

    // Invite code
    const { data: codeData } = await supabase
      .from('tournament_invites')
      .select('id, code, created_at')
      .eq('tournament_id', activeTournament.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setInviteCode(codeData ?? null);

    // Pending join requests (join with users for username)
    const { data: reqData } = await supabase
      .from('tournament_join_requests')
      .select('id, user_id, created_at, users(username)')
      .eq('tournament_id', activeTournament.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (reqData) {
      setRequests(reqData.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        username: r.users?.username ?? 'Desconocido',
        created_at: r.created_at,
      })));
    }

    // Members
    const { data: memberData } = await supabase
      .from('user_tournaments')
      .select('user_id, users(username, role)')
      .eq('tournament_id', activeTournament.id);

    if (memberData) {
      setMembers(memberData.map((m: any) => ({
        user_id: m.user_id,
        username: m.users?.username ?? 'Desconocido',
        role: m.users?.role ?? 'user',
      })));
    }

    setLoading(false);
  }, [activeTournament]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerateCode = async () => {
    if (!activeTournament || !user) return;
    setGeneratingCode(true);

    await supabase
      .from('tournament_invites')
      .update({ is_active: false })
      .eq('tournament_id', activeTournament.id);

    const code = generateCode(activeTournament.name);
    const { data } = await supabase
      .from('tournament_invites')
      .insert([{ tournament_id: activeTournament.id, code, created_by: user.id }])
      .select('id, code, created_at')
      .single();

    if (data) setInviteCode(data);
    setGeneratingCode(false);
  };

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleApprove = async (req: JoinRequest) => {
    if (!activeTournament || !user) return;
    setProcessingId(req.id);

    await supabase
      .from('tournament_join_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq('id', req.id);

    await supabase
      .from('user_tournaments')
      .insert([{ user_id: req.user_id, tournament_id: activeTournament.id }]);

    setRequests(prev => prev.filter(r => r.id !== req.id));
    setMembers(prev => [...prev, { user_id: req.user_id, username: req.username, role: 'user' }]);
    setProcessingId(null);
  };

  const handleReject = async (req: JoinRequest) => {
    if (!user) return;
    setProcessingId(req.id);

    await supabase
      .from('tournament_join_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq('id', req.id);

    setRequests(prev => prev.filter(r => r.id !== req.id));
    setProcessingId(null);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeTournament) return;
    if (activeTournament.owner_id === memberId) return; // never remove owner
    if (!confirm('¿Eliminar a este usuario del torneo? También se eliminarán sus votos de insignias.')) return;

    // Delete their badge votes for players in this tournament
    await supabase
      .from('player_badges')
      .delete()
      .eq('user_id', memberId)
      .eq('tournament_id', activeTournament.id);

    // Remove from tournament
    await supabase
      .from('user_tournaments')
      .delete()
      .eq('user_id', memberId)
      .eq('tournament_id', activeTournament.id);

    setMembers(prev => prev.filter(m => m.user_id !== memberId));
  };

  if (!activeTournament) return null;

  if (loading) {
    return (
      <div className={styles.container}>
        {[1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}
      </div>
    );
  }

  return (
    <div className={styles.container}>

      {/* ── Invite Code ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>🔑 Código de Invitación</h2>
          <p className={styles.sectionDesc}>
            Compartí este código con alguien para que pueda solicitar unirse al torneo.
          </p>
        </div>
        <div className={styles.codeCard}>
          {inviteCode ? (
            <>
              <div className={styles.codeDisplay}>
                <span className={styles.codeText}>{inviteCode.code}</span>
                <button
                  className={`${styles.codeBtn} ${copiedCode ? styles.codeBtnCopied : ''}`}
                  onClick={handleCopyCode}
                  title="Copiar código"
                >
                  {copiedCode ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>
              <p className={styles.codeCreatedAt}>Generado {timeAgo(inviteCode.created_at)}</p>
            </>
          ) : (
            <p className={styles.codeEmpty}>No hay código activo para este torneo.</p>
          )}
          <button
            className={styles.generateBtn}
            onClick={handleGenerateCode}
            disabled={generatingCode}
          >
            {generatingCode ? (
              <><span className={styles.spinner} /> Generando...</>
            ) : (
              <>{inviteCode ? '🔄 Generar nuevo código' : '✨ Generar código'}</>
            )}
          </button>
        </div>
      </section>

      {/* ── Pending Requests ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            📥 Solicitudes Pendientes
            {requests.length > 0 && (
              <span className={styles.badge}>{requests.length}</span>
            )}
          </h2>
          {requests.length === 0 && (
            <p className={styles.sectionDesc}>No hay solicitudes pendientes.</p>
          )}
        </div>

        <div className={styles.requestList}>
          {requests.map(req => (
            <div key={req.id} className={styles.requestCard}>
              <div className={styles.requestInfo}>
                <div className={styles.requestAvatar}>
                  {req.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className={styles.requestName}>{req.username}</p>
                  <p className={styles.requestTime}>{timeAgo(req.created_at)}</p>
                </div>
              </div>
              <div className={styles.requestActions}>
                <button
                  className={styles.approveBtn}
                  onClick={() => handleApprove(req)}
                  disabled={processingId === req.id}
                  title="Aprobar"
                >
                  ✓ Aprobar
                </button>
                <button
                  className={styles.rejectBtn}
                  onClick={() => handleReject(req)}
                  disabled={processingId === req.id}
                  title="Rechazar"
                >
                  ✕ Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Members ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>👥 Miembros ({members.length})</h2>
        </div>
        <div className={styles.memberList}>
          {members.map(m => {
            const isOwner = activeTournament.owner_id === m.user_id;
            const isMe = user?.id === m.user_id;
            return (
              <div key={m.user_id} className={styles.memberCard}>
                <div className={styles.memberInfo}>
                  <div className={styles.requestAvatar}>
                    {m.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className={styles.requestName}>
                      {m.username}
                      {isMe && <span className={styles.meBadge}>tú</span>}
                    </p>
                    <p className={styles.requestTime}>
                      {isOwner ? '👑 Dueño del torneo' : m.role === 'superadmin' ? '⭐ Superadmin' : 'Miembro'}
                    </p>
                  </div>
                </div>
                {!isOwner && !isMe && (
                  <button
                    className={styles.kickBtn}
                    onClick={() => handleRemoveMember(m.user_id)}
                    title="Eliminar del torneo"
                  >
                    Quitar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
