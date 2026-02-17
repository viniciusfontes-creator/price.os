/**
 * useDashboardData Hook
 * 
 * Fetches dashboard data from the API route which connects to BigQuery.
 * Falls back gracefully if BigQuery is not available.
 */

import { useState, useEffect, useCallback } from 'react'
import type { IntegratedData } from '@/types'

interface DashboardDataResponse {
    success: boolean
    source: 'bigquery' | 'mock' | 'mock-fallback'
    data: IntegratedData[]
    count: number
    fetchTime: number
    timestamp: string
    error?: string
}

interface UseDashboardDataResult {
    data: IntegratedData[]
    loading: boolean
    error: string | null
    source: string
    refetch: () => Promise<void>
    lastFetch: Date | null
}

export function useDashboardData(): UseDashboardDataResult {
    const [data, setData] = useState<IntegratedData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [source, setSource] = useState<string>('loading')
    const [lastFetch, setLastFetch] = useState<Date | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/dashboard/data', {
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                },
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const result: DashboardDataResponse = await response.json()

            if (result.success && result.data) {
                setData(result.data)
                setSource(result.source)
                setLastFetch(new Date())
                console.log(`[Hook] Data loaded from ${result.source}: ${result.count} properties in ${result.fetchTime}ms`)
            } else {
                throw new Error(result.error || 'Unknown error')
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data'
            console.error('[Hook] Error fetching dashboard data:', errorMessage)
            setError(errorMessage)
            setSource('error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return {
        data,
        loading,
        error,
        source,
        refetch: fetchData,
        lastFetch,
    }
}
