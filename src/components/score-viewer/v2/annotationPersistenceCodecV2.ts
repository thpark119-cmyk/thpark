import type {
  AnnotationPersistenceDocumentV2,
  AnnotationPersistenceIdentityV2,
  PersistedAnnotationPageV2,
  PersistedAnnotationPointV2,
  PersistedAnnotationStrokeV2
} from './annotationPersistenceTypesV2';
import { MIO_SCORE_ANNOTATION_WIRE_SCHEMA_VERSION_V2 } from './annotationPersistenceTypesV2';

import type {
  AnnotationCompletedStrokeV2
} from './annotationTypesV2';

export const ANNOTATION_PERSISTENCE_MAX_JSON_BYTES_V2 = 8 * 1024 * 1024;
export const ANNOTATION_PERSISTENCE_MAX_PAGES_V2 = 2000;
export const ANNOTATION_PERSISTENCE_MAX_STROKES_V2 = 50000;
export const ANNOTATION_PERSISTENCE_MAX_POINTS_PER_STROKE_V2 = 50000;
export const ANNOTATION_PERSISTENCE_MAX_TOTAL_POINTS_V2 = 1000000;

export interface CreateAnnotationPersistenceDocumentInputV2 {
  identity: AnnotationPersistenceIdentityV2;
  documentInstanceId: number;
  strokes: readonly AnnotationCompletedStrokeV2[];
  createdAt: string;
  updatedAt: string;
}

export function createAnnotationPersistenceDocumentV2(
  input: CreateAnnotationPersistenceDocumentInputV2
): AnnotationPersistenceDocumentV2 {
  const pages: Record<string, PersistedAnnotationPageV2> = {};

  for (let i = 0; i < input.strokes.length; i++) {
    const stroke = input.strokes[i];
    if (stroke.documentInstanceId !== input.documentInstanceId) {
      continue;
    }

    const pageKey = String(stroke.pageNumber);
    if (!pages[pageKey]) {
      pages[pageKey] = {
        pageNumber: stroke.pageNumber,
        strokes: []
      };
    }

    const persistedStroke: PersistedAnnotationStrokeV2 = {
      id: stroke.id,
      tool: stroke.tool,
      color: stroke.style.color,
      width: stroke.style.width,
      opacity: stroke.style.opacity,
      createdAt: input.updatedAt,
      pointerType: stroke.pointerType,
      points: stroke.points.map(p => ({ x: p.x, y: p.y }))
    };

    pages[pageKey].strokes.push(persistedStroke);
  }

  const sortedPageKeys = Object.keys(pages).map(Number).sort((a, b) => a - b);
  const sortedPages: Record<string, PersistedAnnotationPageV2> = {};
  for (let i = 0; i < sortedPageKeys.length; i++) {
    const pageNumber = sortedPageKeys[i];
    sortedPages[String(pageNumber)] = pages[String(pageNumber)];
  }

  return {
    schemaVersion: MIO_SCORE_ANNOTATION_WIRE_SCHEMA_VERSION_V2,
    repertoireId: input.identity.repertoireId,
    fileId: input.identity.fileId,
    sourceStoragePath: input.identity.sourceStoragePath,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    pages: sortedPages
  };
}

export function getAnnotationPersistenceJsonByteLengthV2(
  document: AnnotationPersistenceDocumentV2
): number {
  const jsonText = JSON.stringify(document);
  return new TextEncoder().encode(jsonText).length;
}

export type AnnotationPersistenceValidationErrorCodeV2 =
  | 'invalid-json'
  | 'payload-too-large'
  | 'invalid-root'
  | 'unsupported-schema-version'
  | 'invalid-identity'
  | 'identity-mismatch'
  | 'invalid-timestamp'
  | 'invalid-pages'
  | 'invalid-page'
  | 'invalid-stroke'
  | 'duplicate-stroke-id'
  | 'invalid-point'
  | 'limit-exceeded';

export type AnnotationPersistenceParseResultV2 =
  | {
      ok: true;
      document: AnnotationPersistenceDocumentV2;
      jsonByteLength: number;
    }
  | {
      ok: false;
      code: AnnotationPersistenceValidationErrorCodeV2;
      path: string;
      message: string;
    };

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0;
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isValidTimestamp(val: unknown): val is string {
  if (!isNonEmptyString(val)) return false;
  const time = Date.parse(val);
  return !Number.isNaN(time);
}

export function parseAnnotationPersistenceValueV2(
  value: unknown,
  expectedIdentity: AnnotationPersistenceIdentityV2,
  jsonByteLength?: number
): AnnotationPersistenceParseResultV2 {
  if (!isPlainObject(value)) {
    return { ok: false, code: 'invalid-root', path: '$', message: 'Root must be a plain object' };
  }

  if (value.schemaVersion !== MIO_SCORE_ANNOTATION_WIRE_SCHEMA_VERSION_V2) {
    return { ok: false, code: 'unsupported-schema-version', path: '$.schemaVersion', message: 'Unsupported schema version' };
  }

  if (!isNonEmptyString(value.repertoireId) || !isNonEmptyString(value.fileId) || !isNonEmptyString(value.sourceStoragePath)) {
    return { ok: false, code: 'invalid-identity', path: '$.identity', message: 'Missing or invalid identity fields' };
  }

  if (
    value.repertoireId !== expectedIdentity.repertoireId ||
    value.fileId !== expectedIdentity.fileId ||
    value.sourceStoragePath !== expectedIdentity.sourceStoragePath
  ) {
    return { ok: false, code: 'identity-mismatch', path: '$.identity', message: 'Identity fields do not match expected identity' };
  }

  if (!isValidTimestamp(value.createdAt) || !isValidTimestamp(value.updatedAt)) {
    return { ok: false, code: 'invalid-timestamp', path: '$.timestamps', message: 'Invalid createdAt or updatedAt' };
  }

  if (!isPlainObject(value.pages)) {
    return { ok: false, code: 'invalid-pages', path: '$.pages', message: 'Pages must be a plain object' };
  }

  const pageKeys = Object.keys(value.pages);
  if (pageKeys.length > ANNOTATION_PERSISTENCE_MAX_PAGES_V2) {
    return { ok: false, code: 'limit-exceeded', path: '$.pages', message: 'Too many pages' };
  }

  const resultPages: Record<string, PersistedAnnotationPageV2> = {};
  const strokeIds = new Set<string>();
  let totalStrokes = 0;
  let totalPoints = 0;

  for (let pIdx = 0; pIdx < pageKeys.length; pIdx++) {
    const pageKey = pageKeys[pIdx];
    const pageVal = value.pages[pageKey];
    if (!isPlainObject(pageVal)) {
      return { ok: false, code: 'invalid-page', path: `$.pages["${pageKey}"]`, message: 'Page must be a plain object' };
    }

    const pageNumberStr = String(pageVal.pageNumber);
    if (pageKey !== pageNumberStr) {
      return { ok: false, code: 'invalid-page', path: `$.pages["${pageKey}"]`, message: 'Page key must match pageNumber' };
    }

    const pageNumber = pageVal.pageNumber;
    if (!isFiniteNumber(pageNumber) || !Number.isInteger(pageNumber) || pageNumber < 1) {
      return { ok: false, code: 'invalid-page', path: `$.pages["${pageKey}"].pageNumber`, message: 'pageNumber must be a positive integer' };
    }

    const strokesArr = pageVal.strokes;
    if (!Array.isArray(strokesArr)) {
      return { ok: false, code: 'invalid-page', path: `$.pages["${pageKey}"].strokes`, message: 'strokes must be an array' };
    }

    const resultStrokes: PersistedAnnotationStrokeV2[] = [];

    for (let i = 0; i < strokesArr.length; i++) {
      const strokeVal = strokesArr[i];
      const strokePath = `$.pages["${pageKey}"].strokes[${i}]`;

      if (!isPlainObject(strokeVal)) {
        return { ok: false, code: 'invalid-stroke', path: strokePath, message: 'Stroke must be a plain object' };
      }

      const id = strokeVal.id;
      if (!isNonEmptyString(id)) {
        return { ok: false, code: 'invalid-stroke', path: `${strokePath}.id`, message: 'Stroke id must be a non-empty string' };
      }

      if (strokeIds.has(id)) {
        return { ok: false, code: 'duplicate-stroke-id', path: `${strokePath}.id`, message: 'Duplicate stroke id found' };
      }
      strokeIds.add(id);
      totalStrokes++;

      if (totalStrokes > ANNOTATION_PERSISTENCE_MAX_STROKES_V2) {
        return { ok: false, code: 'limit-exceeded', path: strokePath, message: 'Too many strokes in document' };
      }

      const tool = strokeVal.tool;
      if (tool !== 'pen' && tool !== 'highlighter') {
        return { ok: false, code: 'invalid-stroke', path: `${strokePath}.tool`, message: 'Stroke tool must be pen or highlighter' };
      }

      const color = strokeVal.color;
      if (!isNonEmptyString(color)) {
        return { ok: false, code: 'invalid-stroke', path: `${strokePath}.color`, message: 'Stroke color must be a non-empty string' };
      }

      const width = strokeVal.width;
      if (!isFiniteNumber(width) || width <= 0) {
        return { ok: false, code: 'invalid-stroke', path: `${strokePath}.width`, message: 'Stroke width must be a positive number' };
      }

      const opacity = strokeVal.opacity;
      if (!isFiniteNumber(opacity) || opacity < 0 || opacity > 1) {
        return { ok: false, code: 'invalid-stroke', path: `${strokePath}.opacity`, message: 'Stroke opacity must be between 0 and 1' };
      }

      const createdAt = strokeVal.createdAt;
      if (!isValidTimestamp(createdAt)) {
        return { ok: false, code: 'invalid-timestamp', path: `${strokePath}.createdAt`, message: 'Invalid stroke createdAt' };
      }

      const pointerType = strokeVal.pointerType;
      if (pointerType !== undefined && pointerType !== 'mouse' && pointerType !== 'pen' && pointerType !== 'touch') {
        return { ok: false, code: 'invalid-stroke', path: `${strokePath}.pointerType`, message: 'Invalid pointerType' };
      }

      const pointsArr = strokeVal.points;
      if (!Array.isArray(pointsArr) || pointsArr.length === 0) {
        return { ok: false, code: 'invalid-stroke', path: `${strokePath}.points`, message: 'Points must be a non-empty array' };
      }

      if (pointsArr.length > ANNOTATION_PERSISTENCE_MAX_POINTS_PER_STROKE_V2) {
        return { ok: false, code: 'limit-exceeded', path: `${strokePath}.points`, message: 'Too many points in stroke' };
      }

      const resultPoints: PersistedAnnotationPointV2[] = [];
      for (let j = 0; j < pointsArr.length; j++) {
        const pVal = pointsArr[j];
        const pPath = `${strokePath}.points[${j}]`;

        if (!isPlainObject(pVal)) {
          return { ok: false, code: 'invalid-point', path: pPath, message: 'Point must be a plain object' };
        }

        const x = pVal.x;
        const y = pVal.y;
        if (!isFiniteNumber(x) || x < 0 || x > 1) {
          return { ok: false, code: 'invalid-point', path: `${pPath}.x`, message: 'x must be between 0 and 1' };
        }
        if (!isFiniteNumber(y) || y < 0 || y > 1) {
          return { ok: false, code: 'invalid-point', path: `${pPath}.y`, message: 'y must be between 0 and 1' };
        }

        const resultPoint: PersistedAnnotationPointV2 = { x, y };

        if (pVal.pressure !== undefined) {
          const pressure = pVal.pressure;
          if (!isFiniteNumber(pressure) || pressure < 0 || pressure > 1) {
            return { ok: false, code: 'invalid-point', path: `${pPath}.pressure`, message: 'pressure must be between 0 and 1' };
          }
          resultPoint.pressure = pressure;
        }

        resultPoints.push(resultPoint);
        totalPoints++;

        if (totalPoints > ANNOTATION_PERSISTENCE_MAX_TOTAL_POINTS_V2) {
          return { ok: false, code: 'limit-exceeded', path: pPath, message: 'Too many total points in document' };
        }
      }

      const resultStroke: PersistedAnnotationStrokeV2 = {
        id,
        tool: tool as 'pen' | 'highlighter',
        color,
        width,
        opacity,
        createdAt: createdAt as string,
        points: resultPoints,
      };

      if (pointerType !== undefined) {
        resultStroke.pointerType = pointerType as 'mouse' | 'pen' | 'touch';
      }

      resultStrokes.push(resultStroke);
    }

    resultPages[pageKey] = {
      pageNumber,
      strokes: resultStrokes,
    };
  }

  const resultDocument: AnnotationPersistenceDocumentV2 = {
    schemaVersion: MIO_SCORE_ANNOTATION_WIRE_SCHEMA_VERSION_V2,
    repertoireId: expectedIdentity.repertoireId,
    fileId: expectedIdentity.fileId,
    sourceStoragePath: expectedIdentity.sourceStoragePath,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
    pages: resultPages,
  };

  return {
    ok: true,
    document: resultDocument,
    jsonByteLength: jsonByteLength ?? getAnnotationPersistenceJsonByteLengthV2(resultDocument),
  };
}

export function parseAnnotationPersistenceJsonV2(
  jsonText: string,
  expectedIdentity: AnnotationPersistenceIdentityV2
): AnnotationPersistenceParseResultV2 {
  const byteLength = new TextEncoder().encode(jsonText).length;
  if (byteLength > ANNOTATION_PERSISTENCE_MAX_JSON_BYTES_V2) {
    return {
      ok: false,
      code: 'payload-too-large',
      path: '$',
      message: 'JSON payload exceeds maximum allowed byte length'
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(jsonText);
  } catch (err) {
    return {
      ok: false,
      code: 'invalid-json',
      path: '$',
      message: 'Failed to parse JSON string'
    };
  }

  return parseAnnotationPersistenceValueV2(value, expectedIdentity, byteLength);
}

export function restoreAnnotationCompletedStrokesV2(
  document: AnnotationPersistenceDocumentV2,
  documentInstanceId: number
): AnnotationCompletedStrokeV2[] {
  const result: AnnotationCompletedStrokeV2[] = [];

  const pageKeys = Object.keys(document.pages).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < pageKeys.length; i++) {
    const pageNumber = pageKeys[i];
    const page = document.pages[String(pageNumber)];
    
    for (let j = 0; j < page.strokes.length; j++) {
      const stroke = page.strokes[j];
      const restoredStroke: AnnotationCompletedStrokeV2 = {
        id: stroke.id,
        documentInstanceId,
        pageNumber: page.pageNumber,
        tool: stroke.tool,
        style: {
          color: stroke.color,
          width: stroke.width,
          opacity: stroke.opacity,
        },
        pointerType: stroke.pointerType ?? 'mouse',
        points: stroke.points.map(p => ({ x: p.x, y: p.y }))
      };
      result.push(restoredStroke);
    }
  }

  return result;
}
