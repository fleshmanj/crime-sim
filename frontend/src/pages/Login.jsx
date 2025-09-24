import { useEffect, useState } from "react";
import { login } from "../auth.js";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
  const nav = useNavigate();

  // preload last used email if present
  const [email, setEmail] = useState(() => localStorage.getItem("lastEmail") || "analyst@example.com");
  const [password, setPassword] = useState("password123");
  const [err, setErr] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [caps, setCaps] = useState(false);

  useEffect(() => {
    // focus email on mount
    const el = document.getElementById("email");
    if (el) el.focus();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      localStorage.setItem("lastEmail", email);
      nav("/ncic");
    } catch (e) {
      setErr("Invalid credentials. Try the demo accounts below or contact your instructor.");
    } finally {
      setLoading(false);
    }
  }

  function quickFill(role) {
    if (role === "analyst") {
      setEmail("analyst@example.com");
      setPassword("password123");
    } else if (role === "admin") {
      setEmail("admin@example.com");
      setPassword("AdminPass!123");
    }
    setErr("");
  }

  return (
    <div className="login-page">
      {/* top banner */}
      <div className="edu-banner" role="note" aria-label="Educational simulator notice">
        <strong>Educational Simulator</strong> – No real data. Access is logged.
      </div>

      <div className="login-card" role="form" aria-labelledby="loginTitle">
        {/* header / logo */}
        <div className="login-header">
          <div className="logo-dot" aria-hidden="true" />
          <div>
            <h1 id="loginTitle">Crime Info Simulator</h1>
            <p className="muted">Sign in to continue</p>
          </div>
        </div>

        {/* demo role quick-fill */}
        <div className="quickfill">
          <button type="button" className="chip" onClick={() => quickFill("analyst")} aria-label="Use analyst demo account">
            Analyst demo
          </button>
          <button type="button" className="chip" onClick={() => quickFill("admin")} aria-label="Use admin demo account">
            Admin demo
          </button>
        </div>

        {/* form */}
        <form onSubmit={onSubmit} className="form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            value={email}
            inputMode="email"
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />

          <div className="pw-row">
            <label htmlFor="password">Password</label>
            <button
              type="button"
              className="link"
              onClick={() => setShowPw((s) => !s)}
              aria-pressed={showPw}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          <input
            id="password"
            type={showPw ? "text" : "password"}
            value={password}
            autoComplete="current-password"
            onKeyUp={(e) => setCaps(e.getModifierState && e.getModifierState("CapsLock"))}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          {caps && <p className="caps">Caps Lock is ON</p>}
          {err && <p className="error" role="alert">{err}</p>}

          <button type="submit" className="primary" disabled={loading} aria-busy={loading}>
            {loading ? <span className="spinner" aria-hidden="true" /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="hint">Use the demo chips above to autofill credentials.</p>
        </form>

        <footer className="foot">
          <p className="tiny">
            By continuing, you agree to classroom policies. Report issues to your instructor.
          </p>
        </footer>
      </div>
    </div>
  );
}
