import { countryToLangMap } from '@/constants/assistants/countries';
import voice_presets from '@/constants/assistants/voice_presets';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { SupportedLanguage, Gender as CartesiaGender } from '@cartesia/cartesia-js/api';
import { Voice } from '@/types/assistants/assistant';
import {
  applyApprovedCharacterVoiceMetadata,
  approvedCharacterVoiceIds,
} from '@/constants/assistants/approved_character_voices';

export const languageOptions: { value: SupportedLanguage; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Spanish', flag: '🇪🇸' },
  { value: 'fr', label: 'French', flag: '🇫🇷' },
  { value: 'de', label: 'German', flag: '🇩🇪' },
  { value: 'pt', label: 'Portuguese', flag: '🇵🇹' },
  { value: 'it', label: 'Italian', flag: '🇮🇹' },
  { value: 'pl', label: 'Polish', flag: '🇵🇱' },
  { value: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { value: 'hi', label: 'Hindi', flag: '🇮🇳' },
  { value: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { value: 'ko', label: 'Korean', flag: '🇰🇷' },
  { value: 'nl', label: 'Dutch', flag: '🇳🇱' },
  { value: 'ru', label: 'Russian', flag: '🇷🇺' },
  { value: 'sv', label: 'Swedish', flag: '🇸🇪' },
  { value: 'tr', label: 'Turkish', flag: '🇹🇷' },
];
export const getLanguageFlag = (langCode: string | undefined) => {
  if (langCode === 'multi') return '🌎';
  return languageOptions.find((l) => l.value === langCode)?.flag || '🏳️';
};
export const getLanguageLabel = (langCode: string | undefined) => {
  if (langCode === 'multi') return 'Multilingual';
  return (
    languageOptions.find((l) => l.value === langCode)?.label || langCode?.toUpperCase() || 'N/A'
  );
};
export const cartesiaLocalizeGenderOptions: { value: CartesiaGender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];
export const sampleTTSLinesByLanguage: Record<SupportedLanguage | string, string[]> = {
  all: ['Hello, how can I assist you today?', 'I can speak many languages.'],
  en: [
    'Hello, how can I assist you today?',
    "I'm here to help with any questions you might have.",
    "The weather today is quite pleasant, isn't it?",
  ],
  es: [
    'Hola, ¿en qué puedo ayudarte hoy?',
    'Estoy aquí para ayudar con cualquier pregunta que puedas tener.',
    'El clima hoy es bastante agradable, ¿no es así?',
  ],
  fr: [
    "Bonjour, comment puis-je vous aider aujourd'hui?",
    'Je suis là pour répondre à toutes vos questions.',
    "Le temps aujourd'hui est plutôt agréable, n'est-ce pas?",
  ],
  de: [
    'Hallo, wie kann ich Ihnen heute helfen?',
    'Ich bin hier, um bei allen Fragen zu helfen, die Sie möglicherweise haben.',
    'Das Wetter heute ist ziemlich angenehm, nicht wahr?',
  ],
  pt: [
    'Olá, como posso ajudá-lo hoje?',
    'Estou aqui para responder a todas as suas perguntas.',
    'O tempo está agradável hoje, não está?',
  ],
  it: [
    'Ciao, come posso aiutarti oggi?',
    'Sono qui per rispondere a qualsiasi tua domanda.',
    'Il tempo oggi è davvero piacevole, vero?',
  ],
  pl: [
    'Cześć, jak mogę ci dzisiaj pomóc?',
    'Jestem tutaj, aby odpowiedzieć na wszystkie twoje pytania.',
    'Dzisiejsza pogoda jest całkiem przyjemna, prawda?',
  ],
  ja: [
    'こんにちは、今日はどのようにお手伝いできますか？',
    'ご不明な点がございましたら、お気軽にお問い合わせください。',
    '今日の天気はとても気持ちがいいですね。',
  ],
  hi: [
    'नमस्ते, आज मैं आपकी कैसे मदद कर सकता हूँ?',
    'अगर आपके कोई सवाल हैं तो मैं यहाँ हूँ।',
    'आज का मौसम बहुत सुहावना है, है ना?',
  ],
  zh: [
    '你好，今天我能为你做些什么？',
    '如果您有任何问题，我随时在这里提供帮助。',
    '今天的天气真不错，不是吗？',
  ],
  ko: [
    '안녕하세요, 무엇을 도와드릴까요?',
    '궁금한 점이 있으시면 언제든지 말씀해주세요.',
    '오늘 날씨 정말 좋네요, 그렇죠?',
  ],
  nl: [
    'Hallo, hoe kan ik je vandaag helpen?',
    'Ik ben hier om al je vragen te beantwoorden.',
    'Het weer is vandaag best aangenaam, vind je niet?',
  ],
  ru: [
    'Здравствуйте, чем я могу вам помочь сегодня?',
    'Я здесь, чтобы ответить на все ваши вопросы.',
    'Сегодня довольно приятная погода, не так ли?',
  ],
  sv: [
    'Hej, hur kan jag hjälpa dig idag?',
    'Jag är här för att svara på dina frågor.',
    'Vädret är ganska trevligt idag, eller hur?',
  ],
  tr: [
    'Merhaba, bugün size nasıl yardımcı olabilirim?',
    'Her türlü sorunuz için buradayım.',
    'Bugün hava oldukça güzel, değil mi?',
  ],
  default: [
    'This is a test sentence.',
    'Can you hear my voice clearly?',
    'I hope you have a wonderful day!',
  ],
};

export const getRandomSampleLine = (language: SupportedLanguage | 'multi'): string => {
  const lines = sampleTTSLinesByLanguage[language] || sampleTTSLinesByLanguage.default;
  return lines[Math.floor(Math.random() * lines.length)];
};

export const getLangCodeForNationality = (
  nationality: string | null | undefined
): SupportedLanguage | null => {
  if (!nationality) return null;
  return countryToLangMap[nationality] || null;
};

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const getDefaultVoiceForProvider = () => {
  let suitableDefault = (voice_presets as Voice[]).find(
    (vp) => vp.provider === PRIMARY_VOICE_PROVIDER && approvedCharacterVoiceIds.has(vp.voiceId)
  );
  if (!suitableDefault && voice_presets.length > 0) {
    suitableDefault =
      (voice_presets as Voice[]).find((vp) => approvedCharacterVoiceIds.has(vp.voiceId)) ||
      (voice_presets as Voice[])[0];
  }
  if (!suitableDefault) {
    // Absolute fallback if voice_presets is empty
    return {
      voiceId:
        PRIMARY_VOICE_PROVIDER === 'cartesia'
          ? '11af83e2-23eb-452f-956e-7fee218ccb5c'
          : '9BWtsMINqrJLrRacOk9x',
      name:
        PRIMARY_VOICE_PROVIDER === 'cartesia' ? 'English Female Calm 1' : 'English Female Husky 1',
      language: 'en',
      description:
        PRIMARY_VOICE_PROVIDER === 'cartesia'
          ? 'A calm, conversational, feminine voice perfect for narration stories or on phone calls. Speaking in an American accent.'
          : 'A middle-aged female with an African-American accent. Calm with a hint of rasp.',
      gender: 'female',
      provider: PRIMARY_VOICE_PROVIDER,
    };
  }
  return applyApprovedCharacterVoiceMetadata(suitableDefault);
};

export const getAudioDuration = (blob: Blob): Promise<number> => {
  return new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(blob));
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      resolve(0);
    };
  });
};
