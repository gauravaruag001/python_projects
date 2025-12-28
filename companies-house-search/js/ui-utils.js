/**
 * UI Utilities module.
 * 
 * Provides helper functions for common UI tasks like showing/hiding elements,
 * formatting dates, and escaping HTML to prevent XSS.
 */

// Cache frequently used DOM elements
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

/**
 * Show or hide the global loading spinner.
 */
export function showLoading(show) {
    if (loading) loading.style.display = show ? 'block' : 'none';
}

/**
 * Display a global error message.
 */
export function showError(message) {
    if (errorText) errorText.textContent = message;
    if (errorMessage) errorMessage.style.display = 'flex';
}

/**
 * Hide the global error message.
 */
export function hideError() {
    if (errorMessage) errorMessage.style.display = 'none';
}

/**
 * Safely escape HTML characters to prevent XSS.
 */
export function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format an ISO date string into a user-friendly format.
 * Format: 01 January 2024
 */
export function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

/**
 * Scroll to the top of the page smoothly.
 */
export function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
