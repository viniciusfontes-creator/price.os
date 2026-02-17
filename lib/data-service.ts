/**
 * Data Service
 * 
 * Unified data access layer that automatically switches between:
 * - BigQuery (when GCP_PROJECT_ID is configured)
 * - Mock data (fallback for development)
 * 
 * Usage:
 *   const data = await getIntegratedData()
 */

import type { IntegratedData } from '@/types'

// Flag to indicate if we should try BigQuery
const USE_BIGQUERY = typeof window === 'undefined' && !!process.env.GCP_PROJECT_ID

/**
 * Fetch integrated data from the appropriate source
 * - Server-side: Uses BigQuery directly if configured
 * - Client-side: Fetches from API route (which uses BigQuery)
 */
export async function getIntegratedData(): Promise<IntegratedData[]> {
    // Client-side: fetch from API
    if (typeof window !== 'undefined') {
        return fetchFromApi()
    }

    // Server-side: use BigQuery directly if configured
    if (USE_BIGQUERY) {
        try {
            const { getIntegratedDataFromBigQuery } = await import('./bigquery-service')
            return await getIntegratedDataFromBigQuery()
        } catch (error) {
            console.error('[DataService] BigQuery error, falling back to mock:', error)
            return getMockData()
        }
    }

    // Fallback to mock data
    return getMockData()
}

/**
 * Fetch data from API route (for client-side use)
 */
async function fetchFromApi(): Promise<IntegratedData[]> {
    try {
        const response = await fetch('/api/bigquery/data', {
            cache: 'no-store',
        })

        const result = await response.json()

        if (result.useMock || !result.data) {
            console.log('[DataService] API indicated mock data should be used')
            return getMockData()
        }

        return result.data
    } catch (error) {
        console.error('[DataService] API fetch error, using mock:', error)
        return getMockData()
    }
}

/**
 * Get mock data (development fallback)
 */
async function getMockData(): Promise<IntegratedData[]> {
    const { generateMockIntegratedData } = await import('./mock-data')
    console.log('[DataService] Using mock data')
    return generateMockIntegratedData()
}

/**
 * Check if BigQuery is configured
 */
export function isBigQueryConfigured(): boolean {
    return !!process.env.GCP_PROJECT_ID
}

/**
 * Get data source info (for debugging/display)
 */
export function getDataSourceInfo(): { source: 'bigquery' | 'mock'; configured: boolean } {
    return {
        source: USE_BIGQUERY ? 'bigquery' : 'mock',
        configured: !!process.env.GCP_PROJECT_ID,
    }
}
