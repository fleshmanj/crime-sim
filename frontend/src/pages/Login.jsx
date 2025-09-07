import { useState } from "react";
import { login } from "../auth.js";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("analyst@example.com");
  const [password, setPassword] = useState("password123");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      nav("/");
    } catch {
      setErr("Invalid credentials");
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 360, marginTop: 24 }}>
      <h2>Login</h2>
      <label>Email</label>
      <input value={email} onChange={(e)=>setEmail(e.target.value)} required style={{ width: "100%" }}/>
      <label>Password</label>
      <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required style={{ width: "100%" }}/>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <button type="submit" style={{ marginTop: 12 }}>Sign in</button>
      <p style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>
        Demo creds are prefilled.
      </p>
    </form>
  );
}
