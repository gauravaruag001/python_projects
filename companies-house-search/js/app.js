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
        // Use viewUKCompanyDetails for standard company search results too for consistency
        const card = renderers.createCompanyCard(c, idx, false, viewUKCompanyDetails);
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
 * Helper to view company details, restricted to UK registered entities.
 */
function viewUKCompanyDetails(companyNumber, companyName) {
    if (!companyNumber) return;

    // UK Company Number formats: 
    // - 8 digits
    // - 2 letters + 6 digits (SC, NI, OC, SO, NC, etc.)
    // This is a basic check. Companies House API for UK companies generally uses these.
    const ukPattern = /^([A-Z]{2})?\d{6,8}$/i;

    if (ukPattern.test(companyNumber)) {
        viewCompanyDetails(companyNumber, companyName);
    } else {
        alert("The said corporate entity is not a UK registered corporate entity. This may be a foreign entity.");
    }
}

/**
 * Orchestrates fetching ALL company details (Profile, PSCs, History, Charges, Officers).
 */
async function viewCompanyDetails(companyNumber, companyName) {
    ui.showLoading(true);
    ui.hideError();
    hideDetails();

    try {
        // Fetch all required data in parallel
        const [profile, pscData, filingsData, chargesData] = await Promise.all([
            api.getCompanyProfile(companyNumber, activeApiKey),
            api.getCompanyPSCs(companyNumber, 100, 0, activeApiKey).catch(() => ({ items: [] })),
            api.getFilingHistory(companyNumber, 100, 0, activeApiKey).catch(() => ({ items: [] })),
            api.getCompanyCharges(companyNumber, 100, 0, activeApiKey).catch(() => ({ items: [] }))
        ]);

        // Get officers separately as it may require pagination
        const officers = await loadAllOfficers(companyNumber);

        // EXTRACTION: Fetch and parse the last 2 account filings for the Performance section
        const accountFilings = (filingsData.items || []).filter(f => f.category === 'accounts').slice(0, 2);
        const performanceData = [];

        for (const filing of accountFilings) {
            if (filing.links?.document_metadata) {
                // Extract document ID from link: https://document-api.../document/{id}
                const docId = filing.links.document_metadata.split('/').pop();
                try {
                    // We attempt to get the iXBRL/XML content
                    const content = await api.getDocumentContent(docId, activeApiKey);
                    if (content) {
                        const parsed = renderers.parseBalanceSheet(content, filing.date);
                        performanceData.push(parsed);
                    }
                } catch (e) {
                    console.warn(`Could not load financial data for filing ${docId}:`, e);
                }
            }
        }

        renderExpandedCompanyView(profile, officers, pscData.items || [], filingsData.items || [], chargesData.items || [], performanceData);
    } catch (err) {
        ui.showError(`Failed to load company details: ${err.message}`);
    } finally {
        ui.showLoading(false);
    }
}

/**
 * Helper to fetch all officers with pagination safety.
 */
async function loadAllOfficers(companyNumber) {
    let allOfficers = [];
    let start = 0;
    const limit = 100;

    try {
        while (true) {
            const data = await api.getCompanyOfficers(companyNumber, limit, start, activeApiKey).catch(() => ({ items: [] }));
            const items = data.items || [];
            allOfficers = allOfficers.concat(items);

            if (items.length < limit || allOfficers.length >= (data.total_results || 0)) break;
            start += limit;
            if (start > 1000) break;
        }
    } catch (e) {
        console.warn('Error fetching all officers:', e);
    }
    return allOfficers;
}

/**
 * Renders the full expanded dashboard for a company.
 */
function renderExpandedCompanyView(profile, officers, pscs, filings, charges, performanceData = []) {
    resultsSection.style.display = 'none';
    detailSection.style.display = 'block';
    breadcrumb.style.display = 'block';

    detailTitle.textContent = profile.company_name;
    detailInfo.textContent = `Company Number: ${profile.company_number} (${profile.company_status})`;

    // Clear and build the dashboard content
    detailGrid.innerHTML = '';
    detailGrid.className = 'detail-dashboard';

    // 1. Company Summary (Address, Inc, SIC)
    detailGrid.appendChild(renderers.createCompanyHeader(profile));

    // 2. Company Performance (Balance Sheet) - NEW SECTION
    const perfTitle = document.createElement('h2');
    perfTitle.className = 'detail-section-title';
    perfTitle.textContent = 'Company Performance (Balance Sheet)';
    detailGrid.appendChild(perfTitle);
    detailGrid.appendChild(renderers.createPerformanceSection(performanceData));

    // 3. Accounts (Last 2 filings)
    const accTitle = document.createElement('h2');
    accTitle.className = 'detail-section-title';
    accTitle.textContent = 'Account Filing History';
    detailGrid.appendChild(accTitle);
    detailGrid.appendChild(renderers.createAccountsTable(filings));

    // 3. Officers (Signif Control, Past/Disqualified, Current)
    const pscTitle = document.createElement('h2');
    pscTitle.className = 'detail-section-title';
    pscTitle.textContent = 'Persons with Significant Control';
    detailGrid.appendChild(pscTitle);

    const pscGrid = document.createElement('div');
    pscGrid.className = 'officers-grid';
    pscs.forEach((p, idx) => pscGrid.appendChild(renderers.createPSCCard(p, idx, viewUKCompanyDetails)));
    if (pscs.length === 0) pscGrid.innerHTML = '<p class="no-data">No persons with significant control listed.</p>';
    detailGrid.appendChild(pscGrid);

    const officersTitle = document.createElement('h2');
    officersTitle.className = 'detail-section-title';
    officersTitle.textContent = 'Company Officers';
    detailGrid.appendChild(officersTitle);

    const offGrid = document.createElement('div');
    offGrid.className = 'officers-grid';
    officers.forEach((o, idx) => offGrid.appendChild(renderers.createOfficerDetailCard(o, idx, viewUKCompanyDetails)));
    detailGrid.appendChild(offGrid);

    // 4. Filing History
    const historyTitle = document.createElement('h2');
    historyTitle.className = 'detail-section-title';
    historyTitle.textContent = 'Filing History (Recent)';
    detailGrid.appendChild(historyTitle);
    detailGrid.appendChild(renderers.createFilingHistoryTable(filings.slice(0, 10)));

    // 5. Mortgages / Charges
    const chargesTitle = document.createElement('h2');
    chargesTitle.className = 'detail-section-title';
    chargesTitle.textContent = 'Mortgage Charges';
    detailGrid.appendChild(chargesTitle);
    detailGrid.appendChild(renderers.createChargesList(charges));

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
        detailGrid.appendChild(renderers.createAppointmentCard(a, idx, viewUKCompanyDetails));
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
