'use server';

import { cookies } from 'next/headers';

// Key for storing auth token
const LINEAR_TOKEN_KEY = 'linear_auth_token';

/**
 * Server action to save authentication token
 * @param token Linear API token
 */
export async function saveAuthToken(token: string): Promise<void> {
  try {
    // Set the cookie for server-side
    const cookieStore = await cookies();
    cookieStore.set(LINEAR_TOKEN_KEY, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // Expire in 30 days
      maxAge: 60 * 60 * 24 * 30
    });
  } catch (error) {
    console.error('Error setting cookie:', error);
  }
}

/**
 * Server action to logout (clear token)
 */
export async function logout(): Promise<void> {
  try {
    // Delete the cookie on server-side
    const cookieStore = await cookies();
    cookieStore.delete(LINEAR_TOKEN_KEY);
  } catch (error) {
    console.error('Error deleting cookie:', error);
  }
}

/**
 * Server-side function to get auth token from cookies
 */
export async function getServerAuthToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(LINEAR_TOKEN_KEY)?.value || null;
  } catch (error) {
    console.error('Error accessing cookies:', error);
    return null;
  }
} 