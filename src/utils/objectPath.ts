/**
 * Immutably set a deeply nested value.
 * 
 * Handles both object and array containers.  When cloning: 
 *   • If the current container is an array – clone via spread on an array so the result stays an array. 
 *   • Otherwise fall back to object spread cloning.
 * Missing intermediate containers default to `{}` or `[]` depending on the next path segment type.
 */
export function setDeep(obj: any, path: (string | number)[], val: any): any {
  if (path.length === 0) return val; // Edge-case: overwrite root

  const [segment, ...rest] = path;

  // Determine the current container and clone accordingly to preserve type
  const isArrayContainer = Array.isArray(obj);
  const clone: any = isArrayContainer ? [...obj] : { ...obj };

  // Determine default for missing branch when recursing
  const nextDefault = typeof rest[0] === "number" ? [] : {};

  clone[segment as any] = rest.length
    ? setDeep(obj?.[segment] ?? nextDefault, rest, val)
    : val;

  return clone;
}

export function getDeep(obj: any, path: (string | number)[]): any {
  return path.reduce((acc, seg) => (acc == null ? undefined : acc[seg]), obj);
} 