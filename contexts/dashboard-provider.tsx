"use client"

import { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
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

interface DashboardContextType {
    data: IntegratedData[]
    loading: boolean
    error: string | null
    source: string
    isValidating: boolean
    isFirstLoad: boolean
    refetch: () => void
    lastFetch: Date | null
    fetchTime: number | null
}

const DashboardContext = createContext<DashboardContextType | null>(null)

// Fetcher function for SWR
const fetcher = async (url: string): Promise<DashboardDataResponse> => {
    const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data')
    }

    return result
}

// Cache configuration
const SWR_CONFIG = {
    revalidateOnFocus: false,      // Não revalidar quando a aba volta ao foco
    revalidateOnReconnect: true,   // Revalidar quando reconectar à internet
    refreshInterval: 300000,        // 5 minutos - revalidação silenciosa em background
    dedupingInterval: 60000,       // Dedupe requests por 1 minuto
    shouldRetryOnError: true,      // Tentar novamente em caso de erro
    errorRetryCount: 3,            // Máximo 3 tentativas
    keepPreviousData: true,        // Manter dados antigos enquanto revalida
}

interface DashboardProviderProps {
    children: ReactNode
}

export function DashboardProvider({ children }: DashboardProviderProps) {
    const { data: response, error, isLoading, isValidating, mutate } = useSWR<DashboardDataResponse>(
        '/api/dashboard/data',
        fetcher,
        SWR_CONFIG
    )

    // Determine if this is the first load (no cached data yet)
    const isFirstLoad = isLoading && !response

    const contextValue: DashboardContextType = {
        data: response?.data || [],
        loading: isLoading,
        error: error?.message || null,
        source: response?.source || (isLoading ? 'loading' : 'error'),
        isValidating,
        isFirstLoad,
        refetch: () => mutate(),
        lastFetch: response?.timestamp ? new Date(response.timestamp) : null,
        fetchTime: response?.fetchTime || null,
    }

    // Log cache status for debugging
    if (response && !isLoading) {
        console.log(`[SWR] Data loaded from ${response.source}: ${response.count} properties in ${response.fetchTime}ms (cached: ${!isValidating})`)
    }

    return (
        <DashboardContext.Provider value={contextValue}>
            {children}
        </DashboardContext.Provider>
    )
}

export function useDashboardContext(): DashboardContextType {
    const context = useContext(DashboardContext)

    if (!context) {
        throw new Error('useDashboardContext must be used within a DashboardProvider')
    }

    return context
}

// Hook for components that want to use the dashboard data with SWR benefits
export function useDashboardData() {
    return useDashboardContext()
}
