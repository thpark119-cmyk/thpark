import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  loadAnnotationPersistenceDocumentV2,
  saveAnnotationPersistenceDocumentV2
} from './annotationPersistenceStorageV2';
import { useAuth } from '../../../context/AuthContext';
import { isAdminUser } from '../../../utils/admin';
import { PdfRenderEngineV2 } from './PdfRenderEngineV2';
import { PageSurfaceV2 } from './PageSurfaceV2';
import { PageSurfaceSwapInfoV2, PageSurfaceFrontInfoV2, PageSurfaceRenderEventV2 } from './pageSurfaceTypes';
import { StableGestureViewportV2 } from './StableGestureViewportV2';
import { StablePageBaselineV2, StableGestureTransformEventV2, StableGestureViewportV2Handle } from './stableGestureTypes';
import type { RenderBudgetPreviewV2 } from './renderBudgetV2';
import { PdfRenderEngineErrorV2 } from './pdfRenderTypes';
import { AnnotationSurfaceV2 } from './AnnotationSurfaceV2';
import type { 
  AnnotationPageSpaceV2, 
  AnnotationInteractionModeV2, 
  AnnotationCompletedStrokeV2, 
  AnnotationStrokeDraftV2, 
  AnnotationInputStatusV2, 
  AnnotationEraseRequestV2,
  AnnotationStrokeToolV2,
  AnnotationStrokeStyleV2
} from './annotationTypesV2';
import { ANNOTATION_DEFAULT_PEN_STYLE_V2 } from './annotationTypesV2';
import {
  calculateRenderBudgetPreviewV2,
  V2_MAX_CANVAS_PIXELS,
  V2_MAX_CANVAS_EDGE
} from './renderBudgetV2';
import {
  AnnotationHistoryStateV2,
  createEmptyHistoryV2,
  addStrokeToHistoryV2,
  eraseStrokeFromHistoryV2,
  undoPageHistoryV2,
  redoPageHistoryV2,
  getPageHistoryDepthV2
} from './annotationHistoryV2';
import {
  createAnnotationPersistenceDocumentV2,
  parseAnnotationPersistenceJsonV2,
  restoreAnnotationCompletedStrokesV2
} from './annotationPersistenceCodecV2';
import type {
  AnnotationPersistenceDocumentV2,
  AnnotationPersistenceIdentityV2
} from './annotationPersistenceTypesV2';

interface RenderErrorDiagnosticV2 {
  code: string;
  message: string;
}

const PDF_CSS_SCALE = 1;
const DEFAULT_OUTPUT_SCALE = 2;
const DETAIL_OUTPUT_SCALE = 3;
const DETAIL_PREVIEW_SCALE_THRESHOLD = 1.5;

function formatMiB(bytes: number): string {


  return (bytes / (1024 * 1024)).toFixed(1);
}

function resolveOutputScaleForPreviewScale(previewScale: number): number {
  return previewScale >= DETAIL_PREVIEW_SCALE_THRESHOLD
    ? DETAIL_OUTPUT_SCALE
    : DEFAULT_OUTPUT_SCALE;
}

interface PenColorPresetV2 {
  label: string;
  color: string;
}

const PEN_COLOR_PRESETS_V2: readonly PenColorPresetV2[] = [
  { label: '검정', color: '#111827' },
  { label: '빨강', color: '#ef4444' },
  { label: '파랑', color: '#2563eb' },
  { label: '초록', color: '#16a34a' }
];

interface PenWidthPresetV2 {
  label: string;
  width: number;
}

const PEN_WIDTH_PRESETS_V2: readonly PenWidthPresetV2[] = [
  { label: '얇게', width: 2 },
  { label: '보통', width: 3 },
  { label: '굵게', width: 5 }
];

const ANNOTATION_DEFAULT_HIGHLIGHTER_STYLE_V2: AnnotationStrokeStyleV2 = {
  color: '#fde047',
  width: 14,
  opacity: 0.35
};

interface HighlighterColorPresetV2 {
  label: string;
  color: string;
}

const HIGHLIGHTER_COLOR_PRESETS_V2: readonly HighlighterColorPresetV2[] = [
  { label: '노랑', color: '#fde047' },
  { label: '초록', color: '#4ade80' },
  { label: '분홍', color: '#f472b6' },
  { label: '파랑', color: '#60a5fa' }
];

interface HighlighterWidthPresetV2 {
  label: string;
  width: number;
}

const HIGHLIGHTER_WIDTH_PRESETS_V2: readonly HighlighterWidthPresetV2[] = [
  { label: '얇게', width: 10 },
  { label: '보통', width: 14 },
  { label: '굵게', width: 18 }
];

type PersistenceRoundTripStatusV2 = 'idle' | 'passed' | 'failed';

interface PersistenceRoundTripDiagnosticV2 {
  status: PersistenceRoundTripStatusV2;
  documentInstanceId: number | null;
  sourceStrokeCount: number;
  restoredStrokeCount: number;
  sourcePointCount: number;
  restoredPointCount: number;
  penStrokeCount: number;
  highlighterStrokeCount: number;
  jsonByteLength: number;
  codecValidationPassed: boolean;
  strokeFidelityPassed: boolean;
  identityMismatchDefensePassed: boolean;
  legacyPointerFallbackPassed: boolean | null;
  errorCode: string | null;
  errorPath: string | null;
  errorMessage: string | null;
}

function createIdlePersistenceDiagnosticV2(): PersistenceRoundTripDiagnosticV2 {
  return {
    status: 'idle',
    documentInstanceId: null,
    sourceStrokeCount: 0,
    restoredStrokeCount: 0,
    sourcePointCount: 0,
    restoredPointCount: 0,
    penStrokeCount: 0,
    highlighterStrokeCount: 0,
    jsonByteLength: 0,
    codecValidationPassed: false,
    strokeFidelityPassed: false,
    identityMismatchDefensePassed: false,
    legacyPointerFallbackPassed: null,
    errorCode: null,
    errorPath: null,
    errorMessage: null
  };
}


function createLabStorageIdentityV2(
  file: File
): AnnotationPersistenceIdentityV2 {
  const encodedFileName = encodeURIComponent(file.name);
  return {
    repertoireId: 'v2-renderer-lab',
    fileId: `local-${encodedFileName}-${file.size}-${file.lastModified}`,
    sourceStoragePath: `local-lab://${encodedFileName}?size=${file.size}&lastModified=${file.lastModified}`
  };
}

type PersistenceStorageSaveStatusV2 =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'invalid'
  | 'error';

interface PersistenceStorageSaveDiagnosticV2 {
  status: PersistenceStorageSaveStatusV2;
  documentInstanceId: number | null;
  storagePath: string | null;
  sourceStrokeCount: number;
  sourcePointCount: number;
  jsonByteLength: number;
  errorCode: string | null;
  errorPath: string | null;
  errorMessage: string | null;
}

function createIdlePersistenceStorageSaveDiagnosticV2(): PersistenceStorageSaveDiagnosticV2 {
  return {
    status: 'idle',
    documentInstanceId: null,
    storagePath: null,
    sourceStrokeCount: 0,
    sourcePointCount: 0,
    jsonByteLength: 0,
    errorCode: null,
    errorPath: null,
    errorMessage: null
  };
}

type PersistenceStorageLoadStatusV2 =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'not-found'
  | 'invalid'
  | 'error';


type PersistenceStorageLoadOriginV2 = 'manual' | 'automatic';

type AutomaticSnapshotLookupStatusV2 =
  | 'idle'
  | 'looking-up'
  | 'found'
  | 'not-found'
  | 'invalid'
  | 'error';

interface AutomaticSnapshotLookupDiagnosticV2 {
  status: AutomaticSnapshotLookupStatusV2;
  documentInstanceId: number | null;
  storagePath: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

function createIdleAutomaticSnapshotLookupDiagnosticV2(): AutomaticSnapshotLookupDiagnosticV2 {
  return {
    status: 'idle',
    documentInstanceId: null,
    storagePath: null,
    errorCode: null,
    errorMessage: null
  };
}

interface PersistenceStorageLoadDiagnosticV2 {
  status: PersistenceStorageLoadStatusV2;
  currentDocumentInstanceId: number | null;
  persistedDocumentInstanceId: number | null;
  storagePath: string | null;
  loadedPageCount: number;
  loadedStrokeCount: number;
  loadedPointCount: number;
  loadedPenStrokeCount: number;
  loadedHighlighterStrokeCount: number;
  jsonByteLength: number;
  codecValidationPassed: boolean;
  identityValidationPassed: boolean;
  currentMemoryFidelityStatus: 'not-run' | 'pass' | 'mismatch';
  errorCode: string | null;
  errorPath: string | null;
  errorMessage: string | null;
}

function createIdlePersistenceStorageLoadDiagnosticV2(): PersistenceStorageLoadDiagnosticV2 {
  return {
    status: 'idle',
    currentDocumentInstanceId: null,
    persistedDocumentInstanceId: null,
    storagePath: null,
    loadedPageCount: 0,
    loadedStrokeCount: 0,
    loadedPointCount: 0,
    loadedPenStrokeCount: 0,
    loadedHighlighterStrokeCount: 0,
    jsonByteLength: 0,
    codecValidationPassed: false,
    identityValidationPassed: false,
    currentMemoryFidelityStatus: 'not-run',
    errorCode: null,
    errorPath: null,
    errorMessage: null
  };
}


type AutomaticSnapshotRestoreStatusV2 =
  | 'idle'
  | 'waiting'
  | 'restoring'
  | 'restored'
  | 'skipped'
  | 'blocked'
  | 'error';

interface AutomaticSnapshotRestoreDiagnosticV2 {
  status: AutomaticSnapshotRestoreStatusV2;
  documentInstanceId: number | null;
  storagePath: string | null;
  reason: string | null;
}

function createIdleAutomaticSnapshotRestoreDiagnosticV2(): AutomaticSnapshotRestoreDiagnosticV2 {
  return {
    status: 'idle',
    documentInstanceId: null,
    storagePath: null,
    reason: null
  };
}

interface LoadedAnnotationSnapshotV2 {
  loadOrigin: PersistenceStorageLoadOriginV2;
  uid: string;
  identity: AnnotationPersistenceIdentityV2;
  storagePath: string;
  document: AnnotationPersistenceDocumentV2;
  jsonByteLength: number;
}

type AnnotationSnapshotRestoreOriginV2 = 'manual' | 'automatic';

type AnnotationRestoreStatusV2 =
  | 'idle'
  | 'ready'
  | 'restoring'
  | 'restored'
  | 'cancelled'
  | 'blocked'
  | 'error';

interface AnnotationRestoreDiagnosticV2 {
  status: AnnotationRestoreStatusV2;
  storagePath: string | null;
  loadedStrokeCount: number;
  loadedPointCount: number;
  beforeStrokeCount: number;
  restoredStrokeCount: number;
  restoredPointCount: number;
  currentDocumentInstanceId: number | null;
  undoDepthAfterRestore: number;
  redoDepthAfterRestore: number;
  nextStrokeIdCounter: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

function createIdleAnnotationRestoreDiagnosticV2(): AnnotationRestoreDiagnosticV2 {
  return {
    status: 'idle',
    storagePath: null,
    loadedStrokeCount: 0,
    loadedPointCount: 0,
    beforeStrokeCount: 0,
    restoredStrokeCount: 0,
    restoredPointCount: 0,
    currentDocumentInstanceId: null,
    undoDepthAfterRestore: 0,
    redoDepthAfterRestore: 0,
    nextStrokeIdCounter: null,
    errorCode: null,
    errorMessage: null
  };
}


type AnnotationPersistenceDirtyStatusV2 =
  | 'unavailable'
  | 'clean'
  | 'dirty';

type AnnotationCleanBaselineSourceV2 =
  | 'initial-empty'
  | 'saved'
  | 'restored';

interface AnnotationCleanBaselineV2 {
  uid: string | null;
  identity: AnnotationPersistenceIdentityV2;
  documentInstanceId: number;
  source: AnnotationCleanBaselineSourceV2;
  strokes: readonly AnnotationCompletedStrokeV2[];
}


const ANNOTATION_AUTOSAVE_DEBOUNCE_MS_V2 = 2000;
const ANNOTATION_PERSISTENCE_BROADCAST_CHANNEL_V2 = 'mio-annotation-persistence-v2';

type AnnotationPersistenceSaveOriginV2 = 'manual' | 'autosave';
type AnnotationAutosaveEligibilityStatusV2 =
  | 'unavailable'
  | 'clean'
  | 'blocked'
  | 'waiting'
  | 'scheduled'
  | 'ready';

type AnnotationAutosaveEligibilityReasonV2 =
  | 'identity-unavailable'
  | 'dirty-state-unavailable'
  | 'document-loading'
  | 'annotation-input-active'
  | 'gesture-active'
  | 'persistence-busy'
  | 'snapshot-decision-pending'
  | 'manual-snapshot-ready'
  | 'remote-snapshot-invalid'
  | 'remote-snapshot-error'
  | 'automatic-restore-blocked'
  | 'automatic-restore-error'
  | 'remote-tab-change-detected'
  | 'autosave-save-invalid'
  | 'autosave-save-error';

interface AnnotationAutosaveEligibilityDiagnosticV2 {
  status: AnnotationAutosaveEligibilityStatusV2;
  reason: AnnotationAutosaveEligibilityReasonV2 | null;
  documentInstanceId: number | null;
  debounceMs: number;
  scheduledStrokeCount: number;
  scheduledPointCount: number;
  scheduleSequence: number;
}

interface AnnotationLifecycleAutosaveRequestDiagnosticV2 {
  trigger: 'visibility-hidden' | 'visibility-visible-retry' | 'pagehide' | null;
  requestedAt: string | null;
  documentInstanceId: number | null;
  scheduleSequence: number | null;
}

interface AnnotationPersistenceSavedBroadcastMessageV2 {
  kind: 'annotation-persistence-saved-v2';
  senderId: string;
  uid: string;
  identity: AnnotationPersistenceIdentityV2;
  updatedAt: string;
}

type RemoteTabChangeMonitorStatusV2 =
  | 'unavailable'
  | 'listening'
  | 'detected'
  | 'error';

interface RemoteTabChangeDiagnosticV2 {
  status: RemoteTabChangeMonitorStatusV2;
  remoteSenderId: string | null;
  remoteUpdatedAt: string | null;
  errorMessage: string | null;
}

function createUnavailableAnnotationAutosaveEligibilityDiagnosticV2(): AnnotationAutosaveEligibilityDiagnosticV2 {
  return {
    status: 'unavailable',
    reason: 'identity-unavailable',
    documentInstanceId: null,
    debounceMs: ANNOTATION_AUTOSAVE_DEBOUNCE_MS_V2,
    scheduledStrokeCount: 0,
    scheduledPointCount: 0,
    scheduleSequence: 0
  };
}

function createIdleAnnotationLifecycleAutosaveRequestDiagnosticV2(): AnnotationLifecycleAutosaveRequestDiagnosticV2 {
  return {
    trigger: null,
    requestedAt: null,
    documentInstanceId: null,
    scheduleSequence: null
  };
}

function createUnavailableRemoteTabChangeDiagnosticV2(): RemoteTabChangeDiagnosticV2 {
  return {
    status: 'unavailable',
    remoteSenderId: null,
    remoteUpdatedAt: null,
    errorMessage: null
  };
}

function createListeningRemoteTabChangeDiagnosticV2(): RemoteTabChangeDiagnosticV2 {
  return {
    status: 'listening',
    remoteSenderId: null,
    remoteUpdatedAt: null,
    errorMessage: null
  };
}

function isBroadcastRecordV2(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAnnotationPersistenceSavedBroadcastMessageV2(
  value: unknown
): value is AnnotationPersistenceSavedBroadcastMessageV2 {
  if (!isBroadcastRecordV2(value) || !isBroadcastRecordV2(value.identity)) {
    return false;
  }

  return (
    value.kind === 'annotation-persistence-saved-v2' &&
    typeof value.senderId === 'string' && value.senderId.length > 0 &&
    typeof value.uid === 'string' && value.uid.length > 0 &&
    typeof value.updatedAt === 'string' && value.updatedAt.length > 0 &&
    typeof value.identity.repertoireId === 'string' && value.identity.repertoireId.length > 0 &&
    typeof value.identity.fileId === 'string' && value.identity.fileId.length > 0 &&
    typeof value.identity.sourceStoragePath === 'string' && value.identity.sourceStoragePath.length > 0
  );
}

function arePersistenceRoundTripStrokesEqualV2(
  source: readonly AnnotationCompletedStrokeV2[],
  restored: readonly AnnotationCompletedStrokeV2[]
): boolean {
  if (source.length !== restored.length) {
    return false;
  }

  const sortedSource = source
    .map((stroke, originalIndex) => ({ stroke, originalIndex }))
    .sort((a, b) =>
      a.stroke.pageNumber - b.stroke.pageNumber ||
      a.originalIndex - b.originalIndex
    )
    .map(item => item.stroke);

  for (let i = 0; i < sortedSource.length; i++) {
    const s = sortedSource[i];
    const r = restored[i];

    if (
      s.id !== r.id ||
      s.documentInstanceId !== r.documentInstanceId ||
      s.pageNumber !== r.pageNumber ||
      s.tool !== r.tool ||
      s.style.color !== r.style.color ||
      s.style.width !== r.style.width ||
      s.style.opacity !== r.style.opacity ||
      s.pointerType !== r.pointerType ||
      s.points.length !== r.points.length
    ) {
      return false;
    }

    for (let j = 0; j < s.points.length; j++) {
      if (s.points[j].x !== r.points[j].x || s.points[j].y !== r.points[j].y) {
        return false;
      }
    }
  }

  return true;
}

export default function V2GestureBaselineLab() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const engineRef = useRef<PdfRenderEngineV2 | null>(null);
  const [docReady, setDocReady] = useState(false);
  const [docName, setDocName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const mountedRef = useRef(true);
  const loadSequenceRef = useRef(0);
  const documentInstanceIdRef = useRef(0);
  
  const [stats, setStats] = useState({
    completed: 0,
    swaps: 0,
    errors: 0,
    cancelled: 0,
    stale: 0
  });

  const [lastRenderResult, setLastRenderResult] = useState<PageSurfaceRenderEventV2['result'] | null>(null);
  const [lastRenderError, setLastRenderError] = useState<RenderErrorDiagnosticV2 | null>(null);

  const [frontInfo, setFrontInfo] = useState<PageSurfaceFrontInfoV2 | null>(null);
  const baselineMapRef = useRef(new Map<string, StablePageBaselineV2>());
  const [currentBaseline, setCurrentBaseline] = useState<StablePageBaselineV2 | null>(null);
  
  const [pageNumber, setPageNumber] = useState(1);
  const targetPageRef = useRef(1);
  
  const [targetOutputScale, setTargetOutputScale] = useState(DEFAULT_OUTPUT_SCALE);
  const [renderFailed, setRenderFailed] = useState(false);
  
  const viewportRef = useRef<StableGestureViewportV2Handle>(null);
  const [transformInfo, setTransformInfo] = useState<StableGestureTransformEventV2 | null>(null);

  const [interactionMode, setInteractionMode] = useState<AnnotationInteractionModeV2>('navigate');
  const [activeDrawingTool, setActiveDrawingTool] = useState<AnnotationStrokeToolV2>('pen');
  const [activePenStyle, setActivePenStyle] = useState<AnnotationStrokeStyleV2>(() => ({
    color: ANNOTATION_DEFAULT_PEN_STYLE_V2.color,
    width: ANNOTATION_DEFAULT_PEN_STYLE_V2.width,
    opacity: ANNOTATION_DEFAULT_PEN_STYLE_V2.opacity
  }));
  const [activeHighlighterStyle, setActiveHighlighterStyle] = useState<AnnotationStrokeStyleV2>(() => ({
    color: ANNOTATION_DEFAULT_HIGHLIGHTER_STYLE_V2.color,
    width: ANNOTATION_DEFAULT_HIGHLIGHTER_STYLE_V2.width,
    opacity: ANNOTATION_DEFAULT_HIGHLIGHTER_STYLE_V2.opacity
  }));
  const [annotationHistory, setAnnotationHistory] = useState<AnnotationHistoryStateV2>(createEmptyHistoryV2);
  const strokeIdCounterRef = useRef(1);
  const [inputStatus, setInputStatus] = useState<AnnotationInputStatusV2>({
    phase: 'idle',
    activePointerId: null,
    activePointerType: null,
    currentPointCount: 0,
    touchSuppressedUntilRelease: false
  });
  
  const [persistenceDiagnostic, setPersistenceDiagnostic] = useState<PersistenceRoundTripDiagnosticV2>(createIdlePersistenceDiagnosticV2);

  useEffect(() => {
    setPersistenceDiagnostic(createIdlePersistenceDiagnosticV2());
  }, [annotationHistory.completedStrokes]);

  const handleRunPersistenceRoundTrip = () => {
    if (!docReady || !currentBaseline || isLoading || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null) return;
    if (transformInfo && (transformInfo.phase !== 'idle' || transformInfo.activePointerCount > 0)) return;

    try {
      const now = new Date().toISOString();
      const identity: AnnotationPersistenceIdentityV2 = {
        repertoireId: 'v2-renderer-lab',
        fileId: `local-document-${documentInstanceIdRef.current}`,
        sourceStoragePath: `local-lab://${docName || 'unnamed.pdf'}`
      };

      const sourceStrokes = annotationHistory.completedStrokes.filter(
        stroke => stroke.documentInstanceId === documentInstanceIdRef.current
      );

      const doc = createAnnotationPersistenceDocumentV2({
        identity,
        documentInstanceId: documentInstanceIdRef.current,
        strokes: sourceStrokes,
        createdAt: now,
        updatedAt: now
      });

      const jsonString = JSON.stringify(doc);
      
      const parseResult = parseAnnotationPersistenceJsonV2(jsonString, identity);
      
      let codecValidationPassed = false;
      let strokeFidelityPassed = false;
      let restoredStrokes: AnnotationCompletedStrokeV2[] = [];
      let jsonByteLength = 0;
      let errorCode: string | null = null;
      let errorPath: string | null = null;
      let errorMessage: string | null = null;

      if (parseResult.ok === true) {
        codecValidationPassed = true;
        jsonByteLength = parseResult.jsonByteLength;
        restoredStrokes = restoreAnnotationCompletedStrokesV2(parseResult.document, documentInstanceIdRef.current);
        strokeFidelityPassed = arePersistenceRoundTripStrokesEqualV2(sourceStrokes, restoredStrokes);
      } else {
        errorCode = parseResult.code;
        errorPath = parseResult.path;
        errorMessage = parseResult.message;
      }

      const mismatchedIdentity: AnnotationPersistenceIdentityV2 = {
        ...identity,
        fileId: `${identity.fileId}-mismatch`
      };
      const mismatchResult = parseAnnotationPersistenceJsonV2(jsonString, mismatchedIdentity);
      const identityMismatchDefensePassed = mismatchResult.ok === false && mismatchResult.code === 'identity-mismatch';

      let legacyPointerFallbackPassed: boolean | null = null;
      if (sourceStrokes.length > 0) {
        const firstStroke = sourceStrokes[0];
        const legacyDocument: AnnotationPersistenceDocumentV2 = {
          schemaVersion: 1,
          repertoireId: identity.repertoireId,
          fileId: identity.fileId,
          sourceStoragePath: identity.sourceStoragePath,
          createdAt: now,
          updatedAt: now,
          pages: {
            [String(firstStroke.pageNumber)]: {
              pageNumber: firstStroke.pageNumber,
              strokes: [
                {
                  id: `${firstStroke.id}-legacy-pointer`,
                  tool: firstStroke.tool,
                  color: firstStroke.style.color,
                  width: firstStroke.style.width,
                  opacity: firstStroke.style.opacity,
                  createdAt: now,
                  points: firstStroke.points.map(point => ({ x: point.x, y: point.y }))
                }
              ]
            }
          }
        };

        const legacyJson = JSON.stringify(legacyDocument);
        const legacyResult = parseAnnotationPersistenceJsonV2(legacyJson, identity);
        if (legacyResult.ok) {
          const legacyRestored = restoreAnnotationCompletedStrokesV2(legacyResult.document, documentInstanceIdRef.current);
          if (legacyRestored.length === 1 && legacyRestored[0].pointerType === 'mouse') {
            legacyPointerFallbackPassed = true;
          } else {
            legacyPointerFallbackPassed = false;
          }
        } else {
          legacyPointerFallbackPassed = false;
        }
      }

      const passed = codecValidationPassed && strokeFidelityPassed && identityMismatchDefensePassed && (legacyPointerFallbackPassed === true || legacyPointerFallbackPassed === null);

      let sourcePointCount = 0;
      let penStrokeCount = 0;
      let highlighterStrokeCount = 0;
      sourceStrokes.forEach(s => {
        sourcePointCount += s.points.length;
        if (s.tool === 'pen') penStrokeCount++;
        if (s.tool === 'highlighter') highlighterStrokeCount++;
      });

      let restoredPointCount = 0;
      restoredStrokes.forEach(s => {
        restoredPointCount += s.points.length;
      });

      setPersistenceDiagnostic({
        status: passed ? 'passed' : 'failed',
        documentInstanceId: documentInstanceIdRef.current,
        sourceStrokeCount: sourceStrokes.length,
        restoredStrokeCount: restoredStrokes.length,
        sourcePointCount,
        restoredPointCount,
        penStrokeCount,
        highlighterStrokeCount,
        jsonByteLength,
        codecValidationPassed,
        strokeFidelityPassed,
        identityMismatchDefensePassed,
        legacyPointerFallbackPassed,
        errorCode,
        errorPath,
        errorMessage
      });

    } catch (error) {
      setPersistenceDiagnostic(prev => ({
        ...prev,
        status: 'failed',
        errorCode: 'exception',
        errorMessage: error instanceof Error ? error.message : String(error)
      }));
    }
  };
  
  

  const [persistenceStorageIdentity, setPersistenceStorageIdentity] = useState<AnnotationPersistenceIdentityV2 | null>(null);
  const [persistenceStorageSaveDiagnostic, setPersistenceStorageSaveDiagnostic] = useState<PersistenceStorageSaveDiagnosticV2>(createIdlePersistenceStorageSaveDiagnosticV2());
  const [persistenceStorageLoadDiagnostic, setPersistenceStorageLoadDiagnostic] = useState<PersistenceStorageLoadDiagnosticV2>(createIdlePersistenceStorageLoadDiagnosticV2());

  const [loadedAnnotationSnapshot, setLoadedAnnotationSnapshot] = useState<LoadedAnnotationSnapshotV2 | null>(null);
  const [annotationRestoreDiagnostic, setAnnotationRestoreDiagnostic] = useState<AnnotationRestoreDiagnosticV2>(createIdleAnnotationRestoreDiagnosticV2());
  const [annotationCleanBaseline, setAnnotationCleanBaseline] = useState<AnnotationCleanBaselineV2 | null>(null);

  const [automaticSnapshotLookupDiagnostic, setAutomaticSnapshotLookupDiagnostic] = useState<AutomaticSnapshotLookupDiagnosticV2>(createIdleAutomaticSnapshotLookupDiagnosticV2());
  const automaticSnapshotLookupAttemptKeyRef = useRef<string | null>(null);

  const storageSaveSequenceRef = useRef(0);
  const storageLoadSequenceRef = useRef(0);
  const [annotationPersistenceBroadcastSenderId] = useState(() => crypto.randomUUID());
  const annotationPersistenceBroadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const [remoteTabChangeDiagnostic, setRemoteTabChangeDiagnostic] = useState<RemoteTabChangeDiagnosticV2>(createUnavailableRemoteTabChangeDiagnosticV2());



  const activeDrawingStyle = activeDrawingTool === 'highlighter' ? activeHighlighterStyle : activePenStyle;

  const currentDocumentStrokes = useMemo(() => {
    return annotationHistory.completedStrokes.filter(
      stroke => stroke.documentInstanceId === documentInstanceIdRef.current
    );
  }, [annotationHistory.completedStrokes]);


  const [automaticSnapshotRestoreDiagnostic, setAutomaticSnapshotRestoreDiagnostic] = useState<AutomaticSnapshotRestoreDiagnosticV2>(createIdleAutomaticSnapshotRestoreDiagnosticV2());
  const [autosaveEligibilityDiagnostic, setAutosaveEligibilityDiagnostic] = useState<AnnotationAutosaveEligibilityDiagnosticV2>(createUnavailableAnnotationAutosaveEligibilityDiagnosticV2());
  const [lifecycleAutosaveRequestDiagnostic, setLifecycleAutosaveRequestDiagnostic] = useState<AnnotationLifecycleAutosaveRequestDiagnosticV2>(createIdleAnnotationLifecycleAutosaveRequestDiagnosticV2());
  const annotationAutosaveTimerRef = useRef<number | null>(null);
  const annotationAutosaveScheduleSequenceRef = useRef(0);
  const lifecycleAutosaveRetryPendingRef = useRef(false);
  const persistenceSaveInFlightRef = useRef<number | null>(null);
  const [persistenceSaveOrigin, setPersistenceSaveOrigin] = useState<AnnotationPersistenceSaveOriginV2 | null>(null);
  const lastAutosaveCommitSequenceRef = useRef<number | null>(null);
  const automaticSnapshotRestoreDecisionKeyRef = useRef<string | null>(null);

  const isGestureActive = (transformInfo?.activePointerCount ?? 0) > 0 || (transformInfo?.phase && transformInfo.phase !== 'idle');
  const { undoDepth, redoDepth } = getPageHistoryDepthV2(annotationHistory, documentInstanceIdRef.current, pageNumber);

  const annotationDirtyStatus: AnnotationPersistenceDirtyStatusV2 = useMemo(() => {
    if (!annotationCleanBaseline) return 'unavailable';
    
    // Check UID match (if user uid is undefined/null, baseline uid must be null)
    const currentUid = user?.uid ?? null;
    if (currentUid !== annotationCleanBaseline.uid) return 'unavailable';

    // Check identity match
    if (
      !persistenceStorageIdentity ||
      persistenceStorageIdentity.repertoireId !== annotationCleanBaseline.identity.repertoireId ||
      persistenceStorageIdentity.fileId !== annotationCleanBaseline.identity.fileId ||
      persistenceStorageIdentity.sourceStoragePath !== annotationCleanBaseline.identity.sourceStoragePath
    ) {
      return 'unavailable';
    }

    // Check document instance match
    if (documentInstanceIdRef.current !== annotationCleanBaseline.documentInstanceId) {
      return 'unavailable';
    }

    return arePersistenceRoundTripStrokesEqualV2(
      currentDocumentStrokes,
      annotationCleanBaseline.strokes
    ) ? 'clean' : 'dirty';
  }, [annotationCleanBaseline, currentDocumentStrokes, user, persistenceStorageIdentity]);

  const hasCurrentDocumentWork = currentDocumentStrokes.length > 0;

  const hasPersistableAnnotationState = 
    hasCurrentDocumentWork || annotationDirtyStatus === 'dirty';

  const hasCurrentAnnotationWork = 
    hasCurrentDocumentWork ||
    annotationHistory.undoStack.length > 0 ||
    annotationHistory.redoStack.length > 0;

  const shouldProtectAnnotationWork = 
    annotationDirtyStatus === 'dirty' ||
    (annotationDirtyStatus === 'unavailable' && hasCurrentDocumentWork);

  const shouldConfirmAnnotationReplacement = shouldProtectAnnotationWork;
  const browserExitGuardArmed = shouldProtectAnnotationWork;

  const guardReason = 
    annotationDirtyStatus === 'dirty'
      ? 'DIRTY'
      : (annotationDirtyStatus === 'unavailable' && hasCurrentDocumentWork)
        ? 'UNAVAILABLE WITH WORK'
        : 'NONE';

  const manualSnapshotAwaitingDecision =
    loadedAnnotationSnapshot?.loadOrigin === 'manual' &&
    annotationRestoreDiagnostic.status === 'ready';

  const automaticSnapshotDecisionPending =
    automaticSnapshotLookupDiagnostic.status === 'looking-up' ||
    (loadedAnnotationSnapshot?.loadOrigin === 'automatic' &&
      (automaticSnapshotRestoreDiagnostic.status === 'waiting' ||
       automaticSnapshotRestoreDiagnostic.status === 'restoring'));

  const isAutosaveBlockedBySnapshotState =
    manualSnapshotAwaitingDecision || automaticSnapshotDecisionPending;

  const remoteTabChangeDetected = remoteTabChangeDiagnostic.status === 'detected';

  useEffect(() => {
    if (!user?.uid || !persistenceStorageIdentity || typeof BroadcastChannel === 'undefined') {
      annotationPersistenceBroadcastChannelRef.current = null;
      setRemoteTabChangeDiagnostic(createUnavailableRemoteTabChangeDiagnosticV2());
      return;
    }

    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(ANNOTATION_PERSISTENCE_BROADCAST_CHANNEL_V2);
    } catch (error) {
      annotationPersistenceBroadcastChannelRef.current = null;
      setRemoteTabChangeDiagnostic({
        status: 'error',
        remoteSenderId: null,
        remoteUpdatedAt: null,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    annotationPersistenceBroadcastChannelRef.current = channel;
    setRemoteTabChangeDiagnostic(createListeningRemoteTabChangeDiagnosticV2());

    const handleBroadcastMessage = (event: MessageEvent<unknown>) => {
      if (!isAnnotationPersistenceSavedBroadcastMessageV2(event.data)) return;
      if (event.data.senderId === annotationPersistenceBroadcastSenderId) return;
      if (event.data.uid !== user.uid) return;
      if (
        event.data.identity.repertoireId !== persistenceStorageIdentity.repertoireId ||
        event.data.identity.fileId !== persistenceStorageIdentity.fileId ||
        event.data.identity.sourceStoragePath !== persistenceStorageIdentity.sourceStoragePath
      ) {
        return;
      }

      setRemoteTabChangeDiagnostic({
        status: 'detected',
        remoteSenderId: event.data.senderId,
        remoteUpdatedAt: event.data.updatedAt,
        errorMessage: null
      });
    };

    channel.addEventListener('message', handleBroadcastMessage);
    return () => {
      channel.removeEventListener('message', handleBroadcastMessage);
      channel.close();
      if (annotationPersistenceBroadcastChannelRef.current === channel) {
        annotationPersistenceBroadcastChannelRef.current = null;
      }
    };
  }, [
    user?.uid,
    persistenceStorageIdentity,
    annotationPersistenceBroadcastSenderId
  ]);

  useEffect(() => {
    if (!browserExitGuardArmed) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [browserExitGuardArmed]);



  useEffect(() => {
    mountedRef.current = true;
    if (isAdmin) {
      engineRef.current = new PdfRenderEngineV2();
    }

    return () => {
      mountedRef.current = false;
      loadSequenceRef.current += 1;
      storageSaveSequenceRef.current += 1;
      storageLoadSequenceRef.current += 1;
      if (engineRef.current) {
        engineRef.current.destroy().catch(console.error);
        engineRef.current = null;
      }
    };
  }, [isAdmin]);



  useEffect(() => {
    if (persistenceSaveInFlightRef.current === null) {
      setPersistenceStorageSaveDiagnostic(createIdlePersistenceStorageSaveDiagnosticV2());
    }
  }, [annotationHistory.completedStrokes]);


  const handleSavePersistenceToStorage = async (
    origin: AnnotationPersistenceSaveOriginV2,
    autosaveScheduleSequence?: number
  ) => {
    if (!user || !user.uid) return;
    if (!docReady || !currentBaseline || !persistenceStorageIdentity) return;
    if (isLoading || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null) return;
    if (isGestureActive || (transformInfo?.activePointerCount ?? 0) > 0) return;
    if (persistenceSaveInFlightRef.current !== null) return;
    if (persistenceStorageSaveDiagnostic.status === 'saving') return;
    if (persistenceStorageLoadDiagnostic.status === 'loading') return;
    if (annotationRestoreDiagnostic.status === 'restoring') return;
    if (remoteTabChangeDetected) return;

    if (origin === 'autosave' && autosaveScheduleSequence !== undefined) {
      lastAutosaveCommitSequenceRef.current = autosaveScheduleSequence;
    }

    storageLoadSequenceRef.current += 1;
    setPersistenceStorageLoadDiagnostic(createIdlePersistenceStorageLoadDiagnosticV2());
    setLoadedAnnotationSnapshot(null);
    setAnnotationRestoreDiagnostic(createIdleAnnotationRestoreDiagnosticV2());

    const sourceStrokes = annotationHistory.completedStrokes.filter(
      stroke => stroke.documentInstanceId === documentInstanceIdRef.current
    );

    const currentSaveSeq = ++storageSaveSequenceRef.current;
    persistenceSaveInFlightRef.current = currentSaveSeq;
    setPersistenceSaveOrigin(origin);

    const currentInstanceId = documentInstanceIdRef.current;
    const currentIdentity = persistenceStorageIdentity;
    const currentUid = user.uid;

    const now = new Date().toISOString();
    const document = createAnnotationPersistenceDocumentV2({
      identity: currentIdentity,
      documentInstanceId: currentInstanceId,
      strokes: sourceStrokes,
      createdAt: now,
      updatedAt: now
    });

    let sourcePointCount = 0;
    for (const s of sourceStrokes) {
      sourcePointCount += s.points.length;
    }

    setPersistenceStorageSaveDiagnostic({
      status: 'saving',
      documentInstanceId: currentInstanceId,
      storagePath: null,
      sourceStrokeCount: sourceStrokes.length,
      sourcePointCount,
      jsonByteLength: 0,
      errorCode: null,
      errorPath: null,
      errorMessage: null
    });

    try {
      const result = await saveAnnotationPersistenceDocumentV2({
        uid: user.uid,
        identity: currentIdentity,
        document
      });

      if (!mountedRef.current) return;
      if (persistenceSaveInFlightRef.current !== currentSaveSeq) return;
      if (documentInstanceIdRef.current !== currentInstanceId) return;
      if (currentUid !== user.uid) return;
      if (!persistenceStorageIdentity) return;
      if (
        persistenceStorageIdentity.repertoireId !== currentIdentity.repertoireId ||
        persistenceStorageIdentity.fileId !== currentIdentity.fileId ||
        persistenceStorageIdentity.sourceStoragePath !== currentIdentity.sourceStoragePath
      ) {
        return;
      }

      if (result.status === 'saved') {
        setPersistenceStorageSaveDiagnostic({
          status: 'saved',
          documentInstanceId: currentInstanceId,
          storagePath: result.storagePath,
          sourceStrokeCount: sourceStrokes.length,
          sourcePointCount,
          jsonByteLength: result.jsonByteLength,
          errorCode: null,
          errorPath: null,
          errorMessage: null
        });

        setAnnotationCleanBaseline({
          uid: currentUid,
          identity: currentIdentity,
          documentInstanceId: currentInstanceId,
          source: 'saved',
          strokes: [...sourceStrokes]
        });

        const broadcastChannel = annotationPersistenceBroadcastChannelRef.current;
        if (broadcastChannel) {
          const message: AnnotationPersistenceSavedBroadcastMessageV2 = {
            kind: 'annotation-persistence-saved-v2',
            senderId: annotationPersistenceBroadcastSenderId,
            uid: currentUid,
            identity: currentIdentity,
            updatedAt: document.updatedAt
          };

          try {
            broadcastChannel.postMessage(message);
          } catch (error) {
            setRemoteTabChangeDiagnostic(prev =>
              prev.status === 'detected'
                ? prev
                : {
                    status: 'error',
                    remoteSenderId: null,
                    remoteUpdatedAt: null,
                    errorMessage: error instanceof Error ? error.message : String(error)
                  }
            );
          }
        }

      } else if (result.status === 'invalid') {
        setPersistenceStorageSaveDiagnostic({
          status: 'invalid',
          documentInstanceId: currentInstanceId,
          storagePath: result.storagePath,
          sourceStrokeCount: sourceStrokes.length,
          sourcePointCount,
          jsonByteLength: 0,
          errorCode: result.code,
          errorPath: result.path,
          errorMessage: result.message
        });
      } else if (result.status === 'error') {
        setPersistenceStorageSaveDiagnostic({
          status: 'error',
          documentInstanceId: currentInstanceId,
          storagePath: result.storagePath,
          sourceStrokeCount: sourceStrokes.length,
          sourcePointCount,
          jsonByteLength: 0,
          errorCode: result.code,
          errorPath: null,
          errorMessage: result.message
        });
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (persistenceSaveInFlightRef.current !== currentSaveSeq) return;
      if (documentInstanceIdRef.current !== currentInstanceId) return;
      if (currentUid !== user.uid) return;
      if (!persistenceStorageIdentity) return;
      if (
        persistenceStorageIdentity.repertoireId !== currentIdentity.repertoireId ||
        persistenceStorageIdentity.fileId !== currentIdentity.fileId ||
        persistenceStorageIdentity.sourceStoragePath !== currentIdentity.sourceStoragePath
      ) {
        return;
      }

      setPersistenceStorageSaveDiagnostic({
        status: 'error',
        documentInstanceId: currentInstanceId,
        storagePath: null,
        sourceStrokeCount: sourceStrokes.length,
        sourcePointCount,
        jsonByteLength: 0,
        errorCode: 'exception',
        errorPath: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown exception'
      });
    } finally {
      if (persistenceSaveInFlightRef.current === currentSaveSeq) {
        persistenceSaveInFlightRef.current = null;
      }
    }
  };

  useEffect(() => {
    const requestLifecycleAutosave = (
      trigger: Exclude<AnnotationLifecycleAutosaveRequestDiagnosticV2['trigger'], null>
    ) => {
      if (annotationDirtyStatus !== 'dirty') return;
      if (autosaveEligibilityDiagnostic.status === 'blocked') return;
      if (isAutosaveBlockedBySnapshotState) return;
      if (remoteTabChangeDetected) return;
      if (persistenceSaveInFlightRef.current !== null) return;
      if (persistenceStorageSaveDiagnostic.status === 'saving') return;

      const scheduleSequence =
        autosaveEligibilityDiagnostic.scheduleSequence > 0
          ? autosaveEligibilityDiagnostic.scheduleSequence
          : undefined;

      setLifecycleAutosaveRequestDiagnostic({
        trigger,
        requestedAt: new Date().toISOString(),
        documentInstanceId: documentInstanceIdRef.current,
        scheduleSequence: scheduleSequence ?? null
      });

      void handleSavePersistenceToStorage('autosave', scheduleSequence);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lifecycleAutosaveRetryPendingRef.current = annotationDirtyStatus === 'dirty';
        requestLifecycleAutosave('visibility-hidden');
        return;
      }

      if (
        document.visibilityState === 'visible' &&
        lifecycleAutosaveRetryPendingRef.current
      ) {
        requestLifecycleAutosave('visibility-visible-retry');
      }
    };

    const handlePageHide = () => {
      lifecycleAutosaveRetryPendingRef.current = annotationDirtyStatus === 'dirty';
      requestLifecycleAutosave('pagehide');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [
    annotationDirtyStatus,
    autosaveEligibilityDiagnostic.scheduleSequence,
    autosaveEligibilityDiagnostic.status,
    isAutosaveBlockedBySnapshotState,
    remoteTabChangeDetected,
    persistenceStorageSaveDiagnostic.status,
    handleSavePersistenceToStorage
  ]);

  useEffect(() => {
    if (annotationDirtyStatus === 'clean') {
      lifecycleAutosaveRetryPendingRef.current = false;
    }
  }, [annotationDirtyStatus]);

  const handleLoadPersistenceFromStorage = useCallback(async (origin: PersistenceStorageLoadOriginV2) => {
    if (!user || !user.uid) return;
    if (!docReady || !persistenceStorageIdentity) return;
    if (isLoading || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null) return;
    if ((transformInfo?.activePointerCount ?? 0) > 0) return;

    if (persistenceStorageSaveDiagnostic.status === 'saving') return;
    if (persistenceStorageLoadDiagnostic.status === 'loading') return;
    if (annotationRestoreDiagnostic.status === 'restoring') return;

    const currentLoadStorageSeq = ++storageLoadSequenceRef.current;
    const currentInstanceId = documentInstanceIdRef.current;
    const currentIdentity = persistenceStorageIdentity;
    const currentUid = user.uid;

    if (origin === 'automatic') {
      setAutomaticSnapshotLookupDiagnostic({
        ...createIdleAutomaticSnapshotLookupDiagnosticV2(),
        status: 'looking-up',
        documentInstanceId: currentInstanceId
      });
    }

    setPersistenceStorageLoadDiagnostic({
      ...createIdlePersistenceStorageLoadDiagnosticV2(),
      status: 'loading'
    });
    setLoadedAnnotationSnapshot(null);
    setAnnotationRestoreDiagnostic(createIdleAnnotationRestoreDiagnosticV2());


    try {
      const result = await loadAnnotationPersistenceDocumentV2({
        uid: currentUid,
        identity: currentIdentity
      });

      if (!mountedRef.current) return;
      if (storageLoadSequenceRef.current !== currentLoadStorageSeq) return;
      if (documentInstanceIdRef.current !== currentInstanceId) return;
      if (!user || user.uid !== currentUid) return;
      if (!persistenceStorageIdentity) return;
      if (
        persistenceStorageIdentity.repertoireId !== currentIdentity.repertoireId ||
        persistenceStorageIdentity.fileId !== currentIdentity.fileId ||
        persistenceStorageIdentity.sourceStoragePath !== currentIdentity.sourceStoragePath
      ) {
        return;
      }

      if (result.status === 'loaded') {
        const doc = result.document;
        let loadedPageCount = 0;
        let loadedStrokeCount = 0;
        let loadedPointCount = 0;
        let loadedPenStrokeCount = 0;
        let loadedHighlighterStrokeCount = 0;

        for (const pageKey in doc.pages) {
          const page = doc.pages[pageKey];
          loadedPageCount++;
          loadedStrokeCount += page.strokes.length;
          for (const stroke of page.strokes) {
            loadedPointCount += stroke.points.length;
            if (stroke.tool === 'pen') loadedPenStrokeCount++;
            if (stroke.tool === 'highlighter') loadedHighlighterStrokeCount++;
          }
        }

        const sourceStrokes = annotationHistory.completedStrokes.filter(
          stroke => stroke.documentInstanceId === currentInstanceId
        );

        let currentMemoryFidelityStatus: 'not-run' | 'pass' | 'mismatch' = 'not-run';
        if (sourceStrokes.length > 0) {
          const restoredStrokes = restoreAnnotationCompletedStrokesV2(doc, currentInstanceId);
          const passed = arePersistenceRoundTripStrokesEqualV2(sourceStrokes, restoredStrokes);
          currentMemoryFidelityStatus = passed ? 'pass' : 'mismatch';
        }


        setPersistenceStorageLoadDiagnostic({
          status: 'loaded',
          currentDocumentInstanceId: currentInstanceId,
          persistedDocumentInstanceId: null,
          storagePath: result.storagePath,
          loadedPageCount,
          loadedStrokeCount,
          loadedPointCount,
          loadedPenStrokeCount,
          loadedHighlighterStrokeCount,
          jsonByteLength: result.jsonByteLength,
          codecValidationPassed: true,
          identityValidationPassed: true,
          currentMemoryFidelityStatus,
          errorCode: null,
          errorPath: null,
          errorMessage: null
        });

        if (origin === 'automatic') {
          setAutomaticSnapshotLookupDiagnostic({
            status: 'found',
            documentInstanceId: currentInstanceId,
            storagePath: result.storagePath,
            errorCode: null,
            errorMessage: null
          });
        }

        setLoadedAnnotationSnapshot({
          loadOrigin: origin,
          uid: currentUid,
          identity: currentIdentity,
          storagePath: result.storagePath,
          document: doc,
          jsonByteLength: result.jsonByteLength
        });
        
        setAnnotationRestoreDiagnostic({
          ...createIdleAnnotationRestoreDiagnosticV2(),
          status: 'ready'
        });

      } else if (result.status === 'not-found') {
        if (origin === 'automatic') {
          setAutomaticSnapshotLookupDiagnostic({
            status: 'not-found',
            documentInstanceId: currentInstanceId,
            storagePath: result.storagePath,
            errorCode: null,
            errorMessage: null
          });
        }
        setPersistenceStorageLoadDiagnostic({
          ...createIdlePersistenceStorageLoadDiagnosticV2(),
          status: 'not-found',
          storagePath: result.storagePath
        });
      } else if (result.status === 'invalid') {
        if (origin === 'automatic') {
          setAutomaticSnapshotLookupDiagnostic({
            status: 'invalid',
            documentInstanceId: currentInstanceId,
            storagePath: result.storagePath,
            errorCode: result.code,
            errorMessage: result.message
          });
        }
        setPersistenceStorageLoadDiagnostic({
          ...createIdlePersistenceStorageLoadDiagnosticV2(),
          status: 'invalid',
          storagePath: result.storagePath,
          errorCode: result.code,
          errorPath: result.path,
          errorMessage: result.message
        });
      } else if (result.status === 'error') {
        if (origin === 'automatic') {
          setAutomaticSnapshotLookupDiagnostic({
            status: 'error',
            documentInstanceId: currentInstanceId,
            storagePath: result.storagePath,
            errorCode: result.code,
            errorMessage: result.message
          });
        }
        setPersistenceStorageLoadDiagnostic({
          ...createIdlePersistenceStorageLoadDiagnosticV2(),
          status: 'error',
          storagePath: result.storagePath,
          errorCode: result.code,
          errorPath: null,
          errorMessage: result.message
        });
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (storageLoadSequenceRef.current !== currentLoadStorageSeq) return;
      if (documentInstanceIdRef.current !== currentInstanceId) return;
      if (!user || user.uid !== currentUid) return;
      if (!persistenceStorageIdentity) return;
      if (
        persistenceStorageIdentity.repertoireId !== currentIdentity.repertoireId ||
        persistenceStorageIdentity.fileId !== currentIdentity.fileId ||
        persistenceStorageIdentity.sourceStoragePath !== currentIdentity.sourceStoragePath
      ) {
        return;
      }

      if (origin === 'automatic') {
        setAutomaticSnapshotLookupDiagnostic({
          ...createIdleAutomaticSnapshotLookupDiagnosticV2(),
          status: 'error',
          errorCode: 'unexpected-exception',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
      setPersistenceStorageLoadDiagnostic({
        ...createIdlePersistenceStorageLoadDiagnosticV2(),
        status: 'error',
        errorCode: 'unexpected-exception',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }, [
    user,
    docReady,
    persistenceStorageIdentity,
    isLoading,
    inputStatus.phase,
    inputStatus.activePointerId,
    transformInfo?.activePointerCount,
    persistenceStorageSaveDiagnostic.status,
    persistenceStorageLoadDiagnostic.status,
    annotationRestoreDiagnostic.status,
    annotationHistory.completedStrokes
  ]);

  useEffect(() => {
    if (
      !user?.uid ||
      !docReady ||
      isLoading ||
      !persistenceStorageIdentity ||
      persistenceStorageSaveDiagnostic.status === 'saving' ||
      persistenceStorageLoadDiagnostic.status === 'loading' ||
      annotationRestoreDiagnostic.status === 'restoring'
    ) {
      return;
    }

    const lookupKey = JSON.stringify([
      user.uid,
      documentInstanceIdRef.current,
      persistenceStorageIdentity.repertoireId,
      persistenceStorageIdentity.fileId,
      persistenceStorageIdentity.sourceStoragePath
    ]);

    if (automaticSnapshotLookupAttemptKeyRef.current === lookupKey) {
      return;
    }

    automaticSnapshotLookupAttemptKeyRef.current = lookupKey;
    void handleLoadPersistenceFromStorage('automatic');
  }, [
    user?.uid,
    docReady,
    isLoading,
    persistenceStorageIdentity,
    persistenceStorageSaveDiagnostic.status,
    persistenceStorageLoadDiagnostic.status,
    annotationRestoreDiagnostic.status,
    handleLoadPersistenceFromStorage
  ]);


  const handleRestoreLoadedSnapshot = useCallback(async (origin: AnnotationSnapshotRestoreOriginV2) => {
    if (!user || !user.uid) return;
    if (!docReady || !persistenceStorageIdentity || !loadedAnnotationSnapshot) return;
    if (isLoading || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null) return;
    if (isGestureActive || (transformInfo?.activePointerCount ?? 0) > 0) return;
    if (persistenceStorageSaveDiagnostic.status === 'saving') return;
    if (persistenceStorageLoadDiagnostic.status === 'loading') return;
    if (annotationRestoreDiagnostic.status === 'restoring') return;

    if (
      user.uid !== loadedAnnotationSnapshot.uid ||
      persistenceStorageIdentity.repertoireId !== loadedAnnotationSnapshot.identity.repertoireId ||
      persistenceStorageIdentity.fileId !== loadedAnnotationSnapshot.identity.fileId ||
      persistenceStorageIdentity.sourceStoragePath !== loadedAnnotationSnapshot.identity.sourceStoragePath
    ) {
      setAnnotationRestoreDiagnostic(prev => ({
        ...prev,
        status: 'blocked',
        errorCode: 'identity-mismatch',
        errorMessage: 'The loaded snapshot identity does not match current document'
      }));
      return;
    }

    if (origin === 'manual' && shouldConfirmAnnotationReplacement) {
      const confirmed = window.confirm(
        '현재 악보에 저장되지 않은 필기 변경이 있습니다.\n' +
        '불러온 snapshot으로 복원하면 현재 변경이 사라집니다.\n' +
        '계속하시겠습니까?'
      );

      if (!confirmed) {
        setAnnotationRestoreDiagnostic(prev => ({
          ...prev,
          status: 'cancelled'
        }));
        return;
      }
    }

    if (origin === 'automatic') {
      setAutomaticSnapshotRestoreDiagnostic(prev => ({
        ...prev,
        status: 'restoring'
      }));
    }

    setAnnotationRestoreDiagnostic(prev => ({
      ...prev,
      status: 'restoring'
    }));

    const currentInstanceId = documentInstanceIdRef.current;
    
    let nextCounter = strokeIdCounterRef.current;
    const prefix = 'stroke-';
    
    const restoredStrokes = restoreAnnotationCompletedStrokesV2(
      loadedAnnotationSnapshot.document,
      currentInstanceId
    );
    
    let loadedStrokeCount = 0;
    let loadedPointCount = 0;
    
    for (const stroke of restoredStrokes) {
      loadedStrokeCount++;
      loadedPointCount += stroke.points.length;
      
      if (!Number.isInteger(stroke.pageNumber) || stroke.pageNumber < 1 || stroke.pageNumber > numPages) {
        setAnnotationRestoreDiagnostic(prev => ({
          ...prev,
          status: 'blocked',
          errorCode: 'page-out-of-range',
          errorMessage: `Stroke has invalid page number: ${stroke.pageNumber}`
        }));
        return;
      }
      
      if (stroke.id.startsWith(prefix)) {
        const numericId = Number(stroke.id.slice(prefix.length));
        if (Number.isSafeInteger(numericId) && numericId >= nextCounter) {
          nextCounter = numericId + 1;
        }
      }
    }
    
    const emptyHistory = createEmptyHistoryV2();
    setAnnotationHistory({
      ...emptyHistory,
      completedStrokes: restoredStrokes
    });
    
    strokeIdCounterRef.current = nextCounter;
    

    setAnnotationRestoreDiagnostic({
      status: 'restored',
      storagePath: loadedAnnotationSnapshot.storagePath,
      loadedStrokeCount: loadedStrokeCount,
      loadedPointCount: loadedPointCount,
      beforeStrokeCount: annotationHistory.completedStrokes.length,
      restoredStrokeCount: loadedStrokeCount,
      restoredPointCount: loadedPointCount,
      currentDocumentInstanceId: currentInstanceId,
      undoDepthAfterRestore: 0,
      redoDepthAfterRestore: 0,
      nextStrokeIdCounter: nextCounter,
      errorCode: null,
      errorMessage: null
    });
    
    if (origin === 'automatic') {
      setAutomaticSnapshotRestoreDiagnostic({
        status: 'restored',
        documentInstanceId: currentInstanceId,
        storagePath: loadedAnnotationSnapshot.storagePath,
        reason: null
      });
    }

    setAnnotationCleanBaseline({
      uid: user.uid,
      identity: persistenceStorageIdentity,
      documentInstanceId: currentInstanceId,
      source: 'restored',
      strokes: [...restoredStrokes]
    });
    setRemoteTabChangeDiagnostic(
      annotationPersistenceBroadcastChannelRef.current
        ? createListeningRemoteTabChangeDiagnosticV2()
        : createUnavailableRemoteTabChangeDiagnosticV2()
    );
    
    setLoadedAnnotationSnapshot(null);
  }, [
    user,
    docReady,
    persistenceStorageIdentity,
    loadedAnnotationSnapshot,
    isLoading,
    inputStatus.phase,
    inputStatus.activePointerId,
    isGestureActive,
    transformInfo?.activePointerCount,
    persistenceStorageSaveDiagnostic.status,
    persistenceStorageLoadDiagnostic.status,
    annotationRestoreDiagnostic.status,
    shouldConfirmAnnotationReplacement
  ]);


  useEffect(() => {
    if (
      !user?.uid ||
      !docReady ||
      !persistenceStorageIdentity ||
      !annotationCleanBaseline ||
      annotationDirtyStatus === 'unavailable' ||
      user.uid !== annotationCleanBaseline.uid ||
      persistenceStorageIdentity.repertoireId !== annotationCleanBaseline.identity.repertoireId ||
      persistenceStorageIdentity.fileId !== annotationCleanBaseline.identity.fileId ||
      persistenceStorageIdentity.sourceStoragePath !== annotationCleanBaseline.identity.sourceStoragePath ||
      documentInstanceIdRef.current !== annotationCleanBaseline.documentInstanceId
    ) {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic({
        status: 'unavailable',
        reason: annotationDirtyStatus === 'unavailable' ? 'dirty-state-unavailable' : 'identity-unavailable',
        documentInstanceId: null,
        debounceMs: ANNOTATION_AUTOSAVE_DEBOUNCE_MS_V2,
        scheduledStrokeCount: 0,
        scheduledPointCount: 0,
        scheduleSequence: 0
      });
      return;
    }

    if (annotationDirtyStatus === 'clean') {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic(prev => ({
        ...prev,
        status: 'clean',
        reason: null,
        documentInstanceId: documentInstanceIdRef.current,
        scheduledStrokeCount: 0,
        scheduledPointCount: 0
      }));
      return;
    }

    if (remoteTabChangeDetected) {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic(prev => ({
        ...prev,
        status: 'blocked',
        reason: 'remote-tab-change-detected',
        documentInstanceId: documentInstanceIdRef.current
      }));
      return;
    }

    if (persistenceStorageSaveDiagnostic.status === 'invalid' && persistenceSaveOrigin === 'autosave') {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic(prev => ({ ...prev, status: 'blocked', reason: 'autosave-save-invalid', documentInstanceId: documentInstanceIdRef.current }));
      return;
    }
    if (persistenceStorageSaveDiagnostic.status === 'error' && persistenceSaveOrigin === 'autosave') {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic(prev => ({ ...prev, status: 'blocked', reason: 'autosave-save-error', documentInstanceId: documentInstanceIdRef.current }));
      return;
    }

    if (persistenceStorageLoadDiagnostic.status === 'invalid') {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic(prev => ({ ...prev, status: 'blocked', reason: 'remote-snapshot-invalid', documentInstanceId: documentInstanceIdRef.current }));
      return;
    }
    if (persistenceStorageLoadDiagnostic.status === 'error') {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic(prev => ({ ...prev, status: 'blocked', reason: 'remote-snapshot-error', documentInstanceId: documentInstanceIdRef.current }));
      return;
    }
    if (automaticSnapshotRestoreDiagnostic.status === 'blocked') {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic(prev => ({ ...prev, status: 'blocked', reason: 'automatic-restore-blocked', documentInstanceId: documentInstanceIdRef.current }));
      return;
    }
    if (automaticSnapshotRestoreDiagnostic.status === 'error') {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic(prev => ({ ...prev, status: 'blocked', reason: 'automatic-restore-error', documentInstanceId: documentInstanceIdRef.current }));
      return;
    }

    let waitingReason: AnnotationAutosaveEligibilityReasonV2 | null = null;
    if (isLoading) waitingReason = 'document-loading';
    else if (inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null) waitingReason = 'annotation-input-active';
    else if (isGestureActive || (transformInfo?.activePointerCount ?? 0) > 0) waitingReason = 'gesture-active';
    else if (persistenceStorageSaveDiagnostic.status === 'saving' || persistenceStorageLoadDiagnostic.status === 'loading' || annotationRestoreDiagnostic.status === 'restoring') waitingReason = 'persistence-busy';
    else if (manualSnapshotAwaitingDecision) waitingReason = 'manual-snapshot-ready';
    else if (automaticSnapshotDecisionPending) waitingReason = 'snapshot-decision-pending';

    if (waitingReason) {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
      setAutosaveEligibilityDiagnostic(prev => ({
        ...prev,
        status: 'waiting',
        reason: waitingReason,
        documentInstanceId: documentInstanceIdRef.current
      }));
      return;
    }

    if (annotationAutosaveTimerRef.current !== null) {
      window.clearTimeout(annotationAutosaveTimerRef.current);
      annotationAutosaveTimerRef.current = null;
    }

    const currentStrokeCount = currentDocumentStrokes.length;
    let currentPointCount = 0;
    for (const stroke of currentDocumentStrokes) {
      currentPointCount += stroke.points.length;
    }

    const newSequence = ++annotationAutosaveScheduleSequenceRef.current;
    const currentInstanceId = documentInstanceIdRef.current;
    
    setAutosaveEligibilityDiagnostic(prev => ({
      ...prev,
      status: 'scheduled',
      reason: null,
      documentInstanceId: currentInstanceId,
      scheduledStrokeCount: currentStrokeCount,
      scheduledPointCount: currentPointCount,
      scheduleSequence: newSequence
    }));

    const scheduledTimerId = window.setTimeout(() => {
      if (annotationAutosaveTimerRef.current !== scheduledTimerId) {
        return;
      }
      
      annotationAutosaveTimerRef.current = null;

      if (mountedRef.current && annotationAutosaveScheduleSequenceRef.current === newSequence && documentInstanceIdRef.current === currentInstanceId) {
        setAutosaveEligibilityDiagnostic(prev => {
          if (prev.scheduleSequence !== newSequence) return prev;
          return {
            ...prev,
            status: 'ready',
            reason: null
          };
        });
      }
    }, ANNOTATION_AUTOSAVE_DEBOUNCE_MS_V2);

    annotationAutosaveTimerRef.current = scheduledTimerId;

    return () => {
      if (annotationAutosaveTimerRef.current === scheduledTimerId) {
        window.clearTimeout(scheduledTimerId);
        annotationAutosaveTimerRef.current = null;
      }
    };
  }, [
    user?.uid,
    docReady,
    persistenceStorageIdentity,
    annotationCleanBaseline,
    annotationDirtyStatus,
    persistenceStorageLoadDiagnostic.status,
    automaticSnapshotRestoreDiagnostic.status,
    isLoading,
    inputStatus.phase,
    inputStatus.activePointerId,
    isGestureActive,
    transformInfo?.activePointerCount,
    persistenceStorageSaveDiagnostic.status,
    annotationRestoreDiagnostic.status,
    automaticSnapshotLookupDiagnostic.status,
    loadedAnnotationSnapshot,
    currentDocumentStrokes,
    remoteTabChangeDetected
  ]);

  useEffect(() => {
    return () => {
      if (annotationAutosaveTimerRef.current !== null) {
        window.clearTimeout(annotationAutosaveTimerRef.current);
        annotationAutosaveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (
      autosaveEligibilityDiagnostic.status === 'ready' &&
      autosaveEligibilityDiagnostic.scheduleSequence > 0 &&
      lastAutosaveCommitSequenceRef.current !== autosaveEligibilityDiagnostic.scheduleSequence &&
      annotationDirtyStatus === 'dirty' &&
      autosaveEligibilityDiagnostic.documentInstanceId === documentInstanceIdRef.current &&
      user?.uid &&
      persistenceStorageIdentity &&
      persistenceSaveInFlightRef.current === null &&
      inputStatus.phase === 'idle' &&
      inputStatus.activePointerId === null &&
      !isGestureActive &&
      (transformInfo?.activePointerCount ?? 0) === 0 &&
      !isAutosaveBlockedBySnapshotState &&
      !remoteTabChangeDetected
    ) {
      void handleSavePersistenceToStorage('autosave', autosaveEligibilityDiagnostic.scheduleSequence);
    }
  }, [
    autosaveEligibilityDiagnostic,
    annotationDirtyStatus,
    user?.uid,
    persistenceStorageIdentity,
    inputStatus.phase,
    inputStatus.activePointerId,
    isGestureActive,
    transformInfo?.activePointerCount,
    annotationRestoreDiagnostic.status,
    automaticSnapshotLookupDiagnostic.status,
    automaticSnapshotRestoreDiagnostic.status,
    remoteTabChangeDetected
  ]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    
    if (!file || !engineRef.current) return;

    if (shouldConfirmAnnotationReplacement) {
      const confirmed = window.confirm(
        '현재 악보에 저장되지 않은 필기 변경이 있습니다.\n' +
        'PDF를 다시 열거나 다른 PDF를 열면 현재 변경이 사라집니다.\n' +
        '계속하시겠습니까?'
      );

      if (!confirmed) {
        return;
      }
    }

    if (annotationAutosaveTimerRef.current !== null) {
      window.clearTimeout(annotationAutosaveTimerRef.current);
      annotationAutosaveTimerRef.current = null;
    }
    annotationAutosaveScheduleSequenceRef.current += 1;

    automaticSnapshotLookupAttemptKeyRef.current = null;
    setAutomaticSnapshotLookupDiagnostic(createIdleAutomaticSnapshotLookupDiagnosticV2());
    automaticSnapshotRestoreDecisionKeyRef.current = null;
    setAutomaticSnapshotRestoreDiagnostic(createIdleAutomaticSnapshotRestoreDiagnosticV2());



    if (viewportRef.current) {
      viewportRef.current.resetTransform();
    }


    storageSaveSequenceRef.current += 1;
    storageLoadSequenceRef.current += 1;
    lastAutosaveCommitSequenceRef.current = null;
    lifecycleAutosaveRetryPendingRef.current = false;
    setLifecycleAutosaveRequestDiagnostic(createIdleAnnotationLifecycleAutosaveRequestDiagnosticV2());
    setRemoteTabChangeDiagnostic(createUnavailableRemoteTabChangeDiagnosticV2());
    setPersistenceStorageIdentity(null);
    setPersistenceStorageSaveDiagnostic(createIdlePersistenceStorageSaveDiagnosticV2());
    setPersistenceStorageLoadDiagnostic(createIdlePersistenceStorageLoadDiagnosticV2());

    setLoadedAnnotationSnapshot(null);
    setAnnotationRestoreDiagnostic(createIdleAnnotationRestoreDiagnosticV2());
    setAnnotationCleanBaseline(null);
    const nextStorageIdentity = createLabStorageIdentityV2(file);



    setDocReady(false);
    setErrorMessage('');
    setDocName(file.name);
    setPageNumber(1);
    targetPageRef.current = 1;
    setTargetOutputScale(DEFAULT_OUTPUT_SCALE);
    setRenderFailed(false);
    baselineMapRef.current.clear();
    setFrontInfo(null);
    setCurrentBaseline(null);
    setTransformInfo(null);
    setInteractionMode('navigate');
    setAnnotationHistory(createEmptyHistoryV2());
    strokeIdCounterRef.current = 1;
    setInputStatus({ phase: 'idle', activePointerId: null, activePointerType: null, currentPointCount: 0, touchSuppressedUntilRelease: false });
    setStats({ completed: 0, swaps: 0, errors: 0, cancelled: 0, stale: 0 });
    setLastRenderResult(null);
    setLastRenderError(null);
    setIsLoading(true);

    const currentLoadSeq = ++loadSequenceRef.current;

    try {
      const buffer = await file.arrayBuffer();
      if (!mountedRef.current || currentLoadSeq !== loadSequenceRef.current) return;
      
      const bytes = new Uint8Array(buffer);
      const engine = engineRef.current;
      const result = await engine.loadDocument(bytes);
      
      if (!mountedRef.current || currentLoadSeq !== loadSequenceRef.current) return;
      if (result.status !== 'loaded') return;
      


      documentInstanceIdRef.current += 1;
      setNumPages(result.numPages);
      setPersistenceStorageIdentity(nextStorageIdentity);
      
      setAnnotationCleanBaseline({
        uid: user?.uid ?? null,
        identity: nextStorageIdentity,
        documentInstanceId: documentInstanceIdRef.current,
        source: 'initial-empty',
        strokes: []
      });

      setDocReady(true);

    } catch (err) {
      if (mountedRef.current && currentLoadSeq === loadSequenceRef.current) {
        console.error(err);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current && currentLoadSeq === loadSequenceRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleSwap = useCallback((info: PageSurfaceSwapInfoV2) => {
    setStats(prev => ({ ...prev, swaps: prev.swaps + 1 }));
    setFrontInfo(info.nextFront);
    setRenderFailed(false);
    
    if (
      info.nextFront.cssScale === 1 &&
      info.nextFront.pageNumber === targetPageRef.current &&
      info.nextFront.cssWidth > 0 &&
      info.nextFront.cssHeight > 0
    ) {
      const key = `${documentInstanceIdRef.current}:${info.nextFront.pageNumber}`;
      if (!baselineMapRef.current.has(key)) {
        baselineMapRef.current.set(key, {
          documentInstanceId: documentInstanceIdRef.current,
          pageNumber: info.nextFront.pageNumber,
          logicalWidth: info.nextFront.cssWidth,
          logicalHeight: info.nextFront.cssHeight
        });
      }
      setCurrentBaseline(baselineMapRef.current.get(key) || null);
    }
  }, []);

  const handleRenderEvent = useCallback((ev: PageSurfaceRenderEventV2) => {
    setLastRenderResult(ev.result);
    if (ev.result.status === 'completed') {
      setStats(prev => ({ ...prev, completed: prev.completed + 1 }));
    } else if (ev.result.status === 'cancelled') {
      setStats(prev => ({ ...prev, cancelled: prev.cancelled + 1 }));
    } else if (ev.result.status === 'stale') {
      setStats(prev => ({ ...prev, stale: prev.stale + 1 }));
    }
  }, []);

  const handleRenderError = useCallback((err: unknown) => {
    if (err instanceof PdfRenderEngineErrorV2) {
      setLastRenderError({ code: err.code, message: err.message });
    } else if (err instanceof Error) {
      setLastRenderError({ code: 'UNKNOWN_ERROR', message: err.message });
    } else {
      setLastRenderError({ code: 'UNKNOWN_ERROR', message: String(err) });
    }
    setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
    setRenderFailed(true);
    
    if (
      frontInfo &&
      engineRef.current &&
      frontInfo.generation === engineRef.current.generation &&
      frontInfo.pageNumber === targetPageRef.current &&
      frontInfo.cssScale === PDF_CSS_SCALE &&
      (frontInfo.outputScale === DEFAULT_OUTPUT_SCALE || frontInfo.outputScale === DETAIL_OUTPUT_SCALE)
    ) {
      setTargetOutputScale(frontInfo.outputScale);
    }
  }, [frontInfo]);

  const handleTransformChange = useCallback((ev: StableGestureTransformEventV2) => {
    setTransformInfo(ev);
  }, []);

  const handleStrokeComplete = useCallback((draft: AnnotationStrokeDraftV2) => {
    if (draft.documentInstanceId !== documentInstanceIdRef.current || draft.pageNumber !== targetPageRef.current) {
      return;
    }
    if (draft.points.length === 0) return;

    const strokeId = `stroke-${strokeIdCounterRef.current++}`;
    setAnnotationHistory(prev => addStrokeToHistoryV2(prev, {
      id: strokeId,
      documentInstanceId: draft.documentInstanceId,
      pageNumber: draft.pageNumber,
      tool: draft.tool,
      style: {
        color: draft.style.color,
        width: draft.style.width,
        opacity: draft.style.opacity
      },
      pointerType: draft.pointerType,
      points: draft.points
    }));
  }, []);

  const handleEraseRequest = useCallback((request: AnnotationEraseRequestV2) => {
    if (request.documentInstanceId !== documentInstanceIdRef.current || request.pageNumber !== targetPageRef.current) {
      return;
    }
    if (request.strokeIds.length === 0) return;

    setAnnotationHistory(prev => {
      let next = prev;
      for (const id of request.strokeIds) {
        next = eraseStrokeFromHistoryV2(next, id);
      }
      return next;
    });
  }, []);

  const handleInputStatusChange = useCallback((status: AnnotationInputStatusV2) => {
    setInputStatus(status);
  }, []);

  const handleUndo = useCallback(() => {
    const activeGesture = (transformInfo?.activePointerCount ?? 0) > 0 || (transformInfo?.phase && transformInfo.phase !== 'idle');
    if (!docReady || !currentBaseline || activeGesture || inputStatus.phase !== 'idle') return;
    
    setAnnotationHistory(prev => 
      undoPageHistoryV2(prev, documentInstanceIdRef.current, pageNumber)
    );
  }, [docReady, currentBaseline, transformInfo, inputStatus.phase, pageNumber]);

  const handleRedo = useCallback(() => {
    const activeGesture = (transformInfo?.activePointerCount ?? 0) > 0 || (transformInfo?.phase && transformInfo.phase !== 'idle');
    if (!docReady || !currentBaseline || activeGesture || inputStatus.phase !== 'idle') return;
    
    setAnnotationHistory(prev => 
      redoPageHistoryV2(prev, documentInstanceIdRef.current, pageNumber)
    );
  }, [docReady, currentBaseline, transformInfo, inputStatus.phase, pageNumber]);

  const handleEraseLatest = useCallback(() => {
    const activeGesture = (transformInfo?.activePointerCount ?? 0) > 0 || (transformInfo?.phase && transformInfo.phase !== 'idle');
    if (!docReady || !currentBaseline || activeGesture || inputStatus.phase !== 'idle') return;

    setAnnotationHistory(prev => {
      const pageStrokes = prev.completedStrokes.filter(s => s.documentInstanceId === documentInstanceIdRef.current && s.pageNumber === pageNumber);
      if (pageStrokes.length === 0) return prev;
      const lastStroke = pageStrokes[pageStrokes.length - 1];
      return eraseStrokeFromHistoryV2(prev, lastStroke.id);
    });
  }, [docReady, currentBaseline, transformInfo, inputStatus.phase, pageNumber]);

  const setNavigateMode = () => {
    if (viewportRef.current) viewportRef.current.cancelActiveGesture();
    setInteractionMode('navigate');
  };

  const setPenMode = () => {
    if (viewportRef.current) viewportRef.current.cancelActiveGesture();
    setActiveDrawingTool('pen');
    setInteractionMode('pen');
  };

  const setHighlighterMode = () => {
    if (viewportRef.current) viewportRef.current.cancelActiveGesture();
    setActiveDrawingTool('highlighter');
    setInteractionMode('pen');
  };

  const setEraserMode = () => {
    if (viewportRef.current) viewportRef.current.cancelActiveGesture();
    setInteractionMode('eraser');
  };

  const applyResolutionIntent = useCallback((previewScale: number) => {
    const nextOutputScale = resolveOutputScaleForPreviewScale(previewScale);
    if (nextOutputScale === targetOutputScale) {
      return;
    }
    setRenderFailed(false);
    setTargetOutputScale(nextOutputScale);
  }, [targetOutputScale]);

  const handleGestureEnd = useCallback(
    (ev: StableGestureTransformEventV2) => {
      applyResolutionIntent(ev.transform.scale);
    },
    [applyResolutionIntent]
  );

  const handleZoomIn = () => {
    if (!viewportRef.current) return;
    const current = viewportRef.current.getTransform().scale;
    viewportRef.current.setScale(current + 0.25);
    const finalScale = viewportRef.current.getTransform().scale;
    applyResolutionIntent(finalScale);
  };

  const handleZoomOut = () => {
    if (!viewportRef.current) return;
    const current = viewportRef.current.getTransform().scale;
    viewportRef.current.setScale(current - 0.25);
    const finalScale = viewportRef.current.getTransform().scale;
    applyResolutionIntent(finalScale);
  };

  const handleZoomReset = () => {
    if (!viewportRef.current) return;
    viewportRef.current.resetTransform();
    applyResolutionIntent(1);
  };

  const handlePrevPage = () => {
    if (pageNumber > 1) {
      const next = pageNumber - 1;
      targetPageRef.current = next;
      if (viewportRef.current) viewportRef.current.resetTransform();
      applyResolutionIntent(1);
      setRenderFailed(false);
      setPageNumber(next);
    }
  };

  const handleNextPage = () => {
    if (pageNumber < numPages) {
      const next = pageNumber + 1;
      targetPageRef.current = next;
      if (viewportRef.current) viewportRef.current.resetTransform();
      applyResolutionIntent(1);
      setRenderFailed(false);
      setPageNumber(next);
    }
  };

  if (!isAdmin) {
    return <div className="p-10 text-stone-400">Admin access required</div>;
  }

  const currentScale = transformInfo?.transform.scale ?? 1;
  const isMinScale = currentScale - 1 <= 0.0005;
  const isMaxScale = 3 - currentScale <= 0.0005;

  let budgetPreview: RenderBudgetPreviewV2 | null = null;
  if (
    currentBaseline &&
    currentBaseline.documentInstanceId === documentInstanceIdRef.current &&
    currentBaseline.pageNumber === pageNumber &&
    currentBaseline.logicalWidth > 0 &&
    currentBaseline.logicalHeight > 0
  ) {
    budgetPreview = calculateRenderBudgetPreviewV2({
      cssWidth: currentBaseline.logicalWidth,
      cssHeight: currentBaseline.logicalHeight,
      requestedOutputScale: targetOutputScale
    });
  }

  const effectiveOutputScale = budgetPreview?.effectiveOutputScale ?? DEFAULT_OUTPUT_SCALE;
  const isOutputScaleLimited = budgetPreview !== null && budgetPreview.effectiveOutputScale < budgetPreview.requestedOutputScale - 0.0005;

  const annotationPageSpace: AnnotationPageSpaceV2 | null =
    currentBaseline &&
    currentBaseline.documentInstanceId === documentInstanceIdRef.current &&
    currentBaseline.pageNumber === pageNumber &&
    currentBaseline.logicalWidth > 0 &&
    currentBaseline.logicalHeight > 0
      ? {
          documentInstanceId: currentBaseline.documentInstanceId,
          pageNumber: currentBaseline.pageNumber,
          logicalWidth: currentBaseline.logicalWidth,
          logicalHeight: currentBaseline.logicalHeight
        }
      : null;

  const isQualityReady = frontInfo && frontInfo.pageNumber === pageNumber && frontInfo.outputScale === effectiveOutputScale;

  
  const currentPageStrokes = React.useMemo(() => {
    return annotationHistory.completedStrokes.filter(s => s.documentInstanceId === documentInstanceIdRef.current && s.pageNumber === pageNumber);
  }, [annotationHistory.completedStrokes, pageNumber]);


  const totalPoints = currentPageStrokes.reduce((acc, s) => acc + s.points.length, 0);

  let qualityStatus = 'RENDERING';
  if (renderFailed) {
    qualityStatus = frontInfo ? 'FAILED_FRONT_PRESERVED' : 'FAILED';
  } else if (isQualityReady) {
    qualityStatus = 'READY';
  }

  const modeControlsDisabled = !docReady || !annotationPageSpace || Boolean(isGestureActive) || inputStatus.phase !== 'idle';
  const penStyleControlsDisabled = modeControlsDisabled || activeDrawingTool !== 'pen';
  const highlighterStyleControlsDisabled = modeControlsDisabled || activeDrawingTool !== 'highlighter';

  useEffect(() => {
    if (
      automaticSnapshotLookupDiagnostic.status !== 'found' ||
      !loadedAnnotationSnapshot ||
      loadedAnnotationSnapshot.loadOrigin !== 'automatic' ||
      loadedAnnotationSnapshot.storagePath !== automaticSnapshotLookupDiagnostic.storagePath ||
      !user?.uid ||
      user.uid !== loadedAnnotationSnapshot.uid ||
      !persistenceStorageIdentity ||
      persistenceStorageIdentity.repertoireId !== loadedAnnotationSnapshot.identity.repertoireId ||
      persistenceStorageIdentity.fileId !== loadedAnnotationSnapshot.identity.fileId ||
      persistenceStorageIdentity.sourceStoragePath !== loadedAnnotationSnapshot.identity.sourceStoragePath
    ) {
      return;
    }
    
    if (automaticSnapshotLookupDiagnostic.documentInstanceId !== documentInstanceIdRef.current) return;

    if (
      !docReady ||
      isLoading ||
      persistenceStorageSaveDiagnostic.status === 'saving' ||
      persistenceStorageLoadDiagnostic.status === 'loading' ||
      annotationRestoreDiagnostic.status === 'restoring' ||
      inputStatus.phase !== 'idle' ||
      inputStatus.activePointerId !== null ||
      isGestureActive ||
      (transformInfo?.activePointerCount ?? 0) > 0
    ) {
       setAutomaticSnapshotRestoreDiagnostic(prev => {
         if (prev.status === 'waiting') return prev;
         return {
           status: 'waiting',
           documentInstanceId: documentInstanceIdRef.current,
           storagePath: loadedAnnotationSnapshot.storagePath,
           reason: null
         };
       });
       return;
    }

    const decisionKey = JSON.stringify([
      user.uid,
      documentInstanceIdRef.current,
      persistenceStorageIdentity.repertoireId,
      persistenceStorageIdentity.fileId,
      persistenceStorageIdentity.sourceStoragePath,
      loadedAnnotationSnapshot.storagePath,
      loadedAnnotationSnapshot.jsonByteLength
    ]);

    if (automaticSnapshotRestoreDecisionKeyRef.current === decisionKey) {
      return;
    }

    if (
      annotationDirtyStatus !== 'clean' ||
      !annotationCleanBaseline ||
      annotationCleanBaseline.source !== 'initial-empty' ||
      annotationCleanBaseline.uid !== user.uid ||
      annotationCleanBaseline.identity.repertoireId !== persistenceStorageIdentity.repertoireId ||
      annotationCleanBaseline.identity.fileId !== persistenceStorageIdentity.fileId ||
      annotationCleanBaseline.identity.sourceStoragePath !== persistenceStorageIdentity.sourceStoragePath ||
      annotationCleanBaseline.documentInstanceId !== documentInstanceIdRef.current ||
      currentDocumentStrokes.length > 0 ||
      undoDepth > 0 ||
      redoDepth > 0 ||
      hasCurrentAnnotationWork ||
      shouldConfirmAnnotationReplacement
    ) {
       automaticSnapshotRestoreDecisionKeyRef.current = decisionKey;
       setAutomaticSnapshotRestoreDiagnostic({
         status: 'skipped',
         documentInstanceId: documentInstanceIdRef.current,
         storagePath: loadedAnnotationSnapshot.storagePath,
         reason: 'dirty-or-local-work'
       });
       if (loadedAnnotationSnapshot.loadOrigin === 'automatic') {
         setLoadedAnnotationSnapshot(prev => (prev === loadedAnnotationSnapshot ? null : prev));
         setAnnotationRestoreDiagnostic(prev => (prev.status === 'ready' ? createIdleAnnotationRestoreDiagnosticV2() : prev));
       }
       return;
    }

    automaticSnapshotRestoreDecisionKeyRef.current = decisionKey;
    void handleRestoreLoadedSnapshot('automatic');
  }, [
    automaticSnapshotLookupDiagnostic.status,
    automaticSnapshotLookupDiagnostic.storagePath,
    automaticSnapshotLookupDiagnostic.documentInstanceId,
    loadedAnnotationSnapshot,
    user,
    persistenceStorageIdentity,
    docReady,
    isLoading,
    persistenceStorageSaveDiagnostic.status,
    persistenceStorageLoadDiagnostic.status,
    annotationRestoreDiagnostic.status,
    inputStatus.phase,
    inputStatus.activePointerId,
    isGestureActive,
    transformInfo?.activePointerCount,
    annotationDirtyStatus,
    annotationCleanBaseline,
    currentDocumentStrokes.length,
    undoDepth,
    redoDepth,
    hasCurrentAnnotationWork,
    shouldConfirmAnnotationReplacement,
    handleRestoreLoadedSnapshot
  ]);

  return (
    <div className="flex flex-col min-h-screen text-stone-200">
      <div className="p-4 bg-brand/10 border-b border-brand/20 mb-4">


<h1 className="text-xl font-bold text-brand-light">[4E-C4K-A Same-Browser Tab Conflict Detection]</h1>
        <div className="bg-emerald-900/50 text-emerald-200 p-2 rounded text-xs mt-2 border border-emerald-500/20">
          <strong>Interactive CSS Preview Mode</strong><br/>
          Automatic snapshot lookup active<br/>
          Controlled automatic restore active<br/>
          Only clean initial-empty canvas can be auto-restored<br/>
          Dirty and local-work canvas replacement remains guarded<br/>
          Manual save/load/restore active<br/>
          Automatic save active — debounce + hidden/pagehide signals + visible retry<br/>
          Same-browser tab save conflict detection active<br/>
          Spatial eraser active


        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 px-4 pb-10 flex-grow">
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4">
            <div>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="text-sm text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-brand-light hover:file:bg-brand-dark"
              />
            </div>
            {isLoading && <div className="text-stone-400 text-sm">Loading...</div>}
            {errorMessage && <div className="text-red-400 text-sm">{errorMessage}</div>}
            
            {docReady && (
              <div className="text-sm">
                <div>Document: {docName}</div>
                <div>Pages: {numPages}</div>
                <div>PDF Scale: 100%</div>
                <div>Requested Output Scale: {targetOutputScale.toFixed(2)}x</div>
                <div>Effective Output Scale: {effectiveOutputScale.toFixed(2)}x</div>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-stone-950 p-2 rounded">Completed: {stats.completed}</div>
              <div className="bg-stone-950 p-2 rounded">Swaps: {stats.swaps}</div>
              <div className="bg-stone-950 p-2 rounded">Cancelled: {stats.cancelled}</div>
              <div className="bg-stone-950 p-2 rounded">Stale: {stats.stale}</div>
              <div className="bg-stone-950 p-2 rounded">Errors: {stats.errors}</div>
            </div>
            
            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Pages</div>
              <div>Target Page: {pageNumber}</div>
              <div>Front Page: {frontInfo?.pageNumber ?? '-'}</div>
              <div>Baseline Page: {currentBaseline?.pageNumber ?? '-'}</div>
            </div>
            
            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Render Quality</div>
              <div>Mode: AUTOMATIC + PIXEL BUDGET</div>
              <div>Rule: &lt; 1.50x → 2x</div>
              <div>Rule: &gt;= 1.50x → 3x</div>
              <div>Requested Output Scale: {targetOutputScale.toFixed(2)}x</div>
              <div>Effective Output Scale: {effectiveOutputScale.toFixed(2)}x</div>
              <div>Front Output Scale: {frontInfo?.outputScale ?? '-'}x</div>
              <div>Quality Status: {qualityStatus}</div>
              <div>Render Failed: {renderFailed ? 'YES' : 'NO'}</div>
            </div>
            
            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Render Race Diagnostics</div>
              <div>Target Page: {pageNumber}</div>
              <div>Front Page: {frontInfo?.pageNumber ?? '-'}</div>
              <div>Engine Generation: {engineRef.current?.generation ?? '-'}</div>
              <div>Front Generation: {frontInfo?.generation ?? '-'}</div>
              <div>Requested Quality Scale: {targetOutputScale.toFixed(2)}x</div>
              <div>Calculated Effective Scale: {effectiveOutputScale.toFixed(2)}x</div>
              <div>Front Effective Scale: {frontInfo?.outputScale ?? '-'}x</div>
              <div>Quality Status: {qualityStatus}</div>
              <div>Render Failed: {renderFailed ? 'YES' : 'NO'}</div>

              <div className="mt-2 pt-2 border-t border-white/5">
                {lastRenderResult ? (
                  <div className="space-y-1">
                    <div>Last Status: {lastRenderResult.status}</div>
                    <div>Last Request ID: {lastRenderResult.requestId}</div>
                    <div>Last Generation: {lastRenderResult.generation}</div>
                    <div>Last Page: {lastRenderResult.pageNumber}</div>
                    <div>Last Requested Scale: {lastRenderResult.requestedOutputScale.toFixed(2)}x</div>
                    <div>Last Effective Scale: {lastRenderResult.outputScale.toFixed(2)}x</div>
                    <div>Last CSS Size: {lastRenderResult.cssWidth.toFixed(1)} × {lastRenderResult.cssHeight.toFixed(1)}</div>
                    <div>Last Pixel Size: {lastRenderResult.pixelWidth} × {lastRenderResult.pixelHeight}</div>
                    <div>Last Pixel Count: {(lastRenderResult.pixelWidth * lastRenderResult.pixelHeight).toLocaleString()}</div>
                    <div>Last Duration: {lastRenderResult.renderDurationMs.toFixed(1)}ms</div>
                  </div>
                ) : (
                  <div>Last Render Result: NONE</div>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-white/5">
                {lastRenderError ? (
                  <div className="space-y-1">
                    <div>Error Code: {lastRenderError.code}</div>
                    <div className="break-words">Error Message: {lastRenderError.message}</div>
                  </div>
                ) : (
                  <div>Last Render Error: NONE</div>
                )}
              </div>
            </div>

            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Mobile Pixel Budget Preview</div>
              <div>Mode: ENGINE PREFLIGHT + CURRENT BASELINE</div>
              <div>Budget Enforcement: ACTIVE</div>
              <div>First Unseen Page Preflight: ACTIVE</div>
              <div>Scale Limited: {isOutputScaleLimited ? 'YES' : 'NO'}</div>
              <div>Max Pixels: {V2_MAX_CANVAS_PIXELS.toLocaleString()}</div>
              <div>Max Edge: {V2_MAX_CANVAS_EDGE}px</div>
              {budgetPreview && (
                <div className="mt-2 space-y-1 pt-2 border-t border-white/5">
                  <div>CSS Size: {budgetPreview.cssWidth.toFixed(1)} × {budgetPreview.cssHeight.toFixed(1)}</div>
                  <div>Requested Output Scale: {budgetPreview.requestedOutputScale.toFixed(2)}x</div>
                  <div>Applied Effective Scale: {budgetPreview.effectiveOutputScale.toFixed(2)}x</div>
                  <div>Requested Pixel Size: {budgetPreview.requestedPixelWidth} × {budgetPreview.requestedPixelHeight}</div>
                  <div>Requested Pixel Count: {budgetPreview.requestedPixelCount.toLocaleString()}</div>
                  <div>Budget Pixel Size: {budgetPreview.effectivePixelWidth} × {budgetPreview.effectivePixelHeight}</div>
                  <div>Budget Pixel Count: {budgetPreview.effectivePixelCount.toLocaleString()}</div>
                  <div>Estimated RGBA / Canvas: {formatMiB(budgetPreview.estimatedBytesPerCanvas)} MiB</div>
                  <div>Estimated Front + Back: {formatMiB(budgetPreview.estimatedDoubleBufferBytes)} MiB</div>
                  <div>Limited By: {budgetPreview.limitReason}</div>
                  <div>Budget Satisfied: {budgetPreview.budgetSatisfied ? 'YES' : 'NO'}</div>
                </div>
              )}
            </div>

            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Annotation V2 Baseline</div>


<div>Annotation Stage: 4E-C4K-A</div>
              <div>Persistence Schema: CONNECTED</div>

              <div>Persistence Codec: CONNECTED</div>
              <div>Firebase Storage Adapter: CONNECTED</div>
              <div>Empty Snapshot Save: SUPPORTED</div>
              <div>Empty Snapshot Restore: SUPPORTED</div>
              <div>Persistence Completion Scope: UID + IDENTITY + DOCUMENT + SEQUENCE</div>
              <div>Stale Save Completion: IGNORED</div>
              <div>Stale Load Completion: IGNORED</div>
              <div>Cross-Document Restore: BLOCKED</div>
              <div>Persistent Save: MANUAL DIAGNOSTIC ONLY</div>
              <div>Persistent Load: MANUAL VERIFY ONLY</div>
              <div>Automatic Save: CONNECTED — 2S DEBOUNCE</div>
              <div>Automatic Load: DISABLED</div>

              <div>Stroke Tool Model: TYPED</div>
              <div>Stroke Style Storage: PER STROKE</div>
              <div>Active Tool: {activeDrawingTool.toUpperCase()}</div>
              <div>Active Color: {activeDrawingStyle.color}</div>
              <div>Active Width: {activeDrawingStyle.width} LOGICAL PX</div>
              <div>Active Opacity: {activeDrawingStyle.opacity}</div>
              <div>Selected Highlighter Color: {activeHighlighterStyle.color}</div>
              <div>Selected Highlighter Width: {activeHighlighterStyle.width} LOGICAL PX</div>
              <div>Selected Highlighter Opacity: {activeHighlighterStyle.opacity}</div>
              <div>Pen Style Controls: CONNECTED</div>
              <div>Highlighter Input: CONNECTED</div>
              <div>Highlighter Style Controls: CONNECTED</div>
              <div>Highlighter Opacity Control: NOT ENABLED</div>
              <div>Highlighter Blend: SOURCE-OVER</div>
              <div>Style Persistence: MEMORY ONLY</div>
              <div>Interaction Mode: {interactionMode.toUpperCase()}</div>
              <div>Surface: {annotationPageSpace ? 'ACTIVE' : 'WAITING FOR CURRENT PAGE BASELINE'}</div>
              <div>Coordinate Space: NORMALIZED 0..1</div>
              <div>Input Phase: {inputStatus.phase.toUpperCase()}</div>
              <div>Active Pointer ID: {inputStatus.activePointerId !== null ? inputStatus.activePointerId : 'NONE'}</div>
              <div>Active Pointer Type: {inputStatus.activePointerType ? inputStatus.activePointerType.toUpperCase() : 'NONE'}</div>
              <div>Active Point Count: {inputStatus.currentPointCount}</div>
              <div>Current Page Stroke Count: {currentPageStrokes.length}</div>
              <div>Current Page Total Point Count: {totalPoints}</div>
              <div>History Mode: MEMORY ONLY</div>
              <div>History Actions: ADD + ERASE</div>
              <div>Eraser Input: CONNECTED</div>
              <div>Erase Latest Available: {currentPageStrokes.length > 0 && docReady && annotationPageSpace && !isGestureActive && inputStatus.phase === 'idle' ? 'YES' : 'NO'}</div>
              <div>History Scope: CURRENT PAGE</div>
              <div>Undo Depth: {undoDepth}</div>
              <div>Redo Depth: {redoDepth}</div>
              <div>History Action Blocked: {(!docReady || !annotationPageSpace || isGestureActive || inputStatus.phase !== 'idle') ? 'YES' : 'NO'}</div>
              <div>Mouse Drawing: {interactionMode === 'pen' ? 'ENABLED' : 'DISABLED'}</div>
              <div>Stylus Pen Drawing: {interactionMode === 'pen' ? 'ENABLED' : 'DISABLED'}</div>
              <div>Touch Eraser: ENABLED</div>
              <div>Erase Model: WHOLE STROKE</div>
              <div>Erase Commit: POINTERUP ONLY</div>
              <div>First Touch in Eraser: PENDING ERASE + VIEWPORT DEFER</div>
              <div>Second Touch: DISCARD PENDING ERASE + PINCH HANDOFF</div>
              <div>Touch Suppressed Until Release: {inputStatus.touchSuppressedUntilRelease ? 'YES' : 'NO'}</div>
              <div>First Touch Capture Owner: ANNOTATION</div>
              <div>Pinch Capture Owner: VIEWPORT</div>
              <div>After Pinch One Touch: PAN ONLY</div>
              <div>New Touch Erase After Pointers 0: ENABLED</div>
              <div>Eraser Radius: 12 LOGICAL PX</div>
              <div>Storage: MEMORY ONLY</div>
              <div>V1 Data Connection: NONE</div>
            </div>

            {frontInfo && (
              <div className="bg-stone-950 p-3 rounded text-xs space-y-1 font-mono text-stone-400 border border-white/5">
                <div>Req ID: {frontInfo.requestId}</div>
                <div>CSS Size: {frontInfo.cssWidth.toFixed(1)} x {frontInfo.cssHeight.toFixed(1)}</div>
                <div>Front Pixel Size: {frontInfo.pixelWidth} x {frontInfo.pixelHeight}</div>
                <div>Front Pixel Count: {(frontInfo.pixelWidth * frontInfo.pixelHeight).toLocaleString()}</div>
                <div>Front RGBA Estimate: {formatMiB(frontInfo.pixelWidth * frontInfo.pixelHeight * 4)} MiB</div>
              </div>
            )}
            
            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Gesture State</div>
              <div>Viewer Touch Scroll Guard: ACTIVE</div>
              <div>Phase: {transformInfo?.phase || 'idle'}</div>
              <div>Pointers: {transformInfo?.activePointerCount || 0}</div>
              <div>Scale: {transformInfo?.transform.scale.toFixed(2) || '1.00'}x</div>
              <div>Translate: {transformInfo?.transform.translateX.toFixed(1) || '0.0'}, {transformInfo?.transform.translateY.toFixed(1) || '0.0'}</div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
              <button 
                onClick={setNavigateMode} 
                disabled={modeControlsDisabled}
                className={`px-3 py-2 rounded text-sm font-semibold border border-white/10 disabled:opacity-50 ${interactionMode === 'navigate' ? 'bg-blue-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-300'}`}
                aria-pressed={interactionMode === 'navigate'}
              >
                이동
              </button>
              <button 
                onClick={setPenMode} 
                disabled={modeControlsDisabled}
                className={`px-3 py-2 rounded text-sm font-semibold border border-white/10 disabled:opacity-50 ${interactionMode === 'pen' && activeDrawingTool === 'pen' ? 'bg-blue-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-300'}`}
                aria-pressed={interactionMode === 'pen' && activeDrawingTool === 'pen'}
              >
                펜
              </button>
              <button 
                onClick={setHighlighterMode} 
                disabled={modeControlsDisabled}
                className={`px-3 py-2 rounded text-sm font-semibold border border-white/10 disabled:opacity-50 ${interactionMode === 'pen' && activeDrawingTool === 'highlighter' ? 'bg-yellow-600 text-stone-900 border-yellow-500' : 'bg-stone-800 hover:bg-stone-700 text-stone-300'}`}
                aria-pressed={interactionMode === 'pen' && activeDrawingTool === 'highlighter'}
              >
                형광펜
              </button>
              <button 
                onClick={setEraserMode} 
                disabled={modeControlsDisabled}
                className={`px-3 py-2 rounded text-sm font-semibold border border-white/10 disabled:opacity-50 ${interactionMode === 'eraser' ? 'bg-blue-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-300'}`}
                aria-pressed={interactionMode === 'eraser'}
              >
                지우개
              </button>
            </div>
            
            <div className={`bg-stone-950 p-3 rounded border border-white/5 space-y-3 ${activeDrawingTool !== 'pen' ? 'opacity-50' : ''}`}>
              <div className="text-xs font-semibold text-stone-400">Pen Style &mdash; 펜 전용</div>
              <div className="flex gap-2">
                {PEN_COLOR_PRESETS_V2.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-label={preset.label}
                    aria-pressed={activePenStyle.color === preset.color}
                    disabled={penStyleControlsDisabled}
                    onClick={() => setActivePenStyle(prev => ({ ...prev, color: preset.color }))}
                    className={`w-8 h-8 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-900 focus:ring-blue-500 disabled:opacity-50 ${activePenStyle.color === preset.color ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: preset.color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {PEN_WIDTH_PRESETS_V2.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={activePenStyle.width === preset.width}
                    disabled={penStyleControlsDisabled}
                    onClick={() => setActivePenStyle(prev => ({ ...prev, width: preset.width }))}
                    className={`flex-1 px-2 py-1 rounded text-xs font-medium border ${activePenStyle.width === preset.width ? 'bg-blue-600 border-blue-500 text-white' : 'bg-stone-800 border-white/10 text-stone-300 hover:bg-stone-700'} disabled:opacity-50`}
                  >
                    {preset.label} {preset.width}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={`bg-stone-950 p-3 rounded border border-white/5 space-y-3 ${activeDrawingTool !== 'highlighter' ? 'opacity-50' : ''}`}>
              <div className="text-xs font-semibold text-stone-400">Highlighter Style &mdash; 형광펜 전용</div>
              <div className="flex gap-2">
                {HIGHLIGHTER_COLOR_PRESETS_V2.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-label={`${preset.label} 형광펜`}
                    aria-pressed={activeHighlighterStyle.color === preset.color}
                    disabled={highlighterStyleControlsDisabled}
                    onClick={() => setActiveHighlighterStyle(prev => ({ ...prev, color: preset.color }))}
                    className={`w-8 h-8 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-900 focus:ring-blue-500 disabled:opacity-50 ${activeHighlighterStyle.color === preset.color ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: preset.color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {HIGHLIGHTER_WIDTH_PRESETS_V2.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={activeHighlighterStyle.width === preset.width}
                    disabled={highlighterStyleControlsDisabled}
                    onClick={() => setActiveHighlighterStyle(prev => ({ ...prev, width: preset.width }))}
                    className={`flex-1 px-2 py-1 rounded text-xs font-medium border ${activeHighlighterStyle.width === preset.width ? 'bg-yellow-600 border-yellow-500 text-stone-900' : 'bg-stone-800 border-white/10 text-stone-300 hover:bg-stone-700'} disabled:opacity-50`}
                  >
                    {preset.label} {preset.width}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-stone-500">Opacity: 0.35 fixed | Blend: source-over</div>
            </div>

            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Persistence Round-Trip Diagnostic</span>
              </div>
              <div className="text-xs text-stone-400 space-y-1">
                <div>Mode: IN-MEMORY ONLY</div>
                <div>Firebase Storage: NOT USED BY THIS TEST</div>
                <div>History Replacement: DISABLED</div>
              </div>
              
              <button
                type="button"
                onClick={handleRunPersistenceRoundTrip}
                disabled={!docReady || !currentBaseline || isLoading || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null || (transformInfo !== null && (transformInfo.phase !== 'idle' || transformInfo.activePointerCount > 0))}
                className="w-full px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-brand-light text-brand-dark hover:bg-brand-light/90 disabled:opacity-50 disabled:bg-stone-800 disabled:text-stone-400"
              >
                Run In-Memory Round Trip
              </button>

              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className={`font-bold ${persistenceDiagnostic.status === 'passed' ? 'text-emerald-400' : persistenceDiagnostic.status === 'failed' ? 'text-red-400' : 'text-stone-400'}`}>
                  Status: {persistenceDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Document Instance: {persistenceDiagnostic.documentInstanceId !== null ? persistenceDiagnostic.documentInstanceId : 'NOT RUN'}</div>
                <div className="text-stone-300">Source Strokes: {persistenceDiagnostic.status !== 'idle' ? persistenceDiagnostic.sourceStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Restored Strokes: {persistenceDiagnostic.status !== 'idle' ? persistenceDiagnostic.restoredStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Source Points: {persistenceDiagnostic.status !== 'idle' ? persistenceDiagnostic.sourcePointCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Restored Points: {persistenceDiagnostic.status !== 'idle' ? persistenceDiagnostic.restoredPointCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Pen Strokes: {persistenceDiagnostic.status !== 'idle' ? persistenceDiagnostic.penStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Highlighter Strokes: {persistenceDiagnostic.status !== 'idle' ? persistenceDiagnostic.highlighterStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">JSON Bytes: {persistenceDiagnostic.status !== 'idle' ? persistenceDiagnostic.jsonByteLength : 'NOT RUN'}</div>
                
                <div className="mt-2 border-t border-white/10 pt-2 text-stone-400">
                  <div>Codec Validation: <span className={persistenceDiagnostic.status !== 'idle' ? (persistenceDiagnostic.codecValidationPassed ? 'text-emerald-400' : 'text-red-400') : ''}>{persistenceDiagnostic.status === 'idle' ? 'NOT RUN' : (persistenceDiagnostic.codecValidationPassed ? 'PASS' : 'FAIL')}</span></div>
                  <div>Stroke Fidelity: <span className={persistenceDiagnostic.status !== 'idle' ? (persistenceDiagnostic.strokeFidelityPassed ? 'text-emerald-400' : 'text-red-400') : ''}>{persistenceDiagnostic.status === 'idle' ? 'NOT RUN' : (persistenceDiagnostic.strokeFidelityPassed ? 'PASS' : 'FAIL')}</span></div>
                  <div>Identity Mismatch Defense: <span className={persistenceDiagnostic.status !== 'idle' ? (persistenceDiagnostic.identityMismatchDefensePassed ? 'text-emerald-400' : 'text-red-400') : ''}>{persistenceDiagnostic.status === 'idle' ? 'NOT RUN' : (persistenceDiagnostic.identityMismatchDefensePassed ? 'PASS' : 'FAIL')}</span></div>
                  <div>Legacy Pointer Fallback: <span className={persistenceDiagnostic.status !== 'idle' && persistenceDiagnostic.legacyPointerFallbackPassed !== null ? (persistenceDiagnostic.legacyPointerFallbackPassed ? 'text-emerald-400' : 'text-red-400') : ''}>{persistenceDiagnostic.status === 'idle' || persistenceDiagnostic.legacyPointerFallbackPassed === null ? 'NOT RUN' : (persistenceDiagnostic.legacyPointerFallbackPassed ? 'PASS' : 'FAIL')}</span></div>
                </div>

                {persistenceDiagnostic.errorCode && (
                  <div className="mt-2 text-red-400 border-t border-red-500/20 pt-2">
                    <div>Error Code: {persistenceDiagnostic.errorCode}</div>
                    {persistenceDiagnostic.errorPath && <div>Error Path: {persistenceDiagnostic.errorPath}</div>}
                    <div>Error Message: {persistenceDiagnostic.errorMessage}</div>
                  </div>
                )}
                {!persistenceDiagnostic.errorCode && persistenceDiagnostic.status !== 'idle' && (
                  <div className="mt-2 text-emerald-400 border-t border-emerald-500/20 pt-2">
                    Error: NONE
                  </div>
                )}
              </div>
            </div>
            

            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Autosave Eligibility</span>
              </div>
              <div className="text-xs text-stone-400 space-y-1">
                <div>Autosave Stage: SERIALIZED COMMIT</div>
                <div>Automatic Upload: ENABLED</div>
                <div>Debounce Delay: 2000 MS</div>
              </div>
              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className={`font-bold ${autosaveEligibilityDiagnostic.status === 'clean' || autosaveEligibilityDiagnostic.status === 'ready' ? 'text-emerald-400' : autosaveEligibilityDiagnostic.status === 'scheduled' || autosaveEligibilityDiagnostic.status === 'waiting' ? 'text-yellow-400' : autosaveEligibilityDiagnostic.status === 'blocked' ? 'text-red-400' : 'text-stone-400'}`}>
                  Status: {autosaveEligibilityDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Reason: {autosaveEligibilityDiagnostic.reason ?? 'NONE'}</div>
                <div className="text-stone-300">Document Instance: {autosaveEligibilityDiagnostic.documentInstanceId ?? 'NONE'}</div>
                <div className="text-stone-300">Scheduled Strokes: {autosaveEligibilityDiagnostic.scheduledStrokeCount}</div>
                <div className="text-stone-300">Scheduled Points: {autosaveEligibilityDiagnostic.scheduledPointCount}</div>
                <div className="text-stone-300">Schedule Sequence: {autosaveEligibilityDiagnostic.scheduleSequence}</div>
                <div className="text-stone-300">Last Autosave Commit Sequence: {lastAutosaveCommitSequenceRef.current ?? 'NONE'}</div>
                <div className="text-stone-300">Timer Armed: {annotationAutosaveTimerRef.current !== null ? 'YES' : 'NO'}</div>
                <div className="text-stone-300">Manual Snapshot Awaiting Decision: {manualSnapshotAwaitingDecision ? 'YES' : 'NO'}</div>
                <div className="text-stone-300">Automatic Snapshot Decision Pending: {automaticSnapshotDecisionPending ? 'YES' : 'NO'}</div>
                <div className="text-stone-300">Autosave Commit Gate: {!isAutosaveBlockedBySnapshotState ? 'OPEN' : 'BLOCKED'}</div>
                <div className="text-stone-300">Visibility-Hidden Early Save: CONNECTED</div>
                <div className="text-stone-300">Pagehide Auxiliary Save Signal: CONNECTED</div>
                <div className="text-stone-300">Visibility-Visible Retry: CONNECTED</div>
                <div className="text-stone-300">Last Lifecycle Request: {lifecycleAutosaveRequestDiagnostic.trigger?.toUpperCase() ?? 'NONE'}</div>
                <div className="text-stone-300">Lifecycle Request Time: {lifecycleAutosaveRequestDiagnostic.requestedAt ?? 'NONE'}</div>
                <div className="text-stone-300">Lifecycle Request Instance: {lifecycleAutosaveRequestDiagnostic.documentInstanceId ?? 'NONE'}</div>
                <div className="text-stone-300">Lifecycle Request Sequence: {lifecycleAutosaveRequestDiagnostic.scheduleSequence ?? 'NONE'}</div>
                <div className={`font-bold ${remoteTabChangeDiagnostic.status === 'listening' ? 'text-emerald-400' : remoteTabChangeDiagnostic.status === 'detected' || remoteTabChangeDiagnostic.status === 'error' ? 'text-red-400' : 'text-stone-400'}`}>
                  Same-Browser Tab Monitor: {remoteTabChangeDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Other-Tab Save Gate: {remoteTabChangeDetected ? 'BLOCKED' : 'OPEN'}</div>
                <div className="text-stone-300">Other-Tab Save Time: {remoteTabChangeDiagnostic.remoteUpdatedAt ?? 'NONE'}</div>
                <div className="text-stone-300">Conflict Recovery: {remoteTabChangeDetected ? 'LOAD + RESTORE REQUIRED' : 'NOT REQUIRED'}</div>
                {remoteTabChangeDiagnostic.errorMessage && <div className="text-red-400">Tab Monitor Error: {remoteTabChangeDiagnostic.errorMessage}</div>}
                <div className="text-stone-300">Firebase Write on Ready: ENABLED</div>
              </div>
              {remoteTabChangeDetected && (
                <div className="rounded border border-red-500/30 bg-red-950/40 p-3 text-xs leading-relaxed text-red-200">
                  Another browser tab saved this score. Saving in this tab is paused so the newer work is not overwritten. Load the current snapshot below, then restore it to continue safely.
                </div>
              )}
            </div>
            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Firebase Storage Save Diagnostic</span>
              </div>
              <div className="text-xs text-stone-400 space-y-1">
                <div>Mode: MANUAL + DEBOUNCED AUTOSAVE</div>
                <div>Firebase Storage: ADAPTER CONNECTED</div>
                <div>Empty Snapshot Save: ENABLED WHEN DIRTY</div>
                <div>Empty Snapshot Storage: CURRENT.JSON</div>
                <div>Storage Delete: DISABLED</div>
                <div>Automatic Save: CONNECTED — 2S DEBOUNCE</div>
              </div>
              
              <button
                type="button"
                onClick={() => { void handleSavePersistenceToStorage('manual'); }}
                disabled={!user || !user.uid || !docReady || !currentBaseline || !persistenceStorageIdentity || isLoading || !hasPersistableAnnotationState || isGestureActive || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null || persistenceStorageSaveDiagnostic.status === 'saving' || remoteTabChangeDetected}
                className="w-full px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-brand-light text-brand-dark hover:bg-brand-light/90 disabled:opacity-50 disabled:bg-stone-800 disabled:text-stone-400"
              >
                {persistenceStorageSaveDiagnostic.status === 'saving' ? 'Saving...' : 'Save Current Annotation Snapshot'}
              </button>

              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className={`font-bold ${persistenceStorageSaveDiagnostic.status === 'saved' ? 'text-emerald-400' : (persistenceStorageSaveDiagnostic.status === 'invalid' || persistenceStorageSaveDiagnostic.status === 'error') ? 'text-red-400' : persistenceStorageSaveDiagnostic.status === 'saving' ? 'text-yellow-400' : 'text-stone-400'}`}>
                  Status: {persistenceStorageSaveDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Save Origin: {persistenceSaveOrigin ? persistenceSaveOrigin.toUpperCase() : 'NONE'}</div>
                <div className="text-stone-300">Save In Flight: {persistenceSaveInFlightRef.current !== null ? 'YES' : 'NO'}</div>
                <div className="text-stone-300">Document Instance: {persistenceStorageSaveDiagnostic.documentInstanceId !== null ? persistenceStorageSaveDiagnostic.documentInstanceId : 'NONE'}</div>
                <div className="text-stone-300">Storage Path: {persistenceStorageSaveDiagnostic.storagePath !== null ? persistenceStorageSaveDiagnostic.storagePath : 'NOT RUN'}</div>
                <div className="text-stone-300">Saved Stroke Count: {persistenceStorageSaveDiagnostic.status !== 'idle' ? persistenceStorageSaveDiagnostic.sourceStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Source Points: {persistenceStorageSaveDiagnostic.status !== 'idle' ? persistenceStorageSaveDiagnostic.sourcePointCount : 'NOT RUN'}</div>
                <div className="text-stone-300">JSON Bytes: {persistenceStorageSaveDiagnostic.status !== 'idle' ? persistenceStorageSaveDiagnostic.jsonByteLength : 'NOT RUN'}</div>
                <div className="text-stone-300">Snapshot Content: {persistenceStorageSaveDiagnostic.status !== 'idle' ? (persistenceStorageSaveDiagnostic.sourceStrokeCount === 0 ? 'EMPTY' : 'NON-EMPTY') : 'NOT RUN'}</div>

                {(persistenceStorageSaveDiagnostic.errorCode) && (
                  <div className="mt-2 text-red-400 border-t border-red-500/20 pt-2">
                    <div>Error Code: {persistenceStorageSaveDiagnostic.errorCode}</div>
                    {persistenceStorageSaveDiagnostic.errorPath && <div>Error Path: {persistenceStorageSaveDiagnostic.errorPath}</div>}
                    <div>Error Message: {persistenceStorageSaveDiagnostic.errorMessage}</div>
                  </div>
                )}
                {!persistenceStorageSaveDiagnostic.errorCode && persistenceStorageSaveDiagnostic.status !== 'idle' && persistenceStorageSaveDiagnostic.status !== 'saving' && (
                  <div className="mt-2 text-emerald-400 border-t border-emerald-500/20 pt-2">
                    Error: NONE
                  </div>
                )}
              </div>
            </div>

            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Firebase Storage Load Diagnostic</span>
              </div>
              <div className="text-xs text-stone-400 space-y-1">
                <div>Mode: MANUAL LOAD + VERIFY ONLY</div>
                <div>Empty Snapshot Load: SUPPORTED</div>
                <div>Empty Snapshot Restore: SUPPORTED</div>
                <div>Automatic Load: DISABLED</div>
                <div>History Replacement: DISABLED</div>
                <div>Canvas Mutation: DISABLED</div>
              </div>
              
              <button
                type="button"
                onClick={() => { void handleLoadPersistenceFromStorage('manual'); }}
                disabled={!user || !user.uid || !docReady || !persistenceStorageIdentity || isLoading || isGestureActive || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null || persistenceStorageSaveDiagnostic.status === 'saving' || persistenceStorageLoadDiagnostic.status === 'loading'}
                className="w-full px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-brand-light text-brand-dark hover:bg-brand-light/90 disabled:opacity-50 disabled:bg-stone-800 disabled:text-stone-400"
              >
                {persistenceStorageLoadDiagnostic.status === 'loading' ? 'Loading...' : 'Load Current Annotation Snapshot'}
              </button>

              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className={`font-bold ${persistenceStorageLoadDiagnostic.status === 'loaded' ? 'text-emerald-400' : (persistenceStorageLoadDiagnostic.status === 'invalid' || persistenceStorageLoadDiagnostic.status === 'error') ? 'text-red-400' : (persistenceStorageLoadDiagnostic.status === 'not-found' || persistenceStorageLoadDiagnostic.status === 'loading') ? 'text-yellow-400' : 'text-stone-400'}`}>
                  Status: {persistenceStorageLoadDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Current Document Instance: {persistenceStorageLoadDiagnostic.currentDocumentInstanceId !== null ? persistenceStorageLoadDiagnostic.currentDocumentInstanceId : 'NONE'}</div>
                <div className="text-stone-300">Persisted Document Instance: {persistenceStorageLoadDiagnostic.persistedDocumentInstanceId !== null ? persistenceStorageLoadDiagnostic.persistedDocumentInstanceId : 'NONE'}</div>
                <div className="text-stone-300">Storage Path: {persistenceStorageLoadDiagnostic.storagePath !== null ? persistenceStorageLoadDiagnostic.storagePath : 'NOT RUN'}</div>
                <div className="text-stone-300">Loaded Pages: {persistenceStorageLoadDiagnostic.status === 'loaded' ? persistenceStorageLoadDiagnostic.loadedPageCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Loaded Snapshot Stroke Count: {persistenceStorageLoadDiagnostic.status === 'loaded' ? persistenceStorageLoadDiagnostic.loadedStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Loaded Points: {persistenceStorageLoadDiagnostic.status === 'loaded' ? persistenceStorageLoadDiagnostic.loadedPointCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Loaded Pen Strokes: {persistenceStorageLoadDiagnostic.status === 'loaded' ? persistenceStorageLoadDiagnostic.loadedPenStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Loaded Highlighter Strokes: {persistenceStorageLoadDiagnostic.status === 'loaded' ? persistenceStorageLoadDiagnostic.loadedHighlighterStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">JSON Bytes: {persistenceStorageLoadDiagnostic.status === 'loaded' ? persistenceStorageLoadDiagnostic.jsonByteLength : 'NOT RUN'}</div>
                <div className="text-stone-300">Snapshot Content: {persistenceStorageLoadDiagnostic.status === 'loaded' ? (persistenceStorageLoadDiagnostic.loadedStrokeCount === 0 ? 'EMPTY' : 'NON-EMPTY') : 'NOT RUN'}</div>
                <div className={`text-stone-300 ${persistenceStorageLoadDiagnostic.status === 'loaded' ? (persistenceStorageLoadDiagnostic.codecValidationPassed ? 'text-emerald-400' : 'text-red-400') : ''}`}>Codec Validation: {persistenceStorageLoadDiagnostic.status === 'loaded' ? (persistenceStorageLoadDiagnostic.codecValidationPassed ? 'PASS' : 'FAIL') : 'NOT RUN'}</div>
                <div className={`text-stone-300 ${persistenceStorageLoadDiagnostic.status === 'loaded' ? (persistenceStorageLoadDiagnostic.identityValidationPassed ? 'text-emerald-400' : 'text-red-400') : ''}`}>Identity Validation: {persistenceStorageLoadDiagnostic.status === 'loaded' ? (persistenceStorageLoadDiagnostic.identityValidationPassed ? 'PASS' : 'FAIL') : 'NOT RUN'}</div>
                <div className={`text-stone-300 ${persistenceStorageLoadDiagnostic.currentMemoryFidelityStatus === 'pass' ? 'text-emerald-400' : persistenceStorageLoadDiagnostic.currentMemoryFidelityStatus === 'mismatch' ? 'text-yellow-400' : ''}`}>Current Memory Fidelity: {persistenceStorageLoadDiagnostic.currentMemoryFidelityStatus.toUpperCase()}</div>

                {(persistenceStorageLoadDiagnostic.errorCode) && (
                  <div className="mt-2 text-red-400 border-t border-red-500/20 pt-2">
                    <div>Error Code: {persistenceStorageLoadDiagnostic.errorCode}</div>
                    {persistenceStorageLoadDiagnostic.errorPath && <div>Error Path: {persistenceStorageLoadDiagnostic.errorPath}</div>}
                    <div>Error Message: {persistenceStorageLoadDiagnostic.errorMessage}</div>
                  </div>
                )}
              </div>

            </div>

            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Firebase Storage Restore Diagnostic</span>
              </div>
              <div className="text-xs text-stone-400 space-y-1">
                <div>Mode: EXPLICIT MANUAL RESTORE</div>
                <div>Replace current memory after confirmation</div>
              </div>
              
              <button
                type="button"
                onClick={() => { void handleRestoreLoadedSnapshot('manual'); }}
                disabled={!user || !user.uid || !docReady || !persistenceStorageIdentity || !loadedAnnotationSnapshot || isLoading || isGestureActive || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null || persistenceStorageSaveDiagnostic.status === 'saving' || persistenceStorageLoadDiagnostic.status === 'loading' || annotationRestoreDiagnostic.status === 'restoring'}
                className="w-full px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-brand-light text-brand-dark hover:bg-brand-light/90 disabled:opacity-50 disabled:bg-stone-800 disabled:text-stone-400"
              >
                {annotationRestoreDiagnostic.status === 'restoring' ? 'Restoring...' : 'Restore Loaded Snapshot to Canvas'}
              </button>

              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className={`font-bold ${annotationRestoreDiagnostic.status === 'restored' ? 'text-emerald-400' : (annotationRestoreDiagnostic.status === 'error' || annotationRestoreDiagnostic.status === 'blocked') ? 'text-red-400' : (annotationRestoreDiagnostic.status === 'restoring') ? 'text-yellow-400' : 'text-stone-400'}`}>
                  Restore Status: {annotationRestoreDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Restore Source Path: {annotationRestoreDiagnostic.storagePath !== null ? annotationRestoreDiagnostic.storagePath : 'NONE'}</div>
                <div className="text-stone-300">Loaded Strokes: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.loadedStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Loaded Points: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.loadedPointCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Before Restore Strokes: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.beforeStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Restored Strokes: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.restoredStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Restored Points: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.restoredPointCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Current Document Instance: {annotationRestoreDiagnostic.currentDocumentInstanceId !== null ? annotationRestoreDiagnostic.currentDocumentInstanceId : 'NONE'}</div>
                <div className="text-stone-300">Undo Depth After Restore: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.undoDepthAfterRestore : 'NOT RUN'}</div>
                <div className="text-stone-300">Redo Depth After Restore: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.redoDepthAfterRestore : 'NOT RUN'}</div>
                <div className="text-stone-300">Next Stroke ID Counter: {annotationRestoreDiagnostic.nextStrokeIdCounter !== null ? annotationRestoreDiagnostic.nextStrokeIdCounter : 'NOT RUN'}</div>

                {(annotationRestoreDiagnostic.errorCode) && (
                  <div className="mt-2 text-red-400 border-t border-red-500/20 pt-2">
                    <div>Restore Error Code: {annotationRestoreDiagnostic.errorCode}</div>
                    <div>Restore Error Message: {annotationRestoreDiagnostic.errorMessage}</div>
                  </div>
                )}
                {annotationRestoreDiagnostic.status === 'restored' && (
                  <div className="mt-2 text-emerald-400 border-t border-emerald-500/20 pt-2">
                    Restore Error: NONE
                  </div>
                )}
              </div>

</div>
            
            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Annotation Dirty State</span>
              </div>
              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className={`font-bold ${annotationDirtyStatus === 'clean' ? 'text-emerald-400' : annotationDirtyStatus === 'dirty' ? 'text-yellow-400' : 'text-stone-400'}`}>
                  Dirty Status: {annotationDirtyStatus.toUpperCase()}
                </div>
                <div className="text-stone-300">Unsaved Changes: {annotationDirtyStatus === 'dirty' ? 'YES' : annotationDirtyStatus === 'clean' ? 'NO' : 'UNKNOWN'}</div>
                <div className="text-stone-300">Baseline Source: {annotationCleanBaseline ? annotationCleanBaseline.source.toUpperCase() : 'NONE'}</div>
                <div className="text-stone-300">Baseline Strokes: {annotationCleanBaseline ? annotationCleanBaseline.strokes.length : 'NOT RUN'}</div>
                <div className="text-stone-300">Current Strokes: {annotationDirtyStatus !== 'unavailable' ? currentDocumentStrokes.length : 'NOT RUN'}</div>
                <div className="text-stone-300">Baseline Document Instance: {annotationCleanBaseline ? annotationCleanBaseline.documentInstanceId : 'NONE'}</div>
                <div className="text-stone-300">Current Document Instance: {documentInstanceIdRef.current}</div>
                <div className={`text-stone-300 ${annotationDirtyStatus !== 'unavailable' ? 'text-emerald-400' : 'text-red-400'}`}>Baseline Identity Match: {annotationDirtyStatus !== 'unavailable' ? 'YES' : 'NO'}</div>
              </div>
              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className="text-stone-300">Guard Basis: CONTENT VS CLEAN BASELINE</div>
                <div className="text-stone-300">Replacement Guard: <span className={shouldProtectAnnotationWork ? "text-yellow-400 font-bold" : "text-emerald-400 font-bold"}>{shouldProtectAnnotationWork ? 'ARMED' : 'DISARMED'}</span></div>
                <div className="text-stone-300">Browser Exit Guard: <span className={browserExitGuardArmed ? "text-yellow-400 font-bold" : "text-emerald-400 font-bold"}>{browserExitGuardArmed ? 'ARMED' : 'DISARMED'}</span></div>
                <div className="text-stone-300">Guard Reason: {guardReason}</div>
                <div className="text-stone-300">Autosave Guard Policy: ARMED UNTIL CLEAN</div>
              </div>
            </div>

            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Automatic Snapshot Lookup</span>
              </div>
              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className="text-stone-300">Automatic Lookup: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                <div className="text-stone-300">Lookup Trigger: PDF READY + IDENTITY READY</div>
                <div className="text-stone-300">Lookup Policy: ONCE PER UID / IDENTITY / DOCUMENT INSTANCE</div>
                <div className={`font-bold ${
                  automaticSnapshotLookupDiagnostic.status === 'found' ? 'text-emerald-400' :
                  automaticSnapshotLookupDiagnostic.status === 'looking-up' ? 'text-yellow-400' :
                  (automaticSnapshotLookupDiagnostic.status === 'invalid' || automaticSnapshotLookupDiagnostic.status === 'error') ? 'text-red-400' :
                  'text-stone-400'
                }`}>
                  Status: {automaticSnapshotLookupDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Document Instance: {automaticSnapshotLookupDiagnostic.documentInstanceId ?? 'NONE'}</div>
                <div className="text-stone-300">Storage Path: {automaticSnapshotLookupDiagnostic.storagePath ?? 'NONE'}</div>
                {(automaticSnapshotLookupDiagnostic.status === 'invalid' || automaticSnapshotLookupDiagnostic.status === 'error') && (
                  <>
                    <div className="text-red-400">Error Code: {automaticSnapshotLookupDiagnostic.errorCode ?? 'NONE'}</div>
                    <div className="text-red-400">Error Message: {automaticSnapshotLookupDiagnostic.errorMessage ?? 'NONE'}</div>
                  </>
                )}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
                  <div className="text-stone-300">Automatic Restore: <span className="text-emerald-400 font-bold">CONTROLLED</span></div>
                  <div className="text-stone-300">Restore Policy: CLEAN INITIAL-EMPTY ONLY</div>
                  <div className="text-stone-300">Restore Decision: ONCE PER AUTOMATIC SNAPSHOT</div>
                  <div className={`font-bold ${
                    automaticSnapshotRestoreDiagnostic.status === 'restored' ? 'text-emerald-400' :
                    automaticSnapshotRestoreDiagnostic.status === 'skipped' ? 'text-stone-400' :
                    automaticSnapshotRestoreDiagnostic.status === 'blocked' || automaticSnapshotRestoreDiagnostic.status === 'error' ? 'text-red-400' :
                    automaticSnapshotRestoreDiagnostic.status === 'waiting' || automaticSnapshotRestoreDiagnostic.status === 'restoring' ? 'text-yellow-400' :
                    'text-stone-400'
                  }`}>
                    Restore Status: {automaticSnapshotRestoreDiagnostic.status.toUpperCase()}
                  </div>
                  <div className="text-stone-300">Document Instance: {automaticSnapshotRestoreDiagnostic.documentInstanceId ?? 'NONE'}</div>
                  <div className="text-stone-300">Storage Path: {automaticSnapshotRestoreDiagnostic.storagePath ?? 'NONE'}</div>
                  {automaticSnapshotRestoreDiagnostic.reason && (
                    <div className="text-stone-300">Reason: {automaticSnapshotRestoreDiagnostic.reason}</div>
                  )}
                  <div className="text-stone-400 mt-2">Automatic Save: DISABLED</div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 items-center mt-4">


              <button 
                onClick={handleUndo}
                disabled={undoDepth === 0 || !docReady || !annotationPageSpace || isGestureActive || inputStatus.phase !== 'idle'}
                className="flex-1 px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800"
              >
                Undo
              </button>
              <button 
                onClick={handleRedo}
                disabled={redoDepth === 0 || !docReady || !annotationPageSpace || isGestureActive || inputStatus.phase !== 'idle'}
                className="flex-1 px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800"
              >
                Redo
              </button>
            </div>
            
            <div className="flex gap-2 items-center mt-2">
              <button 
                onClick={handleEraseLatest}
                disabled={currentPageStrokes.length === 0 || !docReady || !annotationPageSpace || isGestureActive || inputStatus.phase !== 'idle'}
                className="w-full px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800"
              >
                Erase Latest
              </button>
            </div>

            <div className="flex gap-2 items-center">
              <button 
                onClick={handlePrevPage} 
                disabled={!docReady || isLoading || pageNumber <= 1}
                className="px-3 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800 rounded text-sm font-semibold border border-white/10"
              >
                이전
              </button>
              <div className="px-2 text-sm font-semibold text-center w-24">
                {docReady ? `${pageNumber} / ${numPages}` : '- / -'}
              </div>
              <button 
                onClick={handleNextPage} 
                disabled={!docReady || isLoading || pageNumber >= numPages}
                className="px-3 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800 rounded text-sm font-semibold border border-white/10"
              >
                다음
              </button>
            </div>
            
            <div className="flex gap-2 items-center">
              <button onClick={handleZoomOut} disabled={isMinScale} className="px-3 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800 rounded text-sm font-semibold border border-white/10">-</button>
              <div className="px-2 text-sm font-semibold text-center w-16">{Math.round(currentScale * 100)}%</div>
              <button onClick={handleZoomIn} disabled={isMaxScale} className="px-3 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800 rounded text-sm font-semibold border border-white/10">+</button>
              <button onClick={handleZoomReset} className="px-3 py-1 bg-stone-800 hover:bg-stone-700 rounded text-sm font-semibold border border-white/10 ml-auto">100%</button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center">
          <div 
            className="bg-stone-950 border border-white/5 rounded-xl flex flex-col"
            style={{
               position: 'relative',
               overflow: 'hidden',
               flex: 'none',
               width: '100%',
               ...(currentBaseline ? {
                 maxWidth: `${currentBaseline.logicalWidth + 24}px`,
                 height: `min(${currentBaseline.logicalHeight + 24}px, calc(100dvh - 230px))`,
                 minHeight: '320px'
               } : {
                 height: 'calc(100dvh - 230px)',
                 minHeight: '320px',
                 maxWidth: '800px'
               })
            }}
          >
            {docReady && engineRef.current && (
              <StableGestureViewportV2 
                key={documentInstanceIdRef.current} 
                ref={viewportRef}
                onTransformChange={handleTransformChange}
                onGestureEnd={handleGestureEnd}
                minScale={1}
                maxScale={3}
                deferSingleTouchPan={interactionMode === 'pen' || interactionMode === 'eraser'}
              >
                <>
                  <PageSurfaceV2
                    engine={engineRef.current}
                    pageNumber={pageNumber}
                    cssScale={PDF_CSS_SCALE}
                    outputScale={effectiveOutputScale}
                    onRenderEvent={handleRenderEvent}
                    onSwap={handleSwap}
                    onRenderError={handleRenderError}
                  />
                  {annotationPageSpace && (
                    <AnnotationSurfaceV2 
                      pageSpace={annotationPageSpace} 
                      interactionMode={interactionMode}
                      completedStrokes={currentPageStrokes}
                      activeTool={activeDrawingTool}
                      activeStyle={activeDrawingStyle}
                      onStrokeComplete={handleStrokeComplete}
                      onEraseRequest={handleEraseRequest}
                      onInputStatusChange={handleInputStatusChange}
                      isGestureActive={isGestureActive}
                    />
                  )}
                </>
              </StableGestureViewportV2>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
