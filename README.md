
# Hill AFB Visit Tracker — Cloud Sync (Firestore)

This version syncs contacts and visits across devices using **Firebase Auth + Firestore** with **offline persistence**.
> Each rep signs in with email+password. Data is stored under `users/{uid}/contacts` and `users/{uid}/visits`.

## 1) Create Firebase project (free tier is fine)
1. Go to https://console.firebase.google.com → **Add project**.
2. In **Build → Authentication → Sign-in method**, enable **Email/Password**.
3. In **Build → Firestore Database**, click **Create database** → **Start in production mode** → choose a region near Utah.

## 2) Add a Web app to get the config
- In the Firebase console, the **Project overview** page → **Web (</>)** → Register app (no hosting) → you'll get a config like:
```
const firebaseConfig = {
  apiKey: "AI...",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "123456",
  appId: "1:123456:web:..."
};
```

## 3) Paste the config into `index.html`
- Open `index.html`, find the `firebaseConfig` block, and replace the placeholders with your values.

## 4) Firestore Security Rules (recommended)
In **Firestore → Rules**, paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Publish.

## 5) Deploy (Azure Static Web Apps or GitHub Pages)
- Same as before: it's static files. After deployment, open the site, **Add to Home Screen** (iOS), then **Sign in** (top-right).

## 6) How it works
- **Offline-first**: Firestore caches in the browser (IndexedDB). You can use it offline; changes sync later.
- **Real-time sync**: Changes on phone are pushed to the cloud and appear on iPad within seconds.
- **Export/Import** still works for manual backups or migration.

## Notes
- If you used the local-only app before, data does **not** auto-migrate. Do a one-time **Export** from the old app and **Import JSON** here after signing in.
- If you want SSO (Microsoft Entra ID) later, we can switch auth providers.
