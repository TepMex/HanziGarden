// Adapted from the connected-region algorithm in the user-provided Site:
// https://hanzi-living-garden-19.light-owlet-9049.chatgpt.site/ (version 5).
// Fixed 10 + 14 × 15 quotas and a fixed seed preserve game identities.
import { writeFileSync } from 'node:fs';
/* Balanced, connected hex-biome regions. No rendering dependencies. */
(function (root) {
    'use strict';
    const directions = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    function topology(cells) { const index = new Map(cells.map((c, i) => [c.q + ',' + c.r, i])); return cells.map(c => directions.map(([q, r]) => index.get((c.q + q) + ',' + (c.r + r))).filter(i => i !== undefined)); }
    function connected(indices, adj) { if (!indices.length)
        return false; const remaining = new Set(indices), queue = [indices[0]]; remaining.delete(indices[0]); for (let k = 0; k < queue.length; k++)
        for (const n of adj[queue[k]])
            if (remaining.delete(n))
                queue.push(n); return remaining.size === 0; }
    function audit(cells, labels, biomes) { const adj = topology(cells), groups = biomes.map(b => labels.flatMap((v, i) => v === b ? [i] : [])); const counts = groups.map(g => g.length); return { counts, connected: groups.every(g => connected(g, adj)), isolated: labels.flatMap((b, i) => adj[i].some(n => labels[n] === b) ? [] : [i]), balanced: Math.max(...counts) - Math.min(...counts) <= 1, complete: labels.length === cells.length && labels.every(b => biomes.includes(b)) }; }
    function generate(cells, biomes, rng = Math.random) {
        const adj = topology(cells), ids = biomes.slice();
        const quotas = ids.map((_, i) => i === 0 ? 10 : 15);
        if (quotas.some(q => q < 2))
            throw Error('Each biome needs at least two cells.');
        const points = cells.map(c => [Math.sqrt(3) * (c.q + c.r / 2), 1.5 * c.r]);
        function compactness(group) { let x = 0, y = 0; for (const i of group) {
            x += points[i][0];
            y += points[i][1];
        } x /= group.length; y /= group.length; let inertia = 0; for (const i of group)
            inertia += (points[i][0] - x) ** 2 + (points[i][1] - y) ** 2; return inertia / group.length ** 2; }
        function partition(group, sizes) {
            if (sizes.length === 1)
                return [group];
            const half = Math.floor(sizes.length / 2), target = sizes.slice(0, half).reduce((a, b) => a + b, 0), candidates = [], offset = rng() * Math.PI;
            // Exact-size half-plane cuts. Connectivity is checked before recursion.
            for (let k = 0; k < 36; k++) {
                const angle = offset + k * Math.PI / 36, dx = Math.cos(angle), dy = Math.sin(angle), ordered = group.slice().sort((a, b) => (points[a][0] - points[b][0]) * dx + (points[a][1] - points[b][1]) * dy || a - b), left = ordered.slice(0, target), right = ordered.slice(target);
                if (!connected(left, adj) || !connected(right, adj))
                    continue;
                const membership = new Set(left);
                let cut = 0;
                for (const i of right)
                    for (const n of adj[i])
                        if (membership.has(n))
                            cut++;
                candidates.push({ left, right, score: cut + 4 * (compactness(left) + compactness(right)) + rng() * 1.5 });
            }
            candidates.sort((a, b) => a.score - b.score);
            for (const c of candidates.slice(0, 8)) {
                const a = partition(c.left, sizes.slice(0, half));
                if (!a)
                    continue;
                const b = partition(c.right, sizes.slice(half));
                if (b)
                    return [...a, ...b];
            }
            return null;
        }
        let groups = partition(cells.map((_, i) => i), quotas), fallback = false;
        if (!groups) {
            // For the complete hexagonal board, alternating axial rows form a Hamiltonian path.
            // Consecutive quota-sized segments remain connected even if geometric cuts fail.
            fallback = true;
            const rows = [...new Set(cells.map(c => c.r))].sort((a, b) => a - b);
            const path = rows.flatMap((r, k) => cells.map((c, i) => ({ c, i })).filter(v => v.c.r === r).sort((a, b) => (a.c.q - b.c.q) * (k % 2 ? -1 : 1)).map(v => v.i));
            let at = 0;
            groups = quotas.map(n => { const g = path.slice(at, at + n); at += n; return g; });
        }
        const labels = Array(cells.length);
        groups.forEach((g, k) => g.forEach(i => labels[i] = ids[k]));
        // Swap boundary cells without changing quotas; accept only connected regions
        // and non-increasing boundary length. This softens geometric cuts safely.
        for (let step = 0; step < 700; step++) {
            const a = Math.floor(rng() * cells.length), neighbors = adj[a];
            const b = neighbors[Math.floor(rng() * neighbors.length)];
            if (b === undefined || labels[a] === labels[b])
                continue;
            const A = labels[a], B = labels[b];
            let before = 0, after = 0;
            for (const n of adj[a])
                if (n !== b) {
                    before += labels[n] !== A;
                    after += labels[n] !== B;
                }
            for (const n of adj[b])
                if (n !== a) {
                    before += labels[n] !== B;
                    after += labels[n] !== A;
                }
            if (after > before || after === before && rng() > .2)
                continue;
            labels[a] = B;
            labels[b] = A;
            const ga = [], gb = [];
            labels.forEach((v, i) => { if (v === A)
                ga.push(i); if (v === B)
                gb.push(i); });
            if (!connected(ga, adj) || !connected(gb, adj)) {
                labels[a] = A;
                labels[b] = B;
            }
        }
        const result = audit(cells, labels, biomes);
        if (!result.complete || !result.connected || result.isolated.length)
            throw Error('Biome generation invariant failed.');
        return { labels, ...result, fallback };
    }
    root.GardenRegions = { generate, audit };
})(globalThis);
let seed = 0x485a4744;
const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const candidates = [];
for (let q = -9; q <= 9; q++)
    for (let r = -9; r <= 9; r++)
        if (Math.abs(q + r) <= 9)
            candidates.push({ q, r });
candidates.sort((a, b) => (a.q * a.q + a.q * a.r + a.r * a.r) - (b.q * b.q + b.q * b.r + b.r * b.r) || a.r - b.r || a.q - b.q);
const cells = candidates.slice(0, 220).sort((a, b) => a.r - b.r || a.q - b.q);
const result = globalThis.GardenRegions.generate(cells, Array.from({ length: 15 }, (_, i) => i), rng);
let bedIndex = 0;
const layout = [];
for (let biomeIndex = 0; biomeIndex < 15; biomeIndex++)
    cells.forEach((cell, i) => { if (result.labels[i] === biomeIndex)
        layout.push({ ...cell, biomeIndex, bedIndex: bedIndex++ }); });
if (!result.connected || result.isolated.length || layout.length !== 220)
    throw Error('Invalid layout');
writeFileSync(new URL('../src/data/hexGardenLayout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n');
console.log('Generated 220 hexes in 15 connected biomes: ' + result.counts.join(', '));
