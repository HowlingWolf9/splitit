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
                    <div key={u.id} style={{
                        padding: '0.5rem 1rem',
                        background: 'hsl(var(--color-bg))',
                        borderRadius: '2rem',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'hsl(var(--color-accent))' }}></div>
                        {u.name}
                        <button
                            onClick={() => handleDelete(u.id, u.name)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'hsl(var(--color-danger))',
                                cursor: 'pointer',
                                padding: '0.2rem',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title="Remove user"
                        >
                            <X size={14} />
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
                />
                <button className="btn btn-primary" type="submit"><UserPlus size={16} /></button>
            </form>
        </div>
    );
}
