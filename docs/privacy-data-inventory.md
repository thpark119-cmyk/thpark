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
| **Student photos** | Yes | IndexedDB | No | Visual identification | Yes | Yes | Stored only locally on device |
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
