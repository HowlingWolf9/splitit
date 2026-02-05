import React from 'react';
import { useExpenses } from '../store/ExpenseContext';

export default function Dashboard() {
    const { state, getBalances, currencies } = useExpenses();

    const balances = getBalances();
    const users = state.users || [];
    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));
    const currencyInfo = currencies[state.currency] || currencies.USD;

    const formatMoney = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: state.currency
        }).format(val);
    };

    return (
        <div className="card">
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--color-text-muted) / 0.2)', paddingBottom: '0.5rem' }}>Balances</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {users.length === 0 && <span style={{ color: 'hsl(var(--color-text-muted))' }}>No users yet.</span>}
                {sortedUsers.map(user => {
                    const bal = balances[user.id] || 0;
                    const isZero = Math.abs(bal) < 0.01;
                    const color = bal > 0 ? 'hsl(var(--color-success))' : (bal < 0 ? 'hsl(var(--color-danger))' : 'hsl(var(--color-text-muted))');

                    return (
                        <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user.name}</span>
                            <span style={{ color, fontWeight: 'bold', fontSize: '1.0rem' }}>
                                {isZero ? 'Settled' : (bal > 0 ? `gets ${formatMoney(bal)}` : `owes ${formatMoney(Math.abs(bal))}`)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
