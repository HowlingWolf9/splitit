import { Capacitor } from '@capacitor/core';

/**
 * Checks if the current execution environment is running inside native Android WebView.
 * Checks for window.AndroidPrint bridge or Capacitor native Android platform.
 */
export const isNativeAndroid = () => {
    try {
        if (typeof window !== 'undefined' && window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
            return true;
        }
        return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    } catch {
        return false;
    }
};

/**
 * Generates a clean, filesystem-safe document title for print and PDF export.
 * E.g., "SplitIt_Statement_GoaTrip_2026-10-14"
 *
 * @param {string} [customName] - Optional context name (group name, reference, etc.)
 * @returns {string} - Clean sanitized title
 */
export const formatPrintDocumentTitle = (customName = '') => {
    const today = new Date().toISOString().slice(0, 10);
    const sanitizedName = (customName || '')
        .trim()
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .replace(/\s+/g, '_');

    if (sanitizedName) {
        // Avoid duplicating "SplitIt" if already present
        if (sanitizedName.toLowerCase().startsWith('splitit')) {
            return `${sanitizedName}_${today}`;
        }
        return `SplitIt_${sanitizedName}_${today}`;
    }
    return `SplitIt_Statement_${today}`;
};

/**
 * Unified printing & PDF export handler for Android native app, Web, and Desktop.
 *
 * - On Native Android: Invokes Android's native android.print.PrintManager via our
 *   WebView JavascriptInterface bridge (or local Capacitor plugin). This summons
 *   Android's native print spooler with "Save as PDF" and physical printers.
 * - On Web / Desktop Browsers: Temporarily switches document.title to dynamic documentTitle
 *   so the browser's "Save as PDF" dialog suggests the exact filename, triggers window.print(),
 *   and restores document.title safely upon completion.
 *
 * @param {string} [documentTitle] - Optional title for the print job and PDF filename.
 * @returns {Promise<boolean>} - Resolves to true when the print dialog is successfully initiated.
 */
export const triggerPrint = async (documentTitle) => {
    const title = formatPrintDocumentTitle(documentTitle);

    // 1. Native Android JavascriptInterface Bridge (Fastest, zero-latency direct bridge)
    if (typeof window !== 'undefined' && window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
        try {
            window.AndroidPrint.print(title);
            return true;
        } catch (err) {
            console.error('[SplitIt Print] window.AndroidPrint call failed, trying fallbacks:', err);
        }
    }

    // 2. Local Capacitor AndroidPrintPlugin fallback
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        try {
            const { AndroidPrintPlugin } = Capacitor.Plugins || {};
            if (AndroidPrintPlugin && typeof AndroidPrintPlugin.print === 'function') {
                await AndroidPrintPlugin.print({ name: title });
                return true;
            }
        } catch (err) {
            console.warn('[SplitIt Print] Capacitor AndroidPrintPlugin failed:', err);
        }
    }

    // 3. Web & Desktop Browser standard window.print()
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
        const originalTitle = document.title;
        try {
            document.title = title;
        } catch {
            // Title mutation not permitted in restricted contexts
        }

        const restoreTitle = () => {
            try {
                document.title = originalTitle;
            } catch {
                // Ignore
            }
            window.removeEventListener('afterprint', restoreTitle);
        };

        window.addEventListener('afterprint', restoreTitle);

        // Small delay to ensure title mutation is recognized by browser print spoolers
        setTimeout(() => {
            window.print();
            // Fallback restoration in case afterprint event doesn't fire
            setTimeout(restoreTitle, 2000);
        }, 60);

        return true;
    }

    console.warn('[SplitIt Print] Printing is not supported on this platform.');
    return false;
};

export default triggerPrint;
