"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createComment, uploadAttachmentAction } from "@/app/actions";
import { TipTapCommentEditor } from "./tiptap-comment-editor";
import { useRouter } from "next/navigation";

interface CommentFormProps {
  issueId: string;
}

export function CommentForm({ issueId }: CommentFormProps) {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const processSelectedFiles = async (selectedFiles: FileList | File[]) => {
    console.log('processSelectedFiles triggered for:', selectedFiles[0]?.name, new Date().toISOString());
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsSubmitting(true);

    const newFiles = Array.from(selectedFiles);

    for (const file of newFiles) {
      const tempId = `uploading-${file.name}-${Date.now()}`;
      const tempMessage = `<!-- ${tempId} -->Uploading ${file.name}...`;
      
      try {
        const fileFormData = new FormData();
        fileFormData.append("file", file);

        setComment(prev => (prev.length > 0 ? prev + '\n' : '') + tempMessage + '\n');

        const uploadResult = await uploadAttachmentAction(fileFormData);
        
        setComment(prev => {
          const regexToRemove = new RegExp(`(\\n)?<!-- ${tempId} -->.*?\n`, 'g');
          let currentContent = prev.replace(regexToRemove, "");
          currentContent = currentContent.replace(/\n+$/, '\n'); 
          if (currentContent.length > 0 && !currentContent.endsWith('\n') && currentContent !== '\n') currentContent += '\n';
          if (currentContent.length === 1 && currentContent === '\n') currentContent = '';

          if (uploadResult.success && uploadResult.assetUrl) {
            let markdownToInsert = "";
            if (file.type.startsWith("image/")) {
              markdownToInsert = `![${file.name}](${uploadResult.assetUrl})`;
            } else {
              markdownToInsert = `[${file.name}](${uploadResult.assetUrl})`;
            }
            return (currentContent + markdownToInsert + '\n').replace(/^\n+/, '');
          } else {
            console.error("Failed to upload file:", file.name, uploadResult.error);
            alert(`Failed to upload ${file.name}: ${uploadResult.error || 'Unknown error'}`);
            const failMessage = `Failed to upload ${file.name}: ${uploadResult.error || 'Unknown error'}`;
            return (currentContent + failMessage + '\n').replace(/^\n+/, '');
          }
        });

      } catch (error: any) {
        setComment(prev => {
          const regexToRemove = new RegExp(`(\\n)?<!-- ${tempId} -->.*?\n`, 'g');
          let currentContent = prev.replace(regexToRemove, "");
          currentContent = currentContent.replace(/\n+$/, '\n');
          if (currentContent.length > 0 && !currentContent.endsWith('\n') && currentContent !== '\n') currentContent += '\n';
          if (currentContent.length === 1 && currentContent === '\n') currentContent = '';

          const errorMessage = `Error uploading ${file.name}: ${error.message || 'Unknown error'}`;
          console.error("Error processing file upload:", file.name, error);
          alert(`Error uploading ${file.name}: ${error.message || 'Unknown error'}`);
          return (currentContent + errorMessage + '\n').replace(/^\n+/, '');
        });
      }
    }
    setIsSubmitting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processSelectedFiles(e.target.files);
    }
    if (e.target) {
      e.target.value = "";
    }
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.set("issueId", issueId);
    formData.set("body", comment);
      
    try {
      const result = await createComment(formData);
      
      if (result.success) {
        setComment("");
        router.refresh();
      } else {
        console.error("Error submitting comment:", result.error);
        alert(`Failed to post comment: ${result.error || "Please try again."}`);
      }
    } catch (error: any) {
      console.error("Error submitting comment:", error);
      alert("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLFormElement>) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      processSelectedFiles(e.clipboardData.files);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4 ${isDragOver ? 'outline-dashed outline-2 outline-blue-500' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <p className="text-xs text-muted-foreground mb-1">
        You can <strong>drag & drop</strong> images/files or <strong>paste</strong> screenshots directly. Markdown is supported. Attachments will be uploaded and embedded automatically.
      </p>

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <TipTapCommentEditor
          value={comment}
          onChange={setComment}
          placeholder="Write a comment... Add images via paste or drag & drop."
          className="text-foreground"
          minHeight="120px"
        />
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        id="file-upload"
        className="hidden"
        onChange={handleFileChange}
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.zip"
        disabled={isSubmitting}
      />
      
      <div className="flex justify-end">
        <Button 
          type="submit"
          className="px-4 py-2 h-auto"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Processing..." : "Add Comment"}
        </Button>
      </div>
    </form>
  );
} 