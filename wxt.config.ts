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
    name: 'Session Vault',
    short_name: 'Session Vault',
    description:
      'Manage isolated website sessions and accounts. Keep personal, work, and client logins separate in different tabs.',
    minimum_chrome_version: '120',
    homepage_url: 'https://mohpfd96.github.io/session-vault/',
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
      'cookies',
    ],
    optional_host_permissions: ['*://*/*'],
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    action: {
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
        48: 'icon-48.png',
        128: 'icon-128.png',
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
