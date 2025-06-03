import React from 'react';
import UnitSettingsForm from '@/components/settings/UnitSettingsForm';
import GstSettingsForm from '@/components/settings/GstSettingsForm';
import TermsEditor from '@/components/settings/TermsEditor';

export const metadata = {
  title: 'General Settings | Aluminium ERP',
};

export default function GeneralSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">General Settings</h2>
        <p className="text-muted-foreground">
          Configure your company's general settings, units, and terms & conditions.
        </p>
      </div>

      <div className="grid gap-8">
        <div className="rounded-lg border bg-card p-6">
          <UnitSettingsForm />
        </div>

        <div className="rounded-lg border bg-card p-6">
          <GstSettingsForm />
        </div>

        <div className="rounded-lg border bg-card p-6">
          <TermsEditor />
        </div>
      </div>
    </div>
  );
} 