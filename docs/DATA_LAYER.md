# Data Layer Documentation

## Overview

The data layer has been updated to fully support **GlobalFilters** across all data fetching and calculation operations. This ensures consistent filtering behavior throughout the application.

## Key Components

### 1. WebhookService (`lib/webhook-service.ts`)

The main service for data management with comprehensive filter support.

#### New Methods

##### `getFilteredData(filters: GlobalFilters): IntegratedData[]`

**RECOMMENDED** method for getting filtered data.

```typescript
import { WebhookService } from '@/lib/webhook-service'
import { useGlobalFilters } from '@/contexts/global-filters-context'

const service = WebhookService.getInstance()
const { filters } = useGlobalFilters()

// Get filtered data
const data = service.getFilteredData(filters)
```

##### `getFilterOptions()`

Returns all available filter options from the current dataset.

```typescript
const options = service.getFilterOptions()
// Returns: { pracas, grupos, subGrupos, empreendimentos, partners, tipoOperacao }
```

#### Updated Methods (Now Accept Optional Filters)

All analytics methods now accept an optional `GlobalFilters` parameter:

- `getSummaryStats(filters?: GlobalFilters)`
- `getSalesByPartner(filters?: GlobalFilters)`
- `getDailySales(days?: number, filters?: GlobalFilters)`
- `getPropertiesAtRisk(filters?: GlobalFilters)`
- `getPropertiesWithExcessSales(filters?: GlobalFilters)`
- `getOccupancyForecast(filters?: GlobalFilters)`

**Example:**

```typescript
// Without filters (all data)
const stats = service.getSummaryStats()

// With filters (filtered data)
const filteredStats = service.getSummaryStats(filters)
```

### 2. Filter Utilities (`lib/filter-utils.ts`)

Core filtering logic used throughout the application.

#### `applyGlobalFilters(data: IntegratedData[], filters: GlobalFilters): IntegratedData[]`

Applies all global filters to a dataset. This function:

- Filters properties by attributes (praça, grupo, tipo de operação, etc.)
- Filters reservations by date range, channel, guests, revenue, etc.
- Recalculates metrics based on filtered reservations
- Returns a new filtered dataset

**Important:** This function modifies the `reservas` array in-place for each property to only include filtered reservations.

#### `getFilterOptions(data: IntegratedData[])`

Extracts unique values for filter dropdowns from the dataset.

#### `getDatePresets()`

Returns common date range presets (last 7 days, this month, etc.).

### 3. Calculation Utilities (`lib/calculation-utils.ts`)

**NEW** - Comprehensive calculation functions with filter support.

#### Revenue Calculations

```typescript
import { calculateTotalRevenue, calculateAverageTicket, calculateADR } from '@/lib/calculation-utils'

// Total revenue
const revenue = calculateTotalRevenue(data, filters)

// Average ticket (revenue per reservation)
const avgTicket = calculateAverageTicket(data, filters)

// Average Daily Rate
const adr = calculateADR(data, filters)
```

#### Occupancy Calculations

```typescript
import { calculateOccupancyRate } from '@/lib/calculation-utils'

const occupancy = calculateOccupancyRate(
  data,
  '2026-01-01',
  '2026-01-31',
  filters
)
```

#### Channel Performance

```typescript
import { calculateRevenueByPartner } from '@/lib/calculation-utils'

const partnerStats = calculateRevenueByPartner(data, filters)
// Returns: [{ partner, revenue, count, percentage }]
```

#### Goal Achievement

```typescript
import { calculateGoalAchievement } from '@/lib/calculation-utils'

const { achieved, goal, percentage } = calculateGoalAchievement(data, filters)
```

#### Top Performers

```typescript
import { getTopProperties } from '@/lib/calculation-utils'

const topProps = getTopProperties(data, 10, filters)
// Returns top 10 properties by revenue
```

#### Safe Metrics (Edge Case Handling)

```typescript
import { getSafeMetrics, hasValidData } from '@/lib/calculation-utils'

// Check if filtered data has results
if (!hasValidData(data, filters)) {
  console.log('No data matches current filters')
}

// Get metrics with safe fallbacks
const metrics = getSafeMetrics(data, filters)
// Returns { revenue, reservations, averageTicket, adr, nights, hasData }
```

## Usage Patterns

### Pattern 1: Using WebhookService Directly

```typescript
'use client'

import { useEffect, useState } from 'react'
import { WebhookService } from '@/lib/webhook-service'
import { useGlobalFilters } from '@/contexts/global-filters-context'

export default function MyComponent() {
  const { filters } = useGlobalFilters()
  const [stats, setStats] = useState(null)
  
  useEffect(() => {
    const service = WebhookService.getInstance()
    service.initialize()
    
    // Get filtered statistics
    const data = service.getSummaryStats(filters)
    setStats(data)
  }, [filters])
  
  return <div>{/* Render stats */}</div>
}
```

### Pattern 2: Using Calculation Utilities

```typescript
'use client'

import { useEffect, useState } from 'react'
import { WebhookService } from '@/lib/webhook-service'
import { useGlobalFilters } from '@/contexts/global-filters-context'
import { calculateTotalRevenue, getTopProperties } from '@/lib/calculation-utils'

export default function RevenueAnalysis() {
  const { filters } = useGlobalFilters()
  const [revenue, setRevenue] = useState(0)
  const [topProps, setTopProps] = useState([])
  
  useEffect(() => {
    const service = WebhookService.getInstance()
    service.initialize()
    const data = service.getCachedData()
    
    // Calculate metrics with filters
    setRevenue(calculateTotalRevenue(data, filters))
    setTopProps(getTopProperties(data, 10, filters))
  }, [filters])
  
  return (
    <div>
      <h2>Total Revenue: R$ {revenue.toLocaleString()}</h2>
      <h3>Top Properties:</h3>
      <ul>
        {topProps.map(prop => (
          <li key={prop.id}>{prop.name} - R$ {prop.revenue.toLocaleString()}</li>
        ))}
      </ul>
    </div>
  )
}
```

### Pattern 3: Handling Empty Results

```typescript
import { hasValidData, getSafeMetrics } from '@/lib/calculation-utils'

function MyDashboard() {
  const { filters } = useGlobalFilters()
  const data = service.getCachedData()
  
  if (!hasValidData(data, filters)) {
    return <EmptyState message="No data matches your current filters" />
  }
  
  const metrics = getSafeMetrics(data, filters)
  
  return <MetricsDisplay {...metrics} />
}
```

## Best Practices

### 1. Always Use Filters Parameter

When calculating metrics for display, always pass the current filters:

```typescript
// ❌ BAD - Ignores user filters
const revenue = calculateTotalRevenue(data)

// ✅ GOOD - Respects user filters
const revenue = calculateTotalRevenue(data, filters)
```

### 2. Handle Empty Results

Always check for empty filtered results:

```typescript
// ✅ GOOD - Safe handling
const metrics = getSafeMetrics(data, filters)
if (!metrics.hasData) {
  return <EmptyState />
}
```

### 3. Recalculate on Filter Changes

Use `useEffect` to recalculate when filters change:

```typescript
useEffect(() => {
  const newMetrics = calculateMetrics(data, filters)
  setMetrics(newMetrics)
}, [filters, data])
```

### 4. Optimize Performance

Cache filtered data if using multiple calculations:

```typescript
const filteredData = useMemo(() => {
  return applyGlobalFilters(data, filters)
}, [data, filters])

// Use filteredData for multiple calculations
const revenue = calculateTotalRevenue(filteredData)
const reservations = calculateTotalReservations(filteredData)
```

## Migration Guide

### Updating Existing Code

**Before:**

```typescript
const service = WebhookService.getInstance()
const stats = service.getSummaryStats()
```

**After:**

```typescript
const service = WebhookService.getInstance()
const { filters } = useGlobalFilters()
const stats = service.getSummaryStats(filters)
```

### Backward Compatibility

All methods maintain backward compatibility. Calling without filters returns unfiltered data:

```typescript
// Still works - returns all data
const allStats = service.getSummaryStats()

// New - returns filtered data
const filteredStats = service.getSummaryStats(filters)
```

## Performance Considerations

### Filter Application

- Filters are applied in-memory (no server calls)
- Filtering is optimized for datasets up to 10,000 properties
- Date filtering uses efficient date comparison
- Multi-select filters use Set operations for O(1) lookups

### Caching Strategy

- Raw data is cached in WebhookService
- Filtered data is recalculated on demand
- Use React's `useMemo` for expensive calculations
- Consider implementing a filter result cache for very large datasets

### Optimization Tips

```typescript
// ✅ GOOD - Single filter application
const filteredData = applyGlobalFilters(data, filters)
const revenue = calculateTotalRevenue(filteredData)
const reservations = calculateTotalReservations(filteredData)

// ❌ BAD - Multiple filter applications
const revenue = calculateTotalRevenue(data, filters) // Filters applied
const reservations = calculateTotalReservations(data, filters) // Filters applied again
```

## Testing

### Unit Test Example

```typescript
import { calculateTotalRevenue } from '@/lib/calculation-utils'
import { DEFAULT_FILTERS } from '@/types'

describe('calculateTotalRevenue', () => {
  it('should calculate total revenue without filters', () => {
    const revenue = calculateTotalRevenue(mockData)
    expect(revenue).toBe(50000)
  })
  
  it('should calculate filtered revenue', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      pracas: ['São Paulo']
    }
    const revenue = calculateTotalRevenue(mockData, filters)
    expect(revenue).toBe(30000)
  })
  
  it('should return 0 for empty results', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      pracas: ['NonExistent']
    }
    const revenue = calculateTotalRevenue(mockData, filters)
    expect(revenue).toBe(0)
  })
})
```

## Troubleshooting

### Issue: Metrics not updating when filters change

**Solution:** Ensure filters are in the dependency array:

```typescript
useEffect(() => {
  // Recalculate
}, [filters]) // ← Include filters here
```

### Issue: Getting 0 or empty results

**Solution:** Check if data matches filters:

```typescript
if (!hasValidData(data, filters)) {
  console.log('No data matches current filters')
  console.log('Active filters:', filters)
}
```

### Issue: Performance degradation with filters

**Solution:** Use memoization:

```typescript
const filteredData = useMemo(() => 
  applyGlobalFilters(data, filters),
  [data, filters]
)
```

## API Reference Summary

### WebhookService Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `getFilteredData` | `filters: GlobalFilters` | `IntegratedData[]` | Get filtered dataset |
| `getSummaryStats` | `filters?: GlobalFilters` | `SummaryStats` | Get summary statistics |
| `getSalesByPartner` | `filters?: GlobalFilters` | `PartnerStats[]` | Get sales by channel |
| `getDailySales` | `days?: number, filters?: GlobalFilters` | `DailySales[]` | Get daily sales data |
| `getFilterOptions` | - | `FilterOptions` | Get available filter values |

### Calculation Utilities

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `calculateTotalRevenue` | `data, filters?` | `number` | Total revenue |
| `calculateAverageTicket` | `data, filters?` | `number` | Average ticket |
| `calculateADR` | `data, filters?` | `number` | Average daily rate |
| `calculateOccupancyRate` | `data, start, end, filters?` | `number` | Occupancy % |
| `getTopProperties` | `data, limit, filters?` | `Property[]` | Top performers |
| `getSafeMetrics` | `data, filters?` | `Metrics` | Safe metrics with fallbacks |

## Next Steps

- [ ] Add server-side filtering for large datasets
- [ ] Implement filter result caching
- [ ] Add filter performance monitoring
- [ ] Create filter analytics (most used filters, etc.)
