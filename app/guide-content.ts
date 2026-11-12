export type Row = Record<string, unknown>;

export type GuideNode = {
  type: string;
  level?: number;
  text?: string;
  name?: string;
  prescription?: string;
  headers?: string[];
  rows?: Array<{ cells: string[]; exerciseName?: string }>;
  __i?: number;
};

export type Guide = {
  programId?: string;
  title: string;
  overview: GuideNode[];
  days: Array<{ title: string; nodes: GuideNode[] }>;
  reference: GuideNode[];
};

export function parseGuideContent(row?: Row): Guide | null {
  if (!row) return null;
  try {
    const parsed = JSON.parse(String(row.content_json || "")) as Partial<Guide> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      programId: parsed.programId,
      title: String(parsed.title || ""),
      overview: Array.isArray(parsed.overview) ? parsed.overview : [],
      days: Array.isArray(parsed.days) ? parsed.days : [],
      reference: Array.isArray(parsed.reference) ? parsed.reference : [],
    };
  } catch {
    return null;
  }
}

function hasNodes(nodes?: GuideNode[]): boolean {
  return Array.isArray(nodes) && nodes.length > 0;
}

export function isRenderableGuide(row?: Row): boolean {
  const guide = parseGuideContent(row);
  if (!guide) return false;
  return (
    hasNodes(guide.overview) ||
    guide.days.some((day) => hasNodes(day && day.nodes)) ||
    hasNodes(guide.reference)
  );
}
