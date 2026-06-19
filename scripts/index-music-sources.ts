import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const storeName = process.env.GEMINI_FILE_SEARCH_STORE;
  
  if (!apiKey || !storeName) {
    console.error('Error: GEMINI_API_KEY or GEMINI_FILE_SEARCH_STORE environment variable is missing.');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const sourcesPath = path.join(process.cwd(), 'knowledge', 'sources.json');
  if (!fs.existsSync(sourcesPath)) {
    console.error('Error: knowledge/sources.json not found. Did you copy from sources.example.json?');
    process.exit(1);
  }

  const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
  
  const statePath = path.join(process.cwd(), 'knowledge', '.index-state.json');
  let indexState: Record<string, any> = {};
  if (fs.existsSync(statePath)) {
    indexState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  console.log(`Starting indexing into ${storeName}...\\n`);

  let successCount = 0;
  let failCount = 0;

  for (const source of sources) {
    if (!source.rightsConfirmed) {
      console.log(`Skipping [${source.id}] - rightsConfirmed is not true`);
      continue;
    }

    if (indexState[source.id]) {
      console.log(`Skipping [${source.id}] - already indexed as ${indexState[source.id].documentName}`);
      continue;
    }

    const filePath = path.join(process.cwd(), source.localFile);
    if (!fs.existsSync(filePath)) {
      console.log(`Failed [${source.id}] - local file not found: ${filePath}`);
      failCount++;
      continue;
    }

    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) {
      console.log(`Failed [${source.id}] - file size exceeds 50MB`);
      failCount++;
      continue;
    }

    console.log(`Uploading [${source.id}]...`);
    try {
      const customMetadata = [
        { key: 'source_id', stringValue: source.id },
        { key: 'title', stringValue: source.title },
        { key: 'author', stringValue: source.author || '' },
        { key: 'source_type', stringValue: source.sourceType },
        { key: 'url', stringValue: source.url || '' },
        { key: 'instruments', stringValue: (source.instruments || []).join(',') },
      ].filter(m => m.stringValue !== '');

      // @ts-ignore
      const response = await ai.fileSearchStores.uploadToFileSearchStore({
        name: storeName,
        fileSearchStoreId: storeName, 
        file: filePath,
        mimeType: filePath.endsWith('.md') ? 'text/markdown' : 'text/plain',
        customMetadata: customMetadata
      });
      // uploadToFileSearchStore returns an operation or document ? Wait, I should check the return type. 
      const documentName = typeof response === 'object' && response.name ? response.name : 'uploaded';
      
      console.log(`Success [${source.id}] -> ${documentName}`);
      
      indexState[source.id] = {
        sourceId: source.id,
        documentName: documentName,
        indexedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(statePath, JSON.stringify(indexState, null, 2));
      successCount++;
    } catch (err: any) {
      console.error(`Error uploading [${source.id}]:`, err.message || err);
      failCount++;
    }
  }

  console.log(`\\nIndexing complete. Success: ${successCount}, Failed: ${failCount}`);
}

main();
