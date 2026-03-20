async function run() {
    const start = Date.now();
    const res = await fetch("http://localhost:3000/api/competitors?lat=-7.1195&lon=-34.8450&radius=10&guests=1&startDate=2026-01-01&endDate=2026-12-31&includeStats=true");
    const json = await res.json();
    const data = json.data;
    const end = Date.now();
    console.log("Time exactly:", end - start, "ms");
    console.log("Data length:", data ? data.length : 0);
}
run().catch(console.error);
