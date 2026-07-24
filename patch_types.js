const fs = require('fs');
const content = `export type GesturePhaseV2 = 'idle' | 'panning' | 'pinching';

export interface GestureTransformV2 {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface GesturePointerV2 {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
}

export interface GestureTransformEventV2 {
  phase: GesturePhaseV2;
  transform: GestureTransformV2;
  activePointerCount: number;
  pointerMoveCount: number;
  appliedFrameCount: number;
  maxFrameGapMs: number;
  sessionId: number | null;
  transformRevision: number;
}

export type GestureEndReasonV2 = 'pointer-up' | 'pointer-cancel' | 'lost-pointer-capture' | 'window-blur' | 'visibility-hidden' | 'imperative-cancel';

export interface GestureEndEventV2 {
  sessionId: number;
  endEventId: number;
  reason: GestureEndReasonV2;
  previousPhase: GesturePhaseV2;
  hadPinch: boolean;
  lastPinchViewportX: number | null;
  lastPinchViewportY: number | null;
  transformRevision: number;
  transform: GestureTransformV2;
  activePointerCount: number;
  pointerMoveCount: number;
  appliedFrameCount: number;
  endedAt: number;
}

export interface VisualRectangleSnapshotV2 {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GestureScaleHandoffSnapshotV2 {
  snapshotId: number;
  transformRevision: number;
  originX: number;
  originY: number;
  anchorViewportX: number;
  anchorViewportY: number;
  anchorLocalX: number;
  anchorLocalY: number;
  visualRect: VisualRectangleSnapshotV2;
  sourceLayoutWidth: number;
  sourceLayoutHeight: number;
  sourceVisualBaseScale: number;
  transform: GestureTransformV2;
  capturedAt: number;
}

export type GestureScaleHandoffStatusV2 = 'applied' | 'invalid';

export interface GestureActiveSessionRebaseV2 {
  phase: GesturePhaseV2;
  activePointerCount: number;
  panRebased: boolean;
  pinchRebased: boolean;
  rebaseRevision: number;
}

export interface GestureScaleHandoffResultV2 {
  status: GestureScaleHandoffStatusV2;
  wasScaleClamped: boolean;
  unclampedPreviewScale: number;
  clampedPreviewScale: number;
  effectiveScaleAfter: number;
  transform: GestureTransformV2;
  baseScaleRatio: number;
  previousOriginX: number;
  previousOriginY: number;
  nextOriginX: number;
  nextOriginY: number;
  previousVisualRect: VisualRectangleSnapshotV2 | null;
  nextVisualRect: VisualRectangleSnapshotV2 | null;
  visualDeltaLeft: number;
  visualDeltaTop: number;
  visualDeltaWidth: number;
  visualDeltaHeight: number;
  completedAt: number;
  activeSessionRebase: GestureActiveSessionRebaseV2 | null;
}

export interface GestureViewportV2Handle {
  resetTransform(): void;
  getTransform(): GestureTransformV2;
  getPhase(): GesturePhaseV2;
  cancelActiveGesture(): void;
  prepareScaleHandoff(sourceVisualBaseScale: number, anchorViewportX?: number, anchorViewportY?: number): GestureScaleHandoffSnapshotV2 | null;
  completeScaleHandoff(snapshot: GestureScaleHandoffSnapshotV2, sourceVisualBaseScale: number, targetVisualBaseScale: number): GestureScaleHandoffResultV2;
}
`;
fs.writeFileSync('src/components/score-viewer/v2/gestureTypes.ts', content);
