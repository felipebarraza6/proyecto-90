import { useEffect, useState } from "react";
import { apiUrl } from "../src/api";
import {
  formatDueDate,
  formatPesosClp,
  interpretInstallmentPayload,
  isFromFlow,
  loadInstallmentView,
  type InstallmentView,
} from "./pay-installment";

type Props = {
  installmentId: string;
  onLogin: () => void;
};

export function PayInstallmentPage({ installmentId, onLogin }: Props) {
  const [view, setView] = useState<InstallmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setConfirming(false);
      try {
        const result = await loadInstallmentView({
          fromFlow: isFromFlow(window.location.search),
          onConfirming: () => {
            if (cancelled) return;
            setConfirming(true);
            setLoading(false);
          },
          fetchView: async () => {
            try {
              const response = await fetch(
                apiUrl(`/api/public/checkout/pay-installment/${encodeURIComponent(installmentId)}/`),
              );
              const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
              return interpretInstallmentPayload(response.status, data);
            } catch {
              return { kind: "error", message: "No fue posible conectar con Yggdra." };
            }
          },
        });
        if (cancelled) return;
        setView(result);
      } catch {
        if (!cancelled) {
          setView({ kind: "error", message: "No fue posible conectar con Yggdra." });
        }
      } finally {
        if (!cancelled) {
          setConfirming(false);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [installmentId]);

  function goPay() {
    if (!view || view.kind !== "ready") return;
    setPaying(true);
    const url = view.payment_url;
    window.location.assign(url.startsWith("http") ? url : apiUrl(url));
  }

  return (
    <main className="p90-landing enroll-return">
      <section className="p90-final pay-installment-card">
        <img src="/proyecto90-logo.jpg" alt="Proyecto 90" />
        <span className="p90-kicker"><i /> Cuota</span>
        {loading && <p className="enroll-status">Cargando tu cuota…</p>}
        {confirming && <p className="enroll-status">Confirmando tu pago...</p>}
        {!loading && !confirming && view?.kind === "invalid" && (
          <>
            <h2>No encontramos<br /><em>esta cuota.</em></h2>
            <p>{view.message || "El enlace no es válido o ya no está disponible."}</p>
          </>
        )}
        {!loading && !confirming && view?.kind === "already_paid" && (
          <>
            <h2>Esta cuota<br /><em>ya está pagada.</em></h2>
            <p>
              {view.message || "No necesitas hacer nada más."}
              {view.number != null && view.total_installments != null
                ? ` (cuota ${view.number} de ${view.total_installments})`
                : ""}
            </p>
          </>
        )}
        {!loading && !confirming && view?.kind === "awaiting_confirmation" && (
          <>
            <h2>Estamos confirmando<br /><em>tu pago.</em></h2>
            <p>{view.message || "Tu pago se confirmará en unos minutos."}</p>
          </>
        )}
        {!loading && !confirming && view?.kind === "error" && (
          <>
            <h2>No pudimos<br /><em>preparar el pago.</em></h2>
            <p>{view.message || "Intenta de nuevo en unos minutos."}</p>
          </>
        )}
        {!loading && !confirming && view?.kind === "ready" && (
          <>
            <h2>Paga tu<br /><em>cuota pendiente.</em></h2>
            <p>
              {view.business_name
                ? `Suscripción de ${view.business_name}.`
                : "Te redirigimos a Flow para completar el pago. No se genera un cobro hasta que confirmes allí."}
            </p>
            <dl className="pay-installment-summary">
              <div>
                <dt>Cuota</dt>
                <dd>{view.number} de {view.total_installments}</dd>
              </div>
              <div>
                <dt>Monto</dt>
                <dd>${formatPesosClp(view.amount_clp)}</dd>
              </div>
              <div>
                <dt>Vencimiento</dt>
                <dd>{formatDueDate(view.due_date)}</dd>
              </div>
            </dl>
            <div className="p90-actions centered">
              <button className="p90-button" type="button" disabled={paying} onClick={goPay}>
                {paying ? "Redirigiendo a Flow…" : "Pagar en Flow"}
              </button>
              <a className="p90-outline" href="/">Volver al inicio</a>
            </div>
          </>
        )}
        {!loading && !confirming && view?.kind !== "ready" && (
          <div className="p90-actions centered">
            <a
              className="p90-button"
              href="#login"
              onClick={(event) => {
                event.preventDefault();
                onLogin();
              }}
            >
              Ingresar a mi perfil
            </a>
            <a className="p90-outline" href="/">Volver al inicio</a>
          </div>
        )}
      </section>
    </main>
  );
}
