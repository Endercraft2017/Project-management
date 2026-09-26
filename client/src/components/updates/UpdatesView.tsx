/**
 * Updates View Component - Main daily updates interface
 */

import { useState, useEffect } from 'react';
import { useUpdateDays } from '@/hooks/useUpdates';
import { connectSocket, disconnectSocket, on, off } from '@/lib/socket';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import DayList from './DayList';
import DailyUpdateThread from './DailyUpdateThread';
import { MissingUpdatesButton } from '@/components/admin/MissingUpdatesButton';

interface UpdatesViewProps {
  highlightMissingDates?: string[];
  onClearHighlight?: (date: string) => void;
  initialDate?: string; // YYYY-MM-DD format
}

export default function UpdatesView({ highlightMissingDates = [], onClearHighlight, initialDate }: UpdatesViewProps) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || today);
  const { data: days, refetch } = useUpdateDays();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const response = await api.get(`/api/updates/${selectedDate}/download`, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Daily-Updates-${selectedDate}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download updates:', error);
      alert('Failed to download updates. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    connectSocket();

    // Listen for real-time update changes
    on('daily_update_changed', () => {
      refetch();
    });

    return () => {
      off('daily_update_changed');
      disconnectSocket();
    };
  }, [refetch]);

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Day List */}
      <div className="w-64 border-r border-border bg-card">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-border p-4">
            <h2 className="text-lg font-semibold">Daily Updates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Team daily standup updates
            </p>
          </div>

          {/* Day List */}
          <DayList
            days={days || []}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            highlightMissingDates={highlightMissingDates}
          />
        </div>
      </div>

      {/* Main Content - Daily Update Thread */}
      <div className="flex-1 flex flex-col">
        {/* Header with Download Button */}
        <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <MissingUpdatesButton />
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'Downloading...' : 'Download as Word'}
            </button>
          </div>
        </div>

        <DailyUpdateThread
          date={selectedDate}
          onUpdatePosted={() => {
            if (onClearHighlight) {
              onClearHighlight(selectedDate);
            }
          }}
        />
      </div>
    </div>
  );
}
