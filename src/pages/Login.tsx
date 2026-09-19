import { FormEvent, useState } from "react";

interface LoginProps {
  onLogin: (token: string) => void;
  onBack?: () => void;
}

export function Login({ onLogin, onBack }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/accounts/users/login_complete/", {
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

  return (
    <div className="login-shell">
      <div className="login-card">
        <img className="login-logo" src="/proyecto90-logo.jpg" alt="Proyecto 90" width="120" height="120" />
        <span className="login-kicker">PROYECTO 90</span>
        <h1>Ingresar a mi perfil</h1>
        {onBack && <button type="button" className="login-back" onClick={onBack} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "12px", marginBottom: "16px", padding: 0 }}>← Volver al inicio</button>}
        <p className="login-sub">Ingresa con tu correo y contraseña para acceder a tu tablero.</p>

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
          {error && <div className="login-error">{error}</div>}
          <button className="primary login-btn" type="submit" disabled={submitting}>
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
