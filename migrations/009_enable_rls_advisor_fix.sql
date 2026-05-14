-- =============================================
-- Migration 009: Habilita RLS nas tabelas sinalizadas pelo Supabase advisor
--
-- Estratégia 1 (server-only, fecha acesso via anon key):
--   cost_categories, cost_category_properties, cost_category_items,
--   airbnb_propriedades, airbnb_precos,
--   metas_ajustes_propostos, pricing_ajustes_propostos,
--   proprietario_reports
--
-- Estratégia 2 (acessadas pelo client com anon key — replica padrão de
--   competitor_baskets/basket_items: policy permissiva para 'public'):
--   basket_pricing_rules, basket_costs
--
-- Não tocada: spatial_ref_sys (tabela de sistema do PostGIS).
-- =============================================

-- ---------- Estratégia 1: service_role only ----------

ALTER TABLE public.cost_categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_category_properties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_category_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airbnb_propriedades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airbnb_precos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_ajustes_propostos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_ajustes_propostos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proprietario_reports       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.cost_categories;
CREATE POLICY "Service role full access" ON public.cost_categories
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.cost_category_properties;
CREATE POLICY "Service role full access" ON public.cost_category_properties
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.cost_category_items;
CREATE POLICY "Service role full access" ON public.cost_category_items
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.airbnb_propriedades;
CREATE POLICY "Service role full access" ON public.airbnb_propriedades
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.airbnb_precos;
CREATE POLICY "Service role full access" ON public.airbnb_precos
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.metas_ajustes_propostos;
CREATE POLICY "Service role full access" ON public.metas_ajustes_propostos
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.pricing_ajustes_propostos;
CREATE POLICY "Service role full access" ON public.pricing_ajustes_propostos
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.proprietario_reports;
CREATE POLICY "Service role full access" ON public.proprietario_reports
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ---------- Estratégia 2: permissivo para client anon (padrão competitor_baskets) ----------

ALTER TABLE public.basket_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basket_costs         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to basket_pricing_rules" ON public.basket_pricing_rules;
CREATE POLICY "Allow all access to basket_pricing_rules" ON public.basket_pricing_rules
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to basket_costs" ON public.basket_costs;
CREATE POLICY "Allow all access to basket_costs" ON public.basket_costs
    FOR ALL USING (true) WITH CHECK (true);
