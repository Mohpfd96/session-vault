export { CHANNEL } from './channels.ts';
export {
  uiRequestSchema,
  contentRequestSchema,
  pageRequestSchema,
  type UiRequest,
  type ContentRequest,
  type PageRequest,
  type Result,
} from './protocol.ts';
export { parseUiRequest, parseContentRequest, parsePageRequest } from './validate.ts';
export { sendUiRequest, pingBackground } from './extension-client.ts';
export { createBackgroundRouter } from './background-router.ts';
export type { PopupSnapshot, IsolationChipStatus } from './snapshots.ts';
