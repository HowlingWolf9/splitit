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
import { exportBackupJson } from '../utils/fileHelper';


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

import {
    defaultUsers,
    initialState,
    expenseReducer,
    ADD_USER,
    UPDATE_USER,
    MERGE_USERS,
    DELETE_USER,
    ADD_GROUP,
    UPDATE_GROUP,
    DELETE_GROUP,
    SET_SELECTED_GROUP,
    SET_CURRENT_USER,
    ADD_TRANSACTION,
    UPDATE_TRANSACTION,
    DELETE_TRANSACTION,
    SET_CURRENCY,
    IMPORT_DATA,
    MERGE_SYNCED_DATA,
    MERGE_GROUP_SYNC_DATA,
    SET_GROUP_MEMBER_IDENTITY,
    SET_GROUP_SYNC_CONFIG
} from './expenseReducer.js';

// CONFLICT-FREE STATE MERGER UTILITY & REDUCER EXPORTS
// eslint-disable-next-line react-refresh/only-export-components
export { mergeAppState, mergeGroupSyncPayload, expenseReducer, initialState, defaultUsers, ADD_USER, UPDATE_USER, MERGE_USERS, DELETE_USER };

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
        if (gdrive.isAuthenticated()) return 'connected';
        if (gdrive.isSessionPersisted()) return 'reauth_required';
        return 'disconnected';
    });
    const [syncError, setSyncError] = useState(null);
    const [lastSyncedAt, setLastSyncedAt] = useState(() => gdrive.getLastSynced());
    const [isAutoSyncEnabled, setIsAutoSyncEnabledState] = useState(() => gdrive.isAutoSyncEnabled());
    const [customClientId, setCustomClientIdState] = useState(() => gdrive.getCustomClientId());

    const isSyncingRef = useRef(false);
    const syncTimerRef = useRef(null);
    const isInitialRender = useRef(true);
    const hasMountedLaunchRef = useRef(false);
    const lastSyncedHashRef = useRef(gdrive.computeStateHash(state));
    const stateRef = useRef(state);
    stateRef.current = state;
    const isApplyingDriveMergeRef = useRef(false);
    const isApplyingRemoteGroupSyncRef = useRef(false);
    const isImportSyncLockRef = useRef(false);

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
        if (isImportSyncLockRef.current) return;
        if (isSyncingRef.current) return;
        if (!navigator.onLine) {
            setSyncStatus('offline');
            return;
        }
        if (!gdrive.isAuthenticated()) {
            setSyncStatus(gdrive.isSessionPersisted() ? 'reauth_required' : 'disconnected');
            return;
        }

        setSyncStatus('syncing');
        setSyncError(null);
        isSyncingRef.current = true;

        try {
            const currentState = stateRef.current;
            const result = await gdrive.syncWithDrive(currentState, mergeAppState);
            if (result.success) {
                const currentHash = gdrive.computeStateHash(stateRef.current);
                const mergedHash = gdrive.computeStateHash(result.mergedState);

                // Loop breaking guard: only dispatch if data actually differs!
                if (mergedHash && mergedHash !== currentHash) {
                    isApplyingDriveMergeRef.current = true;
                    dispatch({
                        type: MERGE_SYNCED_DATA,
                        payload: result.mergedState
                    });
                    lastSyncedHashRef.current = mergedHash;
                } else {
                    lastSyncedHashRef.current = currentHash;
                }

                setLastSyncedAt(result.timestamp);
                setSyncStatus('connected');
                setSyncError(null);
            } else {
                setSyncError(result.error);
                if (result.error && (result.error.includes('expired') || result.error.includes('token') || result.error.includes('authenticated') || result.error.includes('401'))) {
                    setSyncStatus(gdrive.isSessionPersisted() ? 'reauth_required' : 'disconnected');
                } else {
                    setSyncStatus('error');
                }
            }
        } catch (err) {
            console.error('Error in syncNow:', err);
            const errMsg = err.message || 'Sync failed';
            setSyncError(errMsg);
            if (errMsg.includes('expired') || errMsg.includes('token') || errMsg.includes('Authentication') || errMsg.includes('401')) {
                setSyncStatus(gdrive.isSessionPersisted() ? 'reauth_required' : 'disconnected');
            } else {
                setSyncStatus('error');
            }
        } finally {
            isSyncingRef.current = false;
        }
    }, []);

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
                setSyncStatus(gdrive.isSessionPersisted() ? 'reauth_required' : 'error');
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
                    let targetUrl = window.location.pathname;
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

                // Close native Capacitor Chrome Custom Tab if active
                if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
                    import('@capacitor/browser').then(({ Browser }) => Browser.close()).catch(() => {});
                }

                // 2. If running inside a popup window, notify opener and attempt window.close()
                if (typeof window !== 'undefined' && window.opener && window.opener !== window) {
                    try {
                        window.opener.postMessage({
                            type: 'SPLITIT_GDRIVE_AUTH_TOKEN',
                            hash: hashPart
                        }, window.location.origin);
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
                    let targetUrl = window.location.pathname;
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

        // 1. Check current URL hash or query (for OAuth redirect flow on mobile web and WebViews)
        if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
            processTokenHash(window.location.href);
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
            if (typeof window !== 'undefined' && event.origin !== window.location.origin) return;
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
            capListenerPromise = CapApp.addListener('appUrlOpen', async (data) => {
                if (data?.url) {
                    try {
                        const { Browser } = await import('@capacitor/browser');
                        await Browser.close();
                    } catch {
                        // ignore if already closed
                    }
                    processTokenHash(data.url);
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
                setSyncStatus(gdrive.isSessionPersisted() ? 'reauth_required' : 'disconnected');
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
            if (isImportSyncLockRef.current) return;
            if (isAutoSyncEnabled && gdrive.isAuthenticated() && navigator.onLine && !isSyncingRef.current) {
                syncNow();
            }
        };

        window.addEventListener('focus', handleFocus);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') handleFocus();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Trigger once on initial startup
        let launchTimer = null;
        if (!hasMountedLaunchRef.current) {
            hasMountedLaunchRef.current = true;
            launchTimer = setTimeout(() => {
                if (isImportSyncLockRef.current) return;
                if (isAutoSyncEnabled && gdrive.isAuthenticated() && navigator.onLine) {
                    syncNow();
                }
            }, 1200);
        }

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (launchTimer) clearTimeout(launchTimer);
        };
    }, [isAutoSyncEnabled, syncNow]);

    // Debounced 3-second auto-sync after user mutations
    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            lastSyncedHashRef.current = gdrive.computeStateHash(state);
            return;
        }

        if (isImportSyncLockRef.current) return;

        if (isApplyingDriveMergeRef.current) {
            isApplyingDriveMergeRef.current = false;
            return;
        }

        if (isSyncingRef.current) return;

        // Break infinite loop: only trigger if state actually changed from last synced hash
        const currentHash = gdrive.computeStateHash(state);
        if (currentHash === lastSyncedHashRef.current) {
            return;
        }

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
                        isApplyingRemoteGroupSyncRef.current = true;
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
        if (isApplyingRemoteGroupSyncRef.current) {
            isApplyingRemoteGroupSyncRef.current = false;
            return;
        }
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

    const enableGroupSync = useCallback(async (groupId, existingSecret = null, groupOverride = null) => {
        const group = groupOverride || (stateRef.current.groups || []).find(g => g.id === groupId);
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

        // Construct updated state snapshot so publishGroupUpdate never reads stale state
        const targetGroup = {
            ...group,
            isShared: true,
            syncSecret: secret
        };
        const currentGroups = (stateRef.current.groups || []).filter(g => g.id !== groupId);
        const nextStateSnapshot = {
            ...stateRef.current,
            groups: [...currentGroups, targetGroup]
        };

        // Immediately publish current group state to relays
        const pubRes = await multiSync.publishGroupUpdate(nextStateSnapshot, groupId, secret);
        if (pubRes.success) {
            setGroupSyncStatus(groupId, {
                status: 'synced',
                lastSyncedAt: pubRes.timestamp,
                error: null
            });
        }

        const inviteCode = multiSync.generateInviteCode(targetGroup, secret);
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
        const group = (stateRef.current.groups || []).find(g => g.id === groupId);
        if (!group || !group.syncSecret) return { success: false, error: 'Group is not shared' };

        setGroupSyncStatus(groupId, { status: 'syncing', error: null });

        try {
            // 1. Broadcast our latest local group data
            await multiSync.publishGroupUpdate(stateRef.current, groupId);

            // 2. Fetch latest snapshot from relays
            const fetchRes = await multiSync.fetchGroupStateOnce(groupId, group.syncSecret);
            if (fetchRes.success && fetchRes.payload) {
                isApplyingRemoteGroupSyncRef.current = true;
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
    }, [setGroupSyncStatus]);

    const joinSharedGroup = useCallback(async (inviteCode, myMemberId = null, prefetchedPayload = null, newMemberObj = null) => {
        const parsed = multiSync.parseInviteCode(inviteCode);
        if (!parsed) {
            return { success: false, error: 'Invalid invite code format. Must start with SPLIT-1-...' };
        }

        const { groupId, syncSecret } = parsed;
        setGroupSyncStatus(groupId, { status: 'syncing', error: null });

        try {
            let payload = prefetchedPayload;
            if (!payload) {
                const fetchRes = await multiSync.fetchGroupStateOnce(groupId, syncSecret, 7000);
                if (!fetchRes.success || !fetchRes.payload) {
                    setGroupSyncStatus(groupId, { status: 'offline', error: fetchRes.error });
                    return { success: false, error: fetchRes.error || 'Could not fetch group data from relays.' };
                }
                payload = fetchRes.payload;
            }

            if (newMemberObj && !(stateRef.current.users || []).some(u => u.id === newMemberObj.id)) {
                stateRef.current = {
                    ...stateRef.current,
                    users: [...(stateRef.current.users || []), newMemberObj]
                };
            }

            isApplyingRemoteGroupSyncRef.current = true;
            dispatch({
                type: MERGE_GROUP_SYNC_DATA,
                payload: {
                    ...payload,
                    syncSecret
                },
                myMemberId: myMemberId || null
            });

            setGroupSyncStatus(groupId, {
                status: 'live',
                lastSyncedAt: new Date().toISOString(),
                error: null
            });

            // If myMemberId was newly added, publish merged state so existing group members receive it immediately
            const mergedGroupState = multiSync.mergeGroupSyncPayload(stateRef.current, { ...payload, syncSecret }, myMemberId || null);
            const targetGroup = (mergedGroupState.groups || []).find(g => g.id === groupId);
            const localGroupBefore = (stateRef.current.groups || []).find(g => g.id === groupId);
            const wasMemberAdded = myMemberId && (!localGroupBefore || !(localGroupBefore.members || []).includes(myMemberId));

            if (wasMemberAdded && targetGroup) {
                try {
                    await multiSync.publishGroupUpdate(mergedGroupState, groupId, syncSecret);
                } catch (pubErr) {
                    console.warn('Failed publishing new member to relays:', pubErr);
                }
            }

            return {
                success: true,
                groupId,
                group: targetGroup || payload.group,
                members: payload.members || []
            };
        } catch (err) {
            console.error('joinSharedGroup error:', err);
            setGroupSyncStatus(groupId, { status: 'offline', error: err.message });
            return { success: false, error: err.message || 'Failed to join group' };
        }
    }, [setGroupSyncStatus]);

    const addUser = (name, email = null) => {
        const id = generateId();
        const now = new Date().toISOString();
        const trimmedEmail = (typeof email === 'string' && email.trim()) ? email.trim() : null;
        const newUser = { id, name: (name || '').trim(), email: trimmedEmail, createdAt: now, updatedAt: now };
        stateRef.current = {
            ...stateRef.current,
            users: [...(stateRef.current.users || []), newUser]
        };
        dispatch({
            type: ADD_USER,
            payload: { id, name: (name || '').trim(), email: trimmedEmail }
        });
        return id;
    };

    const updateUser = (userId, updates = {}) => {
        dispatch({
            type: UPDATE_USER,
            payload: { id: userId, ...updates }
        });
    };

    const mergeUsers = (sourceUserId, targetUserId, options = {}) => {
        dispatch({
            type: MERGE_USERS,
            payload: { sourceUserId, targetUserId, options }
        });
    };

    const deleteUser = (userId) => {
        dispatch({
            type: DELETE_USER,
            payload: userId
        });
    };

    const addGroup = ({
        name,
        type = 'other',
        icon = 'users',
        color = '#10b981',
        members = [],
        simplifyDebts = true,
        defaultCollectorId = null,
        isShared = false,
        syncSecret = null,
        myMemberId = null
    }) => {
        const id = 'grp_' + generateId();
        const now = new Date().toISOString();
        const newGroup = {
            id,
            name: name.trim(),
            type,
            icon,
            color,
            members,
            simplifyDebts,
            defaultCollectorId: defaultCollectorId || null,
            isShared: !!isShared,
            syncSecret: syncSecret || null,
            myMemberId: myMemberId || null,
            createdAt: now,
            updatedAt: now
        };
        stateRef.current = {
            ...stateRef.current,
            groups: [...(stateRef.current.groups || []), newGroup]
        };
        dispatch({
            type: ADD_GROUP,
            payload: newGroup
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
                    balances[t.from] = (balances[t.from] || 0) + t.amount;
                    balances[t.to] = (balances[t.to] || 0) - t.amount;
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
                const baseMemberIds = group ? (group.members || []) : state.users.map(u => u.id);
                const allGroupParticipantIds = new Set(baseMemberIds);
                Object.keys(balances).forEach(id => {
                    if (Math.abs(balances[id] || 0) > 0.009) {
                        allGroupParticipantIds.add(id);
                    }
                });
                groupTx.forEach(t => {
                    (t.payers || []).forEach(p => allGroupParticipantIds.add(p.userId));
                    (t.splits || []).forEach(s => allGroupParticipantIds.add(s.userId));
                    if (t.from) allGroupParticipantIds.add(t.from);
                    if (t.to) allGroupParticipantIds.add(t.to);
                    if (t.collectorId) allGroupParticipantIds.add(t.collectorId);
                });
                const memberIds = Array.from(allGroupParticipantIds);

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

                        if (collectorId && debtMatrix[collectorId]) {
                            splits.forEach(s => {
                                if (s.userId !== collectorId && debtMatrix[s.userId] && debtMatrix[s.userId][collectorId] !== undefined) {
                                    debtMatrix[s.userId][collectorId] += s.amount;
                                }
                            });
                            payers.forEach(p => {
                                if (p.amount > 0 && p.userId !== collectorId && debtMatrix[collectorId]?.[p.userId] !== undefined) {
                                    debtMatrix[collectorId][p.userId] += p.amount;
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
        state.users.forEach(u => { globalBalances[u.id] = 0; });

        (state.transactions || []).forEach(t => {
            if (t.type === 'EXPENSE') {
                (t.payers || []).forEach(p => {
                    globalBalances[p.userId] = (globalBalances[p.userId] || 0) + p.amount;
                });
                (t.splits || []).forEach(s => {
                    globalBalances[s.userId] = (globalBalances[s.userId] || 0) - s.amount;
                });
            }
            if (t.type === 'SETTLEMENT') {
                globalBalances[t.from] = (globalBalances[t.from] || 0) + t.amount;
                globalBalances[t.to] = (globalBalances[t.to] || 0) - t.amount;
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
    const exportData = useCallback(() => {
        const exportObject = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            data: state
        };
        return JSON.stringify(exportObject, null, 2);
    }, [state]);

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

    // Advanced Interactive Import with normalization, merge/replace, safety backup, and cloud sync control
    const importBackupAdvanced = useCallback(async ({
        data,
        mode = 'REPLACE', // 'REPLACE' | 'MERGE'
        cloudAction = 'OVERWRITE', // 'OVERWRITE' | 'MERGE' | 'PAUSE'
        targetUserId = null,
        createSafetyBackup = true,
        exportSafetyFile = false
    }) => {
        // Clear any pending debounced sync timers and acquire import sync lock
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = null;
        }
        isImportSyncLockRef.current = true;
        isApplyingDriveMergeRef.current = true;

        try {
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid backup data provided');
            }

            // 1. Pre-import internal safety snapshot (instant & non-blocking)
            if (createSafetyBackup) {
                try {
                    const currentSnapshot = exportData();
                    localStorage.setItem('splitit_pre_import_snapshot', JSON.stringify({
                        timestamp: new Date().toISOString(),
                        snapshot: currentSnapshot
                    }));
                } catch (e) {
                    console.warn('Failed saving internal safety snapshot:', e);
                }
            }

            // Optional external file export if explicitly requested
            if (exportSafetyFile) {
                try {
                    const currentSnapshot = exportData();
                    const dateStr = new Date().toISOString().split('T')[0];
                    const safetyRes = await exportBackupJson(currentSnapshot, `splitit-safety-backup-${dateStr}.json`);
                    if (safetyRes?.canceled) {
                        return {
                            success: false,
                            canceled: true,
                            error: 'Safety backup was canceled. Import stopped.'
                        };
                    }
                } catch (e) {
                    console.warn('Safety backup file export failed:', e);
                    return {
                        success: false,
                        error: 'Failed to create safety backup file: ' + (e.message || 'Export error')
                    };
                }
            }

            // 2. Normalize data
            const rawPayload = (data.data && typeof data.data === 'object' && !Array.isArray(data.data))
                ? data.data
                : data;

            const now = new Date().toISOString();

            const rawTransactions = Array.isArray(rawPayload.transactions) ? rawPayload.transactions : [];
            let unmappedTransactions;
            if (rawTransactions.length > 0) {
                unmappedTransactions = rawTransactions;
            } else {
                const legacyExpenses = Array.isArray(rawPayload.expenses)
                    ? rawPayload.expenses.map(e => ({ ...e, type: e.type || 'EXPENSE' }))
                    : [];
                const legacySettlements = Array.isArray(rawPayload.settlements)
                    ? rawPayload.settlements.map(s => ({ ...s, type: s.type || 'SETTLEMENT' }))
                    : [];
                unmappedTransactions = [...legacyExpenses, ...legacySettlements];
            }

            // Normalize items with valid timestamps to guarantee hash consistency across reducer and Drive upload
            const normalizedTransactions = unmappedTransactions.map(t => ({
                ...t,
                createdAt: t.createdAt || now,
                updatedAt: t.updatedAt || t.createdAt || now
            }));

            const rawUsers = Array.isArray(rawPayload.users)
                ? rawPayload.users
                : (Array.isArray(rawPayload.members) ? rawPayload.members : []);
            const normalizedUsers = (rawUsers.length > 0 ? rawUsers : state.users).map(u => ({
                ...u,
                createdAt: u.createdAt || now,
                updatedAt: u.updatedAt || u.createdAt || now
            }));

            const rawGroups = Array.isArray(rawPayload.groups) ? rawPayload.groups : [];
            const normalizedGroups = rawGroups.map(g => ({
                ...g,
                createdAt: g.createdAt || now,
                updatedAt: g.updatedAt || g.createdAt || now
            }));

            const effectiveCurrency = typeof rawPayload.currency === 'string' && rawPayload.currency.trim()
                ? rawPayload.currency.trim()
                : (state.currency || 'INR');

            const targetGroupId = rawPayload.selectedGroupId !== undefined ? rawPayload.selectedGroupId : state.selectedGroupId;
            const validSelectedGroupId = (
                targetGroupId === 'non-group' ||
                normalizedGroups.some(g => g.id === targetGroupId)
            ) ? targetGroupId : null;

            const cleanNormalizedData = {
                users: normalizedUsers,
                groups: normalizedGroups,
                transactions: normalizedTransactions,
                deletedIds: {
                    groups: {},
                    members: {},
                    expenses: {},
                    settlements: {},
                    ...(rawPayload.deletedIds || {})
                },
                currency: effectiveCurrency,
                currentUserId: targetUserId || rawPayload.currentUserId || (normalizedUsers[0]?.id || state.currentUserId),
                selectedGroupId: validSelectedGroupId
            };

            let resultingState = cleanNormalizedData;

            if (mode === 'MERGE') {
                const merged = gdrive.mergeAppState(state, cleanNormalizedData);
                if (targetUserId) {
                    merged.currentUserId = targetUserId;
                }
                delete merged.expenses;
                delete merged.settlements;
                resultingState = merged;
                dispatch({ type: MERGE_SYNCED_DATA, payload: merged });
            } else {
                // REPLACE mode
                resultingState = cleanNormalizedData;
                dispatch({ type: IMPORT_DATA, payload: cleanNormalizedData });
            }

            // 3. Cloud sync action (when authenticated or session persisted with Google Drive)
            const isDriveConnected = gdrive.isAuthenticated() || gdrive.isSessionPersisted();
            if (isDriveConnected) {
                if (cloudAction === 'PAUSE') {
                    if (syncTimerRef.current) {
                        clearTimeout(syncTimerRef.current);
                        syncTimerRef.current = null;
                    }
                    setIsAutoSyncEnabled(false);
                    lastSyncedHashRef.current = gdrive.computeStateHash(resultingState);
                } else if (cloudAction === 'OVERWRITE') {
                    let cloudSuccess = false;
                    try {
                        let token = gdrive.getAccessToken();
                        if (!token && gdrive.isSessionPersisted()) {
                            const restored = await gdrive.trySilentRestore();
                            if (restored) {
                                token = gdrive.getAccessToken();
                            }
                        }

                        if (token) {
                            let fileId = null;
                            try {
                                fileId = localStorage.getItem(gdrive.STORAGE_KEY_FILE_ID);
                            } catch {
                                // ignore
                            }
                            if (!fileId) {
                                try {
                                    const remoteFile = await gdrive.findAppDataFile(token);
                                    fileId = remoteFile?.id || null;
                                } catch {
                                    // ignore
                                }
                            }

                            const payload = {
                                version: '2.1',
                                appName: 'SplitIt',
                                lastSyncedAt: now,
                                data: resultingState
                            };

                            const uploadRes = await gdrive.uploadAppData(token, payload, fileId);
                            if (uploadRes?.id && !fileId) {
                                try {
                                    localStorage.setItem(gdrive.STORAGE_KEY_FILE_ID, uploadRes.id);
                                } catch {
                                    // ignore
                                }
                            }
                            gdrive.setLastSynced(now);
                            setLastSyncedAt(now);
                            lastSyncedHashRef.current = gdrive.computeStateHash(resultingState);
                            cloudSuccess = true;
                        }
                    } catch (cloudErr) {
                        console.error('Failed to overwrite Google Drive cloud data:', cloudErr);
                    }

                    if (!cloudSuccess) {
                        // Pause auto-sync and align hash so stale cloud records don't overwrite restored local data
                        if (syncTimerRef.current) {
                            clearTimeout(syncTimerRef.current);
                            syncTimerRef.current = null;
                        }
                        setIsAutoSyncEnabled(false);
                        lastSyncedHashRef.current = gdrive.computeStateHash(resultingState);
                        return {
                            success: true,
                            count: normalizedTransactions.length,
                            cloudWarning: 'Data restored locally, but Google Drive could not be updated. Auto-sync was paused to protect your restored data.'
                        };
                    }
                } else if (cloudAction === 'MERGE') {
                    setTimeout(() => {
                        syncNow();
                    }, 500);
                }
            } else {
                lastSyncedHashRef.current = gdrive.computeStateHash(resultingState);
            }

            return { success: true, count: normalizedTransactions.length };
        } catch (error) {
            console.error('importBackupAdvanced error:', error);
            return {
                success: false,
                error: error.message || 'Failed to import backup'
            };
        } finally {
            // Always guarantee sync lock and drive merge flags are cleanly released
            isImportSyncLockRef.current = false;
            isApplyingDriveMergeRef.current = false;
        }
    }, [state, exportData, setIsAutoSyncEnabled, syncNow]);

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

    // Filtered Transactions for Active Group (sorted chronologically descending)
    const filteredTransactions = useMemo(() => {
        let txs = state.transactions || [];
        if (state.selectedGroupId) {
            if (state.selectedGroupId === 'non-group') {
                txs = txs.filter(t => !t.groupId || t.groupId === 'non-group');
            } else {
                txs = txs.filter(t => t.groupId === state.selectedGroupId);
            }
        }
        return [...txs].sort((a, b) => {
            const timeA = new Date(a.date || a.createdAt || 0).getTime();
            const timeB = new Date(b.date || b.createdAt || 0).getTime();
            if (timeB !== timeA) return timeB - timeA;
            const updA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const updB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return updB - updA;
        });
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
            updateUser,
            mergeUsers,
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
            importBackupAdvanced,
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
