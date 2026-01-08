'use client';

import CodeGen from 'postman-code-generators';
import CommonLanguage from './Common';
import OtherLanguages from './Other';

const Languages = ({
  selectedLanguage,
  setSelectedLanguage,
  selectedVariant,
  setSelectedVariant,
}: {
  selectedLanguage: string;
  // eslint-disable-next-line no-unused-vars
  setSelectedLanguage: (language: string) => void;
  selectedVariant: string;
  // eslint-disable-next-line no-unused-vars
  setSelectedVariant: (variant: string) => void;
}) => {
  const languages = CodeGen.getLanguageList() as CodeGen.Language[];

  const commonLanguages = ['python', 'nodejs', 'javascript', 'curl', 'php'].map(
    (language) => languages.find((l: { key: string }) => l.key === language)!
  );
  const pythonIndex = commonLanguages.findIndex((l: { key: string }) => l.key === 'python');
  commonLanguages[pythonIndex].variants.push({ key: 'package' });

  const otherLanguages = languages
    .filter((language) => !commonLanguages.includes(language))
    .flatMap((language) =>
      language.variants.map((variant) => ({
        key: language.key as string,
        label: language.label as string,
        variant: variant.key,
      }))
    );

  return (
    <div className="flex h-full flex-col gap-1 overflow-auto">
      {commonLanguages.map((language, index) => (
        <CommonLanguage
          key={index}
          language={language}
          setSelectedLanguage={setSelectedLanguage}
          setSelectedVariant={setSelectedVariant}
        />
      ))}
      <OtherLanguages
        languages={otherLanguages}
        setSelectedLanguage={setSelectedLanguage}
        setSelectedVariant={setSelectedVariant}
      />
    </div>
  );
};

export default Languages;
