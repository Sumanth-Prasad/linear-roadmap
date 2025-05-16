"use server";

import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Create a new form – no authentication required
 */
export async function createForm(formData: any) {
  const data: Prisma.FormUncheckedCreateInput = {
    title: formData.title || "Untitled Form",
    description: formData.description,
    userId: formData.userId ?? null,
    teamId: formData.teamId ?? null,
    projectId: formData.projectId ?? null,
    fields: formData.fields ?? [],
    settings: formData.settings ?? {},
    linearSettings: formData.linearSettings ?? {},
  };

  const form = await prisma.form.create({ data });

  revalidatePath("/forms");
  return form;
}

/**
 * Get all forms – optionally filter by teamId
 */
export async function getUserForms(teamId?: string | null) {
  const whereClause = teamId ? { OR: [{ teamId }, { teamId: null }] } : {};

  return prisma.form.findMany({
    where: whereClause,
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Get a form by ID – always public
 */
export async function getFormById(id: string) {
  return prisma.form.findUnique({
    where: { id },
    include: { submissions: true },
  });
}

/**
 * Update a form – no auth restriction
 */
export async function updateForm(id: string, formData: any) {
  const form = await prisma.form.update({
    where: { id },
    data: {
      title: formData.title,
      description: formData.description,
      teamId: formData.teamId || null,
      projectId: formData.projectId || null,
      fields: formData.fields,
      settings: formData.settings,
      linearSettings: formData.linearSettings,
      updatedAt: new Date(),
    },
  });

  revalidatePath(`/forms/${id}`);
  revalidatePath("/forms");
  return form;
}

/**
 * Delete a form – no auth restriction
 */
export async function deleteForm(id: string) {
  await prisma.form.delete({
    where: { id },
  });

  revalidatePath("/forms");
  return { success: true };
}

/**
 * Create a form submission – unchanged (still public)
 */
export async function createFormSubmission(formId: string, submissionData: any) {
  return prisma.formSubmission.create({
    data: {
      formId,
      data: submissionData.data,
      metadata: submissionData.metadata,
      linearIssueId: submissionData.linearIssueId,
    },
  });
}

/**
 * Get submissions for a form – still requires auth (keep restriction)
 */
export async function getFormSubmissions(formId: string) {
  // Keeping submissions private for now; remove the relation to user ownership
  return prisma.formSubmission.findMany({
    where: { formId },
    orderBy: { createdAt: "desc" },
  });
} 