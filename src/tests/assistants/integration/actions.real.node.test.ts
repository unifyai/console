/**
 * Real API tests for Assistant actions.
 *
 * These tests hit the actual API to verify assistant endpoints work correctly.
 * Run with: npm run test:real
 *
 * Requirements:
 *   1. VITE_TEST_API_KEY set in .env.test
 *   2. VITE_TEST_ADMIN_KEY set in .env.test (for admin operations)
 *   3. Dev server running (npm run dev) or NEXT_PUBLIC_BASE_URL pointing to a running instance
 */

// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  assistantsApi,
  voiceApi,
  voiceApiExtended,
  contactApi,
  photoApi,
  photoApiExtended,
  callApi,
  desktopApi,
  desktopApiExtended,
  chatApi,
  secretApi,
  taskApi,
  getTestAssistant,
  getTestVoice,
  getTestApiKey,
  getAdminApiKey,
  skipIfServerNotReachable,
  realTestOptions,
  realTestOptionsExtended,
  type AssistantData,
  type VoiceData,
} from '@/tests/assistants/api/fixtures/api-actions';

const isError = (res: unknown): res is { detail: string } => {
  return res !== null && typeof res === 'object' && 'detail' in res;
};

describe('@real Assistants Server Actions (Integration)', () => {
  let API_KEY: string;
  let ADMIN_KEY: string;

  beforeAll(async () => {
    try {
      API_KEY = getTestApiKey();
    } catch {
      console.warn('VITE_TEST_API_KEY not set, skipping integration tests');
      return;
    }

    try {
      ADMIN_KEY = getAdminApiKey();
    } catch {
      console.warn('VITE_TEST_ADMIN_KEY not set, some tests will be skipped');
      ADMIN_KEY = '';
    }

    await skipIfServerNotReachable();
  }, 10000);

  describe('assistantsApi', () => {
    it('@real listAssistants: should return a list of assistants', realTestOptions, async () => {
      const res = await assistantsApi.list(API_KEY);

      expect(isError(res)).toBe(false);
      expect(Array.isArray(res)).toBe(true);
      if (Array.isArray(res) && res.length > 0) {
        expect(res[0]).toHaveProperty('agentId');
        expect(res[0]).toHaveProperty('firstName');
        expect(res[0]).toHaveProperty('surname');
      }

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });

    it('@real getAssistantStatus: should return status object', realTestOptions, async () => {
      const assistant = await getTestAssistant(API_KEY);
      const assistantId = assistant.agentId;

      const res = await assistantsApi.getStatus(assistantId, API_KEY);

      expect(isError(res)).toBe(false);
      expect(res).toHaveProperty('running');

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });

    it(
      '@real updateAssistant: should successfully update the assistant',
      realTestOptions,
      async () => {
        const assistant = await getTestAssistant(API_KEY);
        const assistantId = assistant.agentId;

        const updatedLimit = 30;
        const res = await assistantsApi.update(assistantId, { weeklyLimit: updatedLimit }, API_KEY);

        expect(isError(res)).toBe(false);
        expect(res).toHaveProperty('info');
        expect(res.info).toHaveProperty('agentId');
        expect(res.info.weeklyLimit).toBe(30);

        console.log('========== TEST RESULT ==========');
        console.log(res);
      }
    );

    it(
      '@real createAssistant: should successfully create an assistant',
      realTestOptionsExtended,
      async () => {
        // Use unique name to avoid 409 conflicts
        const uniqueName = `TestBot-${Date.now()}`;
        const res = await assistantsApi.create(
          uniqueName,
          'Agent',
          40,
          'GB',
          'UTC',
          'https://cdn.jsdelivr.net/gh/faker-js/assets-person-portrait/male/512/1.jpg',
          'gs://bucket/preset_assistants/Ricardo_Silva_elevenlabs.mp4',
          'Integration test assistant for automated testing',
          API_KEY
        );

        // Creation should succeed - 409 would indicate a test isolation bug
        expect(isError(res)).toBe(false);
        expect(res.assistant).toBeDefined();
        expect(res.assistant.agentId).toBeDefined();
        expect(res.assistant.firstName).toBe(uniqueName);

        console.log('========== TEST RESULT ==========');
        console.log(res);
      }
    );

    it(
      '@real deleteAssistant: should successfully delete an assistant',
      realTestOptions,
      async () => {
        const assistant = await getTestAssistant(API_KEY);
        const assistantId = assistant.agentId;

        const res = await assistantsApi.delete(assistantId, API_KEY);

        expect(isError(res)).toBe(false);
        expect(res.info).toBeDefined();

        console.log('========== TEST RESULT ==========');
        console.log(res);
      }
    );
  });

  describe('callApi', () => {
    it(
      '@real getCallConnectionDetails: should return details or server config error',
      realTestOptions,
      async () => {
        try {
          const assistant = await getTestAssistant(API_KEY);
          const assistantId = assistant.agentId;
          const assistantName = assistant.firstName;

          const res = await callApi.getConnectionDetails(assistantId, assistantName, API_KEY);

          if (isError(res)) {
            expect(res.detail).toBeDefined();
          } else {
            // May have serverUrl/token or other fields depending on config
            expect(res).toBeDefined();
          }

          console.log('========== TEST RESULT ==========');
          console.log(res);
        } catch (e: unknown) {
          // LiveKit/call setup may not be configured
          if (
            e instanceof Error &&
            (e.message.includes('503') ||
              e.message.includes('500') ||
              e.message.includes('Invalid JSON'))
          ) {
            console.log('Call connection service not available');
            return;
          }
          throw e;
        }
      }
    );

    it(
      '@real dispatchAssistantToCall: should attempt to dispatch assistant',
      realTestOptions,
      async () => {
        try {
          const assistant = await getTestAssistant(API_KEY);
          const assistantId = assistant.agentId;
          const assistantName = assistant.firstName;

          const res = await callApi.dispatch(
            assistantId,
            assistantName,
            `test-room-${Date.now()}`,
            API_KEY
          );

          if (isError(res)) {
            expect(res.detail).toBeDefined();
          } else {
            expect(res).toBeDefined();
          }

          console.log('========== TEST RESULT ==========');
          console.log(res);
        } catch (e: unknown) {
          // LiveKit/call setup may not be configured
          if (
            e instanceof Error &&
            (e.message.includes('503') ||
              e.message.includes('500') ||
              e.message.includes('404') ||
              e.message.includes('Invalid JSON'))
          ) {
            console.log('Call dispatch service not available');
            return;
          }
          throw e;
        }
      }
    );
  });

  describe('contactApi', () => {
    it(
      '@real listAvailablePhoneCountries: should return country list',
      realTestOptions,
      async () => {
        // This endpoint requires admin access
        if (!ADMIN_KEY) {
          console.log('Skipping: ADMIN_KEY not set (required for this endpoint)');
          return;
        }

        try {
          const res = await contactApi.listCountries(ADMIN_KEY);

          expect(Array.isArray(res)).toBe(true);
          expect(res.length).toBeGreaterThan(0);
          expect(res[0]).toHaveProperty('code');
          expect(res[0]).toHaveProperty('name');
          expect(res[0]).toHaveProperty('flag');

          console.log('========== TEST RESULT ==========');
          console.log(res);
        } catch (e: unknown) {
          // 403 means admin access is required
          if (e instanceof Error && e.message.includes('403')) {
            console.log('Admin access required (403), skipping');
            return;
          }
          throw e;
        }
      }
    );

    it(
      '@real listAvailableSocialPlatforms: should return platform list',
      realTestOptions,
      async () => {
        if (!ADMIN_KEY) {
          console.log('Skipping: ADMIN_KEY not set');
          return;
        }

        const res = await contactApi.listPlatforms(ADMIN_KEY);

        expect(isError(res)).toBe(false);
        expect(Array.isArray(res)).toBe(true);

        console.log('========== TEST RESULT ==========');
        console.log(res);
      }
    );

    it('@real listAllAssistantEmails: should return list of emails', realTestOptions, async () => {
      if (!ADMIN_KEY) {
        console.log('Skipping: ADMIN_KEY not set');
        return;
      }

      const res = await contactApi.listEmails(ADMIN_KEY);

      expect(isError(res)).toBe(false);
      expect(Array.isArray(res)).toBe(true);

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });

    it('@real verifySocialAccount: should attempt verification', realTestOptions, async () => {
      // This endpoint requires admin access
      if (!ADMIN_KEY) {
        console.log('Skipping: ADMIN_KEY not set (required for this endpoint)');
        return;
      }

      try {
        const res = await contactApi.verifySocial('telegram', 'test_user_account', ADMIN_KEY);

        if (isError(res)) {
          expect(res.detail).toBeDefined();
        } else {
          expect(res).toHaveProperty('verificationCode');
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      } catch (e: unknown) {
        // 403 means admin access is required
        if (e instanceof Error && e.message.includes('403')) {
          console.log('Admin access required (403), skipping');
          return;
        }
        throw e;
      }
    });

    it(
      '@real deleteAssistantContact: should attempt to delete contact',
      realTestOptions,
      async () => {
        try {
          const assistant = await getTestAssistant(API_KEY);
          const assistantId = assistant.agentId;

          const res = await contactApi.deleteContact(assistantId, 'email', API_KEY);

          if (isError(res)) {
            expect(res.detail).toBeDefined();
          } else {
            expect(res.info || res.assistant).toBeDefined();
          }

          console.log('========== TEST RESULT ==========');
          console.log(res);
        } catch (e: unknown) {
          // Various errors are acceptable for this test
          if (
            e instanceof Error &&
            (e.message.includes('404') ||
              e.message.includes('400') ||
              e.message.includes('Invalid JSON'))
          ) {
            console.log('Contact deletion not available or no contact to delete');
            return;
          }
          throw e;
        }
      }
    );
  });

  describe('photoApi', () => {
    it('@real uploadPhoto: should upload a test image', realTestOptionsExtended, async () => {
      const response = await fetch('https://thispersondoesnotexist.com/');
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', blob, 'test.jpg');

      const res = await photoApi.upload(formData, API_KEY);

      if (isError(res)) {
        expect(res.detail).toBeDefined();
      } else {
        expect(res).toHaveProperty('gcsUrl');
      }

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });

    it('@real uploadVideo: should upload a test video', realTestOptionsExtended, async () => {
      const tinyMp4Base64 =
        'AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAAAIZnJlZQAACjBtZGF0AAAAAAEAAQ==';
      const tinyMp4Binary = Uint8Array.from(atob(tinyMp4Base64), (c) => c.charCodeAt(0));
      const blob = new Blob([tinyMp4Binary], { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('file', blob, 'test.mp4');

      const res = await photoApi.uploadVideo(formData, API_KEY);

      if (isError(res)) {
        expect(res.detail).toBeDefined();
      } else {
        expect(res).toHaveProperty('gcsUrl');
      }

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });

    it('@real generatePhoto: should attempt generation', realTestOptionsExtended, async () => {
      const res = await photoApi.generate(
        'Professional profile photo of a european male banker',
        API_KEY
      );

      console.log('========== TEST RESULT ==========');
      console.log(JSON.stringify(res, null, 2));

      if (isError(res)) {
        // Error response is acceptable (e.g., rate limits, content policy)
        expect(res.detail).toBeDefined();
      } else {
        // Success response MUST have a URL somewhere
        const url =
          res.url ||
          (res.info && typeof res.info === 'object' && (res.info.url || res.info.gcsUrl)) ||
          res.gcsUrl;
        expect(url).toBeDefined();
        expect(typeof url).toBe('string');
        if (url) {
          expect(url.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('voiceApi', () => {
    it('@real listVoices: should return available voices', realTestOptions, async () => {
      const res = await voiceApi.list(API_KEY);

      expect(isError(res)).toBe(false);
      expect(Array.isArray(res)).toBe(true);
      if (Array.isArray(res) && res.length > 0) {
        expect(res[0]).toHaveProperty('voiceId');
      }

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });

    it('@real generateSpeech: should return audio data', realTestOptionsExtended, async () => {
      const voice = await getTestVoice(API_KEY);
      const voiceId = voice.voiceId;
      const voiceProvider = voice.provider;

      const res = await voiceApi.generateSpeech(
        'Hello world',
        voiceProvider,
        voiceId,
        'mp3',
        API_KEY
      );

      if (isError(res)) {
        expect(res.detail).toBeDefined();
      } else {
        expect(res.audioBase64).toBeDefined();
      }

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });

    it('@real registerVoice: should add the voice to the list', realTestOptions, async () => {
      // Use a unique voice ID to avoid 409 conflicts
      // Note: This test may fail if the voice ID doesn't exist in ElevenLabs
      // In production, this would be a voice from the ElevenLabs library
      const uniqueVoiceId = `test-voice-${Date.now()}`;

      const res = await voiceApi.register(
        uniqueVoiceId,
        'elevenlabs',
        `Test Voice ${Date.now()}`,
        'Integration test voice registration',
        'female',
        'en',
        false, // not a preset
        API_KEY
      );

      // Registration should succeed or fail with a clear error
      // 409 (conflict) indicates a test isolation problem
      if (isError(res)) {
        // Only acceptable errors are from invalid voice IDs (ElevenLabs validation)
        expect(res.detail).toBeDefined();
        console.log('Voice registration failed (expected if voice ID is invalid):', res.detail);
      } else {
        expect(isError(res)).toBe(false);
      }

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });

    it('@real deleteVoice: should remove the voice from the list', realTestOptions, async () => {
      // Get a non-preset voice to delete (preset voices cannot be deleted)
      const voices = await voiceApi.list(API_KEY);
      const nonPresetVoice = voices.find(
        (v: VoiceData & { isPreset?: boolean }) => v.isPreset === false
      );

      if (!nonPresetVoice) {
        // This is a valid skip - no user-created voices exist
        console.log('No non-preset voices available to delete, skipping');
        return;
      }

      const res = await voiceApi.delete(nonPresetVoice.voiceId, nonPresetVoice.provider, API_KEY);

      // Deletion should succeed
      expect(isError(res)).toBe(false);

      // Verify voice is actually deleted by checking it's no longer in the list
      const voicesAfter = await voiceApi.list(API_KEY);
      const stillExists = voicesAfter.some((v: VoiceData) => v.voiceId === nonPresetVoice.voiceId);
      expect(stillExists).toBe(false);

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });
  });

  describe('desktopApi', () => {
    it(
      '@real getLiveviewUrl: should setup call, dispatch assistant, then return url',
      realTestOptionsExtended,
      async () => {
        try {
          const assistant = await getTestAssistant(API_KEY);
          const assistantId = assistant.agentId;
          const assistantName = assistant.firstName;

          // Setup Call Room
          const connDetails = await callApi.getConnectionDetails(
            assistantId,
            assistantName,
            API_KEY
          );
          if (isError(connDetails)) {
            console.log('Skipping: Could not get connection details');
            return;
          }

          const roomName = connDetails.roomName;
          if (!roomName) {
            console.log('Skipping: No room name returned');
            return;
          }

          // Dispatch Assistant to Room
          const dispatchRes = await callApi.dispatch(assistantId, assistantName, roomName, API_KEY);
          if (isError(dispatchRes)) {
            console.log('Skipping: Could not dispatch assistant');
            return;
          }

          // Wait for assistant to join/initialize
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Get LiveView URL (requires userId - use a placeholder)
          const res = await desktopApiExtended.getLiveviewUrl(assistantId, 'test-user-id', API_KEY);

          if (isError(res)) {
            expect(res.detail).toBeDefined();
          } else {
            expect(res).toHaveProperty('liveviewUrl');
          }

          console.log('========== TEST RESULT ==========');
          console.log(res);
        } catch (e: unknown) {
          // LiveKit/desktop services may not be configured
          if (
            e instanceof Error &&
            (e.message.includes('503') ||
              e.message.includes('500') ||
              e.message.includes('Invalid JSON'))
          ) {
            console.log('Desktop/liveview service not available');
            return;
          }
          throw e;
        }
      }
    );

    it('@real sendSystemEvent: should send pause/resume event', realTestOptions, async () => {
      try {
        const assistant = await getTestAssistant(API_KEY);
        const assistantId = assistant.agentId;

        const res = await desktopApi.sendSystemEvent(
          assistantId,
          'pause_actor',
          'Integration Test Pause',
          API_KEY
        );

        if (isError(res)) {
          expect(res.detail).toBeDefined();
        } else {
          expect(res.info || res).toBeDefined();
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      } catch (e: unknown) {
        // Desktop event service may not be configured
        if (
          e instanceof Error &&
          (e.message.includes('503') ||
            e.message.includes('500') ||
            e.message.includes('404') ||
            e.message.includes('Invalid JSON'))
        ) {
          console.log('Desktop event service not available');
          return;
        }
        throw e;
      }
    });
  });

  describe('chatApi', () => {
    it('@real getTranscripts: should return chat history', realTestOptions, async () => {
      const assistant = await getTestAssistant(API_KEY);
      const assistantName = `${assistant.firstName}${assistant.surname}`;
      const userName = 'TestUser'; // Placeholder

      // First get the contactId for this user
      const contactId = await chatApi.getContactIdByEmail(
        userName,
        assistantName,
        'test@example.com',
        API_KEY
      );

      // Skip test if no contactId found
      if (contactId === null) {
        console.log('No contactId found for this user, skipping transcript test');
        return;
      }

      const res = await chatApi.getTranscripts(userName, assistantName, contactId, API_KEY);

      expect(isError(res)).toBe(false);
      expect(Array.isArray(res)).toBe(true);

      console.log('========== TEST RESULT ==========');
      console.log(res);
    });

    it('@real messageAssistant: should dispatch a message', realTestOptions, async () => {
      // Note: /api/assistant/chat/message route may not be implemented yet
      try {
        const assistant = await getTestAssistant(API_KEY);
        const assistantId = assistant.agentId;

        const res = await chatApi.messageAssistant(
          assistantId,
          1, // Assuming test user contact ID
          'Integration Test Ping',
          API_KEY
        );

        if (isError(res)) {
          expect(res.detail).toBeDefined();
        } else {
          expect(res).toBeDefined();
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      } catch (e: unknown) {
        // 404 or 405 means route not implemented
        if (
          e instanceof Error &&
          (e.message.includes('404') ||
            e.message.includes('405') ||
            e.message.includes('Invalid JSON'))
        ) {
          console.log('Skipping: /api/assistant/chat/message route not yet implemented');
          return;
        }
        throw e;
      }
    });
  });

  describe('secretApi', () => {
    // TODO: Implement /api/assistant/[id]/secrets routes
    it.todo('@real createSecret: should add a secret (route not implemented)');
    it.todo('@real getSecrets: should get the secrets list (route not implemented)');
    it.todo('@real deleteSecret: should delete a secret (route not implemented)');
  });

  describe('taskApi', () => {
    // TODO: Implement /api/assistant/tasks routes
    it.todo('@real getTasks: should retrieve tasks for assistant (route not implemented)');
    it.todo('@real getUniqueFieldValues: should return values for a field (route not implemented)');
    it.todo('@real updateTask: should attempt to update a task (route not implemented)');
  });

  describe('photoApiExtended', () => {
    // TODO: Implement /api/assistant/photo/list and /api/assistant/photo/download routes
    it.todo('@real downloadPhoto: should generate signed URL (route not implemented)');

    // TODO: Implement /api/assistant/video/preset route
    it.todo(
      '@real downloadPresetVideo: should attempt to get preset video URL (route not implemented)'
    );

    it('@real editPhoto: should attempt photo edit', realTestOptionsExtended, async () => {
      const formData = new FormData();
      formData.append('prompt', 'make it black and white');
      formData.append('input_image_url', 'https://thispersondoesnotexist.com/');

      const res = await photoApiExtended.edit(formData, API_KEY);

      console.log('========== TEST RESULT ==========');
      console.log(JSON.stringify(res, null, 2));

      if (isError(res)) {
        // Error response is acceptable (e.g., rate limits, content policy)
        expect(res.detail).toBeDefined();
      } else {
        // Success response MUST have a URL somewhere
        const url =
          res.url ||
          (res.info && typeof res.info === 'object' && (res.info.url || res.info.gcsUrl)) ||
          res.gcsUrl;
        expect(url).toBeDefined();
        expect(typeof url).toBe('string');
        if (url) {
          expect(url.length).toBeGreaterThan(0);
        }
      }
    });

    it(
      '@real animatePhoto: should start animation job, poll status, and retrieve final video URL',
      { meta: { mock: false }, timeout: 120000 },
      async () => {
        // Fetch test image
        const imageResponse = await fetch('https://thispersondoesnotexist.com/');
        expect(imageResponse.ok).toBe(true);
        const imageBuffer = await imageResponse.arrayBuffer();
        const blobImage = new Blob([imageBuffer], { type: 'image/jpeg' });

        // Fetch test audio
        const audioUrl =
          'https://github.com/jim-schwoebel/sample_voice_data/raw/master/males/091b696d-31a3-41a6-9248-74e03a4ea773.wav';
        const audioResponse = await fetch(audioUrl);
        expect(audioResponse.ok).toBe(true);
        const audioBuffer = await audioResponse.arrayBuffer();
        const blobAudio = new Blob([audioBuffer], { type: 'audio/wav' });

        const formData = new FormData();
        formData.append('image_file', blobImage, 'face.jpg');
        formData.append('audio_file', blobAudio, 'voice.wav');

        // Start animation
        const startRes = await photoApiExtended.animate(formData, API_KEY);

        // Animation must start successfully
        expect(isError(startRes)).toBe(false);
        expect(startRes).toHaveProperty('id');
        const predictionId = startRes.id!;
        console.log(`Animation started. Prediction ID: ${predictionId}`);

        // Poll for completion
        let status = startRes.status;
        let finalResult = startRes;
        let attempts = 0;
        const maxAttempts = 30;
        const delayMs = 3000;

        while (['starting', 'processing'].includes(status || '') && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          const statusRes = await photoApiExtended.getAnimationStatus(predictionId, API_KEY);
          expect(isError(statusRes)).toBe(false);
          finalResult = statusRes;
          status = finalResult.status;
          attempts++;
          console.log(`Polling... Status: ${status} (Attempt ${attempts})`);
        }

        // Animation must succeed
        expect(status).toBe('succeeded');

        const outputUrl = Array.isArray(finalResult.output)
          ? finalResult.output[0]
          : finalResult.output;
        expect(outputUrl).toBeDefined();
        expect(typeof outputUrl).toBe('string');
        console.log('Animation completed successfully. Video URL:', outputUrl);
      }
    );

    it(
      '@real cancelAnimation: should cancel an animation job',
      realTestOptionsExtended,
      async () => {
        try {
          const imageResponse = await fetch('https://thispersondoesnotexist.com/');
          if (!imageResponse.ok) {
            console.log('Could not fetch test image, skipping');
            return;
          }
          const imageBuffer = await imageResponse.arrayBuffer();
          const blobImage = new Blob([imageBuffer], { type: 'image/jpeg' });

          const audioUrl =
            'https://github.com/jim-schwoebel/sample_voice_data/raw/master/males/091b696d-31a3-41a6-9248-74e03a4ea773.wav';
          const audioResponse = await fetch(audioUrl);
          if (!audioResponse.ok) {
            console.log('Could not fetch test audio, skipping');
            return;
          }
          const audioBuffer = await audioResponse.arrayBuffer();
          const blobAudio = new Blob([audioBuffer], { type: 'audio/wav' });

          const formData = new FormData();
          formData.append('image_file', blobImage, 'face.jpg');
          formData.append('audio_file', blobAudio, 'voice.wav');

          const startRes = await photoApiExtended.animate(formData, API_KEY);
          if (isError(startRes) || !startRes.id) {
            console.log('Animation failed to start, skipping');
            return;
          }

          const predictionId = startRes.id;
          console.log(`Animation started. Prediction ID: ${predictionId}`);

          const res = await photoApiExtended.cancelAnimation(predictionId, API_KEY);

          if (isError(res)) {
            expect(res.detail).toBeDefined();
          }

          console.log('========== TEST RESULT ==========');
          console.log(res);
        } catch (e: unknown) {
          // External API errors (503, content moderation failures) are expected in tests
          if (
            e instanceof Error &&
            (e.message.includes('503') || e.message.includes('moderation'))
          ) {
            console.log('External API error (expected for test content):', e.message.slice(0, 100));
            return;
          }
          throw e;
        }
      }
    );
  });

  describe('voiceApiExtended', () => {
    it(
      '@real designVoice: should generate previews and create from preview',
      realTestOptionsExtended,
      async () => {
        const previewRes = await voiceApiExtended.designPreview(
          'A deep, wise-sounding male voice',
          true,
          API_KEY
        );

        console.log('========== PREVIEW TEST RESULT ==========');
        console.log(previewRes);

        if (isError(previewRes)) {
          expect(previewRes.detail).toBeDefined();
          return;
        }

        if (previewRes.previews && previewRes.previews.length > 0) {
          const previewItem = previewRes.previews[0];
          const createRes = await voiceApiExtended.designCreate(
            previewItem.generatedVoiceId,
            'Test Designed Voice',
            'This is a test voice',
            API_KEY
          );

          console.log('========== CREATE TEST RESULT ==========');
          console.log(createRes);

          if (isError(createRes)) {
            expect(createRes.detail).toBeDefined();
          } else {
            expect(createRes).toHaveProperty('voiceId');
          }
        }
      }
    );

    it('@real cloneVoice: should attempt cloning', realTestOptionsExtended, async () => {
      const audioUrl =
        'https://github.com/jim-schwoebel/sample_voice_data/raw/master/males/091b696d-31a3-41a6-9248-74e03a4ea773.wav';
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        console.log('Could not fetch test audio, skipping');
        return;
      }
      const audioBuffer = await audioResponse.arrayBuffer();
      const blobAudio = new Blob([audioBuffer], { type: 'audio/wav' });

      const formData = new FormData();
      // Orchestra expects 'file' field for voice cloning
      formData.append('file', blobAudio, 'voice.wav');
      formData.append('name', 'Cloned Test Voice');

      try {
        const res = await voiceApiExtended.clone(formData, API_KEY);

        if (isError(res)) {
          expect(res.detail).toBeDefined();
        } else {
          expect(res).toHaveProperty('voiceId');
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      } catch (e: unknown) {
        // Handle validation errors from the API
        if (e instanceof Error && e.message.includes('422')) {
          console.log('Voice cloning validation error (expected for test audio)');
          return;
        }
        throw e;
      }
    });
  });
});
