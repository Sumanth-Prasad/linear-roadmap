"use server";

import { LinearClient } from "@linear/sdk";

interface CustomerUpsertInput {
  name?: string;
  domains: string[];
  externalId: string;
}

interface CustomerNeedCreateInput {
  issueId: string;
  body: string;
  customerExternalId: string;
  attachmentUrl?: string;
  title?: string;
}

/**
 * Upserts a customer in Linear when a user signs in.
 * This allows for automatic association of customer requests with company domains.
 */
export async function upsertCustomer(input: CustomerUpsertInput) {
  try {
    // Use application-level Linear API key for customer operations
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      throw new Error("LINEAR_API_KEY environment variable is not set");
    }

    const client = new LinearClient({ apiKey });

    // Construct GraphQL mutation for customer upsert
    const mutation = `
      mutation CustomerUpsert($input: CustomerUpsertInput!) {
        customerUpsert(input: $input) {
          success
          customer {
            id
            name
            domains
            externalIds
          }
        }
      }
    `;

    // Execute mutation
    const result = await client.client.rawRequest(mutation, { input }) as any;
    return result.data?.customerUpsert;
  } catch (error) {
    console.error("Error upserting customer:", error);
    throw error;
  }
}

/**
 * Creates a customer need (request) in Linear associated with a customer.
 */
export async function createCustomerNeed(input: CustomerNeedCreateInput) {
  try {
    // Use application-level Linear API key for customer operations
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      throw new Error("LINEAR_API_KEY environment variable is not set");
    }

    const client = new LinearClient({ apiKey });

    // Construct GraphQL mutation for customer need creation
    const mutation = `
      mutation CustomerNeedCreate($input: CustomerNeedCreateInput!) {
        customerNeedCreate(input: $input) {
          success
          customerNeed {
            id
            body
            title
          }
        }
      }
    `;

    // Execute mutation
    const result = await client.client.rawRequest(mutation, { input }) as any;
    return result.data?.customerNeedCreate;
  } catch (error) {
    console.error("Error creating customer need:", error);
    throw error;
  }
} 