export function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => removeUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    // Preserve special objects like Date, RegExp, File, Blob if necessary,
    // but typically standard Firestore values are just plain objects/arrays.
    if (value instanceof Date) return value;
    if (value instanceof RegExp) return value;
    // For browser environments
    if (typeof File !== 'undefined' && value instanceof File) return value;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value;
    
    // Check if it's a Firestore Timestamp (has toMillis method)
    if (typeof (value as any).toMillis === 'function') return value;

    const result: Record<string, any> = {};

    Object.entries(value as Record<string, any>).forEach(([key, val]) => {
      if (val === undefined) return;
      result[key] = removeUndefinedDeep(val);
    });

    return result as T;
  }

  return value;
}
