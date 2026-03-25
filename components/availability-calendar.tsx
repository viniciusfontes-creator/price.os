"use client"

import React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

export interface PricingPeriod {
    id: string
    name: string
    shortName: string
    startDate: string
    endDate: string
    type: "month" | "event"
    expectedNights: number
    sortOrder: number
}

function formatCurrency(value: number, compact?: boolean): string {
    if (compact && Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`
    return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
}

interface AvailabilityCalendarProps {
    unitId: string;
    rawData: any[];
    periods: PricingPeriod[];
    selectedPeriodId: string;
    pracaSeasonalityMap: Map<string, any>;
    fallbackYear?: number;
    fallbackMonth?: number; // 1-based (1=Jan, 12=Dec)
}

export function AvailabilityCalendar({
    unitId,
    rawData,
    periods,
    selectedPeriodId,
    pracaSeasonalityMap,
    fallbackYear,
    fallbackMonth
}: AvailabilityCalendarProps) {
    const rawUnit = rawData.find(d => d.propriedade.idpropriedade === unitId);
    if (!rawUnit) return null;

    const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

    let year: number;
    let monthOneBased: number;

    if (selectedPeriod) {
        const endDateParts = selectedPeriod.endDate.split('-');
        if (endDateParts.length < 3) return null;
        year = parseInt(endDateParts[0]);
        monthOneBased = parseInt(endDateParts[1]);
    } else if (fallbackYear && fallbackMonth) {
        year = fallbackYear;
        monthOneBased = fallbackMonth;
    } else {
        return null;
    }
    const daysInMonth = new Date(year, monthOneBased, 0).getDate();
    const firstDay = new Date(year, monthOneBased - 1, 1).getDay();

    const monthLabel = new Date(year, monthOneBased - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const today = new Date();

    const days: React.ReactNode[] = [];
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }

    let monthRevenue = 0;
    let monthOccupiedNights = 0;
    let monthAvailableNights = 0;

    // Isolar os dias de eventos para excluir do calendário normal do mês
    const praca = rawUnit.propriedade.praca || "Outros";
    const savedSeas = pracaSeasonalityMap.get(praca);

    const eventDaysSet = new Set<string>();
    const isMonthView = !selectedPeriod || selectedPeriod.type === "month";
    if (isMonthView && savedSeas) {
        const eventsInSeasonality = periods.filter(p => {
            if (p.type !== "event") return false;
            if (!savedSeas.periods.some((sp: any) => sp.periodId === p.id)) return false;

            const pStartDt = new Date(p.startDate);
            const pEndDt = new Date(p.endDate);
            const mStartDt = new Date(year, monthOneBased - 1, 1);
            const mEndDt = new Date(year, monthOneBased, 0);
            return pStartDt <= mEndDt && pEndDt >= mStartDt;
        });

        for (const e of eventsInSeasonality) {
            let current = new Date(e.startDate);
            const end = new Date(e.endDate);
            while (current <= end) {
                eventDaysSet.add(current.toISOString().split('T')[0]);
                current.setDate(current.getDate() + 1);
            }
        }
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const currentDayStr = `${year}-${String(monthOneBased).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isEventDay = eventDaysSet.has(currentDayStr);

        if (isEventDay) {
            const dayClass = "bg-muted/40 text-muted-foreground border border-muted opacity-60";
            const dayEl = (
                <TooltipProvider key={d} delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className={`relative h-8 w-8 flex items-center justify-center text-[10px] rounded-md transition-colors cursor-default ${dayClass} overflow-hidden`}>
                                <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:4px_4px] opacity-30"></div>
                                <span className="z-10 bg-background/60 px-0.5 rounded-sm">{d}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-white text-slate-700 border border-slate-200 text-[11px] max-w-[280px] p-2 space-y-0.5 shadow-md z-[9999]">
                            <p className="font-semibold text-slate-600">Período de Evento</p>
                            <p className="text-muted-foreground">Excluído das métricas do mês (reservas, ocupação e tarifa desse dia contam para o evento).</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
            days.push(dayEl);
            continue;
        }

        const occData = rawUnit.ocupacao?.find((o: any) => o.datas === currentDayStr);

        const isGuestSale = occData?.ocupado === 1 && occData?.ocupado_proprietario === 0 && occData?.manutencao === 0;
        const isOwner = occData?.ocupado_proprietario === 1;
        const isMaintenance = occData?.manutencao === 1;

        const matchingRes = rawUnit.reservas?.find((r: any) => currentDayStr >= r.checkindate && currentDayStr < (r.checkoutdate || r.checkindate));
        const isReservedInResList = !occData && !!matchingRes;

        const isToday = today.toISOString().split('T')[0] === currentDayStr;
        const isSold = isGuestSale || isReservedInResList;

        let dayClass = "bg-success/10 text-success border border-success/20";
        if (isSold) dayClass = "bg-destructive/20 text-destructive font-bold";
        else if (isOwner) dayClass = "bg-orange-500/20 text-orange-600 font-bold";
        else if (isMaintenance) dayClass = "bg-slate-400/20 text-slate-500 font-bold";

        const resForTooltip = matchingRes || (isSold ? rawUnit.reservas?.find((r: any) => currentDayStr >= r.checkindate && currentDayStr < (r.checkoutdate || r.checkindate)) : null);

        const dailyTariffObj = rawUnit.tarifario?.find((t: any) => currentDayStr >= t.from && currentDayStr <= t.to);
        const dailyTariff = dailyTariffObj ? dailyTariffObj.baserate : null;

        const discountObj = rawUnit.discounts?.find((d: any) => d.date === currentDayStr);
        const hasDiscount = !!discountObj && discountObj.discount_percent > 0;
        const discountType = discountObj?.is_rise ? "acréscimo" : "desconto";
        const finalTariff = (dailyTariff && hasDiscount)
            ? (discountObj.is_rise
                ? dailyTariff * (1 + discountObj.discount_percent / 100)
                : dailyTariff * (1 - discountObj.discount_percent / 100))
            : dailyTariff;

        if (isSold) {
            monthOccupiedNights++;
            if (resForTooltip && resForTooltip.nightcount > 0) {
                monthRevenue += (resForTooltip.reservetotal / resForTooltip.nightcount);
            }
        } else if (!isOwner && !isMaintenance) {
            monthAvailableNights++;
        }

        const showInlineDiscount = hasDiscount && !isSold && !isOwner && !isMaintenance;

        const dayEl = (
            <div
                key={d}
                className={`${showInlineDiscount ? 'h-10 w-8' : 'h-8 w-8'} flex flex-col items-center justify-center text-[10px] rounded-md transition-colors cursor-default ${dayClass} ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}`}
            >
                <span>{d}</span>
                {showInlineDiscount && (
                    <span className={`text-[7px] font-bold leading-none mt-0.5 ${discountObj.is_rise ? 'text-red-500' : 'text-emerald-600'}`}>
                        {discountObj.is_rise ? '+' : '-'}{discountObj.discount_percent}%
                    </span>
                )}
            </div>
        );

        if (resForTooltip && isSold) {
            const cin = resForTooltip.checkindate ? `${resForTooltip.checkindate.slice(8, 10)}/${resForTooltip.checkindate.slice(5, 7)}` : '';
            const cout = resForTooltip.checkoutdate ? `${resForTooltip.checkoutdate.slice(8, 10)}/${resForTooltip.checkoutdate.slice(5, 7)}` : '';

            let proRataText = '';
            let monthShareText = '';
            let validNightsInPeriod = 0;

            if (resForTooltip.nightcount > 0 && resForTooltip.reservetotal > 0) {
                const proRata = resForTooltip.reservetotal / resForTooltip.nightcount;
                proRataText = `R$ ${proRata.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / noite`;

                let currentDt = new Date(resForTooltip.checkindate + "T12:00:00Z");
                const endDt = new Date((resForTooltip.checkoutdate || resForTooltip.checkindate) + "T12:00:00Z");
                const calendarYearMonth = `${year}-${String(monthOneBased).padStart(2, '0')}`;

                while (currentDt < endDt) {
                    const dayStr = currentDt.toISOString().split('T')[0];
                    if (dayStr.startsWith(calendarYearMonth) && !eventDaysSet.has(dayStr)) {
                        if (selectedPeriod?.type === "event") {
                            if (dayStr >= selectedPeriod.startDate && dayStr <= selectedPeriod.endDate) {
                                validNightsInPeriod++;
                            }
                        } else {
                            validNightsInPeriod++;
                        }
                    }
                    currentDt.setDate(currentDt.getDate() + 1);
                }

                if (validNightsInPeriod > 0) {
                    const periodShareValue = validNightsInPeriod * proRata;
                    const percentage = (periodShareValue / resForTooltip.reservetotal) * 100;
                    monthShareText = `R$ ${periodShareValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${Math.round(percentage)}%)`;
                }
            }

            days.push(
                <TooltipProvider key={d} delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>{dayEl}</TooltipTrigger>
                        <TooltipContent side="top" className="bg-white text-blue-700 border border-blue-200 text-[11px] max-w-[280px] p-3 space-y-1.5 shadow-md z-[9999]">
                            <>
                                <div>
                                    <p className="font-bold text-[12px]">{resForTooltip.partnername || 'Reserva'} • {resForTooltip.guesttotalcount || 0} hóspedes</p>
                                    <p className="text-blue-600/80 mt-0.5">{cin} → {cout} ({resForTooltip.nightcount} noites)</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-baseline gap-2">
                                        <span className="text-blue-900/60 font-medium uppercase tracking-wider text-[9px]">Propriedade</span>
                                        <span className="text-blue-900 font-bold text-right">{rawUnit.propriedade.nomepropriedade}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline gap-2">
                                        <span className="text-blue-900/60 font-medium uppercase tracking-wider text-[9px]">Faturamento Total</span>
                                        <span className="font-mono font-bold text-blue-900">R$ {resForTooltip.reservetotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                                {proRataText && (
                                    <p className="font-mono text-[10px] text-blue-600/80 mt-1 pl-2 border-l-2 border-blue-100 italic">
                                        ↳ {proRataText}
                                    </p>
                                )}
                                {monthShareText && (
                                    <div className="mt-2 pt-2 border-t border-blue-100 border-dashed">
                                        <div className="flex justify-between items-baseline gap-2">
                                            <span className="text-blue-900/60 font-medium uppercase tracking-wider text-[9px]">Rateio visão (+{validNightsInPeriod} nts)</span>
                                            <span className="font-mono font-bold text-blue-700">{monthShareText}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        } else if (!isSold && !isOwner && !isMaintenance && dailyTariff !== null) {
            days.push(
                <TooltipProvider key={d} delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>{dayEl}</TooltipTrigger>
                        <TooltipContent side="top" className="bg-white text-slate-700 border border-slate-200 text-[11px] max-w-[280px] p-2 space-y-0.5 shadow-md z-[9999]">
                            <p className="font-semibold text-emerald-600 mb-0.5">Disponível</p>
                            <p className="text-muted-foreground">Tarifa ativa:</p>
                            <p className="font-mono font-bold">R$ {finalTariff?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            {hasDiscount && (
                                <p className="text-[10px] text-muted-foreground mt-1 leading-tight italic bg-muted/30 p-1.5 rounded border border-muted-foreground/10">
                                    Aplicado <span className="font-semibold text-primary">{discountObj.discount_percent}% de {discountType}</span> na tarifa base de R$ {dailyTariff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para chegar nesse valor!
                                </p>
                            )}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        } else if (isOwner) {
            days.push(
                <TooltipProvider key={d} delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>{dayEl}</TooltipTrigger>
                        <TooltipContent side="top" className="bg-white text-slate-700 border border-slate-200 text-[11px] max-w-[280px] p-2 space-y-0.5 shadow-md z-[9999]">
                            <p className="font-semibold text-orange-600">Uso Proprietário</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        } else if (isMaintenance) {
            days.push(
                <TooltipProvider key={d} delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>{dayEl}</TooltipTrigger>
                        <TooltipContent side="top" className="bg-white text-slate-700 border border-slate-200 text-[11px] max-w-[280px] p-2 space-y-0.5 shadow-md z-[9999]">
                            <p className="font-semibold text-slate-500">Manutenção</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        } else {
            days.push(dayEl);
        }
    }

    const totalSellableNights = monthOccupiedNights + monthAvailableNights;
    const occupancyRate = totalSellableNights > 0 ? (monthOccupiedNights / totalSellableNights) * 100 : 0;

    return (
        <div className="w-full mt-5 space-y-3">
            <div className="flex justify-between items-end border-b pb-2">
                <div>
                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Visão de Disponibilidade
                    </h4>
                    <div className="flex gap-4 text-[11px]">
                        <span className="text-muted-foreground">Ocup.: <span className="font-semibold text-foreground">{occupancyRate.toFixed(1)}%</span></span>
                        <span className="text-muted-foreground">Fat.: <span className="font-semibold text-foreground">{formatCurrency(monthRevenue)}</span></span>
                    </div>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize bg-white">
                    {monthLabel}
                </Badge>
            </div>
            <div className="p-3 border rounded-lg bg-card shadow-inner w-full sm:w-auto overflow-x-auto">
                <div className="min-w-[240px]">
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                            <span key={i} className="text-[9px] font-bold text-muted-foreground">{d}</span>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {days}
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground mt-2 px-1">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive/20 border border-destructive/30" /><span>VENDA</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-success/10 border border-success/20" /><span>LIVRE</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500/20" /><span>PROP.</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-400/20" /><span>MANUT.</span></div>
            </div>
        </div>
    );
}
