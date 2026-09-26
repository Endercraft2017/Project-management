import { MessageAttachment } from '@/types';
import {
  isImageFile,
  isPdfFile,
  isMarkdownFile,
  isGoogleDocsFile,
  isCsvFile,
  isTextFile,
} from '@/utils/fileUtils';
import { ImagePreview } from './ImagePreview';
import { PdfPreview } from './PdfPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { GoogleDocsPreview } from './GoogleDocsPreview';
import { CsvPreview } from './CsvPreview';
import { TextFilePreview } from './TextFilePreview';
import { GenericFileCard } from './GenericFileCard';

interface FileAttachmentProps {
  attachment: MessageAttachment;
}

export function FileAttachment({ attachment }: FileAttachmentProps) {
  const { mimeType, fileName } = attachment;

  // Route to appropriate preview component based on file type
  if (isImageFile(mimeType)) {
    return <ImagePreview attachment={attachment} />;
  }

  if (isPdfFile(mimeType)) {
    return <PdfPreview attachment={attachment} />;
  }

  if (isMarkdownFile(mimeType)) {
    return <MarkdownPreview attachment={attachment} />;
  }

  if (isGoogleDocsFile(mimeType)) {
    return <GoogleDocsPreview attachment={attachment} />;
  }

  // Check CSV before general text files
  if (isCsvFile(mimeType, fileName)) {
    return <CsvPreview attachment={attachment} />;
  }

  if (isTextFile(mimeType)) {
    return <TextFilePreview attachment={attachment} />;
  }

  // Fallback to generic file card
  return <GenericFileCard attachment={attachment} />;
}
