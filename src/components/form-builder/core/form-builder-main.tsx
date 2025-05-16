"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import validator from 'validator';
import { CursorStyleFix } from "../mentions/cursor-style-fix";
import { FormToolbar } from "./form-toolbar";
import { FormPreview } from "./form-preview";
import { FormSettingsPanel } from "./form-settings";
import { FieldEditor } from "../fields/field-editor";
import { LinearSettings } from "../linear/linear-settings";
import { MentionPopup } from "../mentions/mention-popup";
import { updateMentionPositions, processMentionSelection } from "../mentions/mention-utils";
import { getDefaultPlaceholder, createNewField } from "../utils/field-utils";
import { updateField, removeField as removeFieldOp, addOption, removeOption, updateOption } from "../utils/field-operations";
import type { FieldType, FormField, FieldMention, MentionMenuState, LinearIntegrationSettings, FormSettings, FormType, SavedForm } from "./types";
import { LexicalBadgeEditor } from "@/components/LexicalBadgeEditor";
import { useSearchParams } from 'next/navigation';
import { createForm, updateForm } from "@/lib/form-service";
import { useSession } from "next-auth/react";

// Add the global declaration for our helper methods
declare global {
  interface Window {
    _badgeInputHelpers?: {
      [fieldId: string]: {
        restoreCursorAfterDelete: (position: number) => void;
      };
    };
  }
}

// ========== FORM BUILDER COMPONENT ==========
export default function FormBuilder() {
  // ===== STATE MANAGEMENT =====
  // Form field state
  const [fields, setFields] = useState<FormField[]>([
    {
      id: "title",
      type: "text",
      label: "Feature Title",
      placeholder: "Enter a title for your feature request",
      required: true,
    },
    {
      id: "description",
      type: "textarea",
      label: "Description",
      placeholder: "Describe the feature you'd like to see",
      required: true,
    },
  ]);
  
  // Form settings state
  const [formSettings, setFormSettings] = useState<FormSettings>({
    title: "Feature Request Form",
    type: "feature",
    description: "Submit a feature request for our product.",
    emoji: "✨"
  });
  
  // Linear integration state
  const [linearSettings, setLinearSettings] = useState<LinearIntegrationSettings>({
    issueType: 'customer_request',
    team: '',
    includeCustomerInfo: true,
    defaultTitle: '',
    responseMessage: '',
    priority: 'no_priority',
  });
  
  // UI state
  const [activeField, setActiveField] = useState<string | null>(null);
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [showLinearSettings, setShowLinearSettings] = useState(false);
  const [disableSearchByDefault, setDisableSearchByDefault] = useState(true);
  
  // ===== LOAD EXISTING FORM IF QUERY PARAM PROVIDED =====
  const searchParams = useSearchParams();
  const initialFormId = searchParams.get('formId');
  const [formId, setFormId] = useState<string | null>(initialFormId);
  
  // Mention system state
  const [mentionMenu, setMentionMenu] = useState<MentionMenuState>({
    isOpen: false,
    inputId: null,
    position: { top: 0, left: 0 },
    searchTerm: "",
  });
  const [mentions, setMentions] = useState<Record<string, FieldMention[]>>({});
  
  // Validation state
  const [emailValidation, setEmailValidation] = useState<{
    [key: string]: { isValid: boolean | null; message: string }
  }>({});
  
  // ===== REFS =====
  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  const formContainerRef = useRef<HTMLDivElement>(null);
  const formFieldsRef = useRef<HTMLFormElement>(null);

  // ===== DRAG AND DROP SETUP =====
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ===== FIELD OPERATIONS =====
  // Add a new field
  const handleAddField = () => {
    const newField = createNewField(newFieldType);
    setFields([...fields, newField]);
    setActiveField(newField.id);
  };
  
  // Remove a field
  const handleRemoveField = (id: string) => {
    const { updatedFields, newActiveField } = removeFieldOp(fields, id, activeField);
    setFields(updatedFields);
    setActiveField(newActiveField);
  };
  
  // Update a field
  const handleUpdateField = (id: string, updates: Partial<FormField>) => {
    setFields(updateField(fields, id, updates));
  };
  
  // ===== VALIDATION =====
  // Email validation
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>, fieldId: string) => {
    const value = e.target.value;
    
    // Update the field
    handleUpdateField(fieldId, { placeholder: value });
    
    // Skip validation if empty
    if (!value) {
      setEmailValidation(prev => ({
        ...prev,
        [fieldId]: { isValid: null, message: '' }
      }));
      return;
    }
    
    // Validate email
    const isValid = validator.isEmail(value);
    setEmailValidation(prev => ({
      ...prev,
      [fieldId]: {
        isValid,
        message: isValid ? 'Valid email format' : 'Invalid email format'
      }
    }));
  };
  
  // ===== MENTION SYSTEM =====
  // Handle @ mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldId: string) => {
    const inputElement = e.target;
    const value = inputElement.value;
    const caretPosition = inputElement.selectionStart || 0;
    
    // Check for @ symbol and show mention menu if needed
    detectAndPositionMentionMenu(inputElement, value, caretPosition, fieldId);
    
    // Update field or linear settings based on the field ID
    updateFieldOrSettingValue(fieldId, value);
    
    // Update mentions positions when text changes
    const updatedMentions = updateMentionPositions(value, mentions[fieldId] || []);
    setMentions(prev => ({
      ...prev,
      [fieldId]: updatedMentions
    }));
  };
  
  // Helper: Detect @ and position the mention menu
  const detectAndPositionMentionMenu = (
    inputElement: HTMLInputElement | HTMLTextAreaElement, 
    value: string, 
    caretPosition: number, 
    fieldId: string
  ) => {
    const textBeforeCaret = value.substring(0, caretPosition);
    const atSymbolIndex = textBeforeCaret.lastIndexOf('@');
    
    // Check if @ is already processed
    const hasZeroWidthSpace = atSymbolIndex > -1 && 
      value.charAt(atSymbolIndex + 1) === '\u200D';
    
    if (atSymbolIndex !== -1 && !hasZeroWidthSpace && 
       (atSymbolIndex === 0 || textBeforeCaret[atSymbolIndex - 1] === ' ')) {
      // Found unprocessed @ symbol, show mention menu
      const searchTerm = textBeforeCaret.substring(atSymbolIndex + 1).toLowerCase();
      
      console.log('@ detected at index:', atSymbolIndex);
      
      // Get input element's position
      const inputRect = inputElement.getBoundingClientRect();
      const isTextarea = inputElement.tagName.toLowerCase() === 'textarea';
      const containerRect = formContainerRef.current?.getBoundingClientRect() || { top: 0, left: 0 };
      const computedStyle = window.getComputedStyle(inputElement);
      
      // Create a temporary span to measure text width
      const tempSpan = document.createElement('span');
      tempSpan.style.font = computedStyle.font;
      tempSpan.style.fontSize = computedStyle.fontSize;
      tempSpan.style.fontFamily = computedStyle.fontFamily;
      tempSpan.style.letterSpacing = computedStyle.letterSpacing;
      tempSpan.style.position = 'absolute';
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.whiteSpace = 'pre';
      
      let top, left;
      
      if (isTextarea) {
        // For textareas, position based on line breaks
        const lines = textBeforeCaret.split('\n');
        const lineBreaks = lines.length - 1;
        const currentLine = lines[lineBreaks];
        const lineHeight = parseInt(computedStyle.lineHeight) || 20;
        
        // Find position of @ in current line
        const atPosInCurrentLine = currentLine.indexOf('@');
        if (atPosInCurrentLine >= 0) {
          // Measure width of text up to @
          tempSpan.textContent = currentLine.substring(0, atPosInCurrentLine + 1); // Include @ for exact positioning
          document.body.appendChild(tempSpan);
          const atWidth = tempSpan.getBoundingClientRect().width;
          document.body.removeChild(tempSpan);
          
          // Calculate precise position
          const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
          // Position to the right of @ symbol with some vertical offset for textarea
          top = inputRect.top - containerRect.top + (lineBreaks * lineHeight) + 5;
          left = inputRect.left - containerRect.left + paddingLeft + atWidth + 2; // Position to right of @ symbol
        } else {
          // Fallback
          top = inputRect.top - containerRect.top + (lineBreaks * lineHeight) + 5;
          left = inputRect.left - containerRect.left + 20;
        }
      } else {
        // For regular inputs
        // Measure width of text up to @
        tempSpan.textContent = textBeforeCaret.substring(0, atSymbolIndex + 1); // Include @ for exact positioning
        document.body.appendChild(tempSpan);
        const atWidth = tempSpan.getBoundingClientRect().width;
        document.body.removeChild(tempSpan);
        
        const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
        // For inputs, position to the right of @ at the same vertical level
        top = inputRect.top - containerRect.top + (inputRect.height / 2) - 15; // Vertically center, with slight adjustment
        left = inputRect.left - containerRect.left + paddingLeft + atWidth + 2; // Position to right of @ symbol
      }
      
      console.log('Input rect:', inputRect);
      console.log('Container rect:', containerRect);
      console.log('Positioning popup at:', { top, left });
      
      setMentionMenu({
        isOpen: true,
        inputId: fieldId,
        position: { top, left },
        searchTerm,
      });
    } else if (mentionMenu.isOpen && mentionMenu.inputId === fieldId) {
      // Close the menu if there's no @ before the caret
      setMentionMenu({ ...mentionMenu, isOpen: false });
    }
  };
  
  // Helper: Calculate mention menu position
  const calculateMentionMenuPosition = (
    inputElement: HTMLInputElement | HTMLTextAreaElement,
    textBeforeCaret: string,
    atSymbolIndex: number
  ) => {
    // Create temporary measurement span
    const tempSpan = document.createElement('span');
    tempSpan.style.font = window.getComputedStyle(inputElement).font;
    tempSpan.style.position = 'absolute';
    tempSpan.style.visibility = 'hidden';
    tempSpan.textContent = textBeforeCaret.substring(0, atSymbolIndex + 1);
    document.body.appendChild(tempSpan);
    
    const inputRect = inputElement.getBoundingClientRect();
    const textWidth = tempSpan.getBoundingClientRect().width;
    document.body.removeChild(tempSpan);
    
    // Calculate offsets for textarea vs input
    const isTextarea = inputElement.tagName.toLowerCase() === 'textarea';
    const lineHeight = parseInt(window.getComputedStyle(inputElement).lineHeight) || 20;
    const linesBefore = isTextarea ? textBeforeCaret.split('\n').length - 1 : 0;
    
    // Calculate position in current line for textarea
    const lastNewlineIndex = isTextarea ? textBeforeCaret.lastIndexOf('\n') : -1;
    const textWidthInCurrentLine = isTextarea && lastNewlineIndex !== -1 
      ? (() => {
          const lineText = textBeforeCaret.substring(lastNewlineIndex + 1, atSymbolIndex + 1);
          const lineSpan = document.createElement('span');
          lineSpan.style.font = window.getComputedStyle(inputElement).font;
          lineSpan.style.position = 'absolute';
          lineSpan.style.visibility = 'hidden';
          lineSpan.textContent = lineText;
          document.body.appendChild(lineSpan);
          const width = lineSpan.getBoundingClientRect().width;
          document.body.removeChild(lineSpan);
          return width;
        })()
      : textWidth;
    
    return {
      top: inputRect.top + (isTextarea ? linesBefore * lineHeight + lineHeight : inputRect.height),
      left: inputRect.left + (isTextarea && lastNewlineIndex !== -1 ? textWidthInCurrentLine : textWidth),
    };
  };
  
  // Helper: Update field or linear settings value
  const updateFieldOrSettingValue = (fieldId: string, value: string) => {
    if (fieldId === 'response_message') {
      setLinearSettings({...linearSettings, responseMessage: value});
    } else if (fieldId === 'default_title') {
      setLinearSettings({...linearSettings, defaultTitle: value});
    } else {
      // It's a regular form field
      handleUpdateField(fieldId, { placeholder: value });
    }
  };
  
  // Handle mention selection
  const handleMentionSelect = (selectedFieldId: string) => {
    if (!mentionMenu.inputId) return;
    
    const inputElement = inputRefs.current.get(mentionMenu.inputId);
    if (!inputElement) return;
    
    const currentInputId = mentionMenu.inputId; 
    const currentSearchTerm = mentionMenu.searchTerm;
    
    // Process mention selection
    try {
      const value = inputElement.value;
      const caretPosition = inputElement.selectionStart || 0;
      
      const { newValue, newCaretPosition, mention } = processMentionSelection(
        selectedFieldId,
        fields,
        value,
        caretPosition,
        currentSearchTerm
      );
      
      // Close menu
      setMentionMenu({
        isOpen: false,
        inputId: null,
        position: { top: 0, left: 0 },
        searchTerm: ""
      });
      
      // Update field or settings value
      updateFieldOrSettingValue(currentInputId, newValue);
      
      // Update mentions state
      setMentions(prev => {
        const fieldMentions = prev[currentInputId] || [];
        return {
          ...prev,
          [currentInputId]: [...fieldMentions, mention]
        };
      });
      
      // Store cursor position for a ref to use later
      const desiredCursorPos = newCaretPosition;
      
      // Use timeout to ensure the component has updated
      setTimeout(() => {
        // Ensure the input has the updated value
        inputElement.value = newValue;
        
        // Focus and set cursor position
        inputElement.focus();
        
        // Set cursor position
        inputElement.setSelectionRange(desiredCursorPos, desiredCursorPos);
        
        // Log for debugging
        console.log('Set cursor to position:', desiredCursorPos);
      }, 100);
    } catch (error) {
      console.error("Error processing mention selection:", error);
      
      // Close menu on error
      setMentionMenu({
        isOpen: false,
        inputId: null,
        position: { top: 0, left: 0 },
        searchTerm: ""
      });
    }
  };

  // Handle mention removal
  const handleRemoveMention = (
    fieldId: string,
    mentionId: string,
    mentionStartPos: number,
    mentionEndPos: number
  ) => {
    console.log('Removing mention:', { fieldId, mentionId, mentionStartPos, mentionEndPos });
    
    // Get input element first - we need to ensure we have access to it
    const inputEl = inputRefs.current.get(fieldId);
    if (!inputEl) {
      console.error('Input element not found for mention removal');
      return;
    }
    
    try {
      // CRITICAL: Store the exact position where the cursor should be after deletion
      const targetCursorPos = mentionStartPos;
      console.log(`Target cursor position after deletion: ${targetCursorPos}`);
      
      // Get current value from the actual input element
      let currentValue = inputEl.value;
      
      // Replace the zero-width joiner with an empty string (removing it completely)
      const newValue = currentValue.substring(0, mentionStartPos) + 
        currentValue.substring(mentionEndPos);
      
      // Update field or settings value first
      updateFieldOrSettingValue(fieldId, newValue);
      
      // Then update mentions state
      setMentions(prev => {
        const updatedMentions = {
          ...prev,
          [fieldId]: (prev[fieldId] || []).filter(m => 
            !(m.id === mentionId && m.startPos === mentionStartPos))
        };
        console.log('Updated mentions:', updatedMentions);
        return updatedMentions;
      });
      
      // Try to use the badge input helper if available
      if (window._badgeInputHelpers && window._badgeInputHelpers[fieldId]) {
        console.log('Using badge input helper to restore cursor');
        window._badgeInputHelpers[fieldId].restoreCursorAfterDelete(targetCursorPos);
      }
      
      // Also use our direct DOM approach as backup
      setTimeout(() => {
        if (!inputEl) return;
        
        // Now make direct DOM changes
        inputEl.value = newValue;
        
        // Force focus
        inputEl.focus();
        
        // Set cursor to the target position
        inputEl.setSelectionRange(targetCursorPos, targetCursorPos);
        
        // Put this in a requestAnimationFrame to ensure it happens after layout
        requestAnimationFrame(() => {
          if (!inputEl) return;
          // Double-check focus and cursor position
          inputEl.focus();
          inputEl.setSelectionRange(targetCursorPos, targetCursorPos);
        });
      }, 0);
      
      // Schedule one more focus attempt
      setTimeout(() => {
        if (!inputEl) return;
        inputEl.focus();
        inputEl.setSelectionRange(targetCursorPos, targetCursorPos);
      }, 50);

      // Final cleanup to ensure proper cursor position and focus
      [100, 200, 300].forEach(delay => {
        setTimeout(() => {
          try {
            if (!inputEl) return;
            if (document.activeElement !== inputEl) {
              inputEl.focus();
            }
            inputEl.setSelectionRange(targetCursorPos, targetCursorPos);
          } catch (err) {
            console.error(`Error in final focus recovery at ${delay}ms:`, err);
          }
        }, delay);
      });
    } catch (err) {
      console.error('Error in handleRemoveMention:', err);
    }
  };

  // Handle keyboard events (esp. for deleting mentions)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, fieldId: string) => {
    const inputElement = e.currentTarget;
    const value = inputElement.value;
    const caretPosition = inputElement.selectionStart || 0;
    
    // Handle backspace for badge removal
    if (e.key === 'Backspace' && caretPosition > 0) {
      // Check if the previous character is our marker
      if (value.charAt(caretPosition - 1) === '\u200D') {
        e.preventDefault(); // Prevent default backspace behavior
        
        // Find and remove the mention
        const fieldMentions = mentions[fieldId] || [];
        const mentionIndex = fieldMentions.findIndex(mention => 
          mention.startPos === caretPosition - 1);
        
        if (mentionIndex !== -1) {
          // Get the mention details
          const mention = fieldMentions[mentionIndex];
          
          // Calculate cursor position
          const targetCursorPos = mention.startPos;
          console.log(`Backspace press detected - target cursor position: ${targetCursorPos}`);
          
          // Store the cursor position directly in the badge input helper
          if (window._badgeInputHelpers && window._badgeInputHelpers[fieldId]) {
            // Pre-notify the BadgeInput component where the cursor should be
            console.log('Pre-notifying BadgeInput component about cursor position');
            window._badgeInputHelpers[fieldId].restoreCursorAfterDelete(targetCursorPos);
          }
          
          // Now remove the mention
          handleRemoveMention(fieldId, mention.id, mention.startPos, mention.endPos);
        }
      }
    }
  };

  // Close mention menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionMenu.isOpen) {
        const mentionMenuElement = document.querySelector('.mention-dropdown');
        if (mentionMenuElement && !mentionMenuElement.contains(e.target as Node)) {
          setMentionMenu({ ...mentionMenu, isOpen: false });
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mentionMenu]);

  // Ensure input focus is maintained when needed
  useEffect(() => {
    if (mentionMenu.inputId) {
      const inputElement = inputRefs.current.get(mentionMenu.inputId);
      if (inputElement && document.activeElement !== inputElement) {
        inputElement.focus();
      }
    }
  }, [mentionMenu.inputId, mentions]);

  // Load form data when formId is present
  useEffect(() => {
    if (!initialFormId) return;

    const loadForm = async () => {
      try {
        // Try localStorage first (legacy)
        const savedRaw = localStorage.getItem('savedForms');
        if (savedRaw) {
          const savedForms: SavedForm[] = JSON.parse(savedRaw);
          const existing = savedForms.find((f) => f.id === initialFormId);
          if (existing) {
            setFields(existing.fields);
            setFormSettings(existing.formSettings);
            setLinearSettings(existing.linearSettings);
            return;
          }
        }

        // Fallback to DB via API route
        const res = await fetch(`/api/forms/${initialFormId}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            const form = json.data;
            setFields(form.fields || []);
            setFormSettings(form.settings || {});
            setLinearSettings(form.linearSettings || {});
          }
        }
      } catch (err) {
        console.error('Error loading form', err);
      }
    };

    loadForm();
  }, [initialFormId]);

  // Disabled automatic title format update; users can input their own.
  useEffect(() => {
    // Intentionally left blank to prevent overriding custom default title.
  }, [formSettings.type, formSettings.customType, formSettings.emoji]);

  // ===== RENDER =====
  const { data: session } = useSession();

  const handleSaveForm = async () => {
    // Prepare form data
    const formData = {
      title: formSettings.title,
      description: formSettings.description,
      teamId: linearSettings.team,
      projectId: linearSettings.project,
      fields: fields,
      settings: formSettings,
      linearSettings: linearSettings
    };

    // If user is authenticated, use server actions (DB)
    if (session?.user?.id) {
      try {
        let savedForm;
        if (formId) {
          savedForm = await updateForm(formId, formData);
        } else {
          savedForm = await createForm(formData);
          setFormId(savedForm.id);
        }
        alert('Form saved to database!');
      } catch (err) {
        console.error('Error saving form', err);
        alert('Failed to save form to database.');
      }
      return;
    }

    // ----- Offline/local fallback for unauthenticated users -----
    try {
      const savedRaw = localStorage.getItem('savedForms');
      const savedForms: any[] = savedRaw ? JSON.parse(savedRaw) : [];

      if (formId) {
        // Update existing local form
        const idx = savedForms.findIndex((f) => f.id === formId);
        if (idx > -1) {
          savedForms[idx] = { ...savedForms[idx], ...formData, formSettings: formSettings };
        }
      } else {
        // Generate a simple id and store new
        const newId = `local_${Date.now()}`;
        setFormId(newId);
        savedForms.push({ id: newId, ...formData, formSettings: formSettings });
      }

      localStorage.setItem('savedForms', JSON.stringify(savedForms));
      alert('Form saved locally (not logged in). It will only be available on this device.');
    } catch (err) {
      console.error('Local save failed', err);
      alert('Failed to save form locally.');
    }
  };

  return (
    <div className="relative bg-background text-foreground form-builder-container" ref={formContainerRef}>
      <CursorStyleFix />
      
      {/* Toolbar */}
      <FormToolbar 
        newFieldType={newFieldType}
        setNewFieldType={setNewFieldType}
        onAddField={handleAddField}
        onSave={handleSaveForm}
      />
      
      {/* Form Settings */}
      <FormSettingsPanel 
        settings={formSettings} 
        onUpdateSettings={setFormSettings} 
      />
      
      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Form preview panel */}
        <div className="lg:col-span-7">
          <FormPreview 
            fields={fields}
            formSettings={formSettings}
            activeField={activeField}
            setActiveField={setActiveField}
            setFields={setFields}
            emailValidation={emailValidation}
            sensors={sensors}
            formFieldsRef={formFieldsRef}
          />
        </div>
        
        {/* Field editor panel */}
        <div className="lg:col-span-5">
          <FieldEditor 
            activeField={activeField}
            fields={fields}
            onUpdateField={handleUpdateField}
            onRemoveField={handleRemoveField}
            onAddOption={(fieldId) => setFields(addOption(fields, fieldId))}
            onRemoveOption={(fieldId, index) => setFields(removeOption(fields, fieldId, index))}
            onUpdateOption={(fieldId, index, value) => setFields(updateOption(fields, fieldId, index, value))}
            handleEmailChange={handleEmailChange}
            handleInputChange={handleInputChange}
            inputRefs={inputRefs}
            emailValidation={emailValidation}
          />
        </div>
      </div>
      
      {/* Linear integration settings */}
      <LinearSettings 
        linearSettings={linearSettings}
        setLinearSettings={setLinearSettings}
        formSettings={formSettings}
        showLinearSettings={showLinearSettings}
        setShowLinearSettings={setShowLinearSettings}
        mentions={mentions}
        disableSearchByDefault={disableSearchByDefault}
        setDisableSearchByDefault={setDisableSearchByDefault}
        handleInputChange={handleInputChange}
        handleKeyDown={handleKeyDown}
        handleRemoveMention={handleRemoveMention}
        inputRefs={inputRefs}
        fields={fields}
      />

      {/* Mention popup (shadcn Combobox) */}
      <MentionPopup 
        mentionMenu={mentionMenu}
        fields={fields}
        onSearchChange={(value) => setMentionMenu({...mentionMenu, searchTerm: value})}
        onSelectItem={handleMentionSelect}
        disableSearchByDefault={disableSearchByDefault}
      />
    </div>
  );
} 