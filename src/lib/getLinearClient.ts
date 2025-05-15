import { LinearClient } from "@linear/sdk";
import { Session } from "next-auth";

/**
 * Gets a Linear client based on the user's session
 * - For developers with Linear OAuth: Uses their access token
 * - For customers: Uses the application-level API key
 */
export function getLinearClientForSession(session: Session | null): LinearClient {
  // If this is a developer with a Linear access token
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linearAccessToken = (session as any)?.linearAccessToken;
  
  if (linearAccessToken) {
    return new LinearClient({ accessToken: linearAccessToken });
  }
  
  // For customers or when no session exists, use the app-level API key
  const apiKey = process.env.LINEAR_API_KEY;
  
  if (!apiKey) {
    throw new Error("LINEAR_API_KEY environment variable is not set");
  }
  
  return new LinearClient({ apiKey });
} 