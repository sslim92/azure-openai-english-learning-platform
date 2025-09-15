
import * as admin from 'firebase-admin';

// Export a function that returns the auth instance
export function getFirebaseAuth() {
    // In the App Hosting environment, the Admin SDK is automatically initialized.
    // This lazy initialization prevents issues in Next.js server components/actions.
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'edusearch-pro3-78636271-fb23b',
        });
    }
    return admin.auth();
}
