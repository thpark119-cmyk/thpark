import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const documentName = process.argv[2];
  
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is missing.');
    process.exit(1);
  }

  if (!documentName) {
    console.error('Error: Please provide a document resource name to delete.');
    console.error('Usage: npm run knowledge:delete fileSearchStores/.../documents/...');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    console.log(`Deleting document ${documentName}...`);
    // I can try ai.fileSearchStores.documents.delete or similar depending on the exact path
    await ai.fileSearchStores.documents.delete({ name: documentName });
    console.log('Deleted successfully.');
  } catch (error: any) {
    console.error('Error deleting:', error.message || error);
  }
}

main();
