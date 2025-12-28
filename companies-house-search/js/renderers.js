/**
 * Renderers module.
 * 
 * Handles the generation of HTML cards for companies, officers, 
 * and appointments.
 */

import { escapeHtml, formatDate } from './ui-utils.js';
import { SIC_CODES } from './sic-codes.js';

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
export function createOfficerDetailCard(officer, index) {
    const card = document.createElement('div');
    card.className = 'officer-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const name = officer.name || 'Unknown';
    const role = officer.officer_role || 'Unknown Role';
    const appointedOn = formatDate(officer.appointed_on);
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

    return card;
}

/**
 * Creates the company header summary (Address, Incorporation, Nature of Business).
 */
export function createCompanyHeader(profile) {
    const header = document.createElement('div');
    header.className = 'company-detail-header';

    const address = profile.registered_office_address;
    const addressStr = address ?
        `${address.address_line_1 || ''}, ${address.address_line_2 || ''}, ${address.locality || ''}, ${address.postal_code || ''}` :
        'Address not available';

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
export function createPSCCard(psc, index) {
    const card = document.createElement('div');
    card.className = 'psc-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const name = psc.name || 'Unknown';
    const kind = psc.kind || 'PSC';
    const nature = psc.natures_of_control || [];

    const natureHtml = nature.length > 0 ?
        `<ul class="nature-list">${nature.map(n => `<li>${escapeHtml(n.replace(/-/g, ' '))}</li>`).join('')}</ul>` :
        'No specific control details';

    card.innerHTML = `
        <h3 class="psc-name">${escapeHtml(name)}</h3>
        <p class="psc-kind">${escapeHtml(kind.replace(/-/g, ' '))}</p>
        <div class="psc-details">
            <strong>Natures of Control:</strong>
            ${natureHtml}
        </div>
        <p class="psc-date">Notified on: ${formatDate(psc.notified_on)}</p>
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

    let rows = filings.map(f => `
        <tr>
            <td>${formatDate(f.date)}</td>
            <td><strong>${escapeHtml(f.category || 'Other')}</strong></td>
            <td>${escapeHtml(f.description_original || f.description)}</td>
            <td>${f.links?.document_metadata ? '<span class="doc-badge">Document Available</span>' : 'N/A'}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="detail-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Ref</th>
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

    let rows = accountFilings.map(f => `
        <tr>
            <td>${formatDate(f.date)}</td>
            <td>${escapeHtml(f.description_original || f.description)}</td>
            <td>${f.action_date ? formatDate(f.action_date) : 'N/A'}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="detail-table accounts-table">
            <thead>
                <tr>
                    <th>Filing Date</th>
                    <th>Type</th>
                    <th>Period End</th>
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
export function createAppointmentCard(appointment, index) {
    const card = document.createElement('div');
    card.className = 'appointment-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const companyName = appointment.appointed_to?.company_name || 'Unknown Company';
    const companyNumber = appointment.appointed_to?.company_number || '';
    const role = appointment.officer_role || 'Unknown Role';
    const appointedOn = formatDate(appointment.appointed_on);
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

    return card;
}
