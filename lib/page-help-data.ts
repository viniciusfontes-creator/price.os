import { PageHelpContent } from "@/types/page-help"

export const pageHelpData: Record<string, PageHelpContent> = {
  "/dashboard": {
    id: "dashboard",
    title: "Como usar o Dashboard",
    description: "Saiba como analisar sua ocupação, faturamento e identificar oportunidades de venda através das ferramentas disponíveis no painel.",
    features: [
      {
        id: "filtros-globais",
        title: "Filtros Globais",
        description: "Utilize a barra no topo para buscar e cruzar os dados da página por Período de Reservas, Cidade ou Imóvel específico. As alterações aqui influenciam instantaneamente todos os demais cartões e gráficos visíveis na tela.",
        useCases: [
          "Verificar ocupação de uma cidade apenas durante um feriado longo.",
          "Filtrar os dados por uma unidade específica para entender a performance dela isoladamente.",
          "Comparar como vendas diretas vs Airbnb se comportaram num dado trimestre."
        ]
      },
      {
        id: "metricas-chave",
        title: "Métricas Principais (Metas)",
        description: "Acompanhe de perto as metas de vendas da equipe através de 4 indicadores: Meta do Mês (Data de Criação), Meta da Semana (Data de Criação), Meta do Mês (Data de Checkout) e Meta da Semana (Data de Checkout). Clique no botão '+' em cada cartão para ver o detalhamento por unidade.",
        useCases: [
          "Identificar se a equipe bateu a meta semanal de faturamento baseado na criação da reserva.",
          "Verificar quais unidades estão abaixo de 40% da meta.",
          "Motivar a equipe celebrando os meses onde o tickect médio excedeu a previsão."
        ]
      },
      {
        id: "ranking-vendas",
        title: "Ranking de Vendas Diárias",
        description: "Acompanhe dia a dia o ritmo e o valor financeiro das locações. Ideal para entender dias atípicos com pico de reservas, ou períodos fracos que possam exigir ajustes na precificação.",
        useCases: [
          "Encontrar um dia da semana que sistematicamente não tem vendas, para criar promoções relâmpago.",
          "Identificar o pico de reservas do mês para entender padrão de pesquisa do usuário."
        ]
      },
      {
        id: "ranking-parceiros",
        title: "Ranking por Parceiros",
        description: "Uma visão prática mostrando quais plataformas (Airbnb, Booking.com, site direto, etc) ou canais estão originando o maior volume de receita para as propriedades. Facilita o mapeamento da distribuição de vendas.",
        useCases: [
          "Constatar dependência alta do Booking.com e traçar metas focar vendas diretas.",
          "Reconhecer que o canal de 'Atendimento' trouxe vendas mais valiosas no último feriado.",
          "Revisar comissões baseadas em qual OTA gera mais tráfego."
        ]
      },
      {
        id: "mapa-ocupacao",
        title: "Mapa de Ocupação (Calendário)",
        description: "Uma imersão visual e cronograma do status de cada propriedade. As cores diferenciam facilmente quais dias estão ocupados e os períodos vagos, auxiliando em promoções localizadas.",
        useCases: [
          "Visualizar de forma clara a ocorrência de 'janelas mortas' de 1-2 dias entre reservas longas e forçar baixar preço naqueles dias.",
          "Ver se feriados estão plenamente reservados.",
          "Gerenciar bloqueios de manutenção em períodos estagnados."
        ]
      }
    ]
  },
  "/propriedades/pricing": {
    id: "pricing",
    title: "Pricing Intelligence",
    description: "Use inteligência de dados para precificar melhor e maximizar o RevPAR das suas propriedades.",
    features: [
      {
        id: "pricing-visao-geral",
        title: "Estratégia de Precificação Base",
        description: "Define e gerencia padrões diários para altas e baixas temporadas usando algoritmos para equilibrar Ocupação e Receita.",
        useCases: [
          "Configurar preços mínimos agressivos para baixas temporadas baseando-se no histórico de baixa procura.",
          "Garantir preços inflacionados no réveillon automaticamente assim que os quartos são disponibilizados no ano anterior."
        ]
      }
    ]
  },
  "/concorrencia": {
    id: "concorrencia",
    title: "Painel de Concorrência",
    description: "Monitor de propriedades vizinhas e análise de mercado para manter-se competitivo sem rasgar margem.",
    features: [
      {
        id: "concorrencia-tracker",
        title: "Rastreador Airbnb",
        description: "Monitora os links dos concorrentes que você informou, trazendo preços deles na mesma visualização das suas unidades.",
        useCases: [
          "Ativar alertas se sua unidade estiver 20% mais cara que a média sem justificativa adicional.",
          "Analisar se a região toda abaixou preços no final de novembro."
        ]
      }
    ]
  }
}
