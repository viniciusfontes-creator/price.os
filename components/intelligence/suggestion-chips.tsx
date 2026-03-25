'use client'

import { TrendingUp, AlertTriangle, Target, Calendar, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SUGGESTIONS = [
  {
    label: 'Como esta o pace de vendas deste mes?',
    icon: TrendingUp,
  },
  {
    label: 'Quais propriedades estao abaixo da meta?',
    icon: AlertTriangle,
  },
  {
    label: 'Analise os concorrentes mais proximos',
    icon: Target,
  },
  {
    label: 'Taxa de ocupacao para os proximos 30 dias',
    icon: Calendar,
  },
  {
    label: 'Sugira ajustes de preco para unidades criticas',
    icon: DollarSign,
  },
]

interface SuggestionChipsProps {
  onSelect: (message: string) => void
}

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Intelligence Hub</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Faca perguntas sobre performance, pricing, concorrencia e disponibilidade.
          Agentes especializados vao analisar os dados em tempo real.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon
          return (
            <Button
              key={s.label}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-auto py-2 px-3"
              onClick={() => onSelect(s.label)}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {s.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
