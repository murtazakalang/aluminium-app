'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function HelpPage() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHelpContent = async () => {
      try {
        setLoading(true);
        const data = await api<{ content: string }>('/api/settings/help');
        setContent(data.content);
      } catch (err) {
        setError('Failed to load help content. Please try again later.');
        // Fallback content in case API fails
        setContent('<h1>Help Center</h1><p>Welcome to the Aluminium ERP Help Center. This section will contain detailed guides and documentation about using the system.</p>');
      } finally {
        setLoading(false);
      }
    };

    fetchHelpContent();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Help Center</h2>
        <p className="text-muted-foreground">
          Find guides and documentation to help you use the system.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        {loading && <p>Loading help content...</p>}
        {error && <div className="p-4 text-red-800 bg-red-50 rounded-md">{error}</div>}
        {!loading && !error && (
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>
    </div>
  );
} 