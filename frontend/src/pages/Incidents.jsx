import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import Table from "../components/Table.jsx";

// Fetch the latest NCIC records (optionally filtered by file_type)
async function fetchRecords(params = {}) {
  // NOTE: your api.js already points at /api, so this is /api/records
  const res = await api.get("/records", { params: { limit: 100, ...params } });
  const items = res.data?.items ?? [];

  // Flatten a few fields for readability in your Table component.
  // (If Table auto-renders keys, this will look nice; adjust if you have fixed columns.)
  return items.map((r) => ({
    id: r.id,
    type: r.file_type,
    agency: r.originating_agency,
    status: r.status,
    created_at: r.created_at,
    effective_until: r.effective_until,
    payload: r.payload, // shows redactions if any (server-side)
  }));
}

// Optional quick filter list (keep tiny but useful)
const FILE_TYPES = [
  "WANTED_PERSON",
  "MISSING_PERSON",
  "STOLEN_VEHICLE",
  "STOLEN_GUN",
  "STOLEN_LICENSE_PLATE",
  "STOLEN_BOAT",
  "STOLEN_ARTICLE",
  "SECURITY",
  "FOREIGN_FUGITIVE",
  "UNIDENTIFIED_PERSON",
  "VIOLENT_CRIMINAL_GANG_MEMBER",
  "TERRORIST_MEMBER",
  "BATF_VIOLENT_FELON",
  "WITSEC_CHARGED",
  "INTERSTATE_ID_INDEX",
];

export default function Incidents() {
  // simple filter (blank = all)
  const [fileType, setFileType] = useState("");

  const { data = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["ncic-records", fileType],
    queryFn: () => fetchRecords(fileType ? { file_type: fileType } : {}),
    // you can tune staleTime/cacheTime here if you like
  });

  if (isLoading) return <p>Loading records…</p>;
  if (error) return <p>Failed to load.</p>;

  return (
    <div>
      <h2>NCIC Records</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label htmlFor="ft">File type:</label>
        <select
          id="ft"
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
        >
          <option value="">All</option>
          {FILE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <Table rows={data} />
    </div>
  );
}
