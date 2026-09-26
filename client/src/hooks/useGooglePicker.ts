/**
 * useGooglePicker Hook
 * Hook to open Google Picker and select files from Drive
 */

import { useState, useEffect } from 'react';
import { get } from '@/lib/api';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  iconUrl?: string;
}

export function useGooglePicker() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresReauth, setRequiresReauth] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;
    let timeoutId: NodeJS.Timeout;

    // Load Picker API with retry logic
    const loadPicker = () => {
      if (window.gapi) {
        console.log('[GooglePicker] gapi found, loading picker...');
        window.gapi.load('picker', {
          callback: () => {
            console.log('[GooglePicker] Picker API loaded successfully');
            setIsLoaded(true);
            setError(null);
          },
          onerror: () => {
            console.error('[GooglePicker] Failed to load picker API');
            setError('Failed to load Google Picker API');
          },
        });
      } else {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`[GooglePicker] gapi not available yet, retrying... (${attempts}/${maxAttempts})`);
          // Retry after 200ms
          timeoutId = setTimeout(loadPicker, 200);
        } else {
          console.error('[GooglePicker] gapi not available after max attempts');
          setError('Google API not loaded. Please refresh the page.');
        }
      }
    };

    // Start loading after a short delay to let scripts initialize
    timeoutId = setTimeout(loadPicker, 100);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const openPicker = async (callback: (files: DriveFile[]) => void) => {
    if (!isLoaded) {
      console.error('[GooglePicker] Picker API not loaded');
      setError('Picker not loaded yet');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get OAuth token from backend
      let tokenResponse;
      try {
        tokenResponse = await get<{ accessToken: string }>('/api/auth/google/token');
      } catch (tokenError: any) {
        // Check if re-authentication is required
        if (tokenError.status === 401 || tokenError.response?.requiresReauth) {
          console.log('[GooglePicker] Re-authentication required');
          setRequiresReauth(true);
          setError('Google Drive access required. Please reconnect.');
          setIsLoading(false);
          return;
        }

        // Handle 501 error (OAuth not yet implemented)
        if (tokenError.message?.includes('501') || tokenError.message?.includes('Not Implemented')) {
          throw new Error('Google Drive integration is not yet configured. Please contact your administrator.');
        }
        throw tokenError;
      }

      const accessToken = tokenResponse.accessToken;

      if (!accessToken) {
        throw new Error('No access token available. Please log in with Google again.');
      }

      // Get API key from environment (optional - OAuth token may be sufficient)
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

      if (!apiKey) {
        console.warn('[GooglePicker] No API key found - attempting to use OAuth token only');
      } else {
        console.log('[GooglePicker] Using API key with OAuth token');
      }

      console.log('[GooglePicker] Opening picker with token');

      // Create and configure picker
      const docsView = new google.picker.DocsView()
        .setIncludeFolders(true);

      const uploadView = new google.picker.DocsUploadView();

      const pickerBuilder = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken);

      // Only set developer key if available (may work without it)
      if (apiKey) {
        pickerBuilder.setDeveloperKey(apiKey);
      }

      const picker = pickerBuilder
        .addView(docsView)
        .addView(uploadView)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback((data: google.picker.ResponseObject) => {
          console.log('[GooglePicker] Callback received:', data.action);

          if (data.action === google.picker.Action.PICKED && data.docs) {
            const files: DriveFile[] = data.docs.map(doc => ({
              id: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              sizeBytes: doc.sizeBytes,
              url: doc.url,
              iconUrl: doc.iconUrl,
            }));

            console.log('[GooglePicker] Files selected:', files.length);
            callback(files);
          } else if (data.action === google.picker.Action.CANCEL) {
            console.log('[GooglePicker] User cancelled');
          }

          setIsLoading(false);
        })
        .build();

      picker.setVisible(true);
    } catch (err: any) {
      console.error('[GooglePicker] Error opening picker:', err);
      setError(err.message || 'Failed to open file picker');
      setIsLoading(false);
    }
  };

  const handleReauth = () => {
    // Redirect to re-auth endpoint
    window.location.href = '/api/auth/google/reauth';
  };

  const dismissReauth = () => {
    setRequiresReauth(false);
    setError(null);
  };

  const retryLoad = () => {
    console.log('[GooglePicker] Manual retry requested');
    setError(null);
    setIsLoaded(false);

    // Force reload by checking immediately
    if (window.gapi) {
      window.gapi.load('picker', {
        callback: () => {
          console.log('[GooglePicker] Picker API loaded successfully on retry');
          setIsLoaded(true);
          setError(null);
        },
        onerror: () => {
          console.error('[GooglePicker] Failed to load picker API on retry');
          setError('Failed to load Google Picker API. Please refresh the page.');
        },
      });
    } else {
      setError('Google API scripts not loaded. Please refresh the page.');
    }
  };

  return {
    openPicker,
    isLoaded,
    isLoading,
    error,
    requiresReauth,
    handleReauth,
    dismissReauth,
    retryLoad,
  };
}
