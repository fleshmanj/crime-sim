import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import "./IncidentsSearch.css";

// helper: build query params without empty values
function cleanParams(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    out[k] = v;
  });
  return out;
}

// querying function
async function fetchIncidents(params) {
  const res = await api.get("/incidents/", { params: cleanParams(params) });
  // expect { items: [...] }
  return res.data.items || [];
}

// small debounce
function useDebounced(value, ms = 350) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

export default function IncidentsSearch() {
  const [filters, setFilters] = useState({
    case_no: "",
    status: "",
    offense_code: "",
    location: "",
    from: "", // YYYY-MM-DD
    to: "",   // YYYY-MM-DD
  });

  // keep “live typing” smooth; only query after short pause or on explicit Search
  const [submitted, setSubmitted] = useState(filters);
  const debouncedSubmitted = useDebounced(submitted, 200);

  const { data = [], isFetching, refetch } = useQuery({
    queryKey: ["incidents", debouncedSubmitted],
    queryFn: () => fetchIncidents(debouncedSubmitted),
    keepPreviousData: true,
  });

  const resultsRef = useRef(null);

  function update(k, v) {
    setFilters((f) => ({ ...f, [k]: v }));
  }

  function submit(e) {
    e?.preventDefault();
    setSubmitted(filters);
    // scroll results to top on every explicit search
    requestAnimationFrame(() => {
      resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function reset() {
    const blank = { case_no: "", status: "", offense_code: "", location: "", from: "", to: "" };
    setFilters(blank);
    setSubmitted(blank);
  }

  // badge chips for active filters
  const activeChips = useMemo(() =>
    Object.entries(filters)
      .filter(([_, v]) => v && `${v}`.trim() !== "")
      .map(([k, v]) => ({ k, v }))
  , [filters]);

  return (
    <div className="search-page">
      {/* FILTER BAR (top) */}
      <section className="filter-bar" aria-label="Incident search filters">
        <header className="fb-head">
          <h2>Search Incidents</h2>
          <div className="fb-actions">
            <button className="ghost" onClick={reset} type="button">Reset</button>
            <button className="primary" onClick={submit} type="button" aria-busy={isFetching}>
              {isFetching ? "Searching…" : "Search"}
            </button>
          </div>
        </header>

        <form className="fb-grid" onSubmit={submit}>
          <div className="fb-field">
            <label htmlFor="case_no">Case #</label>
            <input id="case_no" value={filters.case_no} onChange={(e)=>update("case_no", e.target.value)} placeholder="24-001234" />
          </div>

          <div className="fb-field">
            <label htmlFor="offense_code">Offense</label>
            <input id="offense_code" value={filters.offense_code} onChange={(e)=>update("offense_code", e.target.value)} placeholder="THEFT, BURGLARY…" />
          </div>

            <div className="fb-field">
              <label htmlFor="status">Status</label>
              <select id="status" value={filters.status} onChange={(e)=>update("status", e.target.value)}>
                <option value="">Any</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
                <option value="REFERRED">REFERRED</option>
              </select>
            </div>

          <div className="fb-field span-2">
            <label htmlFor="location">Location contains</label>
            <input id="location" value={filters.location} onChange={(e)=>update("location", e.target.value)} placeholder="Main St, 1200 block, etc." />
          </div>

          <div className="fb-field">
            <label htmlFor="from">From date</label>
            <input id="from" type="date" value={filters.from} onChange={(e)=>update("from", e.target.value)} />
          </div>
          <div className="fb-field">
            <label htmlFor="to">To date</label>
            <input id="to" type="date" value={filters.to} onChange={(e)=>update("to", e.target.value)} />
          </div>

          <div className="fb-chiprow">
            {activeChips.length > 0 ? activeChips.map(({k, v}) => (
              <button
                key={k}
                type="button"
                className="chip"
                onClick={() => update(k, "")}
                title="Remove filter"
              >
                <span className="dot" /> {k}: <strong>{`${v}`}</strong> ✕
              </button>
            )) : <p className="muted tiny">Tip: Use any combination of filters. None are required.</p>}
          </div>
        </form>
      </section>

      {/* RESULTS PANE (bottom 2/3) */}
      <section className="results-pane" ref={resultsRef} aria-live="polite">
        <div className="results-head">
          <span className="count">{isFetching ? "Searching…" : `${data.length} result${data.length===1?"":"s"}`}</span>
          <button className="ghost sm" onClick={() => refetch()}>Refresh</button>
        </div>

        {data.length === 0 && !isFetching ? (
          <div className="empty">
            <div className="halo" aria-hidden="true" />
            <h3>No results</h3>
            <p className="muted">Try widening your dates or clearing a filter chip above.</p>
          </div>
        ) : (
          <ul className="card-list">
            {data.map((i) => (
              <li key={i.id} className="card">
                <div className="card-top">
                  <span className={`badge ${i.status?.toLowerCase()}`}>{i.status}</span>
                  <span className="case">Case {i.case_no}</span>
                </div>
                <div className="card-main">
                  <h4 className="offense">{i.offense_code || "—"}</h4>
                  <p className="loc">{i.location || "Location redacted"}</p>
                </div>
                <div className="meta">
                  <span>Occurred</span>
                  <time>{new Date(i.occurred_at).toLocaleString()}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
