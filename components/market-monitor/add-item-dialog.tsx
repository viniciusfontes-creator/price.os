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
    availableProperties?: Property[];
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

import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddItemDialog({ basketId, basketName, property, availableProperties = [], existingIds = [], onSuccess }: AddItemDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [referenceProperty, setReferenceProperty] = useState<Property>(property);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const { toast } = useToast();

    // Reset reference when dialog opens or property prop changes
    useEffect(() => {
        if (open) {
            setReferenceProperty(property);
            setSelectedIds([]);
        }
    }, [open, property]);

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

    // Load Suggestions when dialog opens or reference changes
    useEffect(() => {
        if (open && referenceProperty?.latitude && referenceProperty?.longitude) {
            const fetchSuggestions = async () => {
                setLoadingSuggestions(true);
                try {
                    const params = new URLSearchParams({
                        lat: referenceProperty.latitude!.toString(),
                        lon: referenceProperty.longitude!.toString(),
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
                                matchScore: calculateMatchScore(referenceProperty, c)
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
    }, [open, referenceProperty, existingIds]);

    const handleAddSelected = async () => {
        if (selectedIds.length === 0) return;
        setLoading(true);
        try {
            await Promise.all(selectedIds.map(async (listingId) => {
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
            }));

            toast({
                title: 'Concorrentes adicionados!',
                description: `${selectedIds.length} item(ns) salvo(s) na cesta.`,
            });

            setOpen(false);
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

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full" variant="outline">
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Concorrente
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="pb-2">
                    <DialogTitle>Adicionar a "{basketName}"</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground pt-1 flex flex-col gap-2">
                        <span>Baseado em similaridade com a propriedade de referência.</span>
                        {availableProperties && availableProperties.length > 0 && (
                            <Select
                                value={referenceProperty?.idpropriedade || ''}
                                onValueChange={(val) => {
                                    const prop = availableProperties.find(p => p.idpropriedade === val) || property;
                                    setReferenceProperty(prop);
                                    setSelectedIds([]);
                                }}
                            >
                                <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue placeholder="Selecione um imóvel base" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableProperties.map(prop => (
                                        <SelectItem key={prop.idpropriedade} value={prop.idpropriedade} className="text-xs">
                                            {prop.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <span className="opacity-70 mt-1">Exibindo competidores monitorados na nossa base.</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 pt-2 overflow-hidden flex flex-col relative">
                    <ScrollArea className="h-full w-full pr-4 pb-16">
                        {loadingSuggestions ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">Calculando similaridade com {referenceProperty?.nome}...</span>
                            </div>
                        ) : suggestions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                Nenhuma sugestão próxima encontrada na nossa base de dados para este imóvel.
                            </div>
                        ) : (
                            <div className="space-y-3 pb-4">
                                {suggestions.map((item) => {
                                    const isSelected = selectedIds.includes(item.id_numerica);
                                    return (
                                        <div
                                            key={item.id}
                                            className={`flex flex-col gap-2 p-3 border rounded-lg transition-colors cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}
                                            onClick={() => toggleSelection(item.id_numerica)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 flex gap-3">
                                                    <div className="pt-1">
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleSelection(item.id_numerica)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div>
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
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/20 p-2 rounded ml-7">
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
                                    )
                                })}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Fixed Bottom Action Area */}
                    <div className="absolute bottom-0 left-0 right-0 bg-background border-t p-3 pr-8 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <span className="text-sm font-medium text-muted-foreground">
                            {selectedIds.length} selecionado{selectedIds.length !== 1 ? 's' : ''}
                        </span>
                        <Button
                            disabled={selectedIds.length === 0 || loading}
                            onClick={handleAddSelected}
                            size="sm"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar Seleção'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
