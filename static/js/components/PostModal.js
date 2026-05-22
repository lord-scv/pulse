/**
 * PostModal Component
 * Implements two distinct flows:
 * 1. Post Details Modal: Displays full-resolution post, scrollable comment feed, and reply mechanics.
 * 2. Visual Post Creator Modal: Captures image uploads, caption inputs, and comment settings.
 */

import { apiCall } from '../api.js';
import { getState, navigateTo } from '../state.js';
import { showToast } from './Toast.js';
import { formatTimestamp } from '../router.js';
import { renderCommentsList, initCommentListeners } from './CommentThread.js';
import { parseCaption } from './PostCard.js';

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
 * Opens detailed view modal for a post
 */
export async function openPostDetailModal(postId, onFeedUpdate) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    // Render loading shell
    const modal = document.createElement('div');
    modal.className = 'modal modal-open';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content post-detail-modal" style="max-width: 900px; height: 80vh; padding: 0; display: flex; overflow: hidden;">
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; background-color: #000; height: 100%;">
                <div style="color: var(--color-text-muted); font-size: var(--text-sm);">Loading post...</div>
            </div>
        </div>
    `;
    modalContainer.appendChild(modal);

    const closeModal = () => {
        modal.classList.remove('modal-open');
        setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

    try {
        // Fetch post and comments in parallel
        const [post, commentsResponse] = await Promise.all([
            apiCall(`/api/v1/posts/${postId}/`, 'GET', null, false),
            apiCall(`/api/v1/posts/${postId}/comments/`, 'GET', null, false)
        ]);

        const comments = commentsResponse.results || commentsResponse; // handle pagination response structure
        const state = getState();
        
        const isLiked = post.is_liked;
        const likeClass = isLiked ? 'liked' : '';
        const authorPhoto = post.author.profile_photo 
            ? post.author.profile_photo 
            : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';

        // Setup two-pane layout or single-pane based on image presence
        const hasImage = !!post.image;
        
        let repliesTarget = null; // Stores target { commentId, username } when replying

        const modalBodyHtml = `
            <div class="modal-backdrop btn-close-modal"></div>
            <div class="modal-content post-detail-modal-box" style="max-width: ${hasImage ? '1000px' : '600px'}; width: 95%; height: 85vh; padding: 0; border-radius: var(--radius-xl); overflow: hidden; display: grid; grid-template-columns: ${hasImage ? '1.2fr 1fr' : '1fr'}; background-color: var(--color-bg-surface); border: 1px solid var(--color-border); box-shadow: var(--shadow-3); z-index: 1010; position: relative;">
                
                <!-- Left Pane: Post Image (Only if present) -->
                ${hasImage ? `
                <div class="modal-detail-media-pane" style="background-color: #000; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; border-right: 1px solid var(--color-border);">
                    <img src="${post.image}" alt="Post image" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
                ` : ''}

                <!-- Right Pane: Comments & Details -->
                <div class="modal-detail-info-pane" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                    <!-- Detail Header -->
                    <div style="padding: var(--space-4); border-bottom: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: var(--space-3);">
                            <a href="/@${post.author.username}" class="btn-close-modal-link" style="text-decoration: none;">
                                <img src="${authorPhoto}" class="avatar avatar-md">
                            </a>
                            <div style="display: flex; flex-direction: column;">
                                <a href="/@${post.author.username}" class="btn-close-modal-link" style="font-weight: 600; font-size: var(--text-sm); color: var(--color-text-primary); text-decoration: none;">${escapeHtml(post.author.display_name)}</a>
                                <span style="font-size: var(--text-xs); color: var(--color-text-muted);">@${escapeHtml(post.author.username)}</span>
                            </div>
                        </div>
                        <button class="btn btn-icon btn-close-modal" style="padding: 4px;">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <!-- Scroll Feed Area (Caption + Comments) -->
                    <div class="comments-scroll-area" style="flex: 1; overflow-y: auto; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);">
                        <!-- Post Caption -->
                        <div style="display: flex; gap: var(--space-3); border-bottom: 1px solid rgba(255, 255, 255, 0.02); padding-bottom: var(--space-4);">
                            <img src="${authorPhoto}" class="avatar avatar-md">
                            <div>
                                <span style="font-weight: 700; font-size: var(--text-sm); color: var(--color-text-primary); margin-right: var(--space-2);">@${escapeHtml(post.author.username)}</span>
                                <span style="font-size: var(--text-sm); line-height: 1.5; color: var(--color-text-primary); word-break: break-word;">${parseCaption(post.caption)}</span>
                                <div style="font-size: 10px; color: var(--color-text-muted); margin-top: var(--space-2);">${formatTimestamp(post.created_at)}</div>
                            </div>
                        </div>

                        <!-- Threaded Comments Mount -->
                        <div id="modal-comments-list-mount">
                            ${renderCommentsList(comments, post.author.id)}
                        </div>
                    </div>

                    <!-- Actions & Like Counter -->
                    <div style="padding: var(--space-4); border-top: 1px solid var(--color-border); background-color: rgba(255, 255, 255, 0.01); flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-2);">
                            <button class="btn btn-icon btn-modal-like ${likeClass}" title="Like">
                                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 22px; height: 22px;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"></path></svg>
                            </button>
                            <button class="btn btn-icon btn-modal-comment-focus" title="Comment">
                                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 22px; height: 22px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641l-.318 1.235c-.075.29.172.563.472.48l1.69-.47a1.913 1.913 0 011.566.239c1.138.65 2.453 1.026 3.832 1.026z"></path></svg>
                            </button>
                        </div>
                        <div style="font-family: var(--font-heading); font-weight: 700; font-size: var(--text-sm); color: var(--color-text-primary);" class="modal-likes-count">${post.like_count} likes</div>
                    </div>

                    <!-- Replying Indicator Banner -->
                    <div id="replying-banner-notif" style="display: none; padding: var(--space-2) var(--space-4); background-color: rgba(99, 102, 241, 0.1); border-top: 1px solid rgba(99, 102, 241, 0.2); justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--color-text-secondary); flex-shrink: 0;">
                        <span>Replying to <strong id="replying-banner-username">@user</strong></span>
                        <button class="btn btn-text" id="btn-cancel-reply-mode" style="color: var(--color-error); font-size: 10px; font-weight: 600;">Cancel</button>
                    </div>

                    <!-- Bottom Comment Input Box -->
                    ${(!post.comments_disabled && state.user) ? `
                    <div style="display: flex; align-items: center; border-top: 1px solid var(--color-border); padding: var(--space-3) var(--space-4); gap: var(--space-3); flex-shrink: 0;">
                        <input type="text" id="modal-comment-input-field" class="input" style="border: none; background: transparent; padding: var(--space-2) 0; box-shadow: none; font-size: var(--text-sm); flex: 1;" placeholder="Add a comment...">
                        <button class="btn btn-text" id="modal-comment-submit-btn" style="color: var(--color-brand-primary); font-weight: 700; font-size: var(--text-sm); opacity: 0.5; pointer-events: none;">Post</button>
                    </div>
                    ` : `
                    <div style="padding: var(--space-4); border-top: 1px solid var(--color-border); text-align: center; color: var(--color-text-muted); font-size: var(--text-xs); font-weight: 500; background-color: rgba(255, 255, 255, 0.01); flex-shrink: 0;">
                        ${post.comments_disabled ? 'Comments are disabled on this post.' : 'Log in to join the conversation.'}
                    </div>
                    `}
                </div>

            </div>
        `;

        modal.innerHTML = modalBodyHtml;

        // Wire close elements
        modal.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', closeModal));
        
        // Modal links that redirect need to close modal first
        modal.querySelectorAll('.btn-close-modal-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const path = link.getAttribute('href');
                closeModal();
                // Handled globally in router, but let's trigger SPA navigation just in case
                navigateTo(path);
            });
        });

        // Setup focus on comment input
        const commentFocusBtn = modal.querySelector('.btn-modal-comment-focus');
        const commentInput = modal.querySelector('#modal-comment-input-field');
        const commentSubmit = modal.querySelector('#modal-comment-submit-btn');
        
        if (commentFocusBtn && commentInput) {
            commentFocusBtn.addEventListener('click', () => {
                commentInput.focus();
            });
        }

        // Like button interaction inside modal
        const likeBtn = modal.querySelector('.btn-modal-like');
        const likeCounter = modal.querySelector('.modal-likes-count');

        if (likeBtn) {
            likeBtn.addEventListener('click', async () => {
                if (!state.user) {
                    closeModal();
                    navigateTo('/auth');
                    return;
                }

                const currentlyLiked = likeBtn.classList.contains('liked');
                let newCount = post.like_count;

                // Optimistically update
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

                // Sync main page feed CARD if exists
                const feedCard = document.querySelector(`.post-card-element[data-post-id="${postId}"]`);
                if (feedCard) {
                    const cardLikeBtn = feedCard.querySelector('.btn-like');
                    const cardLikeCounter = feedCard.querySelector('.card-likes-count');
                    
                    if (cardLikeBtn) {
                        if (currentlyLiked) cardLikeBtn.classList.remove('liked');
                        else cardLikeBtn.classList.add('liked');
                    }
                    if (cardLikeCounter) {
                        cardLikeCounter.innerText = `${newCount} likes`;
                    }
                }

                try {
                    const method = currentlyLiked ? 'DELETE' : 'POST';
                    await apiCall(`/api/v1/posts/${postId}/like/`, method);
                    if (onFeedUpdate) onFeedUpdate('like', post);
                } catch (err) {
                    // Rollback
                    post.is_liked = currentlyLiked;
                    post.like_count = currentlyLiked ? newCount + 1 : Math.max(0, newCount - 1);
                    if (currentlyLiked) likeBtn.classList.add('liked');
                    else likeBtn.classList.remove('liked');
                    if (likeCounter) likeCounter.innerText = `${post.like_count} likes`;
                    console.error(err);
                }
            });
        }

        // Replying controls
        const replyingBanner = modal.querySelector('#replying-banner-notif');
        const replyingUsernameEl = modal.querySelector('#replying-banner-username');
        const cancelReplyBtn = modal.querySelector('#btn-cancel-reply-mode');

        const setReplyMode = (target) => {
            repliesTarget = target;
            if (target) {
                replyingUsernameEl.innerText = `@${target.username}`;
                replyingBanner.style.display = 'flex';
                commentInput.value = `@${target.username} `;
                commentInput.focus();
            } else {
                replyingBanner.style.display = 'none';
                if (commentInput.value.startsWith(`@`)) {
                    commentInput.value = '';
                }
            }
        };

        if (cancelReplyBtn) {
            cancelReplyBtn.addEventListener('click', () => setReplyMode(null));
        }

        // Comment form submission validation
        if (commentInput && commentSubmit) {
            commentInput.addEventListener('input', () => {
                const empty = commentInput.value.trim() === '';
                commentSubmit.style.opacity = empty ? '0.5' : '1';
                commentSubmit.style.pointerEvents = empty ? 'none' : 'auto';
            });

            commentSubmit.addEventListener('click', async () => {
                const text = commentInput.value.trim();
                if (!text) return;

                const payload = { body: text };
                // Attach parent comment ID if in reply mode
                if (repliesTarget) {
                    payload.parent_comment = repliesTarget.commentId;
                }

                try {
                    const newComment = await apiCall(`/api/v1/posts/${postId}/comments/`, 'POST', payload);
                    
                    commentInput.value = '';
                    commentSubmit.style.opacity = '0.5';
                    commentSubmit.style.pointerEvents = 'none';
                    setReplyMode(null);
                    showToast('Comment posted.', 'success');

                    // Refresh comments feed in modal
                    const refreshComments = await apiCall(`/api/v1/posts/${postId}/comments/`, 'GET', null, false);
                    const freshComments = refreshComments.results || refreshComments;
                    const listMount = modal.querySelector('#modal-comments-list-mount');
                    if (listMount) {
                        listMount.innerHTML = renderCommentsList(freshComments, post.author.id);
                        initCommentListeners(listMount, freshComments, post.author.id, handleCommentAction);
                    }

                    // Sync feed card comments count labels
                    post.comment_count += 1;
                    const feedCard = document.querySelector(`.post-card-element[data-post-id="${postId}"]`);
                    if (feedCard) {
                        const toggleBtn = feedCard.querySelector('.card-comments-toggle');
                        if (toggleBtn && !post.comments_disabled) {
                            toggleBtn.innerText = `View all ${post.comment_count} comments`;
                        }
                    }

                    if (onFeedUpdate) onFeedUpdate('comment', post);

                } catch (err) {
                    console.error(err);
                }
            });
        }

        // Handle comment deletion or reply action trigger callbacks from sub-components
        const handleCommentAction = async (action, data) => {
            if (action === 'reply') {
                setReplyMode(data);
            } else if (action === 'delete' || !action) {
                // Refresh comments
                const refreshComments = await apiCall(`/api/v1/posts/${postId}/comments/`, 'GET', null, false);
                const freshComments = refreshComments.results || refreshComments;
                const listMount = modal.querySelector('#modal-comments-list-mount');
                if (listMount) {
                    listMount.innerHTML = renderCommentsList(freshComments, post.author.id);
                    initCommentListeners(listMount, freshComments, post.author.id, handleCommentAction);
                }
                
                // Sync feed card comments count labels
                post.comment_count = Math.max(0, post.comment_count - 1);
                const feedCard = document.querySelector(`.post-card-element[data-post-id="${postId}"]`);
                if (feedCard) {
                    const toggleBtn = feedCard.querySelector('.card-comments-toggle');
                    if (toggleBtn && !post.comments_disabled) {
                        if (post.comment_count > 0) {
                            toggleBtn.innerText = `View all ${post.comment_count} comments`;
                        } else {
                            toggleBtn.innerText = `Add a comment`;
                        }
                    }
                }
                if (onFeedUpdate) onFeedUpdate('comment', post);
            }
        };

        // Initialize comment listeners initially
        const listMount = modal.querySelector('#modal-comments-list-mount');
        if (listMount) {
            initCommentListeners(listMount, comments, post.author.id, handleCommentAction);
        }

    } catch (err) {
        modal.innerHTML = `
            <div class="modal-backdrop btn-close-modal"></div>
            <div class="modal-content" style="max-width: 480px; padding: var(--space-6); text-align: center;">
                <div style="color: var(--color-error); font-weight: 700; margin-bottom: var(--space-2);">Error Loading Post</div>
                <div style="color: var(--color-text-muted); font-size: var(--text-sm); margin-bottom: var(--space-4);">${err.message || 'Post was deleted or is private.'}</div>
                <button class="btn btn-secondary btn-close-modal">Close</button>
            </div>
        `;
        modal.querySelector('.btn-close-modal').addEventListener('click', closeModal);
    }
}

/**
 * Visual Post Creator Module
 */
export const PostModal = {
    showCreate() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        const modal = document.createElement('div');
        modal.className = 'modal modal-open';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content post-create-modal" style="max-width: 540px; width: 95%; padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4);">
                
                <div class="modal-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3); display: flex; align-items: center; justify-content: space-between;">
                    <h3 class="modal-title" style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 700;">Create New Post</h3>
                    <button class="btn btn-icon btn-close-modal">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div style="display: flex; flex-direction: column; gap: var(--space-4);">
                    <!-- Upload Dropzone -->
                    <div id="post-image-dropzone" style="border: 2px dashed var(--color-border); border-radius: var(--radius-md); padding: var(--space-6); text-align: center; cursor: pointer; transition: all var(--transition-fast); position: relative; min-height: 180px; display: flex; align-items: center; justify-content: center;">
                        <input type="file" id="post-image-input" accept="image/*" style="display: none;">
                        
                        <div id="dropzone-placeholder" style="display: flex; flex-direction: column; align-items: center; color: var(--color-text-muted);">
                            <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="width: 32px; height: 32px; margin-bottom: var(--space-2);"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"></path></svg>
                            <span style="font-size: var(--text-sm); font-weight: 500;">Click or drag to upload an image</span>
                            <span style="font-size: 10px; color: var(--color-text-muted); margin-top: 4px;">Supports PNG, JPG, WebP. Resized & compressed automatically.</span>
                        </div>
                        
                        <img id="dropzone-preview" style="display: none; width: 100%; max-height: 300px; object-fit: contain; border-radius: var(--radius-sm);">
                        
                        <button class="btn btn-icon btn-danger btn-remove-preview" style="display: none; position: absolute; top: var(--space-2); right: var(--space-2); padding: 4px; border-radius: var(--radius-full); background: rgba(239, 68, 68, 0.8); color: #fff; border: none;">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <!-- Caption Input -->
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label for="post-caption-textarea" style="font-size: var(--text-xs); font-weight: 600; color: var(--color-text-secondary);">Caption</label>
                        <textarea id="post-caption-textarea" class="input" style="min-height: 90px; resize: vertical;" placeholder="What's on your mind? Tag #hashtags or @people..."></textarea>
                    </div>

                    <!-- Comments Setting Toggle -->
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border);">
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span style="font-size: var(--text-sm); font-weight: 600; color: var(--color-text-primary);">Disable Comments</span>
                            <span style="font-size: 10px; color: var(--color-text-muted);">Prevent other users from commenting on this post.</span>
                        </div>
                        <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 24px;">
                            <input type="checkbox" id="post-comments-toggle-switch" style="opacity: 0; width: 0; height: 0;">
                            <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--color-border); transition: .4s; border-radius: 34px;"></span>
                        </label>
                    </div>

                    <!-- Submit Actions -->
                    <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-2);">
                        <button class="btn btn-secondary btn-close-modal">Cancel</button>
                        <button class="btn btn-primary" id="btn-submit-new-post" style="padding-left: var(--space-6); padding-right: var(--space-6);">Share Post</button>
                    </div>
                </div>

            </div>
        `;

        modalContainer.appendChild(modal);

        // Switch custom styling for checkbox slider toggle
        const sliderStyle = document.createElement('style');
        sliderStyle.innerHTML = `
            .switch input:checked + .slider {
                background: var(--color-brand-gradient);
            }
            .switch .slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            .switch input:checked + .slider:before {
                transform: translateX(20px);
            }
        `;
        document.head.appendChild(sliderStyle);

        const closeModal = () => {
            modal.classList.remove('modal-open');
            setTimeout(() => {
                modal.remove();
                sliderStyle.remove();
            }, 200);
        };

        modal.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', closeModal));
        modal.querySelector('.btn-secondary').addEventListener('click', closeModal);

        const dropzone = modal.querySelector('#post-image-dropzone');
        const fileInput = modal.querySelector('#post-image-input');
        const placeholder = modal.querySelector('#dropzone-placeholder');
        const preview = modal.querySelector('#dropzone-preview');
        const removePreviewBtn = modal.querySelector('.btn-remove-preview');

        // Trigger input file pick
        dropzone.addEventListener('click', (e) => {
            if (e.target !== removePreviewBtn && !removePreviewBtn.contains(e.target)) {
                fileInput.click();
            }
        });

        // Dropzone drag/drop overrides
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-brand-primary)';
            dropzone.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--color-border)';
            dropzone.style.backgroundColor = 'transparent';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-border)';
            dropzone.style.backgroundColor = 'transparent';
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                handleFileSelect(fileInput.files[0]);
            }
        });

        const handleFileSelect = (file) => {
            if (!file.type.startsWith('image/')) {
                showToast('Please select a valid image file.', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                removePreviewBtn.style.display = 'block';
                dropzone.style.borderStyle = 'solid';
            };
            reader.readAsDataURL(file);
        };

        // Remove image selection
        removePreviewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.value = '';
            preview.src = '';
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            removePreviewBtn.style.display = 'none';
            dropzone.style.borderStyle = 'dashed';
        });

        // Post creation submit click
        const submitBtn = modal.querySelector('#btn-submit-new-post');
        const captionTextarea = modal.querySelector('#post-caption-textarea');
        const commentsToggle = modal.querySelector('#post-comments-toggle-switch');

        submitBtn.addEventListener('click', async () => {
            const caption = captionTextarea.value.trim();
            const disableComments = commentsToggle.checked;
            const hasFile = fileInput.files && fileInput.files.length > 0;

            // Validation: must have caption OR image
            if (!caption && !hasFile) {
                showToast('Post must have either a caption or an image.', 'error');
                return;
            }

            submitBtn.innerText = 'Sharing...';
            submitBtn.disabled = true;

            const formData = new FormData();
            if (caption) formData.append('caption', caption);
            formData.append('comments_disabled', disableComments);
            if (hasFile) {
                formData.append('image', fileInput.files[0]);
            }

            try {
                await apiCall('/api/v1/posts/', 'POST', formData);
                closeModal();
                showToast('Post shared successfully!', 'success');
                
                // Reload current view to show new post
                if (window.location.pathname === '/') {
                    navigateTo('/'); // re-render feed
                } else {
                    navigateTo('/'); // redirect to feed
                }
            } catch (err) {
                submitBtn.innerText = 'Share Post';
                submitBtn.disabled = false;
                console.error(err);
            }
        });
    }
};
