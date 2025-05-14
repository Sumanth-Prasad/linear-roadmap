import { LinearClient } from "@linear/sdk";

/**
 * Get a configured Linear client with the API key
 * Uses the pattern from Linear's official documentation
 */
export function getLinearClient(): LinearClient {
  // Use API key from environment variable
  // This is loaded from .env.local in development
  const apiKey = process.env.LINEAR_API_KEY;
  
  if (!apiKey) {
    console.warn("Linear API key not found. Please add LINEAR_API_KEY to .env.local");
  }
  
  // Create and return a new Linear client
  return new LinearClient({
    apiKey: apiKey || ""
  });
}

// Interface for GraphQL error structure
export interface GraphQLError {
  message: string;
  path?: string[];
  extensions?: {
    type?: string;
    code?: string;
    statusCode?: number;
    userError?: boolean;
    userPresentableMessage?: string;
  };
}

// GraphQL response structure
export interface GraphQLErrorResponse {
  response?: {
    errors?: GraphQLError[];
    data: any | null;
    status?: number;
  };
  request?: {
    query?: string;
    variables?: Record<string, any>;
  };
}

// Error types
export type LinearErrorType = 
  | 'NOT_FOUND' 
  | 'UNAUTHORIZED' 
  | 'NETWORK' 
  | 'UNKNOWN' 
  | 'ENTITY_NOT_FOUND' 
  | 'GRAPHQL_ERROR';

export interface LinearError {
  type: LinearErrorType;
  message: string;
  entityType?: string; // For entity not found errors
  originalError?: unknown;
}

/**
 * Extracts entity type from error message
 * @param message Error message like "Entity not found: Team"
 * @returns The entity type or undefined
 */
function extractEntityType(message: string): string | undefined {
  const match = message.match(/Entity not found: (\w+)/);
  return match ? match[1] : undefined;
}

/**
 * Helper to handle Linear API errors in a consistent way
 * @param error The error from Linear API
 * @returns A structured error object
 */
export function handleLinearError(error: unknown): LinearError {
  console.error("Linear API Error:", error);
  
  // Try to parse as a GraphQL error response
  const graphQLError = error as GraphQLErrorResponse;
  
  // Check if this is a structured GraphQL error
  if (graphQLError.response?.errors && graphQLError.response.errors.length > 0) {
    const firstError = graphQLError.response.errors[0];
    
    // Check for entity not found in GraphQL error
    if (firstError.message.includes("Entity not found:")) {
      const entityType = extractEntityType(firstError.message);
      return {
        type: 'ENTITY_NOT_FOUND',
        message: entityType 
          ? `The ${entityType} was not found. It may not exist or you may not have access to it.`
          : "The requested resource was not found.",
        entityType,
        originalError: error
      };
    }
    
    // General GraphQL error
    return {
      type: 'GRAPHQL_ERROR',
      message: firstError.message || "GraphQL error occurred",
      originalError: error
    };
  }
  
  // Convert to string for easier pattern matching for other error types
  const errorString = String(error);
  
  // Check for common error patterns
  if (errorString.includes("Entity not found") || errorString.includes("Could not find referenced")) {
    const entityType = extractEntityType(errorString);
    return {
      type: 'NOT_FOUND',
      message: "The requested resource was not found. It may have been deleted or you may not have access to it.",
      entityType,
      originalError: error
    };
  }
  
  if (errorString.includes("Unauthorized") || errorString.includes("Invalid token")) {
    return {
      type: 'UNAUTHORIZED',
      message: "Not authorized to access this resource. Please check your API key.",
      originalError: error
    };
  }
  
  if (errorString.includes("Network Error") || errorString.includes("ECONNREFUSED")) {
    return {
      type: 'NETWORK',
      message: "Could not connect to Linear. Please check your internet connection.",
      originalError: error
    };
  }
  
  // Default case
  return {
    type: 'UNKNOWN',
    message: "An unexpected error occurred when connecting to Linear.",
    originalError: error
  };
}

/**
 * Safe wrapper for Linear API calls that handles errors gracefully
 * @param apiCall A function that makes a Linear API call
 * @param fallback The fallback value to return if the API call fails
 * @returns The result of the API call or the fallback value
 */
export async function safeLinearApiCall<T>(
  apiCall: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    const handledError = handleLinearError(error);
    console.error(`Linear API Error (${handledError.type}): ${handledError.message}`);
    
    if (handledError.type === 'ENTITY_NOT_FOUND' && handledError.entityType) {
      console.error(`Entity type not found: ${handledError.entityType}`);
    }
    
    return fallback;
  }
}

/**
 * Safely executes a GraphQL query through the Linear API
 * with better error handling for GraphQL-specific errors
 */
export async function safeGraphQLQuery<T>(
  client: LinearClient,
  query: string,
  variables: Record<string, any>,
  fallback: T
): Promise<T> {
  try {
    const result = await client.client.rawRequest(query, variables);
    return result.data as T;
  } catch (error) {
    const handledError = handleLinearError(error);
    
    // Provide more context for debugging
    if (handledError.type === 'ENTITY_NOT_FOUND' && handledError.entityType) {
      console.error(`${handledError.entityType} not found with ID: ${JSON.stringify(variables)}`);
    }
    
    console.error(`GraphQL query failed: ${handledError.message}`);
    return fallback;
  }
}

/**
 * Helper to perform GraphQL requests against the Linear API.
 * Uses a personal API key stored in the `LINEAR_API_KEY` environment variable.
 */
export async function linearGraphQL<
  TVariables extends Record<string, unknown> | undefined = Record<string, unknown>,
  TResult = unknown
>(
  query: string,
  variables?: TVariables
): Promise<TResult> {
  // For client-side, get from localStorage if available
  let apiKey = typeof window !== 'undefined' 
    ? localStorage.getItem('LINEAR_API_KEY') 
    : process.env.LINEAR_API_KEY;
  
  if (!apiKey) {
    throw new Error("Linear API key not found. Please set LINEAR_API_KEY in your environment or localStorage");
  }

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Linear expects the raw personal API key, **without** the Bearer prefix
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
    // A short cache to avoid hitting the API too frequently during rapid user interactions
    cache: 'no-store'
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API responded with ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { data?: TResult; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("\n"));
  }
  return json.data as TResult;
}
