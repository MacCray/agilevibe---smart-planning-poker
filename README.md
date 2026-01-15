<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1KSxuEuTuqrS6Yx6s0Q4-RCqzBTBIU7Y3

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Firebase (see [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed instructions):
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Create a Firestore database
   - Get your Firebase configuration
   - Add Firebase config to `.env.local`:
     ```env
     VITE_FIREBASE_API_KEY=your-api-key
     VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=your-project-id
     VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
     VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
     VITE_FIREBASE_APP_ID=your-app-id
     ```

3. Set the `GEMINI_API_KEY` in `.env.local`:
   ```env
   GEMINI_API_KEY=your-gemini-api-key
   ```

4. Run the app:
   ```bash
   npm run dev
   ```

## Real-time Synchronization

This app uses **Firebase Firestore** for real-time synchronization between all participants. All actions (votes, reveals, new participants) are synchronized instantly across all browsers without page refresh.

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for complete Firebase setup instructions.
