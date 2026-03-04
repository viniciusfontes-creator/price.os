"use client"

import { useEffect, useState, useMemo } from "react"
import { GitCompare, Plus, RefreshCw, Layers, ArrowRight, Save, Trash2, X, Edit, FolderPlus, Building2, Star, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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

export function RacionalizacaoClient() {
    // --- Data State ---
    const [baskets, setBaskets] = useState<any[]>([])
    const [rules, setRules] = useState<any[]>([])
    const [allProperties, setAllProperties] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // --- Editor Correlação ---
    const [selectedBasket, setSelectedBasket] = useState<any | null>(null)
    const [ruleForm, setRuleForm] = useState({
        base_basket_id: "",
        adjustment_type: "percentage",
        adjustment_value: ""
    })
    const [saving, setSaving] = useState(false)

    // Form inputs
    const [searchBasket, setSearchBasket] = useState("")
    const [filterGrupo, setFilterGrupo] = useState("")
    const [filterEstrela, setFilterEstrela] = useState<number | null>(null)

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

    const fetchData = async () => {
        setLoading(true)
        try {
            // BigQuery Properties
            const propsRes = await fetch('/api/properties')
            const propsJson = await propsRes.json()
            if (propsJson.success && Array.isArray(propsJson.data)) {
                setAllProperties(propsJson.data.filter((p: any) => p.empreendimento_pousada !== 'Empreendimento'))
            } else {
                setAllProperties(propsJson || [])
            }

            // Puxa as cestas
            const res = await fetch("/api/baskets")
            const json = await res.json()
            let internalBaskets = []
            if (json.success && json.data) {
                // Filtrar apenas cestas que possuam propriedades internas
                // (Para a Racionalização, exigiremos apenas interna)
                internalBaskets = json.data.filter((b: any) =>
                    b.basket_items?.some((i: any) => i.item_type === 'internal') || b.basket_items?.length === 0
                )
                setBaskets(internalBaskets)
            }

            // Puxa as regras existentes no Supabase
            const { data: rulesData } = await supabase.from('basket_pricing_rules').select('*')
            if (rulesData) {
                setRules(rulesData)
            }

        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // --- Derivados para os seletores (Extrair do BQ) ---
    const uniqueQuartos = useMemo(() => Array.from(new Set(allProperties.map(p => String(p.quantidade_quartos || '0')))).sort(), [allProperties])
    const uniquePracas = useMemo(() => Array.from(new Set(allProperties.map(p => p.praca).filter(Boolean))).sort(), [allProperties])
    const uniqueGrupos = useMemo(() => Array.from(new Set(allProperties.map(p => p.grupo_nome).filter(Boolean))).sort(), [allProperties])

    // --- Handlers de Cesta ---
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

        // Match properties from items
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

        setSaving(true)
        try {
            let bId = editingBasketId

            // 1. Salvar ou criar a Cesta na tabela competitor_baskets
            const basketPayload = {
                name: basketForm.name,
                grupo_acomodacao: basketForm.grupo_acomodacao,
                praca: basketForm.praca,
                stars: basketForm.stars,
                quartos: basketForm.quartos,
                location: basketForm.praca // opcional backup
            }

            if (bId) {
                await supabase.from('competitor_baskets').update(basketPayload).eq('id', bId)
            } else {
                const { data, error } = await supabase.from('competitor_baskets').insert([basketPayload]).select()
                if (error) throw error;
                if (data && data.length > 0) bId = data[0].id
            }

            if (!bId) throw new Error("ID da cesta não encontrado");

            // 2. Se for edição, limpa as propriedades internas atuais para re-inserir. (Existem propriedades 'external' mas não as tocaremos, vamos deletar as internals desse basket)
            if (editingBasketId) {
                await supabase.from('basket_items').delete().match({ basket_id: bId, item_type: 'internal' })
            }

            // 3. Insere as novas properties internas selecionadas
            if (basketForm.selectedProps.length > 0) {
                const itemsToInsert = basketForm.selectedProps.map(p => ({
                    basket_id: bId,
                    internal_property_id: String(p.idpropriedade),
                    item_type: 'internal'
                }))
                await supabase.from('basket_items').insert(itemsToInsert)
            }

            setIsBasketModalOpen(false)
            fetchData() // Recarrega todas as cestas atualizadas
            alert("Cesta salva com sucesso!")
        } catch (e) {
            console.error(e)
            alert("Erro ao salvar cesta")
        } finally {
            setSaving(false)
        }
    }


    // --- Correlações (Exibição e Salvar) ---
    const handleSelectBasket = (basket: any) => {
        setSelectedBasket(basket)
        const existingRule = rules.find(r => r.dependent_basket_id === basket.id)
        if (existingRule) {
            setRuleForm({
                base_basket_id: existingRule.base_basket_id,
                adjustment_type: existingRule.adjustment_type,
                adjustment_value: String(existingRule.adjustment_value)
            })
        } else {
            setRuleForm({
                base_basket_id: "",
                adjustment_type: "percentage",
                adjustment_value: ""
            })
        }
    }

    const handleSaveRule = async () => {
        if (!selectedBasket || !ruleForm.base_basket_id || !ruleForm.adjustment_value) return
        setSaving(true)

        try {
            const val = parseFloat(ruleForm.adjustment_value)
            const existingRule = rules.find(r => r.dependent_basket_id === selectedBasket.id)

            let data, error
            if (existingRule) {
                const res = await supabase.from('basket_pricing_rules')
                    .update({
                        base_basket_id: ruleForm.base_basket_id,
                        adjustment_type: ruleForm.adjustment_type,
                        adjustment_value: val
                    })
                    .eq('dependent_basket_id', selectedBasket.id)
                    .select()
                data = res.data; error = res.error
            } else {
                const res = await supabase.from('basket_pricing_rules')
                    .insert([{
                        dependent_basket_id: selectedBasket.id,
                        base_basket_id: ruleForm.base_basket_id,
                        adjustment_type: ruleForm.adjustment_type,
                        adjustment_value: val
                    }])
                    .select()
                data = res.data; error = res.error
            }

            if (!error && data) {
                const newRules = rules.filter(r => r.dependent_basket_id !== selectedBasket.id)
                newRules.push(data[0])
                setRules(newRules)
                alert("Correlação salva com sucesso!")
            } else {
                console.error(error)
                alert("Erro ao salvar correlação.")
            }
        } catch (e) { console.error(e) } finally { setSaving(false) }
    }

    const handleDeleteRule = async () => {
        if (!selectedBasket) return
        setSaving(true)
        try {
            const { error } = await supabase.from('basket_pricing_rules')
                .delete()
                .eq('dependent_basket_id', selectedBasket.id)

            if (!error) {
                setRules(rules.filter(r => r.dependent_basket_id !== selectedBasket.id))
                setRuleForm({ base_basket_id: "", adjustment_type: "percentage", adjustment_value: "" })
                alert("Correlação removida!")
            }
        } catch (e) { console.error(e) } finally { setSaving(false) }
    }

    const getRuleDisplayInfo = (basketId: string) => {
        const rule = rules.find(r => r.dependent_basket_id === basketId)
        if (!rule) return null
        const baseName = baskets.find(b => b.id === rule.base_basket_id)?.name || "Desconhecida"
        const isPos = rule.adjustment_value > 0
        const sign = isPos ? "+" : ""
        const valStr = rule.adjustment_type === 'percentage' ? `${sign}${rule.adjustment_value}% ` : `${sign} R$ ${rule.adjustment_value} `
        return { baseName, valStr, isPos }
    }

    // Filtrar properties para o Form da Cesta
    const filteredPropsForModal = useMemo(() => {
        if (!searchProp) return []
        return allProperties.filter(p => (p.nome || "").toLowerCase().includes(searchProp.toLowerCase()) && !basketForm.selectedProps.find(x => x.idpropriedade === p.idpropriedade)).slice(0, 10)
    }, [allProperties, searchProp, basketForm.selectedProps])

    const filteredBaskets = useMemo(() => {
        return baskets.filter(b => {
            const matchName = searchBasket ? b.name.toLowerCase().includes(searchBasket.toLowerCase()) : true
            const matchGrupo = filterGrupo ? b.grupo_acomodacao === filterGrupo : true
            const matchEstrelas = filterEstrela ? b.stars === filterEstrela : true
            return matchName && matchGrupo && matchEstrelas
        })
    }, [baskets, searchBasket, filterGrupo, filterEstrela])

    const unassignedProperties = useMemo(() => {
        return allProperties.filter(p => !baskets.some(b => b.basket_items?.some((i: any) => i.item_type === 'internal' && i.internal_property_id === String(p.idpropriedade))))
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

    if (loading) return <InitialLoadingScreen />

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Racionalização / Benchmarking</h1>
                    <p className="text-muted-foreground mt-1 text-sm md:text-base">
                        Defina a correlação interna de preços multiplicando cestas umas pelas outras de forma relacional.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleOpenCreateBasket} variant="default" size="sm" className="hidden md:flex">
                        <FolderPlus className="mr-2 h-4 w-4" />
                        Criar Cesta Base
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Lado Esquerdo: Lista de Cestas */}
                <div className="md:col-span-2 rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="flex flex-col space-y-1.5 p-6 pb-4 border-b">
                        <div className="font-semibold leading-none tracking-tight">Suas Cestas Base (Supabase)</div>
                        <div className="text-sm text-muted-foreground">Grupos de propriedades internas que podem atuar base de ancoragem ou serem dependentes de outras.</div>
                        <div className="flex flex-col md:flex-row gap-3 pt-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar cesta..."
                                    value={searchBasket}
                                    onChange={(e) => setSearchBasket(e.target.value)}
                                    className="pl-9 h-9"
                                />
                            </div>
                            <select
                                className="flex h-9 w-full md:w-36 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={filterGrupo}
                                onChange={e => setFilterGrupo(e.target.value)}
                            >
                                <option value="">Todos Grupos</option>
                                {uniqueGrupos.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <select
                                className="flex h-9 w-full md:w-36 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={filterEstrela || ''}
                                onChange={e => setFilterEstrela(e.target.value ? Number(e.target.value) : null)}
                            >
                                <option value="">Qualquer Estrela</option>
                                {[1, 2, 3, 4, 5].map(s => <option key={s} value={s}>{s} Estrelas</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="p-6">
                        {loading ? (
                            <div className="flex p-12 items-center justify-center">
                                <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
                            </div>
                        ) : filteredBaskets.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {filteredBaskets.map((basket) => {
                                    const internalCount = basket.basket_items?.filter((i: any) => i.item_type === 'internal').length || 0;
                                    const ruleInfo = getRuleDisplayInfo(basket.id)

                                    return (
                                        <div
                                            key={basket.id}
                                            onClick={() => handleSelectBasket(basket)}
                                            className={`p-5 rounded-xl border flex flex-col gap-4 cursor-pointer transition-all hover:shadow-md ${selectedBasket?.id === basket.id ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm' : 'bg-card hover:border-border/80'} `}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="font-semibold text-base leading-tight break-words pr-2">{basket.name}</div>
                                                    {basket.stars > 0 && (
                                                        <div className="flex gap-0.5">
                                                            {[...Array(basket.stars)].map((_, i) => (
                                                                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                    <Badge variant="secondary" className="text-xs font-semibold whitespace-nowrap">{(basket.quartos && basket.quartos.length > 0) ? basket.quartos.map((q: any) => `${q} q`).join(', ') : '-'}</Badge>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-muted/50 hover:bg-muted" onClick={(e) => handleOpenEditBasket(basket, e)}>
                                                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Representação visual da regra (Se existir) */}
                                            {ruleInfo && (
                                                <div className="flex items-center gap-2 text-xs bg-muted/30 border rounded-lg p-2 mt-auto">
                                                    <span className="font-medium text-muted-foreground truncate flex-1" title={ruleInfo.baseName}>{ruleInfo.baseName}</span>
                                                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    <Badge variant={ruleInfo.isPos ? "default" : "destructive"} className={`font-semibold shrink-0 ${ruleInfo.isPos ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'} `}>
                                                        {ruleInfo.valStr}
                                                    </Badge>
                                                </div>
                                            )}

                                            <div className="flex justify-between mt-auto pt-3 border-t text-xs">
                                                <div className="flex items-center gap-1">
                                                    <Layers className="h-3 w-3 text-primary" />
                                                    <span className="font-medium text-foreground">{internalCount} un. internas</span>
                                                </div>
                                                {!ruleInfo && <span className="text-muted-foreground italic">Sem subordinação</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex h-[300px] shrink-0 items-center justify-center rounded-md border border-dashed mt-4">
                                <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                                    <GitCompare className="h-10 w-10 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">Nenhuma cesta encontrada</h3>
                                    <p className="mb-4 mt-2 text-sm text-muted-foreground">
                                        Clique em "Criar Cesta Base" acima para começar a aplicar regras de preço.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lado Direito: Editor de Correlação / Sugestões */}
                <div className="md:col-span-1 border rounded-xl bg-card flex flex-col h-full">
                    {!selectedBasket ? (
                        <div className="flex flex-col h-full bg-muted/10 rounded-xl overflow-hidden">
                            <div className="p-8 text-center flex flex-col items-center justify-center border-b border-dashed bg-card shrink-0">
                                <GitCompare className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                                <h2 className="font-semibold">Nenhuma cesta selecionada</h2>
                                <p className="text-muted-foreground mt-2 text-sm max-w-[280px]">
                                    Clique em uma cesta ao lado para editar suas propriedades de precificação relativa.
                                </p>
                            </div>

                            {/* Sugestões de Agrupamento */}
                            {suggestedBaskets.length > 0 && (
                                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                                    <div>
                                        <h3 className="font-semibold text-sm flex items-center gap-2">
                                            Propriedades Órfãs ({unassignedProperties.length})
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1 mb-2">
                                            As unidades abaixo ainda não possuem uma Cesta de Precificação. Sugerimos agrupar:
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {suggestedBaskets.map((sug, i) => (
                                            <div key={i} className="border bg-background rounded-lg p-3 flex flex-col gap-2 shadow-sm transition-colors hover:border-primary/50">
                                                <div>
                                                    <div className="font-semibold text-sm leading-tight">{sug.name}</div>
                                                    <div className="text-[11px] text-muted-foreground mt-0.5">{sug.props.length} unidades na praca: {sug.praca || 'Sem praça'}</div>
                                                </div>
                                                <Button size="sm" variant="outline" className="w-full h-8 text-xs font-medium" onClick={() => handleCreateSuggestedBasket(sug)}>
                                                    <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> Agrupar Unidades
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b flex justify-between items-center bg-muted/20">
                                <div>
                                    <div className="text-xs text-muted-foreground font-medium mb-1">Cesta Alvo (Dependente)</div>
                                    <h3 className="font-bold text-lg leading-none">{selectedBasket.name}</h3>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedBasket(null)} className="h-8 w-8 rounded-full">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="p-6 flex-1 flex flex-col gap-6">
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                                    <h4 className="font-semibold text-sm mb-2 text-primary">Correlação (Pricing Base)</h4>
                                    <p className="text-xs text-muted-foreground mb-4">
                                        Defina de qual cesta a <strong>{selectedBasket.name}</strong> herdará sua base de cálculo e qual modificador será aplicado.
                                    </p>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold block mb-1">Cesta Mestre (Base 100%)</label>
                                            <select
                                                value={ruleForm.base_basket_id}
                                                onChange={e => setRuleForm({ ...ruleForm, base_basket_id: e.target.value })}
                                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                                            >
                                                <option value="" disabled>Selecione a cesta raiz...</option>
                                                {baskets.filter(b => b.id !== selectedBasket.id).map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold block mb-1">Valor (Multiplicador)</label>
                                                <Input
                                                    type="number"
                                                    placeholder="Ex: 10, -5"
                                                    value={ruleForm.adjustment_value}
                                                    onChange={e => setRuleForm({ ...ruleForm, adjustment_value: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold block mb-1">Tipo</label>
                                                <select
                                                    value={ruleForm.adjustment_type}
                                                    onChange={e => setRuleForm({ ...ruleForm, adjustment_type: e.target.value })}
                                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                                >
                                                    <option value="percentage">Porcentagem (%)</option>
                                                    <option value="fixed">Absoluto (R$)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {ruleForm.base_basket_id && ruleForm.adjustment_value && (
                                            <div className="mt-4 p-3 bg-background rounded-md border border-dashed text-xs text-center flex items-center justify-center gap-2 font-mono">
                                                <span>[{baskets.find(b => b.id === ruleForm.base_basket_id)?.name}]</span>
                                                <ArrowRight className="h-3 w-3" />
                                                <span className={`${parseFloat(ruleForm.adjustment_value) > 0 ? 'text-green-600' : 'text-red-500'} font - bold`}>
                                                    {parseFloat(ruleForm.adjustment_value) > 0 ? '+' : ''}{ruleForm.adjustment_value}{ruleForm.adjustment_type === 'percentage' ? '%' : ' R$'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Listagem de propriedades só para visualizar */}
                                <div>
                                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider flex justify-between">
                                        <span>Propriedades Internas Afetadas</span>
                                        <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{selectedBasket.basket_items?.filter((i: any) => i.item_type === 'internal').length || 0}</span>
                                    </h4>
                                    <div className="border rounded-md max-h-[220px] overflow-y-auto p-2 bg-muted/10 space-y-1">
                                        {selectedBasket.basket_items?.filter((i: any) => i.item_type === 'internal').map((item: any) => {
                                            // Resolver o nome vindo do BigQuery
                                            const bqProp = allProperties.find(p => String(p.idpropriedade) === item.internal_property_id)
                                            return (
                                                <div key={item.id} className="text-xs py-1.5 px-2 hover:bg-muted truncate rounded border border-transparent hover:border-border flex items-center gap-2">
                                                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    {bqProp ? bqProp.nome : `Prop ID: ${item.internal_property_id} `}
                                                </div>
                                            )
                                        })}
                                        {(!selectedBasket.basket_items || selectedBasket.basket_items.length === 0) && (
                                            <p className="text-xs text-muted-foreground p-2">Nenhuma propriedade vinculada a esta cesta.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t bg-muted/10 flex justify-end gap-2 mt-auto">
                                {rules.some(r => r.dependent_basket_id === selectedBasket.id) && (
                                    <Button variant="destructive" size="sm" onClick={handleDeleteRule} disabled={saving}>
                                        Remover Regra
                                    </Button>
                                )}
                                <Button size="sm" onClick={handleSaveRule} disabled={saving || !ruleForm.base_basket_id || !ruleForm.adjustment_value}>
                                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                    Salvar Correlação
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Modal para Criar/Editar Cesta Interna */}
            <Dialog open={isBasketModalOpen} onOpenChange={setIsBasketModalOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingBasketId ? "Editar Cesta Base" : "Nova Cesta Base"}</DialogTitle>
                        <DialogDescription>
                            Crie agrupamentos e categorias usando as propriedades ativas do seu portfólio.
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
                                            className={`h - 8 w - 8 hover: bg - yellow - 100 hover: text - yellow - 500 ${basketForm.stars >= star ? 'text-yellow-400' : 'text-muted-foreground/30'} `}
                                            onClick={() => setBasketForm(prev => ({ ...prev, stars: star }))}
                                        >
                                            <Star className={`h - 5 w - 5 ${basketForm.stars >= star ? 'fill-yellow-400' : ''} `} />
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
                        <Button onClick={handleSaveBasketModal} disabled={saving || !basketForm.name.trim()}>
                            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Cesta
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
