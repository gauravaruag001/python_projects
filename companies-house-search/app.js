// ========================================
// COMPANIES HOUSE SEARCH APPLICATION
// Dual Search: Companies AND People
// ========================================

// API Configuration - Using local proxy server to avoid CORS issues
const API_BASE_URL = 'http://localhost:5000/api';
const API_KEY_STORAGE = 'companiesHouseApiKey';

// DOM Element References - Cache all DOM elements
const searchForm = document.getElementById('searchForm');
const companySearch = document.getElementById('companySearch');
const searchBtn = document.getElementById('searchBtn');

// Tab elements
const tabs = document.getElementById('tabs');
const companiesTab = document.getElementById('companiesTab');
const peopleTab = document.getElementById('peopleTab');
const companiesBadge = document.getElementById('companiesBadge');
const peopleBadge = document.getElementById('peopleBadge');

// Results section elements
const resultsSection = document.getElementById('resultsSection');
const companiesPane = document.getElementById('companiesPane');
const peoplePane = document.getElementById('peoplePane');
const companyList = document.getElementById('companyList');
const peopleList = document.getElementById('peopleList');
const noCompanies = document.getElementById('noCompanies');
const noPeople = document.getElementById('noPeople');

// Detail section elements (for officers or appointments)
const detailSection = document.getElementById('detailSection');
const detailTitle = document.getElementById('detailTitle');
const detailInfo = document.getElementById('detailInfo');
const detailGrid = document.getElementById('detailGrid');

// Breadcrumb navigation
const breadcrumb = document.getElementById('breadcrumb');
const backToResults = document.getElementById('backToResults');

// UI state elements
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const errorCloseBtn = document.getElementById('errorCloseBtn');

// Settings modal elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const toggleVisibilityBtn = document.getElementById('toggleVisibilityBtn');
const apiStatus = document.getElementById('apiStatus');

// Application State
let currentApiKey = localStorage.getItem(API_KEY_STORAGE) || '';
let currentSearchResults = {
    companies: [],
    people: []
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    checkApiKey();
    setupEventListeners();
});

// Set up all event listeners
function setupEventListeners() {
    searchForm.addEventListener('submit', handleSearch);
    companiesTab.addEventListener('click', () => switchTab('companies'));
    peopleTab.addEventListener('click', () => switchTab('people'));
    backToResults.addEventListener('click', showResults);
    errorCloseBtn.addEventListener('click', hideError);
    settingsBtn.addEventListener('click', openSettings);
    closeModalBtn.addEventListener('click', closeSettings);
    cancelBtn.addEventListener('click', closeSettings);
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    toggleVisibilityBtn.addEventListener('click', togglePasswordVisibility);

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
    });
}

// API Key Management
function checkApiKey() {
    if (!currentApiKey) openSettings();
}

function openSettings() {
    apiKeyInput.value = currentApiKey;
    settingsModal.style.display = 'flex';
    apiStatus.textContent = '';
    apiStatus.className = 'api-status';
}

function closeSettings() {
    settingsModal.style.display = 'none';
}

function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showApiStatus('Please enter an API key', 'error');
        return;
    }
    currentApiKey = apiKey;
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    showApiStatus('API key saved successfully!', 'success');
    setTimeout(() => closeSettings(), 1500);
}

function togglePasswordVisibility() {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
}

function showApiStatus(message, type) {
    apiStatus.textContent = message;
    apiStatus.className = `api-status ${type}`;
}

// Search Functionality - Dual search for both companies AND people
async function handleSearch(e) {
    e.preventDefault();
    const query = companySearch.value.trim();

    if (!query) {
        showError('Please enter a company name or person name');
        return;
    }

    if (!currentApiKey) {
        showError('Please configure your API key in settings');
        openSettings();
        return;
    }

    await performDualSearch(query);
}

// Perform simultaneous search for companies and people
async function performDualSearch(query) {
    showLoading(true);
    hideError();
    detailSection.style.display = 'none';
    breadcrumb.style.display = 'none';

    try {
        // Make both API calls simultaneously
        const [companiesResponse, peopleResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/search/companies?q=${encodeURIComponent(query)}`, {
                headers: { 'X-API-Key': currentApiKey }
            }),
            fetch(`${API_BASE_URL}/search/officers?q=${encodeURIComponent(query)}`, {
                headers: { 'X-API-Key': currentApiKey }
            })
        ]);

        if (!companiesResponse.ok || !peopleResponse.ok) {
            if (companiesResponse.status === 401 || peopleResponse.status === 401) {
                throw new Error('Invalid API key. Please check your settings.');
            }
            throw new Error('API error occurred');
        }

        const companiesData = await companiesResponse.json();
        const peopleData = await peopleResponse.json();

        currentSearchResults.companies = companiesData.items || [];
        currentSearchResults.people = peopleData.items || [];

        displaySearchResults();

    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'Failed to search. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Display search results in both tabs
function displaySearchResults() {
    companiesBadge.textContent = currentSearchResults.companies.length;
    peopleBadge.textContent = currentSearchResults.people.length;

    displayCompanies(currentSearchResults.companies);
    displayPeople(currentSearchResults.people);

    resultsSection.style.display = 'block';

    // Switch to tab with results (prefer companies)
    if (currentSearchResults.companies.length > 0) {
        switchTab('companies');
    } else if (currentSearchResults.people.length > 0) {
        switchTab('people');
    }
}

// Tab Switching
function switchTab(tabName) {
    if (tabName === 'companies') {
        companiesTab.classList.add('active');
        peopleTab.classList.remove('active');
        companiesPane.classList.add('active');
        peoplePane.classList.remove('active');
    } else {
        peopleTab.classList.add('active');
        companiesTab.classList.remove('active');
        peoplePane.classList.add('active');
        companiesPane.classList.remove('active');
    }
}

// Display Companies
function displayCompanies(companies) {
    companyList.innerHTML = '';

    if (companies.length === 0) {
        noCompanies.style.display = 'block';
        return;
    }

    noCompanies.style.display = 'none';

    companies.forEach((company, index) => {
        const card = document.createElement('div');
        card.className = 'company-card';
        card.style.animationDelay = `${index * 0.05}s`;

        const status = company.company_status || 'unknown';
        const statusClass = status === 'active' ? 'active' : 'dissolved';

        card.innerHTML = `
            <h3 class="company-name">${escapeHtml(company.title)}</h3>
            <p class="company-number">Company Number: ${escapeHtml(company.company_number)}</p>
            ${company.address_snippet ? `<p class="company-address">${escapeHtml(company.address_snippet)}</p>` : ''}
            <span class="company-status ${statusClass}">${escapeHtml(status)}</span>
        `;

        card.addEventListener('click', () => loadOfficers(company.company_number, company.title));
        companyList.appendChild(card);
    });
}

// Display People - FIXED: Better officer ID extraction
function displayPeople(people) {
    peopleList.innerHTML = '';

    if (people.length === 0) {
        noPeople.style.display = 'block';
        return;
    }

    noPeople.style.display = 'none';

    people.forEach((person, index) => {
        const card = document.createElement('div');
        card.className = 'person-card';
        card.style.animationDelay = `${index * 0.05}s`;

        const name = person.title || person.name || 'Unknown';
        const description = person.description || '';
        const address = person.address_snippet || '';

        card.innerHTML = `
            <h3 class="person-name">${escapeHtml(name)}</h3>
            ${description ? `<p class="person-title">${escapeHtml(description)}</p>` : ''}
            ${address ? `<p class="person-detail">${escapeHtml(address)}</p>` : ''}
        `;

        // FIXED: Extract officer ID from API response links
        // The officer ID can be in different places depending on the API response structure
        let officerId = null;

        if (person.links) {
            // Use a more robust regex or path parsing to find the ID after /officers/
            const link = person.links.self || (person.links.officer && person.links.officer.appointments);
            if (link) {
                const parts = link.split('/');
                const officersIndex = parts.indexOf('officers');
                if (officersIndex !== -1 && officersIndex + 1 < parts.length) {
                    officerId = parts[officersIndex + 1];
                }
            }
        }

        // Add click handler if officer ID was found
        if (officerId) {
            card.addEventListener('click', () => loadAppointments(officerId, name));
        } else {
            // Log for debugging and disable click
            console.warn('No officer ID found for:', person);
            card.style.cursor = 'not-allowed';
            card.style.opacity = '0.6';
        }

        peopleList.appendChild(card);
    });
}

// Load Officers for a Company - Fetches all pages
async function loadOfficers(companyNumber, companyName) {
    showLoading(true);
    hideError();

    let allOfficers = [];
    let startIndex = 0;
    const itemsPerPage = 100; // Max allowed by API

    try {
        while (true) {
            const response = await fetch(
                `${API_BASE_URL}/company/${companyNumber}/officers?items_per_page=${itemsPerPage}&start_index=${startIndex}`,
                { headers: { 'X-API-Key': currentApiKey } }
            );

            if (!response.ok) {
                throw new Error(`Failed to load officers: ${response.status}`);
            }

            const data = await response.json();
            const items = data.items || [];
            allOfficers = allOfficers.concat(items);

            // If we got fewer items than requested, or we've reached the total, stop
            if (items.length < itemsPerPage || allOfficers.length >= (data.total_results || 0)) {
                break;
            }

            startIndex += itemsPerPage;

            // Safety break to prevent infinite loops
            if (startIndex > 5000) break;
        }

        if (allOfficers.length === 0) {
            showError('No officers found for this company.');
            return;
        }

        displayOfficers(allOfficers, companyName, companyNumber);

    } catch (error) {
        console.error('Officers error:', error);
        showError(error.message || 'Failed to load officers. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Display Officers
function displayOfficers(officers, companyName, companyNumber) {
    resultsSection.style.display = 'none';
    detailSection.style.display = 'block';
    breadcrumb.style.display = 'block';

    detailTitle.textContent = 'Company Officers';
    detailInfo.textContent = `${companyName} (${companyNumber})`;

    detailGrid.innerHTML = '';

    officers.forEach((officer, index) => {
        const card = document.createElement('div');
        card.className = 'officer-card';
        card.style.animationDelay = `${index * 0.05}s`;

        const name = officer.name || 'Unknown';
        const role = officer.officer_role || 'Unknown Role';
        const appointedOn = officer.appointed_on ? formatDate(officer.appointed_on) : 'Unknown';
        const nationality = officer.nationality || null;
        const occupation = officer.occupation || null;
        const resignedOn = officer.resigned_on ? formatDate(officer.resigned_on) : null;

        let detailsHtml = `<div class="officer-detail"><strong>Appointed:</strong> ${escapeHtml(appointedOn)}</div>`;

        if (resignedOn) detailsHtml += `<div class="officer-detail"><strong>Resigned:</strong> ${escapeHtml(resignedOn)}</div>`;
        if (nationality) detailsHtml += `<div class="officer-detail"><strong>Nationality:</strong> ${escapeHtml(nationality)}</div>`;
        if (occupation) detailsHtml += `<div class="officer-detail"><strong>Occupation:</strong> ${escapeHtml(occupation)}</div>`;
        if (officer.country_of_residence) detailsHtml += `<div class="officer-detail"><strong>Country:</strong> ${escapeHtml(officer.country_of_residence)}</div>`;

        card.innerHTML = `
            <h3 class="officer-name">${escapeHtml(name)}</h3>
            <p class="officer-role">${escapeHtml(role)}</p>
            <div class="officer-details">${detailsHtml}</div>
        `;

        detailGrid.appendChild(card);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Load Appointments for a Person - Fetches all pages
async function loadAppointments(officerId, personName) {
    showLoading(true);
    hideError();

    let allAppointments = [];
    let startIndex = 0;
    const itemsPerPage = 100; // Max allowed by API

    try {
        while (true) {
            const response = await fetch(
                `${API_BASE_URL}/officers/${officerId}/appointments?items_per_page=${itemsPerPage}&start_index=${startIndex}`,
                { headers: { 'X-API-Key': currentApiKey } }
            );

            if (!response.ok) {
                throw new Error(`Failed to load appointments: ${response.status}`);
            }

            const data = await response.json();
            const items = data.items || [];
            allAppointments = allAppointments.concat(items);

            // If we got fewer items than requested, or we've reached the total, stop
            if (items.length < itemsPerPage || allAppointments.length >= (data.total_results || 0)) {
                break;
            }

            startIndex += itemsPerPage;

            // Safety break to prevent infinite loops
            if (startIndex > 5000) break;
        }

        if (allAppointments.length === 0) {
            showError('No appointments found for this person.');
            return;
        }

        displayAppointments(allAppointments, personName);

    } catch (error) {
        console.error('Appointments error:', error);
        showError(error.message || 'Failed to load appointments. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Display Appointments
function displayAppointments(appointments, personName) {
    resultsSection.style.display = 'none';
    detailSection.style.display = 'block';
    breadcrumb.style.display = 'block';

    detailTitle.textContent = 'Company Appointments';
    detailInfo.textContent = personName;

    detailGrid.innerHTML = '';

    appointments.forEach((appointment, index) => {
        const card = document.createElement('div');
        card.className = 'appointment-card';
        card.style.animationDelay = `${index * 0.05}s`;

        const companyName = appointment.appointed_to?.company_name || 'Unknown Company';
        const companyNumber = appointment.appointed_to?.company_number || '';
        const role = appointment.officer_role || 'Unknown Role';
        const appointedOn = appointment.appointed_on ? formatDate(appointment.appointed_on) : 'Unknown';
        const resignedOn = appointment.resigned_on ? formatDate(appointment.resigned_on) : null;
        const companyStatus = appointment.appointed_to?.company_status || '';

        let detailsHtml = `
            <div class="appointment-detail"><strong>Company Number:</strong> ${escapeHtml(companyNumber)}</div>
            <div class="appointment-detail"><strong>Appointed:</strong> ${escapeHtml(appointedOn)}</div>
        `;

        if (resignedOn) detailsHtml += `<div class="appointment-detail"><strong>Resigned:</strong> ${escapeHtml(resignedOn)}</div>`;

        if (companyStatus) {
            const statusClass = resignedOn ? 'resigned' : 'active';
            detailsHtml += `<span class="appointment-status ${statusClass}">${escapeHtml(companyStatus)}</span>`;
        }

        card.innerHTML = `
            <h3 class="appointment-company">${escapeHtml(companyName)}</h3>
            <p class="appointment-role">${escapeHtml(role)}</p>
            <div class="appointment-details">${detailsHtml}</div>
        `;

        detailGrid.appendChild(card);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Navigation
function showResults() {
    detailSection.style.display = 'none';
    breadcrumb.style.display = 'none';
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// UI Helpers
function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
}

function hideError() {
    errorMessage.style.display = 'none';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (settingsModal.style.display === 'flex') closeSettings();
        if (errorMessage.style.display === 'flex') hideError();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        companySearch.focus();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        switchTab('companies');
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        switchTab('people');
    }
});
