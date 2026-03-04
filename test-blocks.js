function getSampleBlocks(startDate, days) {
    const blocks = [];

    // Helper to calc Easter
    function calcEaster(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month, day);
    }

    const limit = new Date(startDate);
    limit.setDate(limit.getDate() + days);

    // Pre-calculate holidays for current, next and prev years
    const years = [startDate.getFullYear() - 1, startDate.getFullYear(), startDate.getFullYear() + 1, startDate.getFullYear() + 2];
    const holidays = [];

    years.forEach(y => {
        const easter = calcEaster(y);

        // Semana Santa (Sexta)
        const ss = new Date(easter);
        ss.setDate(easter.getDate() - 2);
        holidays.push({ dateStr: ss.toISOString().substring(0, 10), nights: 3, type: 'semana_santa' });

        // Carnaval (Sábado, 50 dias antes)
        const carv = new Date(easter);
        carv.setDate(easter.getDate() - 50);
        holidays.push({ dateStr: carv.toISOString().substring(0, 10), nights: 4, type: 'carnaval' });

        // Reveillon (28/12)
        const rev = new Date(y, 11, 28);
        holidays.push({ dateStr: rev.toISOString().substring(0, 10), nights: 5, type: 'reveillon' });
    });

    let current = new Date(startDate);
    while (current <= limit) {
        const curStr = current.toISOString().substring(0, 10);

        const hol = holidays.find(h => h.dateStr === curStr);
        if (hol) {
            blocks.push({
                startDate: new Date(current),
                nights: hol.nights,
                type: hol.type
            });
            current.setDate(current.getDate() + hol.nights);
            continue;
        }

        // Weekend check (Friday = 5)
        if (current.getDay() === 5) {
            blocks.push({
                startDate: new Date(current),
                nights: 2, // Fri, Sat
                type: 'weekend'
            });
            current.setDate(current.getDate() + 2);
            continue;
        }

        current.setDate(current.getDate() + 1);
    }

    return blocks;
}

const blocks = getSampleBlocks(new Date('2026-03-01'), 365);
console.log(blocks.filter(b => b.type !== 'weekend'));
console.log("Total weekend blocks:", blocks.filter(b => b.type === 'weekend').length);
