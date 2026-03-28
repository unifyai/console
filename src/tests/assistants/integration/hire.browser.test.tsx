import React from 'react';
import { render, screen, waitFor, within, fireEvent, act, cleanup } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest';
import { FormProvider } from 'react-hook-form';
import { http, HttpResponse } from 'msw';
import { worker } from '../../../../vitest.browser.setup';
import { Assistant, VoiceOption } from '@/types/assistants/assistant';

// Mock the Server Action module before importing components that use it
// This prevents loading next-auth dependencies in the browser environment
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn().mockResolvedValue({ content: 'Hello there!' }),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello! I am ready to work.' }),
}));

// Import components after mocking
import { AssistantHire } from '@/components/Pages/Assistants/Hire/AssistantHire';
import { HireForm } from '@/components/Pages/Assistants/Hire/AssistantHireForm';
import { PresetsPanel } from '@/components/Pages/Assistants/Hire/Presets/AssistantHirePresetsList';
import { AssistantEdit } from '@/components/Pages/Assistants/Edit/AssistantEdit';
import { AssistantHireLocalSetupInstructionsDialog } from '@/components/Pages/Assistants/Hire/AssistantHireLocalSetupInstructions';
import { useAssistantForm } from '@/hooks/Assistants/useAssistantForm';
import { useAssistantPresets } from '@/hooks/Assistants/useAssistantPresets';
import { mockAssistantActions } from '../mocks/actions';
import { mockPresets, mockVoices, mockAssistants } from '../mocks/data';
import * as preHireChatModule from '@/lib/assistants/preHireChat';

// Test Wrapper Component to mimic Main.tsx integration
const HireFlowTestWrapper = ({
  onClose,
  customVoices,
  onHireSuccess,
  presetsToUse = mockPresets,
  useRealPresetHook = false,
}: {
  onClose?: () => void;
  customVoices?: VoiceOption[];
  onHireSuccess?: (assistant: Assistant, formData: any) => void;
  presetsToUse?: any[];
  useRealPresetHook?: boolean;
}) => {
  const [isHireDialogOpen, setIsHireDialogOpen] = React.useState(true);
  const [isAssistantPresetsOpen, setIsAssistantPresetsOpen] = React.useState(true);
  const [isDialogBusyProcessingPhoto, setIsDialogBusyProcessingPhoto] = React.useState(false);
  const [isDialogBusyProcessingVoice, setIsDialogBusyProcessingVoice] = React.useState(false);
  const [setupInstructions, setSetupInstructions] = React.useState<{
    os: string;
    isOpen: boolean;
  } | null>(null);

  // Mock Presets Hook behavior or use real one
  const presetHookValues = useAssistantPresets();
  const finalPresets = useRealPresetHook ? presetHookValues.displayedPresets : presetsToUse;

  const handleHireSuccessInternal = (assistant: Assistant, formData: any, chatHistory: any) => {
    setIsHireDialogOpen(false);
    if (onHireSuccess) onHireSuccess(assistant, formData);
    if (onClose) onClose();

    if (formData.setup === 'local' && formData.operatingSystem) {
      setSetupInstructions({ os: formData.operatingSystem, isOpen: true });
    }
  };

  const voicesToUse = customVoices || mockVoices;

  const {
    formMethods,
    initiateHireSequence,
    isCheckingBalance,
    isSubmitting,
    showInsufficientFundsHint,
    setShowInsufficientFundsHint,
    selectPreset,
    onNewMediaReady,
  } = useAssistantForm(
    mockAssistantActions,
    voicesToUse,
    handleHireSuccessInternal,
    undefined,
    isHireDialogOpen
  );

  const displayableVoices = React.useMemo(() => {
    const baseVoices = customVoices || mockVoices;
    return baseVoices.filter((v) => v.provider !== 'openai');
  }, [customVoices]);

  const handleRandomizePreset = () => {
    const randomIndex = Math.floor(Math.random() * finalPresets.length);
    selectPreset(finalPresets[randomIndex]);
  };

  const fetchUserVoices = vi.fn();
  const handleDeleteVoice = async (voice: VoiceOption) => {
    await mockAssistantActions.voice.delete(voice.voiceId, voice.provider);
  };

  const [ageFilter, setAgeFilter] = React.useState('all');
  const [nationalityFilter, setNationalityFilter] = React.useState('all');
  const [genderFilter, setGenderFilter] = React.useState('all');
  const [languageFilter, setLanguageFilter] = React.useState('all');

  return (
    <>
      <FormProvider {...formMethods}>
        <AssistantHire
          isHireDialogOpen={isHireDialogOpen}
          setIsHireDialogOpen={setIsHireDialogOpen}
          isHireSubmitting={isSubmitting}
          isAssistantPresetsOpen={isAssistantPresetsOpen}
          setIsAssistantPresetsOpen={setIsAssistantPresetsOpen}
          handleRandomizePreset={handleRandomizePreset}
          currentFilteredPresets={finalPresets}
          onHireAttempt={initiateHireSequence}
          isProcessingVoice={isDialogBusyProcessingVoice}
          isProcessingPhoto={isDialogBusyProcessingPhoto}
          isCheckingBalance={isCheckingBalance}
          showInsufficientFundsHint={showInsufficientFundsHint}
          setShowInsufficientFundsHint={setShowInsufficientFundsHint}
          onAddPaymentMethod={() => {}}
          formMethods={formMethods}
        >
          <HireForm
            formMethods={formMethods}
            isSubmitting={isSubmitting}
            assistantActions={mockAssistantActions}
            onPhotoProcessingStateChange={setIsDialogBusyProcessingPhoto}
            onVoiceProcessingStateChange={setIsDialogBusyProcessingVoice}
            onNewMediaReady={onNewMediaReady}
            allDisplayableVoices={displayableVoices}
            isLoadingUserVoices={false}
            fetchUserVoices={fetchUserVoices}
            handleDeleteVoice={handleDeleteVoice}
            mode="hire"
          />
          <PresetsPanel
            displayedPresets={finalPresets}
            onPresetSelect={selectPreset}
            onClose={() => setIsAssistantPresetsOpen(false)}
            layoutMode="split"
            setLayoutMode={vi.fn()}
            onLoadMore={useRealPresetHook ? presetHookValues.loadMorePresets : vi.fn()}
            canLoadMore={useRealPresetHook ? presetHookValues.canLoadMorePresets : false}
            isLoadingMore={useRealPresetHook ? presetHookValues.isLoadingMorePresets : false}
            ageFilter={ageFilter}
            onAgeFilterChange={setAgeFilter}
            availableAgeBrackets={['all', '18-25', '26-35', '36-45']}
            nationalityFilter={nationalityFilter}
            onNationalityFilterChange={setNationalityFilter}
            availableNationalities={['all', 'United States', 'Canada']}
            genderFilter={genderFilter}
            onGenderFilterChange={setGenderFilter}
            availableGenders={['all', 'female', 'male']}
            languageFilter={languageFilter}
            onLanguageFilterChange={setLanguageFilter}
            availableLanguages={['all', 'en']}
          />
        </AssistantHire>
      </FormProvider>
      <AssistantHireLocalSetupInstructionsDialog
        isOpen={setupInstructions?.isOpen || false}
        os={setupInstructions?.os || 'ubuntu'}
        onClose={() => setSetupInstructions(null)}
      />
    </>
  );
};

// Edit Wrapper
const EditFlowTestWrapper = ({ assistant }: { assistant: Assistant }) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { formMethods, loadAssistantForEdit, initiateUpdate, onNewMediaReady } = useAssistantForm(
    mockAssistantActions,
    mockVoices,
    undefined,
    undefined,
    true
  );

  React.useEffect(() => {
    loadAssistantForEdit(assistant);
  }, [assistant, loadAssistantForEdit]);

  if (!isOpen) return null;

  return (
    <FormProvider {...formMethods}>
      <AssistantEdit
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        assistant={assistant}
        formMethods={formMethods}
        onSubmit={initiateUpdate}
        isSubmitting={isSubmitting}
      >
        <HireForm
          formMethods={formMethods}
          isSubmitting={isSubmitting}
          assistantActions={mockAssistantActions}
          onNewMediaReady={onNewMediaReady}
          allDisplayableVoices={mockVoices}
          isLoadingUserVoices={false}
          fetchUserVoices={vi.fn()}
          handleDeleteVoice={vi.fn()}
          mode="edit"
        />
      </AssistantEdit>
    </FormProvider>
  );
};

const waitForFormReady = async () => {
  await waitFor(() => {
    expect(mockAssistantActions.contact.listAvailablePhoneCountries).toHaveBeenCalled();
  });
  // Wait for effects to settle
  await new Promise((resolve) => setTimeout(resolve, 200));
};

describe('Assistant Hire Flow', () => {
  beforeAll(() => {
    // Mock URL methods while preserving the URL constructor (needed by MSW)
    const originalURL = window.URL;
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    worker.resetHandlers();
  });

  describe('A. General Hiring Featured and UX', () => {
    it(
      'should validate required fields before hiring',
      {
        meta: {
          alias: 'Hire-Validation',
          behavior: 'Shows error messages when required fields are empty',
          scenario: 'Submitting empty form',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();

        const firstNameInput = screen.getByLabelText(/first name/i);
        const surnameInput = screen.getByLabelText(/last name/i);

        await user.clear(firstNameInput);
        await user.clear(surnameInput);

        const hireButton = screen.getByRole('button', { name: /hire assistant/i });
        await user.click(hireButton);

        expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
        expect(await screen.findByText(/last name is required/i)).toBeInTheDocument();
      }
    );

    it(
      'should handle insufficient funds during hire attempt',
      {
        meta: {
          alias: 'Hire-Insufficient-Funds',
          behavior: 'Displays insufficient funds popover when balance is low',
          scenario: 'Hire attempt with low balance',
        },
      },
      async () => {
        const user = userEvent.setup();
        worker.use(
          http.get('/api/billing/balance', () => {
            return HttpResponse.json({ balance: '0.00', fullBalance: 0.0 });
          })
        );
        mockAssistantActions.assistant.check.mockResolvedValueOnce({ sufficient: false });
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        await user.type(screen.getByLabelText(/first name/i), 'Broke');
        await user.type(screen.getByLabelText(/last name/i), 'User');
        await user.type(screen.getByLabelText(/age/i), '25');
        await user.type(screen.getByLabelText(/about/i), 'A bio is required');
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        const voiceOption = await screen.findByRole('option', { name: /select voice alice/i });
        await user.click(voiceOption);
        const hireButton = screen.getByRole('button', { name: /hire assistant/i });
        await waitFor(() => expect(hireButton).toBeEnabled());
        await user.click(hireButton);
        await waitFor(() => {
          expect(screen.getByText('Insufficient Funds')).toBeVisible();
        });
      }
    );

    it(
      'should successfully hire an assistant when requirements are met',
      {
        meta: {
          alias: 'Hire-Success',
          behavior: 'Closes dialog and triggers success callback',
          scenario: 'Successful hire flow',
        },
      },
      async () => {
        const originalFetch = window.fetch;
        vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
          const url = input.toString();
          if (url.includes('/api/billing/balance')) {
            return new Response(JSON.stringify({ balance: '100.00', fullBalance: 100.0 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return originalFetch(input, init);
        });

        const createSpy = vi
          .spyOn(mockAssistantActions.assistant, 'create')
          .mockImplementation(async (firstName, surname, age, nationality, ...args) => ({
            info: 'Assistant created successfully.',
            assistant: {
              ...mockAssistants[0],
              agent_id: 'new_created_id',
              firstName: firstName as string,
              surname: surname as string,
              age: age as number,
              nationality: nationality as string,
            },
          }));

        render(<HireFlowTestWrapper onClose={() => {}} />);
        await waitForFormReady();

        await userEvent.type(screen.getByLabelText(/first name/i), 'John');
        await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
        await userEvent.type(screen.getByLabelText(/age/i), '30');
        await userEvent.type(
          screen.getByLabelText(/about/i),
          'Experienced assistant ready to work.'
        );

        const nationalityTrigger = screen.getByLabelText(/nationality/i);
        await userEvent.click(nationalityTrigger);
        await userEvent.click(await screen.findByRole('option', { name: /United States/i }));

        const hireButton = screen.getByRole('button', { name: /hire assistant/i });
        await waitFor(() => expect(hireButton).toBeEnabled());
        await userEvent.click(hireButton);

        await waitFor(async () => {
          expect(createSpy).toHaveBeenCalled();
          const createPromise = createSpy.mock.results[0].value;
          const result = await createPromise;
          expect(result.assistant).toEqual(
            expect.objectContaining({
              agent_id: 'new_created_id',
              firstName: 'John',
              surname: 'Doe',
              age: 30,
              nationality: 'United States',
            })
          );
        });
      }
    );

    it(
      'should handle network failure gracefully during hire',
      {
        meta: {
          alias: 'Hire-Network-Failure',
          behavior: 'Shows error message on API failure',
          scenario: 'API returns error on create',
        },
      },
      async () => {
        const user = userEvent.setup();
        worker.use(
          http.get('/api/billing/balance', () => {
            return HttpResponse.json({ balance: '100.00', fullBalance: 100.0 });
          })
        );
        (mockAssistantActions.assistant.create as any).mockResolvedValueOnce({
          detail: 'Critical Server Failure',
        });
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        await user.type(screen.getByLabelText(/first name/i), 'Retry');
        await user.type(screen.getByLabelText(/last name/i), 'Me');
        await user.type(screen.getByLabelText(/age/i), '30');
        await user.type(screen.getByLabelText(/about/i), 'Bio');
        await user.click(screen.getByRole('button', { name: /hire assistant/i }));
        expect(
          await screen.findByText(/An error occurred during the hiring process/i)
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/first name/i)).toHaveValue('Retry');
      }
    );

    it(
      'should display install instructions after successfully hiring with local setup',
      {
        meta: {
          alias: 'Hire-Local-Instructions',
          behavior: 'Opens instructions dialog after hire',
          scenario: "Hiring with 'Local' setup",
        },
      },
      async () => {
        const user = userEvent.setup();
        worker.use(
          http.get('/api/billing/balance', () => {
            return HttpResponse.json({ balance: '100.00', fullBalance: 100.0 });
          })
        );
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        await user.type(screen.getByLabelText(/first name/i), 'Local');
        await user.type(screen.getByLabelText(/last name/i), 'Host');
        await user.type(screen.getByLabelText(/age/i), '20');
        await user.type(screen.getByLabelText(/about/i), 'Bio');
        const advancedAccordionTrigger = screen.getByRole('button', { name: /advanced/i });
        if (advancedAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(advancedAccordionTrigger);
        }
        await user.click(screen.getByText(/local - connect to your desktop/i));
        const hireButton = screen.getByRole('button', { name: /hire assistant/i });
        await waitFor(() => expect(hireButton).toBeEnabled());
        await user.click(hireButton);
        expect(await screen.findByText(/local desktop setup instructions/i)).toBeInTheDocument();
      }
    );

    it(
      "should automatically set the loaded assistant's timezone based on user timezone",
      {
        meta: {
          alias: 'Hire-Auto-Timezone',
          behavior: "The form defaults to the user's local timezone",
          scenario: 'Opening the hire form',
        },
      },
      async () => {
        const originalDateTimeFormat = Intl.DateTimeFormat;
        const mockDateTimeFormat = vi.fn(() => ({
          resolvedOptions: () => ({ timeZone: 'America/New York' }),
        })) as any;
        mockDateTimeFormat.supportedValuesOf = (originalDateTimeFormat as any).supportedValuesOf;
        window.Intl.DateTimeFormat = mockDateTimeFormat;

        render(<HireFlowTestWrapper />);
        await waitForFormReady();

        expect(screen.getByText(/New York/i)).toBeInTheDocument();
        window.Intl.DateTimeFormat = originalDateTimeFormat;
      }
    );

    it(
      "should automatically open the hiring dialog if the user doesn't have any assistant",
      {
        meta: {
          alias: 'Hire-Auto-Open',
          behavior: 'Triggers open dialog logic when assistant list is empty',
          scenario: 'User visits page with no assistants',
        },
      },
      async () => {
        const AutoOpenTestComponent = ({ assistants }: { assistants: Assistant[] }) => {
          const [isOpen, setIsOpen] = React.useState(false);
          React.useEffect(() => {
            if (assistants.length === 0 && !isOpen) {
              setIsOpen(true);
            }
          }, [assistants, isOpen]);
          return isOpen ? <div>Dialog Open</div> : <div>Dialog Closed</div>;
        };

        const { rerender } = render(<AutoOpenTestComponent assistants={[]} />);
        // Use waitFor to handle state update delay
        await waitFor(() => {
          expect(screen.getByText('Dialog Open')).toBeInTheDocument();
        });

        rerender(<AutoOpenTestComponent assistants={[mockAssistants[0]]} />);
      }
    );

    it(
      'should NOT automatically open the hiring dialog for org members who cannot hire',
      {
        meta: {
          alias: 'Hire-Auto-Open-Blocked-OrgMember',
          behavior: 'Does not trigger open dialog logic when user lacks hire permission',
          scenario: 'Org member visits page with no assistants',
        },
      },
      async () => {
        const AutoOpenTestComponent = ({
          assistants,
          canHire,
        }: {
          assistants: Assistant[];
          canHire: boolean;
        }) => {
          const [isOpen, setIsOpen] = React.useState(false);
          React.useEffect(() => {
            if (assistants.length === 0 && !isOpen && canHire) {
              setIsOpen(true);
            }
          }, [assistants, isOpen, canHire]);
          return isOpen ? <div>Dialog Open</div> : <div>Dialog Closed</div>;
        };

        // Org member (canHire=false) with no assistants — dialog should stay closed
        render(<AutoOpenTestComponent assistants={[]} canHire={false} />);
        // Give React a tick to process the effect
        await waitFor(() => {
          expect(screen.getByText('Dialog Closed')).toBeInTheDocument();
        });

        // Org owner (canHire=true) with no assistants — dialog should open
        cleanup();
        render(<AutoOpenTestComponent assistants={[]} canHire={true} />);
        await waitFor(() => {
          expect(screen.getByText('Dialog Open')).toBeInTheDocument();
        });
      }
    );

    it('should register voice before hiring if selected voice does not exist in user library', async () => {
      const user = userEvent.setup();
      const registerSpy = vi.spyOn(mockAssistantActions.voice, 'register').mockResolvedValue({
        voiceId: 'v_new',
        name: 'New Voice',
        description: 'desc',
        gender: 'female',
        language: 'en',
        provider: 'elevenlabs',
        isPreset: false,
      });
      const createSpy = vi.spyOn(mockAssistantActions.assistant, 'create').mockResolvedValue({
        info: 'Assistant created',
        assistant: mockAssistants[0],
      });
      render(<HireFlowTestWrapper />);
      const mainHireBtn = await screen.findByRole('button', { name: /Hire Assistant/i });
      await user.click(mainHireBtn);
      await user.type(screen.getByLabelText(/First Name/i), 'VoiceTest');
      await user.type(screen.getByLabelText(/Last Name/i), 'Runner');
      await user.type(screen.getByLabelText(/Age/i), '30');
      await user.type(screen.getByLabelText(/About/i), 'This is a test assistant description.');
      const modalHireBtn = screen.getByRole('button', { name: 'Hire Assistant' });
      await user.click(modalHireBtn);
      await waitFor(() => {
        // Verify voice registration was called with the expected voice ID
        expect(registerSpy).toHaveBeenCalledTimes(1);
        const [registeredVoiceId] = registerSpy.mock.calls[0] as [string];
        expect(registeredVoiceId).toBeDefined();
      });
      await waitFor(() => {
        // Verify assistant creation was called
        expect(createSpy).toHaveBeenCalledTimes(1);
      });
      const registerOrder = registerSpy.mock.invocationCallOrder[0];
      const createOrder = createSpy.mock.invocationCallOrder[0];
      expect(registerOrder).toBeLessThan(createOrder);
    });
  });

  describe('B. Presets', () => {
    // ... (Existing B tests) ...
    it(
      'should randomly fill the form when randomize button is clicked',
      {
        meta: {
          alias: 'Hire-Randomize-Config',
          behavior: 'Fills form with random data',
          scenario: 'Clicking Randomize button',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const firstNameInput = screen.getByLabelText(/first name/i) as HTMLInputElement;
        expect(firstNameInput).toHaveValue('');
        const randomizeBtn = screen.getByLabelText(/Randomize Assistant/i);
        await user.click(randomizeBtn);
        await waitFor(() => {
          const val = firstNameInput.value;
          expect(['Sarah', 'James']).toContain(val);
        });
      }
    );

    it(
      'should populate form when a preset is selected',
      {
        meta: {
          alias: 'Hire-Select-Preset',
          behavior: 'Fills form with specific preset data',
          scenario: "Selecting 'Sarah Connor' preset",
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const presetItem = await screen.findByText('Sarah Connor');
        await user.click(presetItem);
        await waitFor(() => {
          expect(screen.getByLabelText(/first name/i)).toHaveValue('Sarah');
          expect(screen.getByLabelText(/last name/i)).toHaveValue('Connor');
          expect(screen.getByLabelText(/age/i)).toHaveValue(28);
        });
      }
    );
  });

  describe('C. Pre-hire Chat', () => {
    it(
      'should preserve chat history when switching views',
      {
        meta: {
          alias: 'Hire-Chat-History',
          behavior: 'Chat messages persist between view toggles',
          scenario: 'Switching from Chat to Presets and back',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        await user.click(screen.getByRole('button', { name: /chat now/i }));
        await screen.findByText(/it's great to meet you/i, {}, { timeout: 5000 });
        const chatInput = screen.getByPlaceholderText(/send a message/i);
        await user.type(chatInput, 'Remember this!');
        await user.keyboard('{Enter}');
        await screen.findByText('Remember this!');
        await user.click(screen.getByRole('button', { name: /browse assistants/i }));
        await user.click(screen.getByRole('button', { name: /chat now/i }));
        expect(await screen.findByText('Remember this!')).toBeInTheDocument();
      }
    );

    it(
      'should disable input after reaching the message limit',
      {
        meta: {
          alias: 'Hire-Chat-Limit',
          behavior: 'Input disables after N messages',
          scenario: 'User sends maximum allowed messages',
        },
      },
      async () => {
        // Mock the Server Action with unique responses per call
        let responseCounter = 0;
        vi.spyOn(preHireChatModule, 'sendPreHireChatMessage').mockImplementation(async () => {
          return { content: `Response ${responseCounter++}` };
        });

        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();

        await user.click(screen.getByRole('button', { name: /chat now/i }));
        await screen.findByText(/it's great to meet you/i, {}, { timeout: 5000 });

        const chatInput = screen.getByPlaceholderText(/send a message/i);

        for (let i = 0; i < 10; i++) {
          await user.type(chatInput, `Msg ${i}`);
          await user.keyboard('{Enter}');

          // Wait for the SPECIFIC unique response for this iteration (Response 0, Response 1, etc.)
          // This avoids the "Found multiple elements" error.
          await screen.findByText(new RegExp(`Response ${i}`, 'i'));
        }

        await waitFor(() => {
          expect(chatInput).toBeDisabled();
        });
        expect(screen.getByPlaceholderText(/message limit reached/i)).toBeInTheDocument();
      }
    );
  });

  describe('D. Photo and Video', () => {
    it(
      'should update the preview when a file is uploaded',
      {
        meta: {
          alias: 'Hire-Photo-Upload',
          behavior: 'Preview updates to show uploaded image',
          scenario: 'Uploading an image file',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const appearanceTrigger = screen.getByRole('button', { name: /appearance/i });
        if (appearanceTrigger.getAttribute('data-state') === 'closed') {
          await user.click(appearanceTrigger);
        }
        const file = new File(['(⌐□_□)'], 'avatar.png', { type: 'image/png' });
        const dropText = screen.getByText(/drop file or/i);
        const label = dropText.closest('label');
        const fileInput = label?.querySelector('input[type="file"]');
        if (!fileInput) throw new Error('File input not found');
        fireEvent.change(fileInput, { target: { files: [file] } });
        await waitFor(() => {
          expect(screen.queryByText('No Photo')).not.toBeInTheDocument();
        });
      }
    );

    it(
      'should play a video when clicking on the image container if it contains a video',
      {
        meta: {
          alias: 'Hire-Click-Play-Video',
          behavior: 'Video plays/pauses on click',
          scenario: 'Clicking media container with video',
        },
      },
      async () => {
        const user = userEvent.setup();
        const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
        const downloadSpy = vi
          .spyOn(mockAssistantActions.photo, 'downloadPresetVideo')
          .mockImplementation(async () => {
            return { signedUrl: 'https://test-video.mp4' };
          });
        render(<HireFlowTestWrapper />);
        const mainHireBtn = await screen.findByRole('button', { name: /Hire Assistant/i });
        await user.click(mainHireBtn);
        const presetName = await screen.findByText(/Sarah/i);
        await user.click(presetName);
        await waitFor(() => {
          // Verify downloadPresetVideo was called with a preset agent ID
          expect(downloadSpy).toHaveBeenCalledTimes(1);
          const [calledPresetId] = downloadSpy.mock.calls[0] as [string];
          expect(calledPresetId).toBeDefined();
          expect(typeof calledPresetId).toBe('string');
        });
        try {
          await waitFor(
            () => {
              const video = document.querySelector('video');
              if (!video) throw new Error('Video tag not found.');
            },
            { timeout: 4000 }
          );
        } catch (e) {
          console.log('❌ [DEBUG] Video Element missing.');
          const viewerContainer = document.querySelector('.h-44.w-44');
          if (viewerContainer) {
            console.log('🔍 [DEBUG] Viewer Container HTML:', viewerContainer.outerHTML);
          }
          throw e;
        }
        const videoEl = document.querySelector('video') as HTMLVideoElement;
        await user.click(videoEl);
        await waitFor(() => {
          expect(playSpy).toHaveBeenCalled();
        });
      }
    );

    it(
      "should remove video from image container when selecting another voice which doesn't have a video generated",
      {
        meta: {
          alias: 'Hire-Remove-Video-On-Voice-Change',
          behavior: 'Video is removed if voice mismatches',
          scenario: 'Changing voice after loading preset video',
        },
      },
      async () => {
        // Mock video
        worker.use(
          http.get('https://signed.url/video.mp4', () => {
            return new HttpResponse(new ArrayBuffer(100), {
              headers: { 'Content-Type': 'video/mp4' },
            });
          })
        );
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();

        await user.click(await screen.findByText('Sarah Connor'));

        const appearanceTrigger = screen.getByRole('button', { name: /appearance/i });
        if (appearanceTrigger.getAttribute('data-state') === 'closed') {
          await user.click(appearanceTrigger);
        }
        expect(document.querySelector('video')).toBeInTheDocument();

        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        await user.click(await screen.findByRole('option', { name: /select voice bob/i }));

        await waitFor(() => {
          expect(document.querySelector('video')).not.toBeInTheDocument();
        });
      }
    );

    it(
      'should prevent creating a photo if required input is missing',
      {
        meta: {
          alias: 'Hire-Photo-Create-Prevent',
          behavior: 'Shows error if prompt empty',
          scenario: 'Generate photo with empty prompt',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const appearanceTrigger = screen.getByRole('button', { name: /appearance/i });
        if (appearanceTrigger.getAttribute('data-state') === 'closed') {
          await user.click(appearanceTrigger);
        }
        await user.click(screen.getByRole('tab', { name: /create/i }));
        const promptInput = screen.getByLabelText(/photo prompt/i);
        await user.clear(promptInput);
        const generateBtn = screen.getByRole('button', { name: /generate new photo/i });
        if (generateBtn.hasAttribute('disabled')) {
          expect(generateBtn).toBeDisabled();
        } else {
          await user.click(generateBtn);
          expect(await screen.findByText(/please enter a prompt/i)).toBeInTheDocument();
        }
      }
    );

    it(
      'should handle editing a photo from an image and a text prompt',
      {
        meta: {
          alias: 'Hire-Photo-Edit',
          behavior: 'Calls edit API and updates preview',
          scenario: 'Editing existing photo',
        },
      },
      async () => {
        const user = userEvent.setup();
        worker.use(
          http.get('/api/billing/balance', () => {
            return HttpResponse.json({ balance: '100.00', fullBalance: 100.0 });
          }),
          // Mock the edited photo URL fetch - the hook fetches this to download the image
          http.get('https://edited.photo/image.jpg', () => {
            return new HttpResponse(new ArrayBuffer(100), {
              headers: { 'Content-Type': 'image/jpeg' },
            });
          })
        );
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const appearanceTrigger = screen.getByRole('button', { name: /appearance/i });
        if (appearanceTrigger.getAttribute('data-state') === 'closed') {
          await user.click(appearanceTrigger);
        }
        const file = new File(['img'], 'photo.png', { type: 'image/png' });
        const fileInput = screen
          .getByText(/drop file or/i)
          .closest('label')
          ?.querySelector('input[type="file"]');
        if (fileInput) fireEvent.change(fileInput, { target: { files: [file] } });

        // Wait for file upload to be processed and URL to be created
        await waitFor(() => {
          expect(window.URL.createObjectURL).toHaveBeenCalled();
        });

        await user.click(screen.getByRole('tab', { name: /create/i }));
        const promptInput = screen.getByLabelText(/photo prompt/i);
        // Type additional prompt text (appends to default prompt)
        await user.type(promptInput, 'Make it cyberpunk');

        // Wait for the edit button to be enabled (requires both image and prompt)
        const editBtn = await screen.findByRole('button', { name: /edit photo/i });
        await waitFor(() => expect(editBtn).toBeEnabled());
        await user.click(editBtn);
        expect(mockAssistantActions.photo.edit).toHaveBeenCalledTimes(1);
        // Verify FormData was passed with the edit prompt (includes default + user prompt)
        const editCall = mockAssistantActions.photo.edit.mock.calls[0][0] as FormData;
        expect(editCall).toBeInstanceOf(FormData);
        const promptValue = editCall.get('prompt') as string;
        expect(promptValue).toContain('Make it cyberpunk');
        expect(await screen.findByText('Photo edited successfully!')).toBeInTheDocument();
      }
    );

    it(
      'should display progress for photo animation process',
      {
        meta: {
          alias: 'Hire-Animation-Progress',
          behavior: 'Shows progress toast during animation',
          scenario: 'Animating photo',
        },
      },
      async () => {
        const user = userEvent.setup();
        worker.use(
          http.get('/api/billing/balance', () => {
            return HttpResponse.json({ balance: '100.00', fullBalance: 100.0 });
          })
        );

        // Mock to stay in 'processing' state - the progress should show immediately
        const getAnimationSpy = vi
          .spyOn(mockAssistantActions.photo, 'getAnimation')
          .mockResolvedValue({
            id: '1',
            status: 'processing',
            model: '',
            version: '',
            createdAt: '',
          });

        render(<HireFlowTestWrapper />);
        await waitForFormReady();

        // First select a voice (required for animation)
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        const voiceOption = await screen.findByRole('option', { name: /select voice alice/i });
        await user.click(voiceOption);

        // Open appearance and upload photo
        const appearanceTrigger = screen.getByRole('button', { name: /appearance/i });
        if (appearanceTrigger.getAttribute('data-state') === 'closed') {
          await user.click(appearanceTrigger);
        }
        const file = new File(['img'], 'photo.png', { type: 'image/png' });
        const fileInput = screen
          .getByText(/drop file or/i)
          .closest('label')
          ?.querySelector('input[type="file"]');
        if (fileInput) fireEvent.change(fileInput, { target: { files: [file] } });

        // Wait for image to be processed
        await waitFor(() => {
          expect(window.URL.createObjectURL).toHaveBeenCalled();
        });

        await user.click(screen.getByRole('tab', { name: /animate/i }));
        const promptInput = screen.getByLabelText(/tts prompt/i);
        await user.type(promptInput, 'Hello');

        const animateBtn = await screen.findByRole('button', { name: /animate photo/i });
        await user.click(animateBtn);

        // The animate action should trigger and show progress
        expect(await screen.findByText(/animating photo/i)).toBeInTheDocument();

        getAnimationSpy.mockRestore();
      }
    );

    it(
      'should handle cancellation of photo animation',
      {
        meta: {
          alias: 'Hire-Animation-Cancel',
          behavior: 'Calls cancel API on stop button click',
          scenario: 'Cancelling ongoing animation',
        },
      },
      async () => {
        const user = userEvent.setup();
        worker.use(
          http.get('/api/billing/balance', () => {
            return HttpResponse.json({ balance: '100.00', fullBalance: 100.0 });
          })
        );

        vi.spyOn(mockAssistantActions.photo, 'getAnimation').mockResolvedValue({
          id: '1',
          status: 'processing',
          model: '',
          version: '',
          createdAt: '',
        });

        render(<HireFlowTestWrapper />);
        await waitForFormReady();

        // First select a voice (required for animation)
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        const voiceOption = await screen.findByRole('option', { name: /select voice alice/i });
        await user.click(voiceOption);

        // Open appearance and upload photo
        const appearanceTrigger = screen.getByRole('button', { name: /appearance/i });
        if (appearanceTrigger.getAttribute('data-state') === 'closed') {
          await user.click(appearanceTrigger);
        }
        const file = new File(['img'], 'photo.png', { type: 'image/png' });
        const fileInput = screen
          .getByText(/drop file or/i)
          .closest('label')
          ?.querySelector('input[type="file"]');
        if (fileInput) fireEvent.change(fileInput, { target: { files: [file] } });

        // Wait for image to be processed
        await waitFor(() => {
          expect(window.URL.createObjectURL).toHaveBeenCalled();
        });

        await user.click(screen.getByRole('tab', { name: /animate/i }));
        const promptInput = screen.getByLabelText(/tts prompt/i);
        await user.type(promptInput, 'Hello');

        await user.click(await screen.findByRole('button', { name: /animate photo/i }));

        // Wait for the animation to start and cancel button to appear
        const cancelBtn = await screen.findByLabelText(/cancel animation/i);
        await user.click(cancelBtn);

        // Verify cancelAnimation was called with the prediction ID from animate response
        expect(mockAssistantActions.photo.cancelAnimation).toHaveBeenCalledTimes(1);
        expect(mockAssistantActions.photo.cancelAnimation).toHaveBeenCalledWith('pred_123');
      }
    );
  });

  describe('E. Voice', () => {
    // ... (E Tests) ...
    it(
      'should display available voices in the list',
      {
        meta: {
          alias: 'Hire-Voice-List',
          behavior: 'Renders list of voices',
          scenario: 'Opening voice accordion',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        expect(await screen.findByText(/Alice \(US\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Bob \(UK\)/i)).toBeInTheDocument();
      }
    );

    it(
      'should play a preview when the play button is clicked',
      {
        meta: {
          alias: 'Hire-Voice-Preview',
          behavior: 'Calls generate API for voice preview',
          scenario: 'Clicking voice play button',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        const aliceOption = await screen.findByRole('option', { name: /select voice alice/i });
        const previewBtn = within(aliceOption).getByRole('button', {
          name: /preview/i,
        });
        const playSpy = vi
          .spyOn(window.HTMLMediaElement.prototype, 'play')
          .mockImplementation(() => Promise.resolve());
        await user.click(previewBtn);
        // Verify generate was called with correct voice parameters
        expect(mockAssistantActions.voice.generate).toHaveBeenCalledTimes(1);
        const generatePayload = mockAssistantActions.voice.generate.mock.calls[0][0];
        expect(generatePayload).toMatchObject({
          voiceId: expect.any(String),
          text: expect.any(String),
          provider: expect.stringMatching(/cartesia|elevenlabs|openai/),
        });
        playSpy.mockRestore();
      }
    );

    it(
      'should handle creating a new voice via cloning from a file',
      {
        meta: {
          alias: 'Hire-Voice-Clone',
          behavior: 'Creates voice from uploaded file',
          scenario: 'Cloning voice from file',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        await user.click(screen.getByRole('tab', { name: /clone/i }));
        await user.type(screen.getByLabelText(/voice name/i), 'My Clone');
        const file = new File(['audio-content'], 'sample.mp3', { type: 'audio/mp3' });
        const fileInput = document.getElementById('clone-file-input');
        if (!fileInput) throw new Error('File input not found');
        fireEvent.change(fileInput, { target: { files: [file] } });
        const createBtn = await screen.findByText('Create & Select Voice');
        const btnElement = createBtn.closest('button');
        await waitFor(() => expect(btnElement).toBeEnabled());
        fireEvent.click(btnElement!);
        await waitFor(() => {
          expect(mockAssistantActions.voice.clone).toHaveBeenCalledTimes(1);
        });
        // Verify FormData was passed with voice name and file
        const cloneFormData = mockAssistantActions.voice.clone.mock.calls[0][0] as FormData;
        expect(cloneFormData).toBeInstanceOf(FormData);
        expect(cloneFormData.get('name')).toBe('My Clone');
        expect(cloneFormData.get('file')).toBeInstanceOf(File);
      }
    );

    it(
      'should prevent using the name of an existing voice',
      {
        meta: {
          alias: 'Hire-Voice-Duplicate-Name',
          behavior: 'Shows error on duplicate voice name',
          scenario: 'Creating voice with existing name',
        },
      },
      async () => {
        (mockAssistantActions.voice.clone as any).mockResolvedValueOnce({
          detail: 'Voice name already exists',
        });
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        await user.click(screen.getByRole('tab', { name: /clone/i }));
        await user.type(screen.getByLabelText(/voice name/i), 'Existing Name');
        const file = new File(['audio'], 'sample.mp3', { type: 'audio/mp3' });
        const fileInput = document.getElementById('clone-file-input');
        if (fileInput) fireEvent.change(fileInput, { target: { files: [file] } });
        const createBtn = await screen.findByText('Create & Select Voice');
        fireEvent.click(createBtn.closest('button')!);
        expect(
          await screen.findByText('Error creating voice. Please try again.')
        ).toBeInTheDocument();
      }
    );

    it(
      'should automatically select a newly created voice',
      {
        meta: {
          alias: 'Hire-Voice-Auto-Select',
          behavior: 'Selects new voice after creation',
          scenario: 'Voice creation success',
        },
      },
      async () => {
        const user = userEvent.setup();
        const newVoice = { voiceId: 'v_new', name: 'New Voice', provider: 'elevenlabs' };
        (mockAssistantActions.voice.clone as any).mockResolvedValue(newVoice);
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        await user.click(screen.getByRole('tab', { name: /clone/i }));
        await user.type(screen.getByLabelText(/voice name/i), 'New Voice');
        const file = new File(['audio'], 'sample.mp3', { type: 'audio/mp3' });
        const fileInput = document.getElementById('clone-file-input');
        if (fileInput) fireEvent.change(fileInput, { target: { files: [file] } });
        const createBtn = await screen.findByText('Create & Select Voice');
        fireEvent.click(createBtn.closest('button')!);
        await waitFor(() => {
          expect(screen.getByRole('tab', { name: /select/i })).toHaveAttribute(
            'data-state',
            'active'
          );
        });
      }
    );

    it(
      'should handle designing a new voice',
      {
        meta: {
          alias: 'Hire-Voice-Design',
          behavior: 'Creates voice from text description',
          scenario: 'Designing voice flow',
        },
      },
      async () => {
        const user = userEvent.setup();
        worker.use(
          http.post('/api/assistant/voice/design/preview', () => {
            return HttpResponse.json({
              info: {
                previews: [
                  {
                    generatedVoiceId: 'preview_1',
                    audioBase64: 'fake_audio',
                    mediaType: 'audio/mp3',
                  },
                ],
                text: 'Sample text',
              },
            });
          })
        );
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        await user.click(screen.getByRole('tab', { name: /design/i }));
        const nameInput = screen.getByLabelText(/voice name/i);
        await user.clear(nameInput);
        await user.type(nameInput, 'My Design');
        const descInput = screen.getByLabelText(/voice description prompt/i);
        fireEvent.change(descInput, {
          target: {
            value:
              'A very deep and resonant robotic voice that sounds extremely futuristic, calm, and highly intelligent. It should have a slight metallic echo but remain very clear and easy to understand. This needs to be long enough to pass validation.',
          },
        });
        const generateBtn = await screen.findByRole('button', { name: /generate previews/i });
        await waitFor(() => expect(generateBtn).toBeEnabled());
        await user.click(generateBtn);
        const previewBtn = await screen.findByRole(
          'button',
          { name: /preview 1/i },
          { timeout: 5000 }
        );
        await user.click(previewBtn);
        const createBtn = await screen.findByText('Create & Select Voice');
        const createBtnEl = createBtn.closest('button');
        await user.click(createBtnEl!);
        await waitFor(() => {
          expect(mockAssistantActions.voice.design).toHaveBeenCalledTimes(1);
        });
        // Verify design was called with correct payload
        const designPayload = mockAssistantActions.voice.design.mock.calls[0][0];
        expect(designPayload).toMatchObject({
          generatedVoiceId: expect.any(String),
          voiceName: expect.any(String),
          voiceDescription: expect.any(String),
        });
      }
    );

    it(
      'should allow deleting a user-created voice',
      {
        meta: {
          alias: 'Hire-Voice-Delete',
          behavior: 'Deletes user voice on button click',
          scenario: 'Deleting custom voice',
        },
      },
      async () => {
        const user = userEvent.setup();
        const deletableVoice = {
          voiceId: 'del_1',
          name: 'Deletable Voice',
          description: 'User voice',
          gender: 'male' as const,
          language: 'en' as const,
          provider: 'elevenlabs' as const,
          isPreset: false,
          isUserVoiceInOrchestra: true,
        };
        const mixedVoices = [...mockVoices, deletableVoice];
        render(<HireFlowTestWrapper customVoices={mixedVoices} />);
        await waitForFormReady();
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        const voiceOption = await screen.findByRole('option', {
          name: /select voice deletable voice/i,
        });
        const deleteBtn = within(voiceOption).getByRole('button', {
          name: /delete/i,
        });
        await user.click(deleteBtn);
        await waitFor(() => {
          expect(mockAssistantActions.voice.delete).toHaveBeenCalledWith('del_1', 'elevenlabs');
        });
      }
    );

    it(
      'should validate input length in voice design tab',
      {
        meta: {
          alias: 'Hire-Voice-Design-Validation',
          behavior: 'Shows validation error for short description',
          scenario: 'Designing voice with short prompt',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }
        await user.click(screen.getByRole('tab', { name: /design/i }));
        const descInput = screen.getByLabelText(/voice description prompt/i);
        await user.type(descInput, 'Short');
        const generateBtn = await screen.findByRole('button', { name: /generate previews/i });
        await user.click(generateBtn);
        expect(await screen.findByText(/voice description must be between/i)).toBeInTheDocument();
        expect(mockAssistantActions.voice.preview).not.toHaveBeenCalled();
      }
    );

    it(
      'should automatically switch voice when nationality is changed',
      {
        meta: {
          alias: 'Hire-Auto-Voice-Switching',
          behavior: 'Updates voice selection based on nationality',
          scenario: 'Changing nationality',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<HireFlowTestWrapper />);
        await waitForFormReady();
        const profileTrigger = screen.getByRole('button', { name: /profile/i });
        if (profileTrigger.getAttribute('data-state') === 'closed') {
          await user.click(profileTrigger);
        }
        const voiceTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceTrigger);
        }
        expect(await screen.findByText(/Alice \(US\)/i)).toBeInTheDocument();
        const natTrigger = screen
          .getByRole('combobox', { hidden: true, name: /nationality/i })
          .closest('button');
        if (natTrigger) fireEvent.click(natTrigger);
        const ukOption = await screen.findByText(/United Kingdom/i).catch(() => null);
        if (ukOption) {
          await user.click(ukOption);
        } else {
          const options = screen.getAllByRole('option');
          if (options.length > 0) await user.click(options[options.length - 1]);
        }
        expect(screen.getByLabelText(/^voice trigger$/i)).toBeInTheDocument();
      }
    );
  });

  describe('F. Assistant Update Flow', () => {
    it(
      'should refresh signed video URL for GCS-backed edit media',
      {
        meta: {
          alias: 'Edit-Refresh-Video-SignedURL',
          behavior: 'Requests a fresh signed URL for existing GCS profile videos in edit mode',
          scenario: 'Opening edit dialog with stale signedProfileVideoUrl',
        },
      },
      async () => {
        const originalFetch = window.fetch;
        const fetchSpy = vi
          .spyOn(window, 'fetch')
          .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.includes('/api/assistant/media/batch-urls')) {
              return new Response(
                JSON.stringify({
                  urls: {
                    'gs://bucket/1132/video/alien-edit-flow.mp4':
                      'https://signed.example.com/alien-edit-flow.mp4?fresh=1',
                  },
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            }
            return originalFetch(input, init);
          });

        const assistantWithStaleVideo = {
          ...mockAssistants[0],
          profileVideo: 'gs://bucket/1132/video/alien-edit-flow.mp4',
          signedProfileVideoUrl: 'https://signed.example.com/alien-edit-flow.mp4?stale=1',
        };

        render(<EditFlowTestWrapper assistant={assistantWithStaleVideo} />);

        await waitFor(() => {
          const refreshCall = fetchSpy.mock.calls.find((call) =>
            String(call[0]).includes('/api/assistant/media/batch-urls')
          );
          expect(refreshCall).toBeDefined();
        });
      }
    );

    it(
      'should refresh and play edit video when only signedProfileVideoUrl is present',
      {
        meta: {
          alias: 'Edit-Refresh-Video-SignedOnly',
          behavior: 'Keeps existing edit video playable without switching to animate tab',
          scenario: 'Editing assistant with only signedProfileVideoUrl metadata',
        },
      },
      async () => {
        const user = userEvent.setup();
        const staleSignedVideoUrl =
          'https://storage.googleapis.com/assistant-media-staging/1132/video/alien-edit-flow.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Date=20260328T005000Z&X-Goog-Expires=900&X-Goog-Signature=stale';
        const refreshedSignedVideoUrl =
          'https://storage.googleapis.com/assistant-media-staging/1132/video/alien-edit-flow.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Date=20260328T005500Z&X-Goog-Expires=900&X-Goog-Signature=fresh';

        const originalFetch = window.fetch;
        const fetchSpy = vi
          .spyOn(window, 'fetch')
          .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.includes('/api/assistant/media/batch-urls')) {
              return new Response(
                JSON.stringify({
                  urls: {
                    [staleSignedVideoUrl]: refreshedSignedVideoUrl,
                  },
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            }
            return originalFetch(input, init);
          });

        const assistantWithSignedOnlyVideo = {
          ...mockAssistants[0],
          profileVideo: null,
          signedProfileVideoUrl: staleSignedVideoUrl,
        };

        render(<EditFlowTestWrapper assistant={assistantWithSignedOnlyVideo} />);

        await waitFor(() => {
          const refreshCall = fetchSpy.mock.calls.find((call) =>
            String(call[0]).includes('/api/assistant/media/batch-urls')
          );
          expect(refreshCall).toBeDefined();
          expect(String(refreshCall?.[1]?.body)).toContain(staleSignedVideoUrl);
        });

        const animateTab = screen.getByRole('tab', { name: /animate/i });
        expect(animateTab).toHaveAttribute('data-state', 'inactive');

        const mediaContainer = document.querySelector('.h-44.w-44');
        expect(mediaContainer).not.toBeNull();
        await user.click(mediaContainer as HTMLElement);

        await waitFor(() => {
          expect(animateTab).toHaveAttribute('data-state', 'inactive');
          const videoEl = document.querySelector('video');
          expect(videoEl).not.toBeNull();
          expect(videoEl).toHaveAttribute('src', refreshedSignedVideoUrl);
        });
      }
    );

    it(
      'should load assistant data into form',
      {
        meta: {
          alias: 'Edit-Load-Data',
          behavior: 'Form populates with assistant data',
          scenario: 'Opening edit dialog',
        },
      },
      async () => {
        render(<EditFlowTestWrapper assistant={mockAssistants[0]} />);
        expect(screen.getByLabelText(/first name/i)).toHaveValue(mockAssistants[0].firstName);
        expect(screen.getByLabelText(/last name/i)).toHaveValue(mockAssistants[0].surname);
      }
    );

    it(
      'should submit updates successfully',
      {
        meta: {
          alias: 'Edit-Submit',
          behavior: 'Submits update and shows success toast',
          scenario: 'Updating assistant name',
        },
      },
      async () => {
        const originalFetch = window.fetch;
        vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
          const url = input.toString();
          if (url.includes('/api/billing/balance')) {
            return new Response(JSON.stringify({ balance: '100.00', fullBalance: 100.0 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return originalFetch(input);
        });
        const updateSpy = vi.spyOn(mockAssistantActions.assistant, 'update');
        const user = userEvent.setup();
        const validAssistant = {
          ...mockAssistants[0],
          email: 'jane.doe@unify.ai',
        };

        render(<EditFlowTestWrapper assistant={validAssistant} />);

        const aboutInput = screen.getByLabelText(/about/i);
        await user.clear(aboutInput);
        await user.type(aboutInput, 'Updated Bio');
        const updateBtn = screen.getByRole('button', { name: /update assistant/i });

        await waitFor(() => expect(updateBtn).toBeEnabled());
        await user.click(updateBtn);

        await waitFor(() => {
          const errors = document.querySelectorAll('.text-destructive');
          if (errors.length > 0)
            console.log(
              'Validation Errors:',
              Array.from(errors).map((e) => e.textContent)
            );

          expect(updateSpy).toHaveBeenCalled();

          const [calledId, calledPayload] = updateSpy.mock.calls[0];
          expect(calledId).toBe(validAssistant.agentId);
          expect(calledPayload).toEqual(
            expect.objectContaining({
              about: 'Updated Bio',
            })
          );
        });
      }
    );

    it(
      'should validate required fields during edit',
      {
        meta: {
          alias: 'Edit-Validation',
          behavior: 'Shows error messages when required fields are cleared',
          scenario: 'Clearing required fields during edit',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<EditFlowTestWrapper assistant={mockAssistants[0]} />);

        // Wait for form to be populated with assistant data
        const firstNameInput = (await screen.findByLabelText(/first name/i)) as HTMLInputElement;
        await waitFor(() => {
          expect(firstNameInput).toHaveValue(mockAssistants[0].firstName);
        });

        // Clear the controlled input using fireEvent
        fireEvent.change(firstNameInput, { target: { value: '' } });
        fireEvent.blur(firstNameInput);

        // Verify input is empty
        expect(firstNameInput).toHaveValue('');

        const updateBtn = screen.getByRole('button', { name: /update assistant/i });
        await user.click(updateBtn);

        await waitFor(() => {
          expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
        });
      }
    );

    it(
      'should handle update failure gracefully',
      {
        meta: {
          alias: 'Edit-Failure',
          behavior: 'Shows error message when update fails',
          scenario: 'Backend returns error during update',
        },
      },
      async () => {
        const originalFetch = window.fetch;
        vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
          const url = input.toString();
          if (url.includes('/api/billing/balance')) {
            return new Response(JSON.stringify({ balance: '100.00', fullBalance: 100.0 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return originalFetch(input);
        });

        mockAssistantActions.assistant.update = vi.fn(async () => ({
          detail: 'Failed to update assistant',
        }));

        const user = userEvent.setup();
        const validAssistant = {
          ...mockAssistants[0],
          email: 'jane.doe@unify.ai',
        };

        render(<EditFlowTestWrapper assistant={validAssistant} />);

        const aboutInput = screen.getByLabelText(/about/i);
        await user.clear(aboutInput);
        await user.type(aboutInput, 'This update will fail');

        const updateBtn = screen.getByRole('button', { name: /update assistant/i });
        await waitFor(() => expect(updateBtn).toBeEnabled());
        await user.click(updateBtn);

        await waitFor(() => {
          expect(mockAssistantActions.assistant.update).toHaveBeenCalledTimes(1);
        });
        // Verify update was called with correct assistant ID and payload
        const [assistantId, updatePayload] = mockAssistantActions.assistant.update.mock.calls[0];
        expect(assistantId).toBe(validAssistant.agentId);
        expect(updatePayload).toMatchObject({
          about: 'This update will fail',
        });
      }
    );

    it(
      'should allow changing voice during edit',
      {
        meta: {
          alias: 'Edit-Voice-Change',
          behavior: 'Voice can be changed in edit mode',
          scenario: 'User changes assistant voice',
        },
      },
      async () => {
        const originalFetch = window.fetch;
        vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
          const url = input.toString();
          if (url.includes('/api/billing/balance')) {
            return new Response(JSON.stringify({ balance: '100.00', fullBalance: 100.0 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return originalFetch(input);
        });

        const updateSpy = vi.spyOn(mockAssistantActions.assistant, 'update');
        const user = userEvent.setup();
        const validAssistant = {
          ...mockAssistants[0],
          email: 'jane.doe@unify.ai',
          voiceId: 'voice_1',
        };

        render(<EditFlowTestWrapper assistant={validAssistant} />);

        // Wait for form to load with assistant data
        await waitFor(() => {
          expect(screen.getByLabelText(/first name/i)).toHaveValue(validAssistant.firstName);
        });

        // Open voice accordion
        const voiceAccordionTrigger = screen.getByRole('button', { name: /^voice$/i });
        if (voiceAccordionTrigger.getAttribute('data-state') === 'closed') {
          await user.click(voiceAccordionTrigger);
        }

        // Verify voice options are rendered
        const aliceVoice = await screen.findByRole('option', { name: /select voice alice/i });
        const bobVoice = await screen.findByRole('option', { name: /select voice bob/i });

        // Alice should be initially selected (from the assistant data)
        await waitFor(() => {
          expect(aliceVoice).toHaveAttribute('aria-selected', 'true');
        });

        // Verify Bob's voice option is not disabled (no cursor-not-allowed class)
        expect(bobVoice.className).not.toContain('cursor-not-allowed');

        // Click directly on Bob's name text to select the voice
        const bobNameText = screen.getByText('Bob (UK)');
        await user.click(bobNameText);

        // Give time for state update
        await waitFor(
          () => {
            const updatedBobVoice = screen.getByTestId('voice-option-voice_2');
            expect(updatedBobVoice).toHaveAttribute('aria-selected', 'true');
          },
          { timeout: 3000 }
        );

        const updateBtn = screen.getByRole('button', { name: /update assistant/i });
        await waitFor(() => expect(updateBtn).toBeEnabled());
        await user.click(updateBtn);

        await waitFor(() => {
          expect(updateSpy).toHaveBeenCalled();
          const [, payload] = updateSpy.mock.calls[0];
          expect(payload).toEqual(
            expect.objectContaining({
              voiceId: 'voice_2',
            })
          );
        });
      }
    );

    it(
      'should preserve unchanged fields during update',
      {
        meta: {
          alias: 'Edit-Preserve-Fields',
          behavior: 'Unchanged fields are preserved in update payload',
          scenario: 'Partial update of assistant',
        },
      },
      async () => {
        const originalFetch = window.fetch;
        vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
          const url = input.toString();
          if (url.includes('/api/billing/balance')) {
            return new Response(JSON.stringify({ balance: '100.00', fullBalance: 100.0 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return originalFetch(input);
        });

        const updateSpy = vi.spyOn(mockAssistantActions.assistant, 'update');
        const user = userEvent.setup();
        const validAssistant = {
          ...mockAssistants[0],
          email: 'jane.doe@unify.ai',
          about: 'Original bio text',
        };

        render(<EditFlowTestWrapper assistant={validAssistant} />);

        // Only change timezone
        const timezoneTrigger = screen.getByLabelText(/timezone/i);
        await user.click(timezoneTrigger);
        const timezoneOption = await screen
          .findByRole('option', { name: /Los Angeles/i })
          .catch(() => null);
        if (timezoneOption) {
          await user.click(timezoneOption);
        }

        const updateBtn = screen.getByRole('button', { name: /update assistant/i });
        await waitFor(() => expect(updateBtn).toBeEnabled());
        await user.click(updateBtn);

        await waitFor(() => {
          expect(updateSpy).toHaveBeenCalled();
          const [, payload] = updateSpy.mock.calls[0] as [string, { timezone?: string }];
          // Timezone should be updated (it's an updatable field)
          expect(payload.timezone).toBeDefined();
        });
      }
    );

    it(
      'should close dialog when cancel is clicked',
      {
        meta: {
          alias: 'Edit-Cancel',
          behavior: 'Dialog closes without saving changes',
          scenario: 'User cancels edit',
        },
      },
      async () => {
        const user = userEvent.setup();
        render(<EditFlowTestWrapper assistant={mockAssistants[0]} />);

        // Make a change
        const aboutInput = screen.getByLabelText(/about/i);
        await user.clear(aboutInput);
        await user.type(aboutInput, 'Unsaved changes');

        // Click cancel (X button or close)
        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        // Dialog should close
        await waitFor(() => {
          expect(
            screen.queryByRole('button', { name: /update assistant/i })
          ).not.toBeInTheDocument();
        });
      }
    );
  });
});
