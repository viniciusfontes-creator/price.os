/**
 * API Route: /api/bigquery/data
 * 
 * Fetches integrated data from BigQuery.
 * Falls back to mock data indicator if BigQuery is not configured or SDK is missing.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    // Check if BigQuery is configured
    if (!process.env.GCP_PROJECT_ID) {
        return NextResponse.json({
            success: false,
            useMock: true,
            message: 'GCP_PROJECT_ID not configured. Using mock data.',
            timestamp: new Date().toISOString(),
        })
    }

    try {
        // Dynamic import to avoid build errors when package isn't installed
        const { getIntegratedDataFromBigQuery } = await import('@/lib/bigquery-service')
        const data = await getIntegratedDataFromBigQuery()

        return NextResponse.json({
            success: true,
            data,
            count: data.length,
            source: 'bigquery',
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[API] BigQuery error:', error)

        // Check if error is due to missing module
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const isMissingModule = errorMessage.includes("Can't resolve") ||
            errorMessage.includes("Cannot find module") ||
            errorMessage.includes("Failed to initialize BigQuery")

        return NextResponse.json({
            success: false,
            useMock: true,
            message: isMissingModule
                ? 'BigQuery SDK not installed. Run: npm install @google-cloud/bigquery --legacy-peer-deps'
                : errorMessage,
            timestamp: new Date().toISOString(),
        })
    }
}
