import {
  createAssistant,
  deleteAssistant,
  updateAssistant,
  checkHiringFunds,
} from '@/lib/assistants/assistant';
import {
  uploadPhoto,
  uploadVideo,
  downloadMedia,
  downloadPresetPhoto,
  downloadPresetVideo,
  generatePhoto,
  editPhoto,
  animatePhoto,
  getAnimationPrediction,
  cancelAnimationPrediction,
} from '@/lib/assistants/photo';
import {
  registerVoice,
  deleteVoice,
  cloneVoice,
  generateSpeech,
  designVoiceGeneratePreviews,
  designVoiceCreateFromPreview,
} from '@/lib/assistants/voice';
import {
  getTranscripts,
  messageAssistant,
  reactToMessage,
  getContactIdByEmail,
  getAssistantOwnerById,
  uploadAttachment,
} from '@/lib/assistants/chat';
import {
  listAvailablePhoneCountries,
  listAvailableSocialPlatforms,
  verifySocialAccount,
  deleteAssistantContact,
  fetchContactCosts,
  createAssistantContact,
  connectAssistantAccount,
  disconnectAssistantAccount,
  getGrantedFeatures,
} from '@/lib/assistants/contact';
import {
  listWorkspaceFileRoots,
  listWorkspaceFileChildren,
  getWorkspaceFilePolicy,
  updateWorkspaceFilePolicy,
} from '@/lib/assistants/workspace-files';
import { getSecrets, createSecret, updateSecret, deleteSecret } from '@/lib/assistants/secret';
import {
  getLiveviewUrl,
  buildLiveviewUrl,
  checkLiveviewHealth,
  wakeAssistantSession,
  sendSystemEvent,
  getDesktopApiKey,
  listUserDesktops,
  linkDesktop,
  unlinkDesktop,
  renameUserDesktop,
  deleteUserDesktop,
} from '@/lib/assistants/desktop';
import { setAssistantSpendingLimit } from '@/lib/assistants/spending';
import {
  getManagerMethodEvents,
  getToolLoopEvents,
  backfillByCallingIds,
} from '@/lib/assistants/action';
import { getSlackInstallAction, revokeSlackInstallAction } from '@/lib/assistants/slackActions';
import {
  getInstallStatusAction,
  bindInstallAction,
  revokeInstallAction as revokeMsTeamsBotInstallAction,
} from '@/lib/assistants/msTeamsBotActions';
import {
  disableManagedDesktop,
  enableManagedDesktop,
  getManagedDesktopStatus,
} from '@/lib/assistants/computerUse';
import type { AssistantActions } from '@/types/assistants/assistant';

export const assistantMainActions: AssistantActions = {
  assistant: {
    check: checkHiringFunds,
    create: createAssistant,
    update: updateAssistant,
    delete: deleteAssistant,
  },
  photo: {
    uploadPhoto,
    uploadVideo,
    downloadMedia,
    downloadPresetPhoto,
    downloadPresetVideo,
    generate: generatePhoto,
    edit: editPhoto,
    animate: animatePhoto,
    getAnimation: getAnimationPrediction,
    cancelAnimation: cancelAnimationPrediction,
  },
  voice: {
    register: registerVoice,
    delete: deleteVoice,
    clone: cloneVoice,
    generate: generateSpeech,
    preview: designVoiceGeneratePreviews,
    design: designVoiceCreateFromPreview,
  },
  chat: {
    getContactId: getContactIdByEmail,
    getTranscripts,
    message: messageAssistant,
    reactToMessage,
    getAssistantOwnerById,
    uploadAttachment,
  },
  contact: {
    delete: deleteAssistantContact,
    create: createAssistantContact,
    connect: connectAssistantAccount,
    disconnect: disconnectAssistantAccount,
    getGrantedFeatures,
    listAvailablePhoneCountries,
    listAvailableSocialPlatforms,
    verifySocialAccount,
    fetchContactCosts,
  },
  workspaceFiles: {
    listRoots: listWorkspaceFileRoots,
    listChildren: listWorkspaceFileChildren,
    getPolicy: getWorkspaceFilePolicy,
    updatePolicy: updateWorkspaceFilePolicy,
  },
  secret: {
    get: getSecrets,
    create: createSecret,
    update: updateSecret,
    delete: deleteSecret,
  },
  slack: {
    getInstall: getSlackInstallAction,
    revokeInstall: revokeSlackInstallAction,
  },
  msTeamsBot: {
    getInstall: getInstallStatusAction,
    bindInstall: bindInstallAction,
    revokeInstall: revokeMsTeamsBotInstallAction,
  },
  desktop: {
    getLiveviewUrl,
    buildLiveviewUrl,
    checkLiveviewHealth,
    wakeAssistantSession,
    sendSystemEvent,
    getApiKey: getDesktopApiKey,
    listUserDesktops,
    linkDesktop,
    unlinkDesktop,
    renameUserDesktop,
    deleteUserDesktop,
  },
  managedDesktop: {
    enable: enableManagedDesktop,
    disable: disableManagedDesktop,
    getStatus: getManagedDesktopStatus,
  },
  spending: {
    setLimit: setAssistantSpendingLimit,
  },
  actions: {
    getManagerMethodEvents,
    getToolLoopEvents,
    backfillByCallingIds,
  },
};
