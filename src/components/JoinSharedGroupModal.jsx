import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { useModalBackHandler } from '../utils/backButton';
import {
    Radio,
    X,
    Clipboard,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    User,
    ShieldCheck,
    RefreshCw,
    Users
} from 'lucide-react';
import GroupCardBanner from './GroupCardBanner';

export default function JoinSharedGroupModal({ onClose, onSuccess }) {
    useModalBackHandler(true, onClose);
    const {
        state,
        addUser,
        parseInviteCode,
        fetchGroupStateOnce,
        joinSharedGroup
    } = useExpenses();

    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [step, setStep] = useState('input'); // 'input', 'loading', 'select-identity', 'error'
    const [fetchedData, setFetchedData] = useState(null); // { group, members, transactions, syncSecret }
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [isNewMember, setIsNewMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    const handlePaste = async () => {
        try {
            if (navigator.clipboard?.readText) {
                const text = await navigator.clipboard.readText();
                if (text) {
                    setInviteCodeInput(text.trim());
                    setErrorMessage('');
                }
            }
        } catch (e) {
            console.warn('Clipboard read failed:', e);
        }
    };

    const handleFetchGroup = async (e) => {
        if (e) e.preventDefault();
        const cleanInput = inviteCodeInput.trim();
        if (!cleanInput) {
            setErrorMessage('Please enter or paste a Group Invite Code.');
            return;
        }

        const parsed = parseInviteCode(cleanInput);
        if (!parsed) {
            setErrorMessage('Invalid Invite Code format. Code should start with "SPLIT-1-..."');
            return;
        }

        setStep('loading');
        setErrorMessage('');

        try {
            const result = await fetchGroupStateOnce(parsed.groupId, parsed.syncSecret, 7000);
            if (result.success && result.payload && result.payload.group) {
                setFetchedData({
                    ...result.payload,
                    syncSecret: parsed.syncSecret
                });

                // Default selection: auto-match by email first, then fallback to name match, or first member
                const members = result.payload.members || [];
                const currentUser = (state.users || []).find(u => u.id === state.currentUserId);
                const currentUserEmail = currentUser?.email?.toLowerCase()?.trim();
                const currentUserName = currentUser?.name?.toLowerCase()?.trim();

                const matchedMember = (currentUserEmail && members.find(m => m.email && m.email.toLowerCase().trim() === currentUserEmail))
                    || (currentUserName && members.find(m => m.name && m.name.toLowerCase().trim() === currentUserName));

                if (matchedMember) {
                    setSelectedMemberId(matchedMember.id);
                } else if (members.length > 0) {
                    setSelectedMemberId(members[0].id);
                }

                setStep('select-identity');
            } else {
                setErrorMessage(result.error || 'Could not locate group on Nostr relays. Please verify the code or try again.');
                setStep('input');
            }
        } catch (err) {
            console.error('Error fetching group:', err);
            setErrorMessage(err.message || 'Failed to connect to relays.');
            setStep('input');
        }
    };

    const handleConfirmJoin = async () => {
        if (!fetchedData) return;
        setIsJoining(true);

        try {
            let memberIdToUse = selectedMemberId;
            let newMemberObj = null;

            // If user specified a new name
            if (isNewMember) {
                const trimmed = newMemberName.trim();
                if (!trimmed) {
                    setErrorMessage('Please enter your name.');
                    setIsJoining(false);
                    return;
                }
                const currentUser = (state.users || []).find(u => u.id === state.currentUserId);
                const newId = addUser(trimmed, currentUser?.email || null);
                memberIdToUse = newId;
                newMemberObj = {
                    id: newId,
                    name: trimmed,
                    email: currentUser?.email || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }

            const joinRes = await joinSharedGroup(inviteCodeInput.trim(), memberIdToUse, fetchedData, newMemberObj);
            if (joinRes.success) {
                if (onSuccess) onSuccess(joinRes.groupId);
            } else {
                setErrorMessage(joinRes.error || 'Failed to merge shared group.');
            }
        } catch (err) {
            setErrorMessage(err.message || 'Error joining group.');
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="modal-content bottom-sheet" style={{ maxWidth: '560px' }}>
                <div className="bottom-sheet-handle" />

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: 'var(--radius-md)',
                            background: 'hsl(var(--color-accent) / 0.12)',
                            color: 'hsl(var(--color-accent))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Radio size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                Join Shared Group
                            </h3>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn-icon"
                        onClick={onClose}
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {errorMessage && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'hsl(var(--color-danger) / 0.1)',
                        color: 'hsl(var(--color-danger))',
                        fontSize: '0.86rem',
                        marginBottom: '1rem'
                    }}>
                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Step 1: Input Code */}
                {step === 'input' && (
                    <form onSubmit={handleFetchGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'hsl(var(--color-text-muted))' }}>
                                Paste Group Invite Code
                            </label>
                            <div style={{ position: 'relative' }}>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="Paste code (e.g. SPLIT-1-grp_... or full share text)..."
                                    value={inviteCodeInput}
                                    onChange={(e) => setInviteCodeInput(e.target.value)}
                                    style={{
                                        width: '100%',
                                        fontFamily: 'monospace',
                                        fontSize: '0.85rem',
                                        resize: 'none',
                                        paddingRight: '3.5rem'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handlePaste}
                                    className="btn btn-secondary btn-sm"
                                    title="Paste from clipboard"
                                    style={{
                                        position: 'absolute',
                                        right: '0.5rem',
                                        top: '0.5rem',
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.78rem'
                                    }}
                                >
                                    <Clipboard size={13} />
                                    <span>Paste</span>
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!inviteCodeInput.trim()}
                            >
                                <span>Find Group</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </form>
                )}

                {/* Step 2: Loading & Connecting */}
                {step === 'loading' && (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                        <div style={{
                            width: '54px',
                            height: '54px',
                            margin: '0 auto 1.25rem',
                            borderRadius: '50%',
                            background: 'hsl(var(--color-accent) / 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'hsl(var(--color-accent))'
                        }}>
                            <RefreshCw size={26} className="spin-animation" />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                            Connecting to Relays...
                        </h4>
                    </div>
                )}

                {/* Step 3: Select Identity & Confirm Join */}
                {step === 'select-identity' && fetchedData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Group Preview Card */}
                        <div className="card" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '1rem 1.25rem',
                            background: 'hsl(var(--color-surface-dim))',
                            border: '1px solid hsl(var(--color-border))',
                            borderRadius: 'var(--radius-lg)'
                        }}>
                            <GroupCardBanner
                                type={fetchedData.group.type}
                                icon={fetchedData.group.icon}
                                color={fetchedData.group.color}
                                size={52}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'hsl(var(--color-text-main))' }}>
                                    {fetchedData.group.name}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))', display: 'flex', gap: '0.8rem', marginTop: '0.2rem' }}>
                                    <span>{fetchedData.members?.length || 0} members</span>
                                    <span>•</span>
                                    <span>{fetchedData.transactions?.length || 0} transactions</span>
                                </div>
                            </div>
                        </div>

                        {/* Member Identity Selector */}
                        <div className="card" style={{
                            padding: '1.25rem',
                            border: '1px solid hsl(var(--color-border))',
                            borderRadius: 'var(--radius-lg)'
                        }}>
                            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.98rem', fontWeight: 700 }}>
                                Which member are you in this group?
                            </h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto' }}>
                                {(fetchedData.members || []).map(member => {
                                    const isSelected = !isNewMember && selectedMemberId === member.id;
                                    return (
                                        <div
                                            key={member.id}
                                            onClick={() => {
                                                setSelectedMemberId(member.id);
                                                setIsNewMember(false);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0.65rem 0.85rem',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                border: isSelected
                                                    ? '2px solid hsl(var(--color-accent))'
                                                    : '1px solid hsl(var(--color-border))',
                                                background: isSelected
                                                    ? 'hsl(var(--color-accent) / 0.08)'
                                                    : 'hsl(var(--color-surface))'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <User size={16} style={{ color: isSelected ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))' }} />
                                                <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.9rem' }}>
                                                    {member.name}
                                                </span>
                                                {member.email && (
                                                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--color-text-muted))' }}>
                                                        ({member.email})
                                                    </span>
                                                )}
                                            </div>
                                            {isSelected && <CheckCircle2 size={18} style={{ color: 'hsl(var(--color-accent))' }} />}
                                        </div>
                                    );
                                })}

                                {/* Option: Create new member name */}
                                <div
                                    onClick={() => setIsNewMember(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.65rem 0.85rem',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        border: isNewMember
                                            ? '2px solid hsl(var(--color-accent))'
                                            : '1px dashed hsl(var(--color-border))',
                                        background: isNewMember
                                            ? 'hsl(var(--color-accent) / 0.08)'
                                            : 'transparent'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Users size={16} style={{ color: isNewMember ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))' }} />
                                        <span style={{ fontWeight: isNewMember ? 700 : 500, fontSize: '0.9rem' }}>
                                            + I am a new member not listed above
                                        </span>
                                    </div>
                                    {isNewMember && <CheckCircle2 size={18} style={{ color: 'hsl(var(--color-accent))' }} />}
                                </div>
                            </div>

                            {isNewMember && (
                                <div style={{ marginTop: '0.85rem' }}>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Enter your name..."
                                        value={newMemberName}
                                        onChange={(e) => setNewMemberName(e.target.value)}
                                        autoFocus
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setStep('input')}
                                disabled={isJoining}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleConfirmJoin}
                                disabled={isJoining || (!selectedMemberId && (!isNewMember || !newMemberName.trim()))}
                                style={{ minWidth: '130px' }}
                            >
                                {isJoining ? (
                                    <>
                                        <RefreshCw size={15} className="spin-animation" />
                                        <span>Joining...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        <span>Join Group</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
