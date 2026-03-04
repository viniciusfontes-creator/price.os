"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ============================================
// VIEW TYPES & CONFIGURATION
// ============================================

export type ViewType = 'overview' | 'short-stay' | 'hotelaria'

export interface ViewConfig {
    id: ViewType
    label: string
    description: string
    icon: string
    color: string
    gradient: string
    allowedPages: string[]
    bigqueryFilter: string | null // SQL WHERE clause fragment
}

export const VIEW_CONFIGS: Record<ViewType, ViewConfig> = {
    'overview': {
        id: 'overview',
        label: 'Overview QAVI',
        description: 'Visão executiva geral de toda a operação',
        icon: '🏢',
        color: '#4f46e5',
        gradient: 'from-indigo-500 to-blue-600',
        allowedPages: ['/', '/vendas', '/inventory/availability'],
        bigqueryFilter: null, // No filter — consolidated view
    },
    'short-stay': {
        id: 'short-stay',
        label: 'Short-Stay',
        description: 'Operação detalhada de unidades individuais',
        icon: '🏠',
        color: '#0284c7',
        gradient: 'from-sky-500 to-blue-600',
        allowedPages: [
            '/', '/vendas', '/inventory/availability',
            '/pricing', '/propriedades', '/propriedades/pricing', '/propriedades/custos', '/propriedades/racionalizacao',
            '/sales-demand', '/concorrencia', '/correlacao',
        ],
        bigqueryFilter: "empreendimento_pousada IN ('Short Stay', 'Alto Padrão')",
    },
    'hotelaria': {
        id: 'hotelaria',
        label: 'Hotelaria',
        description: 'Gestão de blocos e pousadas',
        icon: '🏨',
        color: '#2563eb',
        gradient: 'from-blue-600 to-indigo-700',
        allowedPages: [
            '/', '/vendas', '/inventory/availability',
            '/propriedades', '/propriedades/pricing', '/propriedades/custos', '/propriedades/racionalizacao',
            '/sales-demand',
        ],
        bigqueryFilter: "empreendimento_pousada = 'Empreendimento'",
    },
}

// ============================================
// CONTEXT
// ============================================

interface ViewContextValue {
    currentView: ViewType | null
    viewConfig: ViewConfig | null
    setView: (view: ViewType) => void
    clearView: () => void
    isPageAllowed: (pathname: string) => boolean
    hasSelectedView: boolean
}

const ViewContext = createContext<ViewContextValue | undefined>(undefined)

const STORAGE_KEY = 'qavi-view-context'

// ============================================
// PROVIDER
// ============================================

export function ViewContextProvider({ children }: { children: React.ReactNode }) {
    const [currentView, setCurrentView] = useState<ViewType | null>(null)
    const [isHydrated, setIsHydrated] = useState(false)

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored && (stored === 'overview' || stored === 'short-stay' || stored === 'hotelaria')) {
                setCurrentView(stored as ViewType)
            }
        } catch (error) {
            console.error('Error loading view context:', error)
        }
        setIsHydrated(true)
    }, [])

    // Save to localStorage
    useEffect(() => {
        if (!isHydrated) return
        try {
            if (currentView) {
                localStorage.setItem(STORAGE_KEY, currentView)
            } else {
                localStorage.removeItem(STORAGE_KEY)
            }
        } catch (error) {
            console.error('Error saving view context:', error)
        }
    }, [currentView, isHydrated])

    const setView = useCallback((view: ViewType) => {
        setCurrentView(view)
    }, [])

    const clearView = useCallback(() => {
        setCurrentView(null)
    }, [])

    const isPageAllowed = useCallback((pathname: string) => {
        if (!currentView) return true
        const config = VIEW_CONFIGS[currentView]
        // Check exact match or prefix match for nested routes
        return config.allowedPages.some(page => {
            if (page === '/') return pathname === '/'
            return pathname === page || pathname.startsWith(page + '/')
        })
    }, [currentView])

    const value: ViewContextValue = {
        currentView,
        viewConfig: currentView ? VIEW_CONFIGS[currentView] : null,
        setView,
        clearView,
        isPageAllowed,
        hasSelectedView: currentView !== null,
    }

    return (
        <ViewContext.Provider value={value}>
            {children}
        </ViewContext.Provider>
    )
}

// ============================================
// HOOK
// ============================================

export function useViewContext() {
    const context = useContext(ViewContext)
    if (context === undefined) {
        throw new Error('useViewContext must be used within a ViewContextProvider')
    }
    return context
}
