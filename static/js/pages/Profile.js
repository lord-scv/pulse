/**
 * Profile Page Module
 * Controls User Profiles, follower listings, public/private account checks,
 * profile edit modals, and account deletion Danger Zones.
 */

import { apiCall } from '../api.js';
import { getState, updateSessionUser, clearSession } from '../state.js';
import { navigateTo } from '../state.js';
import { showToast } from '../components/Toast.js';
import { openPostDetailModal } from '../components/PostModal.js';

// Local cache
let profileUser = null;
let profilePosts = [];

export const ProfilePage = {
    async render(params) {
        const username = params.username;
        const state = getState();

        return `
            <div class="profile-container" id="profile-page-mount-zone">
                <div style="padding: var(--space-12); text-align: center; color: var(--color-text-muted);">Loading profile...</div>
            </div>
        `;
    },

    async init(params) {
        const username = params.username;
        await refreshProfile(username);
    }
};

/**
 * Fetch profile data and posts, then render the view
 */
async function refreshProfile(username) {
    const container = document.getElementById('profile-page-mount-zone');
    if (!container) return;

    try {
        // Fetch profile user details
        profileUser = await apiCall(`/api/v1/users/${username}/`, 'GET', null, false);
        
        // Check if we can view posts
        const state = getState();
        const canViewPosts = !profileUser.is_private || profileUser.is_self || profileUser.is_following;

        profilePosts = [];
        let postsErrorHtml = '';

        if (canViewPosts) {
            try {
                const response = await apiCall(`/api/v1/users/${username}/posts/`, 'GET', null, false);
                profilePosts = response.results || [];
            } catch (err) {
                console.error(err);
                postsErrorHtml = `<div style="text-align: center; color: var(--color-text-muted); font-size: var(--text-sm);">Failed to load posts.</div>`;
            }
        }

        // Render HTML
        container.innerHTML = renderProfileHeader(profileUser) + renderProfileContent(profileUser, canViewPosts, postsErrorHtml);
        
        // Initialize listeners
        initProfileHeaderListeners(profileUser);
        if (canViewPosts) {
            initProfileGridListeners();
        }

    } catch (err) {
        container.innerHTML = `
            <div class="profile-empty-state" style="border-color: var(--color-error); background: rgba(239,68,68,0.02); max-width: 600px; margin: var(--space-12) auto;">
                <h3 class="profile-empty-title" style="color: var(--color-error);">User Not Found</h3>
                <p class="profile-empty-desc">The user @${escapeHtml(username)} does not exist or has deleted their account.</p>
                <button class="btn btn-primary" onclick="window.history.back()">Go Back</button>
            </div>
        `;
    }
}

/**
 * Render Header details
 */
function renderProfileHeader(user) {
    const state = getState();
    const photo = user.profile_photo ? user.profile_photo : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';
    
    // Action button logic: Edit Profile vs Follow vs Unfollow
    let actionBtnHtml = '';
    if (user.is_self) {
        actionBtnHtml = `
            <button class="btn btn-secondary btn-sm" id="btn-edit-profile-trigger">Edit Profile</button>
        `;
    } else {
        if (user.is_following) {
            actionBtnHtml = `
                <button class="btn btn-secondary btn-sm" id="btn-follow-toggle-trigger" data-username="${user.username}" data-status="ACTIVE">Following</button>
            `;
        } else if (user.is_following_pending) {
            actionBtnHtml = `
                <button class="btn btn-primary btn-sm btn-disabled" id="btn-follow-toggle-trigger" data-username="${user.username}" data-status="PENDING" style="opacity: 0.7;">Requested</button>
            `;
        } else {
            actionBtnHtml = `
                <button class="btn btn-primary btn-sm" id="btn-follow-toggle-trigger" data-username="${user.username}" data-status="NONE">Follow</button>
            `;
        }
    }

    const verifiedBadge = user.is_verified_email 
        ? `<span style="color: var(--color-brand-primary); font-size: 14px;" title="Verified Creator">⚡</span>`
        : '';
        
    const privateBadge = user.is_private
        ? `<span class="profile-badge profile-badge-private">Private</span>`
        : '';

    const websiteHtml = user.website 
        ? `<a href="${escapeHtml(user.website)}" target="_blank" class="profile-website" rel="noopener noreferrer">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244m6.562-7.843L11.3 12.3"></path></svg>
            ${escapeHtml(user.website.replace(/^https?:\/\/(www\.)?/, ''))}
           </a>`
        : '';

    return `
        <header class="profile-header-card">
            <div class="profile-avatar-wrapper">
                <img src="${photo}" alt="${user.display_name}" class="avatar">
            </div>
            
            <div class="profile-info">
                <div class="profile-meta-row">
                    <div class="profile-identity">
                        <h1 class="profile-display-name">
                            ${escapeHtml(user.display_name)}
                            ${verifiedBadge}
                            ${privateBadge}
                        </h1>
                        <span class="profile-username">@${escapeHtml(user.username)}</span>
                    </div>
                    <div class="profile-actions">
                        ${actionBtnHtml}
                    </div>
                </div>

                <div class="profile-stats-row">
                    <div class="profile-stat-item" style="cursor: default;">
                        <span class="profile-stat-number">${user.posts_count}</span>
                        <span class="profile-stat-label">posts</span>
                    </div>
                    <div class="profile-stat-item" id="btn-show-followers">
                        <span class="profile-stat-number">${user.followers_count}</span>
                        <span class="profile-stat-label">followers</span>
                    </div>
                    <div class="profile-stat-item" id="btn-show-following">
                        <span class="profile-stat-number">${user.following_count}</span>
                        <span class="profile-stat-label">following</span>
                    </div>
                </div>

                <div class="profile-bio-container">
                    <p class="profile-bio-text">${escapeHtml(user.bio || 'No bio yet.')}</p>
                    ${websiteHtml}
                </div>
            </div>
        </header>
    `;
}

/**
 * Render main posts area / padlock panels if private
 */
function renderProfileContent(user, canView, postsErrorHtml) {
    if (!canView) {
        return `
            <div class="profile-empty-state" style="margin-top: var(--space-4);">
                <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="profile-empty-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"></path></svg>
                <h3 class="profile-empty-title">This Account is Private</h3>
                <p class="profile-empty-desc">Follow @${escapeHtml(user.username)} to see their posts and conversations.</p>
            </div>
        `;
    }

    if (postsErrorHtml) return postsErrorHtml;

    if (profilePosts.length === 0) {
        return `
            <div class="profile-empty-state" style="margin-top: var(--space-4);">
                <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="profile-empty-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <h3 class="profile-empty-title">No Posts Yet</h3>
                <p class="profile-empty-desc">When they share visual moments or text comments, they will appear here.</p>
            </div>
        `;
    }

    // Grid listing of posts
    const gridItems = profilePosts.map(post => {
        const imageSrc = post.image 
            ? post.image 
            : 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org/2000%2Fsvg%22 viewBox%3D%220 0 100 100%22%3E%3Crect width%3D%22100%25%22 height%3D%22100%25%22 fill%3D%22%23202024%22%2F%3E%3Ctext x%3D%2250%25%22 y%3D%2250%25%22 dominant-baseline%3D%22middle%22 text-anchor%3D%22middle%22 fill%3D%22%2371717a%22 font-size%3D%2210%22%3EText Post%3C%2Ftext%3E%3C%2Fsvg%3E';
            
        return `
            <div class="profile-grid-item" data-post-id="${post.id}">
                <img src="${imageSrc}" alt="Thumbnail" class="profile-grid-img" loading="lazy">
                <div class="profile-grid-overlay">
                    <div class="profile-grid-stat">
                        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"></path></svg>
                        <span>${post.like_count}</span>
                    </div>
                    <div class="profile-grid-stat">
                        <svg fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M4.804 21.644A10.705 10.705 0 0012 22.5c2.784 0 5.34-.8 7.5-2.177 2.16 1.378 4.716 2.177 7.5 2.177a10.705 10.705 0 007.196-.856.75.75 0 00.18-1.229L22.9 17.65a9 9 0 10-21.8 0L.92 20.415a.75.75 0 00.18 1.229zm4.721-6.177l4.135-1.152a.75.75 0 00-.404-1.444l-4.135 1.152a.75.75 0 00.404 1.444z" clip-rule="evenodd"></path></svg>
                        <span>${post.comment_count}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="profile-tabs-nav" style="margin-top: var(--space-4);">
            <button class="profile-tab-btn active">Posts</button>
        </div>
        <div class="profile-grid" style="margin-top: var(--space-4);">
            ${gridItems}
        </div>
    `;
}

/**
 * Initialize listeners on header action triggers
 */
function initProfileHeaderListeners(user) {
    // Followers Listing
    const followersBtn = document.getElementById('btn-show-followers');
    if (followersBtn) {
        followersBtn.addEventListener('click', () => openFollowListModal(user.username, 'followers'));
    }

    // Following Listing
    const followingBtn = document.getElementById('btn-show-following');
    if (followingBtn) {
        followingBtn.addEventListener('click', () => openFollowListModal(user.username, 'following'));
    }

    // Follow / Unfollow Toggles
    const followToggleBtn = document.getElementById('btn-follow-toggle-trigger');
    if (followToggleBtn) {
        followToggleBtn.addEventListener('click', async () => {
            const status = followToggleBtn.dataset.status;
            const targetUsername = followToggleBtn.dataset.username;
            
            try {
                if (status === 'ACTIVE' || status === 'PENDING') {
                    // Unfollow
                    if (!confirm(`Unfollow @${targetUsername}?`)) return;
                    await apiCall(`/api/v1/users/${targetUsername}/follow/`, 'DELETE');
                    showToast(`Unfollowed @${targetUsername}.`, 'success');
                } else {
                    // Follow
                    const response = await apiCall(`/api/v1/users/${targetUsername}/follow/`, 'POST');
                    showToast(response.status === 'PENDING' ? 'Follow request sent.' : `Now following @${targetUsername}`, 'success');
                }
                
                // Refresh layout
                await refreshProfile(user.username);
            } catch (err) {
                console.error(err);
            }
        });
    }

    // Edit Profile Modal
    const editBtn = document.getElementById('btn-edit-profile-trigger');
    if (editBtn) {
        editBtn.addEventListener('click', () => openEditProfileModal(user));
    }
}

/**
 * Initialize listeners on posts grid
 */
function initProfileGridListeners() {
    const gridItems = document.querySelectorAll('.profile-grid-item');
    gridItems.forEach(item => {
        item.addEventListener('click', () => {
            const postId = item.dataset.postId;
            openPostDetailModal(postId, (action, data) => {
                if (action === 'delete') {
                    refreshProfile(profileUser.username);
                } else {
                    // update counts
                    const index = profilePosts.findIndex(p => p.id === data.id);
                    if (index !== -1) {
                        profilePosts[index] = data;
                        refreshProfile(profileUser.username);
                    }
                }
            });
        });
    });
}

/**
 * Open followers / following lists modal overlay
 */
async function openFollowListModal(username, type) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const modal = document.createElement('div');
    modal.className = 'modal modal-open';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content" style="max-width: 400px; padding: var(--space-6); max-height: 80vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="margin-bottom: var(--space-4); flex-shrink: 0;">
                <h3 class="modal-title" style="text-transform: capitalize;">${type}</h3>
                <button class="btn btn-icon btn-close-modal">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div id="follow-list-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3);">
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
        const response = await apiCall(`/api/v1/users/${username}/${type}/`, 'GET', null, false);
        const users = response.results || response;
        const listEl = modal.querySelector('#follow-list-container');

        if (users.length === 0) {
            listEl.innerHTML = `<div style="padding: var(--space-6); text-align: center; color: var(--color-text-muted);">No users found.</div>`;
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
            el.addEventListener('click', () => {
                closeModal();
            });
        });
    } catch (err) {
        console.error(err);
    }
}

/**
 * Open Settings and Edit Profile Modal (including Danger Zone Deletion)
 */
function openEditProfileModal(user) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const photo = user.profile_photo ? user.profile_photo : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';

    const modal = document.createElement('div');
    modal.className = 'modal modal-open';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content" style="max-width: 500px; padding: var(--space-6); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;">
            <div class="modal-header" style="margin-bottom: var(--space-4); flex-shrink: 0; border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);">
                <h3 class="modal-title">Edit Profile Settings</h3>
                <button class="btn btn-icon btn-close-modal">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            
            <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); padding-right: 4px;">
                <!-- Profile Image Edit -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-2);">
                    <div class="avatar-upload-preview-wrapper" id="edit-avatar-trigger" style="width: 90px; height: 90px;">
                        <input type="file" id="edit-avatar-input" accept="image/*" style="display: none;">
                        <img src="${photo}" id="edit-avatar-preview" class="avatar-upload-preview">
                    </div>
                    <span style="font-size: 10px; color: var(--color-text-muted);">Click avatar to change</span>
                </div>

                <form class="auth-form" id="edit-profile-form">
                    <div class="input-group">
                        <label class="input-label" for="edit-display-name">Display Name</label>
                        <input type="text" id="edit-display-name" class="input" value="${escapeHtml(user.display_name)}" required>
                    </div>
                    
                    <div class="input-group">
                        <label class="input-label" for="edit-username">Username</label>
                        <input type="text" id="edit-username" class="input" value="${escapeHtml(user.username)}" required>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="edit-bio">Short Bio</label>
                        <textarea id="edit-bio" class="input" style="min-height: 60px; resize: vertical;">${escapeHtml(user.bio || '')}</textarea>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="edit-website">Website</label>
                        <input type="url" id="edit-website" class="input" value="${escapeHtml(user.website || '')}">
                    </div>

                    <!-- Email change requires confirm password -->
                    <div class="input-group" style="border: 1px solid var(--color-border); padding: var(--space-3); border-radius: var(--radius-md); background: rgba(255,255,255,0.01);">
                        <label class="input-label" for="edit-email">Email Address</label>
                        <input type="email" id="edit-email" class="input" value="${escapeHtml(user.email)}" required style="margin-bottom: var(--space-2);">
                        
                        <label class="input-label" for="edit-password-confirm" style="font-size: 10px; color: var(--color-text-muted);">Enter password to confirm email changes</label>
                        <input type="password" id="edit-password-confirm" class="input" placeholder="••••••••" style="background-color: var(--color-bg-base);">
                    </div>

                    <!-- Private Account switch toggle -->
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) 0;">
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span style="font-size: var(--text-sm); font-weight: 600; color: var(--color-text-primary);">Private Profile</span>
                            <span style="font-size: 10px; color: var(--color-text-muted);">Restricts followers from viewing posts without approval.</span>
                        </div>
                        <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 24px;">
                            <input type="checkbox" id="edit-private-toggle" ${user.is_private ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                            <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--color-border); transition: .4s; border-radius: 34px;"></span>
                        </label>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 700; margin-top: var(--space-2);">Save Profile Settings</button>
                </form>

                <!-- DANGER ZONE: Account deletion -->
                <div class="card danger-zone-card" style="padding: var(--space-4); border-radius: var(--radius-lg); margin-top: var(--space-4); position: relative; overflow: hidden;">
                    <div class="danger-zone-title">Danger Zone</div>
                    <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-bottom: var(--space-3); line-height: 1.4;">Permanently delete your account. This action is irreversible and all your posts and relationships will be wiped.</p>
                    
                    <div style="display: flex; flex-direction: column; gap: var(--space-2);">
                        <label for="delete-username-confirmation" style="font-size: 10px; color: var(--color-text-muted); font-weight: 600;">Type your username <strong style="color: var(--color-error);">@${user.username}</strong> to confirm:</label>
                        <input type="text" id="delete-username-confirmation" class="input" placeholder="Enter username..." style="background-color: var(--color-bg-base); border-color: rgba(239, 68, 68, 0.2);">
                        <button class="btn btn-primary" id="btn-delete-account-submit" style="background: var(--color-error); border: none; font-weight: 700;">Delete Account</button>
                    </div>
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

    const editForm = modal.querySelector('#edit-profile-form');
    const avatarInput = modal.querySelector('#edit-avatar-input');
    const avatarPreview = modal.querySelector('#edit-avatar-preview');
    const avatarTrigger = modal.querySelector('#edit-avatar-trigger');

    if (avatarTrigger && avatarInput) {
        avatarTrigger.addEventListener('click', () => avatarInput.click());
    }

    if (avatarInput) {
        avatarInput.addEventListener('change', () => {
            if (avatarInput.files && avatarInput.files.length > 0) {
                const file = avatarInput.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    avatarPreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle Edit form submission
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const displayName = editForm.querySelector('#edit-display-name').value.trim();
            const editUsername = editForm.querySelector('#edit-username').value.trim();
            const bio = editForm.querySelector('#edit-bio').value.trim();
            const website = editForm.querySelector('#edit-website').value.trim();
            const email = editForm.querySelector('#edit-email').value.trim();
            const passConfirm = editForm.querySelector('#edit-password-confirm').value;
            const isPrivate = editForm.querySelector('#edit-private-toggle').checked;

            const submitBtn = editForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Saving...';
            submitBtn.disabled = true;

            const formData = new FormData();
            formData.append('display_name', displayName);
            formData.append('username', editUsername);
            formData.append('bio', bio);
            formData.append('website', website);
            formData.append('is_private', isPrivate);
            
            if (email !== user.email) {
                formData.append('email', email);
                formData.append('password', passConfirm);
            }

            if (avatarInput.files && avatarInput.files.length > 0) {
                formData.append('profile_photo', avatarInput.files[0]);
            }

            try {
                const updated = await apiCall('/api/v1/users/me/', 'PATCH', formData);
                
                // Update local states
                updateSessionUser({
                    username: updated.username,
                    display_name: updated.display_name,
                    profile_photo: updated.profile_photo,
                    bio: updated.bio,
                    website: updated.website,
                    is_private: updated.is_private
                });

                closeModal();
                showToast('Profile settings saved successfully!', 'success');
                
                // Refresh profile page view
                navigateTo(`/@${updated.username}`);
            } catch (err) {
                submitBtn.innerText = 'Save Profile Settings';
                submitBtn.disabled = false;
                console.error(err);
            }
        });
    }

    // Danger Zone Deletion trigger
    const deleteBtn = modal.querySelector('#btn-delete-account-submit');
    const deleteConfirmInput = modal.querySelector('#delete-username-confirmation');

    if (deleteBtn && deleteConfirmInput) {
        deleteBtn.addEventListener('click', async () => {
            const confirmVal = deleteConfirmInput.value.trim();
            if (confirmVal !== user.username) {
                showToast('Verification username does not match.', 'error');
                return;
            }

            if (!confirm('WARNING: Are you absolutely sure you want to delete your account? This is irreversible.')) {
                return;
            }

            deleteBtn.innerText = 'Deleting Account...';
            deleteBtn.disabled = true;

            try {
                await apiCall('/api/v1/users/me/', 'DELETE', { username_confirm: confirmVal });
                
                closeModal();
                clearSession();
                navigateTo('/auth');
                showToast('Your account was successfully deleted.', 'success');
            } catch (err) {
                deleteBtn.innerText = 'Delete Account';
                deleteBtn.disabled = false;
                console.error(err);
            }
        });
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
