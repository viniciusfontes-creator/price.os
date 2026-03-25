// ============================================
// TOOL REGISTRY
// Central registry of all tools available to agents
// ============================================

import type { ToolDefinition } from '../types'
import { bigqueryTools } from './bigquery-tools'
import { supabaseTools } from './supabase-tools'
import { calculationTools } from './calculation-tools'
import { pricingTools } from './pricing-tools'
import { webSearchTools } from './web-search-tools'
import { analysisTools } from './analysis-tools'
import { memoryTools } from './memory-tools'

let _allTools: ToolDefinition[] | null = null

export function getAllTools(): ToolDefinition[] {
  if (!_allTools) {
    _allTools = [
      ...bigqueryTools,
      ...supabaseTools,
      ...calculationTools,
      ...pricingTools,
      ...webSearchTools,
      ...analysisTools,
      ...memoryTools,
    ]
  }
  return _allTools
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return getAllTools().find((t) => t.name === name)
}
