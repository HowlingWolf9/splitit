import React, { useState } from 'react';
import { useExpenses } from '../store/ExpenseContext';
import { UserPlus, User, X } from 'lucide-react';

export default function UserList() {
    const { state, addUser, deleteUser } = useExpenses();
    const [name, setName] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (name.trim()) {
            addUser(name.trim());
            setName('');
        }
    };

    const handleDelete = (userId, userName) => {
        if (confirm(`Are you sure you want to remove ${userName}? Their transaction history will be preserved.`)) {
            deleteUser(userId);
        }
    };

    const users = state.users || [];
    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="card">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={20} /> Members
            </h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {sortedUsers.map(u => (
                    <div
                        key={u.id}
                        className="card-interactive"
                        style={{
                            padding: '0.45rem 0.85rem',
                            background: 'hsl(var(--color-bg))',
                            border: '1px solid hsl(var(--color-border))',
                            borderRadius: '2rem',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            minHeight: '44px'
                        }}
                    >
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'hsl(var(--color-accent))' }}></div>
                        <span style={{ fontWeight: 600 }}>{u.name}</span>
                        <button
                            onClick={() => handleDelete(u.id, u.name)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'hsl(var(--color-danger))',
                                cursor: 'pointer',
                                padding: '0.4rem',
                                minWidth: '36px',
                                minHeight: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%'
                            }}
                            title="Remove user"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                    className="input"
                    placeholder="New member..."
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ minHeight: '48px' }}
                />
                <button className="btn btn-primary" type="submit" style={{ minWidth: '48px', minHeight: '48px' }} title="Add member">
                    <UserPlus size={18} />
                </button>
            </form>
        </div>
    );
}
