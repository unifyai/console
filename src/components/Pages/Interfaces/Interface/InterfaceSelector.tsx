'use client';

import React, { useEffect } from 'react';
import { Loader } from '@/components/Common/Loader';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  InterfaceData,
} from '@/types/interfaces/grid';
import { useQueryClient } from '@tanstack/react-query';
import {
  createInterfaceUrl,
  createCompleteDefaultInterface,
} from '@/utils/interfaces/interfaceSelector';
import { useListInterfacesQuery } from '@/hooks/Interfaces/Query/useInterfacesQuery';

const EMPTY_INTERFACE_DATA: InterfaceData[] = [];

interface InterfaceSelectorProps {
  projectId: string;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
}

/**
 * InterfaceSelector is a transient component that automatically selects an interface
 * for a given project and redirects the user.
 * - If interfaces exist, it redirects to the most recently updated one.
 * - If no interfaces exist, it creates a "Default" interface and redirects to it.
 * It only shows a loading screen to the user.
 */
export default function InterfaceSelector({
  projectId,
  interfaceActions,
  tabActions,
  tileActions,
}: InterfaceSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Fetch the list of interfaces for the current project.
  const {
    data: interfaces = EMPTY_INTERFACE_DATA,
    isLoading,
    error,
  } = useListInterfacesQuery(projectId, interfaceActions);

  useEffect(() => {
    // Wait until the query is complete
    if (isLoading) {
      return;
    }

    // Handle potential errors during fetch
    if (error) {
      console.error('Failed to load interfaces:', error);
      // Optional: Redirect to an error page or back to the project selection
      router.push('/interfaces');
      return;
    }

    const selectOrCreateInterface = async () => {
      try {
        if (interfaces.length > 0) {
          // If interfaces exist, find the most recently updated one and redirect.
          const sortedInterfaces = [...interfaces].sort((a, b) => {
            // FIX: Handle potentially undefined dates by providing a fallback (epoch time)
            const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return dateB - dateA; // Sort descending (newest first)
          });
          const latestInterface = sortedInterfaces[0];

          if (latestInterface) {
            const newUrl = createInterfaceUrl(searchParams, latestInterface.name);
            router.push(newUrl);
          } else {
            throw new Error('Could not determine the latest interface.');
          }
        } else if (projectId !== 'Usage') {
          // If no interfaces exist, create a default one and then redirect.
          const newInterface = await createCompleteDefaultInterface({
            queryClient,
            project: projectId,
            interfaceActions,
            tabActions,
            tileActions,
            baseName: 'Default',
          });

          if (newInterface && newInterface.name) {
            const newUrl = createInterfaceUrl(searchParams, newInterface.name);
            router.push(newUrl);
          } else {
            throw new Error('Failed to create the default interface.');
          }
        } else {
          // For the special "Usage" project we simply stay on the project view with no interfaces.
          router.push(`/interfaces?project=${encodeURIComponent(projectId)}`);
        }
      } catch (err) {
        console.error('Error in interface selection/creation:', err);
        // Fallback: if something goes wrong, redirect to the base interfaces page
        router.push('/interfaces');
      }
    };

    selectOrCreateInterface();
  }, [
    isLoading,
    interfaces,
    error,
    projectId,
    queryClient,
    interfaceActions,
    tabActions,
    tileActions,
    searchParams,
    router,
  ]);

  // Render a full-page loading indicator while the logic runs.
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <Loader size={32} />
      <p className="text-body mt-4 text-muted">Setting up your workspace...</p>
    </div>
  );
}
