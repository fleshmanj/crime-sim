import { useEffect, useState } from "react";
import { me } from "../auth.js";
import { Navigate } from "react-router-dom";

export default function Guard({ children }) {
  const [status, setStatus] = useState("loading"); // loading | ok | no
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return setStatus("no");
    me().then(() => setStatus("ok")).catch(() => setStatus("no"));
  }, []);
  if (status === "loading") return <p>Checking session…</p>;
  if (status === "no") return <Navigate to="/login" replace />;
  return children;
}
