/**
 * Pagination module.
 * 
 * Manages the state and UI for search result pagination.
 */

// Initial pagination state
export const state = {
    companies: {
        startIndex: 0,
        itemsPerPage: 20,
        totalResults: 0,
        isLoadingMore: false
    },
    people: {
        startIndex: 0,
        itemsPerPage: 20,
        totalResults: 0,
        isLoadingMore: false
    }
};

/**
 * Reset pagination state for a new search.
 */
export function resetState() {
    state.companies.startIndex = 0;
    state.companies.totalResults = 0;
    state.companies.isLoadingMore = false;

    state.people.startIndex = 0;
    state.people.totalResults = 0;
    state.people.isLoadingMore = false;
}

/**
 * Update the visibility and statistics of pagination controls.
 */
export function updatePaginationUI(type, currentCount) {
    const s = state[type];
    const container = document.getElementById(`${type}LoadMoreContainer`);
    const statsElem = document.getElementById(`${type}Stats`);

    if (currentCount > 0 && currentCount < s.totalResults) {
        container.style.display = 'flex';
        statsElem.textContent = `Showing ${currentCount} of ${s.totalResults} results`;
    } else {
        container.style.display = 'none';
        if (currentCount > 0 && currentCount >= s.totalResults) {
            // All results loaded
        }
    }
}

/**
 * Sets the loading state for the "Load More" button.
 */
export function setLoadMoreLoading(type, isLoading) {
    state[type].isLoadingMore = isLoading;
    const btn = document.getElementById(`${type}LoadMoreBtn`);
    const spinner = btn.querySelector('.btn-spinner');
    const btnText = btn.querySelector('span');

    if (isLoading) {
        spinner.style.display = 'block';
        btnText.style.opacity = '0.5';
        btn.disabled = true;
    } else {
        spinner.style.display = 'none';
        btnText.style.opacity = '1';
        btn.disabled = false;
    }
}
