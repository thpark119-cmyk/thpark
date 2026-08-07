import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../../lib/firebase';
import {
  ANNOTATION_PERSISTENCE_MAX_JSON_BYTES_V2,
  parseAnnotationPersistenceJsonV2
} from './annotationPersistenceCodecV2';
import type { AnnotationPersistenceValidationErrorCodeV2 } from './annotationPersistenceCodecV2';
import type {
  AnnotationPersistenceDocumentV2,
  AnnotationPersistenceIdentityV2
} from './annotationPersistenceTypesV2';

const ANNOTATION_PERSISTENCE_CACHE_CONTROL_V2 = 'no-store, max-age=0';

export interface AnnotationPersistenceStorageKeyV2 {
  uid: string;
  identity: AnnotationPersistenceIdentityV2;
}

export interface SaveAnnotationPersistenceDocumentInputV2
  extends AnnotationPersistenceStorageKeyV2 {
  document: AnnotationPersistenceDocumentV2;
}

export interface AnnotationPersistenceStorageInvalidResultV2 {
  status: 'invalid';
  storagePath: string;
  code: AnnotationPersistenceValidationErrorCodeV2;
  path: string;
  message: string;
}

export interface AnnotationPersistenceStorageErrorResultV2 {
  status: 'error';
  storagePath: string | null;
  code: string;
  message: string;
}

export type AnnotationPersistenceStorageSaveResultV2 =
  | {
      status: 'saved';
      storagePath: string;
      jsonByteLength: number;
    }
  | AnnotationPersistenceStorageInvalidResultV2
  | AnnotationPersistenceStorageErrorResultV2;

export type AnnotationPersistenceStorageLoadResultV2 =
  | {
      status: 'loaded';
      storagePath: string;
      document: AnnotationPersistenceDocumentV2;
      jsonByteLength: number;
    }
  | {
      status: 'not-found';
      storagePath: string;
    }
  | AnnotationPersistenceStorageInvalidResultV2
  | AnnotationPersistenceStorageErrorResultV2;

function isValidSegment(segment: string): boolean {
  if (!segment || segment.trim() !== segment) {
    return false;
  }
  if (segment.includes('/') || segment.includes('\\')) {
    return false;
  }
  if (segment === '.' || segment === '..') {
    return false;
  }
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    if (code >= 0 && code <= 31) return false;
    if (code === 127) return false;
  }
  return true;
}

export function buildAnnotationPersistenceStoragePathV2(
  key: AnnotationPersistenceStorageKeyV2
): string {
  if (
    !isValidSegment(key.uid) ||
    !isValidSegment(key.identity.repertoireId) ||
    !isValidSegment(key.identity.fileId)
  ) {
    throw new Error('Invalid storage key segment');
  }

  return `users/${key.uid}/repertoire/${key.identity.repertoireId}/annotations-v2/${key.identity.fileId}/current.json`;
}

function getStorageErrorCodeV2(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return null;
}

function getErrorMessageV2(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function saveAnnotationPersistenceDocumentV2(
  input: SaveAnnotationPersistenceDocumentInputV2
): Promise<AnnotationPersistenceStorageSaveResultV2> {
  let storagePath: string;
  try {
    storagePath = buildAnnotationPersistenceStoragePathV2(input);
  } catch (error) {
    return {
      status: 'error',
      storagePath: null,
      code: 'invalid-storage-key',
      message: getErrorMessageV2(error)
    };
  }

  if (!storage) {
    return {
      status: 'error',
      storagePath,
      code: 'storage-not-ready',
      message: 'Firebase storage is not initialized'
    };
  }

  let rawJson: string;
  try {
    rawJson = JSON.stringify(input.document);
  } catch (error) {
    return {
      status: 'invalid',
      storagePath,
      code: 'invalid-json',
      path: '$',
      message: getErrorMessageV2(error)
    };
  }

  const parseResult = parseAnnotationPersistenceJsonV2(rawJson, input.identity);
  if (parseResult.ok === false) {
    return {
      status: 'invalid',
      storagePath,
      code: parseResult.code,
      path: parseResult.path,
      message: parseResult.message
    };
  }

  const canonicalDocument = parseResult.document;
  let canonicalJson: string;
  try {
    canonicalJson = JSON.stringify(canonicalDocument);
  } catch (error) {
    return {
      status: 'invalid',
      storagePath,
      code: 'invalid-json',
      path: '$',
      message: getErrorMessageV2(error)
    };
  }
  
  const utf8Bytes = new TextEncoder().encode(canonicalJson);

  if (utf8Bytes.length > ANNOTATION_PERSISTENCE_MAX_JSON_BYTES_V2) {
    return {
      status: 'invalid',
      storagePath,
      code: 'payload-too-large',
      path: '$',
      message: `Payload size (${utf8Bytes.length} bytes) exceeds limit (${ANNOTATION_PERSISTENCE_MAX_JSON_BYTES_V2} bytes)`
    };
  }

  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, utf8Bytes, {
      contentType: 'application/json',
      cacheControl: ANNOTATION_PERSISTENCE_CACHE_CONTROL_V2
    });

    return {
      status: 'saved',
      storagePath,
      jsonByteLength: utf8Bytes.length
    };
  } catch (error) {
    const code = getStorageErrorCodeV2(error) || 'storage/upload-failed';
    return {
      status: 'error',
      storagePath,
      code,
      message: getErrorMessageV2(error)
    };
  }
}

export async function loadAnnotationPersistenceDocumentV2(
  key: AnnotationPersistenceStorageKeyV2
): Promise<AnnotationPersistenceStorageLoadResultV2> {
  let storagePath: string;
  try {
    storagePath = buildAnnotationPersistenceStoragePathV2(key);
  } catch (error) {
    return {
      status: 'error',
      storagePath: null,
      code: 'invalid-storage-key',
      message: getErrorMessageV2(error)
    };
  }

  if (!storage) {
    return {
      status: 'error',
      storagePath,
      code: 'storage-not-ready',
      message: 'Firebase storage is not initialized'
    };
  }

  try {
    const storageRef = ref(storage, storagePath);
    const buffer = await getBytes(storageRef, ANNOTATION_PERSISTENCE_MAX_JSON_BYTES_V2);

    if (buffer.byteLength === 0) {
      return {
        status: 'invalid',
        storagePath,
        code: 'invalid-json',
        path: '$',
        message: 'Empty payload'
      };
    }

    const decoder = new TextDecoder('utf-8', { fatal: true });
    let rawJson: string;
    try {
      rawJson = decoder.decode(buffer);
    } catch (error) {
      return {
        status: 'invalid',
        storagePath,
        code: 'invalid-json',
        path: '$',
        message: getErrorMessageV2(error)
      };
    }

    if (!rawJson.trim()) {
      return {
        status: 'invalid',
        storagePath,
        code: 'invalid-json',
        path: '$',
        message: 'Empty or whitespace-only JSON'
      };
    }

    const parseResult = parseAnnotationPersistenceJsonV2(rawJson, key.identity);
    if (parseResult.ok === false) {
      return {
        status: 'invalid',
        storagePath,
        code: parseResult.code,
        path: parseResult.path,
        message: parseResult.message
      };
    }

    return {
      status: 'loaded',
      storagePath,
      document: parseResult.document,
      jsonByteLength: parseResult.jsonByteLength
    };
  } catch (error) {
    const code = getStorageErrorCodeV2(error);
    if (code === 'storage/object-not-found') {
      return {
        status: 'not-found',
        storagePath
      };
    }
    if (code === 'storage/max-download-size-exceeded') {
      return {
        status: 'invalid',
        storagePath,
        code: 'payload-too-large',
        path: '$',
        message: getErrorMessageV2(error)
      };
    }

    return {
      status: 'error',
      storagePath,
      code: code || 'storage/download-failed',
      message: getErrorMessageV2(error)
    };
  }
}
