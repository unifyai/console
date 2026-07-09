'use server';

import {
  getInstallStatusAction as getInstall,
  bindInstallAction as bindInstall,
  revokeInstallAction as revokeInstall,
} from '@/lib/ms-teams-bot/install';

export async function getInstallStatusAction(...args: Parameters<typeof getInstall>) {
  return getInstall(...args);
}

export async function bindInstallAction(...args: Parameters<typeof bindInstall>) {
  return bindInstall(...args);
}

export async function revokeInstallAction(...args: Parameters<typeof revokeInstall>) {
  return revokeInstall(...args);
}
