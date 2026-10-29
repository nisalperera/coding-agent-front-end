'use client';
import { APP_CONFIG } from './config';
import { parseProject } from './project-domain.mjs';

export class ProjectApiError extends Error {
    constructor(message, status, code = '') {
        super(message); this.name = 'ProjectApiError'; this.status = status; this.code = code;
    }
}
function errorMessage(payload, status) {
    if (typeof payload?.detail === 'string') return payload.detail;
    if (typeof payload?.message === 'string') return payload.message;
    if (Array.isArray(payload?.detail)) {
        return payload.detail.map(item => `${Array.isArray(item.loc) ? item.loc.join('.') : 'Request'}: ${typeof item.msg === 'string' ? item.msg : 'Invalid value'}`).join('; ');
    }
    return `Project request failed (${status}).`;
}
function toApiProject(body) {
    return {
        name: body.name, description: body.description ?? '', projectType: body.project_type,
        settings: {
            languages: [...body.languages], frameworks: [...body.frameworks],
            runtimes: body.runtimes.map(value => value === 'nodejs' ? 'node' : value),
            databaseCategories: [...body.database_categories],
        },
    };
}
function fromApiProject(value) {
    if (!value || typeof value !== 'object' || !value.settings || typeof value.settings !== 'object') {
        throw new Error('The project API returned an incompatible response.');
    }
    return parseProject({
        id: value.id, name: value.name, description: value.description,
        project_type: value.projectType, revision: value.revision, status: value.status,
        languages: value.settings.languages, frameworks: value.settings.frameworks,
        runtimes: Array.isArray(value.settings.runtimes)
            ? value.settings.runtimes.map(item => item === 'node' ? 'nodejs' : item)
            : value.settings.runtimes,
        database_categories: value.settings.databaseCategories,
        created_at: value.createdAt, updated_at: value.updatedAt,
    });
}
async function request(path, { method = 'GET', body, signal, revision, noContent = false } = {}) {
    let response;
    try {
        response = await fetch(`${APP_CONFIG.BACKEND_URL}${path}`, {
            method, credentials: 'include', signal,
            headers: {
                Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(revision !== undefined ? { 'If-Match': `"${revision}"` } : {})
            },
            body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
        });
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new ProjectApiError('Could not reach the project service. Check the backend connection.', 0, 'network_error');
    }
    if (response.ok && noContent && response.status === 204) return null;
    let payload = null;
    try { payload = await response.json(); } catch { /* Validate successful response shapes below. */ }
    if (!response.ok) throw new ProjectApiError(errorMessage(payload, response.status), response.status, payload?.code ?? '');
    if (noContent) throw new Error('The server did not return the expected deletion acknowledgement. Refresh before retrying.');
    return payload;
}
const itemPath = id => {
    if (
        typeof id !== 'string' ||
        !id.trim() ||
        id === 'undefined' ||
        id === 'null'
    ) {
        throw new ProjectApiError(
            'A valid project ID is required.',
            0,
            'invalid_project_id',
        );
    }

    return `/v1/projects/${encodeURIComponent(id)}`;
};

export async function listProjects(signal) {
    const projects = []; const seen = new Set();
    for (let page = 1; ; page += 1) {
        const payload = await request(`/v1/projects?page=${page}&page_size=100`, { signal });
        if (!Array.isArray(payload?.items) || payload.page !== page ||
            !Number.isInteger(payload.pageSize) || payload.pageSize < 1 || payload.pageSize > 100 ||
            !Number.isInteger(payload.total) || payload.total < 0 || payload.items.length > payload.pageSize) {
            throw new Error('The project API returned invalid pagination data.');
        }
        for (const value of payload.items) {
            const project = fromApiProject(value);
            if (seen.has(project.id)) throw new Error('The project list changed during pagination. Refresh to retry.');
            seen.add(project.id);
            if (project.status === 'active') projects.push(project);
        }
        if (page * payload.pageSize >= payload.total) return projects;
        if (payload.items.length === 0) throw new Error('The project list changed during pagination. Refresh to retry.');
    }
}
export async function getProject(id, signal) {
    const project = fromApiProject(await request(itemPath(id), { signal }));
    if (project.id !== id) throw new Error('The project API returned a different project identifier.');
    if (project.status !== 'active') throw new ProjectApiError('This project is no longer available.', 410);
    return project;
}
export async function createProject(body) {
    const project = fromApiProject(await request('/v1/projects', { method: 'POST', body: toApiProject(body) }));
    if (project.status !== 'active') throw new Error('The created project is not active.');
    return project;
}
export async function updateProject(id, revision, body) {
    const project = fromApiProject(await request(itemPath(id), { method: 'PUT', revision, body: toApiProject(body) }));
    if (project.id !== id) throw new Error('The project API returned a different project identifier.');
    if (project.status !== 'active') throw new ProjectApiError('This project is no longer available.', 410);
    return project;
}
export async function softDeleteProject(id, revision) {
    await request(itemPath(id), { method: 'DELETE', revision, noContent: true });
    // The verified backend route soft-deletes and confirms with HTTP 204.
    return { id, status: 'deleted' };
}
