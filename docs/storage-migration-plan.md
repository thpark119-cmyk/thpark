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

### Phase 3 Complete (Local to Cloud Migration)
- Implemented a manual migration feature in Settings > Data Management.
- Users can scan for existing local photos that are linked to student records.
- Photos are uploaded to Firebase Storage under the same path conventions.
- Firestore records are updated to include `originalLocalPhotoId` and `migratedFrom` flags to prevent duplicates.
- Added fail-safes: skipping already migrated photos, rollback of Storage file if Firestore update fails, and skipping orphaned local photos.
- Local photo deletion is NOT forced. Existing IndexedDB photos remain intact but are hidden in UI if the cloud counterpart is present.
- Updated UI text and Privacy Policy to reflect this explicit opt-in migration step.

## 6. Storage Status Summary (Phase 4)
- **Features**: Settings > Data Management screen now provides a comprehensive breakdown of stored data.
- **Data Status Calculation**:
  - Calculates storage metrics based on Firestore metadata rather than querying Firebase Storage via `listAll` to optimize performance and Firestore cost.
  - Student photos: counts items in `users/{uid}/students -> lessons -> photos` with a valid `storagePath`.
  - Lesson journal photos: counts items in `users/{uid}/received_lessons -> photos` with a valid `storagePath`.
  - Repertoire files: counts items in `users/{uid}/repertoire -> files` and includes legacy files.
  - Local database status: counts items in IndexedDB (`getAllLocalPhotos()`) and counts serialized arrays in `localStorage` under keys `local_received_lessons`, `local_students`, and `local_repertoire`.
- **Notes**:
  - Orphaned files (files on Storage without corresponding Firestore metadata) are not automatically detected in-app; we guide users/developers to check the Firebase Console for absolute billing/usage values.

