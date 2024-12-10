import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod';

const unifyErrorDataSchema = z.object({
  object: z.literal('error'),
  message: z.string(),
  type: z.string(),
  param: z.string().nullable(),
  code: z.string().nullable(),
});

export type UnifyErrorData = z.infer<typeof unifyErrorDataSchema>;

export const unifyFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: unifyErrorDataSchema,
  errorToMessage: data => data.message,
});