export const CONTENT_CATEGORIES = [
  "Hábitos",
  "Nutrición",
  "Entrenamiento",
  "Sesiones",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export type ContentLike = {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  description?: unknown;
  file_key?: unknown;
  file_kind?: unknown;
  video_url?: unknown;
  [key: string]: unknown;
};

export type ContentCategoryGroup = {
  category: ContentCategory;
  count: number;
  items: ContentLike[];
};

export function normalizeContentCategory(raw: unknown): ContentCategory {
  const value = String(raw ?? "").trim();
  const match = CONTENT_CATEGORIES.find((category) => category === value);
  return match ?? "Hábitos";
}

export function groupContentByCategory(items: ContentLike[]): ContentCategoryGroup[] {
  const buckets: Record<ContentCategory, ContentLike[]> = {
    Hábitos: [],
    Nutrición: [],
    Entrenamiento: [],
    Sesiones: [],
  };
  for (const item of items) {
    buckets[normalizeContentCategory(item.category)].push(item);
  }
  return CONTENT_CATEGORIES.map((category) => ({
    category,
    count: buckets[category].length,
    items: buckets[category],
  }));
}

export function buildParticipantContentItems(
  library: ContentLike[],
  guidePdfKey: string | null | undefined,
): ContentLike[] {
  const key = String(guidePdfKey || "");
  if (!key) return library;
  if (library.some((item) => String(item.file_key || "") === key)) return library;
  return [
    {
      id: "nutrition-guide",
      title: "Guía nutricional",
      description: "PDF de tu plan nutricional personalizado.",
      category: "Nutrición",
      file_key: key,
      file_kind: "pdf",
    },
    ...library,
  ];
}
