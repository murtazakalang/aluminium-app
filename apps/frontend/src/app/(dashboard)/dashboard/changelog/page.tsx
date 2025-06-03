'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ChangelogPage() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChangelogContent = async () => {
      try {
        setLoading(true);
        const data = await api<{ content: string }>('/api/settings/changelog');
        setContent(data.content);
      } catch (err) {
        setError('Failed to load changelog content. Please try again later.');
        // Fallback content in case API fails
        setContent('<h1>Changelog</h1><p>Version 1.0.0 (Initial Release)</p><ul><li>Core functionality implemented</li><li>Settings management</li><li>Client management</li></ul>');
      } finally {
        setLoading(false);
      }
    };

    fetchChangelogContent();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Changelog</h2>
        <p className="text-muted-foreground">
          View updates and changes to the system.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        {loading && <p>Loading changelog...</p>}
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