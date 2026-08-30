import { requestOriginPermission } from '@/modules/adapters/chrome/permissions-adapter.ts';

export async function requestHostAccess(origin: string): Promise<boolean> {
  if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
    return false;
  }
  return requestOriginPermission(origin);
}
