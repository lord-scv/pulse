/**
 * PostCard Component
 * Renders individual posts and coordinates user interactions (likes, comments, deletes).
 */

import { apiCall } from '../api.js';
import { getState, navigateTo } from '../state.js';
import { showToast } from './Toast.js';
import { formatTimestamp } from '../router.js';
import { openPostDetailModal } from './PostModal.js';

/**
 * Escapes HTML characters for security
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
 * Parse caption to make hashtags and mentions clickable SPA links
 */
export function parseCaption(caption) {
    if (!caption) return '';
    let escaped = escapeHtml(caption);
    // Hashtags
    escaped = escaped.replace(/#([a-zA-Z0-9_]+)/g, '<a href="/explore/tags/$1" class="hashtag">#$1</a>');
    // Mentions
    escaped = escaped.replace(/@([a-zA-Z0-9_]+)/g, '<a href="/@$1" class="mention">@$1</a>');
    return escaped;
}

/**
 * Generates PostCard HTML string
 */
export function renderPostCard(post) {
    const state = getState();
    const isLiked = post.is_liked;
    const likeClass = isLiked ? 'liked' : '';
    
    // Fallback profile photo
    const authorPhoto = post.author.profile_photo 
        ? post.author.profile_photo 
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';
        
    const hasImage = !!post.image;
    const isOwnPost = post.is_own_post;

    // Actions dropdown / buttons for owner
    const menuHtml = isOwnPost 
        ? `
        <div class="card-menu-wrapper" style="position: relative;">
            <button class="btn btn-icon btn-card-menu" style="padding: 4px;">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"></path></svg>
            </button>
            <div class="card dropdown-menu card-actions-dropdown" style="display: none; position: absolute; right: 0; top: 100%; width: 120px; z-index: 100; box-shadow: var(--shadow-2); padding: var(--space-1);">
                <button class="btn btn-text btn-edit-post" style="width: 100%; text-align: left; padding: var(--space-2) var(--space-3); font-size: var(--text-xs); color: var(--color-text-primary);">Edit</button>
                <button class="btn btn-text btn-delete-post" style="width: 100%; text-align: left; padding: var(--space-2) var(--space-3); font-size: var(--text-xs); color: var(--color-error);">Delete</button>
            </div>
        </div>
        ` 
        : '';

    // Comments status message
    let commentToggleHtml = '';
    if (!post.comments_disabled) {
        if (post.comment_count > 0) {
            commentToggleHtml = `<span class="card-comments-toggle btn-open-modal">View all ${post.comment_count} comments</span>`;
        } else {
            commentToggleHtml = `<span class="card-comments-toggle btn-open-modal">Add a comment</span>`;
        }
    } else {
        commentToggleHtml = `<span class="card-comments-toggle" style="cursor: default;">Comments disabled</span>`;
    }

    // Inline comment form
    const commentFormHtml = (!post.comments_disabled && state.user)
        ? `
        <div class="card-comment-input-container">
            <input type="text" class="card-comment-input inline-comment-field" placeholder="Add a comment...">
            <button class="btn btn-text inline-comment-submit-btn" style="color: var(--color-brand-primary); font-weight: 600; font-size: var(--text-xs); opacity: 0.5; pointer-events: none;">Post</button>
        </div>
        `
        : '';

    return `
        <article class="card post-card-element" data-post-id="${post.id}">
            <!-- Header -->
            <div class="card-header">
                <div class="card-author">
                    <a href="/@${post.author.username}" style="text-decoration: none;">
                        <img src="${authorPhoto}" alt="${post.author.display_name}" class="avatar avatar-md">
                    </a>
                    <div class="card-author-info">
                        <a href="/@${post.author.username}" class="card-display-name" style="text-decoration: none;">${escapeHtml(post.author.display_name)}</a>
                        <a href="/@${post.author.username}" class="card-username" style="text-decoration: none;">@${escapeHtml(post.author.username)}</a>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                    <span class="card-time">${formatTimestamp(post.created_at)}</span>
                    ${menuHtml}
                </div>
            </div>

            <!-- Media Image (Optional) -->
            ${hasImage ? `
            <div class="card-media btn-open-modal">
                <img src="${post.image}" alt="Post image" loading="lazy">
            </div>
            ` : ''}

            <!-- Actions Row -->
            <div class="card-actions">
                <div class="card-actions-left">
                    <button class="btn btn-icon btn-like ${likeClass}" title="Like">
                        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 22px; height: 22px;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"></path></svg>
                    </button>
                    <button class="btn btn-icon btn-open-modal" title="Comment">
                        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 22px; height: 22px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641l-.318 1.235c-.075.29.172.563.472.48l1.69-.47a1.913 1.913 0 011.566.239c1.138.65 2.453 1.026 3.832 1.026z"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Content Details -->
            <div class="card-info">
                <div class="card-likes-count btn-show-likes" data-likes="${post.like_count}">${post.like_count} likes</div>
                <div class="card-caption">
                    <a href="/@${post.author.username}" style="text-decoration: none; font-weight: 700; margin-right: 6px;">${escapeHtml(post.author.username)}</a>
                    <span>${parseCaption(post.caption)}</span>
                </div>
                ${commentToggleHtml}
            </div>

            <!-- Comments Form -->
            ${commentFormHtml}
        </article>
    `;
}

/**
 * Attaches event listeners to the rendered card element
 */
export function initPostCardListeners(cardEl, post, onUpdate) {
    const state = getState();
    const postId = post.id;

    // Toggle menu
    const menuBtn = cardEl.querySelector('.btn-card-menu');
    const dropdown = cardEl.querySelector('.card-actions-dropdown');
    if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = dropdown.style.display === 'block';
            dropdown.style.display = open ? 'none' : 'block';
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== menuBtn) {
                dropdown.style.display = 'none';
            }
        });
    }

    // Delete post trigger
    const deleteBtn = cardEl.querySelector('.btn-delete-post');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to delete this post?')) return;
            try {
                await apiCall(`/api/v1/posts/${postId}/`, 'DELETE');
                showToast('Post deleted successfully.', 'success');
                if (onUpdate) onUpdate('delete', postId);
            } catch (err) {
                console.error(err);
            }
        });
    }

    // Edit post trigger
    const editBtn = cardEl.querySelector('.btn-edit-post');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            openEditCaptionModal(post, (newCaption) => {
                // Update local element
                const captionSpan = cardEl.querySelector('.card-caption span');
                if (captionSpan) {
                    captionSpan.innerHTML = parseCaption(newCaption);
                }
                post.caption = newCaption;
                if (onUpdate) onUpdate('edit', post);
            });
        });
    }

    // Likes Modal toggle
    const likesCountBtn = cardEl.querySelector('.btn-show-likes');
    if (likesCountBtn) {
        likesCountBtn.addEventListener('click', () => {
            openLikersModal(postId);
        });
    }

    // Open detail modal clicks
    cardEl.querySelectorAll('.btn-open-modal').forEach(el => {
        el.addEventListener('click', () => {
            openPostDetailModal(postId, onUpdate);
        });
    });

    // Like Action (Optimistic Update)
    const likeBtn = cardEl.querySelector('.btn-like');
    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            if (!state.user) {
                navigateTo('/auth');
                return;
            }

            const currentlyLiked = likeBtn.classList.contains('liked');
            const likeCounter = cardEl.querySelector('.card-likes-count');

            // Optimistic update
            let newCount = post.like_count;
            if (currentlyLiked) {
                likeBtn.classList.remove('liked');
                newCount = Math.max(0, newCount - 1);
            } else {
                likeBtn.classList.add('liked');
                newCount += 1;
            }
            post.is_liked = !currentlyLiked;
            post.like_count = newCount;
            if (likeCounter) {
                likeCounter.innerText = `${newCount} likes`;
            }

            try {
                const method = currentlyLiked ? 'DELETE' : 'POST';
                await apiCall(`/api/v1/posts/${postId}/like/`, method);
            } catch (err) {
                // Rollback if failure
                post.is_liked = currentlyLiked;
                post.like_count = currentlyLiked ? newCount + 1 : Math.max(0, newCount - 1);
                
                if (currentlyLiked) {
                    likeBtn.classList.add('liked');
                } else {
                    likeBtn.classList.remove('liked');
                }
                if (likeCounter) {
                    likeCounter.innerText = `${post.like_count} likes`;
                }
                console.error('Like toggle failed', err);
            }
        });
    }

    // Inline Comments text validation
    const inlineInput = cardEl.querySelector('.inline-comment-field');
    const inlineSubmit = cardEl.querySelector('.inline-comment-submit-btn');
    if (inlineInput && inlineSubmit) {
        inlineInput.addEventListener('input', () => {
            const empty = inlineInput.value.trim() === '';
            inlineSubmit.style.opacity = empty ? '0.5' : '1';
            inlineSubmit.style.pointerEvents = empty ? 'none' : 'auto';
        });

        inlineSubmit.addEventListener('click', async () => {
            const bodyText = inlineInput.value.trim();
            if (!bodyText) return;

            try {
                const newComment = await apiCall(`/api/v1/posts/${postId}/comments/`, 'POST', { body: bodyText });
                inlineInput.value = '';
                inlineSubmit.style.opacity = '0.5';
                inlineSubmit.style.pointerEvents = 'none';
                showToast('Comment posted.', 'success');
                
                // Increment comments counter
                post.comment_count += 1;
                const toggleBtn = cardEl.querySelector('.card-comments-toggle');
                if (toggleBtn && !post.comments_disabled) {
                    toggleBtn.innerText = `View all ${post.comment_count} comments`;
                    toggleBtn.classList.add('btn-open-modal');
                }
                if (onUpdate) onUpdate('comment', post);
            } catch (err) {
                console.error(err);
            }
        });
    }
}

/**
 * Open Modal to edit the caption of a post
 */
function openEditCaptionModal(post, onSuccess) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const modal = document.createElement('div');
    modal.className = 'modal modal-open';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content" style="max-width: 480px; padding: var(--space-6);">
            <div class="modal-header" style="margin-bottom: var(--space-4);">
                <h3 class="modal-title">Edit Caption</h3>
                <button class="btn btn-icon btn-close-modal">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-4);">
                <textarea id="edit-caption-textarea" class="input" style="min-height: 120px; resize: vertical;">${escapeHtml(post.caption)}</textarea>
                <div style="display: flex; justify-content: flex-end; gap: var(--space-3);">
                    <button class="btn btn-text btn-close-modal">Cancel</button>
                    <button class="btn btn-primary" id="btn-save-edit-caption">Save Changes</button>
                </div>
            </div>
        </div>
    `;

    modalContainer.appendChild(modal);

    const closeModal = () => {
        modal.classList.remove('modal-open');
        setTimeout(() => modal.remove(), 200);
    };

    modal.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', closeModal));

    const saveBtn = modal.querySelector('#btn-save-edit-caption');
    const textarea = modal.querySelector('#edit-caption-textarea');

    saveBtn.addEventListener('click', async () => {
        const text = textarea.value;
        try {
            await apiCall(`/api/v1/posts/${post.id}/`, 'PATCH', { caption: text });
            closeModal();
            showToast('Post updated.', 'success');
            if (onSuccess) onSuccess(text);
        } catch (err) {
            console.error(err);
        }
    });
}

/**
 * Open Modal showing users who liked a post
 */
async function openLikersModal(postId) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const modal = document.createElement('div');
    modal.className = 'modal modal-open';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content" style="max-width: 400px; padding: var(--space-6); max-height: 80vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="margin-bottom: var(--space-4); flex-shrink: 0;">
                <h3 class="modal-title">Liked By</h3>
                <button class="btn btn-icon btn-close-modal">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div id="likers-list-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3);">
                <div style="padding: var(--space-6); text-align: center; color: var(--color-text-muted);">Loading...</div>
            </div>
        </div>
    `;

    modalContainer.appendChild(modal);

    const closeModal = () => {
        modal.classList.remove('modal-open');
        setTimeout(() => modal.remove(), 200);
    };

    modal.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', closeModal));

    try {
        const response = await apiCall(`/api/v1/posts/${postId}/likes/`, 'GET', null, false);
        const users = response.results || [];
        const listEl = modal.querySelector('#likers-list-container');

        if (users.length === 0) {
            listEl.innerHTML = `<div style="padding: var(--space-6); text-align: center; color: var(--color-text-muted);">No likes yet.</div>`;
            return;
        }

        const itemsHtml = users.map(user => {
            const photo = user.profile_photo ? user.profile_photo : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';
            return `
                <div class="user-follow-row">
                    <a href="/@${user.username}" class="user-follow-details btn-click-profile">
                        <img src="${photo}" class="avatar avatar-sm">
                        <div class="user-follow-names">
                            <span class="user-follow-displayname">${escapeHtml(user.display_name)}</span>
                            <span class="user-follow-username">@${escapeHtml(user.username)}</span>
                        </div>
                    </a>
                </div>
            `;
        }).join('');

        listEl.innerHTML = itemsHtml;
        
        listEl.querySelectorAll('.btn-click-profile').forEach(el => {
            el.addEventListener('click', (e) => {
                closeModal();
            });
        });
    } catch (err) {
        console.error(err);
    }
}
