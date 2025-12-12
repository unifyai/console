// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import * as AssistantActions from '@/lib/assistants/assistant';
import * as ChatActions from '@/lib/assistants/chat';
import * as TaskActions from '@/lib/assistants/task';
import * as SecretActions from '@/lib/assistants/secret';
import * as VoiceActions from '@/lib/assistants/voice';
import * as ContactActions from '@/lib/assistants/contact';
import * as PhotoActions from '@/lib/assistants/photo';
import * as CallActions from '@/lib/assistants/call';
import * as DesktopActions from '@/lib/assistants/desktop';
import * as UserActions from '@/lib/user/user';
import { Assistant } from '@/types/assistants/assistant';
import { Secret } from '@/types/assistants/secret';

/** Environment Setup:
These tests are integration tests that make REAL network requests.
They require:
    1. process.env.VITE_TEST_API_KEY to be set in .env.test
    2. process.env.NEXTAUTH_URL to point to a running instance of the Console API (or a proxy).
    3. process.env.ORCHESTRA_URL (for some photo/voice actions)
**/

const API_KEY = process.env.VITE_TEST_API_KEY;
const ADMIN_KEY = process.env.VITE_TEST_ADMIN_KEY;

const isError = (res: any): res is { detail: string } => {
    return res && typeof res === 'object' && 'detail' in res && typeof res.detail === 'string';
};

const getTestAssistant = async (key: string) : Promise<Assistant> => {
    const listAction = await AssistantActions.listAssistants(key);
    const listRes = await listAction();
    if (!Array.isArray(listRes) || listRes.length === 0 || !listRes[0].agent_id) throw new Error(`No assistant found. Skipping test.`);
    return listRes[0];
}

const getTestSecret = async (key: string, assistant_context: string) : Promise<Secret> => {
    const user = await UserActions.getCurrentUser();
    if (!user || !user.id) throw new Error("No user found for test.");
    const userName = `${user.name}${user.lastName}`;

    const getAction = await SecretActions.getSecrets(key, userName);
    const getRes = await getAction(assistant_context);
    if (!Array.isArray(getRes) || getRes.length === 0 || !getRes[0].log_id) throw new Error(`No secret found. Skipping test.`);
    return getRes[0];
}

const getTestVoice = async (key: string) => {
    const listAction = await VoiceActions.listVoices(key);
    const listRes = await listAction();
    if (!Array.isArray(listRes) || listRes.length === 0 || !listRes[0].voice_id) throw new Error(`No voice found. Skipping test.`);
    return listRes[0];
}

describe('Assistants Server Actions (Integration)', { meta: { mock: false } }, () => {
    
    if (!API_KEY) {
        it.skip('Skipping integration tests: VITE_TEST_API_KEY is missing.', () => {});
        return;
    }

    describe('lib/assistants/assistant.ts', () => {

        it('listAssistants: should return a list of assistants', async () => {
            const action = await AssistantActions.listAssistants(API_KEY);
            const res = await action();
            expect(isError(res)).toBe(false);
            expect(Array.isArray(res)).toBe(true);
            if (Array.isArray(res) && res.length > 0) {
                expect(res[0]).toHaveProperty('agent_id');
                expect(res[0]).toHaveProperty('first_name');
                expect(res[0]).toHaveProperty('surname');
            };
            
            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('getAssistantStatus: should return status object', async () => {

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;

            const action = await AssistantActions.getAssistantStatus(API_KEY);
            const res = await action(assistantId);
            expect(isError(res)).toBe(false);
            expect(res).toHaveProperty('running');

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('updateAssistant: should successfully update the assistant', async () => {

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;

            const action = await AssistantActions.updateAssistant(API_KEY);
            const updated_limit = 30
            const res = await action(assistantId, { weekly_limit: updated_limit });
            expect(isError(res)).toBe(false);
            expect(res).toHaveProperty('info');
            expect(res.info).toHaveProperty('agent_id');
            expect(res.info.weekly_limit).toHaveValue(30);

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('createAssistant: should successfully create an assistant', async () => {

            const action = await AssistantActions.createAssistant(API_KEY);
            const res = await action(
                "Test", "Agent", 40, "GB", "UTC",                                               // Base contact
                "https://cdn.jsdelivr.net/gh/faker-js/assets-person-portrait/male/512/1.jpg",   // Profile photo
                "gs://bucket/preset_assistants/Ricardo_Silva_elevenlabs.mp4",  // Profile video
                "Integration test assistant for automated testing",                             // About
                null, null, null,                                                               // Voice
                null, null, null, null,                                                         // Infra
                null,                                                                           // Desktop
                []                                                                              // Chat
            );
            expect(isError(res)).toBe(false);
            const tempAssistant = res.assistant;
            expect(tempAssistant).toBeDefined();

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('deleteAssistant: should successfully delete an assistant', async () => {

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;

            const action = await AssistantActions.deleteAssistant(API_KEY);
            const res = await action(assistantId);
            expect(isError(res)).toBe(false);
            expect(res.info).toBeDefined();

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

    });

    describe('lib/assistants/call.ts', () => {

        it('getCallConnectionDetails: should return details or server config error', async () => {

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;
            const assistantName = assistant.first_name;

            const action = await CallActions.getCallConnectionDetails(API_KEY);
            const res = await action(assistantId, assistantName);            
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('serverUrl');
                expect(res).toHaveProperty('token');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('dispatchAssistantToCall: should attempt to dispatch assistant', async () => {

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;
            const assistantName = assistant.first_name;

            const action = await CallActions.dispatchAssistantToCall(API_KEY);
            const res = await action(assistantId, assistantName, `test-room-${Date.now()}`);
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toBeDefined();
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

    });

    describe('lib/assistants/chat.ts', () => {

        it('getTranscripts: should return chat history', async () => {

            const user = await UserActions.getCurrentUser();
            if (!user || !user.id) throw new Error("No user found for test.");
            const userName = `${user.name}${user.lastName}`;

            const assistant = await getTestAssistant(API_KEY);
            const assistantName = `${assistant.first_name}${assistant.surname}`;

            const action = await ChatActions.getTranscripts(API_KEY, userName);
            const res = await action(assistantName);
            
            expect(isError(res)).toBe(false);
            expect(Array.isArray(res)).toBe(true);

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('messageAssistant: should dispatch a message', async () => {

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;
            
            const action = await ChatActions.messageAssistant(API_KEY);
            const res = await action({
                assistant_id: Number(assistantId),
                contact_id: 1, // Assuming test user ID
                message: "Integration Test Ping"
            });
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toBeDefined();
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

    });

    describe('lib/assistants/contact.ts', () => {

        it('listAvailablePhoneCountries: should return country list', async () => {
            const action = await ContactActions.listAvailablePhoneCountries(API_KEY);
            const res = await action();
            expect(Array.isArray(res)).toBe(true);
            expect(res.length).toBeGreaterThan(0);
            expect(res[0]).toHaveProperty('code');
            expect(res[0]).toHaveProperty('name');
            expect(res[0]).toHaveProperty('flag');

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('listAvailableSocialPlatforms: should return platform list', async () => {
            const action = await ContactActions.listAvailableSocialPlatforms(ADMIN_KEY as string);
            const res = await action();
            expect(isError(res)).toBe(false);
            expect(Array.isArray(res)).toBe(true);
            
            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('listAllAssistantEmails: should return list of emails', async () => {
            const action = await ContactActions.listAllAssistantEmails(ADMIN_KEY as string);
            const res = await action();
            expect(isError(res)).toBe(false);
            expect(Array.isArray(res)).toBe(true);

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('verifySocialAccount: should attempt verification', async () => {
            const action = await ContactActions.verifySocialAccount(API_KEY);
            const res = await action('telegram', 'test_user');
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('verification_code');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('deleteAssistantContact: should attempt to delete contact', async () => {

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;

            const action = await ContactActions.deleteAssistantContact(API_KEY);
            const res = await action(assistantId, 'email');            
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res.info).toBeDefined();
                expect(res.assistant).toBeDefined();
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

    });

    describe('lib/assistants/desktop.ts', () => {

        it('getLiveviewUrl: should setup call, dispatch assistant, then return url', async () => {

            // 1. Setup Data
            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;
            const assistantName = assistant.first_name;

            const user = await UserActions.getCurrentUser();
            if (!user || !user.id) throw new Error("No user found for test.");
            const userId = user.id;

            // 2. Setup Call Room
            const connAction = await CallActions.getCallConnectionDetails(API_KEY);
            const connDetails = await connAction(assistantId, assistantName);
            if (isError(connDetails)) throw new Error(`Failed to get connection details: ${connDetails.detail}`);
            
            const roomName = connDetails.roomName;
            console.log(`Room setup: ${roomName}`);

            // 3. Dispatch Assistant to Room
            const dispatchAction = await CallActions.dispatchAssistantToCall(API_KEY);
            const dispatchRes = await dispatchAction(assistantId, assistantName, roomName);
            if (isError(dispatchRes)) throw new Error(`Failed to dispatch assistant: ${dispatchRes.detail}`);
            console.log("Assistant dispatched.");

            // 4. Wait for assistant to join/initialize
            console.log("Waiting for initialization...");
            await new Promise(resolve => setTimeout(resolve, 5000));

            // 5. Get LiveView URL
            const action = await DesktopActions.getLiveviewUrl(userId, API_KEY);
            const res = await action(assistantId);
            
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('liveviewUrl');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 60000);

        it('sendSystemEvent: should send pause/resume event', async () => {

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;

            const action = await DesktopActions.sendSystemEvent();
            const res = await action(assistantId, 'pause_actor', 'Integration Test Pause');
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res.info).toBeDefined();
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

    });

    describe('lib/assistants/photo.ts', () => {

        it('uploadPhoto: should upload a test image', async () => {
            const response = await fetch('https://thispersondoesnotexist.com/');
            const arrayBuffer = await response.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });

            const formData = new FormData();
            formData.append('file', blob, 'test.jpg');

            const action = await PhotoActions.uploadPhoto(API_KEY);
            const res = await action(formData);

            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('gcs_url');
            }

            console.log("========== TEST RESULT ==========");
            console.log(res);
        }, 30000);

        it('uploadVideo: should upload a test video', async () => {
            const tinyMp4Base64 ="AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAAAIZnJlZQAACjBtZGF0AAAAAAEAAQ==";
            const tinyMp4Binary = Uint8Array.from(atob(tinyMp4Base64), c => c.charCodeAt(0));
            const blob = new Blob([tinyMp4Binary], { type: "video/mp4" });
            const formData = new FormData();
            formData.append('file', blob, 'test.mp4');

            const action = await PhotoActions.uploadVideo(API_KEY);
            const res = await action(formData);

            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('gcs_url');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('downloadPhoto: should generate signed URL for uploaded photo', async () => {
            const user = await UserActions.getCurrentUser();
            if (!user || !user.id) throw new Error(`No user found. Skipping test.`);
            const userId = user.id;

            const mediaAction = await PhotoActions.listMediaFiles();
            const mediaRes = await mediaAction(userId);
            if (mediaRes.detail || !mediaRes.files || mediaRes.files.length === 0) throw new Error(`No media found. Skipping test.`);
            const photoUrl = mediaRes.files[0].url;
            
            const action = await PhotoActions.downloadPhoto();
            const res = await action(photoUrl);
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('signedUrl');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('downloadPresetVideo: should attempt to get preset video URL', async () => {
            const action = await PhotoActions.downloadPresetVideo();
            const res = await action("David", "Miller", "elevenlabs");
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('signedUrl');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('generatePhoto: should attempt generation', async () => {
            const action = await PhotoActions.generatePhoto(API_KEY);
            const res = await action({ prompt: "Professional profile photo of a european male banker" });
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('url');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('editPhoto: should attempt photo edit', async () => {

            const formData = new FormData();
            formData.append('prompt', 'make it black and white');
            formData.append('input_image_url', "https://thispersondoesnotexist.com/");
            const action = await PhotoActions.editPhoto(API_KEY);
            const res = await action(formData);
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('url');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('animatePhoto: should start animation job, poll status, and retrieve final video URL', async () => {

            const imageResponse = await fetch('https://thispersondoesnotexist.com/');
            if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
            const imageBuffer = await imageResponse.arrayBuffer();
            const blobImage = new Blob([imageBuffer], { type: 'image/jpeg' });

            const audioUrl = 'https://github.com/jim-schwoebel/sample_voice_data/raw/master/males/091b696d-31a3-41a6-9248-74e03a4ea773.wav';
            const audioResponse = await fetch(audioUrl);
            if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
            const audioBuffer = await audioResponse.arrayBuffer();
            const blobAudio = new Blob([audioBuffer], { type: 'audio/wav' });

            const formData = new FormData();
            formData.append('image_file', blobImage, 'face.jpg');
            formData.append('audio_file', blobAudio, 'voice.wav');

            const animateAction = await PhotoActions.animatePhoto(API_KEY);
            const startRes = await animateAction(formData);
            if (isError(startRes)) throw new Error(`Animation failed to start: ${startRes.detail}`);
            expect(startRes).toHaveProperty('id');
            const predictionId = startRes.id;
            console.log(`Animation started. Prediction ID: ${predictionId}`);

            const getStatusAction = await PhotoActions.getAnimationPrediction(API_KEY);            
            let status = startRes.status;
            let finalResult = startRes;
            let attempts = 0;
            const maxAttempts = 30; // ~90 seconds total polling time
            const delayMs = 3000;
            while (['starting', 'processing'].includes(status) && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                const statusRes = await getStatusAction(predictionId);
                if (isError(statusRes)) throw new Error(`Failed to check status: ${statusRes.detail}`);
                finalResult = statusRes;
                status = finalResult.status;
                attempts++;
                console.log(`Polling... Status: ${status} (Attempt ${attempts})`);
            }
            if (status !== 'succeeded') console.error("Final Result on failure/timeout:", finalResult);
            expect(status).toBe('succeeded');
            
            const outputUrl = Array.isArray(finalResult.output) ? finalResult.output[0] : finalResult.output;
            expect(outputUrl).toBeDefined();
            expect(typeof outputUrl).toBe('string');
            expect(outputUrl).toMatch(/^https?:\/\//);
            console.log("Animation completed successfully. Video URL:", outputUrl);

        }, 120000);

        it('cancelAnimation: should cancel an animation job before it ends', async () => {

            const imageResponse = await fetch('https://thispersondoesnotexist.com/');
            if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
            const imageBuffer = await imageResponse.arrayBuffer();
            const blobImage = new Blob([imageBuffer], { type: 'image/jpeg' });

            const audioUrl = 'https://github.com/jim-schwoebel/sample_voice_data/raw/master/males/091b696d-31a3-41a6-9248-74e03a4ea773.wav';
            const audioResponse = await fetch(audioUrl);
            if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
            const audioBuffer = await audioResponse.arrayBuffer();
            const blobAudio = new Blob([audioBuffer], { type: 'audio/wav' });

            const formData = new FormData();
            formData.append('image_file', blobImage, 'face.jpg');
            formData.append('audio_file', blobAudio, 'voice.wav');

            const animateAction = await PhotoActions.animatePhoto(API_KEY);
            const startRes = await animateAction(formData);
            if (isError(startRes)) throw new Error(`Animation failed to start: ${startRes.detail}`);
            expect(startRes).toHaveProperty('id');
            const predictionId = startRes.id;
            console.log(`Animation started. Prediction ID: ${predictionId}`);

            const cancelAction = await PhotoActions.cancelAnimationPrediction(API_KEY);
            const cancelRes = await cancelAction(predictionId);
            if (isError(cancelRes)) {
                expect(cancelRes.detail).toBeDefined();
            }

            console.log("========== TEST RESULT ==========")
            console.log(cancelRes)
        }, 30000);

    });

    describe('lib/assistants/secret.ts', () => {

        it('createSecret: should add a log to the Secrets context table with the correct values', async () => {

            const user = await UserActions.getCurrentUser();
            if (!user || !user.id) throw new Error("No user found for test.");
            const userName = `${user.name}${user.lastName}`;

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;

            const createAction = await SecretActions.createSecret(API_KEY, userName);
            const createRes = await createAction(assistantId, { 
                name: `TEST_SECRET_${Date.now()}`, 
                value: "test_value",
                description: "This is a test secret"
            });
            expect(isError(createRes)).toBe(false);

            console.log("========== TEST RESULT ==========")
            console.log(createRes)
        }, 30000);

        it('getSecrets: should get the log from the Secrets context with the correct values', async () => {

            const user = await UserActions.getCurrentUser();
            if (!user || !user.id) throw new Error("No user found for test.");
            const userName = `${user.name}${user.lastName}`;

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;

            const getAction = await SecretActions.getSecrets(API_KEY, userName);
            const res = await getAction(assistantId);
            expect(isError(res)).toBe(false);
            if (Array.isArray(res) && res.length > 0) {
                expect(res[0]).toHaveProperty('log_id');
                expect(res[0]).toHaveProperty('name');
                expect(res[0]).toHaveProperty('value');
                expect(res[0]).toHaveProperty('description');
            };

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('deleteSecret: should delete the log from the Secrets context', async () => {

            const user = await UserActions.getCurrentUser();
            if (!user || !user.id) throw new Error("No user found for test.");
            const userName = `${user.name}${user.lastName}`;

            const assistant = await getTestAssistant(API_KEY);
            const assistantId = assistant.agent_id;
            const assistantName = `${assistant.first_name}${assistant.surname}`;

            const secret = await getTestSecret(API_KEY, assistantName);
            const secretId = secret.log_id;

            const deleteAction = await SecretActions.deleteSecret(API_KEY, userName);
            const res = await deleteAction(assistantId, secretId);
            expect(isError(res)).toBe(false);

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

    });

    describe('lib/assistants/task.ts', () => {

        it('getTasks: should retrieve tasks for assistant', async () => {

            const user = await UserActions.getCurrentUser();
            if (!user || !user.id) throw new Error("No user found for test.");
            const userName = `${user.name}${user.lastName}`;

            const assistant = await getTestAssistant(API_KEY);
            const assistantName = `${assistant.first_name}${assistant.surname}`;

            const action = await TaskActions.getTasks(API_KEY, userName);
            const res = await action(assistantName, null, 10, 0);
            expect(isError(res)).toBe(false);
            expect(res).toHaveProperty('logs');

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('getUniqueFieldValues: should return values for a field', async () => {

            const user = await UserActions.getCurrentUser();
            if (!user || !user.id) throw new Error("No user found for test.");
            const userName = `${user.name}${user.lastName}`;

            const assistant = await getTestAssistant(API_KEY);
            const assistantName = `${assistant.first_name}${assistant.surname}`;

            const action = await TaskActions.getUniqueFieldValues(API_KEY, userName);
            const res = await action(assistantName, 'status');
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(Array.isArray(res)).toBe(true);
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('updateTask: should attempt to update a task', async () => {

            const user = await UserActions.getCurrentUser();
            if (!user || !user.id) throw new Error("No user found for test.");
            const userName = `${user.name}${user.lastName}`;

            const assistant = await getTestAssistant(API_KEY);
            const assistantName = `${assistant.first_name}${assistant.surname}`;

            const getAction = await TaskActions.getTasks(API_KEY, userName);
            const res = await getAction(assistantName, null, 1, 0);
            if (!isError(res) && res.logs && res.logs.length > 0) {
                const taskLogId = res.logs[0].id;
                const updateAction = await TaskActions.updateTask(API_KEY, userName);
                const updateRes = await updateAction(assistantName, [parseInt(taskLogId)], { status: 'active' });
                expect(isError(updateRes)).toBe(false);
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);
    });

    describe('lib/assistants/voice.ts', () => {

        it('listVoices: should return available voices', async () => {
            const action = await VoiceActions.listVoices(API_KEY);
            const res = await action();
            
            expect(isError(res)).toBe(false);
            expect(Array.isArray(res)).toBe(true);
            if (Array.isArray(res) && res.length > 0) {
                expect(res[0]).toHaveProperty('voice_id');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('generateSpeech: should return audio data', async () => {
            const voice = await getTestVoice(API_KEY);
            const voiceId = voice.voice_id;
            const voiceProvider = voice.provider;

            const action = await VoiceActions.generateSpeech(API_KEY);
            const res = await action({
                text: "Hello world",
                provider: voiceProvider,
                voice_id: voiceId,
                output_format: "mp3"
            });

            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res.audioBase64).toBeDefined();
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('designVoiceGeneratePreviews & designVoiceCreateFromPreview: should generate a voice preview and generate a voice from one of the previews', async () => {
            /* TODO: 
                Test with text instead of auto_generate_text
                Test with short / long test 
                Test with short / long voice_description 
                Test with a duplicate voice name
            */
            const previewAction = await VoiceActions.designVoiceGeneratePreviews(API_KEY);
            const previewRes = await previewAction({
                auto_generate_text: true,
                voice_description: "A deep, wise-sounding male voice"
            });

            console.log("========== PREVIEW TEST RESULT ==========")
            console.log(previewRes)

            if (isError(previewRes)) {
                expect(previewRes.detail).toBeDefined();
            } 
            else if ((previewRes as any).previews && (previewRes as any).previews.length > 0) {
                const previewItem = (previewRes as any).previews[0];
                const createAction = await VoiceActions.designVoiceCreateFromPreview(API_KEY);
                const createRes = await createAction({
                    generated_voice_id: previewItem.generated_voice_id,
                    voice_name: "Test Designed Voice",
                    voice_description: "This is a test voice"
                });

                console.log("========== CREATE TEST RESULT ==========")
                console.log(createRes)

                if (isError(createRes)) {
                    expect(createRes.detail).toBeDefined();
                } else {
                    expect(createRes).toHaveProperty('voice_id');
                }

            }
        }, 30000);

        it('registerVoice: should add the voice to the list of user voices', async () => {
            /* TODO:
                Test with invalid preset voice
                Test with duplicate voice name
                Test with non preset voice
            */

            const action = await VoiceActions.registerVoice(API_KEY);
            const res = await action(
                "9BWtsMINqrJLrRacOk9x",
                "elevenlabs",
                "English Female Husky 1",
                "A middle-aged female with an African-American accent. Calm with a hint of rasp.",
                "female",
                "en",
                true
            );
            expect(isError(res)).toBe(false);

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('deleteVoice: should remove the voice from the list of user voices', async () => {
            /* TODO
                Test with a voice that's used by an assistant
            */
            const voice = await getTestVoice(API_KEY);
            const voiceId = voice.voice_id;            
            const voiceProvider = voice.provider;

            const action = await VoiceActions.deleteVoice(API_KEY);
            const res = await action(voiceId, voiceProvider);
            expect(isError(res)).toBe(false);

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);

        it('cloneVoice: should attempt cloning', async () => {
            /* TODO:
                Test with duplicate voice name
                Test with invalid audio data 
            */
            const audioUrl = 'https://github.com/jim-schwoebel/sample_voice_data/raw/master/males/091b696d-31a3-41a6-9248-74e03a4ea773.wav';
            const audioResponse = await fetch(audioUrl);
            if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
            const audioBuffer = await audioResponse.arrayBuffer();
            const blobAudio = new Blob([audioBuffer], { type: 'audio/wav' });

            const formData = new FormData();
            formData.append('files', blobAudio);
            formData.append('name', 'Cloned Test Voice');

            const action = await VoiceActions.cloneVoice(API_KEY);
            const res = await action(formData);
            if (isError(res)) {
                expect(res.detail).toBeDefined();
            } else {
                expect(res).toHaveProperty('voice_id');
            }

            console.log("========== TEST RESULT ==========")
            console.log(res)
        }, 30000);
    });
});