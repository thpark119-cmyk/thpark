export type StableGesturePhaseV2 = 'idle' | 'panning' | 'pinching';

export interface StableGestureTransformV2 {
  scale: number;
  translateX: number;
  translateY: number;
}

export const STABLE_IDENTITY_TRANSFORM_V2: StableGestureTransformV2 = {
  scale: 1,
  translateX: 0,
  translateY: 0
};

export interface StableGestureTransformEventV2 {
  phase: StableGesturePhaseV2;
  transform: StableGestureTransformV2;
  activePointerCount: number;
}

export interface StableGestureViewportV2Handle {
  getTransform(): StableGestureTransformV2;
  setScale(scale: number): void;
  resetTransform(): void;
  cancelActiveGesture(): void;
}

export interface StablePageBaselineV2 {
  documentInstanceId: number;
  pageNumber: number;
  logicalWidth: number;
  logicalHeight: number;
}
