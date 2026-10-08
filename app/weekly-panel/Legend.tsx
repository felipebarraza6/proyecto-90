export function PanelLegend({
  greenGt,
  yellowGte,
}: {
  greenGt: number;
  yellowGte: number;
}) {
  return (
    <div className="wp-legend" aria-label="Leyenda">
      <p>
        <span className="wp-dot green" /> Semáforo: &gt; {greenGt} verde · {yellowGte}–
        {greenGt} inclusive amarillo · &lt; {yellowGte} rojo
      </p>
      <p>
        <span className="wp-dot" /> Estados: No iniciado · Día futuro · Hoy · Sin reportar ·
        Cumplió · No cumplió
      </p>
    </div>
  );
}
