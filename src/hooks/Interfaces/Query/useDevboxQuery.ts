"use client";

import { useQuery, useMutation } from '@tanstack/react-query';
import { DevboxActions } from '@/types/interfaces/grid';
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook to fetch devbox data
 */
export function useGetDevboxQuery(devboxActions: DevboxActions) {
  const queryClient = useQueryClient();
  
  // Query to get devbox
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['devbox'],
    queryFn: async () => {
      return await devboxActions.get();
    },
  });
  
  // Mutation to create devbox
  const { mutate, isPending: isCreating, error: createError } = useMutation({
    mutationFn: async () => {
      return await devboxActions.create();
    },
    onSuccess: () => {
      // Invalidate and refetch devbox data after successful creation
      queryClient.invalidateQueries({ queryKey: ['devbox'] });
    }
  });
  
  // Auto-create devbox if it doesn't exist
  if (data === null && !isLoading && !isCreating) {
    mutate();
  }
  
  return {
    data: data,
    isLoading: isLoading || isCreating,
    error: error || createError,
  };
} 