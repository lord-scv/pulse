/**
 * Feed Page Module
 * Displays chronological feed posts, visual post creation triggers, verification warning banners, and suggested users sidebar.
 */

import { apiCall } from '../api.js';
import { getState, navigateTo } from '../state.js';
import { renderPostCard, initPostCardListeners } from '../components/PostCard.js';
import { showToast } from '../components/Toast.js';

// Local page variables
let nextCursorUrl = null;
let isLoadingMore = false;
let feedPosts = [];

export const FeedPage = {
    async render() {
        const state = getState();
        const user = state.user;
        const avatarUrl = user && user.profile_photo 
            ? user.profile_photo 
            : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';

        // Sticky warning banner if email is unverified
        const emailWarningBanner = (user && !user.is_verified_email)
            ? `
            <div class="banner" id="email-verification-banner">
                <div class="banner-content">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 18px; height: 18px; color: var(--color-warning);"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <span>Please verify your email address to unlock posting and commenting. Check your terminal output!</span>
                    <button class="btn btn-text banner-link" id="btn-resend-verification" style="padding: 0; font-size: var(--text-sm);">Resend Link</button>
                </div>
                <div class="banner-close" id="btn-close-verification-banner">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </div>
            </div>
            `
            : '';

        // Render visual creator block if email is verified
        const creatorBlock = (user && user.is_verified_email)
            ? `
            <div class="card" style="padding: var(--space-4); display: flex; gap: var(--space-3); align-items: center; cursor: pointer;" id="trigger-create-post-card">
                <img src="${avatarUrl}" class="avatar avatar-md">
                <div style="flex: 1; background-color: rgba(255,255,255,0.03); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-2) var(--space-4); color: var(--color-text-muted); font-size: var(--text-sm);">
                    What's on your mind, ${escapeHtml(user.display_name)}?
                </div>
            </div>
            `
            : '';

        return `
            ${emailWarningBanner}
            
            <div class="layout-container">
                <!-- Main Feed -->
                <main class="main-content">
                    ${creatorBlock}
                    <div id="feed-posts-container">
                        <div style="padding: var(--space-12); text-align: center; color: var(--color-text-muted);">Assembling your feed...</div>
                    </div>
                    <div id="feed-loading-indicator" style="display: none; text-align: center; padding: var(--space-6); color: var(--color-text-muted); font-size: var(--text-sm);">
                        Loading more posts...
                    </div>
                </main>

                <!-- Sidebar (Suggested accounts) -->
                <aside class="sidebar">
                    <div class="suggested-section">
                        <div class="suggested-header">
                            <span class="suggested-title">Who to Follow</span>
                        </div>
                        <div class="suggested-list" id="sidebar-suggested-users-list">
                            <div style="padding: var(--space-3) 0; color: var(--color-text-muted); font-size: var(--text-xs);">Loading suggestions...</div>
                        </div>
                    </div>
                    
                    <footer style="padding: 0 var(--space-4); font-size: 11px; color: var(--color-text-muted); line-height: 1.6;">
                        <div style="display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-2);">
                            <a href="/explore" style="color: inherit; text-decoration: none;">About</a> • 
                            <a href="/explore" style="color: inherit; text-decoration: none;">Privacy</a> • 
                            <a href="/explore" style="color: inherit; text-decoration: none;">Terms</a> • 
                            <a href="/explore" style="color: inherit; text-decoration: none;">Help</a>
                        </div>
                        © 2026 Pulse Platform. All rights reserved.
                    </footer>
                </aside>
            </div>
        `;
    },

    async init() {
        // Wire email verification resends
        const resendBtn = document.getElementById('btn-resend-verification');
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                resendBtn.innerText = 'Sending...';
                resendBtn.disabled = true;
                try {
                    // Triggering a profile save updates and prints a new email link in development logs
                    await apiCall('/api/v1/users/me/', 'PATCH', { username: getState().user.username });
                    showToast('Verification link reprinted to logs console!', 'success');
                } catch (e) {
                    console.error(e);
                } finally {
                    resendBtn.innerText = 'Resend Link';
                    resendBtn.disabled = false;
                }
            });
        }

        const closeBannerBtn = document.getElementById('btn-close-verification-banner');
        if (closeBannerBtn) {
            closeBannerBtn.addEventListener('click', () => {
                document.getElementById('email-verification-banner').remove();
            });
        }

        // Wire post creator trigger card
        const triggerCreator = document.getElementById('trigger-create-post-card');
        if (triggerCreator) {
            triggerCreator.addEventListener('click', () => {
                const createPostBtn = document.getElementById('btn-create-post-nav');
                if (createPostBtn) createPostBtn.click();
            });
        }

        // Fetch feed posts and suggestions
        await Promise.all([
            fetchFeedPosts(),
            fetchSuggestedUsers()
        ]);

        // Setup Infinite scroll
        setupInfiniteScroll();
    }
};

/**
 * Fetch and render feed posts from API
 */
async function fetchFeedPosts() {
    const container = document.getElementById('feed-posts-container');
    if (!container) return;

    try {
        const response = await apiCall('/api/v1/feed/', 'GET', null, false);
        feedPosts = response.results || [];
        nextCursorUrl = response.next;

        if (feedPosts.length === 0) {
            container.innerHTML = `
                <div class="feed-message-card">
                    <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="feed-message-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"></path></svg>
                    <h3 class="feed-message-title">Your Feed is Empty</h3>
                    <p class="feed-message-text">It looks like the people you follow haven't posted yet, or you haven't followed anyone. Head over to <a href="/explore" class="feed-message-link">Explore</a> to find trending posts and interesting creators to follow!</p>
                </div>
            `;
            return;
        }

        // Render posts
        container.innerHTML = feedPosts.map(post => renderPostCard(post)).join('');

        // Initialize listeners
        container.querySelectorAll('.post-card-element').forEach(cardEl => {
            const postId = cardEl.dataset.postId;
            const postObj = feedPosts.find(p => p.id === postId);
            if (postObj) {
                initPostCardListeners(cardEl, postObj, handleFeedUpdate);
            }
        });

    } catch (err) {
        container.innerHTML = `
            <div class="feed-message-card" style="border-color: var(--color-error); background-color: rgba(239, 68, 68, 0.02);">
                <h3 class="feed-message-title" style="color: var(--color-error);">Unable to Load Feed</h3>
                <p class="feed-message-text">There was a problem retrieving posts from the server. Please try again later.</p>
            </div>
        `;
        console.error(err);
    }
}

/**
 * Infinite Scroll logic to fetch next cursor batch
 */
function setupInfiniteScroll() {
    window.addEventListener('scroll', async () => {
        // Only run if on feed page
        if (window.location.pathname !== '/' || !nextCursorUrl || isLoadingMore) return;

        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        // Trigger when within 300px from the bottom
        if (scrollHeight - scrollTop - clientHeight < 300) {
            isLoadingMore = true;
            const loadingIndicator = document.getElementById('feed-loading-indicator');
            if (loadingIndicator) loadingIndicator.style.display = 'block';

            try {
                const response = await apiCall(nextCursorUrl, 'GET', null, false);
                const newPosts = response.results || [];
                nextCursorUrl = response.next;
                
                const container = document.getElementById('feed-posts-container');
                if (container && newPosts.length > 0) {
                    // Append new HTML
                    const html = newPosts.map(post => renderPostCard(post)).join('');
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    
                    // Add items to local array and attach listeners
                    const children = Array.from(tempDiv.children);
                    children.forEach((childEl, index) => {
                        const postObj = newPosts[index];
                        feedPosts.push(postObj);
                        container.appendChild(childEl);
                        initPostCardListeners(childEl, postObj, handleFeedUpdate);
                    });
                }
            } catch (err) {
                console.error('Failed to load more posts', err);
            } finally {
                isLoadingMore = false;
                if (loadingIndicator) loadingIndicator.style.display = 'none';
            }
        }
    });
}

/**
 * Handle callbacks when posts update, like deleting or liking
 */
function handleFeedUpdate(action, data) {
    if (action === 'delete') {
        const postId = data;
        feedPosts = feedPosts.filter(p => p.id !== postId);
        const card = document.querySelector(`.post-card-element[data-post-id="${postId}"]`);
        if (card) {
            card.style.transform = 'scale(0.95)';
            card.style.opacity = '0';
            setTimeout(() => {
                card.remove();
                if (feedPosts.length === 0) {
                    fetchFeedPosts();
                }
            }, 250);
        }
    } else if (action === 'edit' || action === 'like' || action === 'comment') {
        // Sync local post list cache
        const postIndex = feedPosts.findIndex(p => p.id === data.id);
        if (postIndex !== -1) {
            feedPosts[postIndex] = data;
        }
    }
}

/**
 * Fetch and render sidebar suggested users
 */
async function fetchSuggestedUsers() {
    const listEl = document.getElementById('sidebar-suggested-users-list');
    if (!listEl) return;

    try {
        const response = await apiCall('/api/v1/users/suggested/', 'GET', null, false);
        const users = response.results || response;

        if (users.length === 0) {
            listEl.innerHTML = `<div style="padding: var(--space-2) 0; color: var(--color-text-muted); font-size: var(--text-xs);">No suggestions available.</div>`;
            return;
        }

        const itemsHtml = users.map(user => {
            const photo = user.profile_photo ? user.profile_photo : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';
            return `
                <div class="user-follow-row">
                    <a href="/@${user.username}" class="user-follow-details">
                        <img src="${photo}" class="avatar avatar-sm">
                        <div class="user-follow-names">
                            <span class="user-follow-displayname">${escapeHtml(user.display_name)}</span>
                            <span class="user-follow-username">@${escapeHtml(user.username)}</span>
                        </div>
                    </a>
                    <button class="btn btn-secondary btn-xs btn-sidebar-follow" data-username="${user.username}">Follow</button>
                </div>
            `;
        }).join('');

        listEl.innerHTML = itemsHtml;

        // Wire sidebar follows
        listEl.querySelectorAll('.btn-sidebar-follow').forEach(btn => {
            btn.addEventListener('click', async () => {
                const username = btn.dataset.username;
                const following = btn.classList.contains('btn-primary');

                try {
                    if (following) {
                        await apiCall(`/api/v1/users/${username}/follow/`, 'DELETE');
                        btn.innerText = 'Follow';
                        btn.className = 'btn btn-secondary btn-xs btn-sidebar-follow';
                    } else {
                        const res = await apiCall(`/api/v1/users/${username}/follow/`, 'POST');
                        btn.innerText = res.status === 'PENDING' ? 'Requested' : 'Following';
                        btn.className = 'btn btn-primary btn-xs btn-sidebar-follow';
                        showToast(res.status === 'PENDING' ? 'Follow request sent.' : `Now following @${username}`, 'success');
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        });

    } catch (err) {
        listEl.innerHTML = `<div style="padding: var(--space-2) 0; color: var(--color-text-error); font-size: var(--text-xs);">Failed to load recommendations.</div>`;
    }
}

/**
 * Escapes HTML helper
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
