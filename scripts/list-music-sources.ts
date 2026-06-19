import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const storeName = process.env.GEMINI_FILE_SEARCH_STORE;
  
  if (!apiKey || !storeName) {
    console.error('Error: GEMINI_API_KEY or GEMINI_FILE_SEARCH_STORE environment variable is missing.');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    console.log(`Listing documents in ${storeName}...\\n`);
    const response = await ai.fileSearchStores.documents.list({ parent: storeName });
    // Or ai.fileSearchStores.documents.list({ parent: storeName }) ? I'll try listInternal or maybe documents property is enumerable? Wait, earlier I saw listInternal. Let's see what the response is.
    // If list() is not there, maybe ai.fileSearchStores.list() ? Wait, I listed the methods earlier.
    console.log(response);
  } catch (error) {
    console.error('Error describing:', error);
  }
}

main();
