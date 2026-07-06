'use client';

import DemoAssistantsMain from '@/components/Pages/Demo/Main';
import {
  createDemoAssistant,
  deleteDemoAssistant,
  getDemoContacts,
  getDemoMeta,
  getDemoSpending,
  listDemoAssistants,
  listDemoMeta,
} from '@/lib/demo/assistant';
import { listSourceAssistants } from '@/lib/assistants/assistant';
import { listAvailablePhoneCountries } from '@/lib/assistants/contact';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import type { DemoActions } from '@/types/demo';

const demoActions: DemoActions = {
  list: listDemoAssistants,
  create: createDemoAssistant,
  getMeta: getDemoMeta,
  listMeta: listDemoMeta,
  listSourceAssistants,
  listAvailablePhoneCountries,
  getContacts: getDemoContacts,
  getSpending: getDemoSpending,
  delete: deleteDemoAssistant,
};

export default function AdminDemoPanel() {
  const { user } = useWorkspace();

  return (
    <div className="h-full w-full">
      <DemoAssistantsMain demoActions={demoActions} userEmail={user?.email ?? ''} />
    </div>
  );
}
