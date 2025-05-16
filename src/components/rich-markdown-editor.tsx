import dynamic from "next/dynamic";
import React from "react";

// Dynamically import LexicalBadgeEditor because it relies on window
const LexicalBadgeEditor = dynamic(() => import("./LexicalBadgeEditor").then(m => m.LexicalBadgeEditor), { ssr: false });

interface RichMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichMarkdownEditor({ value, onChange, placeholder, className }: RichMarkdownEditorProps) {
  return (
    <LexicalBadgeEditor
      value={value}
      onChange={onChange}
      fields={[]}
      placeholder={placeholder}
      className={className}
      isMarkdown={true}
      disableMarkdownShortcuts={false}
      hideMarkdownHelp={true}
      autoFocus={false}
    />
  );
} 