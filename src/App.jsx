import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { ExpenseProvider, useExpenses } from './store/ExpenseContext';
import { initVisualViewport, popBackAction, useModalBackHandler } from './utils/backButton';
import GroupsView from './components/GroupsView';
import GroupDetailView from './components/GroupDetailView';
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
    ArrowLeft,
    Menu,
    X
} from 'lucide-react';

function DashboardView({ onEditTransaction, onViewTransaction, onEditSettlement, onViewSettlement }) {
    const { filteredTransactions, selectedGroup } = useExpenses();
    return (
        <div style={{ display: 'grid', gap: '1.5rem', width: '100%', minWidth: 0 }}>
            <DashboardSummary />
            <div style={{ width: '100%', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', minWidth: 0, gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'hsl(var(--color-text-main))' }}>
                            {selectedGroup ? `Recent Activity — ${selectedGroup.name}` : 'Recent Activity'}
                        </h2>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'hsl(var(--color-text-muted))' }}>
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

/**
 * Native Android Top App Bar for Mobile Viewports (< 768px).
 * Displays contextual back arrow inside detail views (GroupDetailView, MemberDetail)
 * or brand identity + perspective switcher on root views.
 */
function MobileTopAppBar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { state, setCurrentUserId, selectedGroup } = useExpenses();
    const [perspectiveSheetOpen, setPerspectiveSheetOpen] = useState(false);

    useModalBackHandler(perspectiveSheetOpen, () => setPerspectiveSheetOpen(false));

    const currentUserId = state.currentUserId || state.users[0]?.id;
    const currentUser = state.users.find(u => u.id === currentUserId) || state.users[0];

    const path = location.pathname;
    const isGroupDetail = path.startsWith('/groups/') && path !== '/groups';
    const isMemberDetail = path.startsWith('/members/') && path !== '/members';

    // Detail context
    let detailTitle = '';
    let backTarget = '/dashboard';

    if (isGroupDetail) {
        const groupId = path.split('/')[2];
        const group = (state.groups || []).find(g => g.id === groupId);
        detailTitle = group ? group.name : 'Group Details';
        backTarget = '/groups';
    } else if (isMemberDetail) {
        const memberId = path.split('/')[2];
        const member = (state.users || []).find(u => u.id === memberId);
        detailTitle = member ? member.name : 'Member Details';
        backTarget = '/members';
    }

    const isDetailView = isGroupDetail || isMemberDetail;

    return (
        <>
            <header className="top-app-bar-mobile">
                {isDetailView ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                        <button
                            type="button"
                            onClick={() => navigate(backTarget)}
                            className="btn-icon"
                            style={{ minWidth: '48px', minHeight: '48px', color: 'hsl(var(--color-text-main))' }}
                            title="Back"
                        >
                            <ArrowLeft size={22} />
                        </button>
                        <h1 style={{
                            margin: 0,
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'hsl(var(--color-text-main))'
                        }}>
                            {detailTitle}
                        </h1>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flexShrink: 1 }}>
                        <NavLink
                            to="/dashboard"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', flexShrink: 0 }}
                        >
                            <div style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, hsl(var(--color-accent)), #06b6d4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                boxShadow: 'var(--shadow-glow)',
                                flexShrink: 0
                            }}>
                                <Sparkles size={16} />
                            </div>
                            <span style={{
                                fontSize: '1.15rem',
                                fontWeight: '800',
                                letterSpacing: '-0.5px',
                                color: 'hsl(var(--color-text-main))',
                                flexShrink: 0
                            }}>
                                SplitIt
                            </span>
                        </NavLink>
                        {selectedGroup && path === '/dashboard' && (
                            <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-full)',
                                background: `${selectedGroup.color || '#10b981'}20`,
                                color: selectedGroup.color || '#10b981',
                                border: `1px solid ${selectedGroup.color || '#10b981'}35`,
                                maxWidth: '90px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flexShrink: 1
                            }}>
                                {selectedGroup.name}
                            </span>
                        )}
                    </div>
                )}

                {/* Right Top Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    <button
                        type="button"
                        onClick={() => setPerspectiveSheetOpen(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.3rem 0.6rem',
                            minHeight: '40px',
                            borderRadius: 'var(--radius-full)',
                            background: 'hsl(var(--color-surface-dim))',
                            border: '1px solid hsl(var(--color-border))',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'hsl(var(--color-text-main))',
                            cursor: 'pointer'
                        }}
                        title="Switch viewing user perspective"
                    >
                        <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'hsl(var(--color-accent))',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 800
                        }}>
                            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                        </span>
                        <span style={{ maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {currentUser?.name || 'User'}
                        </span>
                        <ChevronDown size={14} style={{ color: 'hsl(var(--color-text-muted))' }} />
                    </button>

                    <NavLink
                        to="/settings"
                        className="btn-icon"
                        title="Settings"
                        style={{ minWidth: '44px', minHeight: '44px' }}
                    >
                        <SettingsIcon size={18} />
                    </NavLink>
                </div>
            </header>

            {/* Mobile Perspective Switcher Bottom Sheet */}
            {perspectiveSheetOpen && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setPerspectiveSheetOpen(false);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '420px', padding: '1.25rem 1.5rem' }}>
                        <div className="bottom-sheet-handle" />
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1rem',
                            paddingBottom: '0.65rem',
                            borderBottom: '1px solid hsl(var(--color-border-subtle))'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Viewing Perspective</h3>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'hsl(var(--color-text-muted))' }}>
                                    Calculate personal balances from this perspective
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPerspectiveSheetOpen(false)}
                                className="btn-icon"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: 'grid', gap: '0.4rem', maxHeight: '50vh', overflowY: 'auto' }}>
                            {state.users.map(u => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => {
                                        setCurrentUserId(u.id);
                                        setPerspectiveSheetOpen(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '0.75rem 1rem',
                                        minHeight: '48px',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.92rem',
                                        background: u.id === currentUserId ? 'hsl(var(--color-accent) / 0.12)' : 'hsl(var(--color-surface-dim))',
                                        color: u.id === currentUserId ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-main))',
                                        fontWeight: u.id === currentUserId ? 800 : 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        border: `1px solid ${u.id === currentUserId ? 'hsl(var(--color-accent) / 0.3)' : 'hsl(var(--color-border))'}`,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <span style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: u.id === currentUserId ? 'hsl(var(--color-accent))' : 'hsl(var(--color-surface))',
                                            color: u.id === currentUserId ? 'white' : 'inherit',
                                            border: '1px solid hsl(var(--color-border))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.78rem',
                                            fontWeight: 800
                                        }}>
                                            {u.name.charAt(0)}
                                        </span>
                                        {u.name}
                                    </span>
                                    {u.id === currentUserId && <Check size={18} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * Desktop Navigation Bar (shown on viewports >= 768px).
 */
function DesktopNavigationBar() {
    const { state, setCurrentUserId } = useExpenses();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
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
        <header className="desktop-header" style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'hsl(var(--color-surface) / 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid hsl(var(--color-border))',
            marginBottom: '1.75rem',
            paddingTop: 'var(--safe-area-top)',
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
                    <span style={{
                        fontSize: '1.25rem',
                        fontWeight: '800',
                        letterSpacing: '-0.5px',
                        lineHeight: 1.1,
                        color: 'hsl(var(--color-text-main))'
                    }}>
                        SplitIt
                    </span>
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
                                    padding: '0.45rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.85rem',
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))',
                                    background: isActive ? 'hsl(var(--color-accent) / 0.1)' : 'transparent',
                                    border: `1px solid ${isActive ? 'hsl(var(--color-accent) / 0.2)' : 'transparent'}`,
                                    transition: 'all var(--transition-fast)',
                                    textDecoration: 'none',
                                    whiteSpace: 'nowrap'
                                })}
                            >
                                <Icon size={16} />
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Right Actions: User Switcher, Settings */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }} ref={userMenuRef}>
                        <button
                            type="button"
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.4rem 0.75rem',
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
                            <span style={{ maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                </div>
            </div>
        </header>
    );
}

/**
 * Fixed Native-Style Bottom Navigation Bar for Mobile Viewports (< 768px).
 * Five primary destinations: Dashboard, Groups, Balances, Transactions, Settings.
 */
function MobileBottomNav() {
    const bottomNavItems = [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/groups', label: 'Groups', icon: Layers },
        { to: '/balances', label: 'Balances', icon: Scale },
        { to: '/history', label: 'Activity', icon: History },
        { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ];

    return (
        <nav className="bottom-nav-bar" aria-label="Mobile Navigation">
            {bottomNavItems.map(item => {
                const Icon = item.icon;
                return (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <div className="bottom-nav-icon-pill">
                            <Icon size={20} strokeWidth={2.2} />
                        </div>
                        <span>{item.label}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
}

function ExpenseApp() {
    const location = useLocation();
    const navigate = useNavigate();
    const { selectedGroupId } = useExpenses();

    const [viewingTransaction, setViewingTransaction] = useState(null);
    const [viewingSettlement, setViewingSettlement] = useState(null);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [editingSettlement, setEditingSettlement] = useState(null);
    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [isAddingSettlement, setIsAddingSettlement] = useState(false);

    // Register active back button handlers for modals in App
    useModalBackHandler(!!viewingTransaction, () => setViewingTransaction(null));
    useModalBackHandler(!!viewingSettlement, () => setViewingSettlement(null));
    useModalBackHandler(!!editingTransaction, () => setEditingTransaction(null));
    useModalBackHandler(!!editingSettlement, () => setEditingSettlement(null));
    useModalBackHandler(isAddingExpense, () => setIsAddingExpense(false));
    useModalBackHandler(isAddingSettlement, () => setIsAddingSettlement(false));

    // Hardware Back Button Integration via Capacitor
    useEffect(() => {
        const cleanupViewport = initVisualViewport();

        let listenerHandle;
        try {
            CapApp.addListener('backButton', () => {
                // 1. Close any open modal or bottom sheet first
                const closedModal = popBackAction();
                if (closedModal) return;

                // 2. Navigate back from detail views to parent list
                const path = location.pathname;
                if (path.startsWith('/groups/') && path !== '/groups') {
                    navigate('/groups');
                } else if (path.startsWith('/members/') && path !== '/members') {
                    navigate('/members');
                } else if (path !== '/' && path !== '/dashboard') {
                    // 3. Navigate back to dashboard tab
                    navigate('/dashboard');
                } else {
                    // 4. Exit / minimize app if already on root Dashboard
                    CapApp.minimizeApp();
                }
            }).then(handle => {
                listenerHandle = handle;
            }).catch(err => {
                console.warn('Capacitor BackButton not attached:', err);
            });
        } catch (err) {
            console.warn('Capacitor App listener not active:', err);
        }

        return () => {
            cleanupViewport();
            if (listenerHandle?.remove) {
                listenerHandle.remove();
            }
        };
    }, [location.pathname, navigate]);

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

    // Show GroupScopeBanner except on the main groups list and root
    const showScopeBanner = location.pathname !== '/groups' &&
        location.pathname !== '/' &&
        !location.pathname.startsWith('/groups/');

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
            {/* Desktop Navigation */}
            <DesktopNavigationBar />

            {/* Mobile Native Top App Bar */}
            <MobileTopAppBar />

            <main className="container" style={{ flex: 1 }}>
                {showScopeBanner && <div className="print-hide"><GroupScopeBanner /></div>}

                <Routes>
                    <Route path="/" element={<DashboardView onEditTransaction={handleEditTransaction} onViewTransaction={handleViewTransaction} onEditSettlement={handleEditSettlement} onViewSettlement={handleViewSettlement} />} />
                    <Route path="/dashboard" element={<DashboardView onEditTransaction={handleEditTransaction} onViewTransaction={handleViewTransaction} onEditSettlement={handleEditSettlement} onViewSettlement={handleViewSettlement} />} />
                    <Route path="/groups" element={<GroupsView />} />
                    <Route path="/groups/:id" element={<GroupDetailView />} />
                    <Route path="/expenses" element={<ExpenseListView onViewTransaction={handleViewTransaction} onEditTransaction={handleEditTransaction} />} />
                    <Route path="/settlements" element={<SettlementsListView onViewSettlement={handleViewSettlement} onEditSettlement={handleEditSettlement} />} />
                    <Route path="/history" element={<AllTransactionsView onViewTransaction={handleViewTransaction} onViewSettlement={handleViewSettlement} />} />
                    <Route path="/transactions" element={<AllTransactionsView onViewTransaction={handleViewTransaction} onViewSettlement={handleViewSettlement} />} />
                    <Route path="/members" element={<MembersView />} />
                    <Route path="/members/:id" element={<MemberDetail onEditTransaction={handleEditTransaction} onViewTransaction={handleViewTransaction} onEditSettlement={handleEditSettlement} onViewSettlement={handleViewSettlement} />} />
                    <Route path="/balances" element={<BalancesView />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </main>

            {/* Quick Actions FAB positioned above Bottom Navigation Bar */}
            <div className="fab-container">
                <button
                    type="button"
                    className="fab fab-secondary"
                    onClick={() => setIsAddingSettlement(true)}
                    title="Quick Record Settlement"
                >
                    <HandCoins size={18} strokeWidth={2.4} />
                    <span>Record Settlement</span>
                </button>
                <button
                    type="button"
                    className="fab fab-primary"
                    onClick={() => setIsAddingExpense(true)}
                    title="Quick Add Expense"
                >
                    <Plus size={20} strokeWidth={2.6} />
                    <span>Add Expense</span>
                </button>
            </div>

            {/* Native Mobile Bottom Navigation Bar */}
            <MobileBottomNav />

            {/* Quick Record Settlement Bottom Sheet */}
            {isAddingSettlement && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsAddingSettlement(false);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <div className="bottom-sheet-handle" />
                        <SettlementForm
                            onCancel={() => setIsAddingSettlement(false)}
                            onSuccess={() => setIsAddingSettlement(false)}
                            defaultGroupId={selectedGroupId === 'non-group' ? null : selectedGroupId}
                        />
                    </div>
                </div>
            )}

            {/* Quick Add Expense Bottom Sheet */}
            {isAddingExpense && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsAddingExpense(false);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '800px' }}>
                        <div className="bottom-sheet-handle" />
                        <ExpenseForm
                            onCancel={() => setIsAddingExpense(false)}
                            onSuccess={() => setIsAddingExpense(false)}
                            defaultGroupId={selectedGroupId === 'non-group' ? null : selectedGroupId}
                        />
                    </div>
                </div>
            )}

            {/* View Transaction Bottom Sheet */}
            {viewingTransaction && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setViewingTransaction(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '640px' }}>
                        <div className="bottom-sheet-handle" />
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

            {/* View Settlement Bottom Sheet */}
            {viewingSettlement && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setViewingSettlement(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '560px' }}>
                        <div className="bottom-sheet-handle" />
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

            {/* Edit Expense Bottom Sheet */}
            {editingTransaction && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setEditingTransaction(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '800px' }}>
                        <div className="bottom-sheet-handle" />
                        <ExpenseForm
                            editingTransaction={editingTransaction}
                            onCancel={() => setEditingTransaction(null)}
                            onSuccess={() => setEditingTransaction(null)}
                        />
                    </div>
                </div>
            )}

            {/* Edit Settlement Bottom Sheet */}
            {editingSettlement && (
                <div
                    className="modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setEditingSettlement(null);
                    }}
                >
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <div className="bottom-sheet-handle" />
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
