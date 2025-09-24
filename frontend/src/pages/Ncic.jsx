// frontend/src/pages/Ncic.jsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import "./Ncic.css";

/** Keep in sync with backend/app/services/descriptors.py */
const FILE_TYPES = [
  "WANTED_PERSON","FOREIGN_FUGITIVE","MISSING_PERSON","UNIDENTIFIED_PERSON",
  "STOLEN_VEHICLE","STOLEN_LICENSE_PLATE","STOLEN_BOAT","STOLEN_GUN",
  "STOLEN_ARTICLE","SECURITY","USSS_PROTECTIVE","VIOLENT_CRIMINAL_GANG_MEMBER",
  "TERRORIST_MEMBER","BATF_VIOLENT_FELON","WITSEC_CHARGED","INTERSTATE_ID_INDEX",
];

const INDEX_KEYS = {
  WANTED_PERSON: ["NAME","DOB","FBI_NUMBER","SSN","DRIVERS_NUMBER","MISC_ID","PLATE","VIN","ORIGINATING_CASE_NUMBER","WARRANT_NUMBER"],
  FOREIGN_FUGITIVE: ["NAME","DOB","COUNTRY"],
  MISSING_PERSON: ["NAME","DOB"],
  UNIDENTIFIED_PERSON: ["SEX","RACE"],
  STOLEN_VEHICLE: ["VIN","OAN","PLATE"],
  STOLEN_LICENSE_PLATE: ["PLATE"],
  STOLEN_BOAT: ["HULL_NUMBER","REGISTRATION","OAN"],
  STOLEN_GUN: ["SERIAL","MAKE","MODEL"],
  STOLEN_ARTICLE: ["SERIAL","OAN"],
  SECURITY: ["SERIAL","OWNER_SSN","ISSUER"],
  VIOLENT_CRIMINAL_GANG_MEMBER: ["NAME","DOB"],
  TERRORIST_MEMBER: ["NAME","DOB"],
};

const MAX_ALL = 20000; // hard ceiling for "Show all"

function prettyDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function badgeClass(status) {
  if (!status) return "badge";
  const s = String(status).toUpperCase();
  if (s === "ACTIVE") return "badge open";
  if (s === "CLEARED" || s === "CLOSED") return "badge closed";
  return "badge referred";
}
function headline(r) {
  const p = r.payload || {};
  switch (r.file_type) {
    case "WANTED_PERSON": return p.name || "(unknown subject)";
    case "MISSING_PERSON": return p.name || "(missing person)";
    case "STOLEN_VEHICLE": return p.plate || p.vin || "(vehicle)";
    case "STOLEN_GUN": return p.serial || "(firearm)";
    case "STOLEN_LICENSE_PLATE": return p.plate || "(plate)";
    case "STOLEN_ARTICLE": return p.serial || p.oan || "(article)";
    default: return p.name || p.serial || p.vin || p.plate || r.file_type;
  }
}

// ---- API helpers ----
async function fetchPage(params = {}) {
  const res = await api.get("/records", { params });
  // backend returns { items, limit, offset, returned, has_more }
  return res.data || { items: [] };
}

async function fetchAll(params, pageSize = 1000) {
  let offset = 0;
  const seen = new Set();
  const all = [];
  // loop until no more
  // relies on backend offset support (added in the patch above)
  // if offset gets ignored for some reason, duplicate detection stops runaway loops
  for (;;) {
    const { items = [] } = await fetchPage({ ...params, limit: pageSize, offset });
    let added = 0;
    for (const r of items) {
      if (!seen.has(r.id)) { seen.add(r.id); all.push(r); added++; }
    }
    if (items.length < pageSize || !added || all.length >= MAX_ALL) break;
    offset += items.length;
  }
  return all;
}

export default function Ncic() {
  // filters
  const [fileType, setFileType] = useState("WANTED_PERSON");
  const [filters, setFilters] = useState({});

  // UI paging (client) + server params
  const [pageSize, setPageSize] = useState(250);
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [stamp, setStamp] = useState(0);

  const keys = INDEX_KEYS[fileType] || [];

  // Build base query params (without limit/offset)
  const baseParams = useMemo(() => {
    const p = { file_type: fileType };
    for (const [k, v] of Object.entries(filters)) {
      if (v && String(v).trim()) p[k] = v.trim();
    }
    return p;
  }, [fileType, filters]);

  const qKey = useMemo(
    () => ["ncic", baseParams, { page, pageSize, showAll }, stamp],
    [baseParams, page, pageSize, showAll, stamp]
  );

  const { data = [], isFetching, refetch } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      if (showAll) {
        return await fetchAll(baseParams, Math.min(pageSize, 1000));
      }
      const { items } = await fetchPage({ ...baseParams, limit: pageSize, offset: page * pageSize });
      return items;
    },
    keepPreviousData: true,
  });

  // Client-side slice (in case server returns bigger chunks or showAll)
  const total = data.length;
  const startIdx = page * pageSize;
  const endIdx = Math.min(total, startIdx + pageSize);
  const pageRows = showAll ? data.slice(startIdx, endIdx) : data;

  const canPrev = page > 0;
  const canNext = endIdx < total;

  function setF(k, v) { setFilters((s) => ({ ...s, [k]: v })); }
  function clearFilters() {
    setFilters({});
    setPage(0);
    setStamp((s) => s + 1);
  }
  function doSearch() {
    setPage(0);
    setStamp((s) => s + 1);
    refetch();
  }

  const chips = Object.entries(filters)
    .filter(([_,v]) => v && String(v).trim())
    .map(([k,v]) => ({ k, v: String(v).trim() }));

  return (
    <div className="search-page">
      {/* FILTER BAR */}
      <section className="filter-bar">
        <div className="fb-head">
          <h2>NCIC Search</h2>
          <div className="fb-actions">
            <button className="ghost" onClick={clearFilters}>Clear</button>
            <button className="primary" onClick={doSearch} disabled={isFetching}>
              {isFetching ? "Searching…" : "Search"}
            </button>
          </div>
        </div>

        <div className="fb-grid">
          <div className="fb-field span-2">
            <label>File Type</label>
            <select
              value={fileType}
              onChange={(e)=>{ setFileType(e.target.value); setFilters({}); setPage(0); }}
            >
              {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {keys.map(k => (
            <div key={k} className="fb-field">
              <label>{k}</label>
              <input
                value={filters[k] || ""}
                onChange={(e)=>setF(k, e.target.value)}
                placeholder={k}
              />
            </div>
          ))}

          <div className="fb-chiprow">
            {chips.length ? chips.map(({k,v}) => (
              <span key={k} className="chip" title="Click to remove" onClick={()=> setF(k, "")}>
                <span className="dot"></span>{k}: {v}
              </span>
            )) : <span className="muted tiny">No filters</span>}
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section className="results-pane">
        <div className="results-head" style={{gap:12}}>
          <span className="count">{pageRows.length}</span>
          <span className="muted tiny">
            {showAll
              ? (total ? `items (${startIdx + 1}–${endIdx} of ${total})` : "items (showing all)")
              : "items (this page)"}
          </span>

          <div style={{marginLeft:"auto", display:"flex", gap:8, alignItems:"center"}}>
            <label className="tiny muted" htmlFor="pageSize">Page size</label>
            <select
              id="pageSize"
              className="ghost sm"
              value={pageSize}
              onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(0); }}
            >
              {[50,100,250,500,1000].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label style={{display:"flex", gap:6, alignItems:"center"}} className="tiny muted">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e)=>{ setShowAll(e.target.checked); setPage(0); setStamp(s=>s+1); }}
              />
              Show all (batch)
            </label>

            <button className="ghost sm" disabled={!canPrev || isFetching} onClick={()=> setPage(p => Math.max(0, p-1))}>
              ◀ Prev
            </button>
            <button className="ghost sm" disabled={!canNext || isFetching} onClick={()=> setPage(p => p+1)}>
              Next ▶
            </button>

            <button className="ghost sm" onClick={()=>refetch()} disabled={isFetching}>
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {pageRows.length === 0 ? (
          <div className="empty">
            <div className="halo"></div>
            <h3>No results</h3>
            <p className="muted">Try adjusting filters or file type.</p>
          </div>
        ) : (
          <ul className="card-list">
            {pageRows.map((r) => (
              <li key={r.id} className="card">
                <div className="card-top">
                  <span className={badgeClass(r.status)}>{r.status || "—"}</span>
                  <span className="case">{r.originating_case_number || r.ncic_number || r.originating_agency || "—"}</span>
                </div>
                <div className="card-main">
                  <div className="offense">{headline(r)}</div>
                  <div className="loc">{r.file_type} • {r.originating_agency || "Unknown agency"}</div>
                </div>
                <div className="meta">
                  <span>created:</span><time>{prettyDate(r.created_at)}</time>
                  {r.effective_until && (<><span>• effective until:</span><time>{prettyDate(r.effective_until)}</time></>)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
