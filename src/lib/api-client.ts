/**
 * Client-side API utilities for communicating with Linear
 * This file is safe to use in client components
 */

// Interface for API responses
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Sets a Linear API key to localStorage for client-side operations
 * @param key The Linear API key
 */
export function setLinearApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('LINEAR_API_KEY', key);
  }
}

/**
 * Gets the Linear API key from localStorage
 */
export function getLinearApiKey(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('LINEAR_API_KEY');
  }
  return null;
}

/**
 * Clears the Linear API key from localStorage
 */
export function clearLinearApiKey(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('LINEAR_API_KEY');
  }
}

// Fetch teams through our API endpoint
export async function fetchTeams(): Promise<ApiResponse<Array<{id: string; name: string; key: string}>>> {
  try {
    const response = await fetch('/api/linear/teams');
    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || `Error: ${response.status}` };
    }
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: 'Failed to fetch teams' };
  }
}

// Fetch projects for a team
export async function fetchProjects(teamId: string): Promise<ApiResponse<Array<{id: string; name: string; teamId: string}>>> {
  try {
    const response = await fetch(`/api/linear/teams/${teamId}/projects`);
    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || `Error: ${response.status}` };
    }
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: 'Failed to fetch projects' };
  }
}

// Fetch workflow states for a team
export async function fetchStates(teamId: string): Promise<ApiResponse<Array<{id: string; name: string; teamId: string}>>> {
  try {
    const response = await fetch(`/api/linear/teams/${teamId}/states`);
    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || `Error: ${response.status}` };
    }
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: 'Failed to fetch workflow states' };
  }
}

// Fetch labels
export async function fetchLabels(): Promise<ApiResponse<Array<{id: string; name: string; color: string}>>> {
  try {
    const response = await fetch('/api/linear/labels');
    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || `Error: ${response.status}` };
    }
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: 'Failed to fetch labels' };
  }
}

// Fetch users for a team
export async function fetchUsers(teamId: string): Promise<ApiResponse<Array<{id: string; name: string; displayName: string}>>> {
  try {
    const response = await fetch(`/api/linear/teams/${teamId}/users`);
    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || `Error: ${response.status}` };
    }
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: 'Failed to fetch users' };
  }
} 