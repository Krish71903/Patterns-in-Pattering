import React, { useEffect, useState } from "react";
import { loadAllData } from "./utils/dataLoader";

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const datasets = await loadAllData();
        setData(datasets);
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="p-4 text-gray-600">Loading data…</div>;
  if (error) return <div className="text-red-500">Failed to load data.</div>;

  return (
    <div className="p-6 font-sans">
      <h1 className="text-xl font-bold mb-2">Wing Data Loader</h1>
      <pre className="bg-gray-100 p-4 text-sm overflow-auto max-h-96">
        {JSON.stringify(Object.keys(data), null, 2)}
      </pre>
      {/* You’ll pass `data` down to visualization components in Stage 2 */}
    </div>
  );
}

export default App;
