"use client"

import * as React from "react"
import { X, Filter, Save, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useGlobalFilters } from "@/contexts/global-filters-context"
import { DateRangeFilter } from "./date-range-filter"
import { MultiSelectFilter } from "./multi-select-filter"
import { NumericRangeFilter } from "./numeric-range-filter"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FilterBarProps {
    filterOptions: {
        pracas: string[]
        grupos: string[]
        subGrupos: string[]
        tipoOperacao: string[]
        partnernames: string[]
        properties: { id: string; name: string }[]
    }
}

export function FilterBar({ filterOptions }: FilterBarProps) {
    const {
        filters,
        updateFilters,
        resetFilters,
        hasActiveFilters,
        activeFilterCount,
        presets,
        applyPreset,
        savePreset,
        deletePreset,
        activePresetId,
    } = useGlobalFilters()

    const [isExpanded, setIsExpanded] = React.useState(false)
    const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false)
    const [presetName, setPresetName] = React.useState("")

    const handleSavePreset = () => {
        if (presetName.trim()) {
            savePreset(presetName.trim())
            setPresetName("")
            setIsSaveDialogOpen(false)
        }
    }

    return (
        <Card className="mb-6">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        <CardTitle className="text-lg">Filtros Globais</CardTitle>
                        {hasActiveFilters && (
                            <Badge variant="default" className="ml-2">
                                {activeFilterCount} ativo{activeFilterCount > 1 ? 's' : ''}
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {presets.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        {activePresetId
                                            ? presets.find(p => p.id === activePresetId)?.name || "Presets"
                                            : "Presets"}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Filtros Salvos</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {presets.map((preset) => (
                                        <DropdownMenuItem
                                            key={preset.id}
                                            onClick={() => applyPreset(preset.id)}
                                            className="flex items-center justify-between"
                                        >
                                            <span>{preset.name}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    deletePreset(preset.id)
                                                }}
                                                className="ml-2 hover:text-destructive"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {hasActiveFilters && (
                            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Save className="h-4 w-4 mr-2" />
                                        Salvar
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Salvar Filtros</DialogTitle>
                                        <DialogDescription>
                                            Salve esta combinação de filtros para acesso rápido futuro.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Nome do Preset</Label>
                                            <Input
                                                placeholder="Ex: Rio - Airbnb - Este Mês"
                                                value={presetName}
                                                onChange={(e) => setPresetName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleSavePreset()
                                                }}
                                            />
                                        </div>
                                        <Button onClick={handleSavePreset} className="w-full">
                                            Salvar Preset
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}

                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={resetFilters}>
                                Limpar tudo
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4">
                        {/* Date Range Filter */}
                        <DateRangeFilter
                            dateRange={filters.dateRange}
                            dateFilterMode={filters.dateFilterMode}
                            onDateRangeChange={(range) => updateFilters({ dateRange: range })}
                            onDateModeChange={(mode) => updateFilters({ dateFilterMode: mode })}
                        />

                        {/* Praça Filter */}
                        <MultiSelectFilter
                            label="Praça"
                            options={filterOptions.pracas.map(p => ({ value: p, label: p }))}
                            selected={filters.pracas}
                            onChange={(pracas) => updateFilters({ pracas })}
                        />

                        {/* Grupo Filter */}
                        <MultiSelectFilter
                            label="Grupo"
                            options={filterOptions.grupos.map(g => ({ value: g, label: g }))}
                            selected={filters.grupos}
                            onChange={(grupos) => updateFilters({ grupos })}
                        />

                        {/* Sub-Grupo Filter */}
                        <MultiSelectFilter
                            label="Sub-Grupo"
                            options={filterOptions.subGrupos.map(sg => ({ value: sg, label: sg }))}
                            selected={filters.subGrupos}
                            onChange={(subGrupos) => updateFilters({ subGrupos })}
                        />

                        {/* Tipo de Operação Filter */}
                        <MultiSelectFilter
                            label="Tipo de Operação"
                            options={filterOptions.tipoOperacao.map(t => ({ value: t, label: t }))}
                            selected={filters.tipoOperacao}
                            onChange={(tipoOperacao) => updateFilters({ tipoOperacao })}
                        />

                        {/* Partner/Canal Filter */}
                        <MultiSelectFilter
                            label="Canal de Venda"
                            options={filterOptions.partnernames.map(p => ({ value: p, label: p }))}
                            selected={filters.partnernames}
                            onChange={(partnernames) => updateFilters({ partnernames })}
                        />

                        {/* Quartos Filter */}
                        <NumericRangeFilter
                            label="Quartos"
                            min={filters.quartos.min}
                            max={filters.quartos.max}
                            onChange={(quartos) => updateFilters({ quartos })}
                            placeholder={{ min: "Min", max: "Max" }}
                        />

                        {/* Hóspedes Filter */}
                        <NumericRangeFilter
                            label="Hóspedes"
                            min={filters.hospedes.min}
                            max={filters.hospedes.max}
                            onChange={(hospedes) => updateFilters({ hospedes })}
                            placeholder={{ min: "Min", max: "Max" }}
                        />

                        {/* Property Filter */}
                        <MultiSelectFilter
                            label="Propriedade"
                            options={filterOptions.properties.map(p => ({ value: p.id, label: p.name }))}
                            selected={filters.propertyIds}
                            onChange={(propertyIds) => updateFilters({ propertyIds })}
                        />
                    </div>
                </CardContent>
            )}
        </Card>
    )
}
