"use client";
import React, { useState, useEffect, Suspense } from "react";
import { FormBuilder } from "@/components/form-builder/form-builder";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSearchParams, useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useSession } from "next-auth/react";

function SettingsPageInner() {
  const [activeSection, setActiveSection] = useState("form");
  const searchParams = useSearchParams();
  const router = useRouter();
  const formId = searchParams.get('formId');
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  // Saved forms state (database-backed)
  const [savedForms, setSavedForms] = useState<any[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForms = async () => {
    try {
      setLoadingForms(true);

      if (isAuthenticated) {
        // Fetch from database
        const res = await fetch("/api/forms", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setSavedForms(json.data ?? []);
      } else {
        // Fallback to localStorage for unauthenticated users
        const savedRaw = localStorage.getItem("savedForms");
        const localForms = savedRaw ? JSON.parse(savedRaw) : [];
        setSavedForms(localForms);
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching forms", err);
      setError("Failed to load forms");
    } finally {
      setLoadingForms(false);
    }
  };

  // Load once on mount and when tab gains focus (for updates)
  useEffect(() => {
    if (isAuthenticated) {
      fetchForms();
      window.addEventListener("focus", fetchForms);
      return () => window.removeEventListener("focus", fetchForms);
    }
  }, [isAuthenticated]);

  // Switch to form view when formId is present in URL
  useEffect(() => {
    if (formId) {
      setActiveSection("form");
    }
  }, [formId]);

  // Refresh from DB when switching to tab
  useEffect(() => {
    if (activeSection === "savedForms") {
      fetchForms();
    }
  }, [activeSection]);

  const handleDeleteForm = async (id: string) => {
    if (!confirm("Delete this form?")) return;

    if (!isAuthenticated) {
      // Remove from localStorage
      try {
        const savedRaw = localStorage.getItem("savedForms");
        const localForms = savedRaw ? JSON.parse(savedRaw) : [];
        const updated = localForms.filter((f: any) => f.id !== id);
        localStorage.setItem("savedForms", JSON.stringify(updated));
        setSavedForms(updated);
      } catch (err) {
        console.error("Failed to delete local form", err);
      }
      return;
    }

    // Authenticated: delete via API
    try {
      await fetch(`/api/forms/${id}`, { method: "DELETE" });
      fetchForms();
    } catch (err) {
      console.error("Failed to delete", err);
      alert("Failed to delete form");
    }
  };

  const handleEditForm = (id: string) => {
    // Programmatically navigate and force the view to change
    router.push(`/settings?formId=${id}`);
    setActiveSection("form");
  };

  // Menu items for the settings sidebar
  const menuItems = [
    { id: "form", label: "Form Builder" },
    { id: "savedForms", label: "Saved Forms" },
    // Future menu items can be appended here.
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen">
        {/* Settings Sidebar */}
        <AppSidebar
          menuItems={menuItems}
          activeSection={activeSection}
          onSelect={setActiveSection}
        />

        {/* Main Content */}
        <main className="bg-background min-h-screen pb-6 w-full mt-[3.5rem] md:ml-64 md:w-[calc(100vw-17rem)] overflow-hidden">
          {/* Trigger only visible on small screens */}
          <div className="p-1 md:hidden">
            <SidebarTrigger size="icon" variant="ghost" />
          </div>

          <div className="w-full mx-auto mt-2 overflow-hidden">
            <div className="bg-background rounded-lg shadow-md p-3 md:p-5 border border-border max-w-[850px] mx-auto overflow-hidden">
              {activeSection === "form" && (
                <section id="form-section" className="w-full overflow-hidden">
                  <h2 className="text-lg font-semibold mb-2">Feature Request Form Builder</h2>
                  <p className="text-sm text-muted-foreground mb-2">
                    Design and customize the feature request form that customers will see.
                  </p>
                  <div className="max-w-[800px] mx-auto">
                    <FormBuilder />
                  </div>
                </section>
              )}

              {activeSection === "savedForms" && (
                <section id="saved-forms-section" className="w-full">
                  <h2 className="text-lg font-semibold mb-2">Saved Forms</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    View, edit or delete your previously saved forms.
                  </p>
                  <div className="mb-4">
                    <Button onClick={fetchForms} variant="outline" size="sm">
                      Refresh Forms
                    </Button>
                  </div>
                  {loadingForms ? (
                    <p className="text-muted-foreground">Loading forms...</p>
                  ) : error ? (
                    <p className="text-destructive text-sm">{error}</p>
                  ) : savedForms.length === 0 ? (
                    <p className="text-muted-foreground">No forms found.</p>
                  ) : (
                    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
                      {savedForms.map((form) => (
                        <Card key={form.id} className="p-4 flex flex-col hover:shadow-md transition-shadow">
                          <h3 className="text-xl font-semibold mb-1">
                            {form?.title || form?.formSettings?.title || "Untitled Form"}
                          </h3>
                          {(form?.description || form?.formSettings?.description) && (
                            <p className="text-muted-foreground mb-4 text-sm">
                              {form?.description || form?.formSettings?.description}
                            </p>
                          )}
                          <div className="mt-auto flex gap-2">
                            <Button onClick={() => handleEditForm(form.id)}>
                              Edit
                            </Button>
                            <Button variant="destructive" onClick={() => handleDeleteForm(form.id)}>
                              Delete
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  );
} 