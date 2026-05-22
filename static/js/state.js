/**
 * Global State Store for Pulse Single Page Application
 * Implements a simple publish-subscribe mechanism to notify UI of state updates.
 */

import { apiCall } from './api.js';

// Central state object
const state = {
    user: null,
    unreadNotificationsCount: 0,
    initialized: false
};

// Routing callback set by the router to avoid circular dependency
let navigateToCallback = null;

export function setNavigateToCallback(cb) {
    navigateToCallback = cb;
}

export function navigateTo(path) {
    if (navigateToCallback) {
        navigateToCallback(path);
    } else {
        window.history.pushState(null, '', path);
    }
}

// Set of callbacks listening for state transitions
const listeners = new Set();

/**
 * Register a listener callback
 */
export function addStateListener(listener) {
    listeners.add(listener);
    // Return unsubscribe function
    return () => listeners.delete(listener);
}

/**
 * Dispatch state change to all listeners
 */
function notifyListeners(changedProperty) {
    for (const listener of listeners) {
        try {
            listener(state, changedProperty);
        } catch (e) {
            console.error('Error executing state listener:', e);
        }
    }
}

/**
 * Retrieve the current state (read-only copy or raw state reference)
 */
export function getState() {
    return state;
}

/**
 * Check session and fetch current logged in user profile.
 * Runs on boot to determine auth status.
 */
export async function initializeSession() {
    try {
        // Fetch current user from /api/v1/users/me/
        // Pass false so it fails silently (we don't want a toast error if not logged in)
        const user = await apiCall('/api/v1/users/me/', 'GET', null, false);
        state.user = user;
        
        // Also fetch notifications unread count if authenticated
        await fetchUnreadNotificationsCount();
    } catch (err) {
        state.user = null;
    } finally {
        state.initialized = true;
        notifyListeners('user');
    }
}

/**
 * Set session user details (e.g., after login or registration)
 */
export function setSessionUser(user) {
    state.user = user;
    notifyListeners('user');
    if (user) {
        fetchUnreadNotificationsCount();
    }
}

/**
 * Update current user profile fields in local state
 */
export function updateSessionUser(fields) {
    if (state.user) {
        state.user = { ...state.user, ...fields };
        notifyListeners('user');
    }
}

/**
 * Clear session (e.g. after logout or account deletion)
 */
export function clearSession() {
    state.user = null;
    state.unreadNotificationsCount = 0;
    notifyListeners('user');
}

/**
 * Fetch unread notifications count from backend API
 */
export async function fetchUnreadNotificationsCount() {
    if (!state.user) return;
    try {
        const response = await apiCall('/api/v1/notifications/', 'GET', null, false);
        // Response contains unread_count as added in exceptions / views list method
        state.unreadNotificationsCount = response.unread_count || 0;
        notifyListeners('notifications');
    } catch (err) {
        console.error('Failed to fetch notifications count:', err);
    }
}

/**
 * Decrement or set unread notifications count in state
 */
export function setUnreadNotificationsCount(count) {
    state.unreadNotificationsCount = count;
    notifyListeners('notifications');
}
