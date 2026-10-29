/**
 * Unified Admin Settings Modal
 * Central location for all admin configuration settings
 */

import { useState } from "react";
import {
  Settings,
  X,
  Users,
  Mail,
  AlertCircle,
  Bell,
  Database,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import MemberSelectionTab from "./settings/MemberSelectionTab";
import EmailSettingsTab from "./settings/EmailSettingsTab";
import MissingUpdatesTab from "./settings/MissingUpdatesTab";
import AutomatedRemindersTab from "./settings/AutomatedRemindersTab";
import WorkspaceDataTab from "./settings/WorkspaceDataTab";

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "members" | "email" | "updates" | "reminders" | "data";
}

type TabType = "members" | "email" | "updates" | "reminders" | "data";

export default function AdminSettingsModal({
  isOpen,
  onClose,
  initialTab = "members",
}: AdminSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  if (!isOpen) return null;

  const tabs = [
    { id: "members" as TabType, label: "Team Members", icon: Users },
    { id: "updates" as TabType, label: "Missing Updates", icon: AlertCircle },
    { id: "reminders" as TabType, label: "Daily Reminders", icon: Bell },
    { id: "email" as TabType, label: "Email Settings", icon: Mail },
    { id: "data" as TabType, label: "Workspace data", icon: Database },
  ];

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card text-card-foreground shadow-lg focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-primary" />
              <Dialog.Title className="text-xl font-semibold">
                Admin Settings
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close admin settings"
                className="rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Manage company members, update settings and export workspace data.
          </Dialog.Description>

          {/* Tabs */}
          <Tabs.Root
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabType)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <Tabs.List
              aria-label="Admin settings sections"
              className="flex shrink-0 overflow-x-auto border-b border-border px-4 sm:px-6"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Tabs.Trigger
                    key={tab.id}
                    value={tab.id}
                    className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Tabs.Trigger>
                );
              })}
            </Tabs.List>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <Tabs.Content value="members">
                <MemberSelectionTab />
              </Tabs.Content>
              <Tabs.Content value="email">
                <EmailSettingsTab onClose={onClose} />
              </Tabs.Content>
              <Tabs.Content value="updates">
                <MissingUpdatesTab />
              </Tabs.Content>
              <Tabs.Content value="reminders">
                <AutomatedRemindersTab onClose={onClose} />
              </Tabs.Content>
              <Tabs.Content value="data">
                <WorkspaceDataTab />
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
