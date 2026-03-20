import { useState, useCallback, useRef, useEffect } from 'react'

interface ChartLoadingState {
  total: number
  completed: number
  progress: number
  isLoading: boolean
}

interface ChartTracker {
  id: string
  status: 'pending' | 'completed'
  timestamp: number
}

/**
 * Hook para tracking de loading state de múltiplos gráficos/charts
 *
 * @example
 * const { progress, isLoading, registerChart, completeChart, reset } = useChartLoading()
 *
 * // Registrar charts no início
 * useEffect(() => {
 *   registerChart('basket-evolution')
 *   registerChart('price-comparison')
 * }, [])
 *
 * // Marcar como completo quando dados carregarem
 * useEffect(() => {
 *   if (chartData) {
 *     completeChart('basket-evolution')
 *   }
 * }, [chartData])
 */
export function useChartLoading() {
  const [state, setState] = useState<ChartLoadingState>({
    total: 0,
    completed: 0,
    progress: 0,
    isLoading: false
  })

  const trackers = useRef<Map<string, ChartTracker>>(new Map())

  /**
   * Registra um novo chart para tracking
   */
  const registerChart = useCallback((chartId: string) => {
    if (trackers.current.has(chartId)) {
      return // Já registrado
    }

    trackers.current.set(chartId, {
      id: chartId,
      status: 'pending',
      timestamp: Date.now()
    })

    setState(prev => {
      const total = trackers.current.size
      const completed = Array.from(trackers.current.values()).filter(
        t => t.status === 'completed'
      ).length
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0

      return {
        total,
        completed,
        progress,
        isLoading: completed < total
      }
    })
  }, [])

  /**
   * Marca um chart como completado
   */
  const completeChart = useCallback((chartId: string) => {
    const tracker = trackers.current.get(chartId)
    if (!tracker || tracker.status === 'completed') {
      return // Não existe ou já está completo
    }

    tracker.status = 'completed'
    tracker.timestamp = Date.now()

    setState(prev => {
      const total = trackers.current.size
      const completed = Array.from(trackers.current.values()).filter(
        t => t.status === 'completed'
      ).length
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0

      return {
        total,
        completed,
        progress,
        isLoading: completed < total
      }
    })
  }, [])

  /**
   * Reseta todos os trackers
   */
  const reset = useCallback(() => {
    trackers.current.clear()
    setState({
      total: 0,
      completed: 0,
      progress: 0,
      isLoading: false
    })
  }, [])

  /**
   * Retorna o status de um chart específico
   */
  const getChartStatus = useCallback((chartId: string): 'pending' | 'completed' | 'not-registered' => {
    const tracker = trackers.current.get(chartId)
    return tracker ? tracker.status : 'not-registered'
  }, [])

  /**
   * Registra múltiplos charts de uma vez
   */
  const registerCharts = useCallback((chartIds: string[]) => {
    chartIds.forEach(id => registerChart(id))
  }, [registerChart])

  return {
    progress: state.progress,
    isLoading: state.isLoading,
    total: state.total,
    completed: state.completed,
    registerChart,
    registerCharts,
    completeChart,
    reset,
    getChartStatus
  }
}

/**
 * Hook helper para auto-completar chart quando dados estão disponíveis
 *
 * @example
 * const { registerChart, completeChart } = useChartLoading()
 *
 * useAutoCompleteChart('my-chart', !!chartData, registerChart, completeChart)
 */
export function useAutoCompleteChart(
  chartId: string,
  dataReady: boolean,
  registerChart: (id: string) => void,
  completeChart: (id: string) => void
) {
  const hasRegistered = useRef(false)
  const hasCompleted = useRef(false)

  // Registrar no mount
  useEffect(() => {
    if (!hasRegistered.current) {
      registerChart(chartId)
      hasRegistered.current = true
    }
  }, [chartId, registerChart])

  // Completar quando dados prontos
  useEffect(() => {
    if (dataReady && !hasCompleted.current) {
      completeChart(chartId)
      hasCompleted.current = true
    }
  }, [dataReady, chartId, completeChart])
}
