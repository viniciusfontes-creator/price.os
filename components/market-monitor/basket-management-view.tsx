import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, TrendingUp, Users as UsersIcon, DollarSign, ExternalLink, Plus, Trash2, MapPin, Home } from 'lucide-react';
import { CreateBasketDialog } from './create-basket-dialog';
import { useToast } from '@/hooks/use-toast';

interface Property {
    idpropriedade: string;
    nome: string;
    propertyKey: string;
    quantidade_quartos: string;
    latitude?: number;
    longitude?: number;
}

interface Basket {
    id: string;
    name: string;
    location?: string;
    guest_capacity?: number;
    internal_property_id: string;
    basket_items?: BasketItem[];
}

interface BasketItem {
    id: string;
    basket_id: string;
    item_type?: string;
    internal_property_id?: string;
    airbnb_listing_id?: string;
    airbnb_data?: {
        nome_anuncio: string;
        preco_por_noite: number;
        media_avaliacao: string;
    };
}

interface BasketManagementViewProps {
    properties: Property[];
    onSelectProperty: (property: Property) => void;
    onReload: () => void;
}

export function BasketManagementView({ properties, onSelectProperty, onReload }: BasketManagementViewProps) {
    const [baskets, setBaskets] = useState<Basket[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const handleDeleteBasket = async (basketId: string, basketName: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm(`Tem certeza que deseja excluir a cesta "${basketName}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/baskets?id=${basketId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast({ title: 'Cesta excluída com sucesso' });
                // Reload baskets
                const reloadRes = await fetch('/api/baskets?mode=snapshot');
                const result = await reloadRes.json();
                if (result.success) setBaskets(result.data);
                onReload();
            } else {
                throw new Error('Failed to delete');
            }
        } catch (err) {
            console.error('Error deleting basket:', err);
            toast({ title: 'Erro ao excluir cesta', variant: 'destructive' });
        }
    };

    useEffect(() => {
        async function loadAllBaskets() {
            setLoading(true);
            try {
                // Fetch ALL baskets with snapshot data (names, prices, ratings)
                const res = await fetch('/api/baskets?mode=snapshot');
                const result = await res.json();
                if (result.success) {
                    setBaskets(result.data);
                }
            } catch (err) {
                console.error('Error loading baskets:', err);
            } finally {
                setLoading(false);
            }
        }

        loadAllBaskets();
    }, []);

    // Group baskets by property (derive from basket_items, fallback to legacy field)
    const basketsByProperty = baskets.reduce((acc, basket) => {
        const internalItems = basket.basket_items?.filter(i => i.item_type === 'internal') || [];

        if (internalItems.length > 0) {
            internalItems.forEach(item => {
                const propId = item.internal_property_id;
                if (propId) {
                    if (!acc[propId]) acc[propId] = [];
                    if (!acc[propId].find(b => b.id === basket.id)) {
                        acc[propId].push(basket);
                    }
                }
            });
        } else if (basket.internal_property_id) {
            // Legacy baskets with property on basket level
            if (!acc[basket.internal_property_id]) acc[basket.internal_property_id] = [];
            acc[basket.internal_property_id].push(basket);
        } else {
            if (!acc['_unassigned']) acc['_unassigned'] = [];
            acc['_unassigned'].push(basket);
        }
        return acc;
    }, {} as Record<string, Basket[]>);

    // Calculate quick stats
    const totalBaskets = baskets.length;
    const totalCompetitors = baskets.reduce((sum, b) => sum + (b.basket_items?.filter(i => i.item_type === 'external').length || 0), 0);
    const allPrices = baskets.flatMap(b =>
        (b.basket_items || [])
            .map(i => i.airbnb_data?.preco_por_noite)
            .filter(p => p !== undefined) as number[]
    );
    const avgPrice = allPrices.length > 0
        ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length
        : 0;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Carregando cestas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Package className="h-6 w-6 text-primary" />
                        Gerenciamento de Cestas
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Organize e monitore grupos de concorrentes por propriedade
                    </p>
                </div>
                <CreateBasketDialog
                    propertyId=""
                    propertyName="Selecionar Propriedade"
                    onSuccess={() => {
                        onReload();
                        // Reload local state
                        fetch('/api/baskets?mode=snapshot')
                            .then(r => r.json())
                            .then(d => d.success && setBaskets(d.data));
                    }}
                    properties={properties}
                />
            </div>

            {/* Quick Stats */}
            {totalBaskets > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-primary/10">
                                <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{totalBaskets}</p>
                                <p className="text-xs text-muted-foreground">Cestas Ativas</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/5 to-blue-500/10">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-blue-500/10">
                                <UsersIcon className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{totalCompetitors}</p>
                                <p className="text-xs text-muted-foreground">Competidores</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-gradient-to-br from-green-500/5 to-green-500/10">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-green-500/10">
                                <DollarSign className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    R$ {avgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs text-muted-foreground">Preço Médio</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Baskets List */}
            {totalBaskets === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                        <Package className="h-16 w-16 text-muted-foreground/20" />
                        <div className="text-center space-y-2">
                            <h3 className="font-semibold text-lg">Nenhuma cesta criada ainda</h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                                Cestas permitem monitorar a evolução de preços de concorrentes específicos ao longo do tempo.
                                Crie sua primeira cesta para começar!
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <CreateBasketDialog
                                propertyId=""
                                propertyName="Selecionar Propriedade"
                                onSuccess={() => {
                                    onReload();
                                    fetch('/api/baskets')
                                        .then(r => r.json())
                                        .then(d => d.success && setBaskets(d.data));
                                }}
                                properties={properties}
                            />
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {Object.entries(basketsByProperty).map(([propId, propBaskets]) => {
                        const isUnassigned = propId === '_unassigned';
                        const property = isUnassigned ? null : properties.find(p => p.idpropriedade === propId);
                        if (!isUnassigned && !property) return null;

                        return (
                            <div key={propId} className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                        {isUnassigned ? 'Sem propriedade associada' : property!.nome}
                                    </h3>
                                    <Badge variant="outline" className="text-xs">
                                        {propBaskets.length} cesta{propBaskets.length > 1 ? 's' : ''}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {propBaskets.map((basket) => {
                                        const itemCount = basket.basket_items?.length || 0;
                                        const basketPrices = (basket.basket_items || [])
                                            .map(i => i.airbnb_data?.preco_por_noite)
                                            .filter(p => p !== undefined) as number[];
                                        const basketAvg = basketPrices.length > 0
                                            ? basketPrices.reduce((a, b) => a + b, 0) / basketPrices.length
                                            : 0;

                                        return (
                                            <Card
                                                key={basket.id}
                                                className="relative hover:shadow-lg transition-shadow cursor-pointer group"
                                                onClick={() => property && onSelectProperty(property)}
                                            >
                                                {/* Delete Button (appears on hover) */}
                                                <button
                                                    onClick={(e) => handleDeleteBasket(basket.id, basket.name, e)}
                                                    className="absolute top-2 right-2 p-2 bg-destructive/90 text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-destructive z-10"
                                                    aria-label="Excluir cesta"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>

                                                <CardHeader className="pb-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <CardTitle className="text-sm font-bold truncate flex items-center gap-2 group-hover:text-primary transition-colors">
                                                                <Package className="h-4 w-4 shrink-0" />
                                                                {basket.name}
                                                            </CardTitle>
                                                        </div>
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-2">
                                                    {/* Location */}
                                                    {basket.location && (
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <MapPin className="h-3 w-3 shrink-0" />
                                                            <span className="truncate">{basket.location}</span>
                                                        </div>
                                                    )}

                                                    {/* Guest Capacity */}
                                                    {basket.guest_capacity && (
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <UsersIcon className="h-3 w-3 shrink-0" />
                                                            <span>{basket.guest_capacity} hóspedes</span>
                                                        </div>
                                                    )}

                                                    {/* Item counts */}
                                                    <div className="pt-2 border-t space-y-1">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                                <Home className="h-3 w-3" />
                                                                <span>Internas</span>
                                                            </div>
                                                            <Badge variant="secondary">
                                                                {basket.basket_items?.filter(i => i.item_type === 'internal').length || 0}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs">
                                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                                <ExternalLink className="h-3 w-3" />
                                                                <span>Externas</span>
                                                            </div>
                                                            <Badge variant="secondary">
                                                                {basket.basket_items?.filter(i => i.item_type === 'external').length || 0}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    {basketAvg > 0 && (
                                                        <div className="flex items-center justify-between text-xs pt-2 border-t">
                                                            <span className="text-muted-foreground">Preço Médio</span>
                                                            <span className="font-bold text-primary">
                                                                R$ {basketAvg.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (property) onSelectProperty(property);
                                                        }}
                                                    >
                                                        Ver Detalhes
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
