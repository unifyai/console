'use client';

/**
 * Simple checks for dictionary vs. list
 */
function isDict(val: any): boolean {
  return val && typeof val === 'object' && !Array.isArray(val);
}
function isList(val: any): boolean {
  return Array.isArray(val);
}

/**
 * sanitizePropertyKey:
 *  - If your data can contain slashes or other special characters, we replace them.
 *  - Adjusted to preserve slashes (/) but replace other special characters with underscores.
 */
export function sanitizePropertyKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_\/]/g, '_');
}

/**
 * makeDictPath:
 *  - For a dictionary node at "nestingLevel" => "dict.<nestingLevel>.<key>"
 *    (Used in older code or for top-level references.)
 */
export function makeDictPath(nestingLevel: number, key: string): string {
  const safeKey = sanitizePropertyKey(key);
  return `dict.${nestingLevel}.${safeKey}`;
}

/**
 * makeListPath:
 *  - For a list node at "nestingLevel" => "list.<nestingLevel>.<index>"
 */
export function makeListPath(nestingLevel: number, index: number): string {
  return `list.${nestingLevel}.${index}`;
}

/**
 * makePrefixedDictPath:
 *  - Optionally used for top-level dictionary => e.g. "entries.dict.0.<key>"
 */
export function makePrefixedDictPath(prefix: string, nestingLevel: number, key: string): string {
  const path = `${prefix}.dict.${nestingLevel}.${sanitizePropertyKey(key)}`;
  return path;
}

/**
 * makePrefixedListPath:
 *  - Optionally used for top-level list => e.g. "params.list.0.<index>"
 */
export function makePrefixedListPath(prefix: string, nestingLevel: number, index: number): string {
  const path = `${prefix}.list.${nestingLevel}.${index}`;
  return path;
}

/**
 * gatherAllSubPaths:
 *  - Recursively enumerates all sub-dictionary/list paths, preserving the
 *    parent's full path so child keys become e.g. "entries.dict.0.a.sub_question".
 *
 *  - If basePath is non-empty, we simply append ".childKey" (or ".<index>" for lists).
 *  - If basePath is empty (meaning topmost level), we can optionally build
 *    "prefix.dict.<nesting>.<key>" or "prefix.list.<nesting>.<index>" for the child.
 *    But typically you'll already have basePath set to something like
 *      "entries.dict.0.a"
 *    so we just do basePath + "." + "sub_question".
 */
export function gatherAllSubPaths(
  value: any,
  basePath: string,
  prefix: string,
  nestingLevel: number
): string[] {
  const result: string[] = [];

  // Include the current node's own path if it's not empty.
  if (basePath) {
    result.push(basePath);
  }

  if (isDict(value)) {
    const obj = value as Record<string, any>;
    const keys = Object.keys(obj);

    for (const k of keys) {
      const safeK = sanitizePropertyKey(k);

      let childPath: string;
      if (basePath) {
        childPath = basePath + '.' + safeK;
      } else {
        childPath = makePrefixedDictPath(prefix, nestingLevel, k);
      }

      // Recursively process the value at this key
      const subPaths = gatherAllSubPaths(obj[k], childPath, prefix, nestingLevel + 1);
      result.push(...subPaths);
    }
  } else if (isList(value)) {
    const arr = value as any[];

    for (let i = 0; i < arr.length; i++) {
      let childPath: string;
      if (basePath) {
        childPath = basePath + '.' + i;
      } else {
        childPath = makePrefixedListPath(prefix, nestingLevel, i);
      }

      const subPaths = gatherAllSubPaths(arr[i], childPath, prefix, nestingLevel + 1);
      result.push(...subPaths);
    }
  }

  return result;
}

/*------------------------------------------------------------------------------
  gatherAllSubPathsMulti:
    Similar to gatherAllSubPaths, but it merges "baseValue" plus any number of
    comparables to ensure we also discover paths that exist only in comparables.

    Usage:
      gatherAllSubPathsMulti(baseValue, comps, basePath, prefix, nestingLevel)
------------------------------------------------------------------------------*/
export function gatherAllSubPathsMulti(
  baseValue: any,
  comparables: any[],
  basePath: string,
  prefix: string,
  nestingLevel: number
): string[] {
  const result: string[] = [];

  // Include the current node's own path if it's not empty.
  if (basePath) {
    result.push(basePath);
  }

  // We'll union the shape from base + all comparables to find sub-keys or items.
  const allVals = [baseValue, ...comparables].filter((v) => v !== undefined);

  // If none are valid objects/arrays => return current path only
  if (!allVals.some((v) => isDict(v) || isList(v))) {
    return result;
  }

  // If any is a dict => union all dict keys
  if (allVals.some((v) => isDict(v))) {
    const unionKeys = new Set<string>();
    for (const val of allVals) {
      if (isDict(val)) {
        Object.keys(val).forEach((k) => unionKeys.add(k));
      }
    }

    for (const k of Array.from(unionKeys)) {
      const safeK = sanitizePropertyKey(k);
      let childPath: string;
      if (basePath) {
        childPath = basePath + '.' + safeK;
      } else {
        childPath = makePrefixedDictPath(prefix, nestingLevel, k);
      }

      // gather child base
      const childBase = isDict(baseValue) ? baseValue[k] : undefined;
      // gather child comps for each comparable
      const childComps = comparables.map((c) => (isDict(c) ? c[k] : undefined));

      result.push(
        ...gatherAllSubPathsMulti(childBase, childComps, childPath, prefix, nestingLevel + 1)
      );
    }
  }
  // If none are dict, but at least one is a list => union the array lengths
  else if (allVals.some((v) => isList(v))) {
    // find max length
    let maxLen = 0;
    for (const val of allVals) {
      if (isList(val)) {
        maxLen = Math.max(maxLen, (val as any[]).length);
      }
    }

    for (let i = 0; i < maxLen; i++) {
      let childPath: string;
      if (basePath) {
        childPath = basePath + '.' + i;
      } else {
        childPath = makePrefixedListPath(prefix, nestingLevel, i);
      }

      // gather child base
      const childBase = isList(baseValue) ? baseValue[i] : undefined;
      // gather child comps for each comparable
      const childComps = comparables.map((c) => (isList(c) ? c[i] : undefined));

      result.push(
        ...gatherAllSubPathsMulti(childBase, childComps, childPath, prefix, nestingLevel + 1)
      );
    }
  }

  return result;
}
