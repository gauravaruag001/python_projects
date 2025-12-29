/**
 * Renderers module.
 * 
 * Handles the generation of HTML cards for companies, officers, 
 * and appointments.
 */

import { escapeHtml, formatDate } from './ui-utils.js';
import { SIC_CODES } from './sic-codes.js';
import { getGoogleMapsKey } from './api.js';

// Cache for Google Maps API key
let cachedGoogleMapsKey = null;
let keyFetchPromise = null;

/**
 * Get Google Maps API key (cached).
 */
async function getGoogleMapsApiKey() {
    if (cachedGoogleMapsKey !== null) {
        return cachedGoogleMapsKey;
    }

    if (!keyFetchPromise) {
        keyFetchPromise = getGoogleMapsKey().then(key => {
            cachedGoogleMapsKey = key;
            return key;
        });
    }

    return keyFetchPromise;
}

/**
 * Creates a company card element.
 */
export function createCompanyCard(company, index, isAppend, onClick) {
    const card = document.createElement('div');
    card.className = 'company-card';

    // Stagger animation for new cards
    const delayIndex = isAppend ? 0 : index;
    card.style.animationDelay = `${delayIndex * 0.05}s`;

    const status = company.company_status || 'unknown';
    const statusClass = status === 'active' ? 'active' : 'dissolved';

    card.innerHTML = `
        <h3 class="company-name">${escapeHtml(company.title)}</h3>
        <p class="company-number">Company Number: ${escapeHtml(company.company_number)}</p>
        ${company.address_snippet ? `<p class="company-address">${escapeHtml(company.address_snippet)}</p>` : ''}
        <span class="company-status ${statusClass}">${escapeHtml(status)}</span>
    `;

    card.addEventListener('click', () => onClick(company.company_number, company.title));
    return card;
}

/**
 * Creates an officer (person) card element.
 */
export function createPersonCard(person, index, isAppend, onClick) {
    const card = document.createElement('div');
    card.className = 'person-card';
    const delayIndex = isAppend ? 0 : index;
    card.style.animationDelay = `${delayIndex * 0.05}s`;

    const name = person.title || person.name || 'Unknown';
    const description = person.description || '';
    const address = person.address_snippet || '';

    card.innerHTML = `
        <h3 class="person-name">${escapeHtml(name)}</h3>
        ${description ? `<p class="person-title">${escapeHtml(description)}</p>` : ''}
        ${address ? `<p class="person-detail">${escapeHtml(address)}</p>` : ''}
    `;

    // Extract officer ID from API response links
    let officerId = null;
    if (person.links) {
        const link = person.links.self || (person.links.officer && person.links.officer.appointments);
        if (link) {
            const parts = link.split('/');
            const officersIndex = parts.indexOf('officers');
            if (officersIndex !== -1 && officersIndex + 1 < parts.length) {
                officerId = parts[officersIndex + 1];
            }
        }
    }

    if (officerId) {
        card.addEventListener('click', () => onClick(officerId, name));
    } else {
        card.style.cursor = 'not-allowed';
        card.style.opacity = '0.6';
    }

    return card;
}

/**
 * Creates an officer detail card element.
 */
export function createOfficerDetailCard(officer, index, onCompanyClick) {
    const card = document.createElement('div');
    card.className = 'officer-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const name = officer.name || 'Unknown';
    const role = officer.officer_role || 'Unknown Role';
    const appointedOn = formatDate(officer.appointed_on);
    const nationality = officer.nationality || null;
    const occupation = officer.occupation || null;
    const resignedOn = officer.resigned_on ? formatDate(officer.resigned_on) : null;

    // Detect corporate officer (company acting as director/officer)
    const corporateNumber = officer.identification?.registration_number;
    if (corporateNumber) {
        card.classList.add('clickable-company-card');
        card.title = `View details for ${name}`;
        card.addEventListener('click', () => onCompanyClick(corporateNumber, name));
    }

    let detailsHtml = `<div class="officer-detail"><strong>Appointed:</strong> ${escapeHtml(appointedOn)}</div>`;

    if (resignedOn) detailsHtml += `<div class="officer-detail"><strong>Resigned:</strong> ${escapeHtml(resignedOn)}</div>`;
    if (nationality) detailsHtml += `<div class="officer-detail"><strong>Nationality:</strong> ${escapeHtml(nationality)}</div>`;
    if (occupation) detailsHtml += `<div class="officer-detail"><strong>Occupation:</strong> ${escapeHtml(occupation)}</div>`;
    if (officer.country_of_residence) detailsHtml += `<div class="officer-detail"><strong>Country:</strong> ${escapeHtml(officer.country_of_residence)}</div>`;

    card.innerHTML = `
        <div class="officer-card-header">
            <h3 class="officer-name">${escapeHtml(name)}</h3>
            ${corporateNumber ? '<span class="corporate-badge">Corporate Entity</span>' : ''}
        </div>
        <p class="officer-role">${escapeHtml(role)}</p>
        <div class="officer-details">${detailsHtml}</div>
        ${corporateNumber ? '<div class="view-company-link">View Company Details →</div>' : ''}
    `;

    return card;
}

/**
 * Creates the company header summary (Address, Incorporation, Nature of Business).
 */
export async function createCompanyHeader(profile) {
    const header = document.createElement('div');
    header.className = 'company-detail-header';

    const address = profile.registered_office_address;
    const addressStr = address ?
        `${address.address_line_1 || ''}, ${address.address_line_2 || ''}, ${address.locality || ''}, ${address.postal_code || ''}` :
        'Address not available';

    // Get Google Maps API key from server
    const googleMapsKey = await getGoogleMapsApiKey();
    const mapUrl = address && googleMapsKey ?
        `https://www.google.com/maps/embed/v1/place?key=${googleMapsKey}&q=${encodeURIComponent(addressStr)}` :
        null;

    const sicCodes = profile.sic_codes || [];
    const sicHtml = sicCodes.length > 0 ?
        `<ul class="sic-list">${sicCodes.map(code => {
            const description = SIC_CODES[code] || `Other (${code})`;
            return `<li>${escapeHtml(description)}</li>`;
        }).join('')}</ul>` :
        'Nature of business not listed';

    header.innerHTML = `
        <div class="detail-card main-info">
            <div class="info-group">
                <label>Registered Office Address</label>
                <p>${escapeHtml(addressStr)}</p>
                ${mapUrl ? `
                    <div class="map-container" style="margin-top: 16px; border-radius: 8px; overflow: hidden; height: 300px;">
                        <iframe
                            width="100%"
                            height="100%"
                            style="border:0;"
                            loading="lazy"
                            allowfullscreen
                            referrerpolicy="no-referrer-when-downgrade"
                            src="${mapUrl}">
                        </iframe>
                    </div>
                ` : ''}
            </div>
            <div class="info-row">
                <div class="info-group">
                    <label>Incorporated On</label>
                    <p>${formatDate(profile.date_of_creation)}</p>
                </div>
                <div class="info-group">
                    <label>Company Type</label>
                    <p>${escapeHtml(profile.type || 'Unknown')}</p>
                </div>
            </div>
            <div class="info-group">
                <label>Nature of Business (SIC)</label>
                <div class="sic-container">${sicHtml}</div>
            </div>
        </div>
    `;
    return header;
}


/**
 * Creates a PSC (Person with Significant Control) card.
 */
export function createPSCCard(psc, index, onCompanyClick) {
    const card = document.createElement('div');
    card.className = 'psc-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const name = psc.name || 'Unknown';
    const notifiedOn = formatDate(psc.notified_on);
    const kind = psc.kind || 'Unknown Kind';

    // Detect corporate PSC
    const corporateNumber = psc.identification?.registration_number;
    if (corporateNumber) {
        card.classList.add('clickable-company-card');
        card.title = `View details for ${name}`;
        card.addEventListener('click', () => onCompanyClick(corporateNumber, name));
    }

    const natures = (psc.natures_of_control || []).map(n => `<li>${escapeHtml(n.replace(/-/g, ' '))}</li>`).join('');

    card.innerHTML = `
        <div class="psc-card-header">
            <h3 class="psc-name">${escapeHtml(name)}</h3>
            ${corporateNumber ? '<span class="corporate-badge">Corporate Entity</span>' : ''}
        </div>
        <p class="psc-kind">${escapeHtml(kind.replace(/-/g, ' '))}</p>
        <div class="psc-detail"><strong>Notified:</strong> ${notifiedOn}</div>
        <div class="psc-natures">
            <label>Natures of Control:</label>
            <ul>${natures}</ul>
        </div>
        ${corporateNumber ? '<div class="view-company-link">View Company Details →</div>' : ''}
    `;

    return card;
}

/**
 * Creates a filing history table.
 */
export function createFilingHistoryTable(filings) {
    const container = document.createElement('div');
    container.className = 'table-container';

    if (!filings || filings.length === 0) {
        container.innerHTML = '<p class="no-data">No filing history available.</p>';
        return container;
    }

    let rows = filings.map(f => {
        const documentId = f.links?.document_metadata ? f.links.document_metadata.split('/').pop() : null;
        const description = escapeHtml(f.description_original || f.description);
        const downloadBtn = documentId
            ? `<button class="download-pdf-btn" data-document-id="${documentId}" data-description="${description}" title="Download PDF">
                 <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12,16L7,11L8.4,9.6L11,12.2V4H13V12.2L15.6,9.6L17,11L12,16M5,20V18H19V20H5Z"/></svg>
                 PDF
               </button>`
            : '<span class="no-doc">N/A</span>';

        return `
            <tr>
                <td>${formatDate(f.date)}</td>
                <td><strong>${escapeHtml(f.category || 'Other')}</strong></td>
                <td>${description}</td>
                <td class="action-cell">${downloadBtn}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table class="detail-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
    return container;
}

/**
 * Creates an accounts metadata table (last two filings).
 */
export function createAccountsTable(filings) {
    const container = document.createElement('div');
    container.className = 'table-container';

    // Filter for account-related filings
    const accountFilings = filings.filter(f => f.category === 'accounts').slice(0, 2);

    if (accountFilings.length === 0) {
        container.innerHTML = '<p class="no-data">No recent account filings found.</p>';
        return container;
    }

    let rows = accountFilings.map(f => {
        const documentId = f.links?.document_metadata ? f.links.document_metadata.split('/').pop() : null;
        const description = escapeHtml(f.description_original || f.description);
        const downloadBtn = documentId
            ? `<button class="download-pdf-btn" data-document-id="${documentId}" data-description="${description}" title="Download PDF">
                 <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12,16L7,11L8.4,9.6L11,12.2V4H13V12.2L15.6,9.6L17,11L12,16M5,20V18H19V20H5Z"/></svg>
               </button>`
            : '';

        return `
            <tr>
                <td>${formatDate(f.date)}</td>
                <td>${description}</td>
                <td>${f.action_date ? formatDate(f.action_date) : 'N/A'}</td>
                <td class="action-cell">${downloadBtn}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table class="detail-table accounts-table">
            <thead>
                <tr>
                    <th>Filing Date</th>
                    <th>Type</th>
                    <th>Period End</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
    return container;
}

/**
 * Creates a list of charges (mortgages).
 */
export function createChargesList(charges) {
    const container = document.createElement('div');
    container.className = 'charges-container';

    if (!charges || charges.length === 0) {
        container.innerHTML = '<p class="no-data">No mortgage charges found for this company.</p>';
        return container;
    }

    charges.forEach((charge, index) => {
        const item = document.createElement('div');
        item.className = 'charge-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const status = charge.status || 'unknown';
        const statusClass = status === 'satisfied' ? 'satisfied' : 'outstanding';

        item.innerHTML = `
            <div class="charge-header">
                <strong>Charge Filter: ${escapeHtml(charge.charge_number || 'N/A')}</strong>
                <span class="status-badge ${statusClass}">${escapeHtml(status)}</span>
            </div>
            <p><strong>Created:</strong> ${formatDate(charge.delivered_on)}</p>
            <p><strong>Particulars:</strong> ${escapeHtml(charge.particulars?.description || 'No description available')}</p>
            ${charge.persons_entitled ? `<p><strong>Entitled:</strong> ${charge.persons_entitled.map(p => escapeHtml(p.name)).join(', ')}</p>` : ''}
        `;
        container.appendChild(item);
    });

    return container;
}

/**
 * Creates an appointment card element.
 */
export function createAppointmentCard(appointment, index, onCompanyClick) {
    const card = document.createElement('div');
    card.className = 'appointment-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const companyName = appointment.appointed_to?.company_name || 'Unknown Company';
    const companyNumber = appointment.appointed_to?.company_number || '';
    const role = appointment.officer_role || 'Unknown Role';
    const appointedOn = formatDate(appointment.appointed_on);
    const resignedOn = appointment.resigned_on ? formatDate(appointment.resigned_on) : null;
    const companyStatus = appointment.appointed_to?.company_status || '';

    if (companyNumber && onCompanyClick) {
        card.classList.add('clickable-company-card');
        card.title = `View details for ${companyName}`;
        card.addEventListener('click', () => onCompanyClick(companyNumber, companyName));
    }

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
        ${companyNumber ? '<div class="view-company-link">View Company Details →</div>' : ''}
    `;

    return card;
}

/**
 * Advanced iXBRL parser that extracts the actual balance sheet table
 * to preserve the exact formatting and published data.
 */
export function parseBalanceSheet(ixbrlString, filingDate) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ixbrlString, 'text/html');

    // 1. Find the Balance Sheet table with improved heuristic
    const tables = doc.querySelectorAll('table');
    let balanceSheetTable = null;
    let maxNumericCells = -1;

    for (const table of tables) {
        const text = table.textContent.toLowerCase();
        const hasKeywords = text.includes('balance sheet') ||
            text.includes('statement of financial position') ||
            text.includes('statement of financial condition');

        // Count numeric-looking cells
        const cells = Array.from(table.querySelectorAll('td, th'));
        const numericCount = cells.filter(c => /[\d,]{3,}/.test(c.textContent)).length;

        // A table is a good candidate if it has keywords AND some numbers
        // OR if it's the biggest numeric table and the keywords are nearby
        if (hasKeywords && numericCount > 5) {
            // This is likely IT
            balanceSheetTable = table;
            break;
        }

        if (numericCount > maxNumericCells) {
            maxNumericCells = numericCount;
            balanceSheetTable = table;
        }
    }

    // Final check for the best candidate
    if (!balanceSheetTable || maxNumericCells < 5) {
        // Try searching for the text "Balance Sheet" and then the NEXT table
        const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, p, div, b'));
        const bsHeading = headings.find(h => {
            const t = h.textContent.toLowerCase().trim();
            return t === 'balance sheet' || t === 'consolidated balance sheet' || t === 'statement of financial position';
        });

        if (bsHeading) {
            // Look for the next table in the DOM
            let next = bsHeading.nextElementSibling;
            while (next) {
                if (next.tagName === 'TABLE') {
                    balanceSheetTable = next;
                    break;
                }
                const nestedTable = next.querySelector('table');
                if (nestedTable) {
                    balanceSheetTable = nestedTable;
                    break;
                }
                next = next.nextElementSibling;
            }
        }
    }

    if (!balanceSheetTable) return null;

    // Clone the table to avoid side effects
    const clonedTable = balanceSheetTable.cloneNode(true);

    // Clean up the table (remove excessive styling attributes but keep internal structure)
    clonedTable.style.width = '100%';
    clonedTable.style.borderCollapse = 'collapse';
    clonedTable.className = 'extracted-balance-sheet';

    // Add CSS classes for our center-alignment and highlight
    const rows = clonedTable.querySelectorAll('tr');
    rows.forEach(tr => {
        const cells = tr.querySelectorAll('td, th');
        cells.forEach((cell, idx) => {
            if (idx > 0) {
                // This is a value column - align center
                cell.style.textAlign = 'center';
                cell.style.padding = '8px';

                // Highlight negative values
                if (cell.textContent.includes('(') || cell.textContent.includes('-')) {
                    cell.style.color = '#ef4444'; // var(--error)
                }
            } else {
                // This is the label column
                cell.style.padding = '8px';
                cell.style.fontWeight = '500';
                cell.style.textAlign = 'left';
            }
        });
    });

    return {
        html: clonedTable.outerHTML,
        date: filingDate
    };
}

/**
 * Creates the Company Performance section with the extracted HTML table.
 */
export function createPerformanceSection(performanceData) {
    const container = document.createElement('div');
    container.className = 'performance-section';

    if (!performanceData || performanceData.length === 0) {
        container.innerHTML = '<p class="no-data">Financial data not available or could not be parsed.</p>';
        return container;
    }

    // Use the first successful table found
    const data = performanceData.find(d => d && d.html);
    if (!data) {
        container.innerHTML = '<p class="no-data">No structured balance sheet data found in recent filings.</p>';
        return container;
    }

    container.innerHTML = `
        <div class="table-container extracted-table-wrapper">
            ${data.html}
        </div>
        <p class="performance-note">* Full balance sheet table extracted from official account filings.</p>
    `;

    return container;
}
