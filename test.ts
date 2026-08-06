function getStorageErrorCodeV2(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string'
  ) {
    return (error as any).code;
  }
  return null;
}
