/** Cartesia voice API language codes (mirrors `@cartesia/cartesia-js` without bundling the SDK). */
export type CartesiaSupportedLanguage =
  | 'en'
  | 'fr'
  | 'de'
  | 'es'
  | 'pt'
  | 'zh'
  | 'ja'
  | 'hi'
  | 'it'
  | 'ko'
  | 'nl'
  | 'pl'
  | 'ru'
  | 'sv'
  | 'tr';

/** Cartesia voice gender values (mirrors `@cartesia/cartesia-js` without bundling the SDK). */
export type CartesiaGender = 'male' | 'female';

export type SupportedLanguage = CartesiaSupportedLanguage;
export type Gender = CartesiaGender;
