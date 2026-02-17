"use client"

import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
}

export function ProgressBar({ value, max = 100, className, showLabel = true, size = "md" }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)

  const getColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500"
    if (percent >= 80) return "bg-blue-500"
    if (percent >= 60) return "bg-yellow-500"
    return "bg-red-500"
  }

  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  }

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("w-full bg-gray-200 rounded-full overflow-hidden", sizeClasses[size])}>
        <div
          className={cn("h-full transition-all duration-700 ease-out rounded-full", getColor(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>{Math.round(percentage)}%</span>
          <span>
            {value.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")}
          </span>
        </div>
      )}
    </div>
  )
}
