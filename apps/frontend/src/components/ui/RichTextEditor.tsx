'use client';

import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Enter content here...',
  className = '',
}) => {
  const [editorContent, setEditorContent] = useState(value);

  // Update the editor when the external value changes
  useEffect(() => {
    setEditorContent(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setEditorContent(newValue);
    onChange(newValue);
  };

  return (
    <div className={`w-full ${className}`}>
      {label && <Label className="mb-2 block">{label}</Label>}
      <textarea
        className="min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        value={editorContent}
        onChange={handleChange}
        placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor; 