# DIAGNOSTICO COMPLETO DO PROJETO - Qavi Dashboard

**Data**: 16 de Fevereiro de 2026
**Analise por**: Claude Code (Opus 4.6)
**Versao do Projeto**: 1.1.0

---

## 1. RESUMO EXECUTIVO

O Qavi Dashboard e um sistema de gestao hoteleira construido com Next.js 14 + React 19 + TypeScript, integrando BigQuery (data warehouse), Supabase (dados competitivos), e Google Gemini AI (chat). O projeto esta funcional e em producao via Netlify, mas apresenta **problemas criticos de seguranca**, **codigo duplicado**, **documentacao excessiva e desatualizada**, e **debitos tecnicos** que precisam atencao imediata.

### Pontuacao Geral: 6.5/10

| Criterio | Nota | Observacao |
|----------|------|------------|
| Seguranca | 3/10 | Credenciais expostas, sem autenticacao, APIs publicas |
| Arquitetura | 7/10 | Bem estruturado, mas com duplicacoes e inconsistencias |
| Codigo | 6/10 | Funcional, mas com bugs, duplicacoes e code smells |
| Documentacao | 5/10 | Excessiva e desatualizada - quantidade nao e qualidade |
| Performance | 7/10 | SWR implementado, mas queries BQ sem filtro de data |
| Testes | 4/10 | Apenas 2 arquivos de teste, sem framework configurado |
| DevOps | 5/10 | Netlify configurado, mas sem CI/CD, sem git |

---

## 2. PROBLEMAS CRITICOS DE SEGURANCA

### 2.1 Credenciais GCP Expostas no Projeto
**Severidade: CRITICA**

O arquivo `service-account.json` contem a chave privada completa da conta de servico GCP (`qavi-425611@appspot.gserviceaccount.com`). Este arquivo esta no diretorio do projeto e embora esteja no `.gitignore`, qualquer pessoa com acesso ao diretorio tem acesso total ao BigQuery.

**Acao**: Revogar esta chave IMEDIATAMENTE no Google Cloud Console e gerar uma nova. Usar variaveis de ambiente para credenciais.

### 2.2 Chaves de API Expostas no .env.local
**Severidade: ALTA**

O `.env.local` contem credenciais reais:
- Supabase URL e anon key
- Google Places API key (duplicada como NEXT_PUBLIC - exposta ao cliente)
- GCP project ID

**Acao**: Rotacionar todas as chaves expostas. Remover `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` (expoe ao browser).

### 2.3 Zero Autenticacao
**Severidade: CRITICA**

Nenhuma das 15 API routes tem autenticacao. Qualquer pessoa pode:
- Consultar dados do BigQuery via `/api/dashboard/data`
- Usar a API Gemini via `/api/gemini`
- Acessar dados de propriedades via `/api/properties`
- Manipular cestas de concorrentes via `/api/baskets`

### 2.4 Erro Expoe Detalhes Internos
**Severidade: MEDIA**

Em `app/api/dashboard/data/route.ts:56`, o erro e exposto diretamente:
```
details: String(error)
```
Isso pode vazar informacoes sensíveis (stack traces, credenciais, queries SQL).

---

## 3. PROBLEMAS DE CODIGO

### 3.1 Logica de Calculo Duplicada
**Impacto: ALTO**

A funcao `calculateStatus()` esta implementada em DOIS lugares com a mesma logica:
- `lib/calculations.ts:300` - `calculatePropertyStatus()`
- `lib/bigquery-service.ts:379` - `calculateStatus()`

O mesmo ocorre com calculos de metricas, ticket medio, receita total, etc.

### 3.2 Bug: Status Sempre "A" no Filtro Global
**Impacto: ALTO**

Em `lib/filter-utils.ts:197`, a funcao `recalculateMetrics()` retorna:
```typescript
status: 'A' as const  // HARDCODED!
```
Isso significa que ao aplicar filtros, TODAS as propriedades ficam com status "A" (Excelente), independente da performance real. As metas tambem sao zeradas:
```typescript
metaMensal: 0,
metaMovel: 0,
receitaCheckoutMes: 0,
```

### 3.3 Performance: Calculo de Ocupacao O(n*m*k)
**Impacto: MEDIO**

Em `lib/calculation-utils.ts:89`, `calculateOccupancyRate()` tem triplo loop:
- Loop por dias no range
- Loop por propriedades filtradas
- Loop por reservas de cada propriedade

Para 346 propriedades x 90 dias x ~150 reservas = ~4.6M operacoes.

### 3.4 Console.logs de Debug em Producao
**Impacto: BAIXO**

Multiplos `console.log` de debug espalhados:
- `bigquery-service.ts:518` - Log de debug por propriedade
- `bigquery-service.ts:556` - Log de fetch
- `dashboard-provider.tsx:92` - Log de cache SWR

### 3.5 Tipo `any` em Funcoes Criticas
**Impacto: MEDIO**

- `filter-utils.ts:173` - `recalculateMetrics()` retorna `any`
- `filter-utils.ts:174` - parametro `metas: any[]`
- `bigquery-service.ts:401` - `transformBQPropriedade(bq: any)`
- `bigquery-service.ts:462` - `ocupacao: any[]`

### 3.6 Gemini Usa Modelo Diferente do Documentado
**Impacto: BAIXO**

A documentacao (API_SPEC.md, ARCHITECTURE.md) diz `gemini-1.5-pro`, mas o codigo real em `app/api/gemini/route.ts:22` usa `gemini-1.5-flash`. Tambem os parametros de geracao diferem (topK=1 vs documentado topK=40).

### 3.7 Mock Data vs BigQuery: Fluxos Desconectados
**Impacto: MEDIO**

O projeto tem dois fluxos de dados paralelos:
1. BigQuery: `DashboardProvider` -> `/api/dashboard/data` -> `bigquery-service.ts`
2. Mock: `mock-dashboard-data.ts` -> `mock-data.ts` (importado diretamente por paginas)

Paginas como `command-center`, `inventory`, `system` usam mock data diretamente, enquanto `page.tsx` (dashboard), `vendas`, `pricing`, `sales-demand` usam BigQuery via SWR. Isso cria inconsistencia nos dados exibidos.

---

## 4. PROBLEMAS DE DOCUMENTACAO

### 4.1 Excesso de Documentos Redundantes
O projeto tem **18+ arquivos .md** entre raiz e docs/:

**Raiz (8 arquivos)**:
- README.md
- ARCHITECTURE.md
- CHANGELOG.md
- EXECUTIVE_SUMMARY.md
- FEATURES.md
- PRODUCT_BRIEF.md
- API_SPEC.md
- WALKTHROUGH.md

**docs/ (10 arquivos)**:
- INDEX.md
- USER_GUIDE.md
- DATA_LAYER.md
- IMPLEMENTATION.md
- INTEGRATION_TESTING.md
- PROJECT_COMPLETION.md
- analise-performance.md
- n8n-market-monitor-workflow.md
- n8n-market-monitor-workflow.json
- saved_features/ia_market_scanner_logic.md

**Problema**: Muito conteudo repetido entre EXECUTIVE_SUMMARY, README, PROJECT_COMPLETION, e FEATURES. A mesma informacao aparece em 3-4 lugares.

### 4.2 Documentacao Desatualizada
- Docs foram escritos em **28-29 Jan 2026**
- Codigo evoluiu significativamente ate **9-16 Feb 2026**
- BigQuery integration, SWR cache, Market Monitor - nenhum documentado
- README ainda fala em "operations page" que nao existe mais (virou "vendas")
- ARCHITECTURE.md menciona `lib/data-provider.ts` (Facade pattern) que nao existe
- API_SPEC.md nao documenta 14 das 15 API routes

### 4.3 Documentacao "Gerada por Gemini"
Varios documentos foram gerados por Gemini AI com notas aspiracionais:
- Benchmarks de performance nao verificados
- "85% test coverage" quando na verdade nao ha framework de testes configurado
- Afirmacoes como "virtual scrolling implementado" sem evidencia no codigo

---

## 5. PROBLEMAS DE ARQUITETURA

### 5.1 Sem Controle de Versao (Git)
**Impacto: CRITICO**

O projeto NAO e um repositorio git. Isso significa:
- Sem historico de mudancas
- Sem possibilidade de rollback
- Sem branches para features
- Sem code review
- Sem CI/CD

### 5.2 Arquivo `diagnose_db.js` na Raiz
Arquivo de diagnostico avulso (`diagnose_db.js`) na raiz do projeto - provavelmente temporario, deveria ser removido ou movido para scripts/.

### 5.3 Tres Lock Files
O projeto tem TRES lock files:
- `package-lock.json` (npm)
- `pnpm-lock.yaml` (pnpm)
- `bun.lock` (bun)

Isso indica que diferentes package managers foram usados, o que pode causar inconsistencias de dependencias.

### 5.4 Falta de Fallback no Dashboard
O `DashboardProvider` busca dados de `/api/dashboard/data` (BigQuery). Se falhar, retorna array vazio - nao tem fallback para mock data. Isso e mencionado na UI como "dados de fallback" mas nao esta implementado.

### 5.5 Hooks Possivelmente Nao Utilizados
`hooks/use-dashboard-data.ts` pode estar duplicando funcionalidade do `DashboardProvider`. Verificar se ainda e usado.

---

## 6. INVENTARIO DE ARQUIVOS

### API Routes (15 endpoints)
| Rota | Metodo | Funcao | Status |
|------|--------|--------|--------|
| `/api/dashboard/data` | GET | Dados integrados BigQuery | Funcional |
| `/api/gemini` | POST | Chat IA streaming | Funcional |
| `/api/bigquery/data` | GET | Dados brutos BigQuery | A verificar |
| `/api/properties` | GET | Lista propriedades | A verificar |
| `/api/data/properties` | GET | Propriedades (duplicado?) | A verificar |
| `/api/pricing-intelligence` | GET | Inteligencia de precos | A verificar |
| `/api/competitors` | GET | Concorrentes (Supabase) | A verificar |
| `/api/competitors/basket` | GET/POST | Cestas de concorrentes | A verificar |
| `/api/competitors/locations` | GET | Localizacoes | A verificar |
| `/api/baskets` | GET/POST | Gestao de cestas | A verificar |
| `/api/baskets/items` | GET/POST | Itens das cestas | A verificar |
| `/api/baskets/scrape` | POST | Trigger scraping | A verificar |
| `/api/scraper/trigger` | POST | Trigger scraper n8n | A verificar |
| `/api/places/autocomplete` | GET | Google Places autocomplete | A verificar |
| `/api/places/details` | GET | Google Places detalhes | A verificar |

### Paginas (12)
| Rota | Arquivo | Status |
|------|---------|--------|
| `/` | app/page.tsx | BigQuery + Filtros |
| `/vendas` | app/vendas/page.tsx | BigQuery |
| `/pricing` | app/pricing/page.tsx | BigQuery + pricing-intel |
| `/sales-demand` | app/sales-demand/page.tsx | BigQuery |
| `/revenue` | app/revenue/page.tsx | Mock data |
| `/command-center` | app/command-center/page.tsx | Mock data |
| `/concorrencia` | app/concorrencia/page.tsx | Supabase |
| `/correlacao` | app/correlacao/page.tsx | Supabase |
| `/inteligencia` | app/inteligencia/page.tsx | Mock data |
| `/inventory` | app/inventory/page.tsx | Mock data |
| `/inventory/abnormal` | app/inventory/abnormal/page.tsx | Mock data |
| `/inventory/availability` | app/inventory/availability/page.tsx | Mock data |
| `/system` | app/system/page.tsx | Mock data |
| `/unidade/[id]` | app/unidade/[id]/page.tsx | Mock data |

---

## 7. O QUE ESTA BEM

1. **Tipos TypeScript** bem definidos e baseados no schema BigQuery
2. **Sistema de Filtros Globais** robusto com persistencia localStorage
3. **Cache SWR** implementado para dados do dashboard
4. **Componentes shadcn/ui** bem utilizados
5. **BigQuery Service** com queries SQL de producao
6. **Streaming Gemini** funcional para chat
7. **Responsivo** com suporte mobile
8. **Dark mode** implementado
9. **Market Monitor** (cestas de concorrentes) com Supabase
10. **Sidebar** navegavel com todas as paginas

---

## 8. RECOMENDACOES PRIORIZADAS

### URGENTE (Fazer Agora)
1. Inicializar repositorio Git e fazer commit inicial
2. Revogar e rotacionar TODAS as credenciais expostas
3. Remover `service-account.json` e usar env vars
4. Corrigir bug do status "A" hardcoded em filter-utils.ts

### ALTA PRIORIDADE (Proxima Semana)
5. Implementar autenticacao (NextAuth.js)
6. Unificar fluxo de dados (eliminar mock data das paginas em producao)
7. Consolidar documentacao (de 18 para ~5 documentos)
8. Remover lock files extras (manter apenas package-lock.json)
9. Adicionar rate limiting na API Gemini

### MEDIA PRIORIDADE (Proximo Mes)
10. Configurar framework de testes (Vitest)
11. Remover console.logs de producao
12. Eliminar duplicacao de logica de calculo
13. Corrigir tipos `any` em funcoes criticas
14. Adicionar Error Boundaries
15. Otimizar query de ocupacao (filtro por data no BigQuery)

### BAIXA PRIORIDADE (Backlog)
16. Implementar filtros na URL (state management)
17. Adicionar presets de filtros salvos
18. CI/CD pipeline
19. Monitoramento e logging estruturado
20. Export de dados filtrados
