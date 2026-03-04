"use client"

import { useState, useEffect, useMemo } from "react"
import { Building2, Plus, Search, Trash2, RefreshCw, Layers, FolderPlus, X, Edit, Box, Save, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase-client"
import { InitialLoadingScreen } from "@/components/page-skeleton"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"

export function CustosClient() {
    // BigQuery Properties
    const [allProperties, setAllProperties] = useState<any[]>([])
    // Supabase Data
    const [baskets, setBaskets] = useState<any[]>([])
    const [basketsLoading, setBasketsLoading] = useState(true)

    // Current Selection State
    const [selectedBasket, setSelectedBasket] = useState<any | null>(null)
    const [basketCosts, setBasketCosts] = useState<any[]>([])

    // Loaders
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [savingCost, setSavingCost] = useState(false)
    const [savingBasket, setSavingBasket] = useState(false)

    // Form inputs
    const [searchBasket, setSearchBasket] = useState("")
    const [filterGrupo, setFilterGrupo] = useState("")
    const [filterEstrela, setFilterEstrela] = useState<number | null>(null)
    const [newCost, setNewCost] = useState({ name: "", amount: "", type: "fixed_monthly" })

    // --- Dialog Cesta (Criar/Editar) ---
    const [isBasketModalOpen, setIsBasketModalOpen] = useState(false)
    const [editingBasketId, setEditingBasketId] = useState<string | null>(null)
    const [basketForm, setBasketForm] = useState({
        name: "",
        grupo_acomodacao: "",
        praca: "",
        stars: 0,
        quartos: [] as string[],
        selectedProps: [] as any[] // array of BigQuery props
    })
    const [searchProp, setSearchProp] = useState("")

    // Load BigQuery properties & Baskets
    const fetchData = async () => {
        setBasketsLoading(true)
        try {
            // BigQuery Properties
            const propsRes = await fetch('/api/properties')
            const propsJson = await propsRes.json()
            if (propsJson.success && Array.isArray(propsJson.data)) {
                setAllProperties(propsJson.data.filter((p: any) => p.empreendimento_pousada !== 'Empreendimento'))
            } else {
                setAllProperties(propsJson || [])
            }

            // Puxa as cestas internas
            const res = await fetch("/api/baskets")
            const json = await res.json()
            let internalBaskets = []
            if (json.success && json.data) {
                // Filtrar apenas cestas que possuam propriedades internas ou vazias (para podermos criá-las aqui)
                internalBaskets = json.data.filter((b: any) =>
                    b.basket_items?.some((i: any) => i.item_type === 'internal') || b.basket_items?.length === 0
                )
                setBaskets(internalBaskets)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setBasketsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // --- Derivados para os seletores (Extrair do BQ) ---
    const uniqueQuartos = useMemo(() => Array.from(new Set(allProperties.map(p => String(p.quantidade_quartos || '0')))).sort(), [allProperties])
    const uniquePracas = useMemo(() => Array.from(new Set(allProperties.map(p => p.praca).filter(Boolean))).sort(), [allProperties])
    const uniqueGrupos = useMemo(() => Array.from(new Set(allProperties.map(p => p.grupo_nome).filter(Boolean))).sort(), [allProperties])

    // --- Handlers de Cesta (Mesmo da Racionalização) ---
    const handleOpenCreateBasket = () => {
        setEditingBasketId(null)
        setBasketForm({
            name: "", grupo_acomodacao: "", praca: "", stars: 0, quartos: [], selectedProps: []
        })
        setIsBasketModalOpen(true)
    }

    const handleOpenEditBasket = (basket: any, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingBasketId(basket.id)

        const internalItems = basket.basket_items?.filter((i: any) => i.item_type === 'internal') || []
        const matchedProps = internalItems.map((item: any) => allProperties.find(p => String(p.idpropriedade) === item.internal_property_id)).filter(Boolean)

        setBasketForm({
            name: basket.name || "",
            grupo_acomodacao: basket.grupo_acomodacao || "",
            praca: basket.praca || "",
            stars: basket.stars || 0,
            quartos: basket.quartos || [],
            selectedProps: matchedProps
        })
        setIsBasketModalOpen(true)
    }

    const toggleQuartoSelection = (q: string) => {
        setBasketForm(prev => ({
            ...prev,
            quartos: prev.quartos.includes(q)
                ? prev.quartos.filter(x => x !== q)
                : [...prev.quartos, q]
        }))
    }

    const addPropToFormBasket = (p: any) => {
        if (!basketForm.selectedProps.find(x => x.idpropriedade === p.idpropriedade)) {
            setBasketForm(prev => ({ ...prev, selectedProps: [...prev.selectedProps, p] }))
        }
        setSearchProp("")
    }

    const removePropFromFormBasket = (p: any) => {
        setBasketForm(prev => ({ ...prev, selectedProps: prev.selectedProps.filter(x => x.idpropriedade !== p.idpropriedade) }))
    }

    const handleSaveBasketModal = async () => {
        if (!basketForm.name.trim()) { alert("De um nome para a cesta"); return; }

        setSavingBasket(true)
        try {
            let bId = editingBasketId

            const basketPayload = {
                name: basketForm.name,
                grupo_acomodacao: basketForm.grupo_acomodacao,
                praca: basketForm.praca,
                stars: basketForm.stars,
                quartos: basketForm.quartos,
                location: basketForm.praca
            }

            if (bId) {
                await supabase.from('competitor_baskets').update(basketPayload).eq('id', bId)
            } else {
                const { data, error } = await supabase.from('competitor_baskets').insert([basketPayload]).select()
                if (error) throw error;
                if (data && data.length > 0) bId = data[0].id
            }

            if (!bId) throw new Error("ID da cesta não encontrado");

            if (editingBasketId) {
                await supabase.from('basket_items').delete().match({ basket_id: bId, item_type: 'internal' })
            }

            if (basketForm.selectedProps.length > 0) {
                const itemsToInsert = basketForm.selectedProps.map(p => ({
                    basket_id: bId,
                    internal_property_id: String(p.idpropriedade),
                    item_type: 'internal'
                }))
                await supabase.from('basket_items').insert(itemsToInsert)
            }

            setIsBasketModalOpen(false)
            await fetchData()

            // se estiver alterando a cesta atual, recarregar também (o fetchData já atualiza a lista de baterias, mas a ativa precisa do ref object limpo)
            if (bId === selectedBasket?.id) {
                const updated = baskets.find(b => b.id === bId) // Pode não estar na state array imediato, por isso re-selecionamos abaixo se necessario.
                if (updated) setSelectedBasket(updated)
            }

            alert("Cesta salva com sucesso!")
        } catch (e) {
            console.error(e)
            alert("Erro ao salvar cesta")
        } finally {
            setSavingBasket(false)
        }
    }

    const handleDeleteBasket = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm("Tem certeza que deseja excluir esta cesta? Custos, regras de pricing e unidades associadas serão removidos.")) return
        try {
            await supabase.from('competitor_baskets').delete().eq('id', id)
            setBaskets(baskets.filter(b => b.id !== id))
            if (selectedBasket?.id === id) setSelectedBasket(null)
        } catch (e) { console.error(e) }
    }


    const selectBasket = async (basket: any) => {
        setSelectedBasket(basket)
        setLoadingDetails(true)
        try {
            // Load associated costs
            const { data: costsData } = await supabase.from('basket_costs').select('*').eq('basket_id', basket.id)
            setBasketCosts(costsData || [])
        } finally {
            setLoadingDetails(false)
        }
    }

    // --- COSTS ---
    const handleAddCost = async () => {
        if (!selectedBasket || !newCost.name || !newCost.amount) return
        setSavingCost(true)
        try {
            const costData = {
                basket_id: selectedBasket.id,
                name: newCost.name,
                amount: parseFloat(newCost.amount),
                type: newCost.type
            }
            const { data, error } = await supabase.from('basket_costs').insert([costData]).select()
            if (!error && data) {
                setBasketCosts([...basketCosts, data[0]])
                setNewCost({ name: "", amount: "", type: "fixed_monthly" })
            }
        } finally {
            setSavingCost(false)
        }
    }

    const handleDeleteCost = async (id: string) => {
        try {
            await supabase.from('basket_costs').delete().eq('id', id)
            setBasketCosts(basketCosts.filter(c => c.id !== id))
        } catch (e) { console.error(e) }
    }

    // Filter utils
    const filteredBaskets = baskets.filter(b => {
        const matchName = b.name.toLowerCase().includes(searchBasket.toLowerCase())
        const matchGrupo = filterGrupo ? b.grupo_acomodacao === filterGrupo : true
        const matchEstrelas = filterEstrela ? b.stars === filterEstrela : true
        return matchName && matchGrupo && matchEstrelas
    })

    const unassignedProperties = useMemo(() => {
        return allProperties.filter(p => p.empreendimento_pousada !== 'Empreendimento' && !baskets.some(b => b.basket_items?.some((i: any) => i.item_type === 'internal' && i.internal_property_id === String(p.idpropriedade))))
    }, [allProperties, baskets])

    const suggestedBaskets = useMemo(() => {
        const groups: Record<string, typeof allProperties> = {}
        unassignedProperties.forEach(p => {
            if (!p.grupo_nome || !p.quantidade_quartos) return
            const key = `${p.grupo_nome} - ${p.quantidade_quartos} Quartos`
            if (!groups[key]) groups[key] = []
            groups[key].push(p)
        })
        return Object.entries(groups).filter(([_, props]) => props.length >= 1).map(([name, props]) => ({
            name,
            grupo_acomodacao: props[0].grupo_nome,
            quartos: [String(props[0].quantidade_quartos || '0')],
            praca: props[0].praca || '',
            props
        }))
    }, [unassignedProperties])

    const handleCreateSuggestedBasket = (suggestion: any) => {
        setEditingBasketId(null)
        setBasketForm({
            name: suggestion.name,
            grupo_acomodacao: suggestion.grupo_acomodacao,
            praca: suggestion.praca,
            stars: 0,
            quartos: suggestion.quartos,
            selectedProps: suggestion.props
        })
        setIsBasketModalOpen(true)
    }

    // Validar form Cestas local (Apenas para busca no dropdown)
    const filteredPropsForModal = useMemo(() => {
        if (!searchProp) return []
        return allProperties.filter(p => (p.nome || "").toLowerCase().includes(searchProp.toLowerCase()) && !basketForm.selectedProps.find(x => x.idpropriedade === p.idpropriedade)).slice(0, 10)
    }, [allProperties, searchProp, basketForm.selectedProps])


    const formatCostType = (type: string) => {
        if (type === 'fixed_monthly') return 'Fixo Mensal'
        if (type === 'fixed_yearly') return 'Fixo Anual'
        if (type === 'variable_reservation') return 'Variável (por Reserva)'
        if (type === 'variable_night') return 'Variável (por Noite)'
        return type
    }

    if (basketsLoading && !allProperties.length) return <InitialLoadingScreen />

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestão de Custos &amp; Margem</h1>
                    <p className="text-muted-foreground mt-1 text-sm md:text-base">
                        Cadastre e gerencie suas Cestas Internas e atribua agrupamentos de custos em massa.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleOpenCreateBasket} variant="default" size="sm" className="hidden md:flex">
                        <FolderPlus className="mr-2 h-4 w-4" />
                        Criar Cesta Interna
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* SIdebar: Cestas */}
                <div className="border rounded-xl bg-card col-span-1 flex flex-col max-h-[700px] overflow-hidden">
                    <div className="p-4 border-b flex flex-col gap-3">
                        <div className="font-semibold text-sm">Cestas Internas</div>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar cesta..."
                                value={searchBasket}
                                onChange={(e) => setSearchBasket(e.target.value)}
                                className="pl-8 h-9 text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <select
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                value={filterGrupo}
                                onChange={e => setFilterGrupo(e.target.value)}
                            >
                                <option value="">Todos Grupos</option>
                                {uniqueGrupos.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <select
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                value={filterEstrela || ''}
                                onChange={e => setFilterEstrela(e.target.value ? Number(e.target.value) : null)}
                            >
                                <option value="">Qualquer Estrela</option>
                                {[1, 2, 3, 4, 5].map(s => <option key={s} value={s}>{s} Estrelas</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="p-2 overflow-y-auto flex-1 h-full min-h-[400px]">
                        {basketsLoading ? (
                            <p className="text-sm p-4 text-center text-muted-foreground">Carregando...</p>
                        ) : filteredBaskets.length === 0 ? (
                            <p className="text-sm p-4 text-center text-muted-foreground italic">Nenhuma cesta interna.</p>
                        ) : (
                            filteredBaskets.map(b => (
                                <div
                                    key={b.id}
                                    onClick={() => selectBasket(b)}
                                    className={`w-full group text-left px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer flex justify-between items-center ${selectedBasket?.id === b.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                                >
                                    <div className="flex items-center gap-2 font-medium truncate">
                                        <span className="truncate">{b.name}</span>
                                        {b.stars > 0 && (
                                            <div className="flex gap-0.5 ml-1">
                                                {[...Array(b.stars)].map((_, i) => (
                                                    <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${selectedBasket?.id === b.id ? 'text-primary-foreground hover:bg-primary/80 hover:text-white' : 'text-muted-foreground hover:bg-muted/80'}`}
                                            onClick={(e) => handleOpenEditBasket(b, e)}
                                        >
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-6 w-6 ml-1 opacity-0 group-hover:opacity-100 transition-opacity ${selectedBasket?.id === b.id ? 'text-primary-foreground hover:bg-primary/80 hover:text-white' : 'text-muted-foreground hover:text-destructive'}`}
                                            onClick={(e) => handleDeleteBasket(b.id, e)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content: Basket Config & Costs */}
                <div className="col-span-1 md:col-span-3">
                    {!selectedBasket ? (
                        <div className="flex flex-col gap-6">
                            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-8 text-center border-dashed flex flex-col justify-center">
                                <div className="mx-auto flex flex-col items-center">
                                    <Layers className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                                    <h2 className="text-xl font-semibold">Selecione ou Crie uma Cesta Interna</h2>
                                    <p className="text-muted-foreground mt-2 text-sm max-w-[320px]">
                                        Use o menu lateral para selecionar uma cesta e atribua os custos para todas as propriedades dentro dela.
                                    </p>
                                </div>
                            </div>

                            {/* Unassigned Properties & Suggestions */}
                            {suggestedBaskets.length > 0 && (
                                <div className="rounded-xl border bg-card shadow-sm p-6 overflow-hidden">
                                    <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                                        Propriedades Sem Agrupamento
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Temos {unassignedProperties.length} propriedades que ainda não estão em nenhuma cesta de custos. Criamos sugestões de agrupamento para facilitar:
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 pb-2">
                                        {suggestedBaskets.map((sug, i) => (
                                            <div key={i} className="border bg-muted/20 rounded-lg p-4 flex flex-col gap-3 flex-shrink-0 transition-colors hover:border-primary/50">
                                                <div>
                                                    <div className="font-semibold text-sm mb-1">{sug.name}</div>
                                                    <div className="text-xs text-muted-foreground">{sug.props.length} unidades | {sug.praca || 'Sem praça'}</div>
                                                </div>
                                                <div className="flex gap-1 flex-wrap mb-2">
                                                    {sug.props.slice(0, 3).map((p: any) => (
                                                        <Badge key={p.idpropriedade} variant="secondary" className="text-[10px] font-normal px-1 py-0">{p.nome.split('-').pop()?.substring(0, 20).trim() || p.nome.substring(0, 20)}</Badge>
                                                    ))}
                                                    {sug.props.length > 3 && <Badge variant="secondary" className="text-[10px] font-normal px-1 py-0">+{sug.props.length - 3}</Badge>}
                                                </div>
                                                <Button size="sm" variant="default" className="w-full mt-auto" onClick={() => handleCreateSuggestedBasket(sug)}>
                                                    <FolderPlus className="mr-2 h-4 w-4" /> Criar Cesta
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {/* Properties Quick View */}
                            <div className="rounded-xl border bg-card p-6 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h2 className="text-lg font-bold">({selectedBasket.name}) Propriedades da Cesta</h2>
                                        <p className="text-sm text-muted-foreground mt-0.5">As regras de custo abaixo serão aplicadas a todas unidades desta cesta.</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={(e) => handleOpenEditBasket(selectedBasket, e)}>
                                        <Edit className="h-4 w-4 mr-2" /> Editar Unidades
                                    </Button>
                                </div>

                                <div className="flex flex-col gap-4">
                                    {/* Associated List badges (View Only) */}
                                    <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-md bg-muted/10 max-h-[140px] overflow-y-auto">
                                        {!selectedBasket.basket_items || selectedBasket.basket_items.filter((i: any) => i.item_type === 'internal').length === 0 ? (
                                            <span className="text-sm text-muted-foreground italic py-1">Nenhuma unidade vinculada (Adicione editando a cesta).</span>
                                        ) : (
                                            selectedBasket.basket_items.filter((i: any) => i.item_type === 'internal').map((assoc: any) => {
                                                const bqMatch = allProperties.find(x => String(x.idpropriedade) === assoc.internal_property_id)
                                                return (
                                                    <Badge key={assoc.id} variant="secondary" className="pl-3 pr-3 py-1.5 text-xs flex items-center gap-1 font-medium bg-background border shadow-sm">
                                                        <Building2 className="h-3 w-3 text-muted-foreground" />
                                                        <span className="truncate max-w-[200px]">{bqMatch ? bqMatch.nome : `ID: ${assoc.internal_property_id}`}</span>
                                                    </Badge>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* New Cost Form */}
                            <div className="rounded-xl border bg-card p-6 shadow-sm bg-primary/5 border-primary/20">
                                <h2 className="text-lg font-bold mb-4 text-primary">Adicionar Regra de Custo à Cesta</h2>
                                <div className="flex flex-wrap gap-4 items-end">
                                    <div className="flex-1 min-w-[200px]">
                                        <label className="text-xs font-semibold mb-1 block">Nome do Custo (Ex: Condomínio, IPTU)</label>
                                        <Input value={newCost.name} onChange={e => setNewCost({ ...newCost, name: e.target.value })} placeholder="Nome" />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-xs font-semibold mb-1 block">Valor (R$)</label>
                                        <Input type="number" value={newCost.amount} onChange={e => setNewCost({ ...newCost, amount: e.target.value })} placeholder="0.00" />
                                    </div>
                                    <div className="w-56">
                                        <label className="text-xs font-semibold mb-1 block">Tipo de Custo</label>
                                        <select
                                            value={newCost.type}
                                            onChange={e => setNewCost({ ...newCost, type: e.target.value })}
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 border-primary/50 focus:ring-primary"
                                        >
                                            <optgroup label="Custos Fixos">
                                                <option value="fixed_monthly">Fixo Mensal</option>
                                                <option value="fixed_yearly">Fixo Anual</option>
                                            </optgroup>
                                            <optgroup label="Custos Variáveis">
                                                <option value="variable_reservation">Variável (por Reserva)</option>
                                                <option value="variable_night">Variável (por Noite)</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <Button onClick={handleAddCost} disabled={savingCost || !newCost.name || !newCost.amount}>
                                        {savingCost ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                        Adicionar
                                    </Button>
                                </div>
                            </div>

                            {/* Costs Lists */}
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Fixos */}
                                <div className="rounded-xl border bg-card shadow-sm p-6">
                                    <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Custos Fixos</h3>
                                    {loadingDetails ? (
                                        <p className="text-sm text-muted-foreground mt-4">Carregando...</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {basketCosts.filter(c => c.type.startsWith('fixed')).map(c => (
                                                <div key={c.id} className="flex justify-between items-center p-3 border rounded-md bg-background">
                                                    <div>
                                                        <p className="font-bold text-sm text-foreground">{c.name}</p>
                                                        <div className="flex gap-2 items-center mt-1 text-xs">
                                                            <Badge variant="outline" className="text-[10px] bg-muted">{formatCostType(c.type)}</Badge>
                                                            <span className="text-muted-foreground font-medium text-xs">R$ {Number(c.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteCost(c.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {basketCosts.filter(c => c.type.startsWith('fixed')).length === 0 && (
                                                <p className="text-sm text-muted-foreground italic pt-2">Nenhum custo fixo atrelado à cesta.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Variáveis */}
                                <div className="rounded-xl border bg-card shadow-sm p-6">
                                    <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Custos Variáveis</h3>
                                    {loadingDetails ? (
                                        <p className="text-sm text-muted-foreground mt-4">Carregando...</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {basketCosts.filter(c => c.type.startsWith('variable')).map(c => (
                                                <div key={c.id} className="flex justify-between items-center p-3 border rounded-md bg-background">
                                                    <div>
                                                        <p className="font-bold text-sm text-foreground">{c.name}</p>
                                                        <div className="flex gap-2 items-center mt-1 text-xs">
                                                            <Badge variant="outline" className="text-[10px] bg-muted/60 text-primary">{formatCostType(c.type)}</Badge>
                                                            <span className="text-muted-foreground font-medium text-xs">R$ {Number(c.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteCost(c.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {basketCosts.filter(c => c.type.startsWith('variable')).length === 0 && (
                                                <p className="text-sm text-muted-foreground italic pt-2">Nenhum custo variável atrelado à cesta.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal para Criar/Editar Cesta Interna (Replicado da Racionalização) */}
            <Dialog open={isBasketModalOpen} onOpenChange={setIsBasketModalOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingBasketId ? "Editar Cesta Interna" : "Nova Cesta Interna"}</DialogTitle>
                        <DialogDescription>
                            Crie a cesta e agrupe unidades para facilitar o gerenciamento de custos e benchmarks futuros.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4 grid-cols-1 md:grid-cols-2">
                        {/* Coluna Esquerda: Meta dados */}
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Nome da Cesta*</label>
                                <Input
                                    placeholder="Ex: Praia de Cabo Branco - 2qts"
                                    value={basketForm.name}
                                    onChange={e => setBasketForm(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Praça (Região/Cidade)</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                                    value={basketForm.praca}
                                    onChange={e => setBasketForm(prev => ({ ...prev, praca: e.target.value }))}
                                >
                                    <option value="">Selecione a Praça (Opcional)...</option>
                                    {uniquePracas.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Grupo de Acomodação</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                                    value={basketForm.grupo_acomodacao}
                                    onChange={e => setBasketForm(prev => ({ ...prev, grupo_acomodacao: e.target.value }))}
                                >
                                    <option value="">Selecione o Grupo (Opcional)...</option>
                                    {uniqueGrupos.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Classificação (Estrelas)</label>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <Button
                                            key={star}
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className={`h-8 w-8 hover:bg-yellow-100 hover:text-yellow-500 ${basketForm.stars >= star ? 'text-yellow-400' : 'text-muted-foreground/30'}`}
                                            onClick={() => setBasketForm(prev => ({ ...prev, stars: star }))}
                                        >
                                            <Star className={`h-5 w-5 ${basketForm.stars >= star ? 'fill-yellow-400' : ''}`} />
                                        </Button>
                                    ))}
                                    {basketForm.stars > 0 && (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setBasketForm(prev => ({ ...prev, stars: 0 }))} className="h-8 text-xs text-muted-foreground ml-2">
                                            Limpar
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Quantidade de Quartos (Múltipla Seleção)</label>
                                <div className="flex gap-2 flex-wrap">
                                    {uniqueQuartos.map(q => {
                                        const isSelected = basketForm.quartos.includes(q)
                                        return (
                                            <Badge
                                                key={q}
                                                variant={isSelected ? "default" : "outline"}
                                                className="cursor-pointer font-medium hover:bg-primary/80 transition-colors"
                                                onClick={() => toggleQuartoSelection(q)}
                                            >
                                                {q} Quartos
                                            </Badge>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Coluna Direita: Propriedades */}
                        <div className="flex flex-col flex-1 h-full min-h-[300px]">
                            <label className="text-sm font-medium mb-1.5 block">Propriedades Internas Associadas</label>

                            <div className="relative mb-3">
                                <Input
                                    placeholder="Buscar unidades para adicionar..."
                                    value={searchProp}
                                    onChange={(e) => setSearchProp(e.target.value)}
                                    className="bg-muted/30"
                                />
                                {/* Dropdown */}
                                {searchProp && (
                                    <div className="absolute top-full mt-1 w-full bg-popover border text-popover-foreground shadow-lg rounded-md max-h-[250px] overflow-auto z-[60]">
                                        {filteredPropsForModal.length > 0 ? (
                                            filteredPropsForModal.map((p) => (
                                                <button
                                                    key={p.idpropriedade}
                                                    onClick={() => addPropToFormBasket(p)}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted focus:bg-muted truncate block"
                                                >
                                                    {p.nome} <span className="text-muted-foreground text-xs ml-1">({p.quantidade_quartos}q | {p.praca})</span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-3 py-4 text-sm text-center text-muted-foreground">Nenhuma encontrada (ou já adicionada).</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="border rounded-md flex-1 overflow-y-auto bg-muted/10 p-2 space-y-1">
                                {basketForm.selectedProps.map(p => (
                                    <div key={p.idpropriedade} className="flex items-center justify-between text-sm py-1.5 px-2 bg-background border shadow-sm rounded-md">
                                        <span className="truncate max-w-[85%]">{p.nome}</span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removePropFromFormBasket(p)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {basketForm.selectedProps.length === 0 && (
                                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
                                        Nenhuma selecionada.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsBasketModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveBasketModal} disabled={savingBasket || !basketForm.name.trim()}>
                            {savingBasket ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Cesta
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
