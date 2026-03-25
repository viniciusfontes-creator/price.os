'use client'

import { ShieldAlert, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { GatekeeperAction } from '@/types/intelligence'

interface GatekeeperDialogProps {
  action: GatekeeperAction
  onConfirm: (decision: 'approved' | 'rejected') => void
}

export function GatekeeperDialog({ action, onConfirm }: GatekeeperDialogProps) {
  return (
    <Card className="border-amber-500/50 bg-amber-500/5 my-2">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-sm font-semibold">Confirmacao Necessaria</span>
        </div>

        <div className="text-sm space-y-2">
          <p className="text-foreground">{action.description}</p>
          {action.impact && (
            <div className="bg-background/50 rounded-md p-2 text-xs text-muted-foreground">
              <span className="font-medium">Impacto estimado: </span>
              {action.impact}
            </div>
          )}
        </div>

        {action.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onConfirm('approved')}
              className="gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onConfirm('rejected')}
              className="gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Rejeitar
            </Button>
          </div>
        )}

        {action.status === 'approved' && (
          <div className="text-xs text-green-600 font-medium">Acao aprovada</div>
        )}
        {action.status === 'rejected' && (
          <div className="text-xs text-red-600 font-medium">Acao rejeitada</div>
        )}
      </CardContent>
    </Card>
  )
}
