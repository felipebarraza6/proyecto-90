import { CONTENT_CATEGORIES } from "./content-library";

export { contentCategoryIconLabel } from "./content-library";

/**
 * Ícono de la categoría de contenido. Los SVG son decorativos: el nombre
 * accesible se expone con `contentCategoryIconLabel` en el contenedor.
 */
export function ContentCategoryIcon({
  category,
  size = 22,
}: {
  category: unknown;
  size?: number;
}) {
  const known = CONTENT_CATEGORIES.find(
    (candidate) => candidate === String(category ?? "").trim(),
  );

  return (
    <svg
      className="content-category-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {known === "Hábitos" && (
        <>
          <path d="M3.5 5.5c2.8-1 5.6-1 8.5.6v12.4c-2.9-1.6-5.7-1.6-8.5-.6V5.5Z" />
          <path d="M12 6.1c2.9-1.6 5.7-1.6 8.5-.6v12.4c-2.8-1-5.6-1-8.5.6V6.1Z" />
        </>
      )}
      {known === "Nutrición" && (
        <>
          <circle cx="12" cy="12" r="6.5" />
          <path d="M4 3v5.5a2 2 0 0 0 4 0V3M6 8.5V21" />
          <path d="M20 3c-1.4 1.8-2 3.7-2 5.6 0 1.7.7 3 2 3.6V21" />
        </>
      )}
      {known === "Entrenamiento" && (
        <>
          <circle cx="15" cy="5" r="2" />
          <path d="M15 7l-2.5 5.5" />
          <path d="M13 9.5l-4 1" />
          <path d="M13 12.5l-2.5 6M13 12.5l3 6" />
          <path d="M4 11h5M5.5 9v4M8 9v4" />
        </>
      )}
      {known === "Sesiones" && (
        <>
          <rect x="3.5" y="5" width="17" height="11" rx="1.5" />
          <path d="M2 19h20" />
          <path d="M9 19l.7-3M15 19l-.7-3" />
        </>
      )}
      {!known && (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
