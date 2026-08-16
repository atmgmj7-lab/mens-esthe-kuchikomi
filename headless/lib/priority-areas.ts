export const PRIORITY_AREAS = [
  { slug: "sakai", name: "堺・堺東" },
  { slug: "shinosaka", name: "新大阪" },
  { slug: "umeda", name: "梅田" },
  { slug: "sakaisujihonmachi", name: "堺筋本町" },
  { slug: "nihonbashi", name: "大阪日本橋" },
] as const;

export type PriorityArea = (typeof PRIORITY_AREAS)[number];
