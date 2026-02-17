"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { GlobalFilters, FilterPreset } from '@/types'
import { DEFAULT_FILTERS } from '@/types'

interface GlobalFiltersContextValue {
    // Current filters
    filters: GlobalFilters
    updateFilters: (updates: Partial<GlobalFilters>) => void
    resetFilters: () => void

    // Presets
    presets: FilterPreset[]
    activePresetId: string | null
    applyPreset: (presetId: string) => void
    savePreset: (name: string) => void
    deletePreset: (presetId: string) => void

    // Computed properties
    hasActiveFilters: boolean
    activeFilterCount: number
}

const GlobalFiltersContext = createContext<GlobalFiltersContextValue | undefined>(undefined)

const STORAGE_KEY = 'qavi-global-filters'
const PRESETS_STORAGE_KEY = 'qavi-filter-presets'

export function GlobalFiltersProvider({ children }: { children: React.ReactNode }) {
    const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_FILTERS)
    const [presets, setPresets] = useState<FilterPreset[]>([])
    const [activePresetId, setActivePresetId] = useState<string | null>(null)

    // Load filters from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored)
                setFilters({ ...DEFAULT_FILTERS, ...parsed })
            }

            const storedPresets = localStorage.getItem(PRESETS_STORAGE_KEY)
            if (storedPresets) {
                setPresets(JSON.parse(storedPresets))
            }
        } catch (error) {
            console.error('Error loading filters from localStorage:', error)
        }
    }, [])

    // Save filters to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
        } catch (error) {
            console.error('Error saving filters to localStorage:', error)
        }
    }, [filters])

    // Save presets to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets))
        } catch (error) {
            console.error('Error saving presets to localStorage:', error)
        }
    }, [presets])

    const updateFilters = useCallback((updates: Partial<GlobalFilters>) => {
        setFilters(prev => ({ ...prev, ...updates }))
        setActivePresetId(null) // Clear active preset when manual changes made
    }, [])

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS)
        setActivePresetId(null)
    }, [])

    const applyPreset = useCallback((presetId: string) => {
        const preset = presets.find(p => p.id === presetId)
        if (preset) {
            setFilters(preset.filters)
            setActivePresetId(presetId)
        }
    }, [presets])

    const savePreset = useCallback((name: string) => {
        const newPreset: FilterPreset = {
            id: `preset-${Date.now()}`,
            name,
            filters: { ...filters },
            createdAt: new Date().toISOString(),
        }
        setPresets(prev => [...prev, newPreset])
        setActivePresetId(newPreset.id)
    }, [filters])

    const deletePreset = useCallback((presetId: string) => {
        setPresets(prev => prev.filter(p => p.id !== presetId))
        if (activePresetId === presetId) {
            setActivePresetId(null)
        }
    }, [activePresetId])

    // Compute if any filters are active
    const hasActiveFilters =
        filters.dateRange !== null ||
        filters.propertyIds.length > 0 ||
        filters.pracas.length > 0 ||
        filters.grupos.length > 0 ||
        filters.subGrupos.length > 0 ||
        filters.tipoOperacao.length > 0 ||
        filters.quartos.min !== null || filters.quartos.max !== null ||
        filters.hospedes.min !== null || filters.hospedes.max !== null ||
        filters.partnernames.length > 0 ||
        filters.status.length > 0 ||
        filters.receita.min !== null || filters.receita.max !== null ||
        filters.antecedenciaReserva.min !== null || filters.antecedenciaReserva.max !== null

    // Count active filters
    const activeFilterCount = [
        filters.dateRange !== null,
        filters.propertyIds.length > 0,
        filters.pracas.length > 0,
        filters.grupos.length > 0,
        filters.subGrupos.length > 0,
        filters.tipoOperacao.length > 0,
        filters.quartos.min !== null || filters.quartos.max !== null,
        filters.hospedes.min !== null || filters.hospedes.max !== null,
        filters.partnernames.length > 0,
        filters.status.length > 0,
        filters.receita.min !== null || filters.receita.max !== null,
        filters.antecedenciaReserva.min !== null || filters.antecedenciaReserva.max !== null,
    ].filter(Boolean).length

    const value: GlobalFiltersContextValue = {
        filters,
        updateFilters,
        resetFilters,
        presets,
        activePresetId,
        applyPreset,
        savePreset,
        deletePreset,
        hasActiveFilters,
        activeFilterCount,
    }

    return (
        <GlobalFiltersContext.Provider value={value}>
            {children}
        </GlobalFiltersContext.Provider>
    )
}

export function useGlobalFilters() {
    const context = useContext(GlobalFiltersContext)
    if (context === undefined) {
        throw new Error('useGlobalFilters must be used within a GlobalFiltersProvider')
    }
    return context
}
