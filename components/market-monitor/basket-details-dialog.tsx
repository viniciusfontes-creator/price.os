import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { History, ExternalLink, Trash, RefreshCw } from "lucide-react"
import { CompetitorDetailsDialog } from '@/components/market-monitor/competitor-details-dialog';

interface BasketDetailsDialogProps {
    basketName: string;
    items: any[];
    trigger?: React.ReactNode;
    onDeleteItem?: (id: string, basketItemId: string) => Promise<void>;
    onRefresh?: () => void;
}

export function BasketDetailsDialog({ basketName, items, trigger, onDeleteItem, onRefresh }: BasketDetailsDialogProps) {

    const [loadingScraper, setLoadingScraper] = React.useState(false);
    const [countdown, setCountdown] = React.useState(0);

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline" size="sm">Ver todos</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {basketName}
                            <Badge variant="secondary">{items?.length || 0} Itens</Badge>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={loadingScraper}
                            onClick={async () => {
                                try {
                                    setLoadingScraper(true);

                                    // Prepare payload: url and max guests (or fallback)
                                    const marketMonitorItems = items.map(i => ({
                                        url: i.airbnb_data?.url_anuncio || `https://airbnb.com.br/rooms/${i.airbnb_listing_id || i.id}`,
                                        guests: i.airbnb_data?.hospedes_adultos || 2, // Default to 2 if missing
                                        latitude: i.airbnb_data?.latitude,
                                        longitude: i.airbnb_data?.longitude,
                                        location_text: i.airbnb_data?.tipo_propriedade
                                    }));

                                    const res = await fetch('/api/scraper/trigger', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ items: marketMonitorItems })
                                    });
                                    const data = await res.json();

                                    if (data.success) {
                                        // Start countdown
                                        let timeLeft = 60;
                                        setCountdown(timeLeft);

                                        const interval = setInterval(() => {
                                            timeLeft -= 1;
                                            setCountdown(timeLeft);

                                            // Tenta atualizar a cada 10s se houver função de refresh
                                            if (timeLeft % 10 === 0 && onRefresh) {
                                                onRefresh();
                                            }

                                            if (timeLeft <= 0) {
                                                clearInterval(interval);
                                                setLoadingScraper(false);
                                                if (onRefresh) {
                                                    onRefresh();
                                                    alert("Processo finalizado! Os dados foram atualizados.");
                                                } else {
                                                    window.location.reload();
                                                }
                                            }
                                        }, 1000);
                                    } else {
                                        alert("Erro ao iniciar scraper: " + (data.error || "Erro desconhecido"));
                                        setLoadingScraper(false);
                                    }
                                } catch (e) {
                                    alert("Erro ao conectar com o servidor.");
                                    console.error(e);
                                    setLoadingScraper(false);
                                }
                            }}
                        >
                            <RefreshCw className={`w-3 h-3 ${loadingScraper ? 'animate-spin' : ''}`} />
                            {loadingScraper
                                ? `Atualizando... ${countdown > 0 ? `(${countdown}s)` : ''}`
                                : 'Atualizar Scraper'}
                        </Button>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden mt-4">
                    <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-4">
                            {items?.map(item => {
                                const guestsCount = item.airbnb_data?.hospedes_adultos;
                                const displayName = `${item.airbnb_data?.nome_anuncio || 'Anúncio sem nome'}${guestsCount ? ` - ${guestsCount} adultos` : ''}`;

                                return (
                                    <div key={item.id} className="flex flex-col p-4 border rounded-lg hover:bg-muted/30 transition-colors gap-4">
                                        {/* Top part: details and price */}
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-sm leading-tight" title={item.airbnb_data?.nome_anuncio}>
                                                    {displayName}
                                                </h4>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                                                    <a
                                                        href={item.airbnb_data?.url_anuncio || `https://www.airbnb.com.br/rooms/${item.airbnb_listing_id || item.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 hover:text-blue-600 hover:underline text-blue-500"
                                                    >
                                                        Ver no Airbnb <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                    <span className="hidden md:inline">•</span>
                                                    <span className="font-mono">ID: {item.airbnb_listing_id || item.id}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                                                <div className="text-right shrink-0">
                                                    {item.airbnb_data?.preco_por_noite ? (
                                                        <>
                                                            <div className="text-sm font-bold">R$ {item.airbnb_data?.preco_por_noite?.toLocaleString('pt-BR')}</div>
                                                            <div className="text-[10px] text-muted-foreground">Preço base</div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs text-muted-foreground italic">Sem preço</div>
                                                    )}
                                                    {(!item.history || item.history.length === 0) && (
                                                        <div className="text-[10px] text-red-500 font-medium whitespace-nowrap">Sem histórico (2025/26)</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions Section - Full width on mobile/tablet for easier hitting */}
                                        <div className="flex items-center justify-end gap-2 pt-2 border-t md:border-t-0 md:pt-0">
                                            <CompetitorDetailsDialog
                                                competitor={{
                                                    id: item.airbnb_listing_id || item.id,
                                                    name: displayName,
                                                    url: item.airbnb_data?.url_anuncio,
                                                    avgRating: item.airbnb_data?.media_avaliacao,
                                                    guests: guestsCount,
                                                    history: item.history
                                                }}
                                                trigger={
                                                    <Button variant="outline" size="sm" className="gap-2 h-8">
                                                        <History className="h-3 w-3" /> Histórico
                                                    </Button>
                                                }
                                            />

                                            {onDeleteItem && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 gap-2"
                                                    onClick={() => onDeleteItem(item.airbnb_listing_id, item.id)}
                                                >
                                                    <Trash className="h-3 w-3" /> Excluir
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}
