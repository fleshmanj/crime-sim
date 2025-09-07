import { Routes, Route, Link, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Incidents from "./pages/Incidents.jsx";
import IncidentsSearch from "./pages/IncidentsSearch.jsx"; // <-- NEW
import Guard from "./components/Guard.jsx";
import { logout } from "./auth.js";

export default function App() {
  const authed = !!localStorage.getItem("token");
  return (
    <div style={{ fontFamily: "system-ui", padding: 16 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ marginRight: "auto" }}>Crime Info Simulator</h1>
        <Link to="/">Incidents</Link>
        <Link to="/search">Search</Link> {/* NEW */}
        {authed ? (
          <button onClick={() => { logout(); location.href="/login"; }}>
            Logout
          </button>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </header>
      <hr />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Guard><Incidents /></Guard>} />
        <Route path="/search" element={<Guard><IncidentsSearch /></Guard>} /> {/* NEW */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}
