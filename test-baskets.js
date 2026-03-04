require('dotenv').config({ path: '.env.local' });
fetch('http://localhost:3000/api/baskets').then(r => r.json()).then(data => {
    const internalItems = [];
    data.data.forEach(b => {
        if (!b.basket_items) return;
        b.basket_items.forEach(i => {
            if (i.item_type === 'internal') internalItems.push(i);
        });
    });
    console.log("Internal items sample:");
    console.log(JSON.stringify(internalItems.slice(0, 2), null, 2));
}).catch(console.error);
