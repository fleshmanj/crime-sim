export default function Table({ rows }) {
  return (
    <table cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th>Case No</th>
          <th>Offense</th>
          <th>Status</th>
          <th>Occurred At</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderTop: "1px solid #ddd" }}>
            <td>{r.case_no}</td>
            <td>{r.offense_code}</td>
            <td>{r.status}</td>
            <td>{new Date(r.occurred_at).toLocaleString()}</td>
            <td>{r.location}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
