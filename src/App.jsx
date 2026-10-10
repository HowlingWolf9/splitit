import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ExpenseProvider, useExpenses } from './store/ExpenseContext';
import GroupsView from './components/GroupsView';
import GroupScopeBanner from './components/GroupScopeBanner';
import DashboardSummary from './components/DashboardSummary';
import TransactionList from './components/TransactionList';
import Settings from './components/Settings';
import ExpenseListView from './components/ExpenseListView';
import ExpenseDetailView from './components/ExpenseDetailView';
import SettlementsListView from './components/SettlementsListView';
import SettlementDetailView from './components/SettlementDetailView';
import MembersView from './components/MembersView';
import MemberDetail from './components/MemberDetail';
import BalancesView from './components/BalancesView';
import AllTransactionsView from './components/AllTransactionsView';
import ExpenseForm from './components/ExpenseForm';
import SettlementForm from './components/SettlementForm';
import ErrorBoundary from './components/ErrorBoundary';
import {
    LayoutDashboard,
    Layers,
    Receipt,
    HandCoins,
    Scale,
    Users,
    History,
    Settings as SettingsIcon,
    Plus,
    ChevronDown,
    Check,
    Sparkles,
    Menu,
    X
} from 'lucide-react';

function GroupRouteRedirect() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { setSelectedGroupId } = useExpenses();
    useEffect(() => {
        if (id) {
            setSelectedGroupId(id);
            navigate('/dashboard', { replace: true });
        }
    }, [id, setSelectedGroupId, navigate]);
    return null;
}

function DashboardView({ onEditTransaction, onViewTransaction, onEditSettlement, onViewSettlement }) {
    const { filteredTransactions, selectedGroup } = useExpenses();
    return (
        <div style={{ display: 'grid', gap: '1.75rem' }}>
            <DashboardSummary />
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                            {selectedGroup ? `Recent Activity — ${selectedGroup.name}` : 'Recent Activity'}
                        </h2>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'hsl(var(--color-text-muted))' }}>
                            Latest expenses and settlements
                        </p>
                    </div>
                </div>
                <TransactionList
                    transactions={filteredTransactions}
                    onEditTransaction={onEditTransaction}
                    onViewTransaction={onViewTransaction}
                    onEditSettlement={onEditSettlement}
                    onViewSettlement={onViewSettlement}
                />
            </div>
        </div>
    );
}

function NavigationBar() {
    const { state, setCurrentUserId } = useExpenses();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const userMenuRef = useRef(null);

    const currentUserId = state.currentUserId || state.users[0]?.id;
    const currentUser = state.users.find(u => u.id === currentUserId) || state.users[0];

    useEffect(() => {
        function handleClickOutside(event) {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navLinks = [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/groups', label: 'Groups', icon: Layers },
        { to: '/expenses', label: 'Expenses', icon: Receipt },
        { to: '/settlements', label: 'Settlements', icon: HandCoins },
        { to: '/balances', label: 'Balances', icon: Scale },
        { to: '/members', label: 'Members', icon: Users },
        { to: '/history', label: 'Activity', icon: History },
    ];

    return (
        <header style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'hsl(var(--color-surface) / 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid hsl(var(--color-border))',
            marginBottom: '1.75rem',
            boxShadow: 'var(--shadow-xs)'
        }}>
            <div className="header-container" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '64px',
                gap: '1rem'
            }}>
                {/* Brand Logo */}
                <NavLink
                    to="/dashboard"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        textDecoration: 'none',
                        flexShrink: 0
                    }}
                >
                    <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, hsl(var(--color-accent)), #06b6d4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: 'var(--shadow-glow)'
                    }}>
                        <Sparkles size={19} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{
                            fontSize: '1.25rem',
                            fontWeight: '800',
                            letterSpacing: '-0.5px',
                            lineHeight: 1.1,
                            color: 'hsl(var(--color-text-main))'
                        }}>
                            SplitIt
                        </span>
                    </div>
                </NavLink>

                {/* Desktop Nav Links */}
                <nav className="nav-desktop">
                    {navLinks.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) => `btn-nav-item ${isActive ? 'active' : ''}`}
                                style={({ isActive }) => ({
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.4rem 0.65rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.84rem',
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))',
                                    background: isActive ? 'hsl(var(--color-accent) / 0.1)' : 'transparent',
                                    border: `1px solid ${isActive ? 'hsl(var(--color-accent) / 0.2)' : 'transparent'}`,
                                    transition: 'all var(--transition-fast)',
                                    textDecoration: 'none',
                                    whiteSpace: 'nowrap'
                                })}
                            >
                                <Icon size={15} />
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Right Actions: User Switcher, Settings, Mobile Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                    {/* Viewing User Switcher */}
                    <div style={{ position: 'relative' }} ref={userMenuRef}>
                        <button
                            type="button"
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.38rem 0.65rem',
                                borderRadius: 'var(--radius-md)',
                                background: 'hsl(var(--color-surface-dim))',
                                border: '1px solid hsl(var(--color-border))',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'hsl(var(--color-text-main))',
                                cursor: 'pointer'
                            }}
                            title="Switch viewing user perspective"
                        >
                            <span style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: 'hsl(var(--color-accent))',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.72rem',
                                fontWeight: 800
                            }}>
                                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                            </span>
                            <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {currentUser?.name || 'User'}
                            </span>
                            <ChevronDown size={14} style={{ color: 'hsl(var(--color-text-muted))' }} />
                        </button>

                        {userMenuOpen && (
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                right: 0,
                                background: 'hsl(var(--color-surface))',
                                border: '1px solid hsl(var(--color-border))',
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: 'var(--shadow-xl)',
                                minWidth: '200px',
                                zIndex: 110,
                                overflow: 'hidden',
                                animation: 'scaleIn 120ms ease-out'
                            }}>
                                <div style={{
                                    padding: '0.6rem 0.85rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    color: 'hsl(var(--color-text-muted))',
                                    borderBottom: '1px solid hsl(var(--color-border-subtle))'
                                }}>
                                    Viewing Perspective
                                </div>
                                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                                    {state.users.map(u => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onClick={() => {
                                                setCurrentUserId(u.id);
                                                setUserMenuOpen(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '0.55rem 0.85rem',
                                                fontSize: '0.85rem',
                                                background: u.id === currentUserId ? 'hsl(var(--color-accent) / 0.1)' : 'transparent',
                                                color: u.id === currentUserId ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-main))',
                                                fontWeight: u.id === currentUserId ? 700 : 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                border: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    background: 'hsl(var(--color-surface-dim))',
                                                    border: '1px solid hsl(var(--color-border))',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700
                                                }}>
                                                    {u.name.charAt(0)}
                                                </span>
                                                {u.name}
                                            </span>
                                            {u.id === currentUserId && <Check size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Settings Icon Link */}
                    <NavLink
                        to="/settings"
                        className="btn-icon"
                        title="Settings"
                        style={({ isActive }) => ({
                            background: isActive ? 'hsl(var(--color-surface-dim))' : 'transparent',
                            color: isActive ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))'
                        })}
                    >
                        <SettingsIcon size={18} />
                    </NavLink>

                    {/* Mobile Menu Toggle Button */}
                    <button
                        type="button"
                        className="btn-icon mobile-menu-btn"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        title="Toggle navigation menu"
                        style={{
                            background: mobileMenuOpen ? 'hsl(var(--color-surface-dim))' : 'transparent',
                            color: mobileMenuOpen ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))'
                        }}
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation Dropdown */}
            {mobileMenuOpen && (
                <div style={{
                    padding: '0.75rem 1.5rem 1rem',
                    borderTop: '1px solid hsl(var(--color-border-subtle))',
                    display: 'grid',
                    gap: '0.35rem',
                    background: 'hsl(var(--color-surface))',
                    animation: 'scaleIn 150ms ease-out'
                }}>
                    {navLinks.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setMobileMenuOpen(false)}
                                style={({ isActive }) => ({
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.65rem',
                                    padding: '0.6rem 0.85rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.88rem',
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-main))',
                                    background: isActive ? 'hsl(var(--color-accent) / 0.1)' : 'transparent',
                                    textDecoration: 'none'
                                })}
                            >
                                <Icon size={17} />
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </div>
            )}
        </header>
    );
}

function ExpenseApp() {
    const { selectedGroupId } = useExpenses();
    const location = useLocation();
    const [viewingTransaction, setViewingTransaction] = useState(null);
    const [viewingSettlement, setViewingSettlement] = useState(null);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [editingSettlement, setEditingSettlement] = useState(null);

    const handleEditTransaction = (transaction) => {
        setEditingTransaction(transaction);
    };

    const handleEditSettlement = (settlement) => {
        setEditingSettlement(settlement);
    };

    const handleViewTransaction = (transaction) => {
        setViewingTransaction(transaction);
    };

    const handleViewSettlement = (settlement) => {
        setViewingSettlement(settlement);
    };

    // Show GroupScopeBanner except on the main groups list where group cards already represent each scope
    const showScopeBanner = location.pathname !== '/groups' && location.pathname !== '/';

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <NavigationBar />

            <main className="container" style={{ flex: 1, paddingBottom: '6rem' }}>
                {showScopeBanner && <div className="print-hide"><GroupScopeBanner /></div>}

                <Routes>
                    <Route path="/" element={<DashboardView onEditTransaction={handleEditTransaction} onViewTransaction={handleViewTransaction} onEditSettlement={handleEditSettlement} onViewSettlement={handleViewSettlement} />} />
                    <Route path="/dashboard" element={<DashboardView onEditTransaction={handleEditTransaction} onViewTransaction={handleViewTransaction} onEditSettlement={handleEditSettlement} onViewSettlement={handleViewSettlement} />} />
                    <Route path="/groups" element={<GroupsView />} />
                    <Route path="/groups/:id" element={<GroupRouteRedirect />} />
                    <Route path="/expenses" element={<ExpenseListView onViewTransaction={handleViewTransaction} onEditTransaction={handleEditTransaction} />} />
                    <Route path="/settlements" element={<SettlementsListView onViewSettlement={handleViewSettlement} onEditSettlement={handleEditSettlement} />} />
                    <Route path="/history" element={<AllTransactionsView onViewTransaction={handleViewTransaction} onViewSettlement={handleViewSettlement} />} />
                    <Route path="/members" element={<MembersView />} />
                    <Route path="/members/:id" element={<MemberDetail onEditTransaction={handleEditTransaction} onViewTransaction={handleViewTransaction} onEditSettlement={handleEditSettlement} onViewSettlement={handleViewSettlement} />} />
                    <Route path="/balances" element={<BalancesView />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </main>

            {/* View Transaction Modal */}
            {viewingTransaction && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setViewingTransaction(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '640px' }}>
                        <ExpenseDetailView
                            expense={viewingTransaction}
                            onClose={() => setViewingTransaction(null)}
                            onEdit={() => {
                                const exp = viewingTransaction;
                                setViewingTransaction(null);
                                setEditingTransaction(exp);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* View Settlement Modal */}
            {viewingSettlement && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setViewingSettlement(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '560px' }}>
                        <SettlementDetailView
                            settlement={viewingSettlement}
                            onClose={() => setViewingSettlement(null)}
                            onEdit={() => {
                                const stl = viewingSettlement;
                                setViewingSettlement(null);
                                setEditingSettlement(stl);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Edit Expense Modal */}
            {editingTransaction && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setEditingTransaction(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '800px' }}>
                        <ExpenseForm
                            editingTransaction={editingTransaction}
                            onCancel={() => setEditingTransaction(null)}
                            onSuccess={() => setEditingTransaction(null)}
                        />
                    </div>
                </div>
            )}

            {/* Edit Settlement Modal */}
            {editingSettlement && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setEditingSettlement(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <SettlementForm
                            editingSettlement={editingSettlement}
                            onCancel={() => setEditingSettlement(null)}
                            onSuccess={() => setEditingSettlement(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function App() {
    return (
        <React.StrictMode>
            <ErrorBoundary>
                <ExpenseProvider>
                    <BrowserRouter>
                        <ExpenseApp />
                    </BrowserRouter>
                </ExpenseProvider>
            </ErrorBoundary>
        </React.StrictMode>
    );
}
