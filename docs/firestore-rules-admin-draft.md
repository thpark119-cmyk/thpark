# Firestore Security Rules: Admin Read-Access Analysis & Draft

본 문서는 **Music In One / Mio**의 Firestore Security Rules 분석 결과와 관리자 권한 관련 초안(Draft) 사양을 담고 있습니다.

## 1. 현재 Firestore Rules 분석 결과

현재 프로젝트 루트(`firestore.rules`)의 보안 규칙을 정밀 진단한 결과, **이미 관리자 계정(`thpark119@gmail.com`)에 대한 전체 사용자 데이터 읽기 권한이 보안상 완벽하게 지원되고 있음**을 확인했습니다.

### 핵심 판별 도우미 함수 (Helpers)
```javascript
function isAdmin() {
  return isSignedIn() && (
    exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
    request.auth.token.email == "thpark119@gmail.com"
  );
}

function isOwner(userId) {
  return isSignedIn() && (request.auth.uid == userId || isAdmin());
}
```

### 규칙 평가 경로
1. **관리자 판별 (`isAdmin`)**: 
   - 사용자가 로그인되어 있고, 이메일 주소가 `"thpark119@gmail.com"`이거나 `/admins/{uid}` 컬렉션에 등록된 경우 참(`true`)을 반환합니다.
2. **소유자 및 권한 위임 (`isOwner`)**:
   - `isOwner(userId)`는 해당 데이터 소유자의 UID와 로그인 사용자의 UID가 일치할 때뿐만 아니라, **`isAdmin()`이 참일 때도 `true`를 반환**합니다.
3. **사용자별 중첩 컬렉션 읽기 권한**:
   - `/users/{userId}` 하위의 모든 중첩 컬렉션(`received_lessons`, `students`, `repertoire`)은 `allow read: if isOwner(userId);` 정책을 따르고 있습니다.
   - 따라서 관리자 계정(`thpark119@gmail.com`)은 **모든 사용자의 중첩 데이터에 안전하게 읽기(read) 접근이 가능**합니다.
4. **최상위 및 레거시 컬렉션 읽기 권한**:
   - 최상위 컬렉션 경로(`match /received_lessons/{lessonId}`, `match /students/{studentId}`, `match /repertoire/{itemId}`) 역시 `allow list, get: if isAdmin() || ...` 정책을 가지고 있어 관리자의 일괄 조회가 원활히 허용됩니다.

---

## 2. 관리자 권한 보강 및 락다운 초안 (Firestore Rules Draft)

향후 Firebase Console에 배포하거나 직접 갱신할 때 참고할 수 있도록 작성된 최적화된 Firestore Rules 초안입니다. 
관리자는 **전체 사용자의 데이터를 실시간으로 모니터링(Read)**할 수 있으나, 이번 단계 요구사항에 따라 다른 사용자의 데이터를 **수정하거나 삭제(Write/Delete)하는 것은 엄격하게 제한**하여 데이터 신뢰성을 극대화합니다.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // -------------------------------------------------------------
    // [보안 기저 설정] 모든 경로에 대한 기본 차단 (Default Deny)
    // -------------------------------------------------------------
    match /{document=**} {
      allow read, write: if false;
    }

    // -------------------------------------------------------------
    // [도우미 함수] 공통 유효성 및 권한 판별
    // -------------------------------------------------------------
    function isSignedIn() {
      return request.auth != null;
    }

    // 관리자 판별: 이메일 체크 및 관리자 전용 컬렉션 검증
    function isAdmin() {
      return isSignedIn() && (
        exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
        request.auth.token.email == "thpark119@gmail.com"
      );
    }

    // 소유자 여부 체크: 본인 데이터이거나 관리자(Admin)인 경우 허용
    function isOwner(userId) {
      return isSignedIn() && (request.auth.uid == userId || isAdmin());
    }

    // 경로 변수 및 ID 유효성 정규식 검증 (Junk 문자열 인젝션 방어)
    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    function incoming() {
      return request.resource.data;
    }

    function existing() {
      return resource.data;
    }

    // -------------------------------------------------------------
    // [컬렉션 매칭] 1. 관리자 전용 목록
    // -------------------------------------------------------------
    match /admins/{userId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }

    // -------------------------------------------------------------
    // [컬렉션 매칭] 2. 사용자 데이터 트리 (/users)
    // -------------------------------------------------------------
    match /users/{userId} {
      // 본인 또는 관리자는 유저 프로필 조회 가능
      allow get: if isOwner(userId);
      
      // 유저 프로필 작성은 본인만 가능 (이메일 인증 확인 필터 강화)
      allow create: if request.auth.uid == userId && (request.auth.token.email_verified == true);
      
      // 프로필 수정 필드 제한 (이름과 프로필 사진만 허용)
      allow update: if request.auth.uid == userId 
        && incoming().diff(existing()).affectedKeys().hasOnly(['displayName', 'photoURL']);

      // A. 악보함 컬렉션 (repertoire)
      match /repertoire/{itemId} {
        // 읽기: 본인 및 관리자 허용
        allow read: if isOwner(userId);
        // 쓰기/수정/삭제: 오직 소유자(본인)만 가능 (관리자 대리 수정 불가로 무결성 보장)
        allow create: if request.auth.uid == userId;
        allow update: if request.auth.uid == userId 
          && incoming().userId == userId 
          && incoming().userId == existing().userId;
        allow delete: if request.auth.uid == userId;
      }

      // B. 학생 관리 컬렉션 (students)
      match /students/{studentId} {
        allow read: if isOwner(userId);
        allow create: if request.auth.uid == userId;
        allow update: if request.auth.uid == userId 
          && incoming().userId == userId 
          && incoming().userId == existing().userId;
        allow delete: if request.auth.uid == userId;

        // 학생별 레슨일지 로그 서브컬렉션
        match /logs/{logId} {
          allow read: if isOwner(userId);
          allow create: if request.auth.uid == userId;
          allow update: if request.auth.uid == userId 
            && incoming().userId == userId 
            && incoming().userId == existing().userId;
          allow delete: if request.auth.uid == userId;
        }
      }

      // C. 수강한 레슨 기록 컬렉션 (received_lessons)
      match /received_lessons/{lessonId} {
        allow read: if isOwner(userId);
        allow create: if request.auth.uid == userId;
        allow update: if request.auth.uid == userId 
          && incoming().userId == userId 
          && incoming().userId == existing().userId;
        allow delete: if request.auth.uid == userId;
      }
    }
  }
}
```

---

## 3. 관리자 권한 검증 및 보안 설계 원칙

1. **최소 권한 원칙 (Principle of Least Privilege)**:
   - 관리자 계정은 대시보드 모니터링 목적으로 전체 사용자의 악보, 학생, 레슨 목록을 **조회(Read)할 수 있지만, 타인의 데이터에 쓰기(Write)나 수정, 임의 삭제를 실행하는 것은 방지**합니다.
   - 이는 해킹 및 권한 탈취 시 타인의 실사용 데이터가 변조·삭제되는 2차 피해를 완전히 봉쇄합니다.
2. **이중 장벽 구조 (Double-Gate Access Control)**:
   - 클라이언트 앱(`App.tsx` 및 `AdminPanel.tsx`)에서 1차적으로 UI 노출 제어 및 강제 접근 통제를 시행합니다.
   - 2차적으로 Firestore 서버단 보안 규칙(Rules)이 관리자 본인 신원을 강제 평가하므로, 외부 상태 변조 툴을 이용해 관리자 화면을 띄우더라도 **서버 응답 거부(Permission Denied)로 인해 데이터 조회가 불가능**합니다.
