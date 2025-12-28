/**
 * Settings module.
 * 
 * Manages the application's persistent settings, primarily the 
 * Companies House API key using localStorage.
 */

const API_KEY_STORAGE = 'companiesHouseApiKey';

const settingsModal = document.getElementById('settingsModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiStatus = document.getElementById('apiStatus');

/**
 * Get the current API key from local storage.
 */
export function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
}

/**
 * Open the settings modal and populate it with the current key.
 */
export function openSettings() {
    apiKeyInput.value = getApiKey();
    settingsModal.style.display = 'flex';
    clearApiStatus();
}

/**
 * Close the settings modal.
 */
export function closeSettings() {
    settingsModal.style.display = 'none';
}

/**
 * Save the API key provided in the input field.
 */
export function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showApiStatus('Please enter an API key', 'error');
        return null;
    }
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    showApiStatus('API key saved successfully!', 'success');

    // Return the key so the app can update its state
    return apiKey;
}

/**
 * Toggle the visibility of the API key input field.
 */
export function toggleApiKeyVisibility() {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
}

/**
 * Update the status message within the settings modal.
 */
function showApiStatus(message, type) {
    apiStatus.textContent = message;
    apiStatus.className = `api-status ${type}`;
}

/**
 * Clear the status message in the settings modal.
 */
function clearApiStatus() {
    apiStatus.textContent = '';
    apiStatus.className = 'api-status';
}
