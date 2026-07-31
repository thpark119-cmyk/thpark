import { AnnotationCompletedStrokeV2 } from './annotationTypesV2';

export type AnnotationHistoryActionTypeV2 = 'add' | 'erase';

export interface AnnotationHistoryActionV2 {
  type: AnnotationHistoryActionTypeV2;
  stroke: AnnotationCompletedStrokeV2;
  pageStrokeIndex: number;
}

export interface AnnotationHistoryStateV2 {
  completedStrokes: AnnotationCompletedStrokeV2[];
  undoStack: AnnotationHistoryActionV2[];
  redoStack: AnnotationHistoryActionV2[];
}

export function createEmptyHistoryV2(): AnnotationHistoryStateV2 {
  return {
    completedStrokes: [],
    undoStack: [],
    redoStack: []
  };
}

function countPageStrokes(strokes: AnnotationCompletedStrokeV2[], docId: number, page: number): number {
  let count = 0;
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    if (s.documentInstanceId === docId && s.pageNumber === page) {
      count++;
    }
  }
  return count;
}

function insertStrokeAtPageIndex(strokes: AnnotationCompletedStrokeV2[], stroke: AnnotationCompletedStrokeV2, pageIndex: number): AnnotationCompletedStrokeV2[] {
  const result = [...strokes];
  const docId = stroke.documentInstanceId;
  const page = stroke.pageNumber;
  
  let currentCount = 0;
  for (let i = 0; i < result.length; i++) {
    const s = result[i];
    if (s.documentInstanceId === docId && s.pageNumber === page) {
      if (currentCount === pageIndex) {
        result.splice(i, 0, stroke);
        return result;
      }
      currentCount++;
    }
  }
  
  let lastPageStrokeIndex = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    const s = result[i];
    if (s.documentInstanceId === docId && s.pageNumber === page) {
      lastPageStrokeIndex = i;
      break;
    }
  }
  
  if (lastPageStrokeIndex !== -1) {
    result.splice(lastPageStrokeIndex + 1, 0, stroke);
  } else {
    result.push(stroke);
  }
  
  return result;
}

export function addStrokeToHistoryV2(
  history: AnnotationHistoryStateV2,
  newStroke: AnnotationCompletedStrokeV2
): AnnotationHistoryStateV2 {
  const pageIndex = countPageStrokes(history.completedStrokes, newStroke.documentInstanceId, newStroke.pageNumber);
  
  const action: AnnotationHistoryActionV2 = {
    type: 'add',
    stroke: newStroke,
    pageStrokeIndex: pageIndex
  };

  const nextCompletedStrokes = [...history.completedStrokes, newStroke];
  const nextUndoStack = [...history.undoStack, action];

  const nextRedoStack = history.redoStack.filter(
    (a) =>
      a.stroke.documentInstanceId !== newStroke.documentInstanceId ||
      a.stroke.pageNumber !== newStroke.pageNumber
  );

  return {
    completedStrokes: nextCompletedStrokes,
    undoStack: nextUndoStack,
    redoStack: nextRedoStack
  };
}

export function eraseStrokeFromHistoryV2(
  history: AnnotationHistoryStateV2,
  strokeId: string
): AnnotationHistoryStateV2 {
  let targetIndex = -1;
  for (let i = 0; i < history.completedStrokes.length; i++) {
    if (history.completedStrokes[i].id === strokeId) {
      targetIndex = i;
      break;
    }
  }
  
  if (targetIndex === -1) {
    return history;
  }
  
  const stroke = history.completedStrokes[targetIndex];
  
  let pageStrokeIndex = 0;
  for (let i = 0; i < targetIndex; i++) {
    const s = history.completedStrokes[i];
    if (s.documentInstanceId === stroke.documentInstanceId && s.pageNumber === stroke.pageNumber) {
      pageStrokeIndex++;
    }
  }
  
  const action: AnnotationHistoryActionV2 = {
    type: 'erase',
    stroke: stroke,
    pageStrokeIndex: pageStrokeIndex
  };
  
  const nextCompletedStrokes = [...history.completedStrokes];
  nextCompletedStrokes.splice(targetIndex, 1);
  
  const nextUndoStack = [...history.undoStack, action];
  
  const nextRedoStack = history.redoStack.filter(
    (a) =>
      a.stroke.documentInstanceId !== stroke.documentInstanceId ||
      a.stroke.pageNumber !== stroke.pageNumber
  );
  
  return {
    completedStrokes: nextCompletedStrokes,
    undoStack: nextUndoStack,
    redoStack: nextRedoStack
  };
}

export function undoPageHistoryV2(
  history: AnnotationHistoryStateV2,
  documentInstanceId: number,
  pageNumber: number
): AnnotationHistoryStateV2 {
  let targetIndex = -1;
  for (let i = history.undoStack.length - 1; i >= 0; i--) {
    const action = history.undoStack[i];
    if (action.stroke.documentInstanceId === documentInstanceId && action.stroke.pageNumber === pageNumber) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return history;
  }

  const action = history.undoStack[targetIndex];
  
  const nextUndoStack = [...history.undoStack];
  nextUndoStack.splice(targetIndex, 1);
  
  const nextRedoStack = [...history.redoStack, action];

  let nextCompletedStrokes = history.completedStrokes;
  
  if (action.type === 'add') {
    nextCompletedStrokes = nextCompletedStrokes.filter(s => s.id !== action.stroke.id);
  } else if (action.type === 'erase') {
    nextCompletedStrokes = insertStrokeAtPageIndex(nextCompletedStrokes, action.stroke, action.pageStrokeIndex);
  }

  return {
    completedStrokes: nextCompletedStrokes,
    undoStack: nextUndoStack,
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
    const action = history.redoStack[i];
    if (action.stroke.documentInstanceId === documentInstanceId && action.stroke.pageNumber === pageNumber) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return history;
  }

  const action = history.redoStack[targetIndex];
  
  const nextRedoStack = [...history.redoStack];
  nextRedoStack.splice(targetIndex, 1);
  
  const nextUndoStack = [...history.undoStack, action];

  let nextCompletedStrokes = history.completedStrokes;
  
  if (action.type === 'add') {
    nextCompletedStrokes = insertStrokeAtPageIndex(nextCompletedStrokes, action.stroke, action.pageStrokeIndex);
  } else if (action.type === 'erase') {
    nextCompletedStrokes = nextCompletedStrokes.filter(s => s.id !== action.stroke.id);
  }

  return {
    completedStrokes: nextCompletedStrokes,
    undoStack: nextUndoStack,
    redoStack: nextRedoStack
  };
}

export function getPageHistoryDepthV2(
  history: AnnotationHistoryStateV2,
  documentInstanceId: number,
  pageNumber: number
): { undoDepth: number; redoDepth: number } {
  let undoDepth = 0;
  for (let i = 0; i < history.undoStack.length; i++) {
    const action = history.undoStack[i];
    if (action.stroke.documentInstanceId === documentInstanceId && action.stroke.pageNumber === pageNumber) {
      undoDepth++;
    }
  }

  let redoDepth = 0;
  for (let i = 0; i < history.redoStack.length; i++) {
    const action = history.redoStack[i];
    if (action.stroke.documentInstanceId === documentInstanceId && action.stroke.pageNumber === pageNumber) {
      redoDepth++;
    }
  }

  return { undoDepth, redoDepth };
}
