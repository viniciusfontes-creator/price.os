# IA Market Scanner Logic

This document preserves the logic and implementation details of the "IA Market Scanner" feature from the Correlations page, as requested for future applications.

## Core Logic: Competitor Scoring

The scanner uses a `calculateMatchScore` function to rank potential competitors against a target property.

```typescript
const calculateMatchScore = (property: Property, competitor: Competitor) => {
    let score = 85; // Base score
    const propRooms = parseInt(property.quantidade_quartos) || 1;
    const compGuests = competitor.hospedes_adultos || 2;

    // Logical room estimation (guests/2)
    const estimatedCompRooms = Math.ceil(compGuests / 2);

    // Penalize room mismatch
    if (propRooms !== estimatedCompRooms) {
        score -= Math.abs(propRooms - estimatedCompRooms) * 15;
    }

    // Rating bonus/penalty
    if (competitor.media_avaliacao && competitor.media_avaliacao !== 'N/A') {
        const rating = parseFloat(competitor.media_avaliacao);
        if (rating >= 4.8) score += 10;
        else if (rating < 4.5) score -= 10;
    }

    // Distance penalty (if available) - we assume they are within radius
    if (competitor.dist_km) {
        score -= competitor.dist_km * 2;
    }

    return Math.max(5, Math.min(98, score));
};
```

## Data Fetching

The scanner fetches competitors based on geospatial proximity using the `/api/competitors` endpoint.

```typescript
// Load Suggestions based on coordinates
if (selectedProperty?.latitude && selectedProperty?.longitude) {
    setSearching(true);
    try {
        const params = new URLSearchParams({
            lat: selectedProperty.latitude.toString(),
            lon: selectedProperty.longitude.toString(),
            radius: '5',
            limit: '20'
        });
        const res = await fetch(`/api/competitors?${params.toString()}`);
        const result = await res.json();
        if (result.success && selectedProperty) {
            const scored = result.data.map((c: Competitor) => ({
                ...c,
                matchScore: calculateMatchScore(selectedProperty!, c)
            })).sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));
            setSuggestions(scored);
        }
    } catch (err) {
        console.error(err);
    } finally {
        setSearching(false);
    }
}
```

## UI Component (Visual Card)

The UI displayed competitors as cards with a "Match Score".

```tsx
<Card key={c.id} className="group overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 ring-1 ring-border/50 hover:ring-primary/40 bg-card">
    <CardContent className="p-0">
        <div className="relative h-2 bg-gradient-to-r from-primary to-primary/20 opacity-40 group-hover:opacity-100 transition-opacity" />
        <div className="p-5 space-y-4">
            <div className="flex justify-between items-start">
                <div className="space-y-1 max-w-[70%]">
                    <h4 className="font-bold text-sm truncate" title={c.nome_anuncio}>{c.nome_anuncio}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">{c.tipo_propriedade}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <Badge className={`${(c.matchScore || 0) > 80 ? 'bg-green-500/10 text-green-600' : 'bg-primary/5 text-primary'} border-none text-[10px] font-black h-5`}>
                        {c.matchScore}% MATCH
                    </Badge>
                </div>
            </div>
            {/* ... Actions like "Vincular" ... */}
        </div>
    </CardContent>
</Card>
```
