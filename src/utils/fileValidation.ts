export function getSafeFileExtension(file: File): string {
  const nameParts = file.name.split('.');
  if (nameParts.length < 2) return '';
  return nameParts.pop()?.toLowerCase() || '';
}

export function validateLessonPhotoFile(file: File, options?: { isCompressed?: boolean }): { ok: boolean; reason?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const maxOriginalSize = 20 * 1024 * 1024; // 20MB
  const maxCompressedSize = 950 * 1024; // 950KB

  const ext = getSafeFileExtension(file);
  const isExtensionValid = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext);
  const isMimeValid = allowedTypes.includes(file.type) || file.type.startsWith('image/');

  if (!isExtensionValid && !isMimeValid) {
    return { ok: false, reason: 'unsupportedFormat' };
  }

  if (!options?.isCompressed) {
    if (file.size > maxOriginalSize) {
      return { ok: false, reason: 'tooLarge' };
    }
  } else {
    if (file.size > maxCompressedSize) {
      return { ok: false, reason: 'compressionFailedLimit' };
    }
  }

  return { ok: true };
}

export function validateScoreUploadFile(file: File, options?: { isCompressed?: boolean }): { ok: boolean; reason?: string } {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const isPdf = file.type === 'application/pdf';
  const isImage = allowedImageTypes.includes(file.type);

  if (!isPdf && !isImage) {
    return { ok: false, reason: 'Invalid file type. Only PDF, JPEG, PNG, and WebP are allowed.' };
  }

  if (isPdf && file.size > 15 * 1024 * 1024) {
    return { ok: false, reason: 'PDF file is too large. Maximum size is 15MB.' };
  }

  if (isImage) {
    if (!options?.isCompressed) {
      if (file.size > 20 * 1024 * 1024) {
        return { ok: false, reason: 'Image file is too large. Maximum size is 20MB.' };
      }
    } else {
      if (file.size > 950 * 1024) {
        return { ok: false, reason: 'Compression failed to bring image size under 950KB.' };
      }
    }
  }

  return { ok: true };
}
