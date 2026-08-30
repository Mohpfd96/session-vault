import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifestVersion: 3,
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'SessionVault',
    short_name: 'SessionVault',
    description:
      'Manage isolated website sessions and accounts. Keep personal, work, and client logins separate in different tabs.',
    minimum_chrome_version: '120',
    homepage_url: 'https://github.com',
    permissions: [
      'tabs',
      'activeTab',
      'storage',
      'scripting',
      'declarativeNetRequestWithHostAccess',
      'webRequest',
      'webNavigation',
      'contextMenus',
      'sidePanel',
      'alarms',
      'cookies',
      'unlimitedStorage',
    ],
    optional_permissions: ['tabGroups', 'browsingData'],
    host_permissions: ['*://*/*'],
    action: {
      default_icon: {
        16: 'icon.svg',
        32: 'icon.svg',
      },
    },
    commands: {
      'open-session-switcher': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Open session switcher',
      },
      'new-temporary-session': {
        suggested_key: { default: 'Alt+Shift+T' },
        description: 'Create a temporary session',
      },
      'duplicate-into-session': {
        description: 'Duplicate the current page into another session',
      },
      'next-session': {
        description: 'Switch the current tab to the next session',
      },
      'previous-session': {
        description: 'Switch the current tab to the previous session',
      },
    },
  },
});
