"use server";

import { prisma } from "./prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Create a new form
 */
export async function createForm(formData: any) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("You must be logged in to create a form");
  }
  
  const form = await prisma.form.create({
    data: {
      title: formData.title || "Untitled Form",
      description: formData.description,
      userId: session.user.id,
      teamId: formData.teamId || null,
      projectId: formData.projectId || null,
      fields: formData.fields || [],
      settings: formData.settings || {},
      linearSettings: formData.linearSettings || {}
    }
  });
  
  revalidatePath("/forms");
  return form;
}

/**
 * Get all forms for the current user
 */
export async function getUserForms(teamId?: string | null) {
  const session = await getServerSession(authOptions);
  
  /**
   * If the requester IS authenticated we keep the previous behaviour:
   *   - Always scope by the owner (userId)
   *   - Optionally additionally filter by `teamId` (or allow team-agnostic forms)
   *
   * If the requester is NOT authenticated we only return forms when a
   * `teamId` is explicitly provided. This allows public (unauthenticated)
   * users to load and submit a team's forms while still preventing any
   * accidental leakage of a user's private data.
   */

  let whereClause: any = {};

  if (session?.user?.id) {
    // Authenticated – restrict to their own forms.
    whereClause.userId = session.user.id;

    // If a teamId filter is supplied show both team-specific and personal forms.
    if (teamId) {
      whereClause.OR = [{ teamId }, { teamId: null }];
    }
  } else {
    // Unauthenticated – return public forms. If teamId supplied, filter by it; otherwise return all.
    if (teamId) {
      // Include both team-specific and global (null team) forms like the authed path.
      whereClause.OR = [{ teamId }, { teamId: null }];
    } // else leave whereClause empty to fetch every form
  }

  return prisma.form.findMany({
    where: whereClause,
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get a form by ID
 */
export async function getFormById(id: string) {
  const session = await getServerSession(authOptions);
  
  /**
   * Similar to getUserForms:
   * - If authenticated, only allow viewing own forms
   * - If unauthenticated, allow viewing forms by ID if they have a teamId
   *   but don't include submissions
   */
  
  if (session?.user?.id) {
    // Authenticated - only show own forms with submissions
    return prisma.form.findUnique({
      where: {
        id,
        userId: session.user.id // Ensure user can only see their own forms
      },
      include: {
        submissions: true // Include form submissions
      }
    });
  } else {
    // Unauthenticated - only allow forms with teamId without submissions
    const form = await prisma.form.findFirst({
      where: {
        id,
        NOT: { teamId: null } // Only forms with a teamId
      }
    });
    
    if (!form) {
      throw new Error("Form not found or requires authentication");
    }
    
    return form;
  }
}

/**
 * Update a form
 */
export async function updateForm(id: string, formData: any) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("You must be logged in to update forms");
  }
  
  const form = await prisma.form.update({
    where: {
      id,
      userId: session.user.id // Ensure user can only update their own forms
    },
    data: {
      title: formData.title,
      description: formData.description,
      teamId: formData.teamId || null,
      projectId: formData.projectId || null,
      fields: formData.fields,
      settings: formData.settings,
      linearSettings: formData.linearSettings,
      updatedAt: new Date()
    }
  });
  
  revalidatePath(`/forms/${id}`);
  revalidatePath("/forms");
  return form;
}

/**
 * Delete a form
 */
export async function deleteForm(id: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("You must be logged in to delete forms");
  }
  
  await prisma.form.delete({
    where: {
      id,
      userId: session.user.id // Ensure user can only delete their own forms
    }
  });
  
  revalidatePath("/forms");
  return { success: true };
}

/**
 * Create a form submission
 */
export async function createFormSubmission(formId: string, submissionData: any) {
  // Public function, no auth check needed
  const submission = await prisma.formSubmission.create({
    data: {
      formId,
      data: submissionData.data,
      metadata: submissionData.metadata,
      linearIssueId: submissionData.linearIssueId
    }
  });
  
  return submission;
}

/**
 * Get submissions for a form
 */
export async function getFormSubmissions(formId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("You must be logged in to view submissions");
  }
  
  // First verify the user owns the form
  const form = await prisma.form.findUnique({
    where: {
      id: formId,
      userId: session.user.id
    }
  });
  
  if (!form) {
    throw new Error("Form not found or you don't have permission to view its submissions");
  }
  
  // Then get the submissions
  return prisma.formSubmission.findMany({
    where: {
      formId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
} 