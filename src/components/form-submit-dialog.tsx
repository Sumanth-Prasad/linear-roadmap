'use client';

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SavedForm, FormField } from "@/components/form-builder/core/types";
import { submitFormIssue } from "@/app/actions";
import { ArrowLeft } from "lucide-react";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { isValidPhoneNumber } from 'react-phone-number-input';

interface FormSubmitDialogProps {
  teamId: string;
  projectId?: string;
  triggerText?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

// Dedicated phone field component to allow country selection and proper formatting
function PhoneField({ field, common }: { field: FormField; common: any }) {
  const [value, setValue] = useState<string | undefined>();

  return (
    <div className="mb-4">
      <PhoneInput
        {...common}
        international
        defaultCountry={field.countryCode || 'US'}
        value={value}
        onChange={setValue}
        smartCaret
        error={value ? (isValidPhoneNumber(value) ? undefined : 'Invalid phone number') : undefined}
        className="PhoneInput--full-width"
      />
    </div>
  );
}

// Helper to render input for a form field with solid background
function renderFieldInput(field: FormField) {
  const common: any = {
    name: field.id,
    required: field.required,
    placeholder: field.placeholder,
    className: "w-full border rounded px-3 py-2 mb-4 bg-input text-foreground",
  };

  switch (field.type) {
    case "textarea":
      return <textarea {...common} rows={4}></textarea>;
    case "select":
      return (
        <select {...common} defaultValue="" className={`${common.className} bg-input`}>
          <option value="" disabled>
            {field.placeholder || "Select"}
          </option>
          {field.options?.map((o, i) => (
            <option value={o} key={i}>
              {o}
            </option>
          ))}
        </select>
      );
    case "checkbox":
    case "radio":
      return (
        <div className="mb-4">
          {field.options?.map((o, i) => (
            <label key={i} className="flex items-center gap-2 mb-1">
              <input type={field.type} name={field.id} value={o} /> {o}
            </label>
          ))}
        </div>
      );
    case "phone": {
      return <PhoneField field={field} common={common} />;
    }
    default:
      return <input type={field.type === "email" ? "email" : "text"} {...common} />;
  }
}

export function FormSubmitDialog({
  teamId,
  projectId,
  triggerText = "Submit Request",
  variant = "default",
  size = "default",
}: FormSubmitDialogProps) {
  const [forms, setForms] = useState<SavedForm[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'select' | 'fill'>('select');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/forms?teamId=${teamId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        let data = json.data ?? [];

        // Map DB schema to SavedForm-like objects for compatibility
        data = data.map((f: any) => ({
          id: f.id,
          fields: f.fields,
          linearSettings: f.linearSettings ?? {},
          formSettings: f.settings ?? f.formSettings ?? {},
          title: f.title,
          description: f.description,
        }));

        // Filter by projectId if provided
        const filtered = projectId ? data.filter((f: any) => f.linearSettings?.project === projectId) : data;

        setForms(filtered);
        if (filtered.length) setSelectedId(filtered[0].id);
        setError(null);
      } catch (err) {
        console.error('Error fetching forms', err);
        setError('Unable to load forms');
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, [teamId, projectId]);

  if (loading) {
    return (
      <Button variant={variant} size={size} disabled className="opacity-70 my-forced-opaque-button dull-cta-button">
        Loading...
      </Button>
    );
  }

  if (error || !forms.length) {
    return (
      <Button variant={variant} size={size} disabled className="opacity-70 my-forced-opaque-button dull-cta-button">
        Create Form First
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="my-forced-opaque-button super-cta-button">{triggerText}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto bg-card border border-border shadow-lg" style={{backgroundColor:'var(--card)', opacity:1}}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {view === 'fill' && (
              <button type="button" onClick={() => setView('select')} className="p-1 rounded hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <DialogTitle>{view === 'select' ? 'Choose a Form' : 'Submit Request'}</DialogTitle>
          </div>
        </DialogHeader>

        {view === 'select' && (
          <div className="space-y-3">
            {forms.map((f) => (
              <button
                key={f.id}
                onClick={() => { setSelectedId(f.id); setView('fill'); }}
                className="w-full text-left border rounded p-3 bg-card/90 hover:bg-muted flex items-start gap-3"
              >
                <span className="text-2xl">{f.formSettings.emoji}</span>
                <div>
                  <h3 className="font-medium">{f.formSettings.title}</h3>
                  {f.formSettings.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{f.formSettings.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {view === 'fill' && selectedId && (
          <FormRenderer
            form={forms.find((f) => f.id === selectedId)!}
            teamId={teamId}
            projectId={projectId}
            onSuccess={() => {setOpen(false); setView('select');}}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormRendererProps {
  form: SavedForm;
  teamId: string;
  projectId?: string;
  onSuccess: () => void;
}

function FormRenderer({ form, teamId, projectId, onSuccess }: FormRendererProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("teamId", teamId);
    formData.set("projectId", projectId || "");
    formData.set("formId", form.id);
    formData.set("linearSettings", JSON.stringify(form.linearSettings));

    const res = await submitFormIssue(formData);
    if (res.success) {
      onSuccess();
      alert("Request submitted! Issue ID: " + res.issueId);
    } else {
      setError(res.error || "Unknown error");
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <span>{form.formSettings.emoji}</span> {form.formSettings.title}
      </h3>
      {form.formSettings.description && (
        <p className="text-sm text-muted-foreground mb-4">
          {form.formSettings.description}
        </p>
      )}

      {form.fields.map((field) => (
        <div key={field.id} className="w-full">
          <label className="block text-sm font-medium mb-1">
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </label>
          {renderFieldInput(field)}
        </div>
      ))}

      {/* Hidden meta */}
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="projectId" value={projectId || ""} />
      <input type="hidden" name="formId" value={form.id} />
      <input type="hidden" name="linearSettings" value={JSON.stringify(form.linearSettings)} />

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Submitting..." : "Submit"}
      </Button>
    </form>
  );
} 