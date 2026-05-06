"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDashboardData } from "@/contexts/dashboard-provider"
import { CompetitorAnalysisCard } from "@/components/competitor-analysis-card"

function fmtBRL(v: number | null | undefined) {
  if (v === null || v === undefined) return "—"
  const n = Number(v)
  if (!Number.isFinite(n) || n === 0) return "—"
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  })
}

function formatDateDDMM(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr
  const [, mm, dd] = dateStr.split("-")
  return `${dd}/${mm}`
}

interface Props {
  idpropriedade: string
  unitName: string
  periodoInicio: string // YYYY-MM-DD
  periodoFim: string // YYYY-MM-DD
  baserateAtual: number | null
}

export function UnitDetailTabs({
  idpropriedade,
  unitName,
  periodoInicio,
  periodoFim,
  baserateAtual,
}: Props) {
  const { data: rawData } = useDashboardData()

  const detailUnit = useMemo(
    () => rawData.find((d: any) => d.propriedade.idpropriedade === idpropriedade),
    [rawData, idpropriedade],
  )

  // ─── Peer group ───────────────────────────────────────────────────────────
  const peerAnalysis = useMemo(() => {
    if (!detailUnit) return []
    const myMaxGuests = detailUnit.propriedade._i_maxguests ?? null
    const myGrupo = detailUnit.propriedade.grupo_nome
    if (myMaxGuests == null || !myGrupo) return []

    const periodDays = Math.max(
      1,
      Math.ceil(
        (new Date(periodoFim).getTime() - new Date(periodoInicio).getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1,
    )

    // Peers: mesmo grupo + ±1 maxguests
    const peers = rawData.filter((d: any) => {
      const guests = d.propriedade._i_maxguests ?? null
      return (
        d.propriedade.grupo_nome === myGrupo &&
        guests != null &&
        Math.abs(guests - myMaxGuests) <= 1
      )
    })

    const peerData = peers.map((item: any) => {
      const periodReservas = (item.reservas || []).filter(
        (r: any) => r.checkoutdate >= periodoInicio && r.checkoutdate <= periodoFim,
      )
      const valorVendido = periodReservas.reduce(
        (s: number, r: any) => s + (Number(r.reservetotal) || 0),
        0,
      )
      const precoNoite =
        item.metricas?.precoMedioNoite ||
        item.propriedade?.valor_tarifario ||
        item.propriedade?.baserate_atual ||
        0
      const periodMonth = periodoInicio.slice(0, 7)
      const meta = (item.metas || [])
        .filter((m: any) => String(m.data_especifica || "").startsWith(periodMonth))
        .reduce((s: number, m: any) => s + (Number(m.meta) || 0), 0)
      const percentualMeta = meta > 0 ? (valorVendido / meta) * 100 : 0

      let occupiedDays = 0
      if (item.ocupacao?.length > 0) {
        occupiedDays = item.ocupacao.filter(
          (o: any) => o.datas >= periodoInicio && o.datas <= periodoFim && o.ocupado === 1,
        ).length
      }
      const occupancyPct = Math.round((occupiedDays / periodDays) * 100)

      return {
        unitId: item.propriedade.idpropriedade,
        unitName: item.propriedade.nomepropriedade,
        precoNoite: Math.round(precoNoite),
        valorVendido: Math.round(valorVendido),
        percentualMeta: Number(percentualMeta.toFixed(1)),
        occupancyPct,
        reservaCount: periodReservas.length,
        isSelected: item.propriedade.idpropriedade === idpropriedade,
      }
    })

    const sorted = peerData.sort((a, b) => b.valorVendido - a.valorVendido)
    const top15 = sorted.slice(0, 15)
    if (!top15.some((p) => p.isSelected)) {
      const me = sorted.find((p) => p.isSelected)
      if (me) return [...top15.slice(0, 14), me]
    }
    return top15
  }, [detailUnit, rawData, idpropriedade, periodoInicio, periodoFim])

  // ─── Histórico YoY ────────────────────────────────────────────────────────
  const historicalComparison = useMemo(() => {
    if (!detailUnit) return null
    const prevYearStart = periodoInicio.replace(/^\d{4}/, (y) => String(Number(y) - 1))
    const prevYearEnd = periodoFim.replace(/^\d{4}/, (y) => String(Number(y) - 1))
    const periodMonth = periodoInicio.slice(0, 7)
    const prevPeriodMonth = prevYearStart.slice(0, 7)

    // Atual
    const currentReservas = (detailUnit.reservas || []).filter(
      (r: any) => r.checkoutdate >= periodoInicio && r.checkoutdate <= periodoFim,
    )
    const currentValor = currentReservas.reduce(
      (s: number, r: any) => s + (Number(r.reservetotal) || 0),
      0,
    )
    const currentDiaria = detailUnit.metricas?.precoMedioNoite || 0
    const currentMeta = (detailUnit.metas || [])
      .filter((m: any) => String(m.data_especifica || "").startsWith(periodMonth))
      .reduce((s: number, m: any) => s + (Number(m.meta) || 0), 0)
    const currentPctMeta = currentMeta > 0 ? (currentValor / currentMeta) * 100 : 0

    // Anterior
    const prevReservas = (detailUnit.reservas || []).filter(
      (r: any) => r.checkoutdate >= prevYearStart && r.checkoutdate <= prevYearEnd,
    )
    const prevValor = prevReservas.reduce(
      (s: number, r: any) => s + (Number(r.reservetotal) || 0),
      0,
    )
    const prevTotalNights = prevReservas.reduce(
      (s: number, r: any) => s + (Number(r.nightcount) || 0),
      0,
    )
    const prevDiaria =
      prevTotalNights > 0
        ? prevReservas.reduce(
            (s: number, r: any) =>
              s + (Number(r.pricepernight) || 0) * (Number(r.nightcount) || 0),
            0,
          ) / prevTotalNights
        : 0
    const prevMeta = (detailUnit.metas || [])
      .filter((m: any) => String(m.data_especifica || "").startsWith(prevPeriodMonth))
      .reduce((s: number, m: any) => s + (Number(m.meta) || 0), 0)
    const prevPctMeta = prevMeta > 0 ? (prevValor / prevMeta) * 100 : 0

    return {
      hasData: prevReservas.length > 0 || prevMeta > 0,
      current: {
        diaria: Math.round(currentDiaria),
        valor: currentValor,
        pctMeta: currentPctMeta,
        reservas: currentReservas.length,
      },
      previous: {
        diaria: Math.round(prevDiaria),
        valor: prevValor,
        pctMeta: prevPctMeta,
        reservas: prevReservas.length,
      },
      prevYearStart,
      prevYearEnd,
    }
  }, [detailUnit, periodoInicio, periodoFim])

  return (
    <Tabs defaultValue="peer-group">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="peer-group" className="text-xs">
          Peer Group
        </TabsTrigger>
        <TabsTrigger value="historical" className="text-xs">
          Histórico
        </TabsTrigger>
        <TabsTrigger value="market" className="text-xs">
          Mercado
        </TabsTrigger>
      </TabsList>

      {/* Peer Group ────────────────────────────────────────────────────── */}
      <TabsContent value="peer-group" className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Top 15 unidades do mesmo grupo com tipologia similar (±1 hóspede), ordenadas por receita
          no período.
        </p>
        {peerAnalysis.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center border rounded-md">
            Sem peers disponíveis (mesmo grupo + ±1 hóspede)
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="text-[10px]">
                  <TableHead className="text-[10px]">Unidade</TableHead>
                  <TableHead className="text-[10px] text-right">Preço/noite</TableHead>
                  <TableHead className="text-[10px] text-right">Vendido</TableHead>
                  <TableHead className="text-[10px] text-right">% Meta</TableHead>
                  <TableHead className="text-[10px] text-right">Ocup.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {peerAnalysis.map((p) => (
                  <TableRow
                    key={p.unitId}
                    className={p.isSelected ? "bg-primary/10 font-medium" : ""}
                  >
                    <TableCell className="text-xs max-w-[180px]">
                      <div className="line-clamp-1">{p.unitName}</div>
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {fmtBRL(p.precoNoite)}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {fmtBRL(p.valorVendido)}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {p.percentualMeta.toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {p.occupancyPct}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* Histórico ─────────────────────────────────────────────────────── */}
      <TabsContent value="historical" className="mt-3 space-y-3">
        {!historicalComparison ? (
          <div className="text-xs text-muted-foreground py-6 text-center border rounded-md">
            Sem dados da unidade
          </div>
        ) : !historicalComparison.hasData ? (
          <div className="text-xs text-muted-foreground py-6 text-center border rounded-md">
            Sem histórico no mesmo período do ano anterior
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Período atual ({formatDateDDMM(periodoInicio)}–{formatDateDDMM(periodoFim)})
                </div>
                <div className="mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Diária média</span>
                    <span className="tabular-nums">
                      {fmtBRL(historicalComparison.current.diaria)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vendido</span>
                    <span className="tabular-nums">
                      {fmtBRL(historicalComparison.current.valor)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">% Meta</span>
                    <span className="tabular-nums">
                      {historicalComparison.current.pctMeta.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reservas</span>
                    <span className="tabular-nums">{historicalComparison.current.reservas}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-md border p-3 bg-muted/30">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Ano passado ({formatDateDDMM(historicalComparison.prevYearStart)}–
                  {formatDateDDMM(historicalComparison.prevYearEnd)})
                </div>
                <div className="mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Diária média</span>
                    <span className="tabular-nums">
                      {fmtBRL(historicalComparison.previous.diaria)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vendido</span>
                    <span className="tabular-nums">
                      {fmtBRL(historicalComparison.previous.valor)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">% Meta</span>
                    <span className="tabular-nums">
                      {historicalComparison.previous.pctMeta.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reservas</span>
                    <span className="tabular-nums">{historicalComparison.previous.reservas}</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Diária ano passado é a média ponderada de pricePerNight × nightCount; diária atual vem
              de metricas.precoMedioNoite (consistente com Peer Group).
            </p>
          </>
        )}
      </TabsContent>

      {/* Mercado ───────────────────────────────────────────────────────── */}
      <TabsContent value="market" className="mt-3">
        <CompetitorAnalysisCard
          unitId={idpropriedade}
          unitName={unitName}
          currentPrice={baserateAtual ?? null}
        />
      </TabsContent>
    </Tabs>
  )
}
