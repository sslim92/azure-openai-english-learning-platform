// src/components/PowerBiReport.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { PowerBIEmbed } from 'powerbi-client-react';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { IEmbedConfiguration } from 'powerbi-client'; // ◀- Power BI 타입 import

// API 응답 데이터의 타입을 정의
interface EmbedInfo {
    accessToken: string;
    embedUrl: string;
    reportId: string;
}

export default function PowerBiReport() {
    // useState에 타입 지정
    const [embedConfig, setEmbedConfig] = useState<IEmbedConfiguration | null>(null);
    const [status, setStatus] = useState<string>("인증 정보를 확인하는 중입니다...");

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    setStatus("사용자 토큰을 가져오는 중입니다...");
                    const idToken = await user.getIdToken();
                    
                    setStatus("Power BI 보고서 정보를 요청하는 중입니다...");
                    const response = await fetch('/api/embed-info', {
                        headers: { 'Authorization': `Bearer ${idToken}` }
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "서버에서 오류가 발생했습니다.");
                    }
                    
                    const data: EmbedInfo = await response.json();
                    
                    setEmbedConfig({
                        type: 'report',
                        id: data.reportId,
                        embedUrl: data.embedUrl,
                        accessToken: data.accessToken,
                        tokenType: 1, // models.TokenType.Embed
                        settings: { /* ... */ }
                    });
                    setStatus("");
                } catch (error: any) {
                    console.error(error);
                    setStatus(`오류: ${error.message}`);
                }
            } else {
                setStatus("Power BI 보고서를 보려면 로그인이 필요합니다.");
            }
        });
        return () => unsubscribe();
    }, []);

    if (embedConfig === null) {
        return <div>{status}</div>;
    }
    
    return (
        <PowerBIEmbed
            embedConfig={embedConfig}
            cssClassName={"report-container"}
        />
    );
}