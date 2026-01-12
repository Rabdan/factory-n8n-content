import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// Fallback projects if API is unavailable or empty
// Fallback projects if API is unavailable or empty
const fallbackProjects = [
    {
        id: 1,
        name: 'test 1',
        members: [
            { id: 1, email: 'admin@test.com', role: 'Owner' }
        ],
        social_networks: []
    },
    {
        id: 2,
        name: 'test 2',
        members: [],
        social_networks: []
    }
];

/**
 * Enhanced fetch that includes the auth token
 */
async function authFetch(url: string, options: any = {}) {
    const authData = get(auth);
    const headers = {
        ...options.headers,
        'Authorization': authData.token ? `Bearer ${authData.token}` : ''
    };
    return fetch(url, { ...options, headers });
}

export const projects = writable<any[]>([]);
export const currentProject = writable<any>(null);
export const auth = writable<{ user: any, token: string | null }>({
    user: null,
    token: browser ? localStorage.getItem('token') : null
});

// Persist current project selection
if (browser) {
    currentProject.subscribe(value => {
        if (value) {
            localStorage.setItem('currentProject', JSON.stringify(value));
        }
    });

    auth.subscribe(value => {
        if (value.token) {
            localStorage.setItem('token', value.token);
            if (value.user) {
                localStorage.setItem('user', JSON.stringify(value.user));
            }
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('currentProject');
            projects.set([]);
            currentProject.set(null);
        }
    });
}

let isInitializing = false;

/**
 * Initializes the projects store by fetching from the API.
 * Falls back to "test" projects if the API is unavailable.
 */
export async function initProjects(force = false) {
    if (!browser) return;
    if (isInitializing) return;

    const currentProjects = get(projects);
    if (!force && currentProjects.length > 0 && get(currentProject)) {
        return;
    }

    isInitializing = true;
    try {
        const response = await authFetch('/api/projects');
        if (!response.ok) throw new Error('API unavailable');

        const data = await response.json();

        if (data && data.length > 0) {
            // If we got projects, we need to fetch details for the first one (or selected one)
            // since the main list endpoint usually returns less info
            const projectList = data;
            projects.set(projectList);

            // Try to restore from localStorage
            const stored = localStorage.getItem('currentProject');
            if (stored) {
                const parsed = JSON.parse(stored);
                const stillExists = projectList.find((p: any) => p.id === parsed.id);
                if (stillExists) {
                    // Fetch full details for the stored project
                    await selectProject(stillExists.id);
                    return;
                }
            }

            // Default to first project
            await selectProject(projectList[0].id);
        } else {
            // API ok but no projects found
            projects.set(fallbackProjects);
            currentProject.set(fallbackProjects[0]);
        }
    } catch (error) {
        console.warn('API error, using fallback projects:', error);
        projects.set(fallbackProjects);
        currentProject.set(fallbackProjects[0]);
    } finally {
        isInitializing = false;
    }
}

/**
 * Fetches full project details including members and social networks
 */
export async function selectProject(id: number) {
    try {
        const response = await authFetch(`/api/projects/${id}`);
        if (!response.ok) throw new Error('Failed to fetch project details');
        const fullProject = await response.json();
        currentProject.set(fullProject);

        // Update the project in the list as well if needed
        projects.update((list: any[]) => list.map((p: any) => p.id === id ? fullProject : p));
    } catch (error) {
        console.error('Error selecting project:', error);
        // Fallback to basic info from the list if detail fetch fails
        const list = get(projects);
        const basic = list.find(p => p.id === id);
        if (basic) currentProject.set(basic);
    }
}

export function addProject(projectName: string) {
    // In a real app, this should be an API call
    projects.update((p: any[]) => {
        const newProject = {
            id: p.length + 1,
            name: projectName,
            members: [{ id: 1, email: 'admin@neurovision.com', role: 'Owner' }],
            social_networks: []
        };
        currentProject.set(newProject);
        return [...p, newProject];
    });
}
