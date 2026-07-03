# App Store Privacy Answer Draft

*Note: This is a draft reference. Final App Store Connect answers must be reviewed again after the native iOS wrapper is created.*

## Data Linked to the User
- Email address
- Name
- User ID
- User-generated lesson logs, student records, and repertoire notes

## Data Not Linked to the User
- Student photos added while signed out are stored only locally and are not synced to the server. Photos added while signed in are uploaded to Firebase Storage and linked to the user account.

## Data Not Collected
- Location
- Contacts
- Calendar
- Payment information
- Health data
- Advertising data
- Third-party tracking data

## Microphone
The microphone is used only for the tuner feature.
Audio is analyzed locally in real time and is not uploaded to the server.

## Tracking
The app does not currently use third-party advertising tracking.

## Notes
- To be reviewed before final submission.
- Ensure the native wrapper does not inadvertently include analytic SDKs unless declared.
