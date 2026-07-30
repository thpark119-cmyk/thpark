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

export interface StablePageBaselineV2 {
  documentInstanceId: number;
  pageNumber: number;
  logicalWidth: number;
  logicalHeight: number;
}
