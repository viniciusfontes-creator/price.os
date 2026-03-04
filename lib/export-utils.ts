import type { IntegratedData } from '@/types'

/**
 * Export filtered dashboard data to CSV format and trigger download
 */
export function exportToCSV(data: IntegratedData[], filename: string = 'qavi-dashboard-export') {
    if (data.length === 0) return

    const rows: string[][] = []

    // Header
    rows.push([
        'Propriedade',
        'ID',
        'Praça',
        'Grupo',
        'Sub-grupo',
        'Tipo Operação',
        'Total Reservas',
        'Receita Total (R$)',
        'Ticket Médio (R$)',
        'Diárias Vendidas',
        'Preço Médio/Noite (R$)',
        'Hóspedes Totais',
        'Antecedência Média (dias)',
        'Meta Mensal (R$)',
        'Meta Móvel (R$)',
        'Receita Checkout Mês (R$)',
        'Status',
    ])

    // Data rows
    data.forEach((item) => {
        rows.push([
            item.propriedade.nomepropriedade,
            item.propriedade.idpropriedade,
            item.propriedade.praca,
            item.propriedade.grupo_nome,
            item.propriedade.sub_grupo,
            item.propriedade.empreendimento_pousada,
            String(item.metricas.totalReservas),
            item.metricas.receitaTotal.toFixed(2),
            item.metricas.ticketMedio.toFixed(2),
            String(item.metricas.diariasVendidas),
            item.metricas.precoMedioNoite.toFixed(2),
            String(item.metricas.hospedesTotais),
            item.metricas.antecedenciaMedia.toFixed(1),
            item.metricas.metaMensal.toFixed(2),
            item.metricas.metaMovel.toFixed(2),
            item.metricas.receitaCheckoutMes.toFixed(2),
            item.metricas.status,
        ])
    })

    const csvContent = rows
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n')

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()

    URL.revokeObjectURL(url)
}
