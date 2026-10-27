const PAY_PREFIX = "/checkout/pay-installment";

export type InstallmentView =
  | {
      kind: "ready";
      id: string;
      number: number;
      total_installments: number;
      amount_clp: number;
      due_date: string;
      status: string;
      payment_url: string;
      business_name?: string;
    }
  | {
      kind: "already_paid";
      number?: number;
      total_installments?: number;
      message?: string;
      paid_at?: string | null;
    }
  | { kind: "invalid"; message?: string }
  | { kind: "error"; message?: string }
  | { kind: "awaiting_confirmation"; message?: string };

export const FLOW_CONFIRM_INTERVAL_MS = 2000;
export const FLOW_CONFIRM_MAX_MS = 20000;

export function isFromFlow(search: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(query).get("from") === "flow";
}

export function awaitingConfirmationView(): InstallmentView {
  return {
    kind: "awaiting_confirmation",
    message: "Tu pago se confirmará en unos minutos.",
  };
}

type LoadInstallmentOptions = {
  fetchView: () => Promise<InstallmentView>;
  fromFlow: boolean;
  intervalMs?: number;
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onConfirming?: () => void;
};

export async function loadInstallmentView(
  options: LoadInstallmentOptions,
): Promise<InstallmentView> {
  const intervalMs = options.intervalMs ?? FLOW_CONFIRM_INTERVAL_MS;
  const maxMs = options.maxMs ?? FLOW_CONFIRM_MAX_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;

  const first = await options.fetchView();
  if (!options.fromFlow || first.kind !== "ready") return first;

  options.onConfirming?.();
  const started = now();
  while (now() - started < maxMs) {
    await sleep(intervalMs);
    const next = await options.fetchView();
    if (next.kind === "already_paid") return next;
  }
  return awaitingConfirmationView();
}

export function installmentIdFromPath(pathname: string): string | null {
  if (pathname !== PAY_PREFIX && !pathname.startsWith(`${PAY_PREFIX}/`)) return null;
  const raw = pathname.slice(PAY_PREFIX.length).replace(/^\/+|\/+$/g, "");
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function formatPesosClp(value: number): string {
  return value.toLocaleString("es-CL");
}

export function formatDueDate(iso: string): string {
  const day = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return iso || "—";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function interpretInstallmentPayload(
  status: number,
  data: Record<string, unknown> | null | undefined,
): InstallmentView {
  if (status === 404 || status === 400) {
    return {
      kind: "invalid",
      message: typeof data?.detail === "string" ? data.detail : "No encontramos esta cuota.",
    };
  }
  if (status < 200 || status >= 300 || !data) {
    return {
      kind: "error",
      message: typeof data?.detail === "string" ? data.detail : "No se pudo cargar la cuota.",
    };
  }

  const installmentStatus = String(data.status || "");
  if (installmentStatus === "PAID") {
    return {
      kind: "already_paid",
      number: typeof data.number === "number" ? data.number : undefined,
      total_installments:
        typeof data.total_installments === "number" ? data.total_installments : undefined,
      message: typeof data.message === "string" ? data.message : "Esta cuota ya se encuentra pagada.",
      paid_at: typeof data.paid_at === "string" ? data.paid_at : null,
    };
  }

  const paymentUrl = typeof data.payment_url === "string" ? data.payment_url : "";
  if (!paymentUrl) {
    return {
      kind: "error",
      message: "La cuota está registrada, pero no hay un enlace de pago disponible.",
    };
  }

  return {
    kind: "ready",
    id: String(data.id || ""),
    number: Number(data.number || 0),
    total_installments: Number(data.total_installments || 0),
    amount_clp: Number(data.amount_clp || 0),
    due_date: String(data.due_date || ""),
    status: installmentStatus,
    payment_url: paymentUrl,
    business_name: typeof data.business_name === "string" ? data.business_name : undefined,
  };
}
