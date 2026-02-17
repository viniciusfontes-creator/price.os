# Workflow n8n: Atualização de Monitor de Mercado

Este documento detalha o novo workflow necessário para atualizar os concorrentes específicos de uma Cesta no Monitor de Mercado.

## Objetivo

Receber uma lista de IDs do Airbnb (do botão "Atualizar Scraper" na interface) e atualizar os dados mais recentes de preço e disponibilidade para esses anúncios específicos.

## Estrutura do Workflow

### 1. Trigger: Webhook

- **Método:** `POST`
- **Caminho:** `/market-monitor/update` (ou similar)
- **Autenticação:** Opcional (ou via Header Token se desejar segurança extra)
- **Input Esperado (JSON):**

  ```json
  {
    "listingIds": ["12345678", "98765432", ...]
  }
  ```

### 2. Tratamento de Dados (Function/Code)

- **Ação:** Validar se `listingIds` é um array.
- **Lógica:** Transformar o array plano em itens individuais para o n8n processar (Item Lists -> Split Out).

### 3. Loop / Split in Batches

- **Tamanho do Lote:** 1 (processar um por um para segurança) ou pequenos lotes (ex: 5) se usar um serviço robusto de proxy/scraping.
- **Objetivo:** Evitar bloqueios do Airbnb e controlar o fluxo.

### 4. Scraper / HTTP Request (O Coração do Workflow)

Diferente do workflow "MASTER" que busca por cidade, este deve ir direto na fonte.

**Opção A: Integração com Apify (Recomendado se tiver)**

- Actor: `airbnb-scraper` (ou similar).
- Input: Passar as URLs diretas: `https://airbnb.com/rooms/{{ $json.id }}`.
- Configuração: Definir datas futuras (ex: próximos 30-90 dias) para capturar a evolução de preços real.

**Opção B: HTTP Request Direto (Avançado)**

- **URL:** `https://www.airbnb.com.br/api/v3/PdpAvailability` (API interna, sujeita a mudanças).
- **Parâmetros:** `pdp_listing_id`, `check_in`, `check_out`.
- **Nota:** Requer rotação de IPs/Proxies de alta qualidade (BrightData, Smartproxy, etc) para não levar captcha.

### 5. Parseamento de Dados

- Normalizar os dados recebidos para o formato da tabela `airbnb_extracoes`.
- **Campos Chave:**
  - `id_numerica`: ID do anúncio.
  - `preco_por_noite` / `preco_total`: Valor extraído.
  - `data_extracao`: Data/hora atual (`{{ new Date().toISOString() }}`).
  - `checkin_formatado`: Data para a qual o preço foi encontrado.

### 6. Atualização no Supabase

- **Node:** Supabase
- **Operação:** `Upsert` (Inserir ou Atualizar).
- **Tabela:** `airbnb_extracoes`
- **Match Columns:** `id_numerica`, `checkin_formatado` (para garantir que não duplique o dado do mesmo dia).
- **Dados:**

  ```json
  {
    "id_numerica": "{{ $json.listing_id }}",
    "nome_anuncio": "{{ $json.title }}",
    "preco_total": {{ $json.price }},
    "checkin_formatado": "{{ $json.date }}",
    "url_anuncio": "https://airbnb.com/rooms/{{ $json.listing_id }}",
    "data_extracao": "{{ $now }}"
  }
  ```

### 7. Resposta do Webhook

- **Node:** Respond to Webhook
- **Conteúdo:** Mensagem de sucesso indicando que o processamento começou/terminou.

---

## Próximos Passos de Implementação

1. Crie este workflow no seu painel do n8n.
2. Copie a URL de Produção do Webhook.
3. Configure a variável de ambiente no projeto Next.js:
    `N8N_SCRAPER_WEBHOOK_URL=https://seu-n8n.com/webhook/...`
