# Hanzi Writer: mistake detection available to Hanzi Garden

Research date: 2026-08-26. The installed dependency is Hanzi Writer 3.7.3
(`node_modules/hanzi-writer/package.json`, locked in `bun.lock`).

## Primary sources

- [Hanzi Writer documentation](https://hanziwriter.org/docs.html)
- [Hanzi Writer stroke matcher source](https://github.com/chanind/hanzi-writer/blob/master/src/strokeMatches.ts)
- [Hanzi Writer quiz source](https://github.com/chanind/hanzi-writer/blob/master/src/Quiz.ts)
- [Hanzi Writer data repository](https://github.com/chanind/hanzi-writer-data)
- [Make Me a Hanzi data source](https://github.com/skishore/makemeahanzi)

The published 3.7.3 package includes the TypeScript source in
`dist/index.esm.js.map`; this was used to verify the exact matcher shipped in
the project rather than relying only on prose documentation.

## What Hanzi Writer checks internally

For the expected stroke, `strokeMatches.ts` checks:

1. average distance from user points to reference median points;
2. distance from the user's start and end to the reference start and end;
3. direction, using average best cosine similarity between segment vectors;
4. translation/scale-normalized curve shape, using discrete Fréchet distance
   with rotations from -π/16 through +π/16;
5. a minimum user/reference length ratio.

In 3.7.3 the default constants include a 250-unit start/end tolerance, a 0.4
normalized Fréchet threshold, and a 0.35 minimum-length threshold, all affected
where applicable by `leniency`. There is no corresponding maximum-length test.

If the normal match fails, the matcher retries with the user points reversed.
That produces `isStrokeBackwards`. If the expected stroke initially matches,
Hanzi Writer also checks later strokes and tightens leniency when one is a
closer match. This is an internal ambiguity/order safeguard, not a public
mistake category.

## What the public quiz callback exposes

`onMistake` and `onCorrectStroke` receive:

- `strokeNum`;
- `drawnPath.points` and `drawnPath.pathString`;
- `isBackwards`;
- mistake counts and remaining-stroke counts.

The callback does **not** expose which internal predicate failed, its distances,
or which later stroke was a better candidate. Consequently:

- `wrong-direction` can use a direct Hanzi Writer signal (`isBackwards`), with
  an app-side geometry guard;
- `wrong-order` is necessarily an app-side inference from the drawn path and
  later medians;
- length, placement, contact, and hook errors also need app-side classifiers.

The character JSON supplies only `strokes` (filled SVG paths), `medians`
(ordered center-line points), and optional `radStrokes`. It has no stroke-name,
hook, or contact annotations.

## Candidate explanations

### `wrong-position` — high confidence

Fit the user path to the expected median twice: once in absolute character
coordinates and once after allowing translation only. Report wrong position
when direction and length are plausible, the translated fit is good, the
absolute fit is bad, and the required translation exceeds a scale-aware
threshold. Do not allow free scaling, because that would confuse position with
length.

This directly covers a correctly shaped stroke drawn too far from its canonical
place. It should outrank a secondary `extra-contact` caused by the displacement.

### `too-short` — high confidence for clean partial matches

Project the ordered user path onto the expected median. Report too short when
the path follows one continuous, direction-correct subcurve with low lateral
error but covers too little canonical arc and has a low length ratio. Requiring
monotonic progress prevents a small scribble near the stroke from qualifying.

If the omitted suffix is an annotated hook, prefer `missing-hook`. If the
stroke stops immediately before a required contact, `missing-contact` is the
more actionable explanation.

### `too-long` — medium-to-high confidence

Find a well-fitting core that covers nearly all of the expected median, then
measure leading/trailing overflow. Report too long only when the core is good,
progress is monotonic, and the overflow is both absolutely and relatively
large. Retracing or loops should remain `bad-shape`, not `too-long`.

Hanzi Writer itself has no maximum-length predicate, so this is entirely an
app-side explanation and may not run if Hanzi Writer accepts the gesture.

### `missing-contact` / `extra-contact` — high confidence with a contact map

Precompute canonical contact relationships between stroke pairs from the
filled SVG `strokes`, not only from medians. For a rejected current stroke,
compare its centerline (expanded by drawing radius) with already completed
canonical stroke outlines.

Use two thresholds with an ambiguity band: one for definite contact and one
for definite separation. Suppress feedback in the band. Only contacts with
earlier strokes are observable at the moment a stroke is drawn; a relationship
to a future stroke should be judged when that future stroke is attempted.

These labels are accurate relative to the supplied font geometry, but the data
does not state pedagogical “must touch” semantics. Ambiguous near-contacts need
manual overrides or suppression.

### `missing-hook` — medium confidence from inference, high with annotation

There is no hook label in Hanzi Writer data. A generic heuristic can look for a
short final median segment with a persistent sharp turn, then check whether the
user followed the shaft but stopped at the turn or continued without the final
segment. This can confuse hooks with bends, sweeps, and noisy/sparse medians.

For production-quality feedback, add per-stroke metadata such as hook start
progress (or a stroke-type label), generated and reviewed for the game's actual
character set. With this metadata, absence of the terminal subcurve becomes a
strong rule and should outrank `too-short`.

## Recommended rollout

1. Add `wrong-position`, `too-short`, and `too-long` first.
2. Add a precomputed SVG-based contact map, then `missing-contact` and
   `extra-contact` with an ambiguity band.
3. Add `missing-hook` only after introducing reviewed hook metadata or
   validating the inference against a labeled corpus of real attempts.

Keep Hanzi Writer authoritative for accept/reject. These categories should
explain an `onMistake`, not change stroke correctness. If the product must
reject subtle errors that Hanzi Writer currently accepts, that requires a
separate architectural change because the public API does not provide a custom
stroke-matcher hook or an error-code callback.

When several explanations score highly, show one primary cause. Useful
specificity rules are: `missing-hook` over `too-short`, `missing-contact` over
`too-short` when the omitted tail should reach another stroke, and
`wrong-position` over displacement-induced `extra-contact`.
