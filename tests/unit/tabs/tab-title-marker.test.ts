import { describe, expect, it } from 'vitest';
import {
  applyTabTitleMarker,
  stripTabTitleMarker,
} from '../../../modules/tabs/tab-title-marker.ts';

describe('tab title marker', () => {
  it('prefixes a site title with the session circle', () => {
    expect(applyTabTitleMarker('Google', '🔴')).toBe('🔴 Google');
  });

  it('replaces an existing circle instead of stacking them', () => {
    expect(applyTabTitleMarker('🟠 Gmail', '🔵')).toBe('🔵 Gmail');
  });

  it('strips the circle marker', () => {
    expect(stripTabTitleMarker('🟢 GitHub')).toBe('GitHub');
  });
});
