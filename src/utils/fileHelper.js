/**
 * fileHelper.js
 * Cross-platform JSON backup export and import bridge supporting:
 * - Native Android WebView (via MainActivity @JavascriptInterface exportJson + MediaStore/Share Sheet)
 * - PC Desktop Tauri (via native Save/Open file dialogs & filesystem bridge)
 * - Legacy PC Desktop Electron (via splitit:save-file and splitit:open-file native dialogs)
 * - Standard Web Browsers (via Blob download + file input fallback)
 */

/**
 * Checks if running inside the Tauri desktop application
 */
export function isTauri() {
    return typeof window !== 'undefined' && Boolean(
        window.__TAURI_INTERNALS__ || window.__TAURI__
    );
}

/**
 * Checks if running inside the Electron desktop application
 */
export function isElectron() {
    return typeof window !== 'undefined' && Boolean(
        window.electronAPI?.saveFile || window.electronFile?.saveFile
    );
}

/**
 * Checks if running inside either desktop environment (Tauri or Electron)
 */
export function isDesktopApp() {
    return isTauri() || isElectron();
}

/**
 * Checks if running inside the Capacitor Android native wrapper with AndroidBridge
 */
export function isAndroidNative() {
    return typeof window !== 'undefined' && Boolean(
        window.AndroidBridge?.exportJson || window.AndroidPrint?.exportJson
    );
}

/**
 * Generates standard backup filename with current date (YYYY-MM-DD)
 */
export function getDefaultBackupFilename() {
    const dateStr = new Date().toISOString().split('T')[0];
    return `splitit-backup-${dateStr}.json`;
}

/**
 * Exports data as a JSON file across Android, Tauri, Electron, and Web
 * @param {Object|string} data - JSON string or JavaScript object to export
 * @param {string} [filename] - Optional filename
 * @returns {Promise<{success: boolean, canceled?: boolean, method: string, filePath?: string}>}
 */
export async function exportBackupJson(data, filename) {
    const finalFilename = filename || getDefaultBackupFilename();
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    // 1. Tauri Desktop Native Save Dialog
    if (isTauri()) {
        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const filePath = await save({
                defaultPath: finalFilename,
                filters: [
                    { name: 'JSON Backup (*.json)', extensions: ['json'] },
                    { name: 'All Files (*.*)', extensions: ['*'] }
                ]
            });

            if (!filePath) {
                return { success: false, canceled: true, method: 'tauri' };
            }

            try {
                const { writeTextFile } = await import('@tauri-apps/plugin-fs');
                await writeTextFile(filePath, jsonString);
            } catch {
                // Fallback to Rust command if plugin-fs scope is restrictive
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('save_backup_file', { path: filePath, content: jsonString });
            }

            return { success: true, method: 'tauri', filePath };
        } catch (err) {
            console.error('[SplitIt Tauri Save] Error:', err);
            throw new Error(err.message || 'Failed to save backup in Tauri');
        }
    }

    // 2. Electron Desktop Native Save Dialog (legacy compatibility)
    if (isElectron()) {
        const saveFn = window.electronAPI?.saveFile || window.electronFile?.saveFile;
        const result = await saveFn(jsonString, finalFilename);
        if (result?.canceled) {
            return { success: false, canceled: true, method: 'electron' };
        }
        if (result?.success) {
            return { success: true, method: 'electron', filePath: result.filePath };
        }
        throw new Error(result?.error || 'Failed to save backup in Electron');
    }

    // 3. Android Native Bridge (MediaStore Downloads + Share Sheet)
    if (isAndroidNative()) {
        const bridge = window.AndroidBridge?.exportJson ? window.AndroidBridge : window.AndroidPrint;
        bridge.exportJson(jsonString, finalFilename);
        return { success: true, method: 'android' };
    }

    // 4. Web Browser Fallback (Blob URL + <a> download click)
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 300);

    return { success: true, method: 'web' };
}

/**
 * Reads and validates a JSON string from a File object
 * @param {File} file
 * @returns {Promise<string>} Raw text of the file
 */
export async function readJsonFile(file) {
    if (!file) throw new Error('No file selected');
    let rawText = '';
    if (file.text) {
        rawText = await file.text();
    } else {
        // Fallback for older browsers
        rawText = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    return typeof rawText === 'string' ? rawText.replace(/^\uFEFF/, '').trim() : rawText;
}

/**
 * Attempts native desktop open dialog (Tauri or Electron) or triggers fallback
 * @returns {Promise<{success: boolean, canceled?: boolean, content?: string, filePath?: string}>}
 */
export async function openDesktopBackupFile() {
    // 1. Tauri Desktop Native Open Dialog
    if (isTauri()) {
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({
                title: 'Import SplitIt Backup',
                multiple: false,
                directory: false,
                filters: [
                    { name: 'JSON Backup (*.json)', extensions: ['json'] },
                    { name: 'Text / JSON Files', extensions: ['json', 'txt'] },
                    { name: 'All Files (*.*)', extensions: ['*'] }
                ]
            });

            if (!selected) {
                return { success: false, canceled: true, method: 'tauri' };
            }

            const filePath = typeof selected === 'string' ? selected : selected.path;
            let content = null;
            try {
                const { readTextFile } = await import('@tauri-apps/plugin-fs');
                content = await readTextFile(filePath);
            } catch {
                // Fallback to Rust command if plugin-fs scope is restrictive
                const { invoke } = await import('@tauri-apps/api/core');
                content = await invoke('read_backup_file', { path: filePath });
            }

            if (content && typeof content === 'string') {
                content = content.replace(/^\uFEFF/, '').trim();
            }

            return { success: true, method: 'tauri', filePath, content };
        } catch (err) {
            console.error('[SplitIt Tauri Open] Error:', err);
            return { success: false, error: err.message || 'Failed to open backup in Tauri' };
        }
    }

    // 2. Electron Desktop Native Open Dialog
    if (isElectron()) {
        const openFn = window.electronAPI?.openFile || window.electronFile?.openFile;
        return await openFn();
    }

    return { success: false, notSupported: true };
}

// Alias for backwards compatibility
export const openElectronBackupFile = openDesktopBackupFile;
