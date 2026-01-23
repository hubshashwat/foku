// Core interface for premium features
// This file is part of the Open Source core.
// The actual implementations are injected during the premium build.

export async function getBoomerangSummary(tabId, url) {
    return null; // No-op in free version
}

export async function syncData() {
    return null; // No-op in free version
}

export function checkDomainLimit(url, domainLimits) {
    return { allowed: true }; // Always allowed in free version
}
