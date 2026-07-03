# Storage Migration Plan

This document outlines the plan for migrating local file storage to Firebase Storage and managing file deletions.

## 1. Student Photos Storage Migration Plan
- Currently, student photos are stored in IndexedDB (`localPhotoStorage.ts`).
- **Phase 2**: Introduce an upload flow that uses `uploadFileToStorage` to save new photos to Firebase Storage. The `CloudLessonPhoto` metadata will be stored inside the lesson document in Firestore.
- **Migration Strategy**: 
  - Provide a manual migration button in Settings, or an auto-migration script when a user opens a student's profile, to upload existing IndexedDB photos to Firebase Storage.
  - Until fully migrated, the UI must support displaying both legacy `localPhotoUrl` (object URLs from IndexedDB) and new `storagePath` (via `getDownloadURL`).

## 2. Repertoire Files Storage Plan
- **Phase 2**: Add file upload UI in the Repertoire component.
- Uploads will use `buildScoreFileStoragePath` and `validateScoreUploadFile`.
- Store `CloudScoreFile` metadata in the repertoire Firestore document.

## 3. Account Deletion and Storage Cleanup Plan
When a user deletes their account:
- We must delete the user's files from Firebase Storage.
- **Frontend limitations**: Firebase Storage SDK does not support deleting an entire folder (e.g., `users/{uid}/`).
- **Approach**: The frontend will need to query Firestore for all `storagePath` entries in the user's `lessons` and `repertoire` collections, then call `deleteFileFromStorage` on each path before deleting the user document.
- **Alternative**: If the app grows, a Firebase Cloud Function (`onDelete`) should be deployed to automatically clean up the `users/{uid}/` path in Storage and Firestore.

## 4. Privacy Policy Updates Required
Once actual file upload to Storage is implemented in Phase 2, the `privacy.html` must be updated to include:
- Student photos may be stored in Firebase Storage (previously local-only).
- Repertoire files (PDFs/Images) may be stored in Firebase Storage.
- Files are securely linked to the authenticated user account.
- All stored files are included in the account deletion process.

## 5. App Store / Google Play Data Safety Updates Required
- Update the Data Safety and Privacy Inventory docs to reflect that `Photos and Videos` and `Files and Docs` are now collected and synced to the server, but are still linked to the User ID and can be deleted by the user.
