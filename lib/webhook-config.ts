import type { WebhookConfig } from "@/types"

// ============================================
// WEBHOOK CONFIG - MOCK MODE
// Webhooks desabilitados, usando dados mock
// ============================================

const WEBHOOK_CONFIG_KEY = "webhook_config"

// URLs dos webhooks (desabilitados no modo mock)
const DEFAULT_WEBHOOK_URLS = {
  webhook1Url: "", // Propriedades - desabilitado
  webhook2Url: "", // Reservas - desabilitado
  webhook3Url: "", // Metas - desabilitado
}

export function getWebhookConfig(): WebhookConfig {
  return WebhookConfigManager.getConfig()
}

export class WebhookConfigManager {
  static getConfig(): WebhookConfig {
    // Sempre retorna configuração para modo mock
    return {
      ...DEFAULT_WEBHOOK_URLS,
      isConfigured: false, // Webhooks não estão configurados (usando mock)
      timeout: 30000,
    }
  }

  static saveConfig(config: WebhookConfig): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(WEBHOOK_CONFIG_KEY, JSON.stringify(config))
    }
  }

  static clearConfig(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(WEBHOOK_CONFIG_KEY)
    }
  }

  static validateConfig(config: WebhookConfig): boolean {
    // No modo mock, sempre retorna false pois webhooks estão desabilitados
    return false
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // Verificar se está em modo mock
  static isMockMode(): boolean {
    return true // Sempre em modo mock
  }
}
