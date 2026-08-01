// Tag vocabulary, per place kind. Each tag maps to a field the research
// generator already emits — baby_friendly, gluten_free, high_chair,
// duration_minutes, price_band — so a tag is a testable claim about the
// dataset rather than a mood. Slugs are stored; labels are presentation and
// can be reworded without invalidating a season of ratings.
export const TAGS = Object.freeze({
  attraction: Object.freeze([
    { value: "baby-great", label: "Great with the baby" },
    { value: "too-crowded", label: "Too crowded" },
    { value: "worth-money", label: "Worth the money" },
    { value: "ran-long", label: "Took much longer" },
    { value: "too-far", label: "Too far to get to" },
    { value: "better-than-expected", label: "Better than expected" },
    { value: "wrong-age-range", label: "Wrong age range" },
    { value: "do-again", label: "Do it again" },
  ]),
  playground: Object.freeze([
    { value: "safe-toddler-area", label: "Safe toddler area" },
    { value: "unsafe-for-crawler", label: "Unsafe for a crawler" },
    { value: "big-kids-dominated", label: "Dominated by big kids" },
    { value: "has-shade", label: "Shade in the sun" },
    { value: "no-toilet-nearby", label: "No toilet nearby" },
    { value: "too-small", label: "Too small" },
    { value: "held-them-hour", label: "Held them for an hour+" },
    { value: "do-again", label: "Do it again" },
  ]),
  restaurant: Object.freeze([
    { value: "gf-reliable", label: "Gluten-free was reliable" },
    { value: "gf-claim-wrong", label: "GF claim was wrong" },
    { value: "high-chair", label: "High chair available" },
    { value: "good-kids-menu", label: "Good kids' menu" },
    { value: "too-slow", label: "Too slow with children" },
    { value: "overpriced", label: "Overpriced" },
    { value: "pram-friendly", label: "Pram fitted easily" },
    { value: "do-again", label: "Do it again" },
  ]),
});

export const tagsForKind = (kind) => TAGS[kind] ?? [];

const LABELS = new Map(Object.values(TAGS).flat().map((tag) => [tag.value, tag.label]));

// A slug retired from the vocabulary still has ratings attached to it in the
// store. Showing the raw slug is ugly; showing nothing would be a lie.
export const tagLabel = (value) => LABELS.get(value) ?? value;
