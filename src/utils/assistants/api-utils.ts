export function formatFastApiError(detail: any): string {
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((err: any) => {
        const field =
          err.loc && err.loc.length > 1
            ? err.loc.slice(1).join('.')
            : (err.loc && err.loc[0]) || 'body';
        return `${field}: ${err.msg}`;
      })
      .join('; ');
  }
  if (typeof detail === 'object' && detail !== null) {
    return JSON.stringify(detail); // Fallback for other object structures
  }
  return 'Unknown validation error.';
}
