import React, { useState } from "react";
import WingDiscVsD from "./components/WingDiscVsD";
import GradientProfilesRaw from "./components/GradientProfilesRaw";
import WingMappings from "./components/WingMappings";

function App() {
  const [selectedDiscs, setSelectedDiscs] = useState([]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        padding: "10px",
        gap: "10px",
        background: "#fafafa"
      }}
    >
     <div style={{
        width: "100%",
        padding: "15px",
        background: "#f8f9fa",
        border: "1px solid #dee2e6",
        borderRadius: "5px"
      }}>
        <p style={{ margin: 0, fontSize: "16px", lineHeight: "1.4" }}>
          Thank you for testing our interface! Please:<br />
          Find the profiles of wing discs with area between <strong>100,000-150,000 µm²</strong>.<br />
          Map the wing morphology of a wing from a fly raised under <strong>cold</strong> conditions.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(600px, 1fr))",
        gap: "10px",
        width: "100%"
      }}>
        <WingDiscVsD onSelectionChange={setSelectedDiscs} />
        <GradientProfilesRaw selectedDiscIDs={selectedDiscs} />
        <WingMappings />
      </div>
    </div>
  );
}

export default App;
