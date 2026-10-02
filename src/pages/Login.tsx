import { FormEvent, useState } from "react";
import { apiUrl } from "../api";

// login_slug de la sucursal Proyecto 90 (id 33). Su custom_domain es
// 90dias.habitofirme.app, así que el enlace del correo vuelve a este sitio.
const P90_LOGIN_SLUG = "proyecto90";

const FORGOT_OK_MESSAGE =
  "Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña. Revisa tu bandeja de entrada (y spam). El enlace vence en 24 horas.";

interface LoginProps {
  onLogin: (token: string) => void;
  onBack?: () => void;
  notice?: string;
}

export function Login({ onLogin, onBack, notice }: LoginProps) {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(notice || "");
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: "login" | "forgot") {
    setMode(next);
    setError("");
    setInfo("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/accounts/users/login_complete/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "Credenciales inválidas");
        return;
      }
      const branch = Array.isArray(data.branches)
        ? data.branches.find((b: { is_active?: boolean }) => b.is_active !== false) || data.branches[0]
        : null;
      if (branch?.branch_id) localStorage.setItem("p90_branch", String(branch.branch_id));
      onLogin(data.token);
    } catch {
      setError("No fue posible conectar con el servidor");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/accounts/users/forgot_password/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, login_slug: P90_LOGIN_SLUG }),
      });
      if (res.status === 429) {
        setError("Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.");
        return;
      }
      if (res.status >= 500) {
        setError("No pudimos enviar el correo en este momento. Intenta nuevamente en unos minutos.");
        return;
      }
      // Respuesta genérica: no revelamos si el correo existe.
      setInfo(FORGOT_OK_MESSAGE);
    } catch {
      setError("No fue posible conectar con el servidor");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <img className="login-logo" src="/proyecto90-logo.jpg" alt="Proyecto 90" width="120" height="120" />
        <span className="login-kicker">PROYECTO 90</span>
        <h1>{mode === "login" ? "Ingresar a mi perfil" : "Recuperar contraseña"}</h1>
        {onBack && <button type="button" className="login-back" onClick={onBack} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "12px", marginBottom: "16px", padding: 0 }}>← Volver al inicio</button>}
        <p className="login-sub">
          {mode === "login"
            ? "Ingresa con tu correo y contraseña para acceder a tu tablero."
            : "Escribe el correo con el que entras a Proyecto 90 y te enviaremos un enlace para crear una nueva contraseña."}
        </p>

        {mode === "login" ? (
          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@correo.cl"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>
            {info && <div className="login-notice" role="status">{info}</div>}
            {error && <div className="login-error">{error}</div>}
            <button className="primary login-btn" type="submit" disabled={submitting}>
              {submitting ? "Entrando…" : "Entrar"}
            </button>
            <button type="button" className="login-link" onClick={() => switchMode("forgot")}>
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="login-form">
            <label>
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@correo.cl"
              />
            </label>
            {info && <div className="login-notice" role="status">{info}</div>}
            {error && <div className="login-error">{error}</div>}
            <button className="primary login-btn" type="submit" disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar enlace"}
            </button>
            <button type="button" className="login-link" onClick={() => switchMode("login")}>
              ← Volver a ingresar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
