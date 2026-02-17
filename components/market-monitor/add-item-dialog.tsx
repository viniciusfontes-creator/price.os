'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Users, Star, MapPin, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Property {
    idpropriedade: string;
    nome: string;
    quantidade_quartos: string;
    latitude?: number;
    longitude?: number;
}

interface AddItemDialogProps {
    basketId: string;
    basketName: string;
    property: Property;
    existingIds?: string[];
    onSuccess: () => void;
}

interface Suggestion {
    id: number;
    id_numerica: string; // Airbnb listing ID
    nome_anuncio: string;
    tipo_propriedade: string;
    url_anuncio: string;
    hospedes_adultos: number;
    media_avaliacao: string;
    dist_km?: number;
    matchScore?: number;
    preco_total?: number;
    quantidade_noites?: number;
}

export function AddItemDialog({ basketId, basketName, property, existingIds = [], onSuccess }: AddItemDialogProps) {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const { toast } = useToast();

    // AI Similarity Score Logic
    const calculateMatchScore = (targetProp: Property, competitor: Suggestion) => {
        let score = 85; // Base score
        const propRooms = parseInt(targetProp.quantidade_quartos) || 1;
        const compGuests = competitor.hospedes_adultos || 2;

        // Estimation: Guests / 2 ~= Rooms
        const estimatedCompRooms = Math.ceil(compGuests / 2);

        // Penalty for size mismatch
        if (propRooms !== estimatedCompRooms) {
            score -= Math.abs(propRooms - estimatedCompRooms) * 15;
        }

        // Bonus/Penalty for Rating
        if (competitor.media_avaliacao && competitor.media_avaliacao !== 'N/A') {
            const rating = parseFloat(competitor.media_avaliacao);
            if (rating >= 4.8) score += 10;
            else if (rating < 4.5) score -= 10;
        }

        // Distance Penalty (from Supabase RPC)
        if (competitor.dist_km) {
            score -= competitor.dist_km * 2;
        }

        return Math.max(5, Math.min(99, Math.round(score)));
    };

    // Load Suggestions when dialog opens
    useEffect(() => {
        if (open && property.latitude && property.longitude) {
            const fetchSuggestions = async () => {
                setLoadingSuggestions(true);
                try {
                    const params = new URLSearchParams({
                        lat: property.latitude!.toString(),
                        lon: property.longitude!.toString(),
                        radius: '2', // 2km radius for tight suggestions
                        limit: '100'  // Fetch 100 to rank them
                    });

                    const res = await fetch(`/api/competitors?${params.toString()}`);
                    const result = await res.json();

                    if (result.success) {
                        // Helper: Get first 15 digits for precision-safe comparison
                        const getSafeId = (id: string | number) => String(id).substring(0, 15);
                        const existingSafeIds = existingIds.map(getSafeId);

                        const scored = result.data
                            .filter((c: any) => {
                                // Use partial ID matching (first 15 digits) to avoid precision issues
                                const candidateSafeId = getSafeId(c.id_numerica || c.id);
                                return !existingSafeIds.includes(candidateSafeId);
                            })
                            .map((c: any) => ({
                                ...c,
                                matchScore: calculateMatchScore(property, c)
                            }))
                            .sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0))
                            .slice(0, 30); // Top 30

                        setSuggestions(scored);
                    }
                } catch (error) {
                    console.error("Error fetching suggestions:", error);
                } finally {
                    setLoadingSuggestions(false);
                }
            };
            fetchSuggestions();
        }
    }, [open, property, existingIds]);

    const handleAdd = async (listingId: string | number) => {
        setLoading(true);
        try {
            // Clean ID if it's a URL
            let cleanedId = listingId.toString();
            const urlMatch = cleanedId.match(/rooms\/(\d+)/);
            if (urlMatch && urlMatch[1]) cleanedId = urlMatch[1];

            const res = await fetch('/api/baskets/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    basket_id: basketId,
                    airbnb_listing_id: cleanedId
                })
            });

            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            toast({
                title: 'Concorrente adicionado!',
                description: `ID ${cleanedId} salvo na cesta.`,
            });

            setOpen(false);
            setUrl('');
            onSuccess();
        } catch (error: any) {
            toast({
                title: 'Erro ao adicionar',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full" variant="outline">
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Concorrente
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Adicionar a "{basketName}"</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground pt-1">
                        Baseado em similaridade com <strong>{property?.nome || 'Propriedade de referência'}</strong>.
                        <br />
                        <span className="opacity-70">Exibindo competidores monitorados na nossa base.</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 pt-4 overflow-hidden">
                    <ScrollArea className="h-full w-full pr-4">
                        {loadingSuggestions ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">Calculando similaridade...</span>
                            </div>
                        ) : suggestions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                Nenhuma sugestão próxima encontrada na nossa base de dados.
                            </div>
                        ) : (
                            <div className="space-y-3 pb-4">
                                {suggestions.map((item) => (
                                    <div key={item.id} className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-muted/30 transition-colors group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className={`text-[10px] font-bold h-5 ${(item.matchScore || 0) > 90 ? 'bg-green-50 text-green-700 border-green-200' :
                                                        (item.matchScore || 0) > 80 ? 'bg-blue-50 text-blue-700 border-blue-200' : ''
                                                        }`}>
                                                        {item.matchScore}% Match
                                                    </Badge>
                                                    {item.dist_km !== undefined && (
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                            <MapPin className="h-3 w-3" /> {item.dist_km.toFixed(1)}km
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="font-medium text-sm line-clamp-1" title={item.nome_anuncio}>
                                                    {item.nome_anuncio}
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <a
                                                    href={item.url_anuncio || `https://www.airbnb.com.br/rooms/${item.id_numerica}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline flex items-center gap-0.5"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Ver
                                                </a>
                                                <Button size="sm" className="h-7 text-xs ml-2" onClick={() => handleAdd(item.id_numerica)}>
                                                    Adicionar
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/20 p-2 rounded">
                                            <div className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {item.hospedes_adultos} guests
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                {item.media_avaliacao}
                                            </div>
                                            <div className="ml-auto font-semibold text-foreground">
                                                R$ {item.preco_total && item.quantidade_noites ? Math.round(item.preco_total / item.quantidade_noites) : '-'} /noite
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
