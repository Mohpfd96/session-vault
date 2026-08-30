import { asSessionId } from '../domain/ids.ts';

/** Sentinel session id for tabs that are managed but not yet assigned a session. */
export const UNASSIGNED_SESSION_ID = asSessionId('__sv_unassigned__');
