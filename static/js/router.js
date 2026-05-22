/**
 * Client-side Router for Pulse SPA
 * Handles History API navigation, authenticates routes, and manages the global page layouts.
 */

import { getState, initializeSession, addStateListener, setNavigateToCallback } from './state.js';
import { showToast } from './components/Toast.js';
import { apiCall } from './api.js';

// Define pages (will import lazily or dynamically to avoid circular dependencies)
let AuthPage, FeedPage, ProfilePage, ExplorePage;

// Helper to load pages
async function loadPages() {
    AuthPage = (await import('./pages/Auth.js')).AuthPage;
    FeedPage = (await import('./pages/Feed.js')).FeedPage;
    ProfilePage = (await import('./pages/Profile.js')).ProfilePage;
    ExplorePage = (await import('./pages/Explore.js')).ExplorePage;
}

// Global reference for active page state
let activePage = null;

// Route configuration
const ROUTES = {
    auth: '/auth',
    feed: '/',
    explore: '/explore',
    tag: '/explore/tags/',
    profile: '/@'
};

/**
 * Direct navigation trigger
 */
export function navigateTo(path) {
    window.history.pushState(null, '', path);
    handleRoute();
}

setNavigateToCallback(navigateTo);

/**
 * Check auth status and return matching page view
 */
async function getMatchingView() {
    const path = window.location.pathname;
    const state = getState();

    // Check authentication
    const isAuthenticated = !!state.user;

    // Route guards
    if (path === ROUTES.auth) {
        if (isAuthenticated) {
            // Already logged in, redirect to feed
            window.history.replaceState(null, '', ROUTES.feed);
            return { page: FeedPage, params: {} };
        }
        return { page: AuthPage, params: {} };
    }

    // Explore page (accessible publicly)
    if (path === ROUTES.explore) {
        return { page: ExplorePage, params: {} };
    }

    if (path.startsWith(ROUTES.tag)) {
        const tag = path.substring(ROUTES.tag.length);
        return { page: ExplorePage, params: { tag } };
    }

    // Profile page (starting with /@username, accessible publicly but has private checks inside)
    if (path.startsWith('/@')) {
        const username = path.substring(2);
        return { page: ProfilePage, params: { username } };
    }

    // Feed / Default fallback
    if (path === ROUTES.feed) {
        if (!isAuthenticated) {
            // Unauthenticated user redirected to auth
            window.history.replaceState(null, '', ROUTES.auth);
            return { page: AuthPage, params: {} };
        }
        return { page: FeedPage, params: {} };
    }

    // 404 - Redirect to feed or explore
    window.history.replaceState(null, '', isAuthenticated ? ROUTES.feed : ROUTES.explore);
    return isAuthenticated ? { page: FeedPage, params: {} } : { page: ExplorePage, params: {} };
}

/**
 * Main Router resolution function
 */
export async function handleRoute() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    // Show a sleek loading state if session not initialized yet
    const state = getState();
    if (!state.initialized) {
        appEl.innerHTML = `
            <div class="auth-wrapper">
                <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-4);">
                    <div class="auth-logo" style="font-size: var(--text-xl); font-weight: 800; animation: pulse 1.5s infinite ease-in-out;">⚡ PULSE</div>
                    <div style="color: var(--color-text-muted); font-size: var(--text-sm);">Booting system...</div>
                </div>
            </div>
        `;
        return;
    }

    // Ensure page classes/modules are imported
    if (!AuthPage) {
        await loadPages();
    }

    // Resolve matching page
    const { page, params } = await getMatchingView();
    activePage = page;

    // Render global navigation layout shell if NOT on Auth page
    const isAuthenticated = !!state.user;
    if (page !== AuthPage) {
        appEl.innerHTML = renderAppShell(isAuthenticated);
        
        // Wire up navbar listeners
        initNavbarListeners(isAuthenticated);
        
        // Mount page inside the shell content area
        const pageMount = document.getElementById('page-mount');
        if (pageMount) {
            pageMount.innerHTML = await page.render(params);
            if (page.init) {
                await page.init(params);
            }
        }
    } else {
        // Direct full screen render for auth page
        appEl.innerHTML = await page.render(params);
        if (page.init) {
            await page.init(params);
        }
    }
}

/**
 * Returns HTML for the standard layout shell with Navbar
 */
function renderAppShell(isAuthenticated) {
    const state = getState();
    const avatarUrl = state.user && state.user.profile_photo 
        ? state.user.profile_photo 
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'; // Fallback Unsplash avatar
        
    const badgeHtml = state.unreadNotificationsCount > 0 
        ? `<span class="nav-badge" id="nav-unread-count">${state.unreadNotificationsCount}</span>` 
        : '';

    // Conditionally render authenticated vs public menus
    let navbarMenuHtml = '';
    if (isAuthenticated) {
        navbarMenuHtml = `
            <button class="btn btn-primary btn-sm" id="btn-create-post-nav">
                <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: var(--space-1);"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path></svg>
                Post
            </button>
            <a href="/" class="btn btn-icon" title="Home Feed">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"></path></svg>
            </a>
            <a href="/explore" class="btn btn-icon" title="Explore">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path></svg>
            </a>
            <div class="nav-item-notifications">
                <button class="btn btn-icon" id="btn-notifications-nav" title="Notifications">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"></path></svg>
                    ${badgeHtml}
                </button>
                <div class="card dropdown-menu" id="notifications-dropdown" style="display: none;">
                    <div style="padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; font-family: var(--font-heading); font-size: var(--text-sm);">Notifications</span>
                        <button class="btn btn-text" id="btn-mark-all-read" style="font-size: var(--text-xs); color: var(--color-brand-primary);">Mark read</button>
                    </div>
                    <div class="notifications-dropdown-list" id="notifications-dropdown-list">
                        <!-- Notifications rendered here -->
                        <div style="padding: var(--space-6); text-align: center; color: var(--color-text-muted); font-size: var(--text-xs);">Loading...</div>
                    </div>
                </div>
            </div>
            <a href="/@${state.user.username}" class="avatar-link" title="My Profile">
                <img src="${avatarUrl}" alt="${state.user.display_name}" class="avatar avatar-sm">
            </a>
            <button class="btn btn-icon btn-text" id="btn-logout-nav" title="Log Out">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 20px; height: 20px; color: var(--color-text-muted);"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"></path></svg>
            </button>
        `;
    } else {
        navbarMenuHtml = `
            <a href="/explore" class="btn btn-icon" title="Explore">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path></svg>
            </a>
            <a href="/auth" class="btn btn-primary btn-sm">Sign In</a>
        `;
    }

    return `
        <!-- Navbar -->
        <nav class="navbar">
            <div class="navbar-container">
                <a href="/" class="navbar-logo" style="text-decoration: none;">⚡ PULSE</a>
                <div class="navbar-search">
                    <span class="navbar-search-icon">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </span>
                    <input type="text" id="navbar-search-input" placeholder="Search people or #hashtags...">
                </div>
                <div class="navbar-menu">
                    ${navbarMenuHtml}
                </div>
            </div>
        </nav>

        <!-- Dynamic Main Page Container -->
        <div id="page-mount"></div>
    `;
}

/**
 * Initialize navbar triggers and search
 */
function initNavbarListeners(isAuthenticated) {
    // Intercept search bar keypress
    const searchInput = document.getElementById('navbar-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    navigateTo(`/explore?q=${encodeURIComponent(query)}`);
                }
            }
        });
    }

    if (!isAuthenticated) return;

    // Logout trigger
    const logoutBtn = document.getElementById('btn-logout-nav');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await apiCall('/api/v1/auth/logout/', 'POST');
                // Perform clear session inside state
                const { clearSession } = await import('./state.js');
                clearSession();
                navigateTo('/auth');
                showToast('Logged out successfully.', 'success');
            } catch (err) {
                console.error(err);
            }
        });
    }

    // Create post button modal popup
    const createPostBtn = document.getElementById('btn-create-post-nav');
    if (createPostBtn) {
        createPostBtn.addEventListener('click', () => {
            // Open post creation modal
            openPostCreateModal();
        });
    }

    // Notifications Dropdown toggle
    const notifBtn = document.getElementById('btn-notifications-nav');
    const notifDropdown = document.getElementById('notifications-dropdown');
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const visible = notifDropdown.style.display === 'block';
            notifDropdown.style.display = visible ? 'none' : 'block';
            if (!visible) {
                loadNotificationsInDropdown();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
                notifDropdown.style.display = 'none';
            }
        });
    }

    // Mark all read button
    const markAllReadBtn = document.getElementById('btn-mark-all-read');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            try {
                await apiCall('/api/v1/notifications/read/', 'POST');
                const { setUnreadNotificationsCount } = await import('./state.js');
                setUnreadNotificationsCount(0);
                loadNotificationsInDropdown();
                showToast('All notifications marked as read.', 'success');
            } catch (e) {
                console.error(e);
            }
        });
    }
}

/**
 * Fetch and populate notifications dropdown
 */
async function loadNotificationsInDropdown() {
    const listEl = document.getElementById('notifications-dropdown-list');
    if (!listEl) return;
    
    try {
        const response = await apiCall('/api/v1/notifications/', 'GET', null, false);
        const notifications = response.results || [];
        
        if (notifications.length === 0) {
            listEl.innerHTML = `<div style="padding: var(--space-6); text-align: center; color: var(--color-text-muted); font-size: var(--text-xs);">You're all caught up!</div>`;
            return;
        }

        const itemsHtml = notifications.map(notif => {
            const actorAvatar = notif.actor.profile_photo 
                ? notif.actor.profile_photo 
                : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';
            
            let actionText = '';
            if (notif.type === 'LIKE_POST') actionText = 'liked your post';
            else if (notif.type === 'COMMENT') actionText = 'commented on your post';
            else if (notif.type === 'FOLLOW') actionText = 'started following you';
            else if (notif.type === 'FOLLOW_REQUEST') actionText = 'sent you a follow request';
            else if (notif.type === 'FOLLOW_ACCEPT') actionText = 'accepted your follow request';
            else if (notif.type === 'COMMENT_LIKE') actionText = 'liked your comment';
            
            const isUnread = !notif.is_read;
            const itemStyle = isUnread ? 'background-color: rgba(99, 102, 241, 0.04);' : '';
            const unreadDot = isUnread ? '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--color-brand-primary); margin-left: auto;"></span>' : '';
            
            return `
                <div class="dropdown-notif-item" style="padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); display: flex; align-items: center; gap: var(--space-3); cursor: pointer; ${itemStyle}" data-id="${notif.id}" data-type="${notif.type}" data-post-id="${notif.post ? notif.post.id : ''}">
                    <img src="${actorAvatar}" class="avatar avatar-sm">
                    <div style="font-size: var(--text-xs); line-height: 1.4;">
                        <span style="font-weight: 700; color: var(--color-text-primary);">${escapeHtml(notif.actor.username)}</span>
                        <span style="color: var(--color-text-secondary);">${actionText}</span>
                        <div style="font-size: 10px; color: var(--color-text-muted); margin-top: 2px;">${formatTimestamp(notif.created_at)}</div>
                    </div>
                    ${unreadDot}
                </div>
            `;
        }).join('');
        
        listEl.innerHTML = itemsHtml;
        
        // Add click actions to notifications
        listEl.querySelectorAll('.dropdown-notif-item').forEach(el => {
            el.addEventListener('click', async () => {
                const id = el.dataset.id;
                const type = el.dataset.type;
                const postId = el.dataset.postId;
                
                // Mark single read
                try {
                    await apiCall(`/api/v1/notifications/${id}/read/`, 'PATCH');
                    // Refresh unread counts
                    const { fetchUnreadNotificationsCount } = await import('./state.js');
                    await fetchUnreadNotificationsCount();
                } catch (e) {
                    console.error(e);
                }
                
                // Close dropdown
                document.getElementById('notifications-dropdown').style.display = 'none';
                
                // Redirect/Action based on notification type
                if (type === 'FOLLOW' || type === 'FOLLOW_REQUEST' || type === 'FOLLOW_ACCEPT') {
                    navigateTo(`/@${el.querySelector('span').innerText}`);
                } else if (postId) {
                    // Open post modal directly
                    const { openPostDetailModal } = await import('./components/PostModal.js');
                    openPostDetailModal(postId);
                }
            });
        });
        
    } catch (err) {
        listEl.innerHTML = `<div style="padding: var(--space-6); text-align: center; color: var(--color-text-error); font-size: var(--text-xs);">Failed to load notifications.</div>`;
    }
}

/**
 * Open Visual Post Creator Modal dynamically
 */
async function openPostCreateModal() {
    const { PostModal } = await import('./components/PostModal.js');
    PostModal.showCreate();
}

/**
 * Helper to escape html strings
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Pretty formatting for timestamp
 */
export function formatTimestamp(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Global listen to state updates for badge counts
addStateListener((state, changedProperty) => {
    if (changedProperty === 'notifications') {
        const badgeContainer = document.getElementById('btn-notifications-nav');
        if (badgeContainer) {
            // Remove existing badge
            const oldBadge = document.getElementById('nav-unread-count');
            if (oldBadge) oldBadge.remove();
            
            if (state.unreadNotificationsCount > 0) {
                const badge = document.createElement('span');
                badge.className = 'nav-badge';
                badge.id = 'nav-unread-count';
                badge.innerText = state.unreadNotificationsCount;
                badgeContainer.appendChild(badge);
            }
        }
    }
});

// Capture links clicks globally for client SPA routing
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && link.origin === window.location.origin) {
        const path = link.pathname + link.search + link.hash;
        // Do not intercept backend static assets, media files, or administrative paths
        if (!path.startsWith('/api/') && !path.startsWith('/media/') && !path.startsWith('/admin/') && !link.hasAttribute('download')) {
            e.preventDefault();
            navigateTo(path);
        }
    }
});

// Respond to back/forward navigation
window.addEventListener('popstate', handleRoute);

// Bootstrap API and State
(async function init() {
    await initializeSession();
    // Schedule real-time notification checking every 30 seconds
    setInterval(async () => {
        const state = getState();
        if (state.user) {
            const { fetchUnreadNotificationsCount } = await import('./state.js');
            await fetchUnreadNotificationsCount();
        }
    }, 30000);
    
    // Resolve initial route
    await handleRoute();
})();
