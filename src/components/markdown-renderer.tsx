"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";

// Process Linear content to add proper markdown syntax for emoji headers
function processLinearContent(content: string): string {
  if (!content) return "";
  
  // Add markdown headings to lines that start with emoji
  return content.split('\n').map(line => {
    // Pattern to match common Linear emoji patterns at line start
    const emojiPattern = /^([📌🔧📎✅📊📝📋📄📑🔍🔎⚠️💡📢📣🛠️⚙️🔩🔧])(\s+)(.+)$/;
    const match = line.match(emojiPattern);
    
    if (match) {
      // Convert emoji lines to proper markdown headings
      return `## ${match[1]}${match[2]}${match[3]}`;
    }
    
    // Convert bullet points if they exist but are not formatted correctly
    if (line.trim().startsWith("*") && !line.trim().startsWith("* ")) {
      return line.replace(/^\s*\*\s*/, "* ");
    }
    
    // Format numbered lists
    const numberedListMatch = line.match(/^\s*(\d+)\.(?!\s)(.+)$/);
    if (numberedListMatch) {
      return `${numberedListMatch[1]}. ${numberedListMatch[2]}`;
    }
    
    return line;
  }).join('\n');
}

export function MarkdownRenderer({ content, className }: { content: string | undefined | null; className?: string }) {
  // Ensure content is a string, default to empty string if null/undefined.
  const rawContent = content || "";

  // If after defaulting, the content is effectively empty, return null to render nothing.
  if (!rawContent.trim()) return null;
  
  // Process Linear content to add proper markdown syntax
  const markdownContent = processLinearContent(rawContent);
  
  // Custom components for markdown rendering with proper TypeScript typing
  const components: Components = {
    h1: ({children}) => <h1 className="text-2xl font-bold mt-0.5 mb-1.5">{children}</h1>,
    h2: ({children}) => <h2 className="text-xl font-bold mt-0 mb-1">{children}</h2>,
    h3: ({children}) => <h3 className="text-lg font-bold mt-1.5 mb-1">{children}</h3>,
    p: ({children}) => <p className="my-2.5">{children}</p>,
    a: ({href, children}) => <a href={href} className="text-primary hover:text-primary/80 underline">{children}</a>,
    ul: ({children}) => <ul className="my-3 pl-6 list-disc">{children}</ul>,
    ol: ({children}) => <ol className="my-3 pl-6 list-decimal">{children}</ol>,
    li: ({children}) => <li className="my-1">{children}</li>,
    blockquote: ({children}) => <blockquote className="border-l-4 border-primary/20 bg-muted/30 py-1 px-4 my-3">{children}</blockquote>,
    code: ({className, children}) => {
      const isInlineCode = !className;
      return isInlineCode ? (
        <code className="bg-muted/60 dark:bg-muted/30 px-1 py-0.5 rounded-sm">{children}</code>
      ) : (
        <code className={className}>{children}</code>
      );
    },
    pre: ({children}) => <pre className="bg-muted/60 dark:bg-muted/30 p-3 rounded-md border border-border overflow-auto my-4">{children}</pre>,
    img: ({src, alt}) => <img src={src} alt={alt} className="rounded-md my-2 max-w-full" />,
    strong: ({children}) => <strong className="font-bold">{children}</strong>,
    em: ({children}) => <em className="italic">{children}</em>,
    hr: () => <hr className="my-4 border-border" />,
  };
  
  return (
    <div>
      <div className={cn("markdown-content", className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
} 