# TASKS - Proximos Passos Priorizados

**Data**: 16 de Fevereiro de 2026
**Baseado em**: DIAGNOSTICO.md

---

## FASE 1: SEGURANCA (Urgente - Fazer Agora)

- [ ] **T01** - Inicializar repositorio Git (`git init` + commit inicial)
- [ ] **T02** - Revogar chave do service-account.json no GCP Console
- [ ] **T03** - Deletar `service-account.json` do projeto
- [ ] **T04** - Configurar credenciais GCP via env vars (GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY)
- [ ] **T05** - Rotacionar Supabase anon key
- [ ] **T06** - Rotacionar Google Places API key
- [ ] **T07** - Remover `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` (mover para server-side)
- [ ] **T08** - Sanitizar erro na API dashboard/data (nao expor String(error))

## FASE 2: BUGS CRITICOS (Alta Prioridade)

- [ ] **T09** - Corrigir `recalculateMetrics()` em filter-utils.ts (status hardcoded "A", metas zeradas)
- [ ] **T10** - Unificar `calculateStatus()` - remover duplicata de bigquery-service.ts, usar de calculations.ts
- [ ] **T11** - Corrigir modelo Gemini na doc (flash vs pro) ou atualizar o codigo
- [ ] **T12** - Adicionar fallback mock data no DashboardProvider quando BigQuery falha

## FASE 3: LIMPEZA DE PROJETO (Alta Prioridade)

- [ ] **T13** - Remover lock files extras (manter apenas package-lock.json, deletar pnpm-lock.yaml e bun.lock)
- [ ] **T14** - Remover `diagnose_db.js` da raiz (mover para scripts/ ou deletar)
- [ ] **T15** - Remover console.logs de debug do codigo de producao
- [ ] **T16** - Verificar e remover hook `use-dashboard-data.ts` se duplicado com DashboardProvider
- [ ] **T17** - Verificar API routes duplicadas (`/api/properties` vs `/api/data/properties`)

## FASE 4: CONSOLIDACAO DE DOCUMENTACAO (Alta Prioridade)

- [ ] **T18** - Reescrever README.md (conciso, atualizado, sem informacoes geradas por IA nao verificadas)
- [ ] **T19** - Mover ARCHITECTURE.md, API_SPEC.md, FEATURES.md para docs/
- [ ] **T20** - Deletar documentos redundantes:
  - EXECUTIVE_SUMMARY.md (conteudo ja em README)
  - WALKTHROUGH.md (conteudo ja em USER_GUIDE)
  - PROJECT_COMPLETION.md (snapshot obsoleto)
  - IMPLEMENTATION.md (conteudo ja em ARCHITECTURE)
- [ ] **T21** - Atualizar ARCHITECTURE.md com estrutura real (BigQuery flow, SWR, Market Monitor)
- [ ] **T22** - Atualizar API_SPEC.md com TODAS as 15 API routes
- [ ] **T23** - Manter DIAGNOSTICO.md e TASKS.md como documentos vivos

## FASE 5: QUALIDADE DE CODIGO (Media Prioridade)

- [ ] **T24** - Substituir tipos `any` por tipos corretos em filter-utils.ts e bigquery-service.ts
- [ ] **T25** - Extrair funcao `calculateStatus()` para um unico lugar e importar em ambos arquivos
- [ ] **T26** - Otimizar `calculateOccupancyRate()` - usar Map pre-computado em vez de triple loop
- [ ] **T27** - Migrar paginas que usam mock data para BigQuery (revenue, command-center, inventory, etc)
- [ ] **T28** - Adicionar Error Boundaries em componentes criticos

## FASE 6: AUTENTICACAO E PROTECAO (Media Prioridade)

- [ ] **T29** - Instalar e configurar NextAuth.js
- [ ] **T30** - Proteger TODAS as API routes com middleware de autenticacao
- [ ] **T31** - Adicionar rate limiting na rota `/api/gemini`
- [ ] **T32** - Configurar CORS adequadamente

## FASE 7: TESTES (Media Prioridade)

- [ ] **T33** - Configurar Vitest + React Testing Library
- [ ] **T34** - Escrever testes para calculations.ts (logica de negocio critica)
- [ ] **T35** - Escrever testes para filter-utils.ts
- [ ] **T36** - Escrever testes para bigquery-service.ts (transformacoes)
- [ ] **T37** - Migrar/validar testes existentes em __tests__/

## FASE 8: MELHORIAS FUTURAS (Backlog)

- [ ] **T38** - Implementar filtros na URL (compartilhar views)
- [ ] **T39** - Adicionar filtro de data nas queries BigQuery (hoje busca TUDO)
- [ ] **T40** - CI/CD pipeline (GitHub Actions)
- [ ] **T41** - Logging estruturado (substituir console.log)
- [ ] **T42** - Export de dados filtrados (CSV/Excel)
- [ ] **T43** - PWA com service workers

---

## Ordem de Execucao Sugerida

```
FASE 1 (T01-T08) -> FASE 2 (T09-T12) -> FASE 3 (T13-T17) -> FASE 4 (T18-T23)
    |                                                                    |
    v                                                                    v
FASE 5 (T24-T28) ----- em paralelo com ----- FASE 6 (T29-T32)
    |
    v
FASE 7 (T33-T37) -> FASE 8 (T38-T43)
```

**Estimativa total**: ~3-4 semanas para Fases 1-6, ~2 semanas para Fase 7, Fase 8 e backlog continuo.
