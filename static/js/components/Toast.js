/**
 * Toast Component
 * Spawns toast notifications in the global toast container.
 */

export function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Get SVG icon based on type
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else {
        iconSvg = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }

    toast.innerHTML = `
        ${iconSvg}
        <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    // Trigger sliding animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Auto dismiss
    const dismissTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
