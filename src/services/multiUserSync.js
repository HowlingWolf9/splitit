/**
 * SplitIt - Zero-Server Multi-User Group Sync Engine
 * 
 * Architecture:
 * 1. Cryptographic Identity & Signing:
 *    - Uses native BigInt and Web Crypto SHA-256 for BIP-340 Schnorr signatures on secp256k1.
 *    - Zero-dependency, lightweight, and fully compliant with Nostr NIP-01 and NIP-78.
 *    - Deterministically derives group Nostr keypair from group.syncSecret.
 * 
 * 2. End-to-End Encryption (E2EE):
 *    - Derives 256-bit AES-GCM key from group.syncSecret via Web Crypto API.
 *    - Encrypts all group payloads (group metadata, members, expenses, settlements, tombstones)
 *      with random 12-byte IV before publishing to relays.
 *    - Relays only ever store and forward opaque ciphertext.
 * 
 * 3. Asynchronous Store-and-Forward + Real-Time Live Layer:
 *    - Free public Nostr relays (nos.lol, relay.primal.net, relay.damus.io, nostr.mom).
 *    - Relays store latest state snapshot as NIP-78 parameterized replaceable events (kind: 30078).
 *    - Offline members receive full history when they reopen the app.
 *    - Simultaneous members receive instant updates via active WebSocket subscriptions.
 */

// SECP256K1 CURVE PARAMETERS
const p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
const n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
const Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;

// DEFAULT NOSTR RELAYS
export const DEFAULT_RELAYS = [
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://relay.damus.io',
    'wss://nostr.mom'
];

// RELAY CONFIGURATION HELPERS
export function getConfiguredRelays() {
    try {
        const stored = localStorage.getItem('splitit_nostr_relays');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {
        console.error('Error reading configured relays:', e);
    }
    return [...DEFAULT_RELAYS];
}

export function saveConfiguredRelays(relays) {
    if (!Array.isArray(relays) || relays.length === 0) {
        localStorage.removeItem('splitit_nostr_relays');
    } else {
        localStorage.setItem('splitit_nostr_relays', JSON.stringify(relays));
    }
}

// ---------------------------------------------------------------------------
// 1. CRYPTOGRAPHIC SUITE: SECP256K1 & BIP-340 SCHNORR
// ---------------------------------------------------------------------------

function mod(a, m = p) {
    const r = a % m;
    return r >= 0n ? r : r + m;
}

function modPow(base, exp, m = p) {
    let res = 1n;
    base = mod(base, m);
    while (exp > 0n) {
        if (exp & 1n) res = mod(res * base, m);
        base = mod(base * base, m);
        exp >>= 1n;
    }
    return res;
}

function pointAdd(P, Q) {
    if (!P) return Q;
    if (!Q) return P;
    const [x1, y1] = P;
    const [x2, y2] = Q;

    if (x1 === x2) {
        if (y1 !== y2) return null;
        const lambda = mod(3n * x1 * x1 * modPow(2n * y1, p - 2n, p), p);
        const x3 = mod(lambda * lambda - 2n * x1, p);
        const y3 = mod(lambda * (x1 - x3) - y1, p);
        return [x3, y3];
    }

    const lambda = mod(mod(y2 - y1, p) * modPow(mod(x2 - x1, p), p - 2n, p), p);
    const x3 = mod(lambda * lambda - x1 - x2, p);
    const y3 = mod(lambda * (x1 - x3) - y1, p);
    return [x3, y3];
}

function pointMultiply(k, P = [Gx, Gy]) {
    let R = null;
    let current = P;
    let scalar = k;
    for (let i = 0n; i < 256n; i++) {
        if ((scalar >> i) & 1n) {
            R = pointAdd(R, current);
        }
        current = pointAdd(current, current);
    }
    return R;
}

function bytesToBigInt(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return BigInt('0x' + hex);
}

function bigIntToBytes(bi, length = 32) {
    const hex = bi.toString(16).padStart(length * 2, '0');
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

export function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
    const cleanHex = hex.trim();
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
}

async function sha256(data) {
    const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(hash);
}

async function taggedHash(tag, ...messages) {
    const tagHash = await sha256(tag);
    let totalLen = tagHash.length * 2;
    for (const m of messages) totalLen += m.length;
    const combined = new Uint8Array(totalLen);
    combined.set(tagHash, 0);
    combined.set(tagHash, tagHash.length);
    let offset = tagHash.length * 2;
    for (const m of messages) {
        combined.set(m, offset);
        offset += m.length;
    }
    return await sha256(combined);
}

export function getPublicKey(privKeyHex) {
    const d0 = BigInt('0x' + privKeyHex);
    if (d0 <= 0n || d0 >= n) throw new Error('Invalid secp256k1 private key');
    const P = pointMultiply(d0);
    return bytesToHex(bigIntToBytes(P[0], 32));
}

async function schnorrSign(msgBytes, privKeyHex, auxRandHex = '00'.repeat(32)) {
    const d0 = BigInt('0x' + privKeyHex);
    const P = pointMultiply(d0);
    const d = (P[1] % 2n === 0n) ? d0 : n - d0;
    const PxBytes = bigIntToBytes(P[0], 32);

    const dBytes = bigIntToBytes(d, 32);
    const auxBytes = hexToBytes(auxRandHex);
    const auxHash = await taggedHash('BIP0340/aux', auxBytes);
    const t = new Uint8Array(32);
    for (let i = 0; i < 32; i++) t[i] = dBytes[i] ^ auxHash[i];

    const rand = await taggedHash('BIP0340/nonce', t, PxBytes, msgBytes);
    const k0 = mod(bytesToBigInt(rand), n);
    if (k0 === 0n) throw new Error('k0 nonce generation failed');

    const R = pointMultiply(k0);
    const k = (R[1] % 2n === 0n) ? k0 : n - k0;
    const RxBytes = bigIntToBytes(R[0], 32);

    const eHash = await taggedHash('BIP0340/challenge', RxBytes, PxBytes, msgBytes);
    const e = mod(bytesToBigInt(eHash), n);

    const s = mod(k + e * d, n);
    const sBytes = bigIntToBytes(s, 32);

    const sig = new Uint8Array(64);
    sig.set(RxBytes, 0);
    sig.set(sBytes, 32);
    return bytesToHex(sig);
}

// ---------------------------------------------------------------------------
// 2. END-TO-END ENCRYPTION & KEY DERIVATION (AES-GCM 256)
// ---------------------------------------------------------------------------

export async function deriveGroupKeys(syncSecret) {
    if (!syncSecret || typeof syncSecret !== 'string') {
        throw new Error('Valid group sync secret is required');
    }
    // Deterministic Nostr private key
    const nostrPrivBytes = await sha256(`splitit:nostr:v1:${syncSecret}`);
    const nostrPrivKeyHex = bytesToHex(nostrPrivBytes);
    const nostrPubKeyHex = getPublicKey(nostrPrivKeyHex);

    // Deterministic AES-GCM 256-bit Key
    const aesKeyBytes = await sha256(`splitit:aes:v1:${syncSecret}`);
    const aesCryptoKey = await crypto.subtle.importKey(
        'raw',
        aesKeyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );

    return {
        nostrPrivKeyHex,
        nostrPubKeyHex,
        aesCryptoKey
    };
}

export async function encryptGroupPayload(payloadObj, syncSecret) {
    const { aesCryptoKey } = await deriveGroupKeys(syncSecret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const jsonString = JSON.stringify(payloadObj);
    const encoded = new TextEncoder().encode(jsonString);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesCryptoKey,
        encoded
    );
    return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}

export async function decryptGroupPayload(encryptedString, syncSecret) {
    if (!encryptedString || typeof encryptedString !== 'string') {
        throw new Error('Invalid encrypted group payload');
    }
    const parts = encryptedString.split(':');
    if (parts.length !== 2) {
        throw new Error('Malformed encrypted payload structure');
    }
    const iv = hexToBytes(parts[0]);
    const ciphertext = hexToBytes(parts[1]);
    const { aesCryptoKey } = await deriveGroupKeys(syncSecret);
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesCryptoKey,
        ciphertext
    );
    const decoded = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decoded);
}

export function generateSyncSecret() {
    const randomBytes = crypto.getRandomValues(new Uint8Array(24));
    return bytesToHex(randomBytes);
}

// ---------------------------------------------------------------------------
// 3. INVITE CODE ENGINE
// ---------------------------------------------------------------------------

export function generateInviteCode(group, syncSecret) {
    if (!group || !group.id || !syncSecret) return '';
    // Format: SPLIT-1-<groupId>-<syncSecret>
    return `SPLIT-1-${group.id}-${syncSecret}`;
}

export function parseInviteCode(inputString) {
    if (!inputString || typeof inputString !== 'string') return null;
    const clean = inputString.trim();

    // Regex to match SPLIT-1-<groupId>-<syncSecret> inside raw input or shared message
    const match = clean.match(/SPLIT-1-([a-zA-Z0-9_-]+)-([a-fA-F0-9]{32,64})/i);
    if (match) {
        return {
            groupId: match[1],
            syncSecret: match[2].toLowerCase(),
            version: 1
        };
    }

    // Fallback: check if base64url encoded JSON payload
    try {
        const decoded = atob(clean.replace(/-/g, '+').replace(/_/g, '/'));
        const parsed = JSON.parse(decoded);
        if (parsed.gid && parsed.sec) {
            return {
                groupId: parsed.gid,
                syncSecret: parsed.sec.toLowerCase(),
                groupName: parsed.name || '',
                version: parsed.v || 1
            };
        }
    } catch {
        // Not a base64url payload
    }

    return null;
}

export function getShareableInviteMessage(group, inviteCode) {
    const groupName = group?.name || 'our group';
    return `Join my shared group "${groupName}" on SplitIt! Open SplitIt, tap "Join Shared Group", and enter code:\n\n${inviteCode}\n\n(Zero-server & End-to-End Encrypted)`;
}

// ---------------------------------------------------------------------------
// 4. GROUP-SCOPED PAYLOAD BUILDER & CONFLICT-FREE STATE MERGER
// ---------------------------------------------------------------------------

export function buildGroupPayload(state, groupId, senderMemberId = null) {
    const group = (state.groups || []).find(g => g.id === groupId);
    if (!group) return null;

    // Filter members for this group
    const memberIds = new Set(group.members || []);
    const groupMembers = (state.users || []).filter(u => memberIds.has(u.id));

    // Filter transactions (expenses & settlements) for this group
    const groupTransactions = (state.transactions || []).filter(t => t.groupId === groupId);

    // Scoped tombstones for this group
    const scopedDeletedIds = {
        groups: state.deletedIds?.groups?.[groupId] ? { [groupId]: state.deletedIds.groups[groupId] } : {},
        members: {},
        expenses: {},
        settlements: {}
    };

    // Include all deleted member tombstones
    scopedDeletedIds.members = { ...(state.deletedIds?.members || {}) };

    // Include deleted expenses and settlements that belonged to this group
    Object.entries(state.deletedIds?.expenses || {}).forEach(([id, ts]) => {
        scopedDeletedIds.expenses[id] = ts;
    });
    Object.entries(state.deletedIds?.settlements || {}).forEach(([id, ts]) => {
        scopedDeletedIds.settlements[id] = ts;
    });

    return {
        version: 1,
        groupId,
        senderMemberId: senderMemberId || group.myMemberId || state.currentUserId,
        group: {
            ...group,
            isShared: true
        },
        members: groupMembers,
        transactions: groupTransactions,
        deletedIds: scopedDeletedIds,
        timestamp: new Date().toISOString()
    };
}

export function mergeGroupSyncPayload(currentState, payload, myMemberId = null) {
    if (!payload || !payload.group || !payload.groupId) return currentState;

    const groupId = payload.groupId;
    const now = new Date().toISOString();

    // 1. Merge Deleted IDs (Tombstones)
    const localDeleted = currentState.deletedIds || { groups: {}, members: {}, expenses: {}, settlements: {} };
    const remoteDeleted = payload.deletedIds || { groups: {}, members: {}, expenses: {}, settlements: {} };

    const mergedDeletedIds = {
        groups: { ...(localDeleted.groups || {}) },
        members: { ...(localDeleted.members || {}) },
        expenses: { ...(localDeleted.expenses || {}) },
        settlements: { ...(localDeleted.settlements || {}) }
    };

    ['groups', 'members', 'expenses', 'settlements'].forEach(cat => {
        const remObj = remoteDeleted[cat] || {};
        Object.entries(remObj).forEach(([id, remTs]) => {
            const locTs = mergedDeletedIds[cat][id];
            if (!locTs || new Date(remTs).getTime() > new Date(locTs).getTime()) {
                mergedDeletedIds[cat][id] = remTs;
            }
        });
    });

    // 2. Merge Group
    const localGroups = [...(currentState.groups || [])];
    const existingGroupIndex = localGroups.findIndex(g => g.id === groupId);

    const remoteGroup = payload.group;
    let mergedGroup;

    if (existingGroupIndex >= 0) {
        const localG = localGroups[existingGroupIndex];
        const localTime = new Date(localG.updatedAt || localG.createdAt || 0).getTime();
        const remoteTime = new Date(remoteGroup.updatedAt || remoteGroup.createdAt || 0).getTime();

        const baseGroup = remoteTime > localTime ? { ...localG, ...remoteGroup } : localG;
        const localMemberIds = localG.members || [];
        const remoteMemberIds = remoteGroup.members || [];
        const combinedMemberIds = new Set([...localMemberIds, ...remoteMemberIds]);
        if (myMemberId) {
            combinedMemberIds.add(myMemberId);
        }

        const filteredMembers = Array.from(combinedMemberIds).filter(mId => {
            const tomb = mergedDeletedIds.members[mId];
            if (!tomb) return true;
            if (myMemberId && mId === myMemberId) return true;
            const tombTime = new Date(tomb).getTime();
            const memberObj = (payload.members || []).find(m => m.id === mId) || (currentState.users || []).find(u => u.id === mId);
            const memberTime = memberObj ? new Date(memberObj.updatedAt || memberObj.createdAt || 0).getTime() : 0;
            return memberTime > tombTime;
        });

        const isNewMemberAdded = myMemberId && !localMemberIds.includes(myMemberId);
        const groupUpdatedAt = isNewMemberAdded ? now : new Date(Math.max(localTime, remoteTime)).toISOString();

        mergedGroup = {
            ...baseGroup,
            members: filteredMembers,
            // Preserve local myMemberId unless specifically chosen
            myMemberId: myMemberId || localG.myMemberId || baseGroup.myMemberId || null,
            syncSecret: localG.syncSecret || remoteGroup.syncSecret || payload.syncSecret || null,
            isShared: true,
            updatedAt: groupUpdatedAt
        };
        localGroups[existingGroupIndex] = mergedGroup;
    } else {
        const remoteMemberIds = remoteGroup.members || [];
        const combinedMemberIds = new Set(remoteMemberIds);
        if (myMemberId) {
            combinedMemberIds.add(myMemberId);
        }

        const filteredMembers = Array.from(combinedMemberIds).filter(mId => {
            const tomb = mergedDeletedIds.members[mId];
            if (!tomb) return true;
            if (myMemberId && mId === myMemberId) return true;
            const tombTime = new Date(tomb).getTime();
            const memberObj = (payload.members || []).find(m => m.id === mId) || (currentState.users || []).find(u => u.id === mId);
            const memberTime = memberObj ? new Date(memberObj.updatedAt || memberObj.createdAt || 0).getTime() : 0;
            return memberTime > tombTime;
        });

        mergedGroup = {
            ...remoteGroup,
            members: filteredMembers,
            myMemberId: myMemberId || remoteGroup.myMemberId || null,
            syncSecret: remoteGroup.syncSecret || payload.syncSecret || null,
            isShared: true,
            createdAt: remoteGroup.createdAt || now,
            updatedAt: remoteGroup.updatedAt || now
        };
        localGroups.push(mergedGroup);
    }

    // 3. Merge Users/Members
    const localUsers = [...(currentState.users || [])];
    const userMap = new Map(localUsers.map(u => [u.id, u]));

    (payload.members || []).forEach(remoteUser => {
        const memberTombstone = mergedDeletedIds.members[remoteUser.id];
        const remoteTime = new Date(remoteUser.updatedAt || remoteUser.createdAt || 0).getTime();
        if (memberTombstone && new Date(memberTombstone).getTime() >= remoteTime) {
            return; // Member was deleted
        }

        const existing = userMap.get(remoteUser.id);
        if (!existing) {
            userMap.set(remoteUser.id, remoteUser);
        } else {
            const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            if (remoteTime > localTime) {
                userMap.set(remoteUser.id, { ...existing, ...remoteUser });
            }
        }
    });

    // Remove users tombstoned by remote if tombstone is newer/equal to user updatedAt
    Array.from(userMap.keys()).forEach(userId => {
        if (userId === currentState.currentUserId) return;
        const tomb = mergedDeletedIds.members[userId];
        if (tomb) {
            const u = userMap.get(userId);
            const uTime = new Date(u.updatedAt || u.createdAt || 0).getTime();
            if (new Date(tomb).getTime() >= uTime) {
                userMap.delete(userId);
            }
        }
    });

    // 4. Merge Transactions (Strictly scoped to this group)
    const otherGroupTxs = (currentState.transactions || []).filter(t => t.groupId !== groupId);
    const localGroupTxs = (currentState.transactions || []).filter(t => t.groupId === groupId);

    const txMap = new Map(localGroupTxs.map(t => [t.id, t]));

    (payload.transactions || []).forEach(remoteTx => {
        const isSettlement = remoteTx.type === 'SETTLEMENT';
        const tombstone = isSettlement
            ? mergedDeletedIds.settlements[remoteTx.id]
            : mergedDeletedIds.expenses[remoteTx.id];

        const remoteTime = new Date(remoteTx.updatedAt || remoteTx.createdAt || 0).getTime();
        if (tombstone && new Date(tombstone).getTime() >= remoteTime) {
            return; // Deleted
        }

        const existing = txMap.get(remoteTx.id);
        if (!existing) {
            txMap.set(remoteTx.id, remoteTx);
        } else {
            const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            if (remoteTime > localTime) {
                txMap.set(remoteTx.id, { ...existing, ...remoteTx });
            }
        }
    });

    // Check if any localGroupTx has a tombstone from remote
    const mergedGroupTxs = Array.from(txMap.values()).filter(t => {
        const isSettlement = t.type === 'SETTLEMENT';
        const tomb = isSettlement ? mergedDeletedIds.settlements[t.id] : mergedDeletedIds.expenses[t.id];
        if (!tomb) return true;
        const txTime = new Date(t.updatedAt || t.createdAt || 0).getTime();
        return new Date(tomb).getTime() < txTime;
    });

    const finalTransactions = [...otherGroupTxs, ...mergedGroupTxs].sort((a, b) => {
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        return timeB - timeA;
    });

    return {
        ...currentState,
        groups: localGroups,
        users: Array.from(userMap.values()),
        transactions: finalTransactions,
        deletedIds: mergedDeletedIds
    };
}

// ---------------------------------------------------------------------------
// 5. NOSTR EVENT GENERATION & WEBSOCKET POOL (NIP-01 & NIP-78)
// ---------------------------------------------------------------------------

async function createSignedNostrEvent(privKeyHex, kind, tags, content) {
    const pubkey = getPublicKey(privKeyHex);
    const created_at = Math.floor(Date.now() / 1000);
    // NIP-01 Canonical JSON serialization
    const serialized = JSON.stringify([0, pubkey, created_at, kind, tags, content]);
    const hash = await sha256(serialized);
    const id = bytesToHex(hash);
    const sig = await schnorrSign(hash, privKeyHex);
    return { id, pubkey, created_at, kind, tags, content, sig };
}

// WEBSOCKET POOL & ACTIVE SUBSCRIPTIONS MANAGER
export class NostrPoolManager {
    constructor() {
        this.sockets = new Map(); // relayUrl -> WebSocket
        this.subscriptions = new Map(); // subId -> { groupId, syncSecret, onUpdate, onStatusChange }
        this.reconnectTimers = new Map();
        this.lastSeenEventIds = new Set();
    }

    getRelays() {
        return getConfiguredRelays();
    }

    connectRelay(url) {
        if (this.sockets.has(url)) {
            const existing = this.sockets.get(url);
            if (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING) {
                return existing;
            }
        }

        try {
            const ws = new WebSocket(url);
            this.sockets.set(url, ws);

            ws.onopen = () => {
                // Re-send all active subscriptions
                this.subscriptions.forEach((sub, subId) => {
                    this.sendSubscriptionToSocket(ws, subId, sub.pubkey, sub.groupId);
                });
                this.notifyAllSubStatus('live');
            };

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const msgType = data[0];

                    if (msgType === 'EVENT') {
                        const subId = data[1];
                        const nostrEvent = data[2];
                        if (subId && nostrEvent && !this.lastSeenEventIds.has(nostrEvent.id)) {
                            this.lastSeenEventIds.add(nostrEvent.id);
                            // Keep lastSeenEventIds small
                            if (this.lastSeenEventIds.size > 2000) {
                                const iter = this.lastSeenEventIds.values();
                                for (let i = 0; i < 500; i++) this.lastSeenEventIds.delete(iter.next().value);
                            }

                            const sub = this.subscriptions.get(subId);
                            if (sub && nostrEvent.content) {
                                try {
                                    const decrypted = await decryptGroupPayload(nostrEvent.content, sub.syncSecret);
                                    if (decrypted && decrypted.groupId === sub.groupId) {
                                        sub.onUpdate(decrypted);
                                    }
                                } catch (decErr) {
                                    console.warn('Failed to decrypt Nostr event payload:', decErr);
                                }
                            }
                        }
                    } else if (msgType === 'EOSE') {
                        const subId = data[1];
                        const sub = this.subscriptions.get(subId);
                        if (sub?.onStatusChange) {
                            sub.onStatusChange('synced');
                        }
                    }
                } catch (e) {
                    console.error('Error handling relay message:', e);
                }
            };

            ws.onclose = () => {
                this.sockets.delete(url);
                this.scheduleReconnect(url);
            };

            ws.onerror = (e) => {
                console.warn(`WebSocket error on relay ${url}:`, e?.message || e);
                try { ws.close(); } catch (err) { void err; }
            };

            return ws;
        } catch (err) {
            console.error(`Failed to initialize WebSocket for ${url}:`, err);
            this.scheduleReconnect(url);
            return null;
        }
    }

    scheduleReconnect(url) {
        if (this.reconnectTimers.has(url)) return;
        const timer = setTimeout(() => {
            this.reconnectTimers.delete(url);
            if (this.subscriptions.size > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
                this.connectRelay(url);
            }
        }, 5000);
        this.reconnectTimers.set(url, timer);
    }

    sendSubscriptionToSocket(ws, subId, pubkey, groupId) {
        if (ws.readyState === WebSocket.OPEN) {
            // NIP-78 parameterized replaceable application data for group
            const filter = {
                kinds: [30078],
                authors: [pubkey],
                '#d': [`splitit_${groupId}`]
            };
            ws.send(JSON.stringify(['REQ', subId, filter]));
        }
    }

    notifyAllSubStatus(status) {
        this.subscriptions.forEach(sub => {
            if (sub.onStatusChange) sub.onStatusChange(status);
        });
    }

    // Subscribe to updates for a specific group
    async subscribe(groupId, syncSecret, onUpdate, onStatusChange) {
        const { nostrPubKeyHex } = await deriveGroupKeys(syncSecret);
        const subId = `sub_${groupId}_${Math.random().toString(36).substring(2, 7)}`;

        this.subscriptions.set(subId, {
            groupId,
            syncSecret,
            pubkey: nostrPubKeyHex,
            onUpdate,
            onStatusChange
        });

        const relays = this.getRelays();
        let connectedCount = 0;

        relays.forEach(url => {
            const ws = this.connectRelay(url);
            if (ws && ws.readyState === WebSocket.OPEN) {
                this.sendSubscriptionToSocket(ws, subId, nostrPubKeyHex, groupId);
                connectedCount++;
            }
        });

        if (onStatusChange) {
            onStatusChange(connectedCount > 0 ? 'live' : 'syncing');
        }

        // Return unsubscribe function
        return () => {
            this.subscriptions.delete(subId);
            this.sockets.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    try {
                        ws.send(JSON.stringify(['CLOSE', subId]));
                    } catch (err) { void err; }
                }
            });
        };
    }

    // Publish group state snapshot to all relays
    async publish(state, groupId, customSecret = null) {
        const group = (state.groups || []).find(g => g.id === groupId);
        const secret = customSecret || group?.syncSecret;
        if (!group || !secret) {
            return { success: false, error: 'Group or sync secret not found' };
        }

        try {
            const payload = buildGroupPayload(state, groupId);
            if (!payload) return { success: false, error: 'Failed to build payload' };

            const encryptedContent = await encryptGroupPayload(payload, secret);
            const { nostrPrivKeyHex } = await deriveGroupKeys(secret);

            const event = await createSignedNostrEvent(
                nostrPrivKeyHex,
                30078, // NIP-78 parameterized replaceable
                [['d', `splitit_${groupId}`]],
                encryptedContent
            );

            // Track event ID before broadcasting to prevent processing our own echo from relays
            this.lastSeenEventIds.add(event.id);

            // Broadcast to all configured relays
            const relays = this.getRelays();
            let sentCount = 0;

            const sendPromises = relays.map(url => {
                return new Promise((resolve) => {
                    let ws = this.sockets.get(url);
                    if (!ws || ws.readyState !== WebSocket.OPEN) {
                        ws = this.connectRelay(url);
                    }

                    if (!ws) {
                        resolve(false);
                        return;
                    }

                    if (ws.readyState === WebSocket.OPEN) {
                        try {
                            ws.send(JSON.stringify(['EVENT', event]));
                            sentCount++;
                            resolve(true);
                        } catch {
                            resolve(false);
                        }
                    } else {
                        const openHandler = () => {
                            try {
                                ws.send(JSON.stringify(['EVENT', event]));
                                sentCount++;
                                resolve(true);
                            } catch {
                                resolve(false);
                            }
                        };
                        ws.addEventListener('open', openHandler, { once: true });
                        setTimeout(() => resolve(false), 4000);
                    }
                });
            });

            await Promise.race([
                Promise.all(sendPromises),
                new Promise(r => setTimeout(r, 4500))
            ]);

            return {
                success: true,
                eventId: event.id,
                sentCount,
                timestamp: new Date().toISOString()
            };
        } catch (err) {
            console.error('Failed to publish group update to relays:', err);
            return { success: false, error: err.message || 'Publish failed' };
        }
    }

    // One-shot fetch for joining or refreshing a shared group
    async fetchGroupOnce(groupId, syncSecret, timeoutMs = 6000) {
        const { nostrPubKeyHex } = await deriveGroupKeys(syncSecret);
        const relays = this.getRelays();
        const subId = `fetch_${groupId}_${Math.random().toString(36).substring(2, 8)}`;

        return new Promise((resolve) => {
            let resolved = false;
            let bestPayload = null;

            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve(bestPayload ? { success: true, payload: bestPayload } : { success: false, error: 'Group state not found on relays or relays timed out' });
                }
            }, timeoutMs);

            const activeListeners = [];

            const cleanup = () => {
                clearTimeout(timer);
                activeListeners.forEach(({ ws, handleMessage, handleOpen }) => {
                    try {
                        if (handleMessage) ws.removeEventListener('message', handleMessage);
                        if (handleOpen) ws.removeEventListener('open', handleOpen);
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify(['CLOSE', subId]));
                        }
                    } catch (err) { void err; }
                });
            };

            relays.forEach(url => {
                let ws = this.sockets.get(url);
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    ws = this.connectRelay(url);
                }
                if (!ws) return;

                let handleOpen = null;
                const handleMessage = async (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        if (data[0] === 'EVENT' && data[1] === subId && data[2]?.content) {
                            const decrypted = await decryptGroupPayload(data[2].content, syncSecret);
                            if (decrypted && decrypted.groupId === groupId) {
                                if (!bestPayload || new Date(decrypted.timestamp || 0) > new Date(bestPayload.timestamp || 0)) {
                                    bestPayload = decrypted;
                                }
                            }
                        } else if (data[0] === 'EOSE' && data[1] === subId) {
                            if (bestPayload && !resolved) {
                                resolved = true;
                                cleanup();
                                resolve({ success: true, payload: bestPayload });
                            }
                        }
                    } catch (err) { void err; }
                };

                ws.addEventListener('message', handleMessage);

                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(['REQ', subId, {
                        kinds: [30078],
                        authors: [nostrPubKeyHex],
                        '#d': [`splitit_${groupId}`]
                    }]));
                } else {
                    handleOpen = () => {
                        try {
                            ws.send(JSON.stringify(['REQ', subId, {
                                kinds: [30078],
                                authors: [nostrPubKeyHex],
                                '#d': [`splitit_${groupId}`]
                            }]));
                        } catch (err) { void err; }
                    };
                    ws.addEventListener('open', handleOpen, { once: true });
                }

                activeListeners.push({ ws, handleMessage, handleOpen });
            });
        });
    }
}

// Global Singleton Pool Instance
export const poolManager = new NostrPoolManager();

export const subscribeToGroup = (groupId, syncSecret, onUpdate, onStatusChange) => {
    return poolManager.subscribe(groupId, syncSecret, onUpdate, onStatusChange);
};

export const publishGroupUpdate = (state, groupId, customSecret = null) => {
    return poolManager.publish(state, groupId, customSecret);
};

export const fetchGroupStateOnce = (groupId, syncSecret, timeoutMs) => {
    return poolManager.fetchGroupOnce(groupId, syncSecret, timeoutMs);
};

export default {
    DEFAULT_RELAYS,
    getConfiguredRelays,
    saveConfiguredRelays,
    generateSyncSecret,
    generateInviteCode,
    parseInviteCode,
    getShareableInviteMessage,
    buildGroupPayload,
    mergeGroupSyncPayload,
    subscribeToGroup,
    publishGroupUpdate,
    fetchGroupStateOnce,
    poolManager
};
