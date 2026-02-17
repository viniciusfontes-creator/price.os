"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { DateFilterMode } from "@/types"
import { getDatePresets } from "@/lib/filter-utils"

interface DateRangeFilterProps {
    dateRange: { start: string; end: string } | null
    dateFilterMode: DateFilterMode
    onDateRangeChange: (range: { start: string; end: string } | null) => void
    onDateModeChange: (mode: DateFilterMode) => void
}

export function DateRangeFilter({
    dateRange,
    dateFilterMode,
    onDateRangeChange,
    onDateModeChange,
}: DateRangeFilterProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const presets = getDatePresets()

    const handlePreset = (preset: { start: string; end: string }) => {
        onDateRangeChange(preset)
        setIsOpen(false)
    }

    const startDate = dateRange?.start ? new Date(dateRange.start) : undefined
    const endDate = dateRange?.end ? new Date(dateRange.end) : undefined

    const dateRangeText = dateRange
        ? `${format(new Date(dateRange.start), "dd/MM/yyyy", { locale: ptBR })} - ${format(new Date(dateRange.end), "dd/MM/yyyy", { locale: ptBR })}`
        : "Selecione o período"

    const getModeLabel = (mode: DateFilterMode) => {
        switch (mode) {
            case 'checkin':
                return 'Check-in'
            case 'checkout':
                return 'Check-out'
            case 'saleDate':
                return 'Data de Venda'
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Período de Análise</Label>
                {dateRange && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDateRangeChange(null)}
                        className="h-7 text-xs"
                    >
                        Limpar
                    </Button>
                )}
            </div>

            <Tabs value={dateFilterMode} onValueChange={(v) => onDateModeChange(v as DateFilterMode)}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="checkin" className="text-xs">Check-in</TabsTrigger>
                    <TabsTrigger value="checkout" className="text-xs">Check-out</TabsTrigger>
                    <TabsTrigger value="saleDate" className="text-xs">Venda</TabsTrigger>
                </TabsList>
            </Tabs>

            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRangeText}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3 border-b">
                        <p className="text-sm font-medium mb-2">Períodos Rápidos</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreset(presets.last7Days)}
                                className="text-xs"
                            >
                                Últimos 7 dias
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreset(presets.last30Days)}
                                className="text-xs"
                            >
                                Últimos 30 dias
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreset(presets.thisMonth)}
                                className="text-xs"
                            >
                                Este mês
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreset(presets.lastMonth)}
                                className="text-xs"
                            >
                                Mês passado
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreset(presets.thisQuarter)}
                                className="text-xs"
                            >
                                Este trimestre
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreset(presets.thisYear)}
                                className="text-xs"
                            >
                                Este ano
                            </Button>
                        </div>
                    </div>
                    <Calendar
                        mode="range"
                        selected={
                            startDate && endDate
                                ? { from: startDate, to: endDate }
                                : undefined
                        }
                        onSelect={(range) => {
                            if (range?.from && range?.to) {
                                onDateRangeChange({
                                    start: format(range.from, "yyyy-MM-dd"),
                                    end: format(range.to, "yyyy-MM-dd"),
                                })
                            }
                        }}
                        numberOfMonths={2}
                        locale={ptBR}
                    />
                </PopoverContent>
            </Popover>

            {dateRange && (
                <p className="text-xs text-muted-foreground">
                    Filtrando por: <span className="font-medium">{getModeLabel(dateFilterMode)}</span>
                </p>
            )}
        </div>
    )
}
