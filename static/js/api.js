/**
 * API client module for Pulse
 * Wraps fetch requests with automatic CSRF token headers, body serialization, and standardized error handling.
 */

import { showToast } from './components/Toast.js';

/**
 * Utility to extract cookie value by name
 */
export function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * Standard fetch call wrapper with JSON parsing and Toast notifications for failures.
 * 
 * @param {string} url - API Endpoint
 * @param {string} method - HTTP method (GET, POST, PATCH, DELETE, etc.)
 * @param {object|FormData} body - request payload
 * @param {boolean} showToastOnError - Whether to trigger toast alert automatically on errors
 * @returns {Promise<any>} Response json body
 */
export async function apiCall(url, method = 'GET', body = null, showToastOnError = true) {
    const options = {
        method,
        headers: {},
    };

    // Attach body and headers accordingly
    if (body) {
        if (body instanceof FormData) {
            // For files/images: browser automatically appends content-type boundary
            options.body = body;
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    // Append CSRF Token to mutative HTTP methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
        const csrfToken = getCookie('csrftoken');
        if (csrfToken) {
            options.headers['X-CSRFToken'] = csrfToken;
        }
    }

    try {
        const response = await fetch(url, options);
        let data = null;
        
        // Inspect content-type
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        }

        if (!response.ok) {
            // Standard formatting parsing
            const errorMsg = data && data.error ? data.error.message : 'An unexpected error occurred.';
            const errorCode = data && data.error ? data.error.code : 'server_error';
            const errorField = data && data.error ? data.error.field : null;

            if (showToastOnError) {
                showToast(errorMsg, 'error');
            }

            const error = new Error(errorMsg);
            error.code = errorCode;
            error.field = errorField;
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (err) {
        if (showToastOnError && !err.status) {
            showToast('Network error: Unable to connect to server.', 'error');
        }
        throw err;
    }
}
