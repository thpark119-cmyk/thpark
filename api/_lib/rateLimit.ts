import { getFirebaseAdminFirestore } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export type UsageLimits = {
  dailyUsed: number;
  dailyLimit: number;
  remaining: number;
};

export type CheckUsageResult = {
  allowed: boolean;
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
  usage?: UsageLimits;
  approveSearch?: boolean;
};

export async function checkAndIncrementUsage(
  uid: string, 
  requestId: string, 
  isSearchRequested: boolean
): Promise<CheckUsageResult> {
  const db = getFirebaseAdminFirestore();
  
  // Environment variables
  const getIntEnv = (key: string, def: number) => {
    const val = Number(process.env[key]);
    return (isNaN(val) || val < 0) ? def : val;
  };

  const dailyLimit = getIntEnv('AI_TUTOR_DAILY_LIMIT', 20);
  const cooldownSecs = getIntEnv('AI_TUTOR_COOLDOWN_SECONDS', 5);
  const globalDailyLimit = getIntEnv('AI_TUTOR_GLOBAL_DAILY_LIMIT', 300);
  const monthlyRequestLimit = getIntEnv('AI_TUTOR_MONTHLY_REQUEST_LIMIT', 3000);
  const searchDailyLimit = getIntEnv('GOOGLE_SEARCH_DAILY_LIMIT', 20);
  const searchMonthlyLimit = getIntEnv('GOOGLE_SEARCH_MONTHLY_LIMIT', 100);

  const now = new Date();
  
  // Create localized date strings (using UTC or a fixed offset. Let's use UTC for simplicity as required)
  // To avoid date boundary issues, use YYYY-MM-DD
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const monthStr = `${yyyy}-${mm}`;

  const userDailyRef = db.collection('ai_usage_daily').doc(`${uid}_${todayStr}`);
  const monthlyRef = db.collection('ai_usage_monthly').doc(monthStr);
  const globalDailyRef = db.collection('ai_usage_global_daily').doc(todayStr);

  try {
    return await db.runTransaction(async (t) => {
      const [userDailyDoc, monthlyDoc, globalDailyDoc] = await Promise.all([
        t.get(userDailyRef),
        t.get(monthlyRef),
        t.get(globalDailyRef)
      ]);

      const userDailyData = userDailyDoc.exists ? userDailyDoc.data() : null;
      const monthlyData = monthlyDoc.exists ? monthlyDoc.data() : null;
      const globalDailyData = globalDailyDoc.exists ? globalDailyDoc.data() : null;

      // Check Duplicate Request
      if (userDailyData && userDailyData.lastRequestId === requestId) {
        return {
          allowed: false,
          code: 'DUPLICATE_REQUEST',
          message: '중복된 요청입니다. 잠시 후 다시 시도해주세요.',
          retryAfterSeconds: cooldownSecs,
          usage: {
            dailyUsed: userDailyData.requestCount || 0,
            dailyLimit,
            remaining: Math.max(0, dailyLimit - (userDailyData.requestCount || 0))
          }
        };
      }

      // Check Cooldown
      if (userDailyData && userDailyData.lastRequestedAt) {
        const lastReqTime = userDailyData.lastRequestedAt.toDate().getTime();
        if (now.getTime() - lastReqTime < cooldownSecs * 1000) {
          return {
            allowed: false,
            code: 'COOLDOWN_ACTIVE',
            message: '요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.',
            retryAfterSeconds: Math.ceil(((lastReqTime + cooldownSecs * 1000) - now.getTime()) / 1000),
            usage: {
              dailyUsed: userDailyData.requestCount || 0,
              dailyLimit,
              remaining: Math.max(0, dailyLimit - (userDailyData.requestCount || 0))
            }
          };
        }
      }

      // Check User Daily Limit
      const userRequestCount = userDailyData?.requestCount || 0;
      if (userRequestCount >= dailyLimit) {
        return {
          allowed: false,
          code: 'USER_DAILY_LIMIT',
          message: '오늘 사용할 수 있는 AI 튜터 질문 횟수를 모두 사용했습니다. 다음 날 다시 이용해주세요.',
          usage: {
            dailyUsed: userRequestCount,
            dailyLimit,
            remaining: 0
          }
        };
      }

      // Check Global Daily Limit
      const globalDailyCount = globalDailyData?.requestCount || 0;
      if (globalDailyCount >= globalDailyLimit) {
        return {
          allowed: false,
          code: 'GLOBAL_DAILY_LIMIT',
          message: '현재 AI 튜터의 전체 무료 사용량 한도에 도달했습니다. 운영자가 한도를 재설정한 후 다시 이용할 수 있습니다.',
          usage: {
            dailyUsed: userRequestCount,
            dailyLimit,
            remaining: Math.max(0, dailyLimit - userRequestCount)
          }
        };
      }

      // Check Monthly Request Limit
      const monthCount = monthlyData?.requestCount || 0;
      if (monthCount >= monthlyRequestLimit) {
        return {
          allowed: false,
          code: 'GLOBAL_MONTHLY_LIMIT',
          message: '현재 AI 튜터의 전체 무료 사용량 한도에 도달했습니다. 운영자가 한도를 재설정한 후 다시 이용할 수 있습니다.',
          usage: {
            dailyUsed: userRequestCount,
            dailyLimit,
            remaining: Math.max(0, dailyLimit - userRequestCount)
          }
        };
      }

      // Determine if Search is allowed based on quotas
      let approveSearch = false;
      if (isSearchRequested) {
        const searchDailyCount = globalDailyData?.searchRequestCount || 0;
        const searchMonthlyCount = monthlyData?.searchRequestCount || 0;
        if (searchDailyCount < searchDailyLimit && searchMonthlyCount < searchMonthlyLimit) {
          approveSearch = true;
        }
      }

      // Proceed: Increment counters
      const updateData: any = {
        updatedAt: FieldValue.serverTimestamp()
      };

      if (!userDailyDoc.exists) {
        t.set(userDailyRef, {
          uid,
          date: todayStr,
          requestCount: 1,
          searchRequestCount: approveSearch ? 1 : 0,
          lastRequestedAt: FieldValue.serverTimestamp(),
          lastRequestId: requestId,
          ...updateData
        });
      } else {
        t.update(userDailyRef, {
          requestCount: FieldValue.increment(1),
          searchRequestCount: approveSearch ? FieldValue.increment(1) : FieldValue.increment(0),
          lastRequestedAt: FieldValue.serverTimestamp(),
          lastRequestId: requestId,
          ...updateData
        });
      }

      const monthlyUpdateData = {
        month: monthStr,
        requestCount: FieldValue.increment(1),
        searchRequestCount: approveSearch ? FieldValue.increment(1) : FieldValue.increment(0),
        ...updateData
      };
      if (!monthlyDoc.exists) t.set(monthlyRef, monthlyUpdateData);
      else t.update(monthlyRef, monthlyUpdateData);

      const globalDailyUpdateData = {
        date: todayStr,
        requestCount: FieldValue.increment(1),
        searchRequestCount: approveSearch ? FieldValue.increment(1) : FieldValue.increment(0),
        ...updateData
      };
      if (!globalDailyDoc.exists) t.set(globalDailyRef, globalDailyUpdateData);
      else t.update(globalDailyRef, globalDailyUpdateData);

      return {
        allowed: true,
        usage: {
          dailyUsed: userRequestCount + 1,
          dailyLimit,
          remaining: Math.max(0, dailyLimit - (userRequestCount + 1))
        },
        approveSearch
      };
    });
  } catch (error) {
    console.error('Transaction failed:', error);
    // Be conservative on failure: deny
    return {
      allowed: false,
      code: 'SERVER_ERROR',
      message: '서버 사용량 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    };
  }
}
