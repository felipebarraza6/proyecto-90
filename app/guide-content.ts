export type Row = Record<string, unknown>;

export type GuideNode = {
  type: string;
  level?: number;
  text?: string;
  name?: string;
  prescription?: string;
  headers?: string[];
  rows?: Array<{ cells: string[]; exerciseName?: string }>;
  ordered?: boolean;
  items?: string[];
  indicationId?: string;
  __i?: number;
};

/** Misma marca que la vista del alumno: estas frases del calentamiento no son ejercicios. */
export const WARMUP_INSTRUCTION = /(:$|cada ejercicio|cada uno|vueltas?|minutos? continuos)/i;

const FIXED_TYPES = new Set(["table", "exercise", "exerciseHeading"]);

export function headingLevel(node: GuideNode): number {
  const value = Number(node.level || 2);
  if (!Number.isFinite(value)) return 2;
  return Math.min(6, Math.max(1, Math.trunc(value)));
}

export function isBlockHeading(node: GuideNode): boolean {
  return node.type === "heading" && headingLevel(node) <= 2;
}

/**
 * Texto que el editor muestra y que el backend compara en `expected`.
 * Un salto sigue en el párrafo; una línea en blanco separa párrafos.
 */
export function editorText(nodes: GuideNode[] | undefined): string {
  const parts: string[] = [];
  const paragraphLines: string[] = [];
  const flush = () => {
    if (paragraphLines.length) {
      parts.push(paragraphLines.join("\n"));
      paragraphLines.length = 0;
    }
  };
  for (const node of nodes || []) {
    if (!node || FIXED_TYPES.has(node.type)) continue;
    if (node.type === "heading") {
      flush();
      parts.push(`${"#".repeat(headingLevel(node))} ${node.text || ""}`.trimEnd());
      continue;
    }
    if (node.type === "list") {
      flush();
      const items = (node.items || []).map((item) => String(item)).filter((item) => item.trim());
      if (node.ordered) parts.push(items.map((item, index) => `${index + 1}. ${item}`).join("\n"));
      else parts.push(items.map((item) => `- ${item}`).join("\n"));
      continue;
    }
    const text = String(node.text || "");
    if (!text.trim()) continue;
    if (text.split("\n").length > 1) {
      flush();
      parts.push(text);
    } else paragraphLines.push(text);
  }
  flush();
  return parts.filter((part) => part.trim()).join("\n\n");
}

export function listPresentation(node: GuideNode): { ordered: boolean; items: string[] } | null {
  if (node.type !== "list") return null;
  const fromItems = (node.items || []).map((item) => String(item)).filter((item) => item.trim());
  if (fromItems.length) return { ordered: Boolean(node.ordered), items: fromItems };
  const fromText = String(node.text || "")
    .split("\n")
    .map((line) => line.replace(/^(\d+\.\s+|[-*•]\s+)/, "").trim())
    .filter(Boolean);
  if (!fromText.length) return null;
  return { ordered: Boolean(node.ordered), items: fromText };
}

export function splitBlocks(nodes: GuideNode[]): { preamble: GuideNode[]; blocks: GuideNode[][] } {
  const preamble: GuideNode[] = [];
  const blocks: GuideNode[][] = [];
  let current: GuideNode[] | null = null;
  for (const node of nodes) {
    if (isBlockHeading(node)) {
      if (current) blocks.push(current);
      current = [node];
    } else if (!current) preamble.push(node);
    else current.push(node);
  }
  if (current) blocks.push(current);
  return { preamble, blocks };
}

export function indicationGroups(nodes: GuideNode[]): GuideNode[][] {
  const groups: GuideNode[][] = [];
  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index];
    const indicationId = node?.indicationId;
    if (!indicationId) {
      groups.push([node]);
      index += 1;
      continue;
    }
    const group = [node];
    index += 1;
    while (index < nodes.length && nodes[index]?.indicationId === indicationId) {
      group.push(nodes[index]);
      index += 1;
    }
    groups.push(group);
  }
  return groups;
}

export type DayIndication = { index: number; nodes: GuideNode[]; text: string };

export type DayExercise = {
  locator: string;
  name: string;
  prescription: string;
  nodeIndex: number;
  rowIndex: number | null;
  movable: boolean;
};

export type DayNote = { nodeIndex: number; text: string; kind: "paragraph" | "heading" };

export type DayBlock = { index: number; title: string; exercises: DayExercise[]; notes: DayNote[] };

export function dayStructure(nodes: GuideNode[] | undefined): { indications: DayIndication[]; blocks: DayBlock[] } {
  const list = nodes || [];
  const { preamble, blocks } = splitBlocks(list);
  return {
    indications: indicationGroups(preamble).map((group, index) => ({ index, nodes: group, text: editorText(group) })),
    blocks: blocks.map((block, index) => describeBlock(block, list, index)),
  };
}

function describeBlock(block: GuideNode[], dayNodes: GuideNode[], index: number): DayBlock {
  const title = block[0]?.type === "heading" ? String(block[0].text || "") : `Bloque ${index + 1}`;
  const warmup = /calentamiento/i.test(title);
  const exercises: DayExercise[] = [];
  const notes: DayNote[] = [];
  let seenTable = false;
  block.forEach((node, offset) => {
    if (offset === 0 && node.type === "heading") return;
    const nodeIndex = dayNodes.indexOf(node);
    if (node.type === "table" && Array.isArray(node.rows)) {
      const movable = !seenTable;
      seenTable = true;
      node.rows.forEach((row, rowIndex) => {
        exercises.push({
          locator: `row:${nodeIndex}:${rowIndex}`,
          name: String(row.exerciseName || "").trim() || cleanCellName(row.cells?.[0] || ""),
          prescription: String(row.cells?.[1] || ""),
          nodeIndex,
          rowIndex,
          movable,
        });
      });
      return;
    }
    if ((node.type === "exercise" || node.type === "exerciseHeading") && node.name) {
      exercises.push({
        locator: `node:${nodeIndex}`,
        name: String(node.name),
        prescription: String(node.prescription || ""),
        nodeIndex,
        rowIndex: null,
        movable: false,
      });
      return;
    }
    if (node.type === "paragraph" && warmup && node.text && !WARMUP_INSTRUCTION.test(node.text)) {
      exercises.push({
        locator: `node:${nodeIndex}`,
        name: String(node.text),
        prescription: String(node.prescription || ""),
        nodeIndex,
        rowIndex: null,
        movable: false,
      });
      return;
    }
    if ((node.type === "paragraph" || node.type === "heading") && node.text) {
      notes.push({ nodeIndex, text: String(node.text), kind: node.type });
    }
  });
  return { index, title, exercises, notes };
}

function cleanCellName(value: string) {
  return value.replace(/^\d+[.)]\s*/, "").replace(/[.]$/, "").trim();
}

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
