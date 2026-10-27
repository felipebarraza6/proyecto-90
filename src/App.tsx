import { useEffect, useState } from "react";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { Landing } from "../app/landing";
import { CheckoutReturn } from "../app/enroll";
import { PayInstallmentPage } from "../app/pay-installment-page";
import { installmentIdFromPath } from "../app/pay-installment";
import { FunctionalApp } from "../app/functional-app";
import { apiUrl } from "./api";

type ViewerRole = "admin" | "professional" | "participant" | "reviewer";
type Viewer = { id: string; role: ViewerRole; name: string; email: string; status: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- el contrato lo comparte functional-app
type AppInitialData = any;

const TOKEN_KEY = "p90_token";
const RESET_PREFIX = "/reset-password";

// Enlace del correo de recuperación: /reset-password/<token>.
function resetTokenFromPath(pathname: string): string | null {
  if (pathname !== RESET_PREFIX && !pathname.startsWith(`${RESET_PREFIX}/`)) return null;
  const raw = pathname.slice(RESET_PREFIX.length).replace(/^\/+|\/+$/g, "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      "X-Branch-ID": localStorage.getItem("p90_branch") || "",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<unknown>(null);
  const [page, setPage] = useState<"landing" | "login">("landing");
  const [resetToken, setResetToken] = useState<string | null>(() => resetTokenFromPath(window.location.pathname));
  const [installmentId, setInstallmentId] = useState<string | null>(() => installmentIdFromPath(window.location.pathname));
  const [loginNotice, setLoginNotice] = useState("");

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        // El bootstrap de la app define el viewer (rol) según la sucursal activa.
        const data = await apiFetch<{ viewer: Record<string, unknown> }>("/api/app", token);
        const user = data.viewer;
        const viewerObj: Viewer = {
          id: String(user.id),
          role: user.role as Viewer["role"],
          name: String(user.name || user.full_name || user.email),
          email: String(user.email),
          status: String(user.status || "active"),
        };
        setViewer(viewerObj);
        setInitialData(data);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  function handleLogin(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setLoading(true);
  }

  async function handleLogout() {
    try {
      await fetch(apiUrl("/api/accounts/users/logout/"), {
        method: "POST",
        headers: { Authorization: `Token ${token ?? ""}` },
      });
    } catch { /* best effort */ }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("p90_branch");
    setToken(null);
    setViewer(null);
    setInitialData(null);
    setPage("landing");
  }

  function leaveReset(message: string) {
    window.history.replaceState({}, "", "/");
    setResetToken(null);
    setLoginNotice(message);
    setPage("login");
    if (message) {
      // El reset invalida las sesiones en el backend: volver al login limpio.
      setToken(null);
      setViewer(null);
      setInitialData(null);
      setLoading(false);
    }
  }

  if (resetToken !== null) {
    return <ResetPassword token={resetToken} onDone={leaveReset} onCancel={() => leaveReset("")} />;
  }

  if (installmentId !== null) {
    return (
      <PayInstallmentPage
        installmentId={installmentId}
        onLogin={() => {
          window.history.replaceState({}, "", "/");
          setInstallmentId(null);
          setPage("login");
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="app-loading">
        <img className="brand-wordmark loading-logo" src="/proyecto90-logo.jpg" alt="Proyecto 90" width="384" height="384" />
        <p>Preparando tu Proyecto 90…</p>
      </div>
    );
  }

  if (!token || !viewer) {
    if (page === "login") {
      return <Login notice={loginNotice} onLogin={handleLogin} onBack={() => { setLoginNotice(""); setPage("landing"); }} />;
    }
    if (window.location.pathname.startsWith("/checkout/result")) {
      return <CheckoutReturn onLogin={() => { window.history.replaceState({}, "", "/"); setPage("login"); }} />;
    }
    return <Landing onLogin={() => setPage("login")} />;
  }

  return (
    <FunctionalApp
      initialViewer={viewer}
      initialData={initialData as AppInitialData}
      onLogout={handleLogout}
    />
  );
}
