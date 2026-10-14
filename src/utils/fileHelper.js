/**
 * fileHelper.js
 * Cross-platform JSON backup export and import bridge supporting:
 * - Native Android WebView (via MainActivity @JavascriptInterface exportJson + MediaStore/Share Sheet)
 * - PC Desktop Electron (via splitit:save-file and splitit:open-file native dialogs)
 * - Standard Web Browsers (via Blob download + file input fallback)
 */

/**
 * Checks if running inside the Electron desktop application
 */
export function isElectron() {
    return typeof window !== 'undefined' && Boolean(
        window.electronAPI?.saveFile || window.electronFile?.saveFile
    );
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
 * Exports data as a JSON file across Android, Electron, and Web
 * @param {Object|string} data - JSON string or JavaScript object to export
 * @param {string} [filename] - Optional filename
 * @returns {Promise<{success: boolean, canceled?: boolean, method: string, filePath?: string}>}
 */
export async function exportBackupJson(data, filename) {
    const finalFilename = filename || getDefaultBackupFilename();
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    // 1. Electron Desktop Native Save Dialog
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

    // 2. Android Native Bridge (MediaStore Downloads + Share Sheet)
    if (isAndroidNative()) {
        const bridge = window.AndroidBridge?.exportJson ? window.AndroidBridge : window.AndroidPrint;
        bridge.exportJson(jsonString, finalFilename);
        return { success: true, method: 'android' };
    }

    // 3. Web Browser Fallback (Blob URL + <a> download click)
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
    if (file.text) {
        return await file.text();
    }
    // Fallback for older browsers
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Attempts native Electron open dialog or triggers fallback
 * @returns {Promise<{success: boolean, canceled?: boolean, content?: string, filePath?: string}>}
 */
export async function openElectronBackupFile() {
    if (isElectron()) {
        const openFn = window.electronAPI?.openFile || window.electronFile?.openFile;
        return await openFn();
    }
    return { success: false, notSupported: true };
}
