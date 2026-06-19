# MusicianLog AI 튜터 운영 가이드 (Phase 4)

본 문서는 AI 튜터의 안정적 운영, 비용 통제, 트러블슈팅을 위한 가이드입니다.

## 1. Vercel 환경변수 설정

AI 튜터를 운영하기 위해 아래 환경변수를 Vercel 프로젝트의 **Environment Variables**에 설정하십시오.
API Key 및 Private Key 같은 중요 정보는 반드시 **Sensitive** 속성을 활용해 보호해야 합니다.
(환경변수를 변경한 후에는 반드시 새로운 배포(Redeploy)를 진행해야 적용됩니다.)

```env
# 필수 설정 (Sensitive)
GEMINI_API_KEY=your_gemini_api_key_here
FIREBASE_ADMIN_PROJECT_ID=당신의_파이어베이스_프로젝트_ID
FIREBASE_ADMIN_CLIENT_EMAIL=당신의_파이어베이스_서비스어카운트_이메일
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"

# 선택적 설정 (Search 및 튜터 제어)
AI_TUTOR_ENABLED=true  # false로 변경 시 AI 튜터 긴급 점검 상태 (503 응답)
FILE_SEARCH_ENABLED=true # 내부 지식베이스 RAG 활성화 여부
ENABLE_GOOGLE_SEARCH_GROUNDING=false # true일 경우 구글 웹 검색 연동 기능 활성화 

# 검색 및 질문 제한 수치 조절
AI_TUTOR_DAILY_LIMIT=20
AI_TUTOR_GLOBAL_DAILY_LIMIT=300
AI_TUTOR_MONTHLY_REQUEST_LIMIT=3000
GOOGLE_SEARCH_DAILY_LIMIT=20
GOOGLE_SEARCH_MONTHLY_LIMIT=100
AI_TUTOR_MAX_OUTPUT_TOKENS=1800
AI_TUTOR_COOLDOWN_SECONDS=5

# 관리자 설정
AI_TUTOR_ADMIN_UIDS=uid1,uid2,uid3
```

## 2. 일일·월간 제한 및 사용량 확인

- 현재 애플리케이션의 제한 수치들은 위 환경변수 등을 통해 조정할 수 있습니다.
- 백엔드는 Firebase Server Timestamp와 FieldValue.increment() 트랜잭션을 사용해 중복 요청과 동시성 카운터를 엄격하게 처리합니다.
- 서버 운영자는 `AI_TUTOR_ADMIN_UIDS`에 등록된 계정으로 로그인한 상태에서 개발자 또는 관리자 전용 UI 혹은 `GET /api/ai-tutor-status` 통신을 통해 현재 전체 사용량을 즉각 확인할 수 있습니다.

## 3. 기능 작동 제어 및 긴급 점검 (Feature Flag)

장애나 무분별한 봇 공격 등으로 인해 긴급하게 AI 튜터 기능을 차단해야 한다면 `AI_TUTOR_ENABLED=false`로 설정하십시오.
- 사용자에게 “AI 튜터가 현재 점검 중입니다.”(503 HTTP 에러) 메시지가 표시됩니다.
- Gemini API를 일절 호출하지 않아 요금이 발생하지 않습니다.

## 4. Google Search 기능 활성화 조건

웹 검색(Google Search Grounding)은 기본 비활성화되어(false) 있습니다.
활성화를 위해서는 시스템 측면에서 아래 조건들을 만족해야 합니다.
1. 관리자가 Vercel 환경구성에 `ENABLE_GOOGLE_SEARCH_GROUNDING=true`를 설정합니다.
2. 사용자가 AI 튜터 프로필/옵션 창에서 `최신 웹 정보 검색` 스위치를 명시적으로 켭니다 (Opt-in).
3. Search 할당량(일간/월간 한도)이 남아 있어야 합니다.

이 조건들을 모두 만족할 때만 SDK의 도구(tool)로 Google Search 기능을 제공하며 검색을 요청합니다.

## 5. Gemini 무료 할당량(Quota) 초과 시 대응

무료 티어 할당량을 다 소모하여 `429 Too Many Requests` 상태 또는 `RESOURCE_EXHAUSTED` 에러가 발생하더라도 프론트엔드에서는 우회하여 유료 모델로 몰래 자동 전환하지 않습니다.
- 프론트엔드는 "현재 Gemini 무료 사용량을 초과했습니다" 라는 정중한 형태의 친화적인 한도 초과 메시지를 사용자에게 노출합니다.
- 관리자는 [Google AI Studio](https://aistudio.google.com/app/plan_information) 콘솔에서 실제 Limit과 현재의 Rate Limit 상태를 점검할 수 있습니다.

## 6. 기타 관리 정책 주의사항
- Firebase admin credentials (`FIREBASE_ADMIN_PRIVATE_KEY` 등) 은 절대로 로그에 출력하지 마십시오.
- 본 서버는 사용자 프라이버시 보호를 위해 사용자의 상세한 질문 문자열(Question)과 튜터가 생성한 답변(Answer)을 DB 사용량 카운터 등에 기록하지 않고 있습니다.
- 운영자 혹은 관리자는 정기적으로 Firebase Firestore의 `ai_usage_monthly`, `ai_usage_daily` 컬렉션을 확인하여, 오래된 문서를 아카이빙 하거나 요금제 정책 설정을 참고하시기 바랍니다.
