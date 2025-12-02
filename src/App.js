import React, { useState } from "react";
import WingDiscVsD from "./components/WingDiscVsD";
import GradientProfilesRaw from "./components/GradientProfilesRaw";
import GradientProfilesAdjusted from "./components/GradientProfilesAdjusted";
import GaussianCurvePlot from "./components/GaussianCurvePlot";
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

      {/* Main Layout: Left Half and Right Half */}
      <div style={{
        display: "flex",
        gap: "15px",
        width: "100%"
      }}>
        {/* Left Half: Wing Disc Area Plot + 3 Profile Plots */}
        <div style={{
          flex: "0 0 50%",
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          alignItems: "center"
        }}>
          {/* Wing Disc Area vs Lambda Plot */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <WingDiscVsD onSelectionChange={setSelectedDiscs} />
          </div>
          
          {/* 3 Profile Plots Horizontally */}
          <div style={{
            display: "flex",
            gap: "10px",
            width: "100%"
          }}>
            <div style={{ flex: "1", minWidth: 0 }}>
              <GradientProfilesRaw selectedDiscIDs={selectedDiscs} />
            </div>
            <div style={{ flex: "1", minWidth: 0 }}>
              <GradientProfilesAdjusted selectedDiscIDs={selectedDiscs} />
            </div>
            <div style={{ flex: "1", minWidth: 0 }}>
              <GaussianCurvePlot selectedDiscIDs={selectedDiscs} />
            </div>
          </div>
        </div>

        {/* Right Half: Wing Coordinate Landmarks */}
        <div style={{
          flex: "0 0 50%",
          minWidth: 0
        }}>
          <WingMappings />
        </div>
      </div>
    </div>
  );
}

export default App;
