import { describe, it, expect } from 'vitest';
import { escapeHtml, getInitials } from './utils';

describe('escapeHtml', () => {
  it('neutralizes markup so it renders as text', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
  });

  it('escapes ampersands and single quotes', () => {
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });

  it('round-trips through innerHTML as the original text', () => {
    const el = document.createElement('div');
    const original = 'Fix <b>bold</b> & "quoted" task';
    el.innerHTML = escapeHtml(original);
    expect(el.textContent).toBe(original);
    expect(el.querySelector('b')).toBeNull();
  });
});

describe('getInitials', () => {
  it('uses the first and last name', () => {
    expect(getInitials('Ada King Lovelace')).toBe('AL');
  });

  it('handles single names and blanks', () => {
    expect(getInitials('cher')).toBe('C');
    expect(getInitials('   ')).toBe('?');
  });
});
