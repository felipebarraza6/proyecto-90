import { useState } from "react";
import {
  formatPublishDate,
  groupContentByCategory,
  type ContentCategory,
  type ContentLike,
} from "./content-library";
import { ContentCategoryIcon, contentCategoryIconLabel } from "./content-icons";

type Row = Record<string, unknown>;

function CategoryCards({
  items,
  onSelect,
}: {
  items: ContentLike[];
  onSelect: (category: ContentCategory) => void;
}) {
  const groups = groupContentByCategory(items);
  return (
    <section className="content-category-grid">
      {groups.map((group) => (
        <button
          key={group.category}
          type="button"
          className="content-category-card"
          onClick={() => onSelect(group.category)}
        >
          <span role="img" aria-label={contentCategoryIconLabel(group.category)}>
            <ContentCategoryIcon category={group.category} />
          </span>
          <span className="eyebrow">{group.category.toUpperCase()}</span>
          <strong>{group.count}</strong>
          <small>{group.count === 1 ? "ítem" : "ítems"}</small>
        </button>
      ))}
    </section>
  );
}

function CategoryToolbar({
  category,
  onBack,
}: {
  category: ContentCategory;
  onBack: () => void;
}) {
  return (
    <div className="content-category-toolbar">
      <button className="secondary" type="button" onClick={onBack}>
        ← Volver a categorías
      </button>
      <h3>{category}</h3>
    </div>
  );
}

function ParticipantItems({
  items,
  openPdfFn,
}: {
  items: ContentLike[];
  openPdfFn: (key: string) => void;
}) {
  if (items.length === 0) {
    return <p className="content-category-empty">Todavía no hay contenido en esta categoría.</p>;
  }
  return (
    <section className="learning-grid">
      {items.map((x) => (
        <article className="learn-card" key={String(x.id)}>
          <span className="learn-cover">{String(x.file_kind || "") === "pdf" ? "PDF" : "▶"}</span>
          <div>
            <span className="content-item-category">
              <span role="img" aria-label={contentCategoryIconLabel(x.category)}>
                <ContentCategoryIcon category={x.category} size={20} />
              </span>
              <span className="tag">{String(x.category)}</span>
            </span>
            <h3>{String(x.title)}</h3>
            <p>{String(x.description || "")}</p>
            {formatPublishDate(x.publish_at) && (
              <small className="content-publish">Publicado el {formatPublishDate(x.publish_at)}</small>
            )}
            {Boolean(x.video_url) && (
              <a href={String(x.video_url)} target="_blank" rel="noreferrer">Ver contenido →</a>
            )}
            {Boolean(x.file_key) && String(x.file_kind || "") === "pdf" && (
              <button className="secondary" type="button" onClick={() => openPdfFn(String(x.file_key))}>
                Abrir PDF
              </button>
            )}
            {Boolean(x.file_key)
              && String(x.file_kind || "") !== "pdf"
              && String(x.file_kind || "") !== "video" && (
              <button className="secondary" type="button" onClick={() => openPdfFn(String(x.file_key))}>
                Abrir archivo
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

function AdminItems({
  items,
  openPdfFn,
}: {
  items: ContentLike[];
  openPdfFn: (key: string) => void;
}) {
  if (items.length === 0) {
    return <p className="content-category-empty">Todavía no hay contenido en esta categoría.</p>;
  }
  return (
    <section className="content-table panel">
      {items.map((x) => (
        <div className="content-row" key={String(x.id)}>
          <span role="img" aria-label={contentCategoryIconLabel(x.category)}>
            <ContentCategoryIcon category={x.category} />
          </span>
          <div>
            <h3>{String(x.title)}</h3>
            <p>{String(x.category)} · {String(x.description || "")}</p>
            {Boolean(x.file_key || x.file_kind) && (
              <p className="content-file-meta">
                {String(x.file_kind || "archivo")}
                {x.file_key ? " · archivo cargado" : ""}
              </p>
            )}
            {formatPublishDate(x.publish_at) && (
              <small className="content-publish">Publicado el {formatPublishDate(x.publish_at)}</small>
            )}
          </div>
          {Boolean(x.video_url) && (
            <a href={String(x.video_url)} target="_blank" rel="noreferrer">Ver video ↗</a>
          )}
          {Boolean(x.file_key) && String(x.file_kind || "") === "pdf" && (
            <button className="secondary" type="button" onClick={() => openPdfFn(String(x.file_key))}>
              Abrir PDF
            </button>
          )}
          <span className="status publicado">Publicado</span>
        </div>
      ))}
    </section>
  );
}

export function ParticipantContentLibrary({
  items,
  openPdfFn,
}: {
  items: Row[];
  openPdfFn: (key: string) => void;
}) {
  const [selected, setSelected] = useState<ContentCategory | null>(null);
  const groups = groupContentByCategory(items);
  const active = selected ? groups.find((g) => g.category === selected) : null;

  if (selected && active) {
    return (
      <>
        <CategoryToolbar category={selected} onBack={() => setSelected(null)} />
        <ParticipantItems items={active.items} openPdfFn={openPdfFn} />
      </>
    );
  }

  return <CategoryCards items={items} onSelect={setSelected} />;
}

export function AdminContentLibrary({
  items,
  openPdfFn,
}: {
  items: Row[];
  openPdfFn: (key: string) => void;
}) {
  const [selected, setSelected] = useState<ContentCategory | null>(null);
  const groups = groupContentByCategory(items);
  const active = selected ? groups.find((g) => g.category === selected) : null;

  if (selected && active) {
    return (
      <>
        <CategoryToolbar category={selected} onBack={() => setSelected(null)} />
        <AdminItems items={active.items} openPdfFn={openPdfFn} />
      </>
    );
  }

  return <CategoryCards items={items} onSelect={setSelected} />;
}
