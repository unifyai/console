export interface FunctionDocParam {
  name: string;
  type: string;
  description: string;
}

export interface ParsedFunctionDoc {
  summary: string;
  params: FunctionDocParam[];
  returns: { type: string; description: string } | null;
}

const SECTION_HEADERS =
  /^(Args|Arguments|Parameters|Returns|Return|Raises|Yields|Note|Notes|Example|Examples):?\s*$/i;

const SEPARATOR_LINE = /^[\s\-=_~.]{3,}$/;

function stripDocSeparators(text: string): string {
  return text
    .split('\n')
    .filter((line) => !SEPARATOR_LINE.test(line.trim()))
    .join('\n')
    .trim();
}

function parseParamBlock(block: string): FunctionDocParam[] {
  const params: FunctionDocParam[] = [];
  const lines = block.split('\n');
  let current: FunctionDocParam | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || SEPARATOR_LINE.test(trimmed)) continue;

    const numpyMatch = trimmed.match(/^(\w+)\s*(?:\(([^)]+)\))?\s*:\s*(.*)$/);
    if (numpyMatch) {
      if (current) params.push(current);
      const trailing = numpyMatch[3]?.trim() ?? '';
      const parenType = numpyMatch[2]?.trim() ?? '';
      const inlineType =
        !parenType &&
        trailing.length > 0 &&
        /^[\w\[\]|.,\s<>]+$/i.test(trailing) &&
        (trailing.includes('|') || !trailing.includes(' '));
      current = {
        name: numpyMatch[1]!,
        type: parenType || (inlineType ? trailing : ''),
        description: inlineType ? '' : trailing,
      };
      continue;
    }

    const nameTypeOnly = trimmed.match(/^(\w+)\s*:\s*(\S+)\s*$/);
    if (nameTypeOnly) {
      if (current) params.push(current);
      current = {
        name: nameTypeOnly[1]!,
        type: nameTypeOnly[2]!.trim(),
        description: '',
      };
      continue;
    }

    const googleMatch = trimmed.match(/^(\w+)\s*:\s*(\S+)\s+(.*)$/);
    if (googleMatch) {
      if (current) params.push(current);
      current = {
        name: googleMatch[1]!,
        type: googleMatch[2]!.trim(),
        description: googleMatch[3]!.trim(),
      };
      continue;
    }

    if (current) {
      const cont = trimmed.replace(/^\s+/, '');
      current.description = current.description ? `${current.description} ${cont}` : cont;
    }
  }

  if (current) params.push(current);
  return params;
}

function parseReturnsBlock(block: string): { type: string; description: string } | null {
  const cleaned = stripDocSeparators(block);
  if (!cleaned) return null;

  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const first = lines[0]!;
  const typeDescMatch = first.match(/^(\S+)\s*:\s*(.*)$/);
  if (typeDescMatch) {
    return {
      type: typeDescMatch[1]!,
      description: [typeDescMatch[2]!.trim(), ...lines.slice(1)].filter(Boolean).join(' ').trim(),
    };
  }

  if (lines.length > 1 && /^[\w\[\]|.,\s<>]+$/i.test(first)) {
    return {
      type: first,
      description: lines.slice(1).join(' ').trim(),
    };
  }

  const inlineMatch = first.match(/^(\S+)\s+(.+)$/);
  if (inlineMatch) {
    return { type: inlineMatch[1]!, description: inlineMatch[2]!.trim() };
  }

  return { type: '', description: first };
}

/**
 * Splits a Python-style docstring into summary, parameters, and returns.
 * Supports Google/NumPy-style section headers and underline separators.
 */
export function parseFunctionDocstring(docstring: string): ParsedFunctionDoc {
  if (!docstring.trim()) {
    return { summary: '', params: [], returns: null };
  }

  const lines = docstring.split('\n');
  const summaryLines: string[] = [];
  const sections: Record<string, string[]> = {};
  let currentSection: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (SEPARATOR_LINE.test(trimmed)) continue;

    if (SECTION_HEADERS.test(trimmed)) {
      currentSection = trimmed.replace(/:?\s*$/, '').toLowerCase();
      sections[currentSection] = [];
      continue;
    }

    if (currentSection) {
      sections[currentSection]!.push(line);
    } else if (trimmed) {
      summaryLines.push(trimmed);
    }
  }

  const paramsBlock =
    sections.parameters?.join('\n') ??
    sections.args?.join('\n') ??
    sections.arguments?.join('\n') ??
    '';

  const returnsBlock = sections.returns?.join('\n') ?? sections.return?.join('\n') ?? '';

  return {
    summary: summaryLines.join(' ').trim(),
    params: parseParamBlock(paramsBlock),
    returns: parseReturnsBlock(returnsBlock),
  };
}

/** First paragraph of a docstring for card previews. */
export function docstringPreview(docstring: string, maxLen = 160): string {
  const parsed = parseFunctionDocstring(docstring);
  const text = parsed.summary || docstring.split('\n\n')[0]?.replace(/\s+/g, ' ').trim() || '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}…`;
}
