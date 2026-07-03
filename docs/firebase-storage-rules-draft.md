# Firebase Storage Security Rules Draft

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/students/{studentId}/lessons/{lessonId}/photos/{fileName} {
      allow read, delete: if request.auth != null
        && request.auth.uid == userId;

      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 1 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|png|webp)');
    }

    match /users/{userId}/repertoire/{repertoireId}/files/{fileName} {
      allow read, delete: if request.auth != null
        && request.auth.uid == userId;

      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 15 * 1024 * 1024
        && (
          request.resource.contentType == 'application/pdf'
          || request.resource.contentType.matches('image/(jpeg|png|webp)')
        );
    }
  }
}
```

*Note: This is a draft. Since there is no Firebase CLI configuration for Storage currently applied in this project, users must apply these rules manually in the Firebase Console (Storage > Rules tab).*
