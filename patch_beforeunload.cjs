const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const replacement = `  const shouldConfirmAnnotationReplacement = 
    annotationDirtyStatus === 'dirty' ||
    (annotationDirtyStatus === 'unavailable' && hasCurrentAnnotationWork);

  const browserExitGuardArmed = shouldConfirmAnnotationReplacement;

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
  }, [browserExitGuardArmed]);`;

code = code.replace(
  "  const shouldConfirmAnnotationReplacement = \n    annotationDirtyStatus === 'dirty' ||\n    (annotationDirtyStatus === 'unavailable' && hasCurrentAnnotationWork);",
  replacement
);

fs.writeFileSync(file, code);
