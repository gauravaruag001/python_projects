/**
 * API utility module.
 * 
 * This module handles all communication with the proxy server.
 * It provides reusable functions for searching companies, officers, 
 * and retrieving appointments.
 */

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Common fetch wrapper for API calls.
 * 
 * @param {string} endpoint - The API endpoint to call.
 * @param {string} apiKey - The user's Companies House API key.
 * @returns {Promise<Object>} - The JSON response from the API.
 * @throws {Error} - If the API request fails or returns an error.
 */
async function apiFetch(endpoint, apiKey) {
    if (!apiKey) {
        throw new Error('API key is required for all requests.');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
        }
    });

    const data = await response.json();

    if (!response.ok) {
        // Handle standard API errors
        if (response.status === 401) {
            throw new Error('Invalid API key. Please check your settings.');
        }
        throw new Error(data.error || `API error: ${response.status}`);
    }

    return data;
}

/**
 * Search for companies by name or number.
 */
export async function searchCompanies(query, itemsPerPage = 20, startIndex = 0, apiKey) {
    const endpoint = `/search/companies?q=${encodeURIComponent(query)}&items_per_page=${itemsPerPage}&start_index=${startIndex}`;
    return apiFetch(endpoint, apiKey);
}

/**
 * Search for officers (people) by name.
 */
export async function searchOfficers(query, itemsPerPage = 20, startIndex = 0, apiKey) {
    const endpoint = `/search/officers?q=${encodeURIComponent(query)}&items_per_page=${itemsPerPage}&start_index=${startIndex}`;
    return apiFetch(endpoint, apiKey);
}

/**
 * Retrieve officers for a specific company.
 */
export async function getCompanyOfficers(companyNumber, itemsPerPage = 100, startIndex = 0, apiKey) {
    const endpoint = `/company/${companyNumber}/officers?items_per_page=${itemsPerPage}&start_index=${startIndex}`;
    return apiFetch(endpoint, apiKey);
}

/**
 * Retrieve a full company profile.
 */
export async function getCompanyProfile(companyNumber, apiKey) {
    return apiFetch(`/company/${companyNumber}`, apiKey);
}

/**
 * Retrieve persons with significant control for a specific company.
 */
export async function getCompanyPSCs(companyNumber, itemsPerPage = 100, startIndex = 0, apiKey) {
    const endpoint = `/company/${companyNumber}/persons-with-significant-control?items_per_page=${itemsPerPage}&start_index=${startIndex}`;
    return apiFetch(endpoint, apiKey);
}

/**
 * Retrieve filing history for a specific company.
 */
export async function getFilingHistory(companyNumber, itemsPerPage = 100, startIndex = 0, apiKey) {
    const endpoint = `/company/${companyNumber}/filing-history?items_per_page=${itemsPerPage}&start_index=${startIndex}`;
    return apiFetch(endpoint, apiKey);
}

/**
 * Retrieve charges (mortgages) for a specific company.
 */
export async function getCompanyCharges(companyNumber, itemsPerPage = 100, startIndex = 0, apiKey) {
    const endpoint = `/company/${companyNumber}/charges?items_per_page=${itemsPerPage}&start_index=${startIndex}`;
    return apiFetch(endpoint, apiKey);
}
/**
 * Retrieve all company appointments for a specific officer.
 */
export async function getOfficerAppointments(officerId, itemsPerPage = 100, startIndex = 0, apiKey) {
    const endpoint = `/officers/${officerId}/appointments?items_per_page=${itemsPerPage}&start_index=${startIndex}`;
    return apiFetch(endpoint, apiKey);
}
