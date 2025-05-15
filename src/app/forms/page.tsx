"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SavedForm } from "@/components/form-builder/core/types";
import { getUserForms, deleteForm } from "@/lib/form-service";

export default function SavedFormsPage() {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved forms from database
  const loadForms = async () => {
    try {
      setLoading(true);
      const data = await getUserForms();
      setForms(data);
      setError(null);
    } catch (err) {
      console.error("Failed to load saved forms", err);
      setError("Failed to load forms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this form?")) {
      return;
    }
    
    try {
      await deleteForm(id);
      // Reload forms after deletion
      loadForms();
    } catch (err) {
      console.error("Failed to delete form", err);
      alert("Failed to delete form. Please try again.");
    }
  };

  return (
    <main className="container max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Forms</h1>
        <Button asChild>
          <Link href="/settings">Create New Form</Link>
        </Button>
      </div>
      
      {loading && <p className="text-muted-foreground">Loading forms...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      {!loading && forms.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">You haven't created any forms yet.</p>
          <Button asChild>
            <Link href="/settings">Create Your First Form</Link>
          </Button>
        </div>
      )}
      
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
        {forms.map((form) => (
          <Card key={form.id} className="p-4 flex flex-col hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-1">
              {form.title}
            </h2>
            {form.description && (
              <p className="text-muted-foreground mb-4 text-sm">
                {form.description}
              </p>
            )}
            <div className="text-sm text-muted-foreground mt-2 mb-4">
              Last updated: {new Date(form.updatedAt).toLocaleDateString()}
            </div>
            <div className="mt-auto flex gap-2">
              <Button asChild>
                <Link href={`/settings?formId=${form.id}`}>Edit</Link>
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(form.id)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
} 