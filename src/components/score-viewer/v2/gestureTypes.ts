export type GesturePhaseV2 = 'idle' | 'panning' | 'pinching';

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

export interface GestureScaleHandoffSnapshotV2 {
  snapshotId: number;
  transformRevision: number;
  originX: number;
  originY: number;
  anchorViewportX: number;
  anchorViewportY: number;
  anchorLocalX: number;
  anchorLocalY: number;
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
  transform: GestureTransformV2;
  baseScaleRatio: number;
  previousOriginX: number;
  previousOriginY: number;
  nextOriginX: number;

  nextOriginY: number;
  completedAt: number;
  activeSessionRebase: GestureActiveSessionRebaseV2;
}

export interface GestureViewportV2Handle {
  resetTransform(): void;
  getTransform(): GestureTransformV2;
  getPhase(): GesturePhaseV2;
  cancelActiveGesture(): void;
  prepareScaleHandoff(anchorViewportX?: number, anchorViewportY?: number): GestureScaleHandoffSnapshotV2 | null;
  completeScaleHandoff(snapshot: GestureScaleHandoffSnapshotV2, baseScaleRatio: number): GestureScaleHandoffResultV2;
}
