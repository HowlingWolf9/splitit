import React, { useState, useMemo } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { useModalBackHandler } from '../utils/backButton';
import { X, User, Mail, AlertTriangle, GitMerge, Check } from 'lucide-react';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export default function MemberEditModal({ member, onClose, onSuccess, onOpenMerge }) {
    useModalBackHandler(true, onClose);
    const { state, updateUser } = useExpenses();

    const [name, setName] = useState(member?.name || '');
    const [email, setEmail] = useState(member?.email || '');
    const [error, setError] = useState('');

    const trimmedEmail = email.trim();
    const isEmailValid = !trimmedEmail || EMAIL_REGEX.test(trimmedEmail);

    // Detect duplicate email across other members
    const duplicateUser = useMemo(() => {
        if (!trimmedEmail || !isEmailValid) return null;
        const lower = trimmedEmail.toLowerCase();
        return (state.users || []).find(
            u => u.id !== member?.id && u.email && u.email.toLowerCase().trim() === lower
        );
    }, [trimmedEmail, isEmailValid, state.users, member?.id]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmedName = name.trim();

        if (!trimmedName) {
            setError('Please enter a member name.');
            return;
        }

        if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
            setError('Please enter a valid email address (e.g., alex@example.com).');
            return;
        }

        const finalEmail = trimmedEmail || null;
        updateUser(member.id, {
            name: trimmedName,
            email: finalEmail
        });

        if (onSuccess) {
            onSuccess({
                ...member,
                name: trimmedName,
                email: finalEmail
            });
        }
        onClose();
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
                    maxWidth: '480px',
                    padding: '1.25rem 1.5rem',
                    position: 'relative',
                    overflowY: 'auto'
                }}
            >
                <div className="bottom-sheet-handle" />

                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'hsl(var(--color-accent) / 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'hsl(var(--color-accent))'
                        }}>
                            <User size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Edit Member</h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))' }}>
                                Update display name and assigned email
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-icon"
                        title="Close"
                        style={{ color: 'hsl(var(--color-text-muted))', borderRadius: '50%' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div style={{
                        padding: '0.65rem 0.85rem',
                        marginBottom: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'hsl(var(--color-danger) / 0.12)',
                        border: '1px solid hsl(var(--color-danger) / 0.3)',
                        color: 'hsl(var(--color-danger))',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Duplicate Email Warning */}
                {duplicateUser && (
                    <div style={{
                        padding: '0.75rem 0.95rem',
                        marginBottom: '1.25rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'hsl(var(--color-warning, 40 90% 50%) / 0.12)',
                        border: '1px solid hsl(var(--color-warning, 40 90% 50%) / 0.35)',
                        color: 'hsl(var(--color-text-main))',
                        fontSize: '0.84rem',
                        display: 'grid',
                        gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--color-warning, 40 90% 50%))', fontWeight: 700 }}>
                            <AlertTriangle size={16} />
                            <span>Email already in use</span>
                        </div>
                        <div>
                            Another member, <strong>{duplicateUser.name}</strong>, is already using <code>{duplicateUser.email}</code>.
                        </div>
                        {onOpenMerge && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onOpenMerge(member, duplicateUser);
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{
                                    justifyContent: 'center',
                                    gap: '0.45rem',
                                    fontWeight: 700,
                                    borderColor: 'hsl(var(--color-warning, 40 90% 50%) / 0.5)'
                                }}
                            >
                                <GitMerge size={15} />
                                <span>Merge with {duplicateUser.name} instead</span>
                            </button>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.15rem' }}>
                    {/* Name Field */}
                    <div className="form-group">
                        <label className="label" htmlFor="member-edit-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <User size={15} />
                            <span>Full Name *</span>
                        </label>
                        <input
                            id="member-edit-name"
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="e.g., Alex Johnson"
                            className="input"
                            autoFocus
                            required
                        />
                    </div>

                    {/* Email Field */}
                    <div className="form-group">
                        <label className="label" htmlFor="member-edit-email" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Mail size={15} />
                            <span>Email Address (Optional)</span>
                        </label>
                        <input
                            id="member-edit-email"
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="e.g., alex@example.com"
                            className="input"
                        />
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.3rem', display: 'block' }}>
                            Used for identity matching when joining shared groups and communication.
                        </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid hsl(var(--color-border))' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!name.trim() || (trimmedEmail && !isEmailValid)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            <Check size={16} />
                            <span>Save Changes</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
