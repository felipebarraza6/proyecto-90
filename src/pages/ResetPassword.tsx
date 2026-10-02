import { FormEvent, useState } from "react";
import { apiUrl } from "../api";

interface ResetPasswordProps {
  token: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}

type ApiError = Record<string, unknown>;

function firstMessage(data: ApiError | null): string {
  if (!data) return "";
  for (const key of ["error", "detail", "non_field_errors", "new_password", "confirm_password", "token"]) {
    const value = data[key];
    if (typeof value === "string" && value) return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return "";
}

export function ResetPassword({ token, onDone, onCancel }: ResetPasswordProps) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState(token ? "" : "El enlace de recuperación no es válido. Solicita uno nuevo desde «¿Olvidaste tu contraseña?».");
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/accounts/users/reset_password_confirm/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password, confirm_password: password2 }),
      });
      const data = (await res.json().catch(() => null)) as ApiError | null;
      if (!res.ok) {
        const message = firstMessage(data);
        const expired = typeof data?.error === "string" && /token|enlace|expirad/i.test(data.error);
        if (expired) setLinkInvalid(true);
        setError(
          expired
            ? `${message} Solicita un nuevo enlace desde «¿Olvidaste tu contraseña?».`
            : message || "No pudimos actualizar tu contraseña. Intenta nuevamente.",
        );
        return;
      }
      // El backend invalida todas las sesiones: limpiamos las locales también.
      localStorage.removeItem("p90_token");
      localStorage.removeItem("p90_branch");
      onDone("Tu contraseña fue actualizada. Ingresa con tu correo y la nueva contraseña.");
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
        <h1>Crear nueva contraseña</h1>
        <p className="login-sub">Elige una contraseña nueva de al menos 8 caracteres para acceder a tu tablero.</p>

        <form onSubmit={handleSubmit} className="login-form">
          {!linkInvalid && (
            <>
              <label>
                Nueva contraseña
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </label>
              <label>
                Repite la contraseña
                <input
                  type="password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </label>
            </>
          )}
          {error && <div className="login-error">{error}</div>}
          {linkInvalid ? (
            <button className="primary login-btn" type="button" onClick={onCancel}>
              Ir a ingresar
            </button>
          ) : (
            <button className="primary login-btn" type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar contraseña"}
            </button>
          )}
          {!linkInvalid && (
            <button type="button" className="login-link" onClick={onCancel}>
              ← Volver a ingresar
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
