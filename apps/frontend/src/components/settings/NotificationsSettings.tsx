'use client';

import React from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { Label } from '@/components/ui/label';

const NotificationsSettings = () => {
  const { settings, updateSettings, loading } = useSettings();

  const handleSystemAlertsToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (settings) {
      updateSettings({
        notifications: {
          ...settings.notifications,
          systemAlertsEnabled: e.target.checked,
        },
      });
    }
  };

  const handleEmailSummaryToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (settings) {
      updateSettings({
        notifications: {
          ...settings.notifications,
          emailSummaryEnabled: e.target.checked,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notification Settings</h3>
        <p className="text-sm text-gray-500">
          Configure how and when you receive notifications.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start space-x-2">
          <div className="mt-1">
            <input
              type="checkbox"
              id="systemAlertsEnabled"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={settings?.notifications.systemAlertsEnabled || false}
              onChange={handleSystemAlertsToggle}
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="systemAlertsEnabled" className="block font-medium">
              System Alerts
            </Label>
            <p className="text-sm text-gray-500">
              Receive notifications for important system events like low stock alerts, pending orders, etc.
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <div className="mt-1">
            <input
              type="checkbox"
              id="emailSummaryEnabled"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={settings?.notifications.emailSummaryEnabled || false}
              onChange={handleEmailSummaryToggle}
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="emailSummaryEnabled" className="block font-medium">
              Email Summaries
            </Label>
            <p className="text-sm text-gray-500">
              Receive daily email summaries of your company's activity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsSettings; 