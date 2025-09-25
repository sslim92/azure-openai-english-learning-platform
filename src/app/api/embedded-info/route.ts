import { NextRequest, NextResponse } from 'next/server';
import * as msal from "@azure/msal-node";
import admin from '@/lib/firebase-admin';

// ... (MSAL 클라이언트 초기화 코드는 동일)
const msalConfig = { /* ... */ };
const cca = new msal.ConfidentialClientApplication(msalConfig);

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const currentUserId: string = decodedToken.email!;
        const userRole: string = "loggeduser";

        const authRequest = { scopes: ["https://analysis.windows.net/powerbi/api/.default"] };
        const authResponse = await cca.acquireTokenByClientCredential(authRequest);
        const accessToken = authResponse.accessToken;

        const workspaceId = process.env.WORKSPACE_ID;
        const reportId = process.env.REPORT_ID;
        
        const reportUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;
        const reportResponse = await fetch(reportUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!reportResponse.ok) throw new Error(`Failed to get report details`);
        const report = await reportResponse.json();
        const datasetId = report.datasetId;

        const tokenRequestBody = {
            accessLevel: "View",
            identities: [{
                username: currentUserId,
                roles: [userRole],
                datasets: [datasetId],
            }],
        };

        const tokenUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tokenRequestBody),
        });
        if (!tokenResponse.ok) throw new Error(`Failed to generate embed token`);
        const embedToken = await tokenResponse.json();
        
        return NextResponse.json({
            accessToken: embedToken.token,
            embedUrl: report.embedUrl,
            reportId: report.id,
        });

    } catch (error: any) {
        console.error("Error in /api/embed-info:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}