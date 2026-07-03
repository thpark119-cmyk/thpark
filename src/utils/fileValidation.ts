export function getSafeFileExtension(file: File): string {
  const nameParts = file.name.split('.');
  if (nameParts.length < 2) return '';
  return nameParts.pop()?.toLowerCase() || '';
}

export function validateLessonPhotoFile(file: File): { ok: boolean; reason?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSizeBytes = 1 * 1024 * 1024; // 1MB

  if (!allowedTypes.includes(file.type)) {
    return { ok: false, reason: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' };
  }

  if (file.size > maxSizeBytes) {
    return { ok: false, reason: 'File is too large. Maximum size is 1MB.' };
  }

  return { ok: true };
}

export function validateScoreUploadFile(file: File): { ok: boolean; reason?: string } {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const isPdf = file.type === 'application/pdf';
  const isImage = allowedImageTypes.includes(file.type);

  if (!isPdf && !isImage) {
    return { ok: false, reason: 'Invalid file type. Only PDF, JPEG, PNG, and WebP are allowed.' };
  }

  if (isPdf && file.size > 15 * 1024 * 1024) {
    return { ok: false, reason: 'PDF file is too large. Maximum size is 15MB.' };
  }

  if (isImage && file.size > 5 * 1024 * 1024) {
    return { ok: false, reason: 'Image file is too large. Maximum size is 5MB.' };
  }

  return { ok: true };
}
