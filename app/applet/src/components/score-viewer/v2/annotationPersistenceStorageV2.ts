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

export interface AnnotationPersistenceStorageKeyV2 {
  uid: string;
  identity: AnnotationPersistenceIdentityV2;
}

export interface SaveAnnotationPersistenceDocumentInputV2 extends AnnotationPersistenceStorageKeyV2 {
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

function isValidPathSegment(segment: string): boolean {
  return (
    typeof segment === 'string' &&
    segment.length > 0 &&
    segment.trim() === segment &&
    !segment.includes('/')
  );
}

export function buildAnnotationPersistenceStoragePathV2(
  key: AnnotationPersistenceStorageKeyV2
): string {
  if (
    !isValidPathSegment(key.uid) ||
    !isValidPathSegment(key.identity.repertoireId) ||
    !isValidPathSegment(key.identity.fileId)
  ) {
    throw new Error('Invalid annotation persistence storage key.');
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

function getStorageErrorMessageV2(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function saveAnnotationPersistenceDocumentV2(
  input: SaveAnnotationPersistenceDocumentInputV2
): Promise<AnnotationPersistenceStorageSaveResultV2> {
  let storagePath = '';
  try {
    storagePath = buildAnnotationPersistenceStoragePathV2(input);
  } catch (error) {
    return {
      status: 'error',
      storagePath: null,
      code: 'invalid-storage-key',
      message: getStorageErrorMessageV2(error)
    };
  }

  if (!storage) {
    return {
      status: 'error',
      storagePath,
      code: 'storage-not-ready',
      message: 'Firebase Storage is not initialized.'
    };
  }

  const jsonText = JSON.stringify(input.document);
  const validation = parseAnnotationPersistenceJsonV2(jsonText, input.identity);

  if (validation.ok === false) {
    return {
      status: 'invalid',
      storagePath,
      code: validation.code,
      path: validation.path,
      message: validation.message
    };
  }

  const canonicalJsonText = JSON.stringify(validation.document);
  const bytes = new TextEncoder().encode(canonicalJsonText);

  if (bytes.byteLength > ANNOTATION_PERSISTENCE_MAX_JSON_BYTES_V2) {
    return {
      status: 'invalid',
      storagePath,
      code: 'payload-too-large',
      path: '$',
      message: 'JSON payload exceeds maximum allowed byte length'
    };
  }

  const storageRef = ref(storage, storagePath);

  try {
    await uploadBytes(storageRef, bytes, {
      contentType: 'application/json'
    });
  } catch (error) {
    const firebaseCode = getStorageErrorCodeV2(error);
    return {
      status: 'error',
      storagePath,
      code: firebaseCode ?? 'storage/upload-failed',
      message: getStorageErrorMessageV2(error)
    };
  }

  return {
    status: 'saved',
    storagePath,
    jsonByteLength: bytes.byteLength
  };
}

export async function loadAnnotationPersistenceDocumentV2(
  key: AnnotationPersistenceStorageKeyV2
): Promise<AnnotationPersistenceStorageLoadResultV2> {
  let storagePath = '';
  try {
    storagePath = buildAnnotationPersistenceStoragePathV2(key);
  } catch (error) {
    return {
      status: 'error',
      storagePath: null,
      code: 'invalid-storage-key',
      message: getStorageErrorMessageV2(error)
    };
  }

  if (!storage) {
    return {
      status: 'error',
      storagePath,
      code: 'storage-not-ready',
      message: 'Firebase Storage is not initialized.'
    };
  }

  const storageRef = ref(storage, storagePath);
  let arrayBuffer: ArrayBuffer;

  try {
    arrayBuffer = await getBytes(storageRef, ANNOTATION_PERSISTENCE_MAX_JSON_BYTES_V2);
  } catch (error) {
    const firebaseCode = getStorageErrorCodeV2(error);

    if (firebaseCode === 'storage/object-not-found') {
      return {
        status: 'not-found',
        storagePath
      };
    }

    if (firebaseCode === 'storage/max-download-size-exceeded') {
      return {
        status: 'invalid',
        storagePath,
        code: 'payload-too-large',
        path: '$',
        message: 'Stored annotation payload exceeds maximum allowed byte length'
      };
    }

    return {
      status: 'error',
      storagePath,
      code: firebaseCode ?? 'storage/download-failed',
      message: getStorageErrorMessageV2(error)
    };
  }

  if (arrayBuffer.byteLength === 0) {
    return {
      status: 'invalid',
      storagePath,
      code: 'invalid-json',
      path: '$',
      message: 'Stored annotation JSON is empty'
    };
  }

  let jsonText = '';
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    jsonText = decoder.decode(arrayBuffer);
  } catch (error) {
    return {
      status: 'invalid',
      storagePath,
      code: 'invalid-json',
      path: '$',
      message: 'Stored annotation data is not valid UTF-8 JSON'
    };
  }

  if (jsonText.trim() === '') {
    return {
      status: 'invalid',
      storagePath,
      code: 'invalid-json',
      path: '$',
      message: 'Stored annotation JSON is empty'
    };
  }

  const parseResult = parseAnnotationPersistenceJsonV2(jsonText, key.identity);

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
}
