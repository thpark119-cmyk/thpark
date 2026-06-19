import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseAdminAuth } from './_lib/firebaseAdmin';
import { buildMusicTutorSystemPrompt } from './_lib/musicTutorPrompt';
import { checkAndIncrementUsage } from './_lib/rateLimit';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
  }

  // Feature Flag: Emergency Stop
  if (process.env.AI_TUTOR_ENABLED === 'false') {
    return res.status(503).json({ error: { code: 'MAINTENANCE', message: 'AI 튜터가 현재 점검 중입니다. 잠시 후 다시 이용해주세요.' } });
  }

  try {
    // 1. Verify Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization token' } });
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getFirebaseAdminAuth();
    
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized: Invalid token' } });
    }

    // 2. Validate Body
    const { question, language, history, profile, requestId, webSearchEnabled } = req.body;
    
    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing requestId' } });
    }

    const maxQuestionChars = Number(process.env.AI_TUTOR_MAX_QUESTION_CHARS) || 4000;
    const maxHistoryMessages = Number(process.env.AI_TUTOR_MAX_HISTORY_MESSAGES) || 8;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Question is required and must be a non-empty string' } });
    }
    if (question.length > maxQuestionChars) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Question exceeds maximum length' } });
    }
    if (language && !['ko', 'en', 'de'].includes(language)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Unsupported language' } });
    }

    // Ask Search Logic
    const envSearchEnabled = process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === 'true';
    const isSearchRequested = envSearchEnabled && webSearchEnabled === true;

    // 3. Rate Limiting via Firestore
    const usageResult = await checkAndIncrementUsage(decodedToken.uid, requestId, isSearchRequested);
    if (!usageResult.allowed) {
      return res.status(429).json({
        error: {
          code: usageResult.code,
          message: usageResult.message,
          retryAfterSeconds: usageResult.retryAfterSeconds
        },
        usage: usageResult.usage
      });
    }

    // Process profile if present
    const safeProfile: any = {};
    if (profile && typeof profile === 'object') {
      const allowedKeys = ['majorCategory', 'instrument'];
      for (const key of allowedKeys) {
        if (typeof profile[key] === 'string') {
          safeProfile[key] = profile[key].substring(0, 200);
        }
      }
    }

    // 4. Setup Gemini SDK
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Gemini API Settings missing on server' } });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    
    const formattedHistory = [];
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-maxHistoryMessages); 
      for (const msg of recentHistory) {
        if (msg.role && msg.content && typeof msg.content === 'string') {
          const content = msg.content.substring(0, maxQuestionChars);
          formattedHistory.push({
            role: msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: content }]
          });
        }
      }
    }

    // 5. Set up tools
    const storeName = process.env.GEMINI_FILE_SEARCH_STORE;
    const tools: any[] = [];
    
    if (storeName && process.env.FILE_SEARCH_ENABLED !== 'false') {
      tools.push({
        fileSearch: {
          fileSearchStoreNames: [storeName]
        }
      });
    }

    if (usageResult.approveSearch) {
      tools.push({
        googleSearch: {}
      });
    }

    // 6. Call Gemini Generate Content
    let response;
    let grounded = false;
    let webSearchUsed = false;
    let warning = '';
    const sources: any[] = [];
    
    const maxOutputTokens = Number(process.env.AI_TUTOR_MAX_OUTPUT_TOKENS) || 1800;

    const generateCall = async (currentTools: any[]) => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 35000);
      });

      try {
        const res = await Promise.race([
          ai.models.generateContent({
            model,
            contents: [...formattedHistory, { role: 'user', parts: [{ text: question }] }],
            config: {
              systemInstruction: buildMusicTutorSystemPrompt({
                language: language || 'ko',
                profile: safeProfile
              }),
              maxOutputTokens: maxOutputTokens,
              ...(currentTools.length > 0 ? { tools: currentTools } : {})
            }
          }),
          timeoutPromise
        ]);
        return res;
      } catch (err: any) {
        if (err.message === 'TIMEOUT_ERROR') {
          const timeoutErr = new Error('TIMEOUT');
          timeoutErr.name = 'AbortError';
          throw timeoutErr;
        }
        throw err;
      }
    };

    try {
      response = await generateCall(tools);
    } catch (apiError: any) {
      if (apiError.name === 'AbortError') {
        return res.status(504).json({ error: { code: 'TIMEOUT', message: '답변 생성 시간이 초과되었습니다. 질문을 조금 짧게 하거나 다시 시도해주세요.' } });
      }
      
      const errorStr = apiError.message || apiError.toString();
      // Specifically handle resource exhausted to prevent changing models
      if (apiError.status === 429 || errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        return res.status(429).json({ error: { code: 'QUOTA_EXCEEDED', message: '현재 Gemini 무료 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.' } });
      }

      // If tool use fails (often file search or google search specific model issues limit)
      if (tools.length > 0 && (errorStr.includes('File Search') || errorStr.includes('Search') || apiError.status === 400 || apiError.status === 404)) {
        warning = 'fallback';
        response = await generateCall([]);
      } else {
        throw apiError;
      }
    }

    const answer = response.text || '';
    if (!answer) {
      return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Failed to generate answer from AI' } });
    }

    // Process grounding metadata
    const candidates = response.candidates || [];
    if (candidates.length > 0 && candidates[0].groundingMetadata) {
      const gMetadata = candidates[0].groundingMetadata;
      if (gMetadata.groundingChunks && gMetadata.groundingChunks.length > 0) {
        grounded = true;
        const seenSources = new Set<string>();
        
        for (const chunk of gMetadata.groundingChunks) {
          if (chunk.retrievedContext) {
            const uri = chunk.retrievedContext.uri || '';
            const title = chunk.retrievedContext.title || 'Unknown Source';
            const sourceId = uri || title;
            if (!seenSources.has(sourceId)) {
              seenSources.add(sourceId);
              sources.push({
                id: sourceId,
                title: title,
                url: uri,
                pageNumber: chunk.retrievedContext.pageNumber,
                sourceType: 'professional',
                provider: 'file-search'
              });
            }
          }
          if (chunk.web) {
            webSearchUsed = true;
            const uri = chunk.web.uri || '';
            const title = chunk.web.title || uri;
            const sourceId = uri || title;
            if (!seenSources.has(sourceId)) {
              seenSources.add(sourceId);
              sources.push({
                id: sourceId,
                title: title,
                url: uri,
                sourceType: 'web',
                provider: 'google-search',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
    }

    // 7. Send JSON Response
    return res.status(200).json({
      answer,
      grounded,
      sources,
      warning,
      webSearchUsed,
      usage: usageResult.usage
    });

  } catch (error: any) {
    console.error('AI Tutor Handler error:', error);
    if (error.message?.includes('Firebase Admin environment variables')) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Admin settings missing' } });
    }
    // Fallback error trap for quota
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: { code: 'QUOTA_EXCEEDED', message: '현재 Gemini 무료 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.' } });
    }
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
}
