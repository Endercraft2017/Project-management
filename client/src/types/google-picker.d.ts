/**
 * Google Picker API TypeScript Definitions
 */

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

declare namespace google {
  namespace picker {
    class PickerBuilder {
      setOAuthToken(token: string): PickerBuilder;
      setDeveloperKey(key: string): PickerBuilder;
      addView(view: View): PickerBuilder;
      setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
      enableFeature(feature: Feature): PickerBuilder;
      setTitle(title: string): PickerBuilder;
      setOrigin(origin: string): PickerBuilder;
      build(): Picker;
    }

    class Picker {
      setVisible(visible: boolean): void;
    }

    class DocsView extends View {
      constructor(viewId?: ViewId);
      setIncludeFolders(include: boolean): DocsView;
      setMimeTypes(mimeTypes: string): DocsView;
      setMode(mode: DocsViewMode): DocsView;
      setParent(parentId: string): DocsView;
    }

    class DocsUploadView extends View {
      constructor();
      setIncludeFolders(include: boolean): DocsUploadView;
      setParent(parentId: string): DocsUploadView;
    }

    class View {
      constructor(viewId?: ViewId);
    }

    enum ViewId {
      DOCS = 'docs',
      DOCS_IMAGES = 'docs-images',
      DOCS_IMAGES_AND_VIDEOS = 'docs-images-and-videos',
      DOCS_VIDEOS = 'docs-videos',
      DOCUMENTS = 'documents',
      DRAWINGS = 'drawings',
      FOLDERS = 'folders',
      FORMS = 'forms',
      IMAGE_SEARCH = 'image-search',
      MAPS = 'maps',
      PDFS = 'pdfs',
      PHOTOS = 'photos',
      PHOTO_ALBUMS = 'photo-albums',
      PHOTO_UPLOAD = 'photo-upload',
      PRESENTATIONS = 'presentations',
      RECENTLY_PICKED = 'recently-picked',
      SPREADSHEETS = 'spreadsheets',
      VIDEO_SEARCH = 'video-search',
      WEBCAM = 'webcam',
      YOUTUBE = 'youtube',
    }

    enum Feature {
      MINE_ONLY = 'mineOnly',
      MULTISELECT_ENABLED = 'multiselectEnabled',
      NAV_HIDDEN = 'navHidden',
      SIMPLE_UPLOAD_ENABLED = 'simpleUploadEnabled',
      SUPPORT_DRIVES = 'supportDrives',
      SUPPORT_TEAM_DRIVES = 'supportTeamDrives',
    }

    enum DocsViewMode {
      GRID = 'grid',
      LIST = 'list',
    }

    enum Action {
      CANCEL = 'cancel',
      PICKED = 'picked',
      LOADED = 'loaded',
    }

    interface ResponseObject {
      action: Action;
      docs?: Document[];
      viewToken?: string[];
    }

    interface Document {
      id: string;
      serviceId: string;
      mimeType: string;
      name: string;
      description?: string;
      type: string;
      lastEditedUtc: number;
      iconUrl: string;
      url: string;
      embedUrl?: string;
      sizeBytes: number;
      parentId?: string;
      isShared?: boolean;
      rotation?: number;
      rotationDegree?: number;
    }
  }
}
