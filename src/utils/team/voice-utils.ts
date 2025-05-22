import { SupportedLanguage, Gender as CartesiaGender } from "@cartesia/cartesia-js/api";
export const languageOptions: { value: SupportedLanguage; label: string; flag: string }[] = [
    { value: "en", label: "English", flag: "🇬🇧" }, { value: "es", label: "Spanish", flag: "🇪🇸" },
    { value: "fr", label: "French", flag: "🇫🇷" }, { value: "de", label: "German", flag: "🇩🇪" },
    { value: "pt", label: "Portuguese", flag: "🇵🇹" }, { value: "it", label: "Italian", flag: "🇮🇹" },
    { value: "pl", label: "Polish", flag: "🇵🇱" }, { value: "ja", label: "Japanese", flag: "🇯🇵" },
    { value: "hi", label: "Hindi", flag: "🇮🇳" }, { value: "zh", label: "Chinese", flag: "🇨🇳" },
    { value: "ko", label: "Korean", flag: "🇰🇷" }, { value: "nl", label: "Dutch", flag: "🇳🇱" },
    { value: "ru", label: "Russian", flag: "🇷🇺" }, { value: "sv", label: "Swedish", flag: "🇸🇪" },
    { value: "tr", label: "Turkish", flag: "🇹🇷" },
];
export const getLanguageFlag = (langCode: string | undefined) => languageOptions.find(l => l.value === langCode)?.flag || "🏳️";
export const getLanguageLabel = (langCode: string | undefined) => languageOptions.find(l => l.value === langCode)?.label || langCode?.toUpperCase() || "N/A";
export const cartesiaLocalizeGenderOptions: { value: CartesiaGender; label: string }[] = [
    { value: "female", label: "Female" }, { value: "male", label: "Male" },
];
export const sampleTTSLinesByLanguage: Record<SupportedLanguage | string, string[]> = {
    en: [
        "Hello, how can I assist you today?",
        "I'm here to help with any questions you might have.",
        "The weather today is quite pleasant, isn't it?",
    ],
    es: [
        "Hola, ¿en qué puedo ayudarte hoy?",
        "Estoy aquí para ayudar con cualquier pregunta que puedas tener.",
        "El clima hoy es bastante agradable, ¿no es así?",
    ],
    fr: [
        "Bonjour, comment puis-je vous aider aujourd'hui?",
        "Je suis là pour répondre à toutes vos questions.",
        "Le temps aujourd'hui est plutôt agréable, n'est-ce pas?",
    ],
    de: [
        "Hallo, wie kann ich Ihnen heute helfen?",
        "Ich bin hier, um bei allen Fragen zu helfen, die Sie möglicherweise haben.",
        "Das Wetter heute ist ziemlich angenehm, nicht wahr?",
    ],
    // Add more languages and 3 lines for each
    ja: [
        "こんにちは、今日はどのようにお手伝いできますか？",
        "ご不明な点がございましたら、お気軽にお問い合わせください。",
        "今日の天気はとても気持ちがいいですね。",
    ],
    zh: [
        "你好，今天我能为你做些什么？",
        "如果您有任何问题，我随时在这里提供帮助。",
        "今天的天气真不错，不是吗？",
    ],
    // Fallback for languages not explicitly defined
    default: [
        "This is a test sentence.",
        "Can you hear my voice clearly?",
        "I hope you have a wonderful day!",
    ]
};
export const getRandomSampleLine = (language: SupportedLanguage): string => {
    const lines = sampleTTSLinesByLanguage[language] || sampleTTSLinesByLanguage.default;
    return lines[Math.floor(Math.random() * lines.length)];
};