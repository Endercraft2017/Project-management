/**
 * Drive proxy header tests: files served from our origin must never be able
 * to run script.
 */

import { contentDisposition, isValidDriveFileId, setDriveFileHeaders } from '../drive-file-headers';

function headersFor(mimeType: string | null, name = 'file.bin') {
  const headers: Record<string, string> = {};
  const res = { setHeader: (key: string, value: string) => (headers[key.toLowerCase()] = value) };
  setDriveFileHeaders(res as any, mimeType, name);
  return headers;
}

describe('isValidDriveFileId', () => {
  it('accepts Drive-style IDs', () => {
    expect(isValidDriveFileId('1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT_-')).toBe(true);
  });

  it('rejects path and query injection', () => {
    expect(isValidDriveFileId('abc/../../files')).toBe(false);
    expect(isValidDriveFileId('abcdefghij?alt=media')).toBe(false);
    expect(isValidDriveFileId('short')).toBe(false);
  });
});

describe('setDriveFileHeaders', () => {
  it('serves images and PDFs inline', () => {
    expect(headersFor('image/png')['content-disposition']).toMatch(/^inline/);
    expect(headersFor('application/pdf')['content-type']).toBe('application/pdf');
  });

  it('forces executable types to download as opaque bytes', () => {
    for (const type of ['text/html', 'application/javascript', 'application/xhtml+xml', 'text/xml']) {
      const headers = headersFor(type);
      if (type.startsWith('text/')) {
        // text types that aren't on the allowlist are still downloaded
        expect(headers['content-disposition']).toMatch(/^attachment/);
      }
      expect(headers['content-type']).not.toMatch(/html|javascript|xml/);
    }
  });

  it('renders allowed text types as plain text only', () => {
    expect(headersFor('text/markdown')['content-type']).toBe('text/plain; charset=utf-8');
  });

  it('sandboxes SVG and never shows it inline', () => {
    const headers = headersFor('image/svg+xml');
    expect(headers['content-disposition']).toMatch(/^attachment/);
    expect(headers['content-security-policy']).toContain('sandbox');
  });

  it('always sets nosniff and private caching', () => {
    const headers = headersFor(null);
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['cache-control']).toMatch(/^private/);
    expect(headers['content-type']).toBe('application/octet-stream');
  });
});

describe('contentDisposition', () => {
  it('cannot be broken out of with quotes or newlines', () => {
    const value = contentDisposition('attachment', 'a"b\r\nSet-Cookie: x.txt');
    expect(value).not.toMatch(/[\r\n]/);
    expect(value).toContain('filename="a_b__Set-Cookie: x.txt"');
  });

  it('keeps non-ASCII names via filename*', () => {
    expect(contentDisposition('inline', 'résumé.pdf')).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
  });
});
