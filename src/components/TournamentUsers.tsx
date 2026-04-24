"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import styles from './TournamentUsers.module.css';
import { useTranslation } from 'react-i18next';

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

interface ConfirmRemove {
  user_id: string;
  username: string;
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

function timeAgo(iso: string, t: any) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('tournamentUsers.timeAgo.moment');
  if (mins < 60) return t('tournamentUsers.timeAgo.mins', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('tournamentUsers.timeAgo.hours', { hours: hrs });
  return t('tournamentUsers.timeAgo.days', { days: Math.floor(hrs / 24) });
}

export default function TournamentUsers() {
  const { user } = useAuth();
  const { activeTournament } = useTournament();
  const { t } = useTranslation();

  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ConfirmRemove | null>(null);
  const [removing, setRemoving] = useState(false);

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

    // Pending join requests (two-step: get requests, then look up usernames)
    const { data: reqData } = await supabase
      .from('tournament_join_requests')
      .select('id, user_id, created_at, invite_code')
      .eq('tournament_id', activeTournament.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (reqData && reqData.length > 0) {
      const userIds = [...new Set(reqData.map((r: any) => r.user_id))];
      const { data: usersData } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds);

      const usernameMap = Object.fromEntries((usersData ?? []).map((u: any) => [u.id, u.username]));

      setRequests(reqData.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        username: usernameMap[r.user_id] ?? t('tournamentUsers.unknown'),
        created_at: r.created_at,
      })));
    } else {
      setRequests([]);
    }

    // Members (two-step: get user_tournaments, then look up usernames)
    const { data: memberData } = await supabase
      .from('user_tournaments')
      .select('user_id')
      .eq('tournament_id', activeTournament.id);

    if (memberData && memberData.length > 0) {
      const memberIds = memberData.map((m: any) => m.user_id);
      const { data: memberUsers } = await supabase
        .from('users')
        .select('id, username, role')
        .in('id', memberIds);

      setMembers((memberUsers ?? []).map((u: any) => ({
        user_id: u.id,
        username: u.username ?? t('tournamentUsers.unknown'),
        role: u.role ?? 'user',
      })));
    } else {
      setMembers([]);
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
    if (activeTournament.owner_id === memberId) return;
    const member = members.find(m => m.user_id === memberId);
    if (member) setConfirmRemove({ user_id: member.user_id, username: member.username });
  };

  const executeRemove = async () => {
    if (!confirmRemove || !activeTournament) return;
    setRemoving(true);

    await supabase
      .from('player_badges')
      .delete()
      .eq('user_id', confirmRemove.user_id)
      .eq('tournament_id', activeTournament.id);

    await supabase
      .from('user_tournaments')
      .delete()
      .eq('user_id', confirmRemove.user_id)
      .eq('tournament_id', activeTournament.id);

    setMembers(prev => prev.filter(m => m.user_id !== confirmRemove.user_id));
    setRemoving(false);
    setConfirmRemove(null);
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

      {/* ── Confirm Remove Modal ── */}
      {confirmRemove && (
        <div className={styles.modalOverlay} onClick={() => !removing && setConfirmRemove(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>⚠️</div>
            <h3 className={styles.confirmTitle}>{t('tournamentUsers.confirmModal.title')}</h3>
            <p className={styles.confirmBody}>
              {t('tournamentUsers.confirmModal.body', { username: confirmRemove.username, name: activeTournament?.name })}
            </p>
            <ul className={styles.confirmList}>
              <li>{t('tournamentUsers.confirmModal.rule1')}</li>
              <li>{t('tournamentUsers.confirmModal.rule2')}</li>
            </ul>
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmCancelBtn}
                onClick={() => setConfirmRemove(null)}
                disabled={removing}
              >
                {t('tournamentUsers.confirmModal.cancel')}
              </button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={executeRemove}
                disabled={removing}
              >
                {removing ? <span className={styles.spinner} /> : null}
                {removing ? t('tournamentUsers.confirmModal.removing') : t('tournamentUsers.confirmModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>{t('tournamentUsers.pageTitle')}</h1>
        <button className={styles.refreshBtn} onClick={fetchData} title={t('tournamentUsers.refresh')}>
          🔄 {t('tournamentUsers.refresh')}
        </button>
      </div>

      {/* ── Invite Code ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('tournamentUsers.invite.title')}</h2>
          <p className={styles.sectionDesc}>
            {t('tournamentUsers.invite.desc')}
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
                  title={t('tournamentUsers.invite.copy')}
                >
                  {copiedCode ? t('tournamentUsers.invite.copied') : t('tournamentUsers.invite.copy')}
                </button>
              </div>
              <p className={styles.codeCreatedAt}>{t('tournamentUsers.invite.generated', { timeAgo: timeAgo(inviteCode.created_at, t) })}</p>
            </>
          ) : (
            <p className={styles.codeEmpty}>{t('tournamentUsers.invite.noCode')}</p>
          )}
          <button
            className={styles.generateBtn}
            onClick={handleGenerateCode}
            disabled={generatingCode}
          >
            {generatingCode ? (
              <><span className={styles.spinner} /> {t('tournamentUsers.invite.generating')}</>
            ) : (
              <>{inviteCode ? t('tournamentUsers.invite.generateNew') : t('tournamentUsers.invite.generate')}</>
            )}
          </button>
        </div>
      </section>

      {/* ── Pending Requests ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {t('tournamentUsers.requests.title')}
            {requests.length > 0 && (
              <span className={styles.badge}>{requests.length}</span>
            )}
          </h2>
          {requests.length === 0 && (
            <p className={styles.sectionDesc}>{t('tournamentUsers.requests.empty')}</p>
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
                  <p className={styles.requestTime}>{timeAgo(req.created_at, t)}</p>
                </div>
              </div>
              <div className={styles.requestActions}>
                <button
                  className={styles.approveBtn}
                  onClick={() => handleApprove(req)}
                  disabled={processingId === req.id}
                  title={t('tournamentUsers.requests.approve')}
                >
                  {t('tournamentUsers.requests.approve')}
                </button>
                <button
                  className={styles.rejectBtn}
                  onClick={() => handleReject(req)}
                  disabled={processingId === req.id}
                  title={t('tournamentUsers.requests.reject')}
                >
                  {t('tournamentUsers.requests.reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Members ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('tournamentUsers.members.title', { count: members.length })}</h2>
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
                      {isMe && <span className={styles.meBadge}>{t('tournamentUsers.members.me')}</span>}
                    </p>
                    <p className={styles.requestTime}>
                      {isOwner ? t('tournamentUsers.members.owner') : m.role === 'superadmin' ? t('tournamentUsers.members.superadmin') : t('tournamentUsers.members.member')}
                    </p>
                  </div>
                </div>
                {!isOwner && !isMe && (
                  <button
                    className={styles.kickBtn}
                    onClick={() => handleRemoveMember(m.user_id)}
                    title={t('tournamentUsers.members.kick')}
                  >
                    {t('tournamentUsers.members.kick')}
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
