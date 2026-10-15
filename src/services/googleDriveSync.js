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
        .replace(/^["']|["']$/g, '')
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
 * Silently attempts to refresh or restore the access token via GIS
 */
export async function trySilentRestore() {
    try {
        if (!isSessionPersisted()) return false;

        // If currently valid token exists, verify connection
        if (isAuthenticated()) {
            return true;
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
 * - In Capacitor (Android/iOS) and local dev: 'http://localhost'
 * - In hosted environments: origin + pathname (without trailing index.html)
 */
export function getOAuthRedirectUri() {
    if (typeof window === 'undefined') return 'http://localhost';
    const origin = window.location.origin || 'http://localhost';
    if (origin === 'null' || origin.startsWith('file:')) {
        return 'http://localhost';
    }
    if (origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) {
        return origin;
    }
    const cleanPath = (window.location.pathname || '').replace(/\/index\.html$/, '').replace(/\/$/, '');
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
export function parseTokenFromHash(hash) {
    if (!hash) return null;
    const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
    const params = new URLSearchParams(cleanHash);
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');

    if (accessToken) {
        return {
            accessToken,
            expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600
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
        clearAuth();
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
        clearAuth();
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
            clearAuth();
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
            clearAuth();
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
            clearAuth();
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

        if (remoteFile && remoteFile.id) {
            // File exists: Download & Merge
            const remoteContent = await downloadAppData(token, remoteFile.id);
            const remoteState = remoteContent?.data || remoteContent || {};

            // Perform deterministic conflict-free merge
            const mergedState = typeof mergeFn === 'function'
                ? mergeFn(localState, remoteState)
                : { ...localState, ...remoteState };

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

    // 1. Wait briefly for GIS to load if not already ready
    if (!window.google?.accounts?.oauth2?.initTokenClient) {
        await ensureGisLoaded(1500);
    }

    // 2. Try Google Identity Services (GIS) token client popup mode
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

    // 3. Fallback to standard OAuth 2.0 implicit flow via popup / redirect
    const redirectUri = getOAuthRedirectUri();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(activeClientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(OAUTH_SCOPE)}&` +
        `include_granted_scopes=true&` +
        `prompt=${encodeURIComponent(promptMode)}`;

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
        // Popup was blocked or unsupported (e.g. Android WebView): navigate in place
        try {
            localStorage.setItem(STORAGE_KEY_CONNECTED, 'true');
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
