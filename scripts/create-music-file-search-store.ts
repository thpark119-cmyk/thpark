import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is missing.');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    console.log('Creating File Search Store...');
    const storeName = process.argv[2]; // optional argument

    const store = await ai.fileSearchStores.create(
      (storeName ? { fileSearchStore: { displayName: storeName } } : {}) as any
    );
    
    console.log('\\nFile Search Store created successfully.\\n');
    console.log('Set this Vercel environment variable:\\n');
    console.log(`GEMINI_FILE_SEARCH_STORE=${store.name}\\n`);
    console.log('Recommended:\\nGEMINI_FILE_SEARCH_EMBEDDING_MODEL=models/gemini-embedding-2\\n');
    
  } catch (error) {
    console.error('Error creating File Search Store:', error);
  }
}

main();
