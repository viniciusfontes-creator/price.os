"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MultiSelectFilterProps {
    label: string
    options: { value: string; label: string; count?: number }[]
    selected: string[]
    onChange: (selected: string[]) => void
    searchable?: boolean
    placeholder?: string
}

export function MultiSelectFilter({
    label,
    options,
    selected,
    onChange,
    searchable = true,
    placeholder = "Selecione...",
}: MultiSelectFilterProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    // Debug logging
    React.useEffect(() => {
        console.log(`[MultiSelectFilter] ${label}:`, {
            optionsCount: options.length,
            selectedCount: selected.length,
            firstOptions: options.slice(0, 3)
        })
    }, [label, options.length, selected.length])

    const filteredOptions = search
        ? options.filter((opt) =>
            opt.label.toLowerCase().includes(search.toLowerCase())
        )
        : options

    const toggleOption = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value))
        } else {
            onChange([...selected, value])
        }
    }

    const selectAll = () => {
        onChange(options.map((opt) => opt.value))
    }

    const clearAll = () => {
        onChange([])
    }

    const removeSelected = (value: string) => {
        onChange(selected.filter((v) => v !== value))
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{label}</Label>
                {selected.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAll}
                        className="h-7 text-xs"
                    >
                        Limpar
                    </Button>
                )}
            </div>

            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isOpen}
                        className="w-full justify-between"
                    >
                        <span className="truncate">
                            {selected.length === 0
                                ? placeholder
                                : `${selected.length} selecionado${selected.length > 1 ? 's' : ''}`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                        {searchable && (
                            <CommandInput
                                placeholder={`Buscar ${label.toLowerCase()}...`}
                                value={search}
                                onValueChange={setSearch}
                            />
                        )}
                        <div className="flex items-center justify-between px-2 py-1.5 border-b">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={selectAll}
                                className="h-7 text-xs"
                            >
                                Selecionar tudo
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAll}
                                className="h-7 text-xs"
                            >
                                Limpar
                            </Button>
                        </div>
                        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                        <CommandList className="max-h-64 overflow-auto">
                            <CommandGroup>
                                {filteredOptions.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        onSelect={() => toggleOption(option.value)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selected.includes(option.value) ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="flex-1">{option.label}</span>
                                        {option.count !== undefined && (
                                            <span className="text-xs text-muted-foreground">
                                                ({option.count})
                                            </span>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {selected.slice(0, 5).map((value) => {
                        const option = options.find((opt) => opt.value === value)
                        return (
                            <Badge
                                key={value}
                                variant="secondary"
                                className="text-xs"
                            >
                                {option?.label || value}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        removeSelected(value)
                                    }}
                                    className="ml-1 hover:text-destructive"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )
                    })}
                    {selected.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                            +{selected.length - 5} mais
                        </Badge>
                    )}
                </div>
            )}
        </div>
    )
}
