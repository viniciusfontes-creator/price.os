# Global Filters - User Guide

## 🎯 Overview

The Global Filters system provides a powerful and intuitive way to analyze your property data across all dashboard pages. Apply filters once, and see them reflected everywhere.

## 🚀 Quick Start

### Accessing Filters

The filter bar is located at the top of every dashboard page, just below the navigation menu.

![Filter Bar Location](placeholder-for-screenshot)

### Basic Usage

1. **Click** on any filter to open its dropdown
2. **Select** your desired options
3. **Watch** as all metrics update automatically
4. **Navigate** between pages - your filters stay active!

## 📊 Available Filters

### 1. Date Range Filter

**Purpose**: Filter data by specific time periods

**Options**:

- **Quick Presets**:
  - Last 7 Days
  - Last 30 Days
  - This Month
  - Last Month
  - This Quarter
  - This Year
- **Custom Range**: Select any start and end date

**Date Mode**:

- **Check-in Date**: Filter by when guests arrive
- **Check-out Date**: Filter by when guests leave (default)
- **Sale Date**: Filter by when booking was created

**Example Use Cases**:

- Analyze performance for a specific month
- Compare week-over-week trends
- Review holiday season results

### 2. Praça (Location) Filter

**Purpose**: Focus on specific geographic markets

**Type**: Multi-select dropdown

**How to Use**:

1. Click "Praças" filter
2. Check one or more locations
3. Click outside to apply

**Example**:

- Select "São Paulo" + "Rio de Janeiro" to compare these two markets
- Select single praça for detailed market analysis

### 3. Grupo (Group) Filter

**Purpose**: Analyze specific property groups

**Type**: Multi-select dropdown

**How to Use**:

1. Open "Grupos" filter
2. Select desired groups
3. Metrics update automatically

**Example**:

- Compare performance across different property portfolios
- Focus on specific investment groups

### 4. Tipo de Operação (Operation Type)

**Purpose**: Filter by property operation model

**Options**:

- **Short Stay**: Short-term rentals
- **Long Stay**: Long-term rentals
- **Mixed**: Properties with both models

**Example Use Cases**:

- Analyze short-stay performance separately
- Compare long-stay vs short-stay metrics

### 5. Canal (Channel/Partner) Filter

**Purpose**: Analyze performance by booking channel

**Type**: Multi-select dropdown

**Common Channels**:

- Airbnb
- Booking.com
- VRBO
- Direct bookings
- Others

**Example**:

- Compare Airbnb vs Booking.com performance
- Analyze direct booking conversion

### 6. Number of Guests Filter

**Purpose**: Filter by guest capacity

**Type**: Numeric range (min/max)

**How to Use**:

1. Set minimum guests (optional)
2. Set maximum guests (optional)
3. Leave blank for no limit

**Example**:

- Properties for 2-4 guests
- Large group properties (6+ guests)

### 7. Revenue Range Filter

**Purpose**: Filter by booking value

**Type**: Numeric range (R$)

**Example Use Cases**:

- High-value bookings (> R$ 2,000)
- Budget segment (< R$ 500)
- Mid-range analysis

### 8. Antecedência (Lead Time) Filter

**Purpose**: Filter by booking advance time

**Type**: Numeric range (days)

**Example**:

- Last-minute bookings (< 7 days)
- Early planners (> 30 days)
- Optimal booking window analysis

## 🎨 Filter Combinations

### Scenario 1: Market Analysis

**Goal**: Analyze São Paulo short-stay performance in January

**Filters**:

- Date Range: 2026-01-01 to 2026-01-31
- Praça: São Paulo
- Tipo de Operação: Short Stay

**Result**: All metrics show only São Paulo short-stay properties for January

### Scenario 2: Channel Performance

**Goal**: Compare Airbnb vs Booking.com

**Filters**:

- Canal: Airbnb, Booking.com
- Date Range: Last 30 Days

**Result**: Side-by-side channel comparison for recent period

### Scenario 3: High-Value Segment

**Goal**: Analyze premium bookings

**Filters**:

- Revenue: Min R$ 2,000
- Guests: Min 4
- Tipo de Operação: Short Stay

**Result**: Focus on high-value, large-group short stays

## 🔄 Filter Management

### Active Filters Indicator

When filters are active, you'll see:

- **Badge** on filter button showing count
- **Active filter pills** below filter bar
- **Clear All** button to reset

### Clearing Filters

**Clear Individual Filter**:

- Click the filter
- Deselect all options
- Or click "Clear" in dropdown

**Clear All Filters**:

- Click "Clear All Filters" button
- All filters reset to defaults
- All data returns

### Filter Persistence

**Across Pages**:

- Filters automatically apply to all pages
- Navigate freely - filters stay active
- Consistent experience throughout

**Across Sessions**:

- Filters saved in browser storage
- Return to dashboard with filters intact
- Clear browser data to reset

## 📈 Understanding Filtered Results

### Metrics Recalculation

When you apply filters, ALL metrics recalculate:

**Revenue Metrics**:

- Total Revenue
- Average Ticket
- Revenue by Channel
- Revenue Trends

**Operational Metrics**:

- Occupancy Rate
- Average Daily Rate (ADR)
- Nights Sold
- Guest Count

**Performance Metrics**:

- Goal Achievement
- Status Distribution
- Property Rankings

### Empty Results

If no data matches your filters:

- **Empty State** message appears
- **Suggestion** to adjust filters
- **Clear Filters** button available

**Common Causes**:

- Date range too narrow
- Too many restrictive filters
- No data for selected combination

**Solution**:

- Broaden date range
- Remove some filters
- Check filter selections

## 💡 Best Practices

### 1. Start Broad, Then Narrow

```
✅ Good Approach:
1. Select praça
2. Add date range
3. Refine with channel
4. Add revenue range if needed

❌ Avoid:
Starting with too many filters at once
```

### 2. Use Date Presets

```
✅ Quick Analysis:
- Use "Last 30 Days" for recent trends
- Use "This Month" for current performance
- Use "This Quarter" for strategic review

⏱️ Saves Time:
Presets are faster than custom dates
```

### 3. Save Common Combinations

**Frequent Analyses**:

- Document your common filter combinations
- Create a personal reference guide
- Share with team members

**Example**:

```
Weekly Review:
- Date: Last 7 Days
- Praça: All
- Channel: All

Monthly Deep Dive:
- Date: This Month
- Praça: São Paulo
- Type: Short Stay
```

### 4. Verify Results

**Always Check**:

- Total property count makes sense
- Revenue totals are reasonable
- No unexpected empty results

**If Something Looks Wrong**:

1. Check active filters
2. Verify date range
3. Clear and reapply filters
4. Refresh page if needed

## 🎯 Page-Specific Features

### Dashboard (Home)

**Key Metrics Panel**:

- Updates with filtered totals
- Shows comparison to goals
- Reflects selected period

**Charts**:

- Revenue trends for filtered data
- Status distribution changes
- Top properties ranking updates

### Operations Page

**Pace Control**:

- Shows filtered period
- Compares to previous period
- Adjusts for selected properties

**Units Performance**:

- Table filters automatically
- Sorting works on filtered data
- Export includes only filtered results

### Pricing Page

**Pricing Simulator**:

- Uses filtered property data
- Recommendations based on selection
- Market intelligence reflects filters

**Laffer Curves**:

- Generated from filtered data
- Optimal pricing for selection
- Sensitivity analysis updates

### Sales Intelligence

**Sales Funnel**:

- Conversion rates for filtered data
- Channel-specific when filtered
- Period-specific metrics

**Partner Performance**:

- Ranks filtered channels
- Shows selected period only
- Compares within selection

## 🐛 Troubleshooting

### Issue: Filters Not Applying

**Symptoms**:

- Metrics don't change
- No visual feedback

**Solutions**:

1. Refresh the page
2. Clear browser cache
3. Check console for errors
4. Try different browser

### Issue: Unexpected Results

**Symptoms**:

- Numbers seem wrong
- Charts don't match metrics

**Solutions**:

1. Verify all active filters
2. Check date range mode (check-in vs check-out)
3. Clear all filters and reapply
4. Compare with unfiltered data

### Issue: Performance Slow

**Symptoms**:

- Filters take long to apply
- Page feels sluggish

**Solutions**:

1. Reduce number of active filters
2. Use shorter date ranges
3. Clear browser cache
4. Close other browser tabs

### Issue: Empty Results

**Symptoms**:

- "No data" message
- All metrics show zero

**Solutions**:

1. Check if filters are too restrictive
2. Verify date range has data
3. Try removing filters one by one
4. Confirm data is loaded

## 📱 Mobile Usage

### Accessing Filters on Mobile

1. **Tap** the filter icon (☰) in header
2. **Swipe** to scroll through filters
3. **Tap** filter to expand
4. **Select** options
5. **Tap** outside to close

### Mobile-Specific Tips

- **Landscape Mode**: Better for viewing charts with filters
- **Scroll**: Swipe horizontally through filter options
- **Touch**: Tap clearly on filter options
- **Clear**: Use "Clear All" button for quick reset

## 🎓 Advanced Tips

### Tip 1: Comparative Analysis

**Compare Two Periods**:

1. Apply filters for Period 1
2. Note key metrics
3. Change date range to Period 2
4. Compare results

**Example**:

- January 2026 vs January 2025
- Q1 vs Q2 performance

### Tip 2: Segment Discovery

**Find Your Best Segment**:

1. Start with all data
2. Add praça filter - note best performer
3. Add channel filter - note best channel
4. Add revenue range - find sweet spot

**Result**: Discover your highest-performing segment

### Tip 3: Goal Tracking

**Monitor Progress**:

1. Filter to current month
2. Filter to your properties (grupo)
3. Check goal achievement %
4. Track daily/weekly

### Tip 4: Channel Optimization

**Optimize Channel Mix**:

1. Filter by each channel separately
2. Compare ADR, occupancy, revenue
3. Identify best performers
4. Adjust distribution strategy

## 📊 Reporting with Filters

### Creating Reports

**Steps**:

1. Apply desired filters
2. Take screenshots of key metrics
3. Export data (if available)
4. Document filter configuration

**Include in Report**:

- Active filters used
- Date range analyzed
- Key findings
- Recommendations

### Sharing Insights

**With Team**:

- Document filter combination
- Share screenshots
- Explain methodology
- Provide context

**Example Email**:

```
Subject: São Paulo Short-Stay Performance - January 2026

Filters Applied:
- Praça: São Paulo
- Type: Short Stay
- Period: Jan 1-31, 2026

Key Findings:
- Revenue: R$ XXX,XXX
- Occupancy: XX%
- ADR: R$ XXX

[Screenshots attached]
```

## 🎉 Success Stories

### Use Case 1: Identifying Underperformers

**Challenge**: Find properties needing attention

**Solution**:

1. Filter by praça
2. Sort by revenue (low to high)
3. Apply "Last 30 Days"
4. Identify bottom 10%

**Result**: Targeted intervention plan

### Use Case 2: Channel Optimization

**Challenge**: Optimize channel distribution

**Solution**:

1. Filter each channel separately
2. Compare ADR and occupancy
3. Identify best performers
4. Adjust pricing strategy

**Result**: 15% revenue increase

### Use Case 3: Seasonal Planning

**Challenge**: Plan for high season

**Solution**:

1. Filter to previous high season
2. Analyze booking patterns
3. Note lead times
4. Plan pricing strategy

**Result**: Better preparation, higher revenue

## 🆘 Getting Help

### Support Resources

- **Documentation**: `/docs` folder
- **Integration Tests**: `/docs/INTEGRATION_TESTING.md`
- **Data Layer Guide**: `/docs/DATA_LAYER.md`

### Contact

For technical issues or questions:

- Check console for errors
- Review documentation
- Contact development team

## 🔄 Updates & Changelog

### Version 1.0 (Current)

- ✅ All filter types implemented
- ✅ Cross-page persistence
- ✅ Performance optimized
- ✅ Mobile responsive

### Planned Features

- 🔜 Saved filter presets
- 🔜 Filter sharing via URL
- 🔜 Advanced filter combinations
- 🔜 Filter analytics

---

**Last Updated**: January 29, 2026  
**Version**: 1.0  
**Status**: Production Ready
