import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Star, Sparkles, MapPin, ExternalLink, Check, Plus, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Property {
    idpropriedade: string;
    nome: string;
    latitude?: number;
    longitude?: number;
    quantidade_quartos: string;
}

interface Competitor {
    id: string;
    id_numerica?: string;
    nome_anuncio: string;
    tipo_propriedade: string;
    preco_por_noite: number;
    media_avaliacao: string;
    hospedes_adultos: number;
    url_anuncio: string;
    matchScore?: number;
    dist_km?: number;
    preco_total?: number;
    quantidade_noites?: number;
}

interface AICompetitorSuggestionsProps {
    property: Property;
    onSelectionChange: (selectedIds: string[]) => void;
    selectedIds?: string[];
}

// Match score calculation from IA Market Scanner
const calculateMatchScore = (property: Property, competitor: Competitor): number => {
    let score = 85; // Base score
    const propRooms = parseInt(property.quantidade_quartos) || 1;
    const compGuests = competitor.hospedes_adultos || 2;

    // Logical room estimation (guests/2)
    const estimatedCompRooms = Math.ceil(compGuests / 2);

    // Penalize room mismatch
    if (propRooms !== estimatedCompRooms) {
        score -= Math.abs(propRooms - estimatedCompRooms) * 15;
    }

    // Rating bonus/penalty
    if (competitor.media_avaliacao && competitor.media_avaliacao !== 'N/A') {
        const rating = parseFloat(competitor.media_avaliacao);
        if (rating >= 4.8) score += 10;
        else if (rating < 4.5) score -= 10;
    }

    return Math.max(5, Math.min(99, Math.round(score)));
};

export function AICompetitorSuggestions({ property, onSelectionChange, selectedIds = [] }: AICompetitorSuggestionsProps) {
    const [suggestions, setSuggestions] = useState<Competitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchSuggestions() {
            if (!property.latitude || !property.longitude) {
                setError('Propriedade sem coordenadas. Não é possível buscar sugestões.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    lat: property.latitude.toString(),
                    lon: property.longitude.toString(),
                    radius: '5',
                    limit: '100' // Increased limit to find best matches
                });

                const res = await fetch(`/api/competitors?${params.toString()}`);
                const result = await res.json();

                if (result.success && result.data) {
                    const scored = result.data.map((c: any) => ({
                        ...c,
                        id: c.id_numerica || c.id.toString(),
                        matchScore: calculateMatchScore(property, c)
                    })).sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));

                    setSuggestions(scored.slice(0, 30)); // Top 30
                } else {
                    setError('Nenhum concorrente encontrado nas proximidades.');
                }
            } catch (err) {
                console.error('Error fetching AI suggestions:', err);
                setError('Erro ao buscar sugestões. Tente novamente.');
            } finally {
                setLoading(false);
            }
        }

        fetchSuggestions();
    }, [property]);

    const handleToggle = (id: string) => {
        const newSelection = selectedIds.includes(id)
            ? selectedIds.filter(sid => sid !== id)
            : [...selectedIds, id];
        onSelectionChange(newSelection);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Buscando concorrentes próximos...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p>{error}</p>
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma sugestão disponível para esta localização.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">
                    Encontramos {suggestions.length} concorrentes próximos
                </span>
                {selectedIds.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                        {selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''}
                    </Badge>
                )}
            </div>

            <div className="border rounded-md overflow-hidden bg-background">
                <ScrollArea className="h-[400px] w-full p-4">
                    <div className="space-y-3">
                        {suggestions.map((item) => {
                            const isSelected = selectedIds.includes(item.id);

                            return (
                                <div key={item.id} className={`flex flex-col gap-2 p-3 border rounded-lg transition-colors group ${isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/30'}`}>
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
                                                href={item.url_anuncio || `https://www.airbnb.com.br/rooms/${item.id_numerica || item.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline flex items-center gap-0.5 mr-2 text-xs"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Ver
                                            </a>
                                            <Button
                                                size="sm"
                                                variant={isSelected ? "destructive" : "default"}
                                                className={`h-7 text-xs ${isSelected ? 'opacity-90' : ''}`}
                                                onClick={() => handleToggle(item.id)}
                                            >
                                                {isSelected ? (
                                                    <>
                                                        <Trash2 className="h-3 w-3 mr-1" /> Remover
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                                                    </>
                                                )}
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
                                            R$ {item.preco_por_noite ? item.preco_por_noite.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : '-'} /noite
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
