import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from './_lib/firebaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getFirebaseAdminAuth();
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const adminUids = (process.env.AI_TUTOR_ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!adminUids.includes(decodedToken.uid)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const db = getFirebaseAdminFirestore();
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const monthStr = `${yyyy}-${mm}`;

    const [globalDailyDoc, monthlyDoc] = await Promise.all([
      db.collection('ai_usage_global_daily').doc(todayStr).get(),
      db.collection('ai_usage_monthly').doc(monthStr).get()
    ]);

    const globalDailyData = globalDailyDoc.data() || { requestCount: 0, searchRequestCount: 0 };
    const monthlyData = monthlyDoc.data() || { requestCount: 0, searchRequestCount: 0 };

    const getIntEnv = (key: string, def: number) => {
      const val = Number(process.env[key]);
      return (isNaN(val) || val < 0) ? def : val;
    };

    return res.status(200).json({
      model: process.env.GEMINI_MODEL || 'gemini-pro',
      aiTutorEnabled: process.env.AI_TUTOR_ENABLED !== 'false',
      fileSearchEnabled: !!process.env.GEMINI_FILE_SEARCH_STORE && process.env.FILE_SEARCH_ENABLED !== 'false',
      googleSearchEnabled: process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === 'true',
      dailyRequests: globalDailyData.requestCount || 0,
      monthlyRequests: monthlyData.requestCount || 0,
      dailySearchRequests: globalDailyData.searchRequestCount || 0,
      monthlySearchRequests: monthlyData.searchRequestCount || 0,
      limits: {
        globalDaily: getIntEnv('AI_TUTOR_GLOBAL_DAILY_LIMIT', 300),
        globalMonthly: getIntEnv('AI_TUTOR_MONTHLY_REQUEST_LIMIT', 3000),
        searchDaily: getIntEnv('GOOGLE_SEARCH_DAILY_LIMIT', 20),
        searchMonthly: getIntEnv('GOOGLE_SEARCH_MONTHLY_LIMIT', 100),
      }
    });
  } catch (error) {
    console.error('Status Check Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
