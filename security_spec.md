# Security Specification for MusicianLog

## Data Invariants
1. A `ReceivedLesson` must belong to the authenticated user.
2. A `Student` must belong to the authenticated user.
3. A `TeachingLog` must belong to a `Student` that belongs to the authenticated user.
4. A `RepertoireItem` must belong to the authenticated user.
5. `createdAt` must be immutable and set to server time.
6. IDs must be valid strings.

## The "Dirty Dozen" Payloads (Identity & Integrity Attack Vectors)
1. **The Identity Thief**: Try to create a lesson with another user's `userId`.
2. **The Shadow Field**: Try to add `isAdmin: true` to a user profile.
3. **The Orphan Maker**: Try to create a teaching log for a non-existent student or a student owned by someone else.
4. **The Time Traveler**: Try to set a custom (past/future) `createdAt` timestamp.
5. **The Junk Injector**: Try to use a 1MB string for a student's name to cause resource exhaustion.
6. **The Status Jump**: Try to update a repertoire item's status to 'Completed' without owning it.
7. **The Blanket Read**: Try to list all students in the database.
8. **The PII Leak**: Try to read another user's profile details.
9. **The ID Poisoning**: Try to use a long junk string as a document ID.
10. **The Immutable Break**: Try to change the `userId` of an existing student.
11. **The Cross-Pollination**: Try to link a repertoire item to a lesson id that doesn't exist.
12. **The Anonymous Write**: Try to create a record without being authenticated.

## Test Runner logic (Conceptual)
All "Dirty Dozen" payloads will result in `PERMISSION_DENIED`.
Rules will enforce:
- `request.auth.uid == resource.data.userId` for reads/updates.
- `request.auth.uid == request.resource.data.userId` for creates.
- `exists()` or `get()` for parent verification in sub-collections.
