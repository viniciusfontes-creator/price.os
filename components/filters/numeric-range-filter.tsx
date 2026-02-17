"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface NumericRangeFilterProps {
    label: string
    min: number | null
    max: number | null
    onChange: (range: { min: number | null; max: number | null }) => void
    step?: number
    unit?: string
    placeholder?: { min?: string; max?: string }
}

export function NumericRangeFilter({
    label,
    min,
    max,
    onChange,
    step = 1,
    unit = "",
    placeholder = { min: "Mín", max: "Máx" },
}: NumericRangeFilterProps) {
    const [minValue, setMinValue] = React.useState(min?.toString() ?? "")
    const [maxValue, setMaxValue] = React.useState(max?.toString() ?? "")

    const handleMinChange = (value: string) => {
        setMinValue(value)
        const numValue = value === "" ? null : Number(value)
        onChange({ min: numValue, max })
    }

    const handleMaxChange = (value: string) => {
        setMaxValue(value)
        const numValue = value === "" ? null : Number(value)
        onChange({ min, max: numValue })
    }

    const clearRange = () => {
        setMinValue("")
        setMaxValue("")
        onChange({ min: null, max: null })
    }

    const hasActiveFilter = min !== null || max !== null

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{label}</Label>
                {hasActiveFilter && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearRange}
                        className="h-7 text-xs"
                    >
                        Limpar
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Input
                        type="number"
                        placeholder={placeholder.min}
                        value={minValue}
                        onChange={(e) => handleMinChange(e.target.value)}
                        step={step}
                        className="h-9"
                    />
                    {unit && (
                        <p className="text-xs text-muted-foreground">{unit}</p>
                    )}
                </div>

                <div className="space-y-1">
                    <Input
                        type="number"
                        placeholder={placeholder.max}
                        value={maxValue}
                        onChange={(e) => handleMaxChange(e.target.value)}
                        step={step}
                        className="h-9"
                    />
                    {unit && (
                        <p className="text-xs text-muted-foreground">{unit}</p>
                    )}
                </div>
            </div>

            {hasActiveFilter && (
                <p className="text-xs text-muted-foreground">
                    {min !== null && max !== null
                        ? `Entre ${min} e ${max} ${unit}`
                        : min !== null
                            ? `Mínimo ${min} ${unit}`
                            : `Máximo ${max} ${unit}`}
                </p>
            )}
        </div>
    )
}
