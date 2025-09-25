// frontend/src/pages/Ncic.jsx
import { useEffect, useMemo, useState } from "react";
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
  FOREIGN_FUGITIVE: ["NAME","DOB","COUNTRY"], // UI label stays COUNTRY
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

const ALL_LIMIT = 5000; // big enough for your 3.5k dataset

// ---------- Normalization helpers ----------
function norm(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    // strip diacritics
    .replace(/\p{Diacritic}/gu, "")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

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

// Always fetch "all" matching rows (no server pagination)
async function fetchAllRecords(params = {}) {
  const res = await api.get("/records", { params: { ...params, limit: ALL_LIMIT } });
  return res.data?.items ?? [];
}

/**
 * GLOBAL field aliases: UI filter name -> possible data keys/descriptor keys/payload keys.
 * These are applied across all file types.
 */
const GLOBAL_ALIASES = {
  NAME: ["NAME", "SUBJECT_NAME", "FULL_NAME"],
  DOB: ["DOB", "DATE_OF_BIRTH", "BIRTHDATE", "D_O_B"],
  FBI_NUMBER: ["FBI_NUMBER", "FBI", "FBI_NO", "FBI#"],
  SSN: ["SSN", "SOCIAL", "SOCIAL_SECURITY", "SOCIAL_SECURITY_NUMBER"],
  DRIVERS_NUMBER: ["DRIVERS_NUMBER", "DLN", "DL_NUMBER", "DRIVER_LICENSE", "DRIVER_LICENSE_NUMBER", "DLIC", "DL"],
  MISC_ID: ["MISC_ID", "MISCID", "OTHER_ID", "ALT_ID", "ALTERNATE_ID"],
  PLATE: ["PLATE", "LICENSE_PLATE", "TAG", "LIC_PLATE", "LICENCE_PLATE"],
  VIN: ["VIN", "VEHICLE_IDENTIFICATION_NUMBER"],
  OAN: ["OAN", "OWNER_APPLIED_NUMBER", "OWNER_APPL_NUM"],
  HULL_NUMBER: ["HULL_NUMBER", "HIN", "HULL_ID_NUMBER"],
  REGISTRATION: ["REGISTRATION", "REG", "REGISTRATION_NUMBER", "REG_NO", "REG_NUM"],
  SERIAL: ["SERIAL", "SERIAL_NUMBER", "SN"],
  MAKE: ["MAKE", "MANUFACTURER"],
  MODEL: ["MODEL"],
  OWNER_SSN: ["OWNER_SSN", "OWNER_SOCIAL", "OWNER_SSN_NUMBER"],
  ISSUER: ["ISSUER", "COUNTRY", "COUNTRY_CODE", "NATION", "AUTHORITY"],
  SEX: ["SEX", "GENDER"],
  RACE: ["RACE", "ETHNICITY"],
  ORIGINATING_CASE_NUMBER: ["ORIGINATING_CASE_NUMBER", "CASE", "CASE_NUMBER", "OCN"],
  WARRANT_NUMBER: ["WARRANT_NUMBER", "WARRANT_NO", "WNO"],
  ORIGINATING_AGENCY: ["ORIGINATING_AGENCY", "AGENCY", "ORI"],
  NCIC_NUMBER: ["NCIC_NUMBER", "NCIC", "NCIC_NO"],
};

/**
 * FILE-TYPE-SPECIFIC overrides/additions.
 * Example: FOREIGN_FUGITIVE uses ISSUER for what the UI calls COUNTRY.
 */
const FIELD_ALIASES = {
  FOREIGN_FUGITIVE: {
    COUNTRY: ["ISSUER", "COUNTRY", "COUNTRY_CODE", "NATION", "AUTHORITY"],
  },
  STOLEN_VEHICLE: {
    PLATE: ["PLATE", "LICENSE_PLATE", "TAG", "PLATE_NUMBER"],
    VIN: ["VIN", "VEHICLE_IDENTIFICATION_NUMBER"],
    OAN: GLOBAL_ALIASES.OAN,
  },
  STOLEN_LICENSE_PLATE: {
    PLATE: GLOBAL_ALIASES.PLATE,
  },
  STOLEN_BOAT: {
    HULL_NUMBER: GLOBAL_ALIASES.HULL_NUMBER,
    REGISTRATION: GLOBAL_ALIASES.REGISTRATION,
    OAN: GLOBAL_ALIASES.OAN,
  },
  STOLEN_GUN: {
    SERIAL: GLOBAL_ALIASES.SERIAL,
    MAKE: GLOBAL_ALIASES.MAKE,
    MODEL: GLOBAL_ALIASES.MODEL,
  },
  STOLEN_ARTICLE: {
    SERIAL: GLOBAL_ALIASES.SERIAL,
    OAN: GLOBAL_ALIASES.OAN,
  },
  SECURITY: {
    SERIAL: GLOBAL_ALIASES.SERIAL,
    OWNER_SSN: GLOBAL_ALIASES.OWNER_SSN,
    ISSUER: GLOBAL_ALIASES.ISSUER,
  },
};

export default function Ncic() {
  // filters
  const [fileType, setFileType] = useState("WANTED_PERSON");
  const [filters, setFilters] = useState({});

  // client-side pagination
  const [pageSize, setPageSize] = useState(250);
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [stamp, setStamp] = useState(0);

  // modal
  const [activeId, setActiveId] = useState(null);

  const keys = INDEX_KEYS[fileType] || [];

  const queryParams = useMemo(() => {
    const p = { file_type: fileType };
    for (const [k, v] of Object.entries(filters)) {
      if (v && String(v).trim()) p[k] = v.trim();
    }
    return p;
  }, [fileType, filters]);

  const { data = [], isFetching, refetch } = useQuery({
    queryKey: ["ncic-all", queryParams, stamp],
    queryFn: () => fetchAllRecords(queryParams),
    keepPreviousData: true,
  });

  // ---- Case/diacritic-insensitive client-side filtering ----
  const activeFilters = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(filters)) {
      const sv = (v ?? "").trim();
      if (sv) out[k] = sv;
    }
    return out;
  }, [filters]);

  function addCandidatesForKeyName(r, keyName, cands) {
    const ku = String(keyName).toUpperCase();
    const kl = String(keyName).toLowerCase();

    // top-level (try exact, lower, upper)
    if (r[keyName] != null) cands.push(String(r[keyName]));
    if (r[kl] != null) cands.push(String(r[kl]));
    if (r[ku] != null) cands.push(String(r[ku]));

    // payload
    if (r.payload && typeof r.payload === "object") {
      if (r.payload[keyName] != null) cands.push(String(r.payload[keyName]));
      if (r.payload[kl] != null) cands.push(String(r.payload[kl]));
      if (r.payload[ku] != null) cands.push(String(r.payload[ku]));
    }

    // descriptors [{key,value}] — exact key match (case-insensitive)
    if (Array.isArray(r.descriptors)) {
      for (const d of r.descriptors) {
        if (!d || d.key == null) continue;
        if (norm(d.key) === norm(keyName) && d.value != null) {
          cands.push(String(d.value));
        }
      }
    }
  }

  function getAliasList(ft, k) {
    // merge file-type-specific aliases (if any) with global
    const specific = FIELD_ALIASES[ft]?.[k] || [];
    const global = GLOBAL_ALIASES[k] || [];
    const combined = specific.length ? [...specific, ...global] : (global.length ? global : [k]);
    // de-dupe by normalized key name
    const seen = new Set();
    const out = [];
    for (const key of combined) {
      const nk = norm(key);
      if (!seen.has(nk)) { seen.add(nk); out.push(key); }
    }
    return out;
  }

  function getCandidatesForFilterKey(r, k, fileType) {
    const cands = [];
    const allKeys = getAliasList(fileType, k);
    for (const keyName of allKeys) addCandidatesForKeyName(r, keyName, cands);
    return cands;
  }

  const filteredData = useMemo(() => {
    const entries = Object.entries(activeFilters);
    if (!entries.length) return data;

    return data.filter((r) =>
      entries.every(([k, v]) => {
        const needle = norm(v);
        const candidates = getCandidatesForFilterKey(r, k, r.file_type).map(norm);
        return candidates.some((s) => s.includes(needle));
      })
    );
  }, [data, activeFilters]);

  // client-side slice
  const total = filteredData.length;
  const startIdx = page * pageSize;
  const endIdx = Math.min(total, startIdx + pageSize);
  const pageRows = showAll ? filteredData : filteredData.slice(startIdx, endIdx);

  const canPrev = !showAll && page > 0;
  const canNext = !showAll && endIdx < total;

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

  function openDetails(id) { setActiveId(id); }
  function closeDetails() { setActiveId(null); }

  // fetch detail for modal
  const { data: detail, isFetching: loadingDetail } = useQuery({
    queryKey: ["ncic-detail", activeId],
    queryFn: async () => {
      const res = await api.get(`/records/${encodeURIComponent(activeId)}`, { params: { include_descriptors: 1 }});
      return res.data;
    },
    enabled: !!activeId,
    staleTime: 30_000,
  });

  // close on ESC
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") closeDetails(); }
    if (activeId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId]);

  return (
    <div className="search-page">
      {/* FILTER BAR */}
      <section className="filter-bar">
        <div className="fb-head">
          <h2>NCIC Search</h2>
        </div>
        <div className="fb-actions span-2">
          <button className="ghost" onClick={clearFilters}>Clear</button>
          <button className="primary" onClick={doSearch} disabled={isFetching}>
            {isFetching ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="fb-grid">
          <div className="fb-field span-2">
            <label>File Type</label>
            <select
                value={fileType}
                onChange={(e) => {
                  setFileType(e.target.value);
                  setFilters({});
                  setPage(0);
                }}
            >
              {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {keys.map(k => (
              <div key={k} className="fb-field">
                <label>{k}</label>
                <input
                    value={filters[k] || ""}
                    onChange={(e) => setF(k, e.target.value)}
                    placeholder={k}
                />
              </div>
          ))}

          <div className="fb-chiprow">
            {chips.length ? chips.map(({k, v}) => (
                <span key={k} className="chip" title="Click to remove" onClick={() => setF(k, "")}>
                <span className="dot"></span>{k}: {v}
              </span>
            )) : <span className="muted tiny">No filters</span>}
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section className="results-pane">
        <div className="results-head" style={{gap: 12}}>
          <span className="count">{showAll ? total : pageRows.length}</span>
          <span className="muted tiny">
            {showAll
                ? `items (showing all ${total})`
              : total
                ? `items (${startIdx + 1}–${endIdx} of ${total})`
                : "items"}
          </span>

          <div style={{marginLeft:"auto", display:"flex", gap:8, alignItems:"center"}}>
            <label className="tiny muted" htmlFor="pageSize">Page size</label>
            <select
              id="pageSize"
              className="ghost sm"
              disabled={showAll}
              value={pageSize}
              onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(0); }}
            >
              {[50,100,250,500,1000].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <button className="ghost sm" disabled={showAll || !canPrev || isFetching} onClick={()=> setPage(p => Math.max(0, p-1))}>
              ◀ Prev
            </button>
            <button className="ghost sm" disabled={showAll || !canNext || isFetching} onClick={()=> setPage(p => p+1)}>
              Next ▶
            </button>

            <label style={{display:"flex", gap:6, alignItems:"center"}} className="tiny muted">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e)=>{ setShowAll(e.target.checked); setPage(0); }}
              />
              Show all
            </label>

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
              <li
                key={r.id}
                className="card"
                role="button"
                tabIndex={0}
                onClick={() => openDetails(r.id)}
                onKeyDown={(e)=> (e.key === "Enter" ? openDetails(r.id) : null)}
              >
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

      {/* MODAL */}
      {activeId && (
        <div className="modal-backdrop" onClick={closeDetails}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-head">
              <h3>Case Details</h3>
              <button className="ghost sm" onClick={closeDetails}>Close ✕</button>
            </div>
            {!detail || loadingDetail ? (
              <p className="muted">Loading…</p>
            ) : (
              <div className="modal-body">
                <div className="kv">
                  <div><span className="muted tiny">Type</span><div>{detail.file_type}</div></div>
                  <div><span className="muted tiny">Status</span><div>{detail.status}</div></div>
                  <div><span className="muted tiny">Agency</span><div>{detail.originating_agency || "—"}</div></div>
                  <div><span className="muted tiny">Case #</span><div>{detail.originating_case_number || "—"}</div></div>
                  <div><span className="muted tiny">NCIC #</span><div>{detail.ncic_number || "—"}</div></div>
                  <div><span className="muted tiny">Created</span><div>{prettyDate(detail.created_at)}</div></div>
                  {detail.effective_until && (
                    <div><span className="muted tiny">Effective until</span><div>{prettyDate(detail.effective_until)}</div></div>
                  )}
                </div>

                {detail.descriptors?.length ? (
                  <>
                    <h4 style={{marginTop:12}}>Descriptors</h4>
                    <ul className="desc-list">
                      {detail.descriptors.map((d,i)=>(
                        <li key={i}><b>{d.key}</b>: {d.value}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <h4 style={{marginTop:12}}>Payload</h4>
                <pre className="json">{JSON.stringify(detail.payload ?? {}, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
