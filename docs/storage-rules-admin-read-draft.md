# Music In One (Mio) - Firebase Storage Rules 관리자 읽기 권한 초안 (Draft)

본 문서는 Music In One / Mio의 관리자 계정(`thpark119@gmail.com`)이 과거 누락된 파일의 용량 및 미디어 포맷 metadata(`getMetadata`)를 스캔하여 복구하고, **Storage 실제 파일 인벤토리 스캔**을 수행할 수 있도록 보장하는 Firebase Storage Rules 설정 초안입니다.

---

## 1. 기본 보안 설계 및 권장 규칙 원칙

1. **소유자 전용 권한 제한**: 일반 가입자는 오직 본인이 소유한 경로(`users/{userId}/**`)의 파일만 자유롭게 읽고(Read), 쓰고(Write), 삭제(Delete)할 수 있습니다.
2. **관리자 읽기 및 리스트(List) 권한 부여**: 
   - 백필 스캔 기능(`getMetadata`)과 재귀적인 **Storage 실제 파일 스캔**(`list`)을 정상 수행하기 위해, 지정된 관리자 계정(`thpark119@gmail.com`)에 한해 전체 `users/{userId}/**` 파일들의 **metadata 조회(`getMetadata`) 및 디렉토리 리스팅(`list`)** 권한을 명시적으로 허용합니다.
3. **쓰기 및 삭제 방지**: 관리자 권한을 가진 계정이라 하더라도 타인의 파일을 강제로 덮어쓰거나(write) 임의로 영구 삭제(delete)하는 파괴적 액션은 완전 차단되어 안전성을 극대화합니다.
4. **Console 직접 반영**: 보안 및 실서버 안전을 위해, 앱 코드 내에서 Storage Rules를 임의로 오버라이드하지 않으며 해당 원칙 규칙을 Firebase Console에 관리자가 직접 수동으로 업데이트해야 합니다.

---

## 2. 권장 Storage Rules 초안

Firebase Console의 **Storage > Rules** 탭에 아래 내용을 추가 및 반영해 주십시오:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // 헬퍼 함수: 요청자가 관리자 계정인지 판별
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'thpark119@gmail.com';
    }

    // users/{userId} 아래 모든 파일에 대한 규칙 세트
    match /users/{userId}/{allPaths=**} {
      
      // 1. 일반 사용자: 본인의 업로드 경로만 자유롭게 제어 가능
      // 2. 관리자: 타 사용자의 파일 스캔(Metadata 확인) 및 인벤토리 탐색(list)을 위해 읽기 권한(get, list) 허용
      allow read, list: if (request.auth != null && request.auth.uid == userId) || isAdmin();
      
      // 쓰기 및 삭제: 오직 본인의 파일만 가능 (관리자라도 다른 사용자의 파일 수정/삭제 불가)
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 3. 관리자 가이드라인

* **반영처**: Firebase Console -> Storage -> Rules 탭
* **효과**: 위 규칙이 배포되면 관리자 대시보드 내의 **“기존 파일 용량 보정 (Phase 2 & 3)”** 및 **“Storage 실제 파일 스캔”** 기능 실행 시 타 사용자의 Storage에 업로드된 파일의 크기(size) 및 폴더 목록 조회가 완전히 허가되어, `'permission-denied'` 오류 없이 안전하게 스캔 결과를 대시보드에 구성할 수 있게 됩니다.
* **보안 위험 검토**: 이 보안 규칙은 관리자에게 타인 파일에 대한 임의의 '쓰기/수정/삭제' 권한을 원천 차단하므로 악의적 변조나 손상 위험이 극히 낮습니다.
