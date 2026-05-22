/**
 * Explore Page Module
 * Controls the search engine, hashtag filters, and trending public engagement feed.
 */

import { apiCall } from '../api.js';
import { renderPostCard, initPostCardListeners } from '../components/PostCard.js';
import { navigateTo } from '../state.js';

// Local cache
let explorePosts = [];

export const ExplorePage = {
    async render(params) {
        const tag = params.tag;
        const queryParams = new URLSearchParams(window.location.search);
        const searchQuery = queryParams.get('q') || '';

        // If filtering by hashtag
        if (tag) {
            return `
                <div class="explore-container">
                    <header class="card" style="padding: var(--space-6); display: flex; align-items: center; gap: var(--space-4);">
                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--color-brand-gradient); display: flex; align-items: center; justify-content: center; font-size: var(--text-lg); font-weight: 800; color: #fff;">#</div>
                        <div>
                            <h1 style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 800; margin-bottom: 2px;">#${escapeHtml(tag)}</h1>
                            <p style="font-size: var(--text-xs); color: var(--color-text-muted);" id="tag-post-count-label">Loading posts...</p>
                        </div>
                    </header>

                    <main class="main-content" id="explore-posts-mount" style="max-width: var(--width-feed); margin: 0 auto; width: 100%;">
                        <div style="padding: var(--space-12); text-align: center; color: var(--color-text-muted);">Fetching tag feed...</div>
                    </main>
                </div>
            `;
        }

        // If displaying search query results
        if (searchQuery) {
            return `
                <div class="explore-container">
                    <div class="search-wrapper-large">
                        <span class="search-icon-large">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </span>
                        <input type="text" id="explore-search-input" value="${escapeHtml(searchQuery)}" placeholder="Search people or #hashtags...">
                    </div>

                    <div class="explore-grid-layout" style="grid-template-columns: 1fr;">
                        <div>
                            <div class="explore-section-title" id="search-users-title" style="display: none;">People</div>
                            <div class="user-results-grid" id="search-users-results"></div>

                            <div class="explore-section-title" id="search-tags-title" style="display: none;">Hashtags</div>
                            <div class="trending-list" id="search-tags-results" style="margin-bottom: var(--space-6);"></div>

                            <div id="search-empty-state" style="display: none; padding: var(--space-12); text-align: center; color: var(--color-text-muted);">
                                No results found for "${escapeHtml(searchQuery)}". Try checking the spelling.
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Default: Popular Explore Feed & Trending Panel
        return `
            <div class="explore-container">
                <!-- Large Search -->
                <div class="search-wrapper-large">
                    <span class="search-icon-large">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </span>
                    <input type="text" id="explore-search-input" placeholder="Search creators, hashtags, keywords...">
                </div>

                <div class="explore-grid-layout">
                    <!-- Left: Popular Feed -->
                    <div>
                        <h2 class="explore-section-title">
                            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="width: 20px; height: 20px; color: var(--color-brand-primary);"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z"></path></svg>
                            Popular
                        </h2>
                        <div id="explore-posts-mount">
                            <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">Assembling popular posts...</div>
                        </div>
                    </div>

                    <!-- Right: Trending Hashtags list -->
                    <div>
                        <div class="trending-card">
                            <div class="trending-header">
                                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5"></path></svg>
                                <span class="trending-title">Trending Tags</span>
                            </div>
                            <div class="trending-list" id="trending-tags-mount">
                                <!-- Hashtags seed fallback or dynamic -->
                                <div style="padding: var(--space-2) 0; color: var(--color-text-muted); font-size: var(--text-xs);">Type in search to find hashtags!</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async init(params) {
        const tag = params.tag;
        const queryParams = new URLSearchParams(window.location.search);
        const searchQuery = queryParams.get('q') || '';

        // Bind large search input key listener
        const searchInput = document.getElementById('explore-search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = searchInput.value.trim();
                    if (query) {
                        navigateTo(`/explore?q=${encodeURIComponent(query)}`);
                    }
                }
            });
        }

        if (tag) {
            await fetchTagFeed(tag);
        } else if (searchQuery) {
            await executeSearch(searchQuery);
        } else {
            await fetchPopularExploreFeed();
        }
    }
};

/**
 * Fetch feed for a specific Hashtag
 */
async function fetchTagFeed(tag) {
    const mount = document.getElementById('explore-posts-mount');
    if (!mount) return;

    try {
        const response = await apiCall(`/api/v1/explore/tags/${tag}/`, 'GET', null, false);
        explorePosts = response.results || [];
        
        // Update tags label count
        const label = document.getElementById('tag-post-count-label');
        if (label) {
            label.innerText = `${explorePosts.length} posts`;
        }

        if (explorePosts.length === 0) {
            mount.innerHTML = `<div style="padding: var(--space-12); text-align: center; color: var(--color-text-muted);">No posts found under #${escapeHtml(tag)}.</div>`;
            return;
        }

        mount.innerHTML = explorePosts.map(post => renderPostCard(post)).join('');
        
        // Listeners
        mount.querySelectorAll('.post-card-element').forEach(cardEl => {
            const postId = cardEl.dataset.postId;
            const postObj = explorePosts.find(p => p.id === postId);
            if (postObj) {
                initPostCardListeners(cardEl, postObj, handleExploreUpdate);
            }
        });

    } catch (e) {
        mount.innerHTML = `<div style="padding: var(--space-6); text-align: center; color: var(--color-text-error);">Failed to load tag posts.</div>`;
    }
}

/**
 * Execute search query for users and tags
 */
async function executeSearch(query) {
    const usersMount = document.getElementById('search-users-results');
    const tagsMount = document.getElementById('search-tags-results');
    const usersTitle = document.getElementById('search-users-title');
    const tagsTitle = document.getElementById('search-tags-title');
    const emptyState = document.getElementById('search-empty-state');

    if (!usersMount || !tagsMount) return;

    try {
        const data = await apiCall(`/api/v1/users/search/?q=${encodeURIComponent(query)}`, 'GET', null, false);
        const users = data.users || [];
        const hashtags = data.hashtags || [];

        if (users.length === 0 && hashtags.length === 0) {
            emptyState.style.display = 'block';
            usersTitle.style.display = 'none';
            tagsTitle.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';

        // Render Users
        if (users.length > 0) {
            usersTitle.style.display = 'block';
            usersMount.innerHTML = users.map(user => {
                const photo = user.profile_photo ? user.profile_photo : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';
                return `
                    <a href="/@${user.username}" class="user-result-card">
                        <img src="${photo}" class="avatar avatar-md">
                        <div class="user-result-info">
                            <span class="user-result-display-name">${escapeHtml(user.display_name)}</span>
                            <span class="user-result-username">@${escapeHtml(user.username)}</span>
                        </div>
                    </a>
                `;
            }).join('');
        } else {
            usersTitle.style.display = 'none';
            usersMount.innerHTML = '';
        }

        // Render Hashtags
        if (hashtags.length > 0) {
            tagsTitle.style.display = 'block';
            tagsMount.innerHTML = hashtags.map((tag, idx) => {
                return `
                    <a href="/explore/tags/${tag.tag}" class="trending-item">
                        <div class="trending-info">
                            <span class="trending-tag">#${escapeHtml(tag.tag)}</span>
                            <span class="trending-posts-count">${tag.post_count} posts</span>
                        </div>
                        <span class="trending-rank">#${idx + 1}</span>
                    </a>
                `;
            }).join('');
        } else {
            tagsTitle.style.display = 'none';
            tagsMount.innerHTML = '';
        }

    } catch (e) {
        console.error(e);
        showToast('Failed to perform search.', 'error');
    }
}

/**
 * Fetch popular posts for landing page feed
 */
async function fetchPopularExploreFeed() {
    const mount = document.getElementById('explore-posts-mount');
    const tagsMount = document.getElementById('trending-tags-mount');
    if (!mount) return;

    try {
        const response = await apiCall('/api/v1/explore/', 'GET', null, false);
        explorePosts = response.results || [];

        if (explorePosts.length === 0) {
            mount.innerHTML = `<div style="padding: var(--space-12); text-align: center; color: var(--color-text-muted);">No posts shared publicly yet.</div>`;
            return;
        }

        mount.innerHTML = explorePosts.map(post => renderPostCard(post)).join('');
        
        // Listeners
        mount.querySelectorAll('.post-card-element').forEach(cardEl => {
            const postId = cardEl.dataset.postId;
            const postObj = explorePosts.find(p => p.id === postId);
            if (postObj) {
                initPostCardListeners(cardEl, postObj, handleExploreUpdate);
            }
        });

        // Parse trending tags on client side from loaded explore posts captions!
        // This dynamically pulls tags based on actual visual posts shown, which is super neat!
        const tagCounts = {};
        explorePosts.forEach(post => {
            if (!post.caption) return;
            const tags = post.caption.match(/#(\w+)/g);
            if (tags) {
                tags.forEach(t => {
                    const clean = t.substring(1).toLowerCase();
                    tagCounts[clean] = (tagCounts[clean] || 0) + 1;
                });
            }
        });

        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (sortedTags.length > 0 && tagsMount) {
            tagsMount.innerHTML = sortedTags.map(([tag, count], idx) => {
                return `
                    <a href="/explore/tags/${tag}" class="trending-item">
                        <div class="trending-info">
                            <span class="trending-tag">#${escapeHtml(tag)}</span>
                            <span class="trending-posts-count">${count} active mentions</span>
                        </div>
                        <span class="trending-rank">#${idx + 1}</span>
                    </a>
                `;
            }).join('');
        }

    } catch (e) {
        mount.innerHTML = `<div style="padding: var(--space-6); text-align: center; color: var(--color-text-error);">Failed to load explore feed.</div>`;
        console.error(e);
    }
}

/**
 * Handle callbacks when explore posts are liked/deleted
 */
function handleExploreUpdate(action, data) {
    if (action === 'delete') {
        const postId = data;
        explorePosts = explorePosts.filter(p => p.id !== postId);
        const card = document.querySelector(`.post-card-element[data-post-id="${postId}"]`);
        if (card) {
            card.remove();
        }
    } else if (action === 'edit' || action === 'like' || action === 'comment') {
        const index = explorePosts.findIndex(p => p.id === data.id);
        if (index !== -1) {
            explorePosts[index] = data;
        }
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
