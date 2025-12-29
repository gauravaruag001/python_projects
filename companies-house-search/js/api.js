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

/**
 * Retrieve document content from the Document API via proxy.
 */
export async function getDocumentContent(documentId, apiKey) {
    if (!apiKey) {
        throw new Error('API key is required for all requests.');
    }

    const response = await fetch(`${API_BASE_URL}/document/${documentId}/content`, {
        headers: {
            'X-API-Key': apiKey,
            'Accept': '*/*'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status}`);
    }

    // Return the text content (iXBRL/XML)
    return response.text();
}

/**
 * Download a document in PDF format from the Document API via proxy.
 */
export async function downloadDocumentPdf(documentId, filename, apiKey) {
    if (!apiKey) {
        throw new Error('API key is required.');
    }

    console.log(`[PDF Download] Starting download for document: ${documentId}`);
    console.log(`[PDF Download] Filename: ${filename}`);

    try {
        const response = await fetch(`${API_BASE_URL}/document/${documentId}/content`, {
            headers: {
                'X-API-Key': apiKey,
                'Accept': 'application/pdf'
            }
        });

        console.log(`[PDF Download] Response status: ${response.status}`);
        console.log(`[PDF Download] Response headers:`, response.headers);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[PDF Download] Error response:`, errorText);
            throw new Error(`Failed to download PDF: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        console.log(`[PDF Download] Content-Type: ${contentType}`);

        const blobData = await response.blob();
        console.log(`[PDF Download] Blob size: ${blobData.size} bytes`);

        const blob = new Blob([blobData], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        console.log(`[PDF Download] Blob URL created: ${url}`);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `document_${documentId}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);

        console.log(`[PDF Download] Triggering download...`);
        a.click();

        // Clean up after a short delay to ensure download starts
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            console.log(`[PDF Download] Cleanup complete`);
        }, 100);

    } catch (error) {
        console.error(`[PDF Download] Error:`, error);
        throw error;
    }
}
