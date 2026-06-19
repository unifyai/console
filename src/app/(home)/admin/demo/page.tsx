/**
 * Demo Assistants Page
 *
 * This page allows Unify organization members to create and manage
 * demo assistants for product demonstrations.
 */

import * as React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/user';
import DemoAssistantsMain from '@/components/Pages/Demo/Main';
import {
  listDemoAssistants,
  createDemoAssistant,
  getDemoMeta,
  listDemoMeta,
  getDemoContacts,
  getDemoSpending,
  deleteDemoAssistant,
} from '@/lib/demo/assistant';
import { listAssistants, listSourceAssistants } from '@/lib/assistants/assistant';
import { listAvailablePhoneCountries } from '@/lib/assistants/contact';
import { DemoActions } from '@/types/demo';

const DemoPage = async () => {
  const user = await getCurrentUser();
  if (!user) redirect('/login?signout=true');

  const demoActions: DemoActions = {
    list: listDemoAssistants,
    create: createDemoAssistant,
    getMeta: getDemoMeta,
    listMeta: listDemoMeta,
    listSourceAssistants: listSourceAssistants,
    listAvailablePhoneCountries,
    getContacts: getDemoContacts,
    getSpending: getDemoSpending,
    delete: deleteDemoAssistant,
  };

  return (
    <div className="h-full w-full">
      <DemoAssistantsMain demoActions={demoActions} userEmail={user.email} />
    </div>
  );
};

export default DemoPage;
