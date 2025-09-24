import { useEffect, useMemo, useState } from "react";
import { ncicApi } from "../api.ncic";
import "./IncidentsSearch.css"; // reuse your existing table/layout styles

// Keep this in sync with backend/app/services/descriptors.py (INDEX_KEYS)
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

function Field({ id, label, value, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={label}/>
    </div>
  );
}

export default function NcicSearch() {
  const [fileTypeSearch, setFileTypeSearch] = useState("WANTED_PERSON");
  const [fileTypeCreate, setFileTypeCreate] = useState("WANTED_PERSON");
  const [searchVals, setSearchVals] = useState({});
  const [createVals, setCreateVals] = useState({});
  const [payloadJson, setPayloadJson] = useState("");
  const [rows, setRows] = useState([]);

  const searchKeys = INDEX_KEYS[fileTypeSearch] || [];
  const createKeys = INDEX_KEYS[fileTypeCreate] || [];

  function setSearchKey(k, v) { setSearchVals(s => ({...s, [k]: v})); }
  function setCreateKey(k, v) { setCreateVals(s => ({...s, [k]: v})); }

  async function doSearch() {
    const params = { file_type: fileTypeSearch, limit: 100, ...searchVals };
    Object.keys(params).forEach(k => { if (params[k] === "" || params[k] == null) delete params[k]; });
    try {
      const res = await ncicApi.searchRecords(params);
      setRows((res.items || []).map(r => ({
        ...r,
        created_at_str: r.created_at ? new Date(r.created_at).toLocaleString() : "",
        effective_until_str: r.effective_until ? new Date(r.effective_until).toLocaleString() : "",
        payload_str: JSON.stringify(r.payload ?? {}, null, 0),
      })));
    } catch (e) { console.error(e); alert(e.message); }
  }

  async function doCreate() {
    const base = {
      file_type: fileTypeCreate,
      originating_agency: "FBI-CJIS",
      payload: {},
    };
    // descriptor inputs -> payload (lowercase)
    for (const [K,V] of Object.entries(createVals)) {
      if (V && V.trim()) base.payload[K.toLowerCase()] = V.trim();
    }
    if (payloadJson.trim()) {
      try { Object.assign(base.payload, JSON.parse(payloadJson)); }
      catch { return alert("Invalid JSON in advanced payload"); }
    }
    try {
      const out = await ncicApi.createRecord(base);
      alert(`Created: ${out.id}`);
      await doSearch();
    } catch (e) { console.error(e); alert(e.message); }
  }

  useEffect(() => { doSearch(); /* initial */ }, []);

  return (
    <div className="page">
      <h1>NCIC Records</h1>

      <section className="card">
        <h2>Search</h2>
        <div className="grid">
          <div className="field">
            <label>File Type</label>
            <select value={fileTypeSearch} onChange={e=>{ setFileTypeSearch(e.target.value); setSearchVals({}); }}>
              {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {searchKeys.map(k => (
            <Field key={k} id={`s-${k}`} label={k} value={searchVals[k] || ""} onChange={(v)=>setSearchKey(k,v)} />
          ))}
          <div className="row">
            <button onClick={doSearch}>Search</button>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Create Record</h2>
        <div className="grid">
          <div className="field">
            <label>File Type</label>
            <select value={fileTypeCreate} onChange={e=>{ setFileTypeCreate(e.target.value); setCreateVals({}); }}>
              {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {createKeys.map(k => (
            <Field key={k} id={`c-${k}`} label={k} value={createVals[k] || ""} onChange={(v)=>setCreateKey(k,v)} />
          ))}
          <details className="field row">
            <summary>Advanced JSON payload (optional)</summary>
            <textarea rows={6} value={payloadJson} onChange={e=>setPayloadJson(e.target.value)} placeholder='{"temporary_felony_want": true}'/>
          </details>
          <div className="row">
            <button onClick={doCreate}>Create</button>
          </div>
          <p className="muted row">For a <b>Temporary Felony Want</b>, include <code>temporary_felony_want: true</code> in the payload.</p>
        </div>
      </section>

      <section className="card">
        <h2>Results</h2>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr><th>Type</th><th>Agency</th><th>Status</th><th>Created</th><th>Effective Until</th><th>Payload</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.file_type}</td>
                  <td>{r.originating_agency || ""}</td>
                  <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                  <td>{r.created_at_str}</td>
                  <td>{r.effective_until_str}</td>
                  <td><code className="small">{r.payload_str}</code></td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} className="muted">No results</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
