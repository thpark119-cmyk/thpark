const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

content = content.replace(
  "import React, { useRef, useEffect, useState } from 'react';",
  "import React, { useRef, useEffect, useState, useCallback } from 'react';"
);

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', content, 'utf8');
console.log('Patch 15 done');
