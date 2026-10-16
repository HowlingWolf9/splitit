/**
 * SplitIt — Zero-Server Google Drive AppDataFolder Cross-Device Sync Service
 * 
 * Interacts directly with Google Drive v3 REST API via fetch() using the
 * least-privileged scope: https://www.googleapis.com/auth/drive.appdata
 * Stores state inside a hidden application file: splitit_appdata_v1.json
 */

export const APP_DATA_FILE_NAME = 'splitit_appdata_v1.json';
export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
export const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
export const OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export const STORAGE_KEY_TOKEN = 'splitit_gdrive_access_token';
export const STORAGE_KEY_EXPIRES_AT = 'splitit_gdrive_token_expires_at';
export const STORAGE_KEY_CUSTOM_CLIENT_ID = 'splitit_gdrive_custom_client_id';
export const STORAGE_KEY_AUTOSYNC = 'splitit_gdrive_autosync';
export const STORAGE_KEY_LAST_SYNCED = 'splitit_gdrive_last_synced';
export const STORAGE_KEY_FILE_ID = 'splitit_gdrive_file_id';
export const STORAGE_KEY_USER_PROFILE = 'splitit_gdrive_user_profile';
export const STORAGE_KEY_CONNECTED = 'splitit_gdrive_connected';

export const DEFAULT_GOOGLE_CLIENT_ID =
    '1048596041042-32b07m6m2sp99v1g7v7v0j4p8n0s2r9f.apps.googleusercontent.com';

/**
 * Computes a fast deterministic 32-bit hash of the core application state
 * (users, groups, transactions, deleted tombstones, and currency).
 * Returns hex string. Returns empty string for empty/null state.
 */
export function computeStateHash(state) {
    if (!state || typeof state !== 'object') return '';

    const users = Array.isArray(state.users) ? state.users : (Array.isArray(state.members) ? state.members : []);
    const groups = Array.isArray(state.groups) ? state.groups : [];

    let transactions = [];
    if (Array.isArray(state.transactions) && state.transactions.length > 0) {
        transactions = state.transactions;
    } else {
        const exp = Array.isArray(state.expenses) ? state.expenses : [];
        const stl = Array.isArray(state.settlements) ? state.settlements : [];
        transactions = [...exp, ...stl];
    }

    const normalized = {
        u: users.map(u => ({
            id: u.id || '',
            u: u.updatedAt || u.createdAt || '',
            n: u.name || '',
            e: u.email || '',
            p: u.phone || ''
        })).sort((a, b) => (a.id || '').localeCompare(b.id || '')),

        g: groups.map(g => ({
            id: g.id || '',
            u: g.updatedAt || g.createdAt || '',
            n: g.name || '',
            m: Array.isArray(g.members) ? [...g.members].sort() : []
        })).sort((a, b) => (a.id || '').localeCompare(b.id || '')),

        t: transactions.map(t => ({
            id: t.id || '',
            u: t.updatedAt || t.createdAt || '',
            a: t.amount ?? '',
            d: t.date || '',
            desc: t.description || '',
            cat: t.category || '',
            type: t.type || 'EXPENSE',
            p: t.payerId || '',
            payers: t.payers ? Object.keys(t.payers).sort().map(k => `${k}:${t.payers[k]}`).join(',') : '',
            sm: t.splitMode || '',
            splits: t.splits ? Object.keys(t.splits).sort().map(k => `${k}:${t.splits[k]}`).join(',') : '',
            g: t.groupId || ''
        })).sort((a, b) => (a.id || '').localeCompare(b.id || '')),

        d: {
            g: Object.keys(state.deletedIds?.groups || {}).sort().reduce((acc, k) => { acc[k] = state.deletedIds.groups[k]; return acc; }, {}),
            m: Object.keys(state.deletedIds?.members || {}).sort().reduce((acc, k) => { acc[k] = state.deletedIds.members[k]; return acc; }, {}),
            e: Object.keys(state.deletedIds?.expenses || {}).sort().reduce((acc, k) => { acc[k] = state.deletedIds.expenses[k]; return acc; }, {}),
            s: Object.keys(state.deletedIds?.settlements || {}).sort().reduce((acc, k) => { acc[k] = state.deletedIds.settlements[k]; return acc; }, {})
        },

        c: state.currency || 'INR'
    };

    const str = JSON.stringify(normalized);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash.toString(16);
}

/**
 * Deterministic conflict-free app state merger:
 * - Unions records by ID
 * - Filters out records whose IDs exist in merged deletedIds with deletedAt >= updatedAt
 * - Resolves conflicts by selecting the record with newer updatedAt
 */
export function mergeAppState(localState, remoteState) {
    if (!remoteState) return localState;
    if (!localState) return remoteState;

    const localDeleted = localState.deletedIds || {};
    const remoteDeleted = remoteState.deletedIds || {};

    const mergeTombstones = (localMap = {}, remoteMap = {}) => {
        const merged = { ...localMap };
        Object.entries(remoteMap || {}).forEach(([id, remoteTime]) => {
            if (!merged[id]) {
                merged[id] = remoteTime;
            } else {
                const localDate = new Date(merged[id]).getTime();
                const remoteDate = new Date(remoteTime).getTime();
                merged[id] = remoteDate > localDate ? remoteTime : merged[id];
            }
        });
        return merged;
    };

    const mergedDeletedIds = {
        groups: mergeTombstones(localDeleted.groups, remoteDeleted.groups),
        members: mergeTombstones(
            { ...(localDeleted.members || {}), ...(localDeleted.users || {}) },
            { ...(remoteDeleted.members || {}), ...(remoteDeleted.users || {}) }
        ),
        expenses: mergeTombstones(
            { ...(localDeleted.expenses || {}), ...(localDeleted.transactions || {}) },
            { ...(remoteDeleted.expenses || {}), ...(remoteDeleted.transactions || {}) }
        ),
        settlements: mergeTombstones(
            { ...(localDeleted.settlements || {}), ...(localDeleted.transactions || {}) },
            { ...(remoteDeleted.settlements || {}), ...(remoteDeleted.transactions || {}) }
        )
    };

    const isTombstoned = (id, updatedAt, tombstoneMap) => {
        const deletedAt = tombstoneMap[id];
        if (!deletedAt) return false;
        const deletedTime = new Date(deletedAt).getTime();
        const updatedTime = updatedAt ? new Date(updatedAt).getTime() : 0;
        return deletedTime >= updatedTime;
    };

    const mergeCollection = (localList = [], remoteList = [], tombstoneMap = {}) => {
        const map = new Map();

        (localList || []).forEach(item => {
            if (!item || !item.id) return;
            if (isTombstoned(item.id, item.updatedAt, tombstoneMap)) return;
            map.set(item.id, item);
        });

        (remoteList || []).forEach(item => {
            if (!item || !item.id) return;
            if (isTombstoned(item.id, item.updatedAt, tombstoneMap)) return;

            const existing = map.get(item.id);
            if (!existing) {
                map.set(item.id, item);
            } else {
                const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
                const itemTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
                if (itemTime > existingTime) {
                    map.set(item.id, item);
                }
            }
        });

        return Array.from(map.values());
    };

    const localUsers = localState.users || [];
    const remoteUsers = remoteState.users || remoteState.members || [];
    const mergedUsers = mergeCollection(localUsers, remoteUsers, mergedDeletedIds.members);

    const localGroups = localState.groups || [];
    const remoteGroups = remoteState.groups || [];
    const mergedGroups = mergeCollection(localGroups, remoteGroups, mergedDeletedIds.groups);

    const getTransactionsFromState = (s) => {
        if (!s) return [];
        if (Array.isArray(s.transactions) && s.transactions.length > 0) {
            return s.transactions;
        }
        const exp = Array.isArray(s.expenses) ? s.expenses.map(e => ({ ...e, type: 'EXPENSE' })) : [];
        const stl = Array.isArray(s.settlements) ? s.settlements.map(t => ({ ...t, type: 'SETTLEMENT' })) : [];
        return [...exp, ...stl];
    };

    const localTx = getTransactionsFromState(localState);
    const remoteTx = getTransactionsFromState(remoteState);
    const combinedTxTombstones = {
        ...mergedDeletedIds.expenses,
        ...mergedDeletedIds.settlements
    };
    const mergedTransactions = mergeCollection(localTx, remoteTx, combinedTxTombstones);
    mergedTransactions.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

    const currency = localState.currency || remoteState.currency || 'INR';
    const currentUserId = (mergedUsers.find(u => u.id === localState.currentUserId) ? localState.currentUserId : mergedUsers[0]?.id) || 'u_you';
    const selectedGroupId = (mergedGroups.find(g => g.id === localState.selectedGroupId) || localState.selectedGroupId === 'non-group')
        ? localState.selectedGroupId
        : null;

    return {
        ...localState,
        users: mergedUsers,
        groups: mergedGroups,
        transactions: mergedTransactions,
        deletedIds: mergedDeletedIds,
        currency,
        currentUserId,
        selectedGroupId
    };
}

/**
 * Sanitizes Google OAuth Client ID by trimming whitespace,
 * stripping accidental surrounding quotes, and removing trailing delimiters.
 */
export function sanitizeClientId(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw
        .trim()
        .replace(/[;/\\#]+$/, '')
        .trim()
        .replace(/^["']+|["']+$/g, '')
        .replace(/[;/\\#]+$/, '')
        .trim();
}

/**
 * Validates whether a Google OAuth Client ID is well-formed:
 * - Must be non-empty
 * - Must not be a placeholder (e.g. demo-client-id or your-client-id)
 * - Must end with .apps.googleusercontent.com
 * - Must match valid Google OAuth Web client ID syntax: <digits>-<hash>.apps.googleusercontent.com
 */
export function isValidClientId(raw) {
    const sanitized = sanitizeClientId(raw);
    if (!sanitized) return false;
    if (
        sanitized.includes('splitit-demo-client-id') ||
        sanitized.includes('your-client-id') ||
        sanitized.includes('example.com')
    ) {
        return false;
    }
    return /^[0-9]+-[a-zA-Z0-9_\-.]+\.apps\.googleusercontent\.com$/.test(sanitized);
}

/**
 * Returns active Google OAuth Client ID:
 * 1. Environment variable VITE_GOOGLE_CLIENT_ID if valid
 * 2. Hardcoded production fallback DEFAULT_GOOGLE_CLIENT_ID
 */
export function getClientId() {
    const envId = sanitizeClientId(import.meta.env?.VITE_GOOGLE_CLIENT_ID);
    if (envId && isValidClientId(envId)) {
        return envId;
    }
    return DEFAULT_GOOGLE_CLIENT_ID;
}

/**
 * Identifies the source of the active Client ID:
 * 'env' | 'builtin'
 */
export function getClientIdSource() {
    const envId = sanitizeClientId(import.meta.env?.VITE_GOOGLE_CLIENT_ID);
    if (envId && isValidClientId(envId)) {
        return 'env';
    }
    return 'builtin';
}

/**
 * Returns whether a valid Google OAuth Client ID is currently available (always true)
 */
export function hasConfiguredClientId() {
    return true;
}

export function setCustomClientId() {
    // Deprecated: UI does not expose custom client IDs
}

export function getCustomClientId() {
    return '';
}

/**
 * Fetches user profile (email and display name) from Google Drive API
 */
export async function fetchUserProfile(token = getAccessToken()) {
    if (!token) return null;
    try {
        const res = await fetch(`${DRIVE_API_BASE}/about?fields=user(displayName,emailAddress,photoLink)`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.user) {
                const profile = {
                    name: data.user.displayName || '',
                    email: data.user.emailAddress || '',
                    photo: data.user.photoLink || ''
                };
                try {
                    localStorage.setItem(STORAGE_KEY_USER_PROFILE, JSON.stringify(profile));
                } catch {
                    // ignore
                }
                return profile;
            }
        }
    } catch (e) {
        console.warn('Failed to fetch user profile:', e);
    }
    return null;
}

/**
 * Returns cached Google user profile if available
 */
export function getUserProfile() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_USER_PROFILE);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Checks whether user previously signed in and session should be auto-restored
 */
export function isSessionPersisted() {
    try {
        return localStorage.getItem(STORAGE_KEY_CONNECTED) === 'true';
    } catch {
        return false;
    }
}

/**
 * Ensures Google Identity Services (GIS) client script is loaded
 */
export function ensureGisLoaded(timeoutMs = 2500) {
    if (window.google?.accounts?.oauth2?.initTokenClient) return Promise.resolve(true);
    return new Promise((resolve) => {
        const start = Date.now();
        const check = setInterval(() => {
            if (window.google?.accounts?.oauth2?.initTokenClient) {
                clearInterval(check);
                resolve(true);
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(check);
                resolve(false);
            }
        }, 100);
    });
}

/**
 * Detects whether the current device is a mobile browser or touch device
 */
export function isMobileDevice() {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i.test(ua);
    // iPadOS 13+ reports 'Macintosh' user-agent but has multitouch capabilities
    const isIPadOS = /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
    const hasTouchScreen = (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0) && (window.innerWidth <= 1024 || isIPadOS);
    return isMobileUA || isIPadOS || hasTouchScreen;
}

/**
 * Detects whether the current environment is running inside Capacitor native container (Android / iOS)
 */
export function isCapacitorNative() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.Capacitor?.isNativePlatform?.());
}

/**
 * Detects whether the current environment is running inside Capacitor native container or on mobile
 */
export function isMobileOrNative() {
    return isCapacitorNative() || isMobileDevice();
}

/**
 * Silently attempts to refresh or restore the access token via GIS (desktop only)
 */
export async function trySilentRestore() {
    try {
        if (!isSessionPersisted()) return false;

        // If currently valid token exists, verify connection
        if (isAuthenticated()) {
            return true;
        }

        // On mobile/native, avoid background GIS popup attempts that can stall on third-party cookie restrictions
        if (isMobileOrNative()) {
            return false;
        }

        const clientId = getClientId();
        if (!clientId) return false;

        // Ensure GIS library loaded
        if (!window.google?.accounts?.oauth2?.initTokenClient) {
            await ensureGisLoaded(2000);
        }

        if (window.google?.accounts?.oauth2?.initTokenClient) {
            return new Promise((resolve) => {
                let resolved = false;
                try {
                    const tokenClient = window.google.accounts.oauth2.initTokenClient({
                        client_id: clientId,
                        scope: OAUTH_SCOPE,
                        callback: (resp) => {
                            if (resolved) return;
                            resolved = true;
                            if (resp.access_token) {
                                setAccessToken(resp.access_token, resp.expires_in || 3600);
                                fetchUserProfile(resp.access_token).catch(() => {});
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        },
                        error_callback: () => {
                            if (resolved) return;
                            resolved = true;
                            resolve(false);
                        }
                    });
                    // prompt: '' enables silent renewal without prompting user
                    tokenClient.requestAccessToken({ prompt: '' });
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            resolve(false);
                        }
                    }, 3500);
                } catch {
                    resolve(false);
                }
            });
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Resolves standard OAuth redirect URI compatible with Google Web OAuth:
 * - In Capacitor (Android/iOS): 'com.splitit.expensemanager://oauth'
 * - In local dev: origin (e.g. 'http://localhost:5173')
 * - In hosted environments: origin + base pathname (without trailing index.html or client-side routes)
 */
export function getOAuthRedirectUri() {
    if (typeof window === 'undefined') return 'http://localhost';
    if (isCapacitorNative()) {
        return 'com.splitit.expensemanager://oauth';
    }
    const origin = window.location.origin || 'http://localhost';
    if (origin === 'null' || origin.startsWith('file:')) {
        return 'http://localhost';
    }
    if (origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) {
        return origin;
    }
    // Clean pathname: remove trailing index.html, query remnants, and any client-side routes (including nested ones like /groups/:id or /members/:id)
    const cleanPath = (window.location.pathname || '')
        .replace(/\/index\.html.*$/, '')
        .replace(/\/(?:settings|dashboard|groups|expenses|settlements|history|transactions|members|balances)(?:\/.*)?$/, '')
        .replace(/\/$/, '');
    return origin + (cleanPath || '');
}

/**
 * Retrieves valid Google OAuth access token if not expired
 */
export function getAccessToken() {
    try {
        const token = localStorage.getItem(STORAGE_KEY_TOKEN);
        const expiresAtStr = localStorage.getItem(STORAGE_KEY_EXPIRES_AT);

        if (!token) return null;

        if (expiresAtStr) {
            const expiresAt = parseInt(expiresAtStr, 10);
            // Allow 30-second buffer before expiration
            if (Date.now() >= expiresAt - 30000) {
                return null;
            }
        }

        return token;
    } catch {
        return null;
    }
}

/**
 * Saves Google OAuth access token with calculated expiration timestamp
 */
export function setAccessToken(token, expiresInSeconds = 3600) {
    try {
        if (!token) {
            clearAuth();
            return;
        }
        const expiresAt = Date.now() + Math.max(expiresInSeconds, 60) * 1000;
        localStorage.setItem(STORAGE_KEY_TOKEN, token);
        localStorage.setItem(STORAGE_KEY_EXPIRES_AT, expiresAt.toString());
        localStorage.setItem(STORAGE_KEY_CONNECTED, 'true');
    } catch (e) {
        console.error('Failed to save access token:', e);
    }
}

/**
 * Clears only the expired access token without wiping user profile or connection status.
 * Preserves STORAGE_KEY_CONNECTED and STORAGE_KEY_USER_PROFILE so the app knows the user's
 * identity and can seamlessly prompt or perform one-tap re-authorization.
 */
export function clearExpiredToken() {
    try {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
    } catch {
        // ignore
    }
}

/**
 * Clears stored authentication tokens and session
 */
export function clearAuth() {
    try {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
        localStorage.removeItem(STORAGE_KEY_USER_PROFILE);
        localStorage.removeItem(STORAGE_KEY_CONNECTED);
        localStorage.removeItem(STORAGE_KEY_FILE_ID);
        // Also cleanup legacy custom client id from earlier versions
        localStorage.removeItem(STORAGE_KEY_CUSTOM_CLIENT_ID);
    } catch {
        // ignore
    }
}

/**
 * Returns whether user is currently authenticated with valid, non-expired token
 */
export function isAuthenticated() {
    return !!getAccessToken();
}

/**
 * Returns token metadata for UI display
 */
export function getTokenInfo() {
    try {
        const token = localStorage.getItem(STORAGE_KEY_TOKEN);
        const expiresAtStr = localStorage.getItem(STORAGE_KEY_EXPIRES_AT);
        if (!token) return { hasToken: false, isExpired: true, minutesRemaining: 0 };

        if (!expiresAtStr) {
            return { hasToken: true, isExpired: false, minutesRemaining: 60 };
        }

        const expiresAt = parseInt(expiresAtStr, 10);
        const diffMs = expiresAt - Date.now();
        const isExpired = diffMs <= 0;
        const minutesRemaining = Math.max(0, Math.floor(diffMs / 60000));

        return {
            hasToken: true,
            isExpired,
            minutesRemaining,
            expiresAt: new Date(expiresAt).toISOString()
        };
    } catch {
        return { hasToken: false, isExpired: true, minutesRemaining: 0 };
    }
}

/**
 * Auto-sync toggle settings
 */
export function isAutoSyncEnabled() {
    try {
        const val = localStorage.getItem(STORAGE_KEY_AUTOSYNC);
        return val !== 'false'; // default is true
    } catch {
        return true;
    }
}

export function setAutoSyncEnabled(enabled) {
    try {
        localStorage.setItem(STORAGE_KEY_AUTOSYNC, enabled ? 'true' : 'false');
    } catch {
        // ignore
    }
}

export function getLastSynced() {
    try {
        return localStorage.getItem(STORAGE_KEY_LAST_SYNCED) || null;
    } catch {
        return null;
    }
}

export function setLastSynced(isoTimestamp = new Date().toISOString()) {
    try {
        localStorage.setItem(STORAGE_KEY_LAST_SYNCED, isoTimestamp);
    } catch {
        // ignore
    }
}

/**
 * Parse OAuth access token and expiration from URL hash (#access_token=...&expires_in=...)
 */
export function parseTokenFromHash(input) {
    if (!input || typeof input !== 'string') return null;

    let searchStr = '';
    let hashStr = '';

    const hashIdx = input.indexOf('#');
    const qIdx = input.indexOf('?');

    if (hashIdx !== -1) {
        hashStr = input.substring(hashIdx + 1);
    }
    if (qIdx !== -1) {
        searchStr = hashIdx !== -1 && hashIdx > qIdx
            ? input.substring(qIdx + 1, hashIdx)
            : input.substring(qIdx + 1);
    }
    if (hashIdx === -1 && qIdx === -1) {
        hashStr = input;
    }

    const hashParams = new URLSearchParams(hashStr);
    const searchParams = new URLSearchParams(searchStr);

    const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
    const expiresIn = hashParams.get('expires_in') || searchParams.get('expires_in');
    const error = hashParams.get('error') || searchParams.get('error');
    const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

    if (accessToken) {
        return {
            accessToken,
            expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600
        };
    }
    if (error) {
        return {
            error: errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, ' ')) : error
        };
    }
    return null;
}

/**
 * Searches for the SplitIt AppData file in Google Drive's hidden appDataFolder
 */
export async function findAppDataFile(token) {
    if (!token) throw new Error('Authentication token required');

    const query = encodeURIComponent(`name='${APP_DATA_FILE_NAME}' and trashed=false`);
    const url = `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,version)&pageSize=1`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        }
    });

    if (res.status === 401) {
        clearExpiredToken();
        throw new Error('Authentication expired. Please reconnect Google Drive.');
    }

    if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Google Drive API error (${res.status}): ${errorText || res.statusText}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
        const file = data.files[0];
        try {
            localStorage.setItem(STORAGE_KEY_FILE_ID, file.id);
        } catch {
            // ignore
        }
        return file;
    }

    return null;
}

/**
 * Downloads file content from appDataFolder
 */
export async function downloadAppData(token, fileId) {
    if (!token || !fileId) throw new Error('Missing token or file ID');

    const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (res.status === 401) {
        clearExpiredToken();
        throw new Error('Authentication expired. Please reconnect Google Drive.');
    }

    if (!res.ok) {
        throw new Error(`Failed to download app data from Google Drive (${res.status})`);
    }

    const json = await res.json();
    return json;
}

/**
 * Uploads data to Google Drive appDataFolder:
 * - If existingFileId is provided, performs PATCH to update the file
 * - Otherwise performs multipart POST to create splitit_appdata_v1.json
 */
export async function uploadAppData(token, data, existingFileId = null) {
    if (!token) throw new Error('Authentication token required');

    const payloadString = JSON.stringify(data, null, 2);

    if (existingFileId) {
        // Update existing file in appDataFolder
        const updateUrl = `${UPLOAD_API_BASE}/files/${existingFileId}?uploadType=media`;

        const res = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: payloadString
        });

        if (res.status === 401) {
            clearExpiredToken();
            throw new Error('Authentication expired. Please reconnect Google Drive.');
        }

        if (!res.ok) {
            const err = await res.text().catch(() => '');
            throw new Error(`Failed to update Drive file (${res.status}): ${err}`);
        }

        const updated = await res.json();
        return updated;
    } else {
        // Create new file in appDataFolder using multipart upload
        const boundary = 'splitit_sync_boundary_' + Math.random().toString(36).substring(2);
        const metadata = JSON.stringify({
            name: APP_DATA_FILE_NAME,
            parents: ['appDataFolder']
        });

        const multipartBody =
            `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${metadata}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: application/json\r\n\r\n` +
            `${payloadString}\r\n` +
            `--${boundary}--`;

        const uploadUrl = `${UPLOAD_API_BASE}/files?uploadType=multipart`;

        const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        if (res.status === 401) {
            clearExpiredToken();
            throw new Error('Authentication expired. Please reconnect Google Drive.');
        }

        if (!res.ok) {
            const err = await res.text().catch(() => '');
            throw new Error(`Failed to create Drive file (${res.status}): ${err}`);
        }

        const created = await res.json();
        if (created.id) {
            try {
                localStorage.setItem(STORAGE_KEY_FILE_ID, created.id);
            } catch {
                // ignore
            }
        }
        return created;
    }
}

/**
 * Lightweight connection test to verify token validity and Google Drive access
 */
export async function testConnection(token = getAccessToken()) {
    if (!token) return { success: false, error: 'No active access token found' };

    try {
        const url = `${DRIVE_API_BASE}/files?spaces=appDataFolder&pageSize=1`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            clearExpiredToken();
            return { success: false, error: 'Access token expired or unauthorized' };
        }

        if (!res.ok) {
            return { success: false, error: `Google Drive API returned status ${res.status}` };
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message || 'Network error reaching Google Drive' };
    }
}

/**
 * Orchestrates a complete bidirectional pull, merge, and push:
 * 1. Checks if splitit_appdata_v1.json exists in appDataFolder
 * 2. If exists, downloads remote state, merges with local state, and pushes merged state back
 * 3. If not exists, uploads local state to appDataFolder
 * 4. Records lastSynced timestamp
 */
export async function syncWithDrive(localState, mergeFn) {
    const token = getAccessToken();
    if (!token) {
        return {
            success: false,
            error: 'Not authenticated with Google Drive'
        };
    }

    try {
        let existingFileId = null;
        try {
            existingFileId = localStorage.getItem(STORAGE_KEY_FILE_ID);
        } catch {
            // ignore
        }

        // Verify or locate remote file
        let remoteFile = null;
        if (existingFileId) {
            try {
                const checkRes = await fetch(`${DRIVE_API_BASE}/files/${existingFileId}?fields=id,name,trashed`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (checkRes.ok) {
                    const data = await checkRes.json();
                    if (!data.trashed) {
                        remoteFile = data;
                    }
                }
            } catch {
                // file check failed, fallback to findAppDataFile
            }
        }

        if (!remoteFile) {
            remoteFile = await findAppDataFile(token);
        }

        const now = new Date().toISOString();
        const localHash = computeStateHash(localState);

        if (remoteFile && remoteFile.id) {
            // File exists: Download & Compare
            const remoteContent = await downloadAppData(token, remoteFile.id);
            const remoteState = remoteContent?.data || remoteContent || {};
            const remoteHash = computeStateHash(remoteState);

            // If local state and remote state are completely identical, skip upload entirely!
            if (localHash && remoteHash && localHash === remoteHash) {
                setLastSynced(now);
                return {
                    success: true,
                    mergedState: localState,
                    unchanged: true,
                    timestamp: now,
                    fileId: remoteFile.id
                };
            }

            // Perform deterministic conflict-free merge
            const mergedState = typeof mergeFn === 'function'
                ? mergeFn(localState, remoteState)
                : { ...localState, ...remoteState };

            const mergedHash = computeStateHash(mergedState);

            // If merged state is identical to remote, remote already has everything; skip upload!
            if (mergedHash && remoteHash && mergedHash === remoteHash) {
                setLastSynced(now);
                return {
                    success: true,
                    mergedState,
                    unchanged: false,
                    timestamp: now,
                    fileId: remoteFile.id
                };
            }

            const syncPayload = {
                version: '2.1',
                appName: 'SplitIt',
                lastSyncedAt: now,
                data: mergedState
            };

            await uploadAppData(token, syncPayload, remoteFile.id);
            setLastSynced(now);

            return {
                success: true,
                mergedState,
                timestamp: now,
                fileId: remoteFile.id
            };
        } else {
            // File doesn't exist yet: Initial upload
            const syncPayload = {
                version: '2.1',
                appName: 'SplitIt',
                lastSyncedAt: now,
                data: localState
            };

            const created = await uploadAppData(token, syncPayload, null);
            setLastSynced(now);

            return {
                success: true,
                mergedState: localState,
                timestamp: now,
                fileId: created.id
            };
        }
    } catch (err) {
        console.error('Google Drive sync failed:', err);
        return {
            success: false,
            error: err.message || 'Failed to sync with Google Drive'
        };
    }
}

/**
 * Initiates the Google OAuth 2.0 flow:
 * - Prefers Google Identity Services (GIS) token client popup mode for one-tap account selection
 * - Automatic fallback to standard OAuth 2.0 redirect flow on mobile WebViews
 */
export async function initiateGoogleAuth({ clientId = getClientId(), onToken, onError, promptMode = 'select_account' } = {}) {
    const activeClientId = sanitizeClientId(clientId || getClientId());

    if (!activeClientId) {
        const err = new Error('Google OAuth Client ID is not configured.');
        onError?.(err);
        return;
    }

    // 0. Tauri desktop loopback flow (opens Google OAuth in system default browser)
    const isTauriEnv = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
    if (isTauriEnv) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const { openUrl } = await import('@tauri-apps/plugin-opener');

            const callbackUrl = await invoke('start_oauth_listener');
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(activeClientId)}&` +
                `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
                `response_type=token&` +
                `scope=${encodeURIComponent(OAUTH_SCOPE)}&` +
                `include_granted_scopes=true&` +
                `prompt=${encodeURIComponent(promptMode)}`;

            await openUrl(authUrl);
            return;
        } catch (tauriErr) {
            console.warn('[SplitIt Tauri Auth] Failed loopback opener, falling back:', tauriErr);
        }
    }

    const redirectUri = getOAuthRedirectUri();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(activeClientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(OAUTH_SCOPE)}&` +
        `include_granted_scopes=true&` +
        `prompt=${encodeURIComponent(promptMode)}`;

    // 1. Native Capacitor environment: Launch Google OAuth in Chrome Custom Tabs
    // Shares the user's active Google account from their default browser (Chrome)
    // without requiring manual re-entry of password/2FA in an isolated WebView.
    if (isCapacitorNative()) {
        try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({ url: authUrl, windowName: '_system' });
            return;
        } catch (capErr) {
            console.warn('[SplitIt Auth] Capacitor Browser.open failed, falling back to redirect:', capErr);
        }
    }

    // 2. Mobile web browsers: Use direct standard OAuth redirect flow.
    // GIS popup mode on mobile opens a new tab and gets stuck indefinitely on
    // accounts.google.com/gsi/transformer because window.opener and window.close()
    // are blocked or severed across mobile browser tabs.
    if (isMobileDevice()) {
        try {
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('splitit_oauth_return_route', window.location.pathname + window.location.search);
            }
        } catch {
            // ignore
        }
        window.location.href = authUrl;
        return;
    }

    // 2. Desktop browsers: Wait briefly for GIS to load if not already ready
    if (!window.google?.accounts?.oauth2?.initTokenClient) {
        await ensureGisLoaded(1500);
    }

    // 3. Desktop browsers: Try Google Identity Services (GIS) token client popup mode
    if (window.google?.accounts?.oauth2?.initTokenClient) {
        try {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: activeClientId,
                scope: OAUTH_SCOPE,
                callback: (resp) => {
                    if (resp.error) {
                        onError?.(new Error(resp.error_description || resp.error));
                        return;
                    }
                    if (resp.access_token) {
                        setAccessToken(resp.access_token, resp.expires_in || 3600);
                        fetchUserProfile(resp.access_token).catch(() => {});
                        onToken?.(resp.access_token, resp.expires_in || 3600);
                    }
                }
            });
            tokenClient.requestAccessToken({ prompt: promptMode });
            return;
        } catch (e) {
            console.warn('GIS initTokenClient failed, falling back to popup/redirect:', e);
        }
    }

    // 4. Desktop fallback to standard OAuth 2.0 implicit flow via popup / redirect
    // Attempt popup
    let popup = null;
    try {
        popup = window.open(
            authUrl,
            'splitit_google_auth',
            'width=540,height=680,menubar=no,toolbar=no,status=no,resizable=yes'
        );
    } catch {
        // popup blocked
    }

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Popup was blocked: navigate in place
        try {
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('splitit_oauth_return_route', window.location.pathname + window.location.search);
            }
        } catch {
            // ignore
        }
        window.location.href = authUrl;
        return;
    }

    // Listen for cross-window messages from the popup
    const messageListener = (event) => {
        if (event.data?.type === 'SPLITIT_GDRIVE_AUTH_TOKEN' && event.data.hash) {
            window.removeEventListener('message', messageListener);
            const tokenData = parseTokenFromHash(event.data.hash);
            if (tokenData?.accessToken) {
                setAccessToken(tokenData.accessToken, tokenData.expiresIn);
                fetchUserProfile(tokenData.accessToken).catch(() => {});
                onToken?.(tokenData.accessToken, tokenData.expiresIn);
            }
        }
    };
    window.addEventListener('message', messageListener);

    // Poll popup closure
    const pollTimer = setInterval(() => {
        if (!popup || popup.closed) {
            clearInterval(pollTimer);
            window.removeEventListener('message', messageListener);
        }
    }, 1000);
}
