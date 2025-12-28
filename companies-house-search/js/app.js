/**
 * main app.js (Modular Version)
 * 
 * Orchestrates the application by combining API, UI, Renderers,
 * and Pagination modules. Handles event routing and state management.
 */

import * as api from './api.js';
import * as ui from './ui-utils.js';
import * as renderers from './renderers.js';
import * as pagination from './pagination.js';
import * as settings from './settings.js';

// --- State ---
let activeApiKey = settings.getApiKey();
let activeSearchQuery = '';
const searchResults = {
    companies: [],
    people: []
};

// --- DOM References ---
const searchForm = document.getElementById('searchForm');
const companySearchInput = document.getElementById('companySearch');
const companiesBadge = document.getElementById('companiesBadge');
const peopleBadge = document.getElementById('peopleBadge');
const companyList = document.getElementById('companyList');
const peopleList = document.getElementById('peopleList');
const resultsSection = document.getElementById('resultsSection');
const detailSection = document.getElementById('detailSection');
const detailGrid = document.getElementById('detailGrid');
const detailTitle = document.getElementById('detailTitle');
const detailInfo = document.getElementById('detailInfo');
const breadcrumb = document.getElementById('breadcrumb');

/**
 * Initialize the application logic.
 */
function init() {
    setupEventListeners();
    if (!activeApiKey) settings.openSettings();
}

/**
 * Registers all core event listeners.
 */
function setupEventListeners() {
    // Search
    searchForm.addEventListener('submit', handleSearch);

    // Tabs
    document.getElementById('companiesTab').addEventListener('click', () => switchTab('companies'));
    document.getElementById('peopleTab').addEventListener('click', () => switchTab('people'));

    // Navigation
    document.getElementById('backToResults').addEventListener('click', showResultsSection);
    document.getElementById('errorCloseBtn').addEventListener('click', ui.hideError);

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', settings.openSettings);
    document.getElementById('closeModalBtn').addEventListener('click', settings.closeSettings);
    document.getElementById('cancelBtn').addEventListener('click', settings.closeSettings);
    document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
        const key = settings.saveApiKey();
        if (key) {
            activeApiKey = key;
            setTimeout(settings.closeSettings, 1000);
        }
    });
    document.getElementById('toggleVisibilityBtn').addEventListener('click', settings.toggleApiKeyVisibility);

    // Pagination
    document.getElementById('companiesLoadMoreBtn').addEventListener('click', () => loadMore('companies'));
    document.getElementById('peopleLoadMoreBtn').addEventListener('click', () => loadMore('people'));

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Orchestrates the primary search for both companies and people.
 */
async function handleSearch(e) {
    if (e) e.preventDefault();
    const query = companySearchInput.value.trim();

    if (!query) {
        ui.showError('Please enter a name to search for.');
        return;
    }

    if (!activeApiKey) {
        ui.showError('API key not found. Please update settings.');
        settings.openSettings();
        return;
    }

    activeSearchQuery = query;
    ui.showLoading(true);
    ui.hideError();
    hideDetails();

    pagination.resetState();
    searchResults.companies = [];
    searchResults.people = [];

    try {
        const [compData, peepData] = await Promise.all([
            api.searchCompanies(query, pagination.state.companies.itemsPerPage, 0, activeApiKey),
            api.searchOfficers(query, pagination.state.people.itemsPerPage, 0, activeApiKey)
        ]);

        searchResults.companies = compData.items || [];
        searchResults.people = peepData.items || [];

        pagination.state.companies.totalResults = compData.total_results || 0;
        pagination.state.people.totalResults = peepData.total_results || 0;

        displayResults();
    } catch (err) {
        ui.showError(err.message);
    } finally {
        ui.showLoading(false);
    }
}

/**
 * Renders the results of a search into the dashboard.
 */
function displayResults() {
    companiesBadge.textContent = pagination.state.companies.totalResults;
    peopleBadge.textContent = pagination.state.people.totalResults;

    renderCompanyList(searchResults.companies, false);
    renderPeopleList(searchResults.people, false);

    resultsSection.style.display = 'block';

    // Auto-switch to the tab with results
    if (searchResults.companies.length > 0) switchTab('companies');
    else if (searchResults.people.length > 0) switchTab('people');
}

/**
 * Handles "Load More" requests for both companies and people.
 */
async function loadMore(type) {
    const s = pagination.state[type];
    if (s.isLoadingMore) return;

    pagination.setLoadMoreLoading(type, true);
    s.startIndex += s.itemsPerPage;

    try {
        let newData;
        if (type === 'companies') {
            newData = await api.searchCompanies(activeSearchQuery, s.itemsPerPage, s.startIndex, activeApiKey);
            searchResults.companies = searchResults.companies.concat(newData.items || []);
            renderCompanyList(newData.items || [], true);
        } else {
            newData = await api.searchOfficers(activeSearchQuery, s.itemsPerPage, s.startIndex, activeApiKey);
            searchResults.people = searchResults.people.concat(newData.items || []);
            renderPeopleList(newData.items || [], true);
        }
    } catch (err) {
        ui.showError(`Failed to load more: ${err.message}`);
        s.startIndex -= s.itemsPerPage; // Revert state
    } finally {
        pagination.setLoadMoreLoading(type, false);
    }
}

/**
 * Renders companies into the DOM.
 */
function renderCompanyList(companies, isAppend) {
    if (!isAppend) {
        companyList.innerHTML = '';
        document.getElementById('noCompanies').style.display = companies.length === 0 ? 'block' : 'none';
    }

    companies.forEach((c, idx) => {
        const card = renderers.createCompanyCard(c, idx, isAppend, loadCompanyOfficers);
        companyList.appendChild(card);
    });

    pagination.updatePaginationUI('companies', searchResults.companies.length);
}

/**
 * Renders people (officers) into the DOM.
 */
function renderPeopleList(people, isAppend) {
    if (!isAppend) {
        peopleList.innerHTML = '';
        document.getElementById('noPeople').style.display = people.length === 0 ? 'block' : 'none';
    }

    people.forEach((p, idx) => {
        const card = renderers.createPersonCard(p, idx, isAppend, loadOfficerAppointments);
        peopleList.appendChild(card);
    });

    pagination.updatePaginationUI('people', searchResults.people.length);
}

/**
 * Loads and displays all officers for a specific company.
 */
async function loadCompanyOfficers(companyNumber, companyName) {
    ui.showLoading(true);
    ui.hideError();

    try {
        let allOfficers = [];
        let start = 0;
        const limit = 100;

        while (true) {
            const data = await api.getCompanyOfficers(companyNumber, limit, start, activeApiKey);
            const items = data.items || [];
            allOfficers = allOfficers.concat(items);

            if (items.length < limit || allOfficers.length >= (data.total_results || 0)) break;
            start += limit;
            if (start > 5000) break; // Infinite loop safety
        }

        displayOfficerDetails(allOfficers, companyName, companyNumber);
    } catch (err) {
        ui.showError(err.message);
    } finally {
        ui.showLoading(false);
    }
}

/**
 * Displays the officer grid view.
 */
function displayOfficerDetails(officers, companyName, companyNumber) {
    resultsSection.style.display = 'none';
    detailSection.style.display = 'block';
    breadcrumb.style.display = 'block';

    detailTitle.textContent = 'Company Officers';
    detailInfo.textContent = `${companyName} (${companyNumber})`;
    detailGrid.innerHTML = '';

    officers.forEach((o, idx) => {
        detailGrid.appendChild(renderers.createOfficerDetailCard(o, idx));
    });

    ui.scrollToTop();
}

/**
 * Loads and displays all appointments for a specific person.
 */
async function loadOfficerAppointments(officerId, personName) {
    ui.showLoading(true);
    ui.hideError();

    try {
        let allAppts = [];
        let start = 0;
        const limit = 100;

        while (true) {
            const data = await api.getOfficerAppointments(officerId, limit, start, activeApiKey);
            const items = data.items || [];
            allAppts = allAppts.concat(items);

            if (items.length < limit || allAppts.length >= (data.total_results || 0)) break;
            start += limit;
            if (start > 5000) break;
        }

        displayAppointmentDetails(allAppts, personName);
    } catch (err) {
        ui.showError(err.message);
    } finally {
        ui.showLoading(false);
    }
}

/**
 * Displays the appointments grid view.
 */
function displayAppointmentDetails(appointments, personName) {
    resultsSection.style.display = 'none';
    detailSection.style.display = 'block';
    breadcrumb.style.display = 'block';

    detailTitle.textContent = 'Company Appointments';
    detailInfo.textContent = personName;
    detailGrid.innerHTML = '';

    appointments.forEach((a, idx) => {
        detailGrid.appendChild(renderers.createAppointmentCard(a, idx));
    });

    ui.scrollToTop();
}

/**
 * UI helper to switch active tabs.
 */
function switchTab(name) {
    const tabs = ['companies', 'people'];
    tabs.forEach(t => {
        const btn = document.getElementById(`${t}Tab`);
        const pane = document.getElementById(`${t}Pane`);
        if (t === name) {
            btn.classList.add('active');
            pane.classList.add('active');
        } else {
            btn.classList.remove('active');
            pane.classList.remove('active');
        }
    });
}

/**
 * Returns from details view to the main search results dashboard.
 */
function showResultsSection() {
    hideDetails();
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function hideDetails() {
    detailSection.style.display = 'none';
    breadcrumb.style.display = 'none';
}

function handleKeyboardShortcuts(e) {
    if (e.key === 'Escape') {
        settings.closeSettings();
        ui.hideError();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        companySearchInput.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        switchTab('companies');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        switchTab('people');
    }
}

// Start the application
init();
