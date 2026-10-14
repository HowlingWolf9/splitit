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
 * Returns active Google OAuth Client ID:
 * 1. User-configured custom client ID from localStorage
 * 2. Environment variable VITE_GOOGLE_CLIENT_ID
 * 3. Default fallback client ID
 */
export function getClientId() {
    try {
        const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_CLIENT_ID);
        if (custom && custom.trim().length > 0) {
            return custom.trim();
        }
    } catch {
        // LocalStorage access fallback
    }

    if (import.meta.env?.VITE_GOOGLE_CLIENT_ID) {
        return import.meta.env.VITE_GOOGLE_CLIENT_ID;
    }

    // Default zero-server placeholder / fallback client ID for SplitIt
    return '1048596041042-splitit-demo-client-id.apps.googleusercontent.com';
}

export function setCustomClientId(clientId) {
    try {
        if (!clientId || clientId.trim().length === 0) {
            localStorage.removeItem(STORAGE_KEY_CUSTOM_CLIENT_ID);
        } else {
            localStorage.setItem(STORAGE_KEY_CUSTOM_CLIENT_ID, clientId.trim());
        }
    } catch (e) {
        console.error('Failed to save custom client ID:', e);
    }
}

export function getCustomClientId() {
    try {
        return localStorage.getItem(STORAGE_KEY_CUSTOM_CLIENT_ID) || '';
    } catch {
        return '';
    }
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
    } catch (e) {
        console.error('Failed to save access token:', e);
    }
}

/**
 * Clears stored authentication tokens
 */
export function clearAuth() {
    try {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
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
 * - Uses Google Identity Services (GIS) token client if available
 * - Falls back to OAuth 2.0 implicit popup / redirect
 */
export function initiateGoogleAuth({ clientId = getClientId(), onToken, onError }) {
    // 1. Try Google Identity Services (GIS) if loaded in window
    if (window.google?.accounts?.oauth2?.initTokenClient) {
        try {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: OAUTH_SCOPE,
                callback: (resp) => {
                    if (resp.error) {
                        onError?.(new Error(resp.error_description || resp.error));
                        return;
                    }
                    if (resp.access_token) {
                        setAccessToken(resp.access_token, resp.expires_in || 3600);
                        onToken?.(resp.access_token, resp.expires_in || 3600);
                    }
                }
            });
            tokenClient.requestAccessToken({ prompt: 'consent' });
            return;
        } catch (e) {
            console.warn('GIS initTokenClient failed, falling back to popup:', e);
        }
    }

    // 2. Fallback to standard OAuth 2.0 implicit flow via popup / redirect
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(OAUTH_SCOPE)}&` +
        `include_granted_scopes=true&` +
        `prompt=consent`;

    // Attempt popup
    const popup = window.open(
        authUrl,
        'splitit_google_auth',
        'width=540,height=680,menubar=no,toolbar=no,status=no,resizable=yes'
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Popup was blocked: navigate in place as last resort
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
