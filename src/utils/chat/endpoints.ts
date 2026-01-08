export const hasKeyword = (str: string, keywords: string[]) => {
  const lowerStr = str.toLowerCase();
  return keywords.some((word: string) => lowerStr.includes(word));
};
