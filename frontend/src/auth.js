import { api } from "./api";

export async function login(email, password) {
  const res = await api.post("/auth/login", { email, password });
  localStorage.setItem("token", res.data.access_token);
}

export function logout() {
  localStorage.removeItem("token");
}

export async function me() {
  const res = await api.get("/auth/me");
  return res.data;
}
