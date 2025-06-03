import React from 'react';
import NotificationsSettings from '@/components/settings/NotificationsSettings';

export const metadata = {
  title: 'Notification Settings | Aluminium ERP',
};

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Notification Settings</h2>
        <p className="text-muted-foreground">
          Configure how and when you receive notifications about system events.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <NotificationsSettings />
      </div>
    </div>
  );
} 