/**
 * Auth Page Module
 * Controls User Login, Registration, Password Reset, and the Step-by-Step Onboarding Wizard.
 */

import { apiCall } from '../api.js';
import { getState, setSessionUser, navigateTo } from '../state.js';
import { showToast } from '../components/Toast.js';

// Local view state
let currentView = 'login'; // 'login' | 'register' | 'forgot' | 'onboard_profile' | 'onboard_bio' | 'onboard_suggested'
let onboardingUserId = null;

export const AuthPage = {
    async render() {
        const state = getState();
        if (state.user && !currentView.startsWith('onboard')) {
            // Safe guard redirection
            setTimeout(() => navigateTo('/'), 0);
            return '';
        }

        let content = '';

        if (currentView === 'login') {
            content = renderLoginForm();
        } else if (currentView === 'register') {
            content = renderRegisterForm();
        } else if (currentView === 'forgot') {
            content = renderForgotForm();
        } else if (currentView === 'onboard_profile') {
            content = renderOnboardProfileForm();
        } else if (currentView === 'onboard_bio') {
            content = renderOnboardBioForm();
        } else if (currentView === 'onboard_suggested') {
            content = await renderOnboardSuggestedForm();
        }

        return `
            <div class="auth-wrapper">
                <div class="auth-card">
                    ${content}
                </div>
            </div>
        `;
    },

    async init() {
        if (currentView === 'login') {
            initLoginListeners();
        } else if (currentView === 'register') {
            initRegisterListeners();
        } else if (currentView === 'forgot') {
            initForgotListeners();
        } else if (currentView === 'onboard_profile') {
            initOnboardProfileListeners();
        } else if (currentView === 'onboard_bio') {
            initOnboardBioListeners();
        } else if (currentView === 'onboard_suggested') {
            initOnboardSuggestedListeners();
        }
    }
};

// --- LOGIN VIEW ---
function renderLoginForm() {
    return `
        <div class="auth-header">
            <h1 class="auth-logo">⚡ PULSE</h1>
            <p class="auth-subtitle">Welcome back. Enter your credentials to access feed.</p>
        </div>
        <form class="auth-form" id="login-form">
            <div class="input-group">
                <label class="input-label" for="login-username">Username or Email</label>
                <input type="text" id="login-username" class="input" placeholder="e.g., alex_pulse or alex@example.com" required>
            </div>
            <div class="input-group">
                <label class="input-label" for="login-password">Password</label>
                <input type="password" id="login-password" class="input" placeholder="••••••••" required>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin: var(--space-1) 0;">
                <label style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); cursor: pointer; color: var(--color-text-secondary);">
                    <input type="checkbox" id="login-remember-me" style="accent-color: var(--color-brand-primary);">
                    Remember me
                </label>
                <button type="button" class="btn btn-text" id="btn-goto-forgot" style="font-size: var(--text-sm); color: var(--color-brand-primary); padding: 0;">Forgot Password?</button>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 700;">Sign In</button>
        </form>
        <div class="auth-footer">
            Don't have an account? <button class="btn btn-text auth-footer-link" id="btn-goto-signup">Sign Up</button>
        </div>
    `;
}

function initLoginListeners() {
    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const rememberMe = document.getElementById('login-remember-me').checked;

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Signing In...';
            submitBtn.disabled = true;

            try {
                const user = await apiCall('/api/v1/auth/login/', 'POST', { username, password, remember_me: rememberMe });
                setSessionUser(user);
                showToast(`Welcome back, ${user.display_name}!`, 'success');
                navigateTo('/');
            } catch (err) {
                submitBtn.innerText = 'Sign In';
                submitBtn.disabled = false;
            }
        });
    }

    document.getElementById('btn-goto-signup').addEventListener('click', () => {
        currentView = 'register';
        AuthPage.render().then(html => {
            document.querySelector('.auth-wrapper').parentElement.innerHTML = html;
            AuthPage.init();
        });
    });

    document.getElementById('btn-goto-forgot').addEventListener('click', () => {
        currentView = 'forgot';
        AuthPage.render().then(html => {
            document.querySelector('.auth-wrapper').parentElement.innerHTML = html;
            AuthPage.init();
        });
    });
}

// --- REGISTER VIEW ---
function renderRegisterForm() {
    return `
        <div class="auth-header">
            <h1 class="auth-logo">⚡ PULSE</h1>
            <p class="auth-subtitle">Create your account to start conversations.</p>
        </div>
        <form class="auth-form" id="register-form">
            <div class="input-group">
                <label class="input-label" for="reg-username">Username</label>
                <div style="position: relative;">
                    <input type="text" id="reg-username" class="input" placeholder="e.g., sam_wise" minlength="3" maxlength="20" required>
                    <span id="username-status-badge" style="position: absolute; right: var(--space-3); top: 50%; transform: translateY(-50%); font-size: var(--text-xs); font-weight: 700; pointer-events: none;"></span>
                </div>
            </div>
            <div class="input-group">
                <label class="input-label" for="reg-email">Email Address</label>
                <input type="email" id="reg-email" class="input" placeholder="e.g., sam@example.com" required>
            </div>
            <div class="input-group">
                <label class="input-label" for="reg-password">Password</label>
                <input type="password" id="reg-password" class="input" placeholder="Minimum 8 characters" minlength="8" required>
            </div>
            <div class="input-group">
                <label class="input-label" for="reg-confirm-password">Confirm Password</label>
                <input type="password" id="reg-confirm-password" class="input" placeholder="••••••••" required>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 700;">Sign Up</button>
        </form>
        <div class="auth-footer">
            Already have an account? <button class="btn btn-text auth-footer-link" id="btn-goto-signin">Sign In</button>
        </div>
    `;
}

function initRegisterListeners() {
    const form = document.getElementById('register-form');
    const usernameInput = document.getElementById('reg-username');
    const statusBadge = document.getElementById('username-status-badge');

    // Debounce Username availability check
    let debounceTimer;
    if (usernameInput && statusBadge) {
        usernameInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const val = usernameInput.value.trim();
            statusBadge.innerText = '';
            usernameInput.setCustomValidity(''); // Clear custom validation on user input
            
            if (val.length < 3) return;

            debounceTimer = setTimeout(async () => {
                try {
                    const response = await apiCall(`/api/v1/auth/check-username/?username=${encodeURIComponent(val)}`, 'GET', null, false);
                    if (response.available) {
                        statusBadge.innerText = '✓';
                        statusBadge.style.color = 'var(--color-success)';
                        usernameInput.setCustomValidity(''); // Valid username
                    } else {
                        statusBadge.innerText = '✗';
                        statusBadge.style.color = 'var(--color-error)';
                        usernameInput.setCustomValidity(response.message || 'Username is not available.'); // Block submission with message
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 400); // 400ms debounce
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = usernameInput.value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;

            if (password !== confirmPassword) {
                showToast("Passwords do not match.", "error");
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Creating Account...';
            submitBtn.disabled = true;

            try {
                const user = await apiCall('/api/v1/auth/register/', 'POST', {
                    username,
                    email,
                    password,
                    confirm_password: confirmPassword
                });
                
                setSessionUser(user);
                onboardingUserId = user.id;

                // Move directly to onboarding step 1: Profile picture!
                currentView = 'onboard_profile';
                AuthPage.render().then(html => {
                    document.querySelector('.auth-wrapper').parentElement.innerHTML = html;
                    AuthPage.init();
                });

            } catch (err) {
                submitBtn.innerText = 'Sign Up';
                submitBtn.disabled = false;
            }
        });
    }

    document.getElementById('btn-goto-signin').addEventListener('click', () => {
        currentView = 'login';
        AuthPage.render().then(html => {
            document.querySelector('.auth-wrapper').parentElement.innerHTML = html;
            AuthPage.init();
        });
    });
}

// --- FORGOT PASSWORD VIEW ---
function renderForgotForm() {
    return `
        <div class="auth-header">
            <h1 class="auth-logo">⚡ PULSE</h1>
            <p class="auth-subtitle">Reset your account password.</p>
        </div>
        <form class="auth-form" id="forgot-form">
            <div class="input-group">
                <label class="input-label" for="forgot-email">Email Address</label>
                <input type="email" id="forgot-email" class="input" placeholder="e.g., sam@example.com" required>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 700;">Send Reset Link</button>
        </form>
        <div class="auth-footer">
            Remember your credentials? <button class="btn btn-text auth-footer-link" id="btn-goto-signin-2">Sign In</button>
        </div>
    `;
}

function initForgotListeners() {
    const form = document.getElementById('forgot-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value.trim();

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Sending Link...';
            submitBtn.disabled = true;

            try {
                await apiCall('/api/v1/auth/password/reset/', 'POST', { email });
                showToast('Reset email sent if the account exists.', 'success');
                
                // Return to login
                currentView = 'login';
                AuthPage.render().then(html => {
                    document.querySelector('.auth-wrapper').parentElement.innerHTML = html;
                    AuthPage.init();
                });
            } catch (err) {
                submitBtn.innerText = 'Send Reset Link';
                submitBtn.disabled = false;
            }
        });
    }

    document.getElementById('btn-goto-signin-2').addEventListener('click', () => {
        currentView = 'login';
        AuthPage.render().then(html => {
            document.querySelector('.auth-wrapper').parentElement.innerHTML = html;
            AuthPage.init();
        });
    });
}

// --- ONBOARDING STEP 1: PROFILE PICTURE ---
function renderOnboardProfileForm() {
    return `
        <div class="auth-header">
            <span style="font-size: var(--text-xs); color: var(--color-brand-primary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Step 1 of 3</span>
            <h2 class="auth-logo" style="font-size: var(--text-lg);">Select Profile Photo</h2>
            <p class="auth-subtitle">Add a face to your handle. You can skip this for now.</p>
        </div>
        <div class="onboarding-avatar-select">
            <div class="avatar-upload-preview-wrapper" id="onboard-avatar-dropzone">
                <input type="file" id="onboard-avatar-input" accept="image/*" class="avatar-upload-input">
                <div class="avatar-upload-placeholder" id="onboard-avatar-placeholder">
                    <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"></path></svg>
                    <span>Upload</span>
                </div>
                <img id="onboard-avatar-preview" class="avatar-upload-preview" style="display: none;">
            </div>
            
            <button class="btn btn-primary" id="btn-save-onboard-profile" style="width: 100%; margin-top: var(--space-4); font-weight: 700;">Continue</button>
            <button class="btn btn-text" id="btn-skip-onboard-profile" style="width: 100%; color: var(--color-text-muted); font-size: var(--text-xs);">Skip for now</button>
        </div>
    `;
}

function initOnboardProfileListeners() {
    const dropzone = document.getElementById('onboard-avatar-dropzone');
    const fileInput = document.getElementById('onboard-avatar-input');
    const placeholder = document.getElementById('onboard-avatar-placeholder');
    const preview = document.getElementById('onboard-avatar-preview');
    const skipBtn = document.getElementById('btn-skip-onboard-profile');
    const saveBtn = document.getElementById('btn-save-onboard-profile');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                if (!file.type.startsWith('image/')) {
                    showToast('Please select a valid image.', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                    dropzone.style.border = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const gotoNextStep = () => {
        currentView = 'onboard_bio';
        AuthPage.render().then(html => {
            document.querySelector('.auth-wrapper').parentElement.innerHTML = html;
            AuthPage.init();
        });
    };

    if (skipBtn) {
        skipBtn.addEventListener('click', gotoNextStep);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!fileInput.files || fileInput.files.length === 0) {
                gotoNextStep();
                return;
            }

            saveBtn.innerText = 'Uploading...';
            saveBtn.disabled = true;

            const formData = new FormData();
            formData.append('profile_photo', fileInput.files[0]);

            try {
                // PATCH user profile endpoint (which updates profile photo WebP)
                const updatedUser = await apiCall('/api/v1/users/me/', 'PATCH', formData);
                // Update global state
                const { updateSessionUser } = await import('../state.js');
                updateSessionUser({ profile_photo: updatedUser.profile_photo });
                showToast('Profile photo updated!', 'success');
                gotoNextStep();
            } catch (err) {
                saveBtn.innerText = 'Continue';
                saveBtn.disabled = false;
                console.error(err);
            }
        });
    }
}

// --- ONBOARDING STEP 2: BIO & DETAILS ---
function renderOnboardBioForm() {
    return `
        <div class="auth-header">
            <span style="font-size: var(--text-xs); color: var(--color-brand-primary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Step 2 of 3</span>
            <h2 class="auth-logo" style="font-size: var(--text-lg);">Tell Us About Yourself</h2>
            <p class="auth-subtitle">Describe your interests and share your website link.</p>
        </div>
        <form class="auth-form" id="onboard-bio-form">
            <div class="input-group">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <label class="input-label" for="onboard-bio">Short Bio</label>
                    <span id="bio-char-counter" style="font-size: 10px; color: var(--color-text-muted);">0 / 160</span>
                </div>
                <textarea id="onboard-bio" class="input" style="min-height: 80px; resize: vertical;" maxlength="160" placeholder="e.g., Explorer. Dreamer. Maker of things."></textarea>
            </div>
            
            <div class="input-group">
                <label class="input-label" for="onboard-website">Website Link</label>
                <input type="url" id="onboard-website" class="input" placeholder="e.g., https://myprofile.com">
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 700; margin-top: var(--space-4);">Continue</button>
            <button type="button" class="btn btn-text" id="btn-skip-onboard-bio" style="width: 100%; color: var(--color-text-muted); font-size: var(--text-xs);">Skip this step</button>
        </form>
    `;
}

function initOnboardBioListeners() {
    const form = document.getElementById('onboard-bio-form');
    const skipBtn = document.getElementById('btn-skip-onboard-bio');
    const bioTextarea = document.getElementById('onboard-bio');
    const charCounter = document.getElementById('bio-char-counter');

    if (bioTextarea && charCounter) {
        bioTextarea.addEventListener('input', () => {
            const count = bioTextarea.value.length;
            charCounter.innerText = `${count} / 160`;
        });
    }

    const gotoNextStep = () => {
        currentView = 'onboard_suggested';
        AuthPage.render().then(html => {
            document.querySelector('.auth-wrapper').parentElement.innerHTML = html;
            AuthPage.init();
        });
    };

    if (skipBtn) {
        skipBtn.addEventListener('click', gotoNextStep);
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const bio = bioTextarea.value.trim();
            const website = document.getElementById('onboard-website').value.trim();

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Saving...';
            submitBtn.disabled = true;

            const payload = {};
            if (bio) payload.bio = bio;
            if (website) payload.website = website;

            try {
                if (Object.keys(payload).length > 0) {
                    const updatedUser = await apiCall('/api/v1/users/me/', 'PATCH', payload);
                    const { updateSessionUser } = await import('../state.js');
                    updateSessionUser({ bio: updatedUser.bio, website: updatedUser.website });
                }
                gotoNextStep();
            } catch (err) {
                submitBtn.innerText = 'Continue';
                submitBtn.disabled = false;
                console.error(err);
            }
        });
    }
}

// --- ONBOARDING STEP 3: SUGGESTED FOLLOWS ---
async function renderOnboardSuggestedForm() {
    let suggestedHtml = '';
    
    try {
        const response = await apiCall('/api/v1/users/suggested/', 'GET', null, false);
        const users = response.results || response; // fallback
        
        if (users.length === 0) {
            suggestedHtml = `<div style="text-align: center; padding: var(--space-6); color: var(--color-text-muted); font-size: var(--text-sm);">No creators found. You can add them later!</div>`;
        } else {
            suggestedHtml = users.map(user => {
                const photo = user.profile_photo ? user.profile_photo : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';
                return `
                    <div class="onboarding-suggestion-item">
                        <div class="user-follow-details">
                            <img src="${photo}" class="avatar">
                            <div class="user-follow-names">
                                <span class="user-follow-displayname">${escapeHtml(user.display_name)}</span>
                                <span class="user-follow-username">@${escapeHtml(user.username)}</span>
                            </div>
                        </div>
                        <button class="btn btn-secondary btn-sm btn-onboard-follow" data-username="${user.username}">Follow</button>
                    </div>
                `;
            }).join('');
        }
        
    } catch (e) {
        suggestedHtml = `<div style="text-align: center; padding: var(--space-6); color: var(--color-text-error); font-size: var(--text-sm);">Failed to load recommendations.</div>`;
    }

    return `
        <div class="auth-header">
            <span style="font-size: var(--text-xs); color: var(--color-brand-primary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Step 3 of 3</span>
            <h2 class="auth-logo" style="font-size: var(--text-lg);">Follow Creators</h2>
            <p class="auth-subtitle">Pulse is better together. Follow some interesting accounts.</p>
        </div>
        
        <div class="onboarding-suggestions-container" style="margin-bottom: var(--space-4);">
            ${suggestedHtml}
        </div>
        
        <button class="btn btn-primary" id="btn-finish-onboarding" style="width: 100%; font-weight: 700;">Finish & Go to Feed</button>
    `;
}

function initOnboardSuggestedListeners() {
    const container = document.querySelector('.onboarding-suggestions-container');
    const finishBtn = document.getElementById('btn-finish-onboarding');

    if (container) {
        container.querySelectorAll('.btn-onboard-follow').forEach(btn => {
            btn.addEventListener('click', async () => {
                const username = btn.dataset.username;
                const following = btn.classList.contains('btn-primary'); // primary state means currently following

                try {
                    if (following) {
                        // Unfollow
                        await apiCall(`/api/v1/users/${username}/follow/`, 'DELETE');
                        btn.innerText = 'Follow';
                        btn.className = 'btn btn-secondary btn-sm btn-onboard-follow';
                    } else {
                        // Follow
                        const response = await apiCall(`/api/v1/users/${username}/follow/`, 'POST');
                        btn.innerText = response.status === 'PENDING' ? 'Requested' : 'Following';
                        btn.className = 'btn btn-primary btn-sm btn-onboard-follow';
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        });
    }

    if (finishBtn) {
        finishBtn.addEventListener('click', () => {
            // Completed onboarding, reset wizard view back to login for future lockouts, and navigate to home
            currentView = 'login';
            showToast('Welcome to Pulse! Your feed is ready.', 'success');
            navigateTo('/');
        });
    }
}
