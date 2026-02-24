/**
 * Demo Assistants Page
 *
 * This page allows Unify organization members to create and manage
 * demo assistants for product demonstrations.
 */

import * as React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/user';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Terminal } from 'lucide-react';
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
import { listAssistants } from '@/lib/assistants/assistant';
import { listAvailablePhoneCountries } from '@/lib/assistants/contact';
import { DemoActions } from '@/types/demo';

const DemoPage = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }

  const apiKey = user.apiKey;
  const adminKey = process.env.ORCHESTRA_ADMIN_KEY!;

  // Check if user is in the Unify/Orchestra Admin Organization
  const isUnifyMember =
    user.organizations.find(
      (o) =>
        o.name === 'Orchestra Admin Organization' &&
        ['owner', 'admin', 'member'].includes(o.roleName?.toLowerCase())
    ) !== undefined;

  if (!isUnifyMember) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="w-auto max-w-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You must be a member of the Unify organization to access demo assistant management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const demoActions: DemoActions = {
    list: await listDemoAssistants(apiKey),
    create: await createDemoAssistant(apiKey),
    getMeta: await getDemoMeta(apiKey),
    listMeta: await listDemoMeta(apiKey),
    listSourceAssistants: await listAssistants(apiKey, false),
    listAvailablePhoneCountries: await listAvailablePhoneCountries(adminKey),
    getContacts: await getDemoContacts(apiKey),
    getSpending: await getDemoSpending(apiKey),
    delete: await deleteDemoAssistant(apiKey),
  };

  return (
    <div className="h-full w-full">
      <DemoAssistantsMain demoActions={demoActions} userEmail={user.email} />
    </div>
  );
};

export default DemoPage;
