async function run() {
    const res = await fetch("http://localhost:3000/api/competitors?lat=-7.1195&lon=-34.8450&radius=10&guests=1&startDate=2026-01-01&endDate=2026-12-31&includeStats=true");
    const json = await res.json();
    const data = json.data;
    const stats = json.stats;

    let unmatchedIds = new Set();
    stats.forEach(point => {
        Object.keys(point).forEach(k => {
            if (k.startsWith('listing_')) {
                const id = k.replace('listing_', '');
                const found = data.find(c => (c.id_numerica && c.id_numerica.toString() === id) || (c.id && c.id.toString() === id));
                if (!found) {
                    unmatchedIds.add(id);
                }
            }
        });
    });
    console.log("Unmatched IDs count:", unmatchedIds.size);
    if(unmatchedIds.size > 0) {
        console.log("Samples:", Array.from(unmatchedIds).slice(0, 3));
    }
}
run().catch(console.error);
