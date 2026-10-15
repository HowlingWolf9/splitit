import React, {
    createContext,
    useContext,
    useReducer,
    useEffect,
    useState,
    useRef,
    useCallback,
    useMemo
} from 'react';
import * as gdrive from '../services/googleDriveSync';
import { mergeAppState } from '../services/googleDriveSync';
import * as multiSync from '../services/multiUserSync';
import { mergeGroupSyncPayload } from '../services/multiUserSync';
import { App as CapApp } from '@capacitor/app';


// CURRENCIES
const CURRENCIES = {
    INR: { symbol: '₹', name: 'Indian Rupee' },
    USD: { symbol: '$', name: 'US Dollar' },
    EUR: { symbol: '€', name: 'Euro' },
    GBP: { symbol: '£', name: 'British Pound' },
    JPY: { symbol: '¥', name: 'Japanese Yen' },
    AUD: { symbol: 'A$', name: 'Australian Dollar' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar' },
};

// DEFAULT INITIAL USER (Clean slate for new users)
const defaultUsers = [
    { id: 'u_you', name: 'You', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
];

// STABLE INITIAL STATE WITH DELETED IDS TOMBSTONES
const initialState = {
    users: defaultUsers,
    groups: [],
    currentUserId: 'u_you',
    transactions: [],
    currency: 'INR',
    selectedGroupId: null, // null = All Groups, or 'grp_...' or 'non-group'
    deletedIds: {
        groups: {},
        members: {},
        expenses: {},
        settlements: {}
    }
};

// ACTIONS
const ADD_USER = 'ADD_USER';
const DELETE_USER = 'DELETE_USER';
const ADD_GROUP = 'ADD_GROUP';
const UPDATE_GROUP = 'UPDATE_GROUP';
const DELETE_GROUP = 'DELETE_GROUP';
const SET_SELECTED_GROUP = 'SET_SELECTED_GROUP';
const SET_CURRENT_USER = 'SET_CURRENT_USER';
const ADD_TRANSACTION = 'ADD_TRANSACTION';
const UPDATE_TRANSACTION = 'UPDATE_TRANSACTION';
const DELETE_TRANSACTION = 'DELETE_TRANSACTION';
const SET_CURRENCY = 'SET_CURRENCY';
const IMPORT_DATA = 'IMPORT_DATA';
const MERGE_SYNCED_DATA = 'MERGE_SYNCED_DATA';
const MERGE_GROUP_SYNC_DATA = 'MERGE_GROUP_SYNC_DATA';
const SET_GROUP_MEMBER_IDENTITY = 'SET_GROUP_MEMBER_IDENTITY';
const SET_GROUP_SYNC_CONFIG = 'SET_GROUP_SYNC_CONFIG';

// CONFLICT-FREE STATE MERGER UTILITY
// eslint-disable-next-line react-refresh/only-export-components
export { mergeAppState, mergeGroupSyncPayload };


// REDUCER
function expenseReducer(state, action) {
    switch (action.type) {
        case SET_SELECTED_GROUP:
            return {
                ...state,
                selectedGroupId: action.payload || null
            };
        case ADD_USER: {
            const now = new Date().toISOString();
            const newUser = {
                ...action.payload,
                createdAt: action.payload.createdAt || now,
                updatedAt: action.payload.updatedAt || now
            };
            return {
                ...state,
                users: [...state.users, newUser],
            };
        }
        case DELETE_USER: {
            const now = new Date().toISOString();
            const userId = action.payload;
            return {
                ...state,
                users: state.users.filter(u => u.id !== userId),
                // Remove user from groups and update group timestamp
                groups: (state.groups || []).map(g => ({
                    ...g,
                    members: g.members.filter(mId => mId !== userId),
                    updatedAt: now
                })),
                deletedIds: {
                    ...state.deletedIds,
                    members: { ...(state.deletedIds?.members || {}), [userId]: now }
                },
                currentUserId: state.currentUserId === userId
                    ? (state.users.find(u => u.id !== userId)?.id || '')
                    : state.currentUserId
            };
        }
        case ADD_GROUP: {
            const now = new Date().toISOString();
            const newGroup = {
                ...action.payload,
                createdAt: action.payload.createdAt || now,
                updatedAt: action.payload.updatedAt || now
            };
            return {
                ...state,
                groups: [...(state.groups || []), newGroup]
            };
        }
        case UPDATE_GROUP: {
            const now = new Date().toISOString();
            return {
                ...state,
                groups: (state.groups || []).map(g =>
                    g.id === action.payload.id ? { ...g, ...action.payload, updatedAt: now } : g
                )
            };
        }
        case DELETE_GROUP: {
            const now = new Date().toISOString();
            const groupIdToDelete = action.payload;
            return {
                ...state,
                selectedGroupId: state.selectedGroupId === groupIdToDelete ? null : state.selectedGroupId,
                groups: (state.groups || []).filter(g => g.id !== groupIdToDelete),
                deletedIds: {
                    ...state.deletedIds,
                    groups: { ...(state.deletedIds?.groups || {}), [groupIdToDelete]: now }
                },
                // Reassign transactions of deleted group to non-group
                transactions: (state.transactions || []).map(t =>
                    t.groupId === groupIdToDelete ? { ...t, groupId: null, updatedAt: now } : t
                )
            };
        }
        case SET_CURRENT_USER:
            return {
                ...state,
                currentUserId: action.payload
            };
        case ADD_TRANSACTION: {
            const now = new Date().toISOString();
            const newTx = {
                ...action.payload,
                createdAt: action.payload.createdAt || now,
                updatedAt: action.payload.updatedAt || now
            };
            return {
                ...state,
                transactions: [newTx, ...state.transactions]
            };
        }
        case UPDATE_TRANSACTION: {
            const now = new Date().toISOString();
            return {
                ...state,
                transactions: state.transactions.map(t =>
                    t.id === action.payload.id
                        ? {
                            ...t,
                            ...action.payload,
                            createdAt: t.createdAt || now,
                            updatedAt: now
                        }
                        : t
                )
            };
        }
        case DELETE_TRANSACTION: {
            const now = new Date().toISOString();
            const txId = action.payload;
            const existingTx = (state.transactions || []).find(t => t.id === txId);
            const isSettlement = existingTx?.type === 'SETTLEMENT';
            return {
                ...state,
                transactions: state.transactions.filter(t => t.id !== txId),
                deletedIds: {
                    ...state.deletedIds,
                    expenses: isSettlement
                        ? (state.deletedIds?.expenses || {})
                        : { ...(state.deletedIds?.expenses || {}), [txId]: now },
                    settlements: isSettlement
                        ? { ...(state.deletedIds?.settlements || {}), [txId]: now }
                        : (state.deletedIds?.settlements || {})
                }
            };
        }
        case SET_CURRENCY:
            return {
                ...state,
                currency: action.payload
            };
        case MERGE_SYNCED_DATA: {
            const payload = action.payload || {};
            return {
                ...state,
                users: payload.users || state.users,
                groups: payload.groups || state.groups,
                transactions: payload.transactions || state.transactions,
                deletedIds: payload.deletedIds || state.deletedIds,
                currency: payload.currency || state.currency,
                currentUserId: state.currentUserId,
                selectedGroupId: state.selectedGroupId
            };
        }
        case MERGE_GROUP_SYNC_DATA: {
            return mergeGroupSyncPayload(state, action.payload, action.myMemberId);
        }
        case SET_GROUP_MEMBER_IDENTITY: {
            const { groupId, memberId } = action.payload;
            const now = new Date().toISOString();
            return {
                ...state,
                groups: (state.groups || []).map(g =>
                    g.id === groupId ? { ...g, myMemberId: memberId, updatedAt: now } : g
                )
            };
        }
        case SET_GROUP_SYNC_CONFIG: {
            const { groupId, isShared, syncSecret } = action.payload;
            const now = new Date().toISOString();
            return {
                ...state,
                groups: (state.groups || []).map(g =>
                    g.id === groupId ? { ...g, isShared: !!isShared, syncSecret: syncSecret || g.syncSecret || null, updatedAt: now } : g
                )
            };
        }
        case IMPORT_DATA: {
            const now = new Date().toISOString();
            const importedUsers = (Array.isArray(action.payload.users) && action.payload.users.length > 0
                ? action.payload.users
                : (state.users && state.users.length > 0 ? state.users : defaultUsers)
            ).map(u => ({
                ...u,
                updatedAt: u.updatedAt || u.createdAt || now
            }));
            const importedGroups = (Array.isArray(action.payload.groups) ? action.payload.groups : []).map(g => ({
                ...g,
                updatedAt: g.updatedAt || g.createdAt || now
            }));
            const importedTransactions = (Array.isArray(action.payload.transactions) ? action.payload.transactions : []).map(t => ({
                ...t,
                updatedAt: t.updatedAt || t.createdAt || now
            }));
            const importedDeletedIds = {
                groups: {},
                members: {},
                expenses: {},
                settlements: {},
                ...(action.payload.deletedIds || {})
            };

            return {
                ...state,
                ...action.payload,
                users: importedUsers,
                groups: importedGroups,
                transactions: importedTransactions,
                deletedIds: importedDeletedIds,
                currentUserId: action.payload.currentUserId || (importedUsers[0]?.id || 'u_you')
            };
        }
        default:
            return state;
    }
}

// CONTEXT
const ExpenseContext = createContext(null);

// HELPER: Debt Simplification Algorithm
function calculateSimplifiedSettlementsFromBalances(balances) {
    const creditors = [];
    const debtors = [];

    Object.entries(balances).forEach(([userId, balance]) => {
        if (balance > 0.009) {
            creditors.push({ userId, amount: balance });
        } else if (balance < -0.009) {
            debtors.push({ userId, amount: -balance });
        }
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const settlements = [];
    let i = 0, j = 0;
    const debtorCopies = debtors.map(d => ({ ...d }));
    const creditorCopies = creditors.map(c => ({ ...c }));

    while (i < debtorCopies.length && j < creditorCopies.length) {
        const debtor = debtorCopies[i];
        const creditor = creditorCopies[j];
        const settleAmount = Math.min(debtor.amount, creditor.amount);

        if (settleAmount > 0.009) {
            settlements.push({
                from: debtor.userId,
                to: creditor.userId,
                amount: Math.round(settleAmount * 100) / 100
            });
        }

        debtor.amount -= settleAmount;
        creditor.amount -= settleAmount;

        if (debtor.amount < 0.009) i++;
        if (creditor.amount < 0.009) j++;
    }

    return settlements;
}

// HELPER: Collector-Centric Debt Simplification
function calculateCollectorSimplifiedSettlements(balances, collectorId) {
    if (!collectorId || balances[collectorId] === undefined) {
        return calculateSimplifiedSettlementsFromBalances(balances);
    }

    const creditors = [];
    const debtors = [];

    Object.entries(balances).forEach(([userId, balance]) => {
        if (balance > 0.009) {
            creditors.push({ userId, amount: balance });
        } else if (balance < -0.009) {
            debtors.push({ userId, amount: -balance });
        }
    });

    if (debtors.length === 0 || creditors.length === 0) {
        return [];
    }

    const settlements = [];
    let collectorInflow = 0;

    // 1. Other debtors pay the designated collector
    debtors.forEach(d => {
        if (d.userId !== collectorId) {
            settlements.push({
                from: d.userId,
                to: collectorId,
                amount: Math.round(d.amount * 100) / 100,
                isCollectorRoute: true
            });
            collectorInflow += d.amount;
        }
    });

    // 2. Collector settles with creditors
    const collectorDirectDebt = debtors.find(d => d.userId === collectorId)?.amount || 0;
    const collectorDirectCredit = creditors.find(c => c.userId === collectorId)?.amount || 0;
    let collectorOutflow = collectorInflow + collectorDirectDebt - collectorDirectCredit;

    creditors.forEach(c => {
        if (c.userId !== collectorId && collectorOutflow > 0.009) {
            const payAmt = Math.min(collectorOutflow, c.amount);
            if (payAmt > 0.009) {
                settlements.push({
                    from: collectorId,
                    to: c.userId,
                    amount: Math.round(payAmt * 100) / 100,
                    isCollectorRoute: true
                });
                collectorOutflow -= payAmt;
            }
        }
    });

    return settlements;
}

// PROVIDER
export function ExpenseProvider({ children }) {
    // Helper: Safe ID Generator
    const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));

    // Safe localStorage loading with automatic backward-compatible timestamp migration
    const loadState = () => {
        try {
            const saved = localStorage.getItem('expense_manager_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate structure
                if (
                    typeof parsed === 'object' &&
                    Array.isArray(parsed.users) &&
                    Array.isArray(parsed.transactions) &&
                    typeof parsed.currency === 'string'
                ) {
                    const defaultTime = '2026-01-01T00:00:00.000Z';
                    const users = (Array.isArray(parsed.users) && parsed.users.length > 0
                        ? parsed.users
                        : defaultUsers
                    ).map(u => ({
                        ...u,
                        updatedAt: u.updatedAt || u.createdAt || defaultTime,
                        createdAt: u.createdAt || defaultTime
                    }));

                    // Ensure groups exists with updatedAt - NEVER inject sample groups
                    const groups = (Array.isArray(parsed.groups) ? parsed.groups : []).map(g => ({
                        ...g,
                        updatedAt: g.updatedAt || g.createdAt || defaultTime,
                        createdAt: g.createdAt || defaultTime
                    }));

                    // Ensure transactions have updatedAt - NEVER inject sample transactions
                    const transactions = (Array.isArray(parsed.transactions) ? parsed.transactions : []).map(t => ({
                        ...t,
                        updatedAt: t.updatedAt || t.createdAt || defaultTime,
                        createdAt: t.createdAt || defaultTime
                    }));

                    const deletedIds = {
                        groups: {},
                        members: {},
                        expenses: {},
                        settlements: {},
                        ...(parsed.deletedIds || {})
                    };

                    // Ensure currentUserId exists
                    const currentUserId = parsed.currentUserId || users[0]?.id || 'u_you';
                    const selectedGroupId = parsed.selectedGroupId || null;

                    return {
                        ...parsed,
                        users,
                        groups,
                        transactions,
                        deletedIds,
                        currentUserId,
                        selectedGroupId,
                    };
                }
            }
        } catch (e) {
            console.error('Failed to load data from localStorage:', e);
        }
        return initialState;
    };

    const [state, dispatch] = useReducer(expenseReducer, initialState, loadState);

    // Save to localStorage on every state change
    useEffect(() => {
        try {
            localStorage.setItem('expense_manager_data', JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save data to localStorage:', e);
        }
    }, [state]);

    // Cloud Sync State
    const [syncStatus, setSyncStatus] = useState(() => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
        return gdrive.isAuthenticated() ? 'connected' : 'disconnected';
    });
    const [syncError, setSyncError] = useState(null);
    const [lastSyncedAt, setLastSyncedAt] = useState(() => gdrive.getLastSynced());
    const [isAutoSyncEnabled, setIsAutoSyncEnabledState] = useState(() => gdrive.isAutoSyncEnabled());
    const [customClientId, setCustomClientIdState] = useState(() => gdrive.getCustomClientId());

    const isSyncingRef = useRef(false);
    const syncTimerRef = useRef(null);
    const isInitialRender = useRef(true);
    const stateRef = useRef(state);
    stateRef.current = state;

    const setIsAutoSyncEnabled = useCallback((enabled) => {
        setIsAutoSyncEnabledState(enabled);
        gdrive.setAutoSyncEnabled(enabled);
    }, []);

    const setCustomClientId = useCallback((id) => {
        setCustomClientIdState(id);
        gdrive.setCustomClientId(id);
    }, []);

    // Perform bidirectional synchronization
    const syncNow = useCallback(async () => {
        if (isSyncingRef.current) return;
        if (!navigator.onLine) {
            setSyncStatus('offline');
            return;
        }
        if (!gdrive.isAuthenticated()) {
            setSyncStatus('disconnected');
            return;
        }

        setSyncStatus('syncing');
        setSyncError(null);
        isSyncingRef.current = true;

        try {
            const result = await gdrive.syncWithDrive(state, mergeAppState);
            if (result.success) {
                dispatch({
                    type: MERGE_SYNCED_DATA,
                    payload: result.mergedState
                });
                setLastSyncedAt(result.timestamp);
                setSyncStatus('connected');
                setSyncError(null);
            } else {
                setSyncError(result.error);
                if (result.error && (result.error.includes('expired') || result.error.includes('token') || result.error.includes('authenticated'))) {
                    setSyncStatus('disconnected');
                } else {
                    setSyncStatus('error');
                }
            }
        } catch (err) {
            console.error('Error in syncNow:', err);
            setSyncError(err.message || 'Sync failed');
            setSyncStatus('error');
        } finally {
            isSyncingRef.current = false;
        }
    }, [state]);

    const connectDrive = useCallback(() => {
        setSyncError(null);
        gdrive.initiateGoogleAuth({
            clientId: gdrive.getClientId(),
            onToken: () => {
                setSyncStatus('connected');
                setSyncError(null);
                setTimeout(() => {
                    syncNow();
                }, 100);
            },
            onError: (err) => {
                setSyncError(err.message || 'Google Drive authorization failed');
                setSyncStatus('error');
            }
        });
    }, [syncNow]);

    const disconnectDrive = useCallback(() => {
        gdrive.clearAuth();
        setSyncStatus('disconnected');
        setSyncError(null);
    }, []);

    const saveManualToken = useCallback(async (token, hours = 1) => {
        if (!token || !token.trim()) {
            disconnectDrive();
            return { success: false, error: 'Empty token' };
        }
        gdrive.setAccessToken(token.trim(), hours * 3600);
        const test = await gdrive.testConnection(token.trim());
        if (test.success) {
            setSyncStatus('connected');
            setSyncError(null);
            syncNow();
            return { success: true };
        } else {
            setSyncError(test.error || 'Invalid access token');
            setSyncStatus('error');
            return { success: false, error: test.error };
        }
    }, [disconnectDrive, syncNow]);

    // Token reception listeners (Popup postMessage, Hash redirect, Storage, Visibility, and Native deep links)
    useEffect(() => {
        // 0. Auto-restore session silently if previously connected
        if (!gdrive.isAuthenticated() && gdrive.isSessionPersisted()) {
            gdrive.trySilentRestore().then(restored => {
                if (restored) {
                    setSyncStatus('connected');
                    setSyncError(null);
                    syncNow();
                }
            });
        }

        // Unified processor for token hash fragments (#access_token=...&expires_in=...)
        const processTokenHash = (hashPart) => {
            if (!hashPart) return false;
            const tokenData = gdrive.parseTokenFromHash(hashPart);
            if (tokenData?.error) {
                setSyncError(tokenData.error);
                setSyncStatus('error');
                if (typeof window !== 'undefined') {
                    let targetUrl = window.location.pathname + window.location.search;
                    try {
                        const savedRoute = sessionStorage.getItem('splitit_oauth_return_route');
                        if (savedRoute) {
                            sessionStorage.removeItem('splitit_oauth_return_route');
                            targetUrl = savedRoute;
                        }
                    } catch {
                        // ignore
                    }
                    window.history.replaceState(null, '', targetUrl);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }
                return false;
            }

            if (tokenData?.accessToken) {
                // 1. Immediately persist token & fetch profile in active environment
                gdrive.setAccessToken(tokenData.accessToken, tokenData.expiresIn);
                gdrive.fetchUserProfile(tokenData.accessToken).catch(() => {});

                // 2. If running inside a popup window, notify opener and attempt window.close()
                if (typeof window !== 'undefined' && window.opener && window.opener !== window) {
                    try {
                        window.opener.postMessage({
                            type: 'SPLITIT_GDRIVE_AUTH_TOKEN',
                            hash: hashPart
                        }, '*');
                    } catch {
                        // ignore postMessage error
                    }
                    try {
                        window.close();
                    } catch {
                        // ignore window.close error (mobile browsers block window.close)
                    }
                }

                // 3. Clear URL hash and restore saved route if preserved in sessionStorage
                if (typeof window !== 'undefined') {
                    let targetUrl = window.location.pathname + window.location.search;
                    try {
                        const savedRoute = sessionStorage.getItem('splitit_oauth_return_route');
                        if (savedRoute) {
                            sessionStorage.removeItem('splitit_oauth_return_route');
                            targetUrl = savedRoute;
                        }
                    } catch {
                        // ignore
                    }
                    window.history.replaceState(null, '', targetUrl);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }

                // 4. Update UI state and initiate sync
                setSyncStatus('connected');
                setSyncError(null);
                setTimeout(() => syncNow(), 200);
                return true;
            }
            return false;
        };

        // 1. Check current URL hash (for OAuth redirect flow on mobile web and WebViews)
        if (typeof window !== 'undefined' && window.location.hash) {
            processTokenHash(window.location.hash);
        }

        // 2. Hashchange listener (if router or browser updates hash in-place)
        const handleHashChange = () => {
            if (typeof window !== 'undefined' && window.location.hash) {
                processTokenHash(window.location.hash);
            }
        };
        window.addEventListener('hashchange', handleHashChange);

        // 3. Cross-window postMessage listener (for desktop popup mode)
        const handleMessage = (event) => {
            if (event.data?.type === 'SPLITIT_GDRIVE_AUTH_TOKEN' && event.data.hash) {
                processTokenHash(event.data.hash);
            }
        };
        window.addEventListener('message', handleMessage);

        // 4. LocalStorage change listener (instant cross-tab authentication synchronization)
        const handleStorage = (event) => {
            if (event.key === gdrive.STORAGE_KEY_TOKEN) {
                if (event.newValue) {
                    setSyncStatus('connected');
                    setSyncError(null);
                    setTimeout(() => syncNow(), 200);
                } else {
                    setSyncStatus('disconnected');
                }
            }
        };
        window.addEventListener('storage', handleStorage);

        // 5. Visibility / focus listener (resuming app tab after completing Google auth in another tab)
        const handleVisibilityChange = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                if (gdrive.isAuthenticated()) {
                    setSyncStatus('connected');
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 6. Capacitor deep link listener (appUrlOpen) for Android/iOS native app containers
        let capListenerPromise = null;
        try {
            capListenerPromise = CapApp.addListener('appUrlOpen', (data) => {
                if (data?.url) {
                    const hashIdx = data.url.indexOf('#');
                    if (hashIdx !== -1) {
                        processTokenHash(data.url.substring(hashIdx));
                    }
                }
            });
        } catch {
            // Capacitor not available or running in pure web
        }

        // 7. Desktop native OAuth listeners (Tauri event listener & Electron IPC)
        let isMounted = true;
        let unsubDesktop = null;
        if (typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__)) {
            import('@tauri-apps/api/event').then(({ listen }) => {
                if (!isMounted) return null;
                return listen('splitit:oauth-token', (event) => {
                    const hashPart = typeof event.payload === 'string' ? event.payload : (event.payload?.hash || '');
                    if (hashPart) {
                        processTokenHash(hashPart);
                    }
                });
            }).then((unsub) => {
                if (!isMounted) {
                    if (typeof unsub === 'function') unsub();
                } else if (unsub) {
                    unsubDesktop = unsub;
                }
            }).catch((err) => {
                console.warn('[SplitIt Tauri OAuth] listen error:', err);
            });
        } else if (window.electronOAuth?.onTokenReceived) {
            unsubDesktop = window.electronOAuth.onTokenReceived((hashPart) => {
                if (hashPart) {
                    processTokenHash(hashPart);
                }
            });
        }

        return () => {
            isMounted = false;
            window.removeEventListener('hashchange', handleHashChange);
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('storage', handleStorage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (typeof unsubDesktop === 'function') unsubDesktop();
            if (capListenerPromise && typeof capListenerPromise.then === 'function') {
                capListenerPromise.then(l => l.remove?.());
            }
        };
    }, [syncNow]);

    // Network status listener (Online / Offline)
    useEffect(() => {
        const handleOnline = () => {
            if (gdrive.isAuthenticated()) {
                setSyncStatus('connected');
                if (isAutoSyncEnabled) {
                    syncNow();
                }
            } else {
                setSyncStatus('disconnected');
            }
        };

        const handleOffline = () => {
            setSyncStatus('offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isAutoSyncEnabled, syncNow]);

    // Automatic pull on launch and window focus
    useEffect(() => {
        const handleFocus = () => {
            if (isAutoSyncEnabled && gdrive.isAuthenticated() && navigator.onLine && !isSyncingRef.current) {
                syncNow();
            }
        };

        window.addEventListener('focus', handleFocus);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') handleFocus();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Trigger on initial startup
        const launchTimer = setTimeout(() => {
            if (isAutoSyncEnabled && gdrive.isAuthenticated() && navigator.onLine) {
                syncNow();
            }
        }, 1200);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearTimeout(launchTimer);
        };
    }, [isAutoSyncEnabled, syncNow]);

    // Debounced 3-second auto-sync after user mutations
    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }

        if (isSyncingRef.current) return;

        if (isAutoSyncEnabled && gdrive.isAuthenticated() && navigator.onLine) {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(() => {
                syncNow();
            }, 3000);
        }

        return () => {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        };
    }, [state, isAutoSyncEnabled, syncNow]);

    // -----------------------------------------------------------------------
    // ZERO-SERVER MULTI-USER GROUP SYNC (NOSTR RELAYS & E2EE)
    // -----------------------------------------------------------------------
    const [groupSyncStates, setGroupSyncStates] = useState({});
    const groupSubscriptionsRef = useRef(new Map());
    const groupPublishTimersRef = useRef(new Map());

    const setGroupSyncStatus = useCallback((groupId, partial) => {
        setGroupSyncStates(prev => ({
            ...prev,
            [groupId]: {
                status: 'offline',
                lastSyncedAt: null,
                error: null,
                ...(prev[groupId] || {}),
                ...partial
            }
        }));
    }, []);

    // Subscribe to incoming updates on public Nostr relays for all shared groups
    useEffect(() => {
        const sharedGroups = (state.groups || []).filter(g => g.isShared && g.syncSecret);
        const currentGroupIds = new Set(sharedGroups.map(g => g.id));

        // Clean up subscriptions for removed or unshared groups
        groupSubscriptionsRef.current.forEach((unsub, gid) => {
            if (!currentGroupIds.has(gid)) {
                try { unsub(); } catch (err) { void err; }
                groupSubscriptionsRef.current.delete(gid);
            }
        });

        // Register active subscription for each shared group
        sharedGroups.forEach(g => {
            if (!groupSubscriptionsRef.current.has(g.id)) {
                setGroupSyncStatus(g.id, { status: 'syncing' });
                multiSync.subscribeToGroup(
                    g.id,
                    g.syncSecret,
                    (payload) => {
                        dispatch({
                            type: MERGE_GROUP_SYNC_DATA,
                            payload,
                            myMemberId: g.myMemberId
                        });
                        setGroupSyncStatus(g.id, {
                            status: 'live',
                            lastSyncedAt: new Date().toISOString(),
                            error: null
                        });
                    },
                    (status) => {
                        setGroupSyncStatus(g.id, { status });
                    }
                ).then(unsub => {
                    groupSubscriptionsRef.current.set(g.id, unsub);
                }).catch(err => {
                    console.error(`Subscription failed for group ${g.id}:`, err);
                    setGroupSyncStatus(g.id, { status: 'offline', error: err.message });
                });
            }
        });
    }, [state.groups, setGroupSyncStatus]);

    // Unsubscribe all active relay connections on unmount
    useEffect(() => {
        const subs = groupSubscriptionsRef.current;
        const timers = groupPublishTimersRef.current;
        return () => {
            subs.forEach(unsub => {
                try { unsub(); } catch (err) { void err; }
            });
            subs.clear();
            timers.forEach(t => clearTimeout(t));
            timers.clear();
        };
    }, []);

    // Debounced automatic publish (1.5s) when a shared group's expenses or metadata change locally
    useEffect(() => {
        if (isInitialRender.current) return;
        const sharedGroups = (state.groups || []).filter(g => g.isShared && g.syncSecret);
        if (sharedGroups.length === 0) return;

        sharedGroups.forEach(g => {
            if (groupPublishTimersRef.current.has(g.id)) {
                clearTimeout(groupPublishTimersRef.current.get(g.id));
            }
            const timer = setTimeout(async () => {
                groupPublishTimersRef.current.delete(g.id);
                try {
                    const res = await multiSync.publishGroupUpdate(stateRef.current, g.id);
                    if (res.success) {
                        setGroupSyncStatus(g.id, {
                            status: 'synced',
                            lastSyncedAt: res.timestamp,
                            error: null
                        });
                    }
                } catch (err) {
                    console.warn(`Failed auto-publishing update for group ${g.id}:`, err);
                }
            }, 1500);
            groupPublishTimersRef.current.set(g.id, timer);
        });
    }, [state.transactions, state.groups, setGroupSyncStatus]);

    const enableGroupSync = useCallback(async (groupId, existingSecret = null) => {
        const group = (stateRef.current.groups || []).find(g => g.id === groupId);
        if (!group) return { success: false, error: 'Group not found' };

        const secret = existingSecret || group.syncSecret || multiSync.generateSyncSecret();
        dispatch({
            type: SET_GROUP_SYNC_CONFIG,
            payload: {
                groupId,
                isShared: true,
                syncSecret: secret
            }
        });

        setGroupSyncStatus(groupId, { status: 'syncing' });

        // Immediately publish current group state to relays
        const pubRes = await multiSync.publishGroupUpdate(stateRef.current, groupId, secret);
        if (pubRes.success) {
            setGroupSyncStatus(groupId, {
                status: 'synced',
                lastSyncedAt: pubRes.timestamp,
                error: null
            });
        }

        const inviteCode = multiSync.generateInviteCode(group, secret);
        return {
            success: true,
            syncSecret: secret,
            inviteCode
        };
    }, [setGroupSyncStatus]);

    const disableGroupSync = useCallback((groupId) => {
        if (groupSubscriptionsRef.current.has(groupId)) {
            try { groupSubscriptionsRef.current.get(groupId)(); } catch (err) { void err; }
            groupSubscriptionsRef.current.delete(groupId);
        }
        dispatch({
            type: SET_GROUP_SYNC_CONFIG,
            payload: {
                groupId,
                isShared: false,
                syncSecret: null
            }
        });
        setGroupSyncStatus(groupId, { status: 'offline' });
    }, [setGroupSyncStatus]);

    const setGroupMemberIdentity = useCallback((groupId, memberId) => {
        dispatch({
            type: SET_GROUP_MEMBER_IDENTITY,
            payload: { groupId, memberId }
        });
    }, []);

    const syncGroupNow = useCallback(async (groupId) => {
        const group = (state.groups || []).find(g => g.id === groupId);
        if (!group || !group.syncSecret) return { success: false, error: 'Group is not shared' };

        setGroupSyncStatus(groupId, { status: 'syncing', error: null });

        try {
            // 1. Broadcast our latest local group data
            await multiSync.publishGroupUpdate(state, groupId);

            // 2. Fetch latest snapshot from relays
            const fetchRes = await multiSync.fetchGroupStateOnce(groupId, group.syncSecret);
            if (fetchRes.success && fetchRes.payload) {
                dispatch({
                    type: MERGE_GROUP_SYNC_DATA,
                    payload: fetchRes.payload,
                    myMemberId: group.myMemberId
                });
            }

            setGroupSyncStatus(groupId, {
                status: 'synced',
                lastSyncedAt: new Date().toISOString(),
                error: null
            });
            return { success: true };
        } catch (err) {
            console.error(`syncGroupNow error for ${groupId}:`, err);
            setGroupSyncStatus(groupId, { status: 'offline', error: err.message });
            return { success: false, error: err.message };
        }
    }, [state, setGroupSyncStatus]);

    const joinSharedGroup = useCallback(async (inviteCode, myMemberId = null) => {
        const parsed = multiSync.parseInviteCode(inviteCode);
        if (!parsed) {
            return { success: false, error: 'Invalid invite code format. Must start with SPLIT-1-...' };
        }

        const { groupId, syncSecret } = parsed;
        setGroupSyncStatus(groupId, { status: 'syncing', error: null });

        try {
            const fetchRes = await multiSync.fetchGroupStateOnce(groupId, syncSecret, 7000);
            if (!fetchRes.success || !fetchRes.payload) {
                setGroupSyncStatus(groupId, { status: 'offline', error: fetchRes.error });
                return { success: false, error: fetchRes.error || 'Could not fetch group data from relays.' };
            }

            dispatch({
                type: MERGE_GROUP_SYNC_DATA,
                payload: {
                    ...fetchRes.payload,
                    syncSecret
                },
                myMemberId: myMemberId || null
            });

            setGroupSyncStatus(groupId, {
                status: 'live',
                lastSyncedAt: new Date().toISOString(),
                error: null
            });

            return {
                success: true,
                groupId,
                group: fetchRes.payload.group,
                members: fetchRes.payload.members || []
            };
        } catch (err) {
            console.error('joinSharedGroup error:', err);
            setGroupSyncStatus(groupId, { status: 'offline', error: err.message });
            return { success: false, error: err.message || 'Failed to join group' };
        }
    }, [setGroupSyncStatus]);

    const addUser = (name) => {
        const id = generateId();
        dispatch({
            type: ADD_USER,
            payload: { id, name }
        });
        return id;
    };

    const deleteUser = (userId) => {
        dispatch({
            type: DELETE_USER,
            payload: userId
        });
    };

    const addGroup = ({ name, type = 'other', icon = 'users', color = '#10b981', members = [], simplifyDebts = true, defaultCollectorId = null }) => {
        const id = 'grp_' + generateId();
        dispatch({
            type: ADD_GROUP,
            payload: {
                id,
                name,
                type,
                icon,
                color,
                members,
                simplifyDebts,
                defaultCollectorId: defaultCollectorId || null,
                createdAt: new Date().toISOString()
            }
        });
        return id;
    };

    const updateGroup = (id, updates) => {
        dispatch({
            type: UPDATE_GROUP,
            payload: { id, ...updates }
        });
    };

    const deleteGroup = (groupId) => {
        dispatch({
            type: DELETE_GROUP,
            payload: groupId
        });
    };

    const setCurrentUserId = (userId) => {
        dispatch({
            type: SET_CURRENT_USER,
            payload: userId
        });
    };

    const setSelectedGroupId = (groupId) => {
        dispatch({
            type: SET_SELECTED_GROUP,
            payload: groupId || null
        });
    };

    const addMemberToGroup = (groupId, userId) => {
        const grp = (state.groups || []).find(g => g.id === groupId);
        if (grp && !grp.members.includes(userId)) {
            updateGroup(groupId, { members: [...grp.members, userId] });
        }
    };

    const removeMemberFromGroup = (groupId, userId) => {
        const grp = (state.groups || []).find(g => g.id === groupId);
        if (grp) {
            updateGroup(groupId, { members: grp.members.filter(m => m !== userId) });
        }
    };

    const addExpense = (description, amount, date, payers, splits, groupId = null, collectorId = null, extraMeta = {}) => {
        dispatch({
            type: ADD_TRANSACTION,
            payload: {
                id: generateId(),
                type: 'EXPENSE',
                groupId: groupId || null,
                collectorId: collectorId || null,
                description,
                amount: parseFloat(amount),
                date,
                payers, // Array of { userId, amount }
                splits, // Array of { userId, amount }
                splitMode: extraMeta.splitMode || extraMeta.splitType || 'EQUAL',
                splitType: extraMeta.splitType || extraMeta.splitMode?.toLowerCase() || 'equal',
                splitShares: extraMeta.splitShares || null,
                category: extraMeta.category || null,
                ...extraMeta
            }
        });
    };

    const updateExpense = (id, description, amount, date, payers, splits, groupId = null, collectorId = null, extraMeta = {}) => {
        dispatch({
            type: UPDATE_TRANSACTION,
            payload: {
                id,
                type: 'EXPENSE',
                groupId: groupId || null,
                collectorId: collectorId || null,
                description,
                amount: parseFloat(amount),
                date,
                payers,
                splits,
                splitMode: extraMeta.splitMode || extraMeta.splitType || 'EQUAL',
                splitType: extraMeta.splitType || extraMeta.splitMode?.toLowerCase() || 'equal',
                splitShares: extraMeta.splitShares || null,
                category: extraMeta.category || null,
                ...extraMeta
            }
        });
    };

    const deleteTransaction = (id) => {
        dispatch({
            type: DELETE_TRANSACTION,
            payload: id
        });
    };

    const addSettlement = (fromUserId, toUserId, amount, date, groupId = null) => {
        dispatch({
            type: ADD_TRANSACTION,
            payload: {
                id: generateId(),
                type: 'SETTLEMENT',
                groupId: groupId || null,
                description: 'Settlement',
                amount: parseFloat(amount),
                date,
                from: fromUserId,
                to: toUserId,
            }
        });
    };

    const updateSettlement = (id, fromUserId, toUserId, amount, date, groupId = null) => {
        dispatch({
            type: UPDATE_TRANSACTION,
            payload: {
                id,
                type: 'SETTLEMENT',
                groupId: groupId || null,
                description: 'Settlement',
                amount: parseFloat(amount),
                date,
                from: fromUserId,
                to: toUserId,
            }
        });
    };

    const setCurrency = (currencyCode) => {
        if (CURRENCIES[currencyCode]) {
            dispatch({
                type: SET_CURRENCY,
                payload: currencyCode
            });
        }
    };

    // Calculate balances for a specific group (or 'non-group' for non-group expenses)
    const getGroupBalances = useMemo(() => {
        return (groupId) => {
            const groupTx = (state.transactions || []).filter(t => {
                if (groupId === 'non-group' || !groupId) {
                    return !t.groupId || t.groupId === 'non-group';
                }
                return t.groupId === groupId;
            });

            const balances = {};
            const group = (state.groups || []).find(g => g.id === groupId);
            const memberIds = group ? group.members : state.users.map(u => u.id);

            memberIds.forEach(id => {
                balances[id] = 0;
            });

            groupTx.forEach(t => {
                if (t.type === 'EXPENSE') {
                    (t.payers || []).forEach(p => {
                        balances[p.userId] = (balances[p.userId] || 0) + p.amount;
                    });
                    (t.splits || []).forEach(s => {
                        balances[s.userId] = (balances[s.userId] || 0) - s.amount;
                    });
                }
                if (t.type === 'SETTLEMENT') {
                    if (balances[t.from] !== undefined) balances[t.from] += t.amount;
                    if (balances[t.to] !== undefined) balances[t.to] -= t.amount;
                }
            });

            return balances;
        };
    }, [state.groups, state.transactions, state.users]);

    // Calculate pairwise debts for a group from perspective of a user
    const getGroupPairwiseDebts = useMemo(() => {
        return (groupId, userId = state.currentUserId) => {
            const balances = getGroupBalances(groupId);
            const myNetBalance = balances[userId] || 0;
            const group = (state.groups || []).find(g => g.id === groupId);
            const isSimplified = group ? (group.simplifyDebts !== false) : true;

            const groupTx = (state.transactions || []).filter(t => {
                if (groupId === 'non-group' || !groupId) return !t.groupId || t.groupId === 'non-group';
                return t.groupId === groupId;
            });

            const activeCollectorId = group?.defaultCollectorId || groupTx.find(t => t.collectorId)?.collectorId || null;

            if (isSimplified) {
                const settlements = activeCollectorId
                    ? calculateCollectorSimplifiedSettlements(balances, activeCollectorId)
                    : calculateSimplifiedSettlementsFromBalances(balances);
                const debts = [];

                settlements.forEach(s => {
                    if (s.from === userId) {
                        debts.push({
                            otherUserId: s.to,
                            amount: s.amount,
                            type: 'you_owe'
                        });
                    } else if (s.to === userId) {
                        debts.push({
                            otherUserId: s.from,
                            amount: s.amount,
                            type: 'owes_you'
                        });
                    }
                });

                return {
                    netBalance: Math.round(myNetBalance * 100) / 100,
                    debts,
                    allSettlements: settlements
                };
            } else {
                const memberIds = group ? group.members : state.users.map(u => u.id);
                const debtMatrix = {};
                memberIds.forEach(m1 => {
                    debtMatrix[m1] = {};
                    memberIds.forEach(m2 => { debtMatrix[m1][m2] = 0; });
                });

                groupTx.forEach(t => {
                    if (t.type === 'EXPENSE') {
                        const collectorId = t.collectorId;
                        const payers = t.payers || [];
                        const splits = t.splits || [];
                        const totalAmt = parseFloat(t.amount) || 1;

                        if (collectorId && memberIds.includes(collectorId)) {
                            splits.forEach(s => {
                                if (s.userId !== collectorId && debtMatrix[s.userId] && debtMatrix[s.userId][collectorId] !== undefined) {
                                    debtMatrix[s.userId][collectorId] += s.amount;
                                }
                            });
                            payers.forEach(p => {
                                if (p.amount > 0 && p.userId !== collectorId) {
                                    const ratio = p.amount / totalAmt;
                                    splits.forEach(s => {
                                        if (s.userId !== p.userId && debtMatrix[collectorId] && debtMatrix[collectorId][p.userId] !== undefined) {
                                            debtMatrix[collectorId][p.userId] += s.amount * ratio;
                                        }
                                    });
                                }
                            });
                        } else {
                            payers.forEach(p => {
                                if (p.amount > 0) {
                                    const ratio = p.amount / totalAmt;
                                    splits.forEach(s => {
                                        if (s.userId !== p.userId && debtMatrix[s.userId] && debtMatrix[s.userId][p.userId] !== undefined) {
                                            debtMatrix[s.userId][p.userId] += s.amount * ratio;
                                        }
                                    });
                                }
                            });
                        }
                    }
                    if (t.type === 'SETTLEMENT') {
                        if (debtMatrix[t.from] && debtMatrix[t.from][t.to] !== undefined) {
                            debtMatrix[t.from][t.to] -= t.amount;
                        }
                    }
                });

                const debts = [];
                memberIds.forEach(otherId => {
                    if (otherId === userId) return;
                    const myDebtToOther = debtMatrix[userId]?.[otherId] || 0;
                    const otherDebtToMe = debtMatrix[otherId]?.[userId] || 0;
                    const net = otherDebtToMe - myDebtToOther;

                    if (Math.abs(net) > 0.009) {
                        const rounded = Math.round(Math.abs(net) * 100) / 100;
                        if (net > 0) {
                            debts.push({ otherUserId: otherId, amount: rounded, type: 'owes_you' });
                        } else {
                            debts.push({ otherUserId: otherId, amount: rounded, type: 'you_owe' });
                        }
                    }
                });

                return {
                    netBalance: Math.round(myNetBalance * 100) / 100,
                    debts,
                    allSettlements: []
                };
            }
        };
    }, [getGroupBalances, state.currentUserId, state.groups, state.transactions, state.users]);

    // Derived State: Global Balances across all transactions
    const balances = useMemo(() => {
        const globalBalances = {};
        state.users.forEach(u => globalBalances[u.id] = 0);

        (state.transactions || []).forEach(t => {
            if (t.type === 'EXPENSE') {
                (t.payers || []).forEach(p => {
                    if (globalBalances[p.userId] !== undefined) {
                        globalBalances[p.userId] += p.amount;
                    }
                });
                (t.splits || []).forEach(s => {
                    if (globalBalances[s.userId] !== undefined) {
                        globalBalances[s.userId] -= s.amount;
                    }
                });
            }
            if (t.type === 'SETTLEMENT') {
                if (globalBalances[t.from] !== undefined) globalBalances[t.from] += t.amount;
                if (globalBalances[t.to] !== undefined) globalBalances[t.to] -= t.amount;
            }
        });

        return globalBalances;
    }, [state.users, state.transactions]);

    // Current User Overall Balance across all groups
    const currentUserOverall = useMemo(() => {
        const net = balances[state.currentUserId] || 0;
        return {
            net: Math.round(net * 100) / 100,
            status: net > 0.009 ? 'owed' : net < -0.009 ? 'owe' : 'settled',
            amount: Math.abs(Math.round(net * 100) / 100)
        };
    }, [balances, state.currentUserId]);

    // Export Data
    const exportData = () => {
        const exportObject = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            data: state
        };
        return JSON.stringify(exportObject, null, 2);
    };

    // Import Data
    const importData = (jsonString) => {
        try {
            const cleanJson = typeof jsonString === 'string' ? jsonString.replace(/^\uFEFF/, '').trim() : jsonString;
            const imported = JSON.parse(cleanJson);
            if (!imported.data || typeof imported.data !== 'object') {
                throw new Error('Invalid data structure: missing data object');
            }
            const { data } = imported;
            if (!Array.isArray(data.users)) throw new Error('users must be an array');
            if (!Array.isArray(data.transactions)) throw new Error('transactions must be an array');
            if (typeof data.currency !== 'string') throw new Error('currency must be a string');

            dispatch({
                type: IMPORT_DATA,
                payload: data
            });

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to import data'
            };
        }
    };

    // Active Group Object
    const selectedGroup = useMemo(() => {
        if (!state.selectedGroupId) return null;
        if (state.selectedGroupId === 'non-group') {
            return {
                id: 'non-group',
                name: 'Non-group expenses',
                type: 'nongroup',
                icon: 'nongroup',
                color: '#6366f1',
                members: state.users.map(u => u.id),
                simplifyDebts: true
            };
        }
        return (state.groups || []).find(g => g.id === state.selectedGroupId) || null;
    }, [state.selectedGroupId, state.groups, state.users]);

    // Filtered Transactions for Active Group
    const filteredTransactions = useMemo(() => {
        if (!state.selectedGroupId) return state.transactions || [];
        if (state.selectedGroupId === 'non-group') {
            return (state.transactions || []).filter(t => !t.groupId || t.groupId === 'non-group');
        }
        return (state.transactions || []).filter(t => t.groupId === state.selectedGroupId);
    }, [state.selectedGroupId, state.transactions]);

    // Current User Summary for Active Group or Overall
    const currentUserGroupSummary = useMemo(() => {
        if (state.selectedGroupId) {
            const effectiveMemberId = selectedGroup?.myMemberId || state.currentUserId;
            const debtsInfo = getGroupPairwiseDebts(state.selectedGroupId, effectiveMemberId);
            const net = debtsInfo.netBalance;
            return {
                net,
                status: net > 0.009 ? 'owed' : net < -0.009 ? 'owe' : 'settled',
                amount: Math.abs(net),
                debts: debtsInfo.debts,
                allSettlements: debtsInfo.allSettlements
            };
        }
        return {
            ...currentUserOverall,
            debts: [],
            allSettlements: []
        };
    }, [state.selectedGroupId, selectedGroup?.myMemberId, getGroupPairwiseDebts, state.currentUserId, currentUserOverall]);

    return (
        <ExpenseContext.Provider value={{
            state,
            selectedGroupId: state.selectedGroupId,
            setSelectedGroupId,
            selectedGroup,
            filteredTransactions,
            currentUserGroupSummary,
            addMemberToGroup,
            removeMemberFromGroup,
            addUser,
            deleteUser,
            addGroup,
            updateGroup,
            deleteGroup,
            setCurrentUserId,
            addExpense,
            updateExpense,
            deleteTransaction,
            addSettlement,
            updateSettlement,
            balances,
            currentUserOverall,
            getGroupBalances,
            getGroupPairwiseDebts,
            calculateCollectorSimplifiedSettlements,
            setCurrency,
            exportData,
            importData,
            currencies: CURRENCIES,
            // Google Drive Cloud Sync
            syncStatus,
            syncError,
            lastSyncedAt,
            isAutoSyncEnabled,
            setIsAutoSyncEnabled,
            customClientId,
            setCustomClientId,
            syncNow,
            connectDrive,
            disconnectDrive,
            saveManualToken,
            mergeAppState,
            // Zero-Server Multi-User Group Sync (Nostr Relays & E2EE)
            groupSyncStates,
            enableGroupSync,
            disableGroupSync,
            setGroupMemberIdentity,
            syncGroupNow,
            joinSharedGroup,
            generateInviteCode: multiSync.generateInviteCode,
            parseInviteCode: multiSync.parseInviteCode,
            getShareableInviteMessage: multiSync.getShareableInviteMessage,
            fetchGroupStateOnce: multiSync.fetchGroupStateOnce,
            getConfiguredRelays: multiSync.getConfiguredRelays,
            saveConfiguredRelays: multiSync.saveConfiguredRelays,
            defaultNostrRelays: multiSync.DEFAULT_RELAYS
        }}>
            {children}
        </ExpenseContext.Provider>
    );
}

// HOOK
// eslint-disable-next-line react-refresh/only-export-components
export function useExpenses() {
    const context = useContext(ExpenseContext);
    if (!context) {
        throw new Error("useExpenses must be used within an ExpenseProvider");
    }
    return context;
}
