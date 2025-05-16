"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useEffect, useRef, useCallback } from 'react';
import TurndownService from 'turndown';
import { marked } from 'marked';

interface TipTapCommentEditorProps {
  value: string; // Markdown string
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string | number;
}

// Initialize Turndown service
const turndownService = new TurndownService();

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// Basic styling for the editor content (can be expanded)
const editorStyles = `
  .ProseMirror {
    padding: 0.75rem;
    outline: none;
    overflow-y: auto;
  }
  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #adb5bd;
    pointer-events: none;
    height: 0;
  }
  .ProseMirror img {
    max-width: 100%;
    height: auto;
    display: block; /* or inline-block if preferred */
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    border-radius: 4px;
  }
  .ProseMirror a {
    color: #5c9be4;
    text-decoration: underline;
  }
`;

export function TipTapCommentEditor({
  value,
  onChange,
  placeholder = "Write a comment...",
  className = "",
  minHeight = "120px",
}: TipTapCommentEditorProps) {
  // Track the last value we received from outside
  const lastValueRef = useRef(value);
  // Track the last HTML we generated inside the editor
  const lastEditorHtmlRef = useRef('');
  // Flag to track if an update is from TipTap or from outside
  const isInternalUpdateRef = useRef(false);

  // Create a debounced onChange function that we'll use for editor updates
  const debouncedOnChange = useCallback(
    debounce((html: string) => {
      isInternalUpdateRef.current = true;
      const markdown = turndownService.turndown(html);
      lastEditorHtmlRef.current = html;
      onChange(markdown);
      // Reset the flag after a small delay to allow React state to update
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 20);
    }, 50), // 50ms debounce, adjust as needed
    [onChange]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // configure markdown-specific features if needed, though it mostly works via HTML conversion
      }),
      Image.configure({
        inline: false, // Allows images to be on their own line, can be true for inline with text
        allowBase64: true, // If you were to paste base64 images
      }),
    ],
    content: '', // Initial content set via useEffect
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Only update if the HTML has actually changed from what we last saw
      if (html !== lastEditorHtmlRef.current) {
        debouncedOnChange(html);
      }
    },
  });

  // Handle external value changes (when value prop changes)
  useEffect(() => {
    // If this update was triggered by our own onUpdate handler, skip
    if (isInternalUpdateRef.current) return;
    
    // If editor is ready and the value has actually changed
    if (editor && !editor.isDestroyed && value !== lastValueRef.current) {
      lastValueRef.current = value; // Update our reference
      
      // Convert markdown to HTML
      const html = marked(value) as string;
      
      // Only update content if it's meaningfully different from current
      const currentHtml = editor.getHTML();
      if (html !== currentHtml) {
        editor.commands.setContent(html, false); // false to prevent onUpdate trigger
        lastEditorHtmlRef.current = html; // Update our reference of what's in the editor
      }
    }
  }, [value, editor]);

  // Set initial content once editor is ready if value is present
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEmpty && value && value.trim() !== '') {
      const html = marked(value) as string;
      editor.commands.setContent(html, false);
      lastEditorHtmlRef.current = html;
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`editor-container ${className}`}>
      <style jsx global>{editorStyles}</style>
      <EditorContent 
        editor={editor} 
        style={{ minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }}
        data-placeholder={placeholder}
      />
    </div>
  );
} 