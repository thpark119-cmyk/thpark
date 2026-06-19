# MusicianLog Knowledge Base

This directory contains resources and scripts to manage the Gemini File Search Store for the AI Tutor.

## What is RAG?
Retrieval-Augmented Generation (RAG) allows the AI Tutor to provide answers grounded in specialized music literature (e.g., transcripts, lecture notes) instead of just relying on general pre-trained knowledge.

## Setup Instructions

1. **Create File Search Store:**
   Run the following command to create a new Gemini File Search Store.
   \`\`\`bash
   npm run knowledge:create-store
   \`\`\`
   This will output a Store ID (e.g., \`fileSearchStores/...\`). Set this as the \`GEMINI_FILE_SEARCH_STORE\` environment variable in Vercel. Also set \`GEMINI_FILE_SEARCH_EMBEDDING_MODEL=models/gemini-embedding-2\`.

2. **Prepare Sources:**
   Place your verified document files in \`knowledge/files/\`.
   Copy \`sources.example.json\` to \`sources.json\` and fill in the metadata for each file. Ensure \`rightsConfirmed\` is \`true\`. Do not include copyrighted materials without permission.

3. **Index Sources:**
   Upload and index the documents into your store using:
   \`\`\`bash
   npm run knowledge:index
   \`\`\`

4. **List Sources:**
   View files currently in the store:
   \`\`\`bash
   npm run knowledge:list
   \`\`\`

5. **Delete Source:**
   Remove a file from the store by its resource name (found via list):
   \`\`\`bash
   npm run knowledge:delete
   \`\`\`

## Notes
- Be aware of API costs and limits (limit to 20-50 high-quality files initially).
- Audio and video files are not supported. Use transcripts or summaries.
- Validate your \`sources.json\` to ensure \`rightsConfirmed\` is properly set.
