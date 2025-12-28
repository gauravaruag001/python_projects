/**
 * Renderers module.
 * 
 * Handles the generation of HTML cards for companies, officers, 
 * and appointments.
 */

import { escapeHtml, formatDate } from './ui-utils.js';

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
