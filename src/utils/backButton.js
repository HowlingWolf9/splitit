import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Stack of active modal / bottom-sheet close callbacks (LIFO)
const modalStack = [];

function updateBodyScrollLock() {
    if (typeof document === 'undefined') return;
    if (modalStack.length > 0) {
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
    } else {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
    }
}

export function registerBackAction(closeFn) {
    if (typeof closeFn !== 'function') return () => {};
    modalStack.push(closeFn);
    updateBodyScrollLock();
    return () => {
        const index = modalStack.lastIndexOf(closeFn);
        if (index !== -1) {
            modalStack.splice(index, 1);
            updateBodyScrollLock();
        }
    };
}

export function popBackAction() {
    if (modalStack.length > 0) {
        const closeTop = modalStack.pop();
        updateBodyScrollLock();
        if (typeof closeTop === 'function') {
            closeTop();
            return true;
        }
    }
    return false;
}

export function hasOpenModals() {
    return modalStack.length > 0;
}

/**
 * Custom hook for components/modals to register themselves on the back-action stack.
 * When Android hardware back is pressed, the most recently opened modal closes first.
 */
export function useModalBackHandler(isOpen, onClose) {
    useEffect(() => {
        if (!isOpen || typeof onClose !== 'function') return;
        const unregister = registerBackAction(onClose);
        return unregister;
    }, [isOpen, onClose]);
}

/**
 * Sync CSS variable --visual-viewport-height with Android soft keyboard appearance
 * so bottom sheets dynamically stay above the virtual keyboard.
 */
export function initVisualViewport() {
    if (typeof window === 'undefined') return () => {};

    const updateHeight = () => {
        const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`);
    };

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateHeight);
        window.visualViewport.addEventListener('scroll', updateHeight);
    } else {
        window.addEventListener('resize', updateHeight);
    }

    updateHeight();

    return () => {
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', updateHeight);
            window.visualViewport.removeEventListener('scroll', updateHeight);
        } else {
            window.removeEventListener('resize', updateHeight);
        }
    };
}
