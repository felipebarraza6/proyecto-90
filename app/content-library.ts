export const CONTENT_CATEGORIES = [
  "Hábitos",
  "Nutrición",
  "Entrenamiento",
  "Sesiones",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

const CONTENT_CATEGORY_ICON_LABELS: Record<ContentCategory, string> = {
  Hábitos: "Lectura",
  Nutrición: "Nutrición",
  Entrenamiento: "Entrenamiento",
  Sesiones: "Sesiones",
};

/** Nombre accesible del ícono de una categoría de contenido. */
export function contentCategoryIconLabel(category: unknown): string {
  const value = String(category ?? "").trim();
  const match = CONTENT_CATEGORIES.find((candidate) => candidate === value);
  return match ? CONTENT_CATEGORY_ICON_LABELS[match] : "Contenido";
}

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

/** Fecha de publicación ISO 8601 en formato «12 nov 2026». Vacía si no es válida. */
export function formatPublishDate(value: unknown): string {
  if (value == null || value === "") return "";
  const text = value instanceof Date ? value.toISOString() : String(value).trim();
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
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
