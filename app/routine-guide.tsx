"use client";

import { useEffect, useMemo, useState } from "react";
import { isBlockHeading, listPresentation, parseGuideContent, WARMUP_INSTRUCTION, type GuideNode } from "./guide-content";

type Row = Record<string, unknown>;
type GuideTab = { key: string; label: string; title?: string; nodes: GuideNode[] };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function dayTitle(value: string, index: number) {
  const detail = value.includes("—") ? value.split("—").slice(1).join("—").trim() : value;
  return `DÍA ${index + 1}${detail ? ` — ${detail}` : ""}`;
}
function neutralSchedule(value: string) {
  return value.replace(/lunes\s+a\s+jueves/gi, "4 días por semana").replace(/lunes\s+a\s+viernes/gi, "5 días por semana");
}
function restFirst(nodes: GuideNode[]) {
  if (!nodes.some((node) => node.type === "heading" && /calentamiento/i.test(node.text || ""))) return nodes;
  const arranged: GuideNode[] = [];
  for (let index = 0; index < nodes.length;) {
    const heading = nodes[index];
    if (heading.type !== "heading") { arranged.push(heading); index += 1; continue; }
    let end = index + 1;
    while (end < nodes.length && nodes[end].type !== "heading") end += 1;
    const body = nodes.slice(index + 1, end);
    if (/calentamiento/i.test(heading.text || "")) arranged.push(heading, ...body);
    else {
      const rests = body.filter((item) => item.type === "paragraph" && /^descanso/i.test(item.text || ""));
      arranged.push(heading, ...rests, ...body.filter((item) => !rests.includes(item)));
    }
    index = end;
  }
  return arranged;
}

export function RoutineGuide({ guideRow, exercises, admin = false, openExercise, initialDayIndex, onDayIndexChange }: { guideRow: Row; exercises: Row[]; admin?: boolean; openExercise?: (row: Row) => void; act?: (payload: Row) => Promise<unknown>; initialDayIndex?: number; onDayIndexChange?: (index: number) => void }) {
  const guide = useMemo(() => parseGuideContent(guideRow), [guideRow]);
  const tabs: GuideTab[] = guide ? [
    { key: "overview", label: "Guía general", nodes: guide.overview },
    ...guide.days.map((day, index) => ({ key: `day-${index}`, label: `Día ${index + 1}`, title: dayTitle(day.title, index), nodes: day.nodes })),
    ...(guide.reference.length ? [{ key: "reference", label: "Progresión", title: "Progresión, intensidad y referencias", nodes: guide.reference }] : []),
  ] : [];
  const preferred = initialDayIndex != null && Number.isFinite(initialDayIndex) ? `day-${initialDayIndex}` : undefined;
  const [active, setActive] = useState(tabs.find((item) => item.key === preferred)?.key || tabs.find((item) => item.key.startsWith("day-"))?.key || tabs[0]?.key || "");
  useEffect(() => { if (preferred) setActive(preferred); }, [preferred]);
  const tab = tabs.find((item) => item.key === active) || tabs.find((item) => item.key === preferred) || tabs.find((item) => item.key.startsWith("day-")) || tabs[0];
  const exerciseMap = useMemo(() => new Map(exercises.map((item) => [normalize(String(item.name)), item])), [exercises]);
  if (!guide || !tab) return null;
  const videoAction = (name: string) => {
    const exercise = exerciseMap.get(normalize(name));
    if (admin) return <button type="button" className="technique admin" onClick={() => openExercise?.(exercise || { name })}>{exercise?.youtube_url ? "Editar video" : "＋ Agregar técnica"}</button>;
    return exercise?.youtube_url ? <a className="technique ready" href={String(exercise.youtube_url)} target="_blank" rel="noreferrer">Ver técnica ▶</a> : <span className="technique pending">Técnica próximamente</span>;
  };
  return (
    <section className="routine-guide">
      <header className="routine-guide-head">
        <div>
          <span className="eyebrow">RUTINA DEFINITIVA · PROYECTO 90</span>
          <h1>{guide.title}</h1>
          <p>Selecciona el día y revisa la sesión completa antes de comenzar.</p>
        </div>
        <div className="guide-count"><strong>{guide.days.length}</strong><span>días por semana</span></div>
      </header>
      <nav className="routine-day-tabs" aria-label="Días de entrenamiento">
        {tabs.map((item) => (
          <button type="button" key={item.key} className={item.key === tab.key ? "active" : ""} onClick={() => { setActive(item.key); if (item.key.startsWith("day-")) onDayIndexChange?.(Number(item.key.slice(4))); }}>{item.label}</button>
        ))}
      </nav>
      <article className="routine-document">
        <div className="routine-document-title">
          <span>{tab.key === "overview" ? "ANTES DE COMENZAR" : tab.key === "reference" ? "PARA PROGRESAR" : "SESIÓN DEL DÍA"}</span>
          <h2>{tab.title || guide.title}</h2>
        </div>
        <GuideNodes key={tab.key} nodes={tab.nodes} videoAction={videoAction} />
      </article>
    </section>
  );
}

function GuideNodes({ nodes: sourceNodes, videoAction }: { nodes: GuideNode[]; videoAction: (name: string) => React.ReactNode }) {
  const nodes = restFirst(sourceNodes);
  const rendered: React.ReactNode[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.type === "heading" && /calentamiento/i.test(node.text || "") && isBlockHeading(node)) {
      const slice: GuideNode[] = [];
      let cursor = index + 1;
      while (cursor < nodes.length && !isBlockHeading(nodes[cursor])) { slice.push(nodes[cursor]); cursor += 1; }
      rendered.push(<WarmupBlock key={`warmup-${index}`} heading={node} nodes={slice} videoAction={videoAction} />);
      index = cursor - 1;
      continue;
    }
    rendered.push(<PlainNode key={`node-${index}`} node={node} videoAction={videoAction} index={index} />);
  }
  return <div className="guide-nodes">{rendered}</div>;
}

function WarmupBlock({ heading, nodes, videoAction }: { heading: GuideNode; nodes: GuideNode[]; videoAction: (name: string) => React.ReactNode }) {
  let duration = "30 s";
  for (const item of nodes) {
    const seconds = (item.text || "").match(/(\d+)\s*seg/i);
    if (seconds) duration = `${seconds[1]} s`;
  }
  const pieces: React.ReactNode[] = [];
  const pending: GuideNode[] = [];
  const flush = (key: string) => {
    if (!pending.length) return;
    const rows = pending.map((item, position) => {
      const name = (item.name || item.text || "").replace(/[.]$/, "");
      return { cells: [`${position + 1}. ${name}`, item.prescription || duration], exerciseName: name };
    });
    pieces.push(<GuideTable key={key} node={{ type: "table", headers: ["Ejercicio", "Tiempo"], rows }} videoAction={videoAction} />);
    pending.length = 0;
  };
  nodes.forEach((item, itemIndex) => {
    const instruction = item.type === "paragraph" && WARMUP_INSTRUCTION.test(item.text || "");
    const exerciseLike = !instruction && (item.type === "paragraph" || item.type === "exercise") && Boolean(item.name || item.text);
    if (exerciseLike) pending.push(item);
    else {
      flush(`warmup-table-${itemIndex}`);
      pieces.push(<PlainNode key={`warmup-extra-${itemIndex}`} node={item} videoAction={videoAction} />);
    }
  });
  flush("warmup-table-end");
  return (
    <section className="warmup-block">
      <div className="warmup-block-head">
        <div><span className="eyebrow">BLOQUE</span><h3>Calentamiento</h3></div>
        <small>{heading.text?.replace(/calentamiento\s*[—:-]?\s*/i, "") || ""}</small>
      </div>
      {pieces}
    </section>
  );
}

function PlainNode({ node, videoAction, index = 0 }: { node: GuideNode; videoAction: (name: string) => React.ReactNode; index?: number }) {
  if (node.type === "heading") {
    const Tag = node.level === 1 ? "h2" : node.level === 2 ? "h3" : "h4";
    const className = node.level === 1 ? "guide-h1" : node.level === 2 ? "guide-h2" : "guide-h3";
    return <Tag className={className}>{node.text}</Tag>;
  }
  if (node.type === "exerciseHeading") {
    return <div className="guide-exercise-heading"><div><span className="exercise-dot">{index + 1}</span><h3>{node.name}</h3></div>{videoAction(node.name || "")}</div>;
  }
  if (node.type === "exercise") {
    return <div className="guide-exercise"><div><b>{node.name}</b><span>{node.prescription}</span></div>{videoAction(node.name || "")}</div>;
  }
  if (node.type === "table") return <GuideTable node={node} videoAction={videoAction} />;
  const list = listPresentation(node);
  if (list) {
    const Tag = list.ordered ? "ol" : "ul";
    return <Tag className={list.ordered ? "guide-list ordered" : "guide-list"}>{list.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{neutralSchedule(item)}</li>)}</Tag>;
  }
  const important = /^(duración:|frecuencia:|nivel:|objetivo:|descanso:|recuperación:|metodología:|la prioridad|priorizar:|buscar:)/i.test(node.text || "");
  return <p className={important ? "guide-note guide-copy" : "guide-copy"}>{neutralSchedule(node.text || "")}</p>;
}

function GuideTable({ node, videoAction }: { node: GuideNode; videoAction: (name: string) => React.ReactNode }) {
  const hasExercises = node.rows?.some((row) => row.exerciseName);
  return (
    <div className="guide-table-wrap">
      <table className="guide-table">
        <thead><tr>{node.headers?.map((header, index) => <th key={header || index}>{header}</th>)}{hasExercises && <th>Técnica</th>}</tr></thead>
        <tbody>
          {node.rows?.map((row, index) => (
            <tr key={`${row.exerciseName || "row"}-${index}`}>
              {row.cells.map((cell, cellIndex) => <td key={cellIndex} data-label={node.headers?.[cellIndex] || ""}>{cell}</td>)}
              {hasExercises && <td data-label="Técnica">{row.exerciseName ? videoAction(row.exerciseName) : null}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
