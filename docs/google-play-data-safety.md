# Google Play Data Safety Draft

*Note: This is a reference document. Actual values in the Google Play Console may need to be confirmed prior to submission.*

## Data Collection
The app may collect:
- Name
- Email address
- User ID
- User-generated lesson logs
- Student records
- Repertoire records

## Data Sharing
The app does not sell personal data.
The app uses Google/Firebase services for authentication and user data storage.

## Security Practices
- Data is transmitted over HTTPS through Firebase services.
- Users can request or initiate account deletion.
- User data is separated by Firebase user ID.

## Account Deletion
In-app deletion path:
Settings > Account Management > Delete Account

Public deletion guide:
https://musicianlog.vercel.app/account-deletion.html

## Local-only Data
Photos added by signed-in users in Student Management may be stored in Firebase Storage. Photos added while signed out are stored only on the current device.

## Not Used
- Location
- Contacts
- Camera
- Advertising tracking
- Payment data
- Health data
