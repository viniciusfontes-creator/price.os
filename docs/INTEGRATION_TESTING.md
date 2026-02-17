# Integration Testing Guide

## Overview

This guide provides comprehensive integration testing procedures for the Global Filters implementation across all dashboard pages.

## Test Environment Setup

### Prerequisites

- Application running on `http://localhost:3000`
- Mock data loaded (automatic on startup)
- All pages accessible

### Test Data

The mock data includes:

- **Properties**: ~50 properties across multiple praças and grupos
- **Reservations**: Multiple reservations per property
- **Date Range**: 2024-2026
- **Channels**: Airbnb, Booking, VRBO, etc.

## Test Scenarios

### 1. Filter Bar Functionality

#### Test 1.1: Date Range Filter

**Steps:**

1. Navigate to Dashboard (Home page)
2. Open Date Range filter
3. Select "Last 30 Days" preset
4. Verify all metrics update
5. Change to custom date range (e.g., 2026-01-01 to 2026-01-31)
6. Verify metrics recalculate

**Expected Results:**

- Metrics show only data within selected date range
- Charts update to reflect filtered data
- Active filter indicator appears
- Filter persists across page navigation

#### Test 1.2: Praça Multi-Select

**Steps:**

1. Open Praça filter dropdown
2. Select "São Paulo"
3. Verify metrics update
4. Add "Rio de Janeiro" to selection
5. Verify combined results

**Expected Results:**

- Only properties from selected praças appear
- Metrics aggregate correctly
- Filter badge shows "2 praças"

#### Test 1.3: Grupo Multi-Select

**Steps:**

1. Open Grupo filter
2. Select one or more grupos
3. Verify filtering works
4. Clear selection
5. Verify all data returns

**Expected Results:**

- Filtering applies immediately
- Clear button removes filter
- No errors in console

#### Test 1.4: Tipo de Operação Filter

**Steps:**

1. Select "short stay"
2. Verify only short stay properties shown
3. Select "long stay" as well
4. Verify both types appear

**Expected Results:**

- Correct property types filtered
- Metrics accurate for selected types

#### Test 1.5: Channel (Partner) Filter

**Steps:**

1. Select "Airbnb" from partner filter
2. Verify only Airbnb reservations counted
3. Add "Booking"
4. Verify combined channel data

**Expected Results:**

- Revenue reflects only selected channels
- Reservation count accurate
- Charts show filtered data

#### Test 1.6: Numeric Range Filters

**Steps:**

1. Set minimum guests to 2
2. Set maximum guests to 4
3. Verify filtering
4. Test revenue range filter
5. Test antecedência (lead time) filter

**Expected Results:**

- Only reservations within range appear
- Metrics recalculate correctly
- No performance issues

### 2. Cross-Page Filter Persistence

#### Test 2.1: Navigation Persistence

**Steps:**

1. Set filters on Dashboard
2. Navigate to Operations page
3. Verify same filters applied
4. Navigate to Pricing page
5. Verify filters still active
6. Navigate to Sales Intelligence
7. Verify consistency

**Expected Results:**

- Filters persist across all pages
- No filter loss during navigation
- Active filters indicator consistent

#### Test 2.2: Filter State in URL

**Steps:**

1. Apply multiple filters
2. Copy URL
3. Open in new tab
4. Verify filters restored (if implemented)

**Expected Results:**

- Filters saved in localStorage
- State recoverable

### 3. Page-Specific Integration

#### Test 3.1: Dashboard (Home)

**Steps:**

1. Apply praça filter: "São Paulo"
2. Verify Key Metrics Panel updates
3. Check Revenue Chart reflects filter
4. Verify Top Properties ranking changes
5. Check Status Distribution chart

**Expected Results:**

- All widgets show São Paulo data only
- Revenue totals match filtered data
- Rankings accurate

#### Test 3.2: Operations Page

**Steps:**

1. Apply date range filter
2. Verify Pace Control chart updates
3. Check Units Performance table
4. Verify Revenue by Property chart

**Expected Results:**

- Pace chart shows filtered period
- Table shows only filtered properties
- Metrics accurate

#### Test 3.3: Pricing Page

**Steps:**

1. Apply grupo filter
2. Verify Pricing Simulator uses filtered data
3. Check Market Intelligence tab
4. Verify Laffer Curves update

**Expected Results:**

- Simulations based on filtered properties
- Market data reflects filter
- No calculation errors

#### Test 3.4: Sales Intelligence

**Steps:**

1. Apply partner filter: "Airbnb"
2. Verify Sales Funnel shows Airbnb only
3. Check Partner Performance table
4. Verify Demand Trends chart

**Expected Results:**

- Funnel metrics for Airbnb only
- Partner table filtered correctly
- Trends accurate

### 4. Performance Testing

#### Test 4.1: Filter Application Speed

**Steps:**

1. Apply single filter
2. Measure time to update (should be < 500ms)
3. Apply multiple filters simultaneously
4. Measure update time

**Expected Results:**

- Single filter: < 500ms
- Multiple filters: < 1000ms
- No UI freezing

#### Test 4.2: Large Dataset Handling

**Steps:**

1. Apply filter that returns many results
2. Verify performance
3. Apply filter that returns few results
4. Verify performance

**Expected Results:**

- Smooth performance with any result size
- No memory leaks
- Charts render efficiently

### 5. Edge Cases

#### Test 5.1: Empty Results

**Steps:**

1. Apply filters that match no data
2. Verify empty state displayed
3. Check no errors in console
4. Verify clear filters works

**Expected Results:**

- Friendly empty state message
- "No data matches your filters" shown
- Clear filters button visible
- No crashes

#### Test 5.2: All Filters Combined

**Steps:**

1. Apply all filter types simultaneously
2. Verify correct results
3. Remove filters one by one
4. Verify data returns progressively

**Expected Results:**

- Correct intersection of all filters
- Smooth filter removal
- Accurate recalculation

#### Test 5.3: Filter Conflicts

**Steps:**

1. Apply conflicting filters (e.g., date range with no data)
2. Verify graceful handling
3. Apply property-specific + praça filters
4. Verify logical AND operation

**Expected Results:**

- No errors
- Empty state when appropriate
- Clear indication of active filters

### 6. Data Consistency

#### Test 6.1: Metric Accuracy

**Steps:**

1. Apply praça filter: "São Paulo"
2. Manually verify revenue total
3. Check reservation count
4. Verify average ticket calculation
5. Check occupancy rate

**Expected Results:**

- All metrics mathematically correct
- No rounding errors
- Consistent across pages

#### Test 6.2: Chart Data Accuracy

**Steps:**

1. Apply filters
2. Verify chart data matches metrics
3. Check tooltip values
4. Verify legend accuracy

**Expected Results:**

- Charts reflect filtered data
- Tooltips show correct values
- No data mismatches

### 7. User Experience

#### Test 7.1: Filter Discovery

**Steps:**

1. As new user, locate filter bar
2. Open each filter type
3. Verify clear labels
4. Check helpful tooltips

**Expected Results:**

- Filter bar easily visible
- Clear filter names
- Intuitive interface

#### Test 7.2: Filter Feedback

**Steps:**

1. Apply filter
2. Verify visual feedback
3. Check active filter badges
4. Verify clear all button

**Expected Results:**

- Immediate visual feedback
- Clear active filter indicators
- Easy to clear filters

#### Test 7.3: Mobile Responsiveness

**Steps:**

1. Open on mobile device
2. Access filter bar
3. Apply filters
4. Verify usability

**Expected Results:**

- Filter bar accessible on mobile
- Touch-friendly controls
- No layout issues

## Automated Test Execution

### Running Unit Tests

```bash
npm test
```

### Running Specific Test Suites

```bash
# Filter utils tests
npm test filter-utils.test.ts

# Calculation utils tests
npm test calculation-utils.test.ts
```

### Coverage Report

```bash
npm test -- --coverage
```

**Target Coverage:**

- Filter Utils: > 90%
- Calculation Utils: > 90%
- Overall: > 85%

## Performance Benchmarks

### Acceptable Performance Metrics

- **Filter Application**: < 500ms
- **Page Navigation**: < 200ms
- **Chart Rendering**: < 1000ms
- **Data Recalculation**: < 300ms

### Performance Testing Tools

```bash
# Chrome DevTools Performance tab
# Lighthouse audit
# React DevTools Profiler
```

## Bug Reporting Template

When reporting issues, include:

```markdown
**Filter Configuration:**
- Praças: [list]
- Grupos: [list]
- Date Range: [start] to [end]
- Other filters: [list]

**Expected Behavior:**
[Description]

**Actual Behavior:**
[Description]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Screenshots:**
[Attach screenshots]

**Console Errors:**
[Paste any errors]

**Environment:**
- Browser: [Chrome/Firefox/Safari]
- Version: [version]
- OS: [macOS/Windows/Linux]
```

## Test Checklist

Use this checklist for comprehensive testing:

### Filter Functionality

- [ ] Date range filter works
- [ ] Praça multi-select works
- [ ] Grupo multi-select works
- [ ] Tipo de operação filter works
- [ ] Partner filter works
- [ ] Numeric range filters work
- [ ] All filters can be cleared

### Cross-Page Behavior

- [ ] Filters persist on Dashboard
- [ ] Filters persist on Operations
- [ ] Filters persist on Pricing
- [ ] Filters persist on Sales Intelligence
- [ ] Filter state saved in localStorage

### Data Accuracy

- [ ] Revenue calculations correct
- [ ] Reservation counts accurate
- [ ] Average ticket correct
- [ ] Occupancy rates accurate
- [ ] Charts match metrics

### Performance

- [ ] Filter application < 500ms
- [ ] No UI freezing
- [ ] Charts render smoothly
- [ ] No memory leaks

### Edge Cases

- [ ] Empty results handled
- [ ] All filters combined work
- [ ] Filter conflicts handled
- [ ] Large datasets perform well

### User Experience

- [ ] Filter bar easily accessible
- [ ] Clear visual feedback
- [ ] Mobile responsive
- [ ] Intuitive interface

## Regression Testing

After any code changes, run:

1. **Smoke Test** (5 minutes)
   - Apply one filter on each page
   - Verify basic functionality

2. **Core Scenarios** (15 minutes)
   - Test all filter types
   - Verify cross-page persistence
   - Check metric accuracy

3. **Full Test Suite** (30 minutes)
   - Run all test scenarios
   - Execute automated tests
   - Performance benchmarks

## Continuous Integration

### Pre-commit Checks

```bash
npm run lint
npm test
npm run build
```

### CI Pipeline

1. Lint check
2. Unit tests
3. Build verification
4. Performance benchmarks

## Sign-off Criteria

Before marking Phase 6 complete:

- [ ] All unit tests passing
- [ ] Integration tests executed
- [ ] Performance benchmarks met
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] User acceptance testing passed

## Next Steps

After completing integration testing:

1. Document any issues found
2. Create bug tickets
3. Prioritize fixes
4. Re-test after fixes
5. Proceed to Phase 7 (Documentation & Deployment)
