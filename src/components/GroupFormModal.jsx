import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { useModalBackHandler } from '../utils/backButton';
import { X, Users, Plane, ClipboardList, Home, Heart, Sparkles, Plus, Check, HandCoins, Radio } from 'lucide-react';
import JoinSharedGroupModal from './JoinSharedGroupModal';
import multiSync from '../services/multiUserSync';

const GROUP_TYPES = [
    { id: 'trip', label: 'Trip', icon: Plane, defaultColor: '#10b981' },
    { id: 'project', label: 'Project / Exam', icon: ClipboardList, defaultColor: '#f97316' },
    { id: 'home', label: 'Home / Apartment', icon: Home, defaultColor: '#3b82f6' },
    { id: 'couple', label: 'Couple', icon: Heart, defaultColor: '#ec4899' },
    { id: 'event', label: 'Event / Party', icon: Sparkles, defaultColor: '#8b5cf6' },
    { id: 'other', label: 'Other', icon: Users, defaultColor: '#14b8a6' },
];

const PRESET_COLORS = [
    '#10b981', // Emerald
    '#f97316', // Orange
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#eab308', // Amber
    '#ef4444', // Red
];

export default function GroupFormModal({ groupToEdit = null, onClose, onSuccess }) {
    useModalBackHandler(true, onClose);
    const { state, addGroup, updateGroup, addUser, enableGroupSync } = useExpenses();
    const isEditing = !!groupToEdit;

    const [name, setName] = useState(groupToEdit?.name || '');
    const [type, setType] = useState(groupToEdit?.type || 'trip');
    const [color, setColor] = useState(groupToEdit?.color || '#10b981');
    const [simplifyDebts, setSimplifyDebts] = useState(groupToEdit?.simplifyDebts ?? true);
    const [defaultCollectorId, setDefaultCollectorId] = useState(groupToEdit?.defaultCollectorId || '');
    const [enableLiveSync, setEnableLiveSync] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);


    // Selected member IDs
    const [selectedMembers, setSelectedMembers] = useState(() => {
        if (groupToEdit?.members) {
            return groupToEdit.members;
        }
        // By default select all existing members or current user
        return state.users.map(u => u.id);
    });

    // New member inline creation
    const [newMemberName, setNewMemberName] = useState('');
    const [error, setError] = useState('');

    const handleTypeChange = (newType) => {
        setType(newType);
        const typeConfig = GROUP_TYPES.find(t => t.id === newType);
        if (typeConfig && !groupToEdit) {
            setColor(typeConfig.defaultColor);
        }
    };

    const handleToggleMember = (userId) => {
        if (selectedMembers.includes(userId)) {
            if (selectedMembers.length === 1) {
                setError('Group must have at least one member');
                return;
            }
            setSelectedMembers(selectedMembers.filter(id => id !== userId));
            if (defaultCollectorId === userId) {
                setDefaultCollectorId('');
            }
        } else {
            setSelectedMembers([...selectedMembers, userId]);
        }
        setError('');
    };

    const handleAddNewMember = (e) => {
        e.preventDefault();
        const trimmed = newMemberName.trim();
        if (!trimmed) return;

        // Check if user already exists
        const existing = state.users.find(u => u.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
            if (!selectedMembers.includes(existing.id)) {
                setSelectedMembers([...selectedMembers, existing.id]);
            }
            setNewMemberName('');
            return;
        }

        const newId = addUser(trimmed);
        if (newId) {
            setSelectedMembers(prev => [...prev, newId]);
            setNewMemberName('');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Please enter a group name');
            return;
        }
        if (selectedMembers.length === 0) {
            setError('Please select at least one member for this group');
            return;
        }

        // Determine icon from type
        const typeObj = GROUP_TYPES.find(t => t.id === type);
        const icon = typeObj ? type : 'users';

        if (isEditing) {
            updateGroup(groupToEdit.id, {
                name: name.trim(),
                type,
                icon,
                color,
                members: selectedMembers,
                simplifyDebts,
                defaultCollectorId: defaultCollectorId || null,
            });
            onSuccess(groupToEdit.id);
        } else {
            const secret = enableLiveSync ? multiSync.generateSyncSecret() : null;
            const groupData = {
                name: name.trim(),
                type,
                icon,
                color,
                members: selectedMembers,
                simplifyDebts,
                defaultCollectorId: defaultCollectorId || null,
                isShared: !!enableLiveSync,
                syncSecret: secret,
            };
            const newGroupId = addGroup(groupData);
            if (enableLiveSync) {
                enableGroupSync(newGroupId, secret, {
                    ...groupData,
                    id: newGroupId,
                });
            }
            onSuccess(newGroupId);
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="modal-content"
                style={{
                    maxWidth: '540px',
                    padding: '1.25rem 1.5rem',
                    position: 'relative',
                    overflowY: 'auto',
                }}
            >
                <div className="bottom-sheet-handle" />
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700' }}>
                        {isEditing ? 'Edit Group' : 'Start a New Group'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="btn-icon"
                        title="Close"
                        style={{
                            color: 'hsl(var(--color-text-muted))',
                            borderRadius: '50%',
                        }}
                    >
                        <X size={22} />
                    </button>
                </div>

                {!isEditing && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'hsl(var(--color-accent) / 0.08)',
                        border: '1px solid hsl(var(--color-accent) / 0.25)',
                        marginBottom: '1rem',
                        gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'hsl(var(--color-text-main))' }}>
                            <Radio size={14} style={{ color: 'hsl(var(--color-accent))', flexShrink: 0 }} />
                            <span>Have a friend's Group Invite Code?</span>
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                                padding: '0.2rem 0.6rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                background: 'hsl(var(--color-accent))',
                                color: '#fff',
                                whiteSpace: 'nowrap'
                            }}
                            onClick={() => setShowJoinModal(true)}
                        >
                            Join Group
                        </button>
                    </div>
                )}

                {error && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'hsl(var(--color-danger) / 0.1)',
                        border: '1px solid hsl(var(--color-danger))',
                        color: 'hsl(var(--color-danger))',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.9rem',
                        marginBottom: '1rem'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
                    {/* Group Name */}
                    <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                            Group Name *
                        </label>
                        <input
                            type="text"
                            className="input"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            placeholder="e.g. Goa Trip 2026, Apartment 302, Office Lunch"
                            autoFocus
                            required
                        />
                    </div>

                    {/* Group Type / Category */}
                    <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                            Group Type
                        </label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '0.5rem'
                        }}>
                            {GROUP_TYPES.map(gt => {
                                const Icon = gt.icon;
                                const isSelected = type === gt.id;
                                return (
                                    <button
                                        key={gt.id}
                                        type="button"
                                        onClick={() => handleTypeChange(gt.id)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            padding: '0.75rem 0.5rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: `2px solid ${isSelected ? gt.defaultColor : 'hsl(var(--color-text-muted) / 0.2)'}`,
                                            background: isSelected ? `${gt.defaultColor}15` : 'hsl(var(--color-surface-dim))',
                                            color: isSelected ? gt.defaultColor : 'hsl(var(--color-text-main))',
                                            fontWeight: isSelected ? '700' : '500',
                                            fontSize: '0.82rem',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                    >
                                        <Icon size={20} />
                                        <span>{gt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Color Theme */}
                    <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                            Theme Color
                        </label>
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                            {PRESET_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: c,
                                        border: color === c ? '3px solid white' : '2px solid transparent',
                                        boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'transform var(--transition-fast)'
                                    }}
                                >
                                    {color === c && <Check size={16} color="#ffffff" strokeWidth={3} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Group Members Selection */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                                Group Members ({selectedMembers.length} selected)
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMembers(state.users.map(u => u.id))}
                                    style={{ color: 'hsl(var(--color-accent))', fontWeight: '600' }}
                                >
                                    Select All
                                </button>
                                <span>•</span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMembers([state.currentUserId || state.users[0]?.id])}
                                    style={{ color: 'hsl(var(--color-text-muted))' }}
                                >
                                    Only Me
                                </button>
                            </div>
                        </div>

                        <div style={{
                            maxHeight: '180px',
                            overflowY: 'auto',
                            border: '1px solid hsl(var(--color-text-muted) / 0.2)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.5rem',
                            display: 'grid',
                            gap: '0.35rem',
                            background: 'hsl(var(--color-surface-dim))'
                        }}>
                            {state.users.map(user => {
                                const isChecked = selectedMembers.includes(user.id);
                                const isYou = user.id === state.currentUserId;
                                return (
                                    <div
                                        key={user.id}
                                        onClick={() => handleToggleMember(user.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: isChecked ? 'hsl(var(--color-accent) / 0.1)' : 'transparent',
                                            border: isChecked ? '1px solid hsl(var(--color-accent) / 0.3)' : '1px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'background var(--transition-fast)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: 'hsl(var(--color-primary) / 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.8rem',
                                                fontWeight: '700'
                                            }}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontWeight: isChecked ? '600' : '400' }}>
                                                {user.name} {isYou && <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>(You)</span>}
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {}} // handled by parent div
                                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'hsl(var(--color-accent))' }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Inline add new member */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <input
                                type="text"
                                className="input"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                placeholder="+ Add a new friend to this group"
                                style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddNewMember(e);
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="btn"
                                onClick={handleAddNewMember}
                                style={{ padding: '0.5rem 1rem', fontSize: '0.88rem', flexShrink: 0 }}
                            >
                                <Plus size={16} /> Add
                            </button>
                        </div>
                    </div>

                    {/* Simplify Debts Toggle */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: 'hsl(var(--color-surface-dim))',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid hsl(var(--color-text-muted) / 0.15)'
                    }}>
                        <div>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Simplify Group Debts</div>
                        </div>
                        <input
                            type="checkbox"
                            checked={simplifyDebts}
                            onChange={(e) => setSimplifyDebts(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--color-accent))', cursor: 'pointer' }}
                        />
                    </div>

                    {/* Default Primary Collector */}
                    <div style={{
                        padding: '0.85rem 1rem',
                        background: 'hsl(var(--color-surface-dim))',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid hsl(var(--color-text-muted) / 0.15)'
                    }}>
                        <div style={{ marginBottom: '0.45rem' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <HandCoins size={16} style={{ color: 'hsl(var(--color-accent))' }} />
                                <span>Default Primary Collector (Optional)</span>
                            </div>
                        </div>
                        <select
                            className="input"
                            value={defaultCollectorId}
                            onChange={(e) => setDefaultCollectorId(e.target.value)}
                            style={{ background: 'hsl(var(--color-surface))' }}
                        >
                            <option value="">None (No default collector)</option>
                            {selectedMembers.map(mId => {
                                const u = state.users.find(u => u.id === mId);
                                if (!u) return null;
                                return (
                                    <option key={u.id} value={u.id}>
                                        {u.name} {u.id === state.currentUserId ? '(You)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Multi-User Live Sync Option */}
                    {!isEditing && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.85rem 1rem',
                                background: 'hsl(var(--color-surface-dim))',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid hsl(var(--color-border))',
                                cursor: 'pointer',
                                gap: '0.75rem'
                            }}
                            onClick={() => setEnableLiveSync(prev => !prev)}
                        >
                            <div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    <Radio size={16} style={{ color: 'hsl(var(--color-success))' }} />
                                    <span>Enable Multi-User Live Sync</span>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={enableLiveSync}
                                onChange={(e) => setEnableLiveSync(e.target.checked)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--color-accent))', cursor: 'pointer' }}
                            />
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn"
                            style={{ flex: 1, backgroundColor: color || 'hsl(var(--color-accent))' }}
                        >
                            {isEditing ? 'Save Changes' : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>

            {showJoinModal && (
                <JoinSharedGroupModal
                    onClose={() => setShowJoinModal(false)}
                    onSuccess={(newId) => {
                        setShowJoinModal(false);
                        onSuccess(newId);
                    }}
                />
            )}
        </div>
    );
}
