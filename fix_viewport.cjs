const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', 'utf8');

// fix double transformRevisionRef
const doubleRefTarget = `const snapshotIdCounterRef = useRef(0);
    const transformRevisionRef = useRef(0);
    const transformRevisionRef = useRef(0);`;
content = content.replace(doubleRefTarget, `const snapshotIdCounterRef = useRef(0);\n    const transformRevisionRef = useRef(0);`);

content = content.replace("const snapshotIdCounterRef = useRef(0);\n    const transformRevisionRef = useRef(0);\n", "const snapshotIdCounterRef = useRef(0);\n");

// wait, let's just do it cleanly using regex:
content = content.replace(/const transformRevisionRef = useRef\(0\);\n/g, "");
content = content.replace("const snapshotIdCounterRef = useRef(0);", "const snapshotIdCounterRef = useRef(0);\n    const transformRevisionRef = useRef(0);");

fs.writeFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', content);
