-- Migration: Seasonalities and Periods for Pricing
-- A seasonality groups one or more praças and defines % distribution per period
-- Each praça belongs to exactly one seasonality

-- Periods table (configurable time ranges)
CREATE TABLE IF NOT EXISTS pricing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('month', 'event')),
  expected_nights INTEGER NOT NULL DEFAULT 15,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seasonalities table (named groupings of praças)
CREATE TABLE IF NOT EXISTS seasonalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Praças assigned to seasonalities (each praça in exactly one seasonality)
CREATE TABLE IF NOT EXISTS seasonality_pracas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seasonality_id UUID NOT NULL REFERENCES seasonalities(id) ON DELETE CASCADE,
  praca TEXT NOT NULL UNIQUE, -- UNIQUE ensures each praça belongs to only one seasonality
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Period percentages per seasonality
CREATE TABLE IF NOT EXISTS seasonality_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seasonality_id UUID NOT NULL REFERENCES seasonalities(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES pricing_periods(id) ON DELETE CASCADE,
  percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(seasonality_id, period_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seasonality_pracas_seasonality ON seasonality_pracas(seasonality_id);
CREATE INDEX IF NOT EXISTS idx_seasonality_periods_seasonality ON seasonality_periods(seasonality_id);
CREATE INDEX IF NOT EXISTS idx_seasonality_periods_period ON seasonality_periods(period_id);

-- RLS
ALTER TABLE pricing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonality_pracas ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonality_periods ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
CREATE POLICY "service_role_pricing_periods" ON pricing_periods FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_seasonalities" ON seasonalities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_seasonality_pracas" ON seasonality_pracas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_seasonality_periods" ON seasonality_periods FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anon key read/write (same pattern as baskets)
CREATE POLICY "anon_pricing_periods" ON pricing_periods FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_seasonalities" ON seasonalities FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_seasonality_pracas" ON seasonality_pracas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_seasonality_periods" ON seasonality_periods FOR ALL TO anon USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pricing_periods_updated_at BEFORE UPDATE ON pricing_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_seasonalities_updated_at BEFORE UPDATE ON seasonalities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_seasonality_periods_updated_at BEFORE UPDATE ON seasonality_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
