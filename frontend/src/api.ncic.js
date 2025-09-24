// frontend/src/api.ncic.js
// Self-contained NCIC API client (doesn't touch your existing api.js)
const API_BASE = ""; // same-origin; nginx proxies /api -> backend

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    ""
  );
}

async function http(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}\n${txt}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const ncicApi = {
  createRecord: (payload) => http("/api/records", { method: "POST", body: payload }),
  searchRecords: (params) => {
    const qs = new URLSearchParams(params);
    return http(`/api/records?${qs.toString()}`);
  },
  getRecord: (id) => http(`/api/records/${encodeURIComponent(id)}`),
};
