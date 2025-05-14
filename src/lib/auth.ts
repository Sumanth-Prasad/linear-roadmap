import { LinearClient } from '@linear/sdk';

// Key for storing auth token in localStorage
const LINEAR_TOKEN_KEY = 'linear_auth_token';

/**
 * Create a new Linear client instance with the user's token
 * @param token Linear API token
 * @returns LinearClient instance
 */
export function createLinearClient(token: string): LinearClient {
  return new LinearClient({
    apiKey: token
  });
}

/**
 * Get the stored Linear auth token from localStorage
 * @returns The auth token or null if not authenticated
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Client side - use localStorage
  return localStorage.getItem(LINEAR_TOKEN_KEY);
}

/**
 * Get a Linear client from the stored auth token
 * @returns LinearClient or null if not authenticated
 */
export function getLinearClientFromAuth(): LinearClient | null {
  const token = getAuthToken();
  if (!token) return null;
  
  return createLinearClient(token);
}

/**
 * Check if the user is authenticated with Linear
 * @returns boolean indicating if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Client-side function to save token to localStorage
 * @param token Linear API token
 */
export function saveAuthTokenClient(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LINEAR_TOKEN_KEY, token);
  }
}

/**
 * Client-side function to logout (clear localStorage)
 */
export function logoutClient(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LINEAR_TOKEN_KEY);
  }
}

/**
 * Validate a Linear API token by making a test request
 * @param token Linear API token to validate
 * @returns Success status and user info if successful
 */
export async function validateToken(token: string): Promise<{ 
  valid: boolean;
  user?: { 
    id: string; 
    name: string; 
    email: string;
  };
  error?: string;
}> {
  try {
    const client = createLinearClient(token);
    const viewer = await client.viewer;
    
    if (!viewer || !viewer.id) {
      return { 
        valid: false,
        error: 'Invalid token - could not retrieve user info'
      };
    }
    
    return { 
      valid: true,
      user: {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email
      }
    };
  } catch (error) {
    console.error('Error validating Linear token:', error);
    return { 
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 