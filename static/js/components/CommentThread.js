/**
 * CommentThread Component
 * Renders threaded comment lists with nested reply nodes, liking comments, and deletions.
 */

import { apiCall } from '../api.js';
import { getState } from '../state.js';
import { showToast } from './Toast.js';
import { formatTimestamp } from '../router.js';

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
 * Parse comment body to make mentions clickable links
 */
function parseCommentBody(body) {
    if (!body) return '';
    let escaped = escapeHtml(body);
    // Mentions
    escaped = escaped.replace(/@([a-zA-Z0-9_]+)/g, '<a href="/@$1" class="mention">@$1</a>');
    return escaped;
}

/**
 * Generate HTML for a single comment node (supports nested reply indent styling)
 */
function renderCommentNode(comment, isReply = false, postAuthorId = null) {
    const state = getState();
    const isLiked = comment.is_liked;
    const likeClass = isLiked ? 'liked' : '';
    const hasLikes = comment.like_count > 0;
    
    const photo = comment.author.profile_photo 
        ? comment.author.profile_photo 
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';

    // Show delete button if user is comment author OR post author
    const isOwnComment = comment.is_own_comment;
    const isPostOwner = state.user && postAuthorId && state.user.id === postAuthorId;
    const canDelete = isOwnComment || isPostOwner;

    const deleteBtnHtml = canDelete && !comment.is_deleted
        ? `<button class="btn btn-text btn-delete-comment" style="font-size: 10px; color: var(--color-error); padding: 0;">Delete</button>`
        : '';

    // Reply action button (only top-level comments can receive replies to maintain 1-level depth)
    const replyBtnHtml = (!isReply && state.user && !comment.is_deleted)
        ? `<button class="btn btn-text btn-reply-comment" style="font-size: 10px; color: var(--color-text-muted); padding: 0;">Reply</button>`
        : '';

    const likeBtnHtml = (!comment.is_deleted && state.user)
        ? `
        <button class="btn btn-icon btn-like-comment ${likeClass}" style="padding: 4px;" title="Like comment">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"></path></svg>
        </button>
        `
        : '';

    const commentBodyClass = comment.is_deleted ? 'comment-deleted-text' : '';

    return `
        <div class="comment-item ${isReply ? 'comment-reply-item' : ''}" data-comment-id="${comment.id}" data-username="${comment.author.username}">
            <img src="${photo}" alt="${comment.author.display_name}" class="avatar ${isReply ? 'avatar-sm' : 'avatar-md'}">
            
            <div class="comment-content">
                <div class="comment-header-info">
                    <span class="comment-author-name">${escapeHtml(comment.author.display_name)}</span>
                    <a href="/@${comment.author.username}" class="comment-author-handle">@${escapeHtml(comment.author.username)}</a>
                    <span class="comment-time">${formatTimestamp(comment.created_at)}</span>
                </div>
                
                <div class="comment-body ${commentBodyClass}">
                    ${parseCommentBody(comment.body)}
                </div>
                
                <div class="comment-footer-actions">
                    ${replyBtnHtml}
                    ${deleteBtnHtml}
                    ${hasLikes ? `<span class="comment-likes-label" style="font-size: 10px; color: var(--color-text-muted);">${comment.like_count} likes</span>` : ''}
                </div>
            </div>
            
            <div class="comment-like-zone">
                ${likeBtnHtml}
            </div>
        </div>
    `;
}

/**
 * Generate full comments list HTML including replies indented
 */
export function renderCommentsList(comments, postAuthorId) {
    if (comments.length === 0) {
        return `<div class="empty-comments-state" style="padding: var(--space-8) var(--space-4); text-align: center; color: var(--color-text-muted); font-size: var(--text-sm);">No comments yet. Be the first to share your thoughts!</div>`;
    }

    return comments.map(comment => {
        const repliesHtml = comment.replies && comment.replies.length > 0
            ? `<div class="comment-replies-list" style="margin-left: 48px; border-left: 1px solid var(--color-border); padding-left: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-3);">
                ${comment.replies.map(reply => renderCommentNode(reply, true, postAuthorId)).join('')}
               </div>`
            : '';

        return `
            <div class="comment-thread-wrapper" style="border-bottom: 1px solid rgba(255, 255, 255, 0.02); padding: var(--space-4) 0;">
                ${renderCommentNode(comment, false, postAuthorId)}
                ${repliesHtml}
            </div>
        `;
    }).join('');
}

/**
 * Binds comment interaction event listeners (likes, deletes, reply inputs)
 */
export function initCommentListeners(containerEl, comments, postAuthorId, onCommentAction) {
    // Comment Likes Action (Optimistic Update)
    containerEl.querySelectorAll('.btn-like-comment').forEach(btn => {
        btn.addEventListener('click', async () => {
            const itemEl = btn.closest('[data-comment-id]');
            if (!itemEl) return;
            const commentId = itemEl.dataset.commentId;

            // Find the comment object locally to update counts
            let targetComment = null;
            for (const c of comments) {
                if (c.id === commentId) {
                    targetComment = c;
                    break;
                }
                if (c.replies) {
                    const r = c.replies.find(x => x.id === commentId);
                    if (r) {
                        targetComment = r;
                        break;
                    }
                }
            }

            if (!targetComment) return;

            const isLiked = btn.classList.contains('liked');
            let newCount = targetComment.like_count;

            // Optimistic toggles
            if (isLiked) {
                btn.classList.remove('liked');
                newCount = Math.max(0, newCount - 1);
            } else {
                btn.classList.add('liked');
                newCount += 1;
            }

            targetComment.is_liked = !isLiked;
            targetComment.like_count = newCount;

            // Re-render footer label immediately
            const footer = itemEl.querySelector('.comment-footer-actions');
            if (footer) {
                const label = footer.querySelector('.comment-likes-label');
                if (label) label.remove();
                if (newCount > 0) {
                    const newLabel = document.createElement('span');
                    newLabel.className = 'comment-likes-label';
                    newLabel.style.fontSize = '10px';
                    newLabel.style.color = 'var(--color-text-muted)';
                    newLabel.innerText = `${newCount} likes`;
                    footer.appendChild(newLabel);
                }
            }

            try {
                const method = isLiked ? 'DELETE' : 'POST';
                await apiCall(`/api/v1/comments/${commentId}/like/`, method);
            } catch (err) {
                console.error(err);
                // Rollback local counts if failed
                targetComment.is_liked = isLiked;
                targetComment.like_count = isLiked ? newCount + 1 : Math.max(0, newCount - 1);
                if (onCommentAction) onCommentAction();
            }
        });
    });

    // Reply trigger: sets up the parent reply interface on the modal
    containerEl.querySelectorAll('.btn-reply-comment').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemEl = btn.closest('[data-comment-id]');
            if (!itemEl) return;
            const commentId = itemEl.dataset.commentId;
            const username = itemEl.dataset.username;

            if (onCommentAction) {
                onCommentAction('reply', { commentId, username });
            }
        });
    });

    // Delete comment trigger
    containerEl.querySelectorAll('.btn-delete-comment').forEach(btn => {
        btn.addEventListener('click', async () => {
            const itemEl = btn.closest('[data-comment-id]');
            if (!itemEl) return;
            const commentId = itemEl.dataset.commentId;

            if (!confirm('Are you sure you want to delete this comment?')) return;

            try {
                await apiCall(`/api/v1/comments/${commentId}/`, 'DELETE');
                showToast('Comment deleted.', 'success');
                if (onCommentAction) {
                    onCommentAction('delete', commentId);
                }
            } catch (err) {
                console.error(err);
            }
        });
    });
}
