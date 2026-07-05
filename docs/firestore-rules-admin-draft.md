# Firestore Security Rules: 관리자 읽기 전용 보안 가이드 & 초안 (Draft)

본 문서는 **Music In One / Mio**의 데이터 보호와 무결성을 보장하기 위한 Firestore Security Rules(보안 규칙) 설계 원칙과 실제 Firebase Console 적용 단계를 담고 있는 공식 관리자 가이드입니다.

---

## 1. 핵심 보안 설계 원칙

1. **사용자 격리 원칙 (User Isolation)**
   - 일반 사용자는 본인의 계정 ID(`request.auth.uid`)와 일치하는 `/users/{userId}` 하위 데이터만 읽고 쓸 수 있어야 하며, 타인의 데이터에 어떠한 방식으로도 접근할 수 없습니다.

2. **관리자 읽기 전용 원칙 (Admin Read-Only)**
   - 관리자 계정(`thpark119@gmail.com`)은 전체 사용자 저장 현황 및 통계 계산을 위한 메타데이터 조회가 가능해야 하므로 **전체 사용자의 하위 컬렉션들에 대한 목록 조회 및 읽기(list, get) 권한**을 부여받습니다.
   - 단, 타인의 데이터를 악의적이거나 실수로 수정·삭제하는 사고를 봉쇄하기 위해 **관리자에게도 사용자 데이터의 쓰기(create, update, delete) 권한은 엄격히 차단**합니다.

3. **이중 장벽 보호 구조 (Double-Gate Security)**
   - 클라이언트 앱(`App.tsx` 및 `AdminPanel.tsx`)에서 UI 차단 및 유틸리티 검증을 수행하는 1차 게이트를 둡니다.
   - 2차적으로 Firestore 서버에서 규칙을 통해 본인 신원 또는 관리자 여부를 최종 판단하므로, 일반 사용자가 개발자 도구를 조작해 데이터를 요청하더라도 **서버 단에서 완벽하게 접근을 거부(Permission Denied)**합니다.

---

## 2. 관리자 데이터 요약 조회를 위해 필요한 권한 설계

관리자 화면에서 전체 사용자의 저장 용량과 파일 수를 계산하기 위해서는 아래 컬렉션들에 대한 관리자용 읽기 권한이 선언되어 있어야 합니다:

- `match /users/{userId}` 에 대한 **`list` 및 `get`** 권한 (관리자가 전체 사용자 프로필 메타데이터 목록을 수집해야 하므로 필요)
- `match /users/{userId}/students/{studentId}` 에 대한 **`read` (list, get)** 권한
- `match /users/{userId}/received_lessons/{lessonId}` 에 대한 **`read` (list, get)** 권한
- `match /users/{userId}/repertoire/{itemId}` 에 대한 **`read` (list, get)** 권한
- `collectionGroup` 쿼리(`collectionGroup('students')`, `collectionGroup('received_lessons')`, `collectionGroup('repertoire')`)를 이용해 `/users/{userId}` 프로필 문서가 없는 기존 사용자까지 안전하게 탐색하기 위해, 중첩 서브컬렉션에 대한 **`collectionGroup` 조회 권한**이 추가로 필요합니다:
  - `match /{path=**}/students/{studentId}` 에 대한 **`read` (list, get)** 권한
  - `match /{path=**}/received_lessons/{lessonId}` 에 대한 **`read` (list, get)** 권한
  - `match /{path=**}/repertoire/{itemId}` 에 대한 **`read` (list, get)** 권한

---

## 3. 권장 Firestore Security Rules 초안 (Draft)

다음 보안 규칙을 Firebase Console에 적용하면 사용자의 데이터 독립성과 관리자의 안전한 요약 조회 기능이 균형 있게 보장됩니다.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 기본 규칙: 모든 경로에 대해 기본적으로 접근 비허용 (Default Deny)
    match /{document=**} {
      allow read, write: if false;
    }

    // 로그인된 사용자인지 검증하는 헬퍼 함수
    function isSignedIn() {
      return request.auth != null;
    }

    // 관리자(Admin) 여부를 판별하는 헬퍼 함수
    function isAdmin() {
      return isSignedIn() && (
        exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
        request.auth.token.email == "thpark119@gmail.com"
      );
    }

    // 본인 계정이거나 관리자인 경우를 확인하는 헬퍼 함수
    function isOwner(userId) {
      return isSignedIn() && (request.auth.uid == userId || isAdmin());
    }

    // 1. 관리자 명단 컬렉션
    match /admins/{userId} {
      allow read, write: if isAdmin();
    }

    // 1-B. 관리자 백필 보정 메타데이터 캐시 컬렉션
    match /adminMetadataCache/{cacheId} {
      allow read, write: if isAdmin();
    }

    // 1-C. 관리자 Storage 실제 파일 스캔 인벤토리 캐시 컬렉션
    match /adminStorageInventoryCache/{cacheId} {
      allow read, write: if isAdmin();
    }

    // 2. 핵심 사용자 데이터 영역 (/users)
    match /users/{userId} {
      // 본인 또는 관리자는 개별 사용자 정보 조회가 가능합니다.
      allow get: if isOwner(userId);
      
      // 관리자는 전체 저장 현황 계산을 위해 사용자 목록 조회(list) 권한이 필요합니다.
      allow list: if isAdmin();
      
      // 사용자 프로필 등록 및 정보 수정은 오직 본인만 가능합니다. (관리자 수정 불가)
      allow create: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId 
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'photoURL', 'email']);
      allow delete: if request.auth.uid == userId;

      // A. 학생 관리 서브컬렉션
      match /students/{studentId} {
        // 읽기(get, list): 본인 및 관리자 허용
        allow read: if isOwner(userId);
        // 쓰기, 수정, 삭제: 오직 본인(소유자)만 가능
        allow write: if request.auth.uid == userId;
      }

      // B. 레슨일지 서브컬렉션
      match /received_lessons/{lessonId} {
        // 읽기(get, list): 본인 및 관리자 허용
        allow read: if isOwner(userId);
        // 쓰기, 수정, 삭제: 오직 본인(소유자)만 가능
        allow write: if request.auth.uid == userId;
      }

      // C. 악보함 서브컬렉션
      match /repertoire/{itemId} {
        // 읽기(get, list): 본인 및 관리자 허용
        allow read: if isOwner(userId);
        // 쓰기, 수정, 삭제: 오직 본인(소유자)만 가능
        allow write: if request.auth.uid == userId;
      }
    }
    
    // 3. 레거시/탑레벨 컬렉션에 대한 예외적 관리자 읽기 규칙 (역호환성 보장)
    match /students/{studentId} {
      allow read: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow write: if isSignedIn() && (!exists(resource) || resource.data.userId == request.auth.uid);
    }
    match /received_lessons/{lessonId} {
      allow read: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow write: if isSignedIn() && (!exists(resource) || resource.data.userId == request.auth.uid);
    }
    match /repertoire/{itemId} {
      allow read: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow write: if isSignedIn() && (!exists(resource) || resource.data.userId == request.auth.uid);
    }

    // 4. collectionGroup 쿼리용 관리자 읽기 규칙 (기존 사용자의 중첩 서브컬렉션에서 uid 탐색용)
    match /{path=**}/students/{studentId} {
      allow get, list: if isAdmin();
    }
    match /{path=**}/received_lessons/{lessonId} {
      allow get, list: if isAdmin();
    }
    match /{path=**}/repertoire/{itemId} {
      allow get, list: if isAdmin();
    }
  }
}
```

---

## 4. Firebase Console 수동 적용 단계 가이드

개발 환경이나 앱 코드에서 임의로 Rules를 덮어쓰지 않고, Firebase Console을 통해 검증 후 안전하게 적용하는 공식 절차입니다.

### 1단계: Firebase Console 로그인 및 프로젝트 선택
1. 웹 브라우저를 열고 [Firebase Console](https://console.firebase.google.com/)에 접속합니다.
2. 애플리케이션이 등록된 **Music In One / Mio** 프로젝트를 선택하여 대시보드에 진입합니다.

### 2단계: Firestore Database의 규칙 탭 진입
1. 왼쪽 탐색 메뉴에서 **Build (빌드)** 카테고리를 확장하고 **Firestore Database**를 클릭합니다.
2. 상단 네비게이션 탭에서 **Rules (규칙)** 탭을 선택합니다.

### 3단계: 보안 규칙 작성 및 편집
1. 기존 입력 상자에 있는 텍스트를 모두 삭제합니다.
2. 위의 **"3. 권장 Firestore Security Rules 초안"**에 작성된 `rules_version = '2'; ...` 코드를 전체 복사하여 붙여넣습니다.

### 4단계: 모의 테스트 및 검증 (선택 사항)
1. 규칙 에디터 우측 상단의 **Rules Playground (규칙 플레이그라운드)**를 활성화합니다.
2. `get` 또는 `list` 요청 시뮬레이션을 실행하여, 비로그인자 및 일반 사용자의 접근은 실패(`denied`)하고, 이메일이 `thpark119@gmail.com`인 사용자가 조회할 때는 통과(`allowed`)하는지 동작을 시각적으로 확인합니다.

### 5단계: 규칙 배포 (Publish)
1. 편집기 우측 상단에 있는 파란색 **Publish (게시)** 버튼을 클릭합니다.
2. 변경사항이 전 세계 Firestore 서버에 전파되기까지 약 1~3분이 소요됩니다. 배포가 완료되면 대시보드에서 `다시 계산` 버튼을 눌러 전체 사용자 저장 현황 데이터가 정상 노출되는지 최종 검증하십시오.
