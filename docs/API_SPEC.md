# API_SPEC.md - Especificação de APIs e Contratos

## 📚 Índice

1. [Visão Geral](#visão-geral)
2. [API Routes do Next.js](#api-routes-do-nextjs)
3. [Contratos de Dados (TypeScript)](#contratos-de-dados)
4. [Integração Externa](#integração-externa)
5. [Webhooks (Planejado)](#webhooks-planejado)

---

## 🌐 Visão Geral

Este documento especifica todos os endpoints de API, contratos de dados e integrações externas do sistema.

### Base URLs

| Ambiente | URL Base | Observações |
|----------|----------|-------------|
| **Desenvolvimento** | `http://localhost:3000` | Hot reload ativo |
| **Produção** | `https://your-domain.com` | TBD - deploy em Vercel |

### Autenticação

Atualmente **não há autenticação** implementada. As APIs são públicas no ambiente de desenvolvimento.

> ⚠️ **CRÍTICO**: Antes de deploy em produção, implementar:
>
> - NextAuth.js para autenticação de usuários
> - API Key rotation para Gemini
> - Rate limiting para evitar abuso

---

## 🛣️ API Routes do Next.js

### 1. **POST /api/gemini**

#### Descrição

Endpoint proxy para a Google Gemini API. Recebe perguntas do usuário e retorna respostas da IA em streaming.

#### Endpoint

```
POST /api/gemini
```

#### Request Headers

```http
Content-Type: application/json
```

#### Request Body

```typescript
interface GeminiRequest {
  message: string        // Pergunta do usuário
  context?: string       // Contexto adicional do sistema (opcional)
}
```

**Exemplo**:

```json
{
  "message": "Qual foi a receita total de janeiro?",
  "context": "Dados atuais do sistema:\n- Total de reservas: 842\n- Receita total: R$ 234.567,89\n..."
}
```

#### Response

**Content-Type**: `text/plain; charset=utf-8`  
**Transfer-Encoding**: `chunked` (streaming)

O endpoint retorna um **stream de texto** com chunks enviados incrementalmente.

**Exemplo de chunks** (decodificados):

```
Chunk 1: "Com base nos dados"
Chunk 2: " do sistema, a receita"
Chunk 3: " total de janeiro foi"
Chunk 4: " de R$ 234.567,89..."
```

#### Códigos de Status

| Código | Descrição | Cenário |
|--------|-----------|---------|
| `200` | OK | Stream iniciado com sucesso |
| `400` | Bad Request | `message` ausente ou inválido |
| `401` | Unauthorized | `GEMINI_API_KEY` não configurada |
| `500` | Internal Server Error | Erro na comunicação com Gemini API |

#### Error Response

```json
{
  "error": "Missing required field: message"
}
```

#### Implementação

```typescript
// app/api/gemini/route.ts
export async function POST(request: Request) {
  const { message, context } = await request.json()
  
  if (!message) {
    return new Response(
      JSON.stringify({ error: "Missing required field: message" }),
      { status: 400 }
    )
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gemini API key not configured" }),
      { status: 401 }
    )
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

  const prompt = context 
    ? `${context}\n\nPergunta do usuário: ${message}` 
    : message

  const result = await model.generateContentStream(prompt)
  
  // Retorna stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of result.stream) {
        const text = chunk.text()
        controller.enqueue(encoder.encode(text))
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  })
}
```

#### Rate Limiting (Recomendado)

Não implementado. **Sugestão**:

```typescript
// Usando Vercel KV ou Upstash Redis
import { Ratelimit } from "@upstash/ratelimit"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),  // 10 req/min
})

// No handler
const { success } = await ratelimit.limit(identifier)
if (!success) {
  return new Response("Too many requests", { status: 429 })
}
```

---

## 📦 Contratos de Dados (TypeScript)

### Core Types

Definidos em `types/index.ts`, baseados no **schema BigQuery warehouse**.

#### 1. **WebhookPropriedade**

```typescript
interface WebhookPropriedade {
  idpropriedade: string           // PK - e.g., "prop-0001"
  nomepropriedade: string         // Nome da propriedade
  grupo_nome: string              // "Luxury" | "Premium" | "Standard" | "Economy"
  praca: string                   // Localização geográfica
  empreendimento_pousada: string  // "short stay" | "long stay" | "mixed"
  sub_grupo: string               // Categoria secundária
  nome_externo?: string           // Nome para exibição em OTAs
  Status_Aparente?: string        // "Ativo" | "Inativo"
  longitude?: number              // Coordenadas GPS
  latitude?: number
  _i_maxguests?: number           // Capacidade máxima de hóspedes
}
```

**Origem BigQuery**: `warehouse.propriedades_subgrupos`

---

#### 2. **WebhookReserva**

```typescript
interface WebhookReserva {
  idpropriedade: string          // FK para WebhookPropriedade
  idReserva?: string             // PK - e.g., "res-prop-0001-042"
  type?: string                  // "confirmed" | "canceled" | "pending"
  companycommision: number       // Comissão da empresa em R$
  buyprice: number               // Repasse ao proprietário em R$
  reservetotal: number           // Valor total da reserva em R$
  checkoutdate: string           // ISO date "YYYY-MM-DD"
  creationdate: string           // ISO date "YYYY-MM-DD"
  checkindate: string            // ISO date "YYYY-MM-DD"
  antecedencia_reserva: number   // Dias entre criação e check-in
  guesttotalcount: number        // Total de hóspedes
  nightcount: number             // Número de diárias
  pricepernight: number          // Preço médio por noite em R$
  partnername: string            // Canal de venda (e.g., "Booking.com")
  agentname: string              // Corretor responsável
}
```

**Origem BigQuery**: `warehouse.reservas_all`

**Regras de Negócio**:

- Reservas com `type = 'canceled'` **NÃO** devem ser incluídas em cálculos de receita
- `checkoutdate` é a data de reconhecimento de receita
- `antecedencia_reserva` é calculado automaticamente

---

#### 3. **WebhookMeta**

```typescript
interface WebhookMeta {
  IdPropriedade: string         // FK para WebhookPropriedade
  data_especifica: string       // ISO date "YYYY-MM-01" (primeiro dia do mês)
  meta: number                  // Meta mensal em R$
  meta_movel: number            // Meta móvel (85% da meta mensal)
  mes?: number                  // Mês (1-12), derivado de data_especifica
}
```

**Origem BigQuery**: `stage.metas_mensais_unidade`

---

#### 4. **IntegratedData**

```typescript
interface IntegratedData {
  propriedade: WebhookPropriedade
  reservas: WebhookReserva[]
  metas: WebhookMeta[]
  salesGoals?: SalesGoals
  metricas: PropriedadeMetricas
}
```

Este é o tipo principal retornado pelo `WebhookService.getCachedData()`.

---

#### 5. **PropriedadeMetricas** (Calculado)

```typescript
interface PropriedadeMetricas {
  totalReservas: number           // Total de reservas confirmadas
  receitaTotal: number            // SUM(reservetotal)
  ticketMedio: number             // receitaTotal / totalReservas
  hospedesTotais: number          // SUM(guesttotalcount)
  diariasVendidas: number         // SUM(nightcount)
  precoMedioNoite: number         // AVG(pricepernight)
  antecedenciaMedia: number       // AVG(antecedencia_reserva)
  metaMensal: number              // Meta do mês atual
  metaMovel: number               // Meta móvel do mês atual
  receitaCheckoutMes: number      // Receita com checkout no mês
  status: "A" | "B" | "C" | "D" | "E"  // Status calculado
}
```

**Calculado por**: `lib/mock-data.ts` → `calculateMetrics()`

---

### Helper Types

#### **GlobalFilters**

```typescript
interface GlobalFilters {
  grupo: string                  // "" = todos
  praca: string
  partnername: string
  status: string
  receita: { min: number; max: number } | null
  dateRange: { start: string; end: string } | null
}
```

#### **WebhookSyncStatus**

```typescript
interface WebhookSyncStatus {
  lastSync: Date | null
  isLoading: boolean
  error: string | null
  totalPropriedades: number
  totalReservas: number
  totalMetas: number
}
```

---

## 🌍 Integração Externa

### Google Gemini API

#### Modelo Utilizado

```
gemini-1.5-flash (latest)
```

#### Configuração

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
  }
})
```

#### Parâmetros de Geração

| Parâmetro | Valor | Explicação |
|-----------|-------|------------|
| `temperature` | 0.7 | Equilíbrio criatividade/precisão |
| `topP` | 0.95 | Nucleus sampling |
| `topK` | 40 | Número de tokens candidatos |
| `maxOutputTokens` | 2048 | Limite de resposta |

#### Custos Estimados

Baseado em [pricing do Gemini](https://ai.google.dev/pricing):

| Modelo | Input (1M tokens) | Output (1M tokens) |
|--------|-------------------|-------------------|
| gemini-1.5-flash | $3.50 | $10.50 |

**Estimativa de uso**:

- 100 perguntas/dia × 500 tokens/pergunta = 50K tokens/dia
- 50K tokens × 30 dias = 1.5M tokens/mês
- **Custo mensal**: ~$5-7 USD

---

## 🔗 Webhooks (Planejado)

Atualmente o sistema usa **dados mock**. A integração com webhooks reais está planejada para Q2 2026.

### Endpoint Esperados (Backend)

#### 1. **GET /webhooks/propriedades**

```json
// Response
{
  "data": [
    {
      "idpropriedade": "prop-0001",
      "nomepropriedade": "Ponta Negra - Vista Mar 101",
      "grupo_nome": "Premium",
      "praca": "Ponta Negra",
      ...
    }
  ],
  "total": 80,
  "page": 1,
  "pageSize": 50
}
```

#### 2. **GET /webhooks/reservas**

```json
{
  "data": [
    {
      "idpropriedade": "prop-0001",
      "idReserva": "res-001",
      "reservetotal": 1250.00,
      "checkoutdate": "2026-02-15",
      ...
    }
  ],
  "total": 842
}
```

#### 3. **GET /webhooks/metas**

```json
{
  "data": [
    {
      "IdPropriedade": "prop-0001",
      "data_especifica": "2026-01-01",
      "meta": 15000,
      "meta_movel": 12750
    }
  ]
}
```

### Configuração de Webhooks

Será gerenciada via componente `WebhookConfigModal`:

```typescript
interface WebhookConfig {
  webhook1Url: string   // URL de propriedades
  webhook2Url: string   // URL de reservas
  webhook3Url: string   // URL de metas
  isConfigured: boolean
  timeout?: number      // Timeout em ms (padrão: 5000)
}
```

Armazenamento: `localStorage` (`webhook-config` key)

---

## 🔒 Segurança

### Variáveis de Ambiente

**OBRIGATÓRIAS**:

```env
GEMINI_API_KEY="AIza..."  # Server-side only, NUNCA expor ao cliente
```

**OPCIONAIS (futuro)**:

```env
NEXT_PUBLIC_WEBHOOK_BASE_URL="https://api.backend.com"
WEBHOOK_AUTH_TOKEN="Bearer xyz..."
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
```

### CORS

Não configurado atualmente (single domain). Para multi-domain:

```typescript
// next.config.mjs
export default {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE" },
        ],
      },
    ]
  },
}
```

---

## 📝 Notas de Implementação

### Convenções de Nomenclatura

- **Campos de Data**: Sempre ISO 8601 (`YYYY-MM-DD`)
- **Campos Monetários**: Sempre `number` (nunca string)
- **IDs**: Prefixo descritivo (e.g., `prop-`, `res-`, `cot-`)

### Tratamento de Tipos Nulos

Usar optional chaining e nullish coalescing:

```typescript
const receita = propriedade.metricas?.receitaTotal ?? 0
```

### Validação de Dados

Usar **Zod** para runtime validation:

```typescript
import { z } from "zod"

const ReservaSchema = z.object({
  idpropriedade: z.string(),
  reservetotal: z.number().positive(),
  checkoutdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const validated = ReservaSchema.parse(data)
```

---

**Especificação mantida por:** Gemini AI - Solutions Architect  
**Última atualização:** 28 de Janeiro de 2026  
**Versão API:** 1.0 (Mock Data)
