/**
 * Drive Re-authentication Prompt Component
 * Shows when user needs to re-grant Google Drive permissions
 */

import { AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DriveReauthPromptProps {
  onReauth: () => void;
  onDismiss?: () => void;
  message?: string;
  variant?: 'banner' | 'inline' | 'modal';
}

export default function DriveReauthPrompt({
  onReauth,
  onDismiss,
  message = 'Your Google Drive access has expired or is not connected.',
  variant = 'inline'
}: DriveReauthPromptProps) {

  if (variant === 'banner') {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Google Drive Access Required
            </h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              {message} Please reconnect to attach files from Google Drive.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={onReauth}
                variant="default"
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Connect Google Drive
              </Button>
              {onDismiss && (
                <Button
                  onClick={onDismiss}
                  variant="outline"
                  size="sm"
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Google Drive Access Required
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {message}
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Click below to reconnect your Google Drive account. You'll be redirected to Google to grant permissions.
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            {onDismiss && (
              <Button
                onClick={onDismiss}
                variant="outline"
              >
                Maybe Later
              </Button>
            )}
            <Button
              onClick={onReauth}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Connect Google Drive
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // inline variant (default)
  return (
    <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 mb-3">
      <div className="flex items-center">
        <AlertCircle className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {message}
          </p>
        </div>
        <Button
          onClick={onReauth}
          variant="outline"
          size="sm"
          className="ml-3 flex-shrink-0 border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/40"
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Connect
        </Button>
      </div>
    </div>
  );
}
