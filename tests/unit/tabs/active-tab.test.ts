import { describe, expect, it } from 'vitest';
import { displaySiteLabel, isIsolatableUrl } from '../../../modules/tabs/active-tab.ts';

describe('displaySiteLabel', () => {
  it('shows hostname for http(s) pages', () => {
    expect(displaySiteLabel('https://www.google.com/search')).toBe('www.google.com');
  });

  it('labels missing and browser pages', () => {
    expect(displaySiteLabel(undefined)).toBe('No website tab');
    expect(displaySiteLabel('chrome://newtab/')).toBe('Browser page');
    expect(displaySiteLabel('chrome-extension://abc/popup.html')).toBe('Browser page');
  });
});

describe('isIsolatableUrl', () => {
  it('allows only http(s)', () => {
    expect(isIsolatableUrl('https://www.google.com/')).toBe(true);
    expect(isIsolatableUrl('chrome://extensions')).toBe(false);
    expect(isIsolatableUrl(undefined)).toBe(false);
  });
});
