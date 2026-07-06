'use server';

import {
  getSlackInstallAction as getSlackInstall,
  revokeSlackInstallAction as revokeSlackInstall,
} from '@/lib/slack/install';

export async function getSlackInstallAction(...args: Parameters<typeof getSlackInstall>) {
  return getSlackInstall(...args);
}

export async function revokeSlackInstallAction(...args: Parameters<typeof revokeSlackInstall>) {
  return revokeSlackInstall(...args);
}
