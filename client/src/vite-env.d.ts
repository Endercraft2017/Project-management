/// <reference types="vite/client" />
/// <reference path="./types/google-picker.d.ts" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SOCKET_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Extend Window interface for Google APIs
interface Window {
  gapi: any;
  google: any;
}
