'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Home, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

interface Property {
    idpropriedade: string;
    nome: string;
}

interface BasketItem {
    id: string;
    item_type: string;
    internal_property_id?: string;
    airbnb_listing_id?: string;
}

interface Basket {
    id: string;
    name: string;
    location?: string;
    guest_capacity?: number;
    basket_items?: BasketItem[];
}

interface EditBasketDialogProps {
    basket: Basket;
    properties: Property[];
    onSuccess: () => void;
    trigger?: React.ReactNode;
}

export function EditBasketDialog({
    basket,
    properties,
    onSuccess,
    trigger
}: EditBasketDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(basket.name);
    const [location, setLocation] = useState(basket.location || '');
    const [guestCapacity, setGuestCapacity] = useState(basket.guest_capacity || 2);
    const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(
        basket.basket_items
            ?.filter(item => item.item_type === 'internal')
            ?.map(item => item.internal_property_id || '') || []
    );
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Update state when basket changes
    useEffect(() => {
        setName(basket.name);
        setLocation(basket.location || '');
        setGuestCapacity(basket.guest_capacity || 2);
        setSelectedPropertyIds(
            basket.basket_items
                ?.filter(item => item.item_type === 'internal')
                ?.map(item => item.internal_property_id || '') || []
        );
    }, [basket]);

    const handleSave = async () => {
        if (!name.trim()) {
            toast({
                title: 'Erro',
                description: 'Nome da cesta é obrigatório',
                variant: 'destructive'
            });
            return;
        }

        if (selectedPropertyIds.length === 0) {
            toast({
                title: 'Erro',
                description: 'Selecione pelo menos uma propriedade interna',
                variant: 'destructive'
            });
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`/api/baskets?id=${basket.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    location,
                    guest_capacity: guestCapacity,
                    internal_property_ids: selectedPropertyIds
                })
            });

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to update basket');
            }

            toast({
                title: 'Cesta atualizada!',
                description: `As alterações foram salvas com sucesso.`
            });

            onSuccess();
            setOpen(false);
        } catch (error: any) {
            console.error('Error updating basket:', error);
            toast({
                title: 'Erro ao atualizar',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar Cesta</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Basket Name */}
                    <div className="space-y-2">
                        <Label>Nome da Cesta</Label>
                        <Input
                            placeholder="Ex: 2 Quartos Beira-Mar João Pessoa"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Typology Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Localidade</Label>
                            <Input
                                placeholder="Ex: João Pessoa - Beira Mar"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Cidade e bairro/região
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

                    {/* Internal Properties */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            Propriedades Internas
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Selecione as propriedades que fazem parte desta cesta
                        </p>
                        <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                            {properties?.map(prop => (
                                <div key={prop.idpropriedade} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`edit-${prop.idpropriedade}`}
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
                                        htmlFor={`edit-${prop.idpropriedade}`}
                                        className="cursor-pointer text-sm font-normal flex-1"
                                    >
                                        {prop.nome}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {selectedPropertyIds.length} propriedade(s) selecionada(s)
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={loading || !name.trim()}
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Salvar Alterações
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
