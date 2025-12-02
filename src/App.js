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
      <h1 style={{
        width: "100%",
        textAlign: "center",
        margin: "0 0 20px 0",
        fontSize: "32px",
        fontWeight: "bold",
        color: "#333"
      }}>
        Patterns in Pattering
      </h1>
      
      {/* Main Layout: Left Half and Right Half */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
        width: "100%",
        maxWidth: "100%",
        minHeight: "calc(100vh - 100px)"
      }}>
        {/* Left Panel */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          alignItems: "center"
        }}>
          {/* Top: Main scatter plot */}
          <div style={{ 
            flex: "0 0 auto",
            backgroundColor: "#fff",
            borderRadius: "8px",
            padding: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%"
          }}>
            <WingDiscVsD onSelectionChange={setSelectedDiscs} />
          </div>
          
          {/* Bottom: Three smaller plots in a row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px",
            flex: "0 0 auto"
          }}>
            <div style={{ 
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              overflow: "hidden"
            }}>
              <GradientProfilesRaw selectedDiscIDs={selectedDiscs} />
            </div>
            <div style={{ 
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              overflow: "hidden"
            }}>
              <GradientProfilesAdjusted selectedDiscIDs={selectedDiscs} />
            </div>
            <div style={{ 
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              overflow: "hidden"
            }}>
              <GaussianCurvePlot selectedDiscIDs={selectedDiscs} />
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
          {/* Wing mapping plot - includes its own controls */}
          <div style={{ 
            flex: "1 1 auto",
            backgroundColor: "#fff",
            borderRadius: "8px",
            padding: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            minHeight: "600px"
          }}>
            <WingMappings />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
