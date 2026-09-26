/**
 * Unified Admin Settings Modal
 * Central location for all admin configuration settings
 */

import { useState } from 'react';
import { Settings, X, Users, Mail, AlertCircle, Bell } from 'lucide-react';
import MemberSelectionTab from './settings/MemberSelectionTab';
import EmailSettingsTab from './settings/EmailSettingsTab';
import MissingUpdatesTab from './settings/MissingUpdatesTab';
import AutomatedRemindersTab from './settings/AutomatedRemindersTab';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'members' | 'email' | 'updates' | 'reminders';
}

type TabType = 'members' | 'email' | 'updates' | 'reminders';

export default function AdminSettingsModal({
  isOpen,
  onClose,
  initialTab = 'members',
}: AdminSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  if (!isOpen) return null;

  const tabs = [
    { id: 'members' as TabType, label: 'Team Members', icon: Users },
    { id: 'updates' as TabType, label: 'Missing Updates', icon: AlertCircle },
    { id: 'reminders' as TabType, label: 'Daily Reminders', icon: Bell },
    { id: 'email' as TabType, label: 'Email Settings', icon: Mail },
  ];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Admin Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'members' && <MemberSelectionTab />}
            {activeTab === 'email' && <EmailSettingsTab onClose={onClose} />}
            {activeTab === 'updates' && <MissingUpdatesTab />}
            {activeTab === 'reminders' && <AutomatedRemindersTab onClose={onClose} />}
          </div>
        </div>
      </div>
    </>
  );
}
