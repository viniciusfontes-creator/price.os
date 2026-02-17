'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, ChevronRight, ChevronLeft, Home, Search, MapPin, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { AICompetitorSuggestions } from './ai-competitor-suggestions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface Property {
    idpropriedade: string;
    nome: string;
    propertyKey?: string;
    quantidade_quartos: string;
    latitude?: number;
    longitude?: number;
}

interface CreateBasketDialogProps {
    propertyId?: string;
    propertyName?: string;
    onSuccess: () => void;
    properties?: Property[]; // Optional: if provided, enables property selection
    enableAISuggestions?: boolean; // Default: true
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CreateBasketDialog({
    propertyId: initialPropertyId,
    propertyName: initialPropertyName,
    onSuccess,
    properties,
    enableAISuggestions = true,
    open: controlledOpen,
    onOpenChange
}: CreateBasketDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

    const setOpen = (newOpen: boolean) => {
        setInternalOpen(newOpen);
        onOpenChange?.(newOpen);
    };

    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [guestCapacity, setGuestCapacity] = useState<number>(2);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'info' | 'competitors'>('info');
    const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(initialPropertyId ? [initialPropertyId] : []);

    // Update selected property if initialPropertyId changes
    useEffect(() => {
        if (initialPropertyId && !selectedPropertyIds.includes(initialPropertyId)) {
            setSelectedPropertyIds([initialPropertyId]);
        }
    }, [initialPropertyId]);

    const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
    const [propertySearch, setPropertySearch] = useState('');
    const [locationAutoFilled, setLocationAutoFilled] = useState(false);
    const { toast } = useToast();

    // Multi-property support
    const needsPropertySelection = properties && properties.length > 0;
    const selectedProperties = useMemo(() =>
        properties?.filter(p => selectedPropertyIds.includes(p.idpropriedade)) || [],
        [properties, selectedPropertyIds]
    );
    const firstSelectedProperty = selectedProperties[0];
    const displayPropertyName = selectedPropertyIds.length > 1
        ? `${selectedPropertyIds.length} propriedades`
        : (firstSelectedProperty?.nome || initialPropertyName);

    // Calculate centroid coordinates from all selected properties
    const centroid = useMemo(() => {
        const propsWithCoords = selectedProperties.filter(p => p.latitude && p.longitude);
        if (propsWithCoords.length === 0) return null;

        const lat = propsWithCoords.reduce((sum, p) => sum + (p.latitude || 0), 0) / propsWithCoords.length;
        const lon = propsWithCoords.reduce((sum, p) => sum + (p.longitude || 0), 0) / propsWithCoords.length;

        return { latitude: lat, longitude: lon };
    }, [selectedProperties]);

    // Auto-fill location when properties are selected
    useEffect(() => {
        if (selectedProperties.length > 0 && !location && !locationAutoFilled) {
            // Try to extract location from property names
            // Pattern: "PB - João Pessoa - Description" or "City - Description"
            const firstProp = selectedProperties[0];
            if (firstProp?.nome) {
                const parts = firstProp.nome.split(' - ');
                if (parts.length >= 2) {
                    // Format: "[STATE] City" or just "City - Neighborhood"
                    const locationPart = parts.length >= 3
                        ? `[${parts[0]}] ${parts[1]}`
                        : parts.slice(0, 2).join(' - ');
                    setLocation(locationPart);
                    setLocationAutoFilled(true);
                }
            }
        }
    }, [selectedProperties, location, locationAutoFilled]);

    // Reset locationAutoFilled when location is manually cleared
    useEffect(() => {
        if (location === '') setLocationAutoFilled(false);
    }, [location]);

    const handleSubmit = async () => {
        if (selectedPropertyIds.length === 0) {
            toast({
                title: 'Erro',
                description: 'Selecione pelo menos uma propriedade',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        try {
            // Step 1: Create basket with multiple properties
            const res = await fetch('/api/baskets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    location,
                    guest_capacity: guestCapacity,
                    internal_property_ids: selectedPropertyIds
                })
            });

            const result = await res.json();
            console.log('[CreateBasketDialog] API Response:', result);

            if (!result.success) throw new Error(result.error);

            const basketId = result.data.id;

            // Step 2: Add selected competitors (if any)
            if (selectedCompetitors.length > 0) {
                const itemPromises = selectedCompetitors.map(listingId =>
                    fetch('/api/baskets/items', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            basket_id: basketId,
                            airbnb_listing_id: listingId
                        })
                    })
                );

                await Promise.all(itemPromises);
            }

            toast({
                title: 'Cesta criada!',
                description: selectedCompetitors.length > 0
                    ? `A cesta "${name}" foi criada com ${selectedPropertyIds.length} próprio(s) e ${selectedCompetitors.length} competidor(es).`
                    : `A cesta "${name}" foi criada com ${selectedPropertyIds.length} próprio(s).`,
            });

            setOpen(false);
            resetForm();
            onSuccess();
        } catch (error: any) {
            toast({
                title: 'Erro ao criar',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setLocation('');
        setGuestCapacity(2);
        setStep('info');
        setSelectedPropertyIds(initialPropertyId ? [initialPropertyId] : []);
        setSelectedCompetitors([]);
        setPropertySearch('');
        setLocationAutoFilled(false);
    };

    const canProceedToCompetitors = name.trim() && selectedPropertyIds.length > 0 && enableAISuggestions && firstSelectedProperty;
    const canSubmit = name.trim() && selectedPropertyIds.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Nova Cesta
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nova Cesta de Concorrentes</DialogTitle>
                    <DialogDescription>
                        Crie uma cesta para agrupar e monitorar competidores de suas propriedades.
                    </DialogDescription>
                </DialogHeader>

                {step === 'info' && (
                    <div className="space-y-4">
                        {needsPropertySelection && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Home className="h-4 w-4" />
                                    Propriedades Internas
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Selecione uma ou mais propriedades que fazem parte desta cesta
                                </p>

                                {/* Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Pesquisar propriedade..."
                                        value={propertySearch}
                                        onChange={(e) => setPropertySearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>

                                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                                    {properties
                                        ?.filter(prop =>
                                            prop.nome.toLowerCase().includes(propertySearch.toLowerCase()) ||
                                            prop.idpropriedade.toLowerCase().includes(propertySearch.toLowerCase())
                                        )
                                        .map(prop => (
                                            <div key={prop.idpropriedade} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={prop.idpropriedade}
                                                    checked={selectedPropertyIds.includes(prop.idpropriedade)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedPropertyIds([...selectedPropertyIds, prop.idpropriedade]);
                                                        } else {
                                                            setSelectedPropertyIds(selectedPropertyIds.filter(id => id !== prop.idpropriedade));
                                                        }
                                                    }}
                                                />
                                                <Label
                                                    htmlFor={prop.idpropriedade}
                                                    className="cursor-pointer text-sm font-normal flex-1"
                                                >
                                                    {prop.nome}
                                                </Label>
                                            </div>
                                        ))}
                                    {properties?.filter(prop =>
                                        prop.nome.toLowerCase().includes(propertySearch.toLowerCase()) ||
                                        prop.idpropriedade.toLowerCase().includes(propertySearch.toLowerCase())
                                    ).length === 0 && (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                Nenhuma propriedade encontrada
                                            </p>
                                        )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Nome da Cesta</Label>
                            <Input
                                placeholder="Ex: 2 Quartos Beira-Mar João Pessoa"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                            {!needsPropertySelection && (
                                <p className="text-xs text-muted-foreground">
                                    Para a propriedade: {displayPropertyName}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    Localidade
                                    {locationAutoFilled && (
                                        <Badge variant="outline" className="text-[10px] h-4 gap-1 bg-primary/5 text-primary border-primary/20">
                                            <Sparkles className="h-2.5 w-2.5" />
                                            Auto-preenchido
                                        </Badge>
                                    )}
                                </Label>
                                <Input
                                    placeholder="Ex: João Pessoa - Beira Mar"
                                    value={location}
                                    onChange={e => {
                                        setLocation(e.target.value);
                                        if (locationAutoFilled) setLocationAutoFilled(false);
                                    }}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {centroid ? (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3 text-green-500" />
                                            Coordenadas detectadas: {centroid.latitude.toFixed(4)}, {centroid.longitude.toFixed(4)}
                                        </span>
                                    ) : (
                                        'Cidade e bairro/região'
                                    )}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Capacidade de Hóspedes</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={guestCapacity}
                                    onChange={e => setGuestCapacity(parseInt(e.target.value) || 2)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Número máximo de pessoas
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            {canProceedToCompetitors && firstSelectedProperty?.latitude && firstSelectedProperty?.longitude && (
                                <Button
                                    type="button"
                                    onClick={() => setStep('competitors')}
                                    className="gap-2"
                                >
                                    Buscar Concorrentes <ChevronRight className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading || !canSubmit}
                                variant={canProceedToCompetitors ? "outline" : "default"}
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {canProceedToCompetitors ? 'Pular e Criar' : 'Criar Cesta'}
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'competitors' && firstSelectedProperty && (
                    <div className="space-y-4">
                        <AICompetitorSuggestions
                            property={firstSelectedProperty}
                            selectedIds={selectedCompetitors}
                            onSelectionChange={setSelectedCompetitors}
                        />

                        <div className="flex justify-between gap-2 pt-4 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep('info')}
                                className="gap-2"
                            >
                                <ChevronLeft className="h-4 w-4" /> Voltar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {selectedCompetitors.length > 0
                                    ? `Criar com ${selectedCompetitors.length} competidor(es)`
                                    : 'Criar Cesta Vazia'}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
