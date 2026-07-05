# Privacy and Data Inventory

## Data Types

| Data Type | Collected? | Stored Where? | Synced to Server? | Purpose | User Visible? | User Can Delete? | Notes |
|---|---|---|---|---|---|---|---|
| **Name** | Yes | Firebase Auth | Yes | Displaying profile | Yes | Yes | Through Google Sign-In |
| **Email address** | Yes | Firebase Auth | Yes | Account login | Yes | Yes | Through Google Sign-In |
| **Firebase UID** | Yes | Firebase Auth/Firestore | Yes | Data isolation per user | No | Yes | Used as document path in Firestore |
| **Lesson logs** | Yes | Firestore / LocalStorage | Yes (if signed in) | Core feature | Yes | Yes | - |
| **Student records** | Yes | Firestore / LocalStorage | Yes (if signed in) | Core feature | Yes | Yes | - |
| **Repertoire records** | Yes | Firestore / LocalStorage | Yes (if signed in) | Core feature | Yes | Yes | - |
| **Repertoire files** | Yes | Firebase Storage | Yes (if signed in) | Attach sheet music | Yes | Yes | Stored only for signed-in users |
| **Student photos** | Yes | Firebase Storage / IndexedDB | Yes (if signed in) | Visual identification | Yes | Yes | Stored in Firebase Storage if signed in, otherwise locally |
| **Microphone audio** | Accessed | Not stored | No | Real-time pitch analysis | Yes (pitch info) | N/A | Processed locally in Tuner |
| **Tuner pitch data** | Accessed | Not stored | No | UI update | Yes | N/A | Transitory |
| **Metronome settings**| Yes | LocalStorage | No | App preferences | Yes | Yes | Local only |
| **Language preference**| Yes | LocalStorage | No | App preferences | Yes | Yes | Local only |
| **Local settings** | Yes | LocalStorage | No | App preferences | Yes | Yes | Local only |
| **Device identifiers** | No | - | - | - | - | - | - |
| **Location** | No | - | - | - | - | - | - |
| **Contacts** | No | - | - | - | - | - | - |
| **Calendar** | No | - | - | - | - | - | - |
| **Camera** | No | - | - | - | - | - | Photos are picked from device storage |
| **Advertising data** | No | - | - | - | - | - | Currently not used |
| **Analytics data** | No | - | - | - | - | - | Currently not used |
| **Crash data** | No | - | - | - | - | - | Currently not used |
| **Payment data** | No | - | - | - | - | - | Currently not used |
| **Health data** | No | - | - | - | - | - | Currently not used |
| **Sensitive personal data**| No | - | - | - | - | - | Currently not used |

## Local Photo to Cloud Migration Update
Users have the ability to explicitly migrate local photos (stored in IndexedDB) to Firebase Storage. This is a manual opt-in action triggered from the "Data Management" section in Settings.
- When migrated, a copy of the photo is uploaded to Firebase Storage and linked to the user's account.
- The original local photos remain on the device and are not automatically deleted.
- Migrated photos stored in the cloud are fully deleted when the user initiates account deletion.

## Storage Usage Transparency (New)
Users have real-time visibility into their cloud and local storage footprint through the **Settings > Data Management** dashboard:
- Displays count and exact file size of student photos, lesson journal photos, and repertoire files saved in Firebase Storage.
- Displays counts of local photos in IndexedDB and fallback local records in LocalStorage.
- Empowers users with a "Recalculate" feature to instantly refresh their storage metrics on-demand.

