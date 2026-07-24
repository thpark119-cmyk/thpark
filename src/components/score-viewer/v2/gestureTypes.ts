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
}

export interface GestureViewportV2Handle {
  resetTransform(): void;
  getTransform(): GestureTransformV2;
  getPhase(): GesturePhaseV2;
  cancelActiveGesture(): void;
}
