import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseAdminAuth } from './_lib/firebaseAdmin';
import { buildMusicTutorSystemPrompt } from './_lib/musicTutorPrompt';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Verify Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getFirebaseAdminAuth();
    
    try {
      await auth.verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // 2. Validate Body
    const { question, language, history, profile } = req.body;
    
    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Question is required and must be a non-empty string' });
    }
    if (question.length > 4000) {
      return res.status(400).json({ error: 'Question exceeds maximum length of 4000 characters' });
    }

    // Process profile if present
    const safeProfile: any = {};
    if (profile && typeof profile === 'object') {
      const allowedKeys = ['instrument', 'major', 'level', 'composer', 'work', 'era', 'currentIssue', 'goal'];
      for (const key of allowedKeys) {
        if (typeof profile[key] === 'string') {
          // Truncate fields to 200 characters
          safeProfile[key] = profile[key].substring(0, 200);
        }
      }
    }

    // 3. Setup Gemini SDK
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API Settings missing on server' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    
    const formattedHistory = [];
    if (Array.isArray(history)) {
      // Enforce max 8 previous messages
      const recentHistory = history.slice(-8); 
      for (const msg of recentHistory) {
        if (msg.role && msg.content && typeof msg.content === 'string') {
          // Truncate history messages to 4000 char to be safe
          const content = msg.content.substring(0, 4000);
          formattedHistory.push({
            role: msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: content }]
          });
        }
      }
    }

    // 4. Call Gemini Generate Content
    const response = await ai.models.generateContent({
      model,
      contents: [...formattedHistory, { role: 'user', parts: [{ text: question }] }],
      config: {
        systemInstruction: buildMusicTutorSystemPrompt({
          language: language || 'ko',
          profile: safeProfile
        }),
      }
    });

    const answer = response.text || '';
    if (!answer) {
      return res.status(502).json({ error: 'Failed to generate answer from AI' });
    }

    // 5. Send JSON Response
    return res.status(200).json({
      answer,
      grounded: false,
      sources: []
    });

  } catch (error: any) {
    if (error.message?.includes('Firebase Admin environment variables')) {
      return res.status(500).json({ error: 'Admin settings missing' });
    }
    if (error.status === 429 || error.message?.includes('429')) {
      return res.status(429).json({ error: 'Gemini Quota Exceeded' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
