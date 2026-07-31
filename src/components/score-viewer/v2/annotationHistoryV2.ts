import { AnnotationCompletedStrokeV2 } from './annotationTypesV2';

export interface AnnotationHistoryStateV2 {
  completedStrokes: AnnotationCompletedStrokeV2[];
  redoStack: AnnotationCompletedStrokeV2[];
}

export function createEmptyHistoryV2(): AnnotationHistoryStateV2 {
  return {
    completedStrokes: [],
    redoStack: []
  };
}

export function addStrokeToHistoryV2(
  history: AnnotationHistoryStateV2,
  newStroke: AnnotationCompletedStrokeV2
): AnnotationHistoryStateV2 {
  const nextCompletedStrokes = [...history.completedStrokes, newStroke];

  const nextRedoStack = history.redoStack.filter(
    (stroke) =>
      stroke.documentInstanceId !== newStroke.documentInstanceId ||
      stroke.pageNumber !== newStroke.pageNumber
  );

  return {
    completedStrokes: nextCompletedStrokes,
    redoStack: nextRedoStack
  };
}

export function undoPageHistoryV2(
  history: AnnotationHistoryStateV2,
  documentInstanceId: number,
  pageNumber: number
): AnnotationHistoryStateV2 {
  let targetIndex = -1;
  for (let i = history.completedStrokes.length - 1; i >= 0; i--) {
    const stroke = history.completedStrokes[i];
    if (stroke.documentInstanceId === documentInstanceId && stroke.pageNumber === pageNumber) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return history;
  }

  const strokeToUndo = history.completedStrokes[targetIndex];
  
  const nextCompletedStrokes = [...history.completedStrokes];
  nextCompletedStrokes.splice(targetIndex, 1);
  
  const nextRedoStack = [...history.redoStack, strokeToUndo];

  return {
    completedStrokes: nextCompletedStrokes,
    redoStack: nextRedoStack
  };
}

export function redoPageHistoryV2(
  history: AnnotationHistoryStateV2,
  documentInstanceId: number,
  pageNumber: number
): AnnotationHistoryStateV2 {
  let targetIndex = -1;
  for (let i = history.redoStack.length - 1; i >= 0; i--) {
    const stroke = history.redoStack[i];
    if (stroke.documentInstanceId === documentInstanceId && stroke.pageNumber === pageNumber) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return history;
  }

  const strokeToRedo = history.redoStack[targetIndex];
  
  const nextRedoStack = [...history.redoStack];
  nextRedoStack.splice(targetIndex, 1);
  
  const nextCompletedStrokes = [...history.completedStrokes, strokeToRedo];

  return {
    completedStrokes: nextCompletedStrokes,
    redoStack: nextRedoStack
  };
}

export function getPageHistoryDepthV2(
  history: AnnotationHistoryStateV2,
  documentInstanceId: number,
  pageNumber: number
): { undoDepth: number; redoDepth: number } {
  let undoDepth = 0;
  for (let i = 0; i < history.completedStrokes.length; i++) {
    const stroke = history.completedStrokes[i];
    if (stroke.documentInstanceId === documentInstanceId && stroke.pageNumber === pageNumber) {
      undoDepth++;
    }
  }

  let redoDepth = 0;
  for (let i = 0; i < history.redoStack.length; i++) {
    const stroke = history.redoStack[i];
    if (stroke.documentInstanceId === documentInstanceId && stroke.pageNumber === pageNumber) {
      redoDepth++;
    }
  }

  return { undoDepth, redoDepth };
}
