import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiUrl } from "../src/api";

type PublicPlan = {
  plan_id: string;
  display_name: string;
  description: string;
  features: string[];
  price_clp: number | null;
  price_uf: string | null;
  duration_days: number | null;
  highlighted: boolean;
  badge: string | null;
  allow_installments: boolean;
  max_installments: number;
  sort_order: number;
};

type LandingBranch = { id: number; name: string; login_slug?: string };
type PublicBranch = { id: number; business_name: string };

type LandingConfig = {
  group: { slug: string; display_name: string; pricing_note?: string };
  branch: LandingBranch | null;
  plans: PublicPlan[];
};

const DEV_GROUP = "proyecto90";

function pesos(value: number) {
  return value.toLocaleString("es-CL");
}

function formatRut(raw: string) {
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return clean;
  const dv = clean.slice(-1);
  let body = clean.slice(0, -1).slice(0, 8);
  const groups: string[] = [];
  while (body.length > 3) {
    groups.unshift(body.slice(-3));
    body = body.slice(0, -3);
  }
  if (body) groups.unshift(body);
  return `${groups.join(".")}-${dv}`;
}

function errorText(data: unknown) {
  if (!data || typeof data !== "object") return "No se pudo iniciar la suscripción.";
  const record = data as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  const parts: string[] = [];
  for (const value of Object.values(record)) {
    if (typeof value === "string") parts.push(value);
    else if (Array.isArray(value)) parts.push(value.map(String).join(" "));
    else if (value && typeof value === "object") {
      for (const inner of Object.values(value as Record<string, unknown>)) {
        if (typeof inner === "string") parts.push(inner);
        else if (Array.isArray(inner)) parts.push(inner.map(String).join(" "));
      }
    }
  }
  return parts.filter(Boolean).join(" ") || "Revisa los datos e intenta de nuevo.";
}

function landingPath() {
  const params = new URLSearchParams(window.location.search);
  const qs = new URLSearchParams();
  const group = params.get("group");
  const slug = params.get("branch") || params.get("slug");
  if (group) qs.set("group", group);
  else if (slug) qs.set("slug", slug);
  const query = qs.toString();
  return `/api/public/landing-config/${query ? `?${query}` : ""}`;
}

function isLocalHost() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function CheckoutReturn({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="p90-landing enroll-return">
      <section className="p90-final">
        <img src="/proyecto90-logo.jpg" alt="Proyecto 90" />
        <span className="p90-kicker"><i /> Pago</span>
        <h2>Estamos confirmando<br /><em>tu suscripción.</em></h2>
        <p>Si el pago fue aceptado, el acceso llega a tu correo. Entra con el mismo correo y la contraseña que elegiste.</p>
        <div className="p90-actions centered">
          <a className="p90-button" href="#login" onClick={(event) => { event.preventDefault(); onLogin(); }}>Ingresar a mi perfil</a>
          <a className="p90-outline" href="/">Volver al inicio</a>
        </div>
      </section>
    </main>
  );
}

export function Enroll({ onLogin }: { onLogin: () => void }) {
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [planId, setPlanId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [missingDomain, setMissingDomain] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let response = await fetch(apiUrl(landingPath()));
        if (response.status === 404 && isLocalHost() && !new URLSearchParams(window.location.search).get("group")) {
          response = await fetch(apiUrl(`/api/public/landing-config/?group=${DEV_GROUP}`));
        }
        if (!response.ok) {
          if (!cancelled) setMissingDomain(true);
          return;
        }
        const data = (await response.json()) as LandingConfig;
        if (cancelled) return;
        setConfig(data);
        const list = await fetch(apiUrl(`/api/public/${data.group.slug}-client-branches/`));
        const payload = list.ok ? await list.json() as { branches?: PublicBranch[] } : { branches: [] };
        const rows = payload.branches || [];
        if (cancelled) return;
        setBranches(rows);
        const preferred = data.branch && rows.some((row) => row.id === data.branch?.id)
          ? data.branch.id
          : rows[0]?.id ?? data.branch?.id ?? null;
        setBranchId(preferred);
        const highlighted = data.plans.find((plan) => plan.highlighted) || data.plans[0];
        if (highlighted) setPlanId(highlighted.plan_id);
      } catch {
        if (!cancelled) setMissingDomain(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const plans = useMemo(
    () => [...(config?.plans || [])].sort((a, b) => a.sort_order - b.sort_order),
    [config],
  );
  const selected = plans.find((plan) => plan.plan_id === planId) || null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!config || !selected || !branchId) return;
    setError("");
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const installments = selected.allow_installments && selected.max_installments > 1
        ? selected.max_installments
        : 1;
      const response = await fetch(apiUrl(`/api/public/${config.group.slug}-checkout/`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout_type: "branch_client",
          plan_id: selected.plan_id,
          contact_name: name.trim(),
          email: email.trim(),
          branch_id: branchId,
          password,
          password_confirmation: password2,
          dni: rut,
          phone_number: phone.trim(),
          installments_count: installments,
          website,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorText(data));
        return;
      }
      const paymentUrl = typeof data.payment_url === "string" ? data.payment_url : "";
      if (paymentUrl) {
        window.location.assign(paymentUrl.startsWith("http") ? paymentUrl : apiUrl(paymentUrl));
        return;
      }
      if (data.status === "PAID") {
        onLogin();
        return;
      }
      setError("El plan quedó registrado, pero no hay un enlace de pago disponible.");
    } catch {
      setError("No fue posible conectar con Yggdra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="p90-section p90-pricing" id="precios">
      <div className="p90-section-title">
        <span className="p90-kicker"><i /> Inversión</span>
        <h2>Un programa de 90 días.<br /><em>Elige cómo pagarlo.</em></h2>
        <p>Los valores salen de los planes publicados en Yggdra para este dominio o esta sucursal.</p>
      </div>
      {loading && <p className="enroll-status">Cargando planes…</p>}
      {missingDomain && (
        <p className="enroll-status">Este dominio todavía no tiene una sucursal con planes. En Yggdra el dominio del sitio tiene que coincidir con el de la sucursal, o entra con ?branch=proyecto90.</p>
      )}
      {!!plans.length && (
        <div className="price-layout dynamic-pricing">
          {plans.map((plan) => {
            const months = plan.allow_installments && plan.max_installments > 1 ? plan.max_installments : 1;
            const total = plan.price_clp;
            const each = total != null ? Math.floor(total / months) : null;
            const featured = plan.highlighted;
            return (
              <article key={plan.plan_id} className={featured ? "price-featured full-plan" : "installment-plan"}>
                <header>
                  <span>{plan.badge || plan.display_name}</span>
                  <b>{featured ? "RECOMENDADO" : `${months} ${months === 1 ? "PAGO" : "PAGOS"}`}</b>
                </header>
                <div><small>$</small><strong>{each != null ? pesos(each) : "—"}</strong></div>
                <b>{months > 1 && total != null ? `$${pesos(each || 0)} CADA MES · TOTAL $${pesos(total)}` : "PAGO ÚNICO · 90 DÍAS COMPLETOS"}</b>
                <p>{plan.description}</p>
                {!!plan.features?.length && (
                  <ul>{plan.features.map((item) => <li key={item}>{item}</li>)}</ul>
                )}
                <a className={featured ? "p90-button" : "p90-outline"} href="#matricula" onClick={(event) => { event.preventDefault(); setPlanId(plan.plan_id); document.getElementById("matricula")?.scrollIntoView({ behavior: "smooth" }); }}>
                  {featured ? "Elegir pago único" : "Elegir este plan"}
                </a>
              </article>
            );
          })}
        </div>
      )}

      <form className="enroll-form" id="matricula" onSubmit={submit}>
        <span className="p90-kicker"><i /> Suscripción</span>
        <h3>Matricúlate en Proyecto 90</h3>
        <p>Creas tu acceso y pagas el plan. Después entras con este correo y esta contraseña.</p>
        {branches.length > 1 && (
          <label>
            Sucursal
            <select value={branchId ?? ""} onChange={(event) => setBranchId(Number(event.target.value))} required>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.business_name}</option>)}
            </select>
          </label>
        )}
        {selected && <p className="enroll-picked">Plan: <b>{selected.display_name}</b></p>}
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" /></label>
        <label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        <label>RUT<input value={rut} onChange={(event) => setRut(formatRut(event.target.value))} required placeholder="12.345.678-9" inputMode="text" /></label>
        <label>Teléfono<input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
        <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" /></label>
        <label>Repite la contraseña<input type="password" value={password2} onChange={(event) => setPassword2(event.target.value)} required minLength={8} autoComplete="new-password" /></label>
        <label className="enroll-honeypot">Sitio web<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        {error && <div className="login-error">{error}</div>}
        <button className="p90-button" type="submit" disabled={submitting || !selected || !branchId}>
          {submitting ? "Conectando con el pago…" : "Suscribirme"}
        </button>
        <button className="p90-outline enroll-login" type="button" onClick={onLogin}>Ya tengo acceso</button>
      </form>
    </section>
  );
}
