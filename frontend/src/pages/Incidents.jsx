import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import Table from "../components/Table.jsx";

async function fetchIncidents(params = {}) {
  const res = await api.get("/incidents/", { params });
  return res.data.items;
}

export default function Incidents() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => fetchIncidents(),
  });

  if (isLoading) return <p>Loading incidents…</p>;
  if (error) return <p>Failed to load.</p>;

  return (
    <div>
      <h2>Incidents</h2>
      <Table rows={data} />
    </div>
  );
}
