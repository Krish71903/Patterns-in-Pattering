import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

import mergedWingCoordsCSV from "../data/mergedWingCoords.csv";

const colors = {
  standard: "#d95f02",
  hypoxia: "#7570b3",
  cold: "#1b9e77"
};

// Color scales for gradients (upper 1/3 of each palette)
const gradientScales = {
  standard: d3.scaleSequential(d3.interpolateOrRd).domain([0.67, 1.0]),
  hypoxia: d3.scaleSequential(d3.interpolateBuPu).domain([0.67, 1.0]),
  cold: d3.scaleSequential(d3.interpolateBuGn).domain([0.67, 1.0])
};

// Define connections between points
const connections = [
  [1, 7], [2, 6], [2, 7], [3, 5], [3, 9],
  [4, 5], [4, 15], [5, 11], [6, 12], [7, 12],
  [8, 6], [8, 9], [8, 13], [9, 10], [10, 11],
  [10, 14], [11, 15], [12, 13], [13, 14], [14, 15]
];

export default function WingCoordinates() {
  const svgRef = useRef();
  const [data, setData] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [visibleConditions, setVisibleConditions] = useState({
    standard: true,
    hypoxia: true,
    cold: true
  });
  
  // New filter states
  const [centroidFilters, setCentroidFilters] = useState({
    below: 0.1,
    above: 0.9,
    within: [0.00, 1.00]
  });
  const [sexFilters, setSexFilters] = useState({
    female: true,
    male: true
  });
  const [centroidRange, setCentroidRange] = useState([0, 1]);

  // Zoom state
  const [transform, setTransform] = useState(d3.zoomIdentity);

  // Load data
  useEffect(() => {
    d3.csv(mergedWingCoordsCSV).then(csvData => {
      console.log("Wing coordinates loaded:", csvData.length);
      
      const processed = csvData.map(row => {
        const points = [];
        for (let i = 1; i <= 15; i++) {
          points.push({
            pointId: i,
            letter: String.fromCharCode(64 + i),
            x: +row[`X${i}`],
            y: +row[`Y${i}`],
            id: row.Id,
            condition: row.Condition,
            sex: row.Sex,
            centroidSize: +row['Centroid.Size'],
            logCentroidSize: +row['Log.Centroid.Size']
          });
        }
        return points;
      }).flat();

      console.log("Processed points:", processed.length);
      
      // Calculate centroid size range for normalization
      const sizes = [...new Set(csvData.map(d => +d['Centroid.Size']))];
      const minSize = d3.min(sizes);
      const maxSize = d3.max(sizes);
      setCentroidRange([minSize, maxSize]);
      
      setData(processed);
    }).catch(err => console.error("Error loading wing coordinates:", err));
  }, []);

  // Apply filters to data - FIXED LOGIC: ((show below OR above) AND within)
  const getFilteredData = () => {
    if (data.length === 0) return [];

    return data.filter(d => {
      if (!visibleConditions[d.condition]) return false;
      
      const sex = d.sex === 'F' ? 'female' : 'male';
      if (!sexFilters[sex]) return false;
      
      const normalizedSize = (d.centroidSize - centroidRange[0]) / (centroidRange[1] - centroidRange[0]);
      
      // Fixed logic: ((below OR above) AND within)
      const showBelow = normalizedSize <= centroidFilters.below;
      const showAbove = normalizedSize >= centroidFilters.above;
      const showWithin = normalizedSize >= centroidFilters.within[0] && normalizedSize <= centroidFilters.within[1];
      
      return (showBelow || showAbove) && showWithin;
    });
  };

  const handlePointClick = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const clearAllSelections = () => {
    setSelectedIds(new Set());
  };

  // Handle dual range slider
  const handleWithinChange = (index, value) => {
    setCentroidFilters(prev => {
      const newWithin = [...prev.within];
      newWithin[index] = +value;
      
      if (index === 0 && newWithin[0] > newWithin[1]) {
        newWithin[1] = newWithin[0];
      } else if (index === 1 && newWithin[1] < newWithin[0]) {
        newWithin[0] = newWithin[1];
      }
      
      return { ...prev, within: newWithin };
    });
  };

  useEffect(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600;
    const height = 500;
    const margin = { top: 36, right: 12, bottom: 24, left: 36 };

    const mainGroup = svg.append("g");

    // Get all coordinates for scaling - use ALL data for consistent scaling
    const allCoords = data.map(d => [d.x, d.y]);
    const xExtent = d3.extent(allCoords, d => d[0]);
    const yExtent = d3.extent(allCoords, d => d[1]);

    // Create scales with consistent domains
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height - margin.bottom, margin.top]);

    // Apply zoom transform
    const zoomedXScale = transform.rescaleX(xScale);
    const zoomedYScale = transform.rescaleY(yScale);

    // Axes with zoom
    mainGroup.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(zoomedXScale))
      .selectAll("text")
      .style("font-size", "8px");

    mainGroup.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(zoomedYScale))
      .selectAll("text")
      .style("font-size", "8px");

    // Labels
    mainGroup.append("text")
      .attr("x", width / 2)
      .attr("y", height - 6)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .text("X Coordinate");

    mainGroup.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 9)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .text("Y Coordinate");

    // Title
    mainGroup.append("text")
      .attr("x", width / 2)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("Wing Coordinate Landmarks");

    // Draw connections for ALL selected IDs
    Array.from(selectedIds).forEach(selectedId => {
      const selectedWingData = filteredData.filter(d => d.id === selectedId);
      const pointMap = {};
      selectedWingData.forEach(d => {
        pointMap[d.pointId] = d;
      });

      connections.forEach(([p1, p2]) => {
        if (pointMap[p1] && pointMap[p2]) {
          mainGroup.append("line")
            .attr("x1", zoomedXScale(pointMap[p1].x))
            .attr("y1", zoomedYScale(pointMap[p1].y))
            .attr("x2", zoomedXScale(pointMap[p2].x))
            .attr("y2", zoomedYScale(pointMap[p2].y))
            .attr("stroke", colors[pointMap[p1].condition] || "#999")
            .attr("stroke-width", 6)
            .attr("opacity", 0.95);
        }
      });
    });

    // Calculate opacity for each point
    const getOpacity = (d, isHovered = false, hoveredPointId = null) => {
      if (isHovered) {
        if (selectedIds.has(d.id)) return 1;
        if (d.pointId === hoveredPointId) return 0.8;
        return 0.3;
      }
      
      if (selectedIds.size === 0) return 0.8;
      return selectedIds.has(d.id) ? 1 : 0.6;
    };

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("padding", "8px")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .style("font-size", "12px")
      .style("opacity", 0);

    // Get color based on centroid size and condition - using upper 1/3 of gradient
    const getPointColor = (d) => {
      const normalizedSize = (d.centroidSize - centroidRange[0]) / (centroidRange[1] - centroidRange[0]);
      const gradientPosition = 0.67 + (normalizedSize * 0.33);
      return gradientScales[d.condition](gradientPosition);
    };

    // Draw points
    const points = mainGroup.selectAll("g.point")
      .data(filteredData)
      .join("g")
      .attr("class", "point")
      .attr("transform", d => `translate(${zoomedXScale(d.x)}, ${zoomedYScale(d.y)})`)
      .style("cursor", "pointer")
      .style("opacity", d => getOpacity(d))
      .on("click", (event, d) => {
        handlePointClick(d.id);
      })
      .on("mouseover", function(event, d) {
        const currentPointId = d.pointId;
        
        mainGroup.selectAll("g.point")
          .transition()
          .duration(200)
          .style("opacity", point => getOpacity(point, true, currentPointId));

        const normalizedSize = (d.centroidSize - centroidRange[0]) / (centroidRange[1] - centroidRange[0]);
        
        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>ID:</strong> ${d.id}</div>
            <div><strong>Point:</strong> ${d.letter} (${d.pointId})</div>
            <div><strong>Condition:</strong> ${d.condition}</div>
            <div><strong>Sex:</strong> ${d.sex === 'F' ? 'Female' : 'Male'}</div>
            <div><strong>Centroid Size:</strong> ${d.centroidSize.toFixed(4)}</div>
            <div><strong>Normalized Size:</strong> ${normalizedSize.toFixed(3)}</div>
            <div><strong>Coordinates:</strong> (${d.x.toFixed(2)}, ${d.y.toFixed(2)})</div>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        mainGroup.selectAll("g.point")
          .transition()
          .duration(200)
          .style("opacity", d => getOpacity(d));
        
        tooltip.style("opacity", 0);
      });

    // Add circles for points with gradient colors
    points.append("circle")
      .attr("r", 4)
      .attr("fill", d => getPointColor(d))
      .attr("stroke", d => selectedIds.has(d.id) ? "#000" : "#fff")
      .attr("stroke-width", d => selectedIds.has(d.id) ? 2 : 1);

    // Add letters for points
    points.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .style("font-size", "8px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .style("pointer-events", "none")
      .text(d => d.letter);

    // Setup zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    svg.call(zoom);

    // Condition Filter Legend with Gradient Bars
    const legendX = width - 120;
    const legendY = margin.top;

    mainGroup.append("text")
      .attr("x", legendX)
      .attr("y", legendY - 6)
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Condition");

    Object.entries(colors).forEach(([condition, color], i) => {
      const legendItem = mainGroup.append("g")
        .attr("transform", `translate(${legendX}, ${legendY + i * 25})`)
        .style("cursor", "pointer")
        .on("click", () => {
          setVisibleConditions(prev => ({
            ...prev,
            [condition]: !prev[condition]
          }));
        });

      // Checkbox
      legendItem.append("rect")
        .attr("x", -15)
        .attr("y", -8)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", visibleConditions[condition] ? color : "white")
        .attr("stroke", "#333")
        .attr("stroke-width", 1);

      // Smooth gradient bar
      const gradientId = `gradient-${condition}`;
      
      const defs = svg.append("defs");
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%");

      gradient.selectAll("stop")
        .data(d3.range(0, 1.01, 0.1))
        .enter().append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => gradientScales[condition](0.67 + d * 0.33));

      // Gradient bar rectangle
      legendItem.append("rect")
        .attr("x", 5)
        .attr("y", -6)
        .attr("width", 80)
        .attr("height", 8)
        .attr("fill", `url(#${gradientId})`)
        .attr("opacity", visibleConditions[condition] ? 1 : 0.3);

      // Label
      legendItem.append("text")
        .attr("x", 90)
        .attr("y", 2)
        .style("font-size", "10px")
        .style("opacity", visibleConditions[condition] ? 1 : 0.5)
        .text(condition);
    });

    // Instructions
    mainGroup.append("text")
      .attr("x", width - 120)
      .attr("y", height - 36)
      .style("font-size", "9px")
      .style("fill", "#666")
      .text("Click: select wings");

    mainGroup.append("text")
      .attr("x", width - 120)
      .attr("y", height - 27)
      .style("font-size", "9px")
      .style("fill", "#666")
      .text("Scroll: zoom • Drag: pan");

    return () => {
      tooltip.remove();
    };
  }, [data, selectedIds, visibleConditions, centroidFilters, sexFilters, centroidRange, transform]);

  const formatCentroidValue = (value) => {
  // Check if centroidRange is valid and data has loaded
  if (!centroidRange || centroidRange.length !== 2 || centroidRange[0] === centroidRange[1] || !isFinite(centroidRange[0]) || !isFinite(centroidRange[1])) {
    return "Loading...";
  }
  const actualValue = centroidRange[0] + value * (centroidRange[1] - centroidRange[0]);
  return actualValue.toFixed(2);
};

  return (
    <div style={{ padding: "10px", backgroundColor: "#fff" }}>
      <h2>Wing Coordinate Landmarks</h2>
      
      {/* Filter Controls */}
      <div style={{ 
        marginBottom: "10px", 
        padding: "10px", 
        backgroundColor: "#f8f9fa", 
        borderRadius: "5px",
        border: "1px solid #dee2e6"
      }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>Filter Options</h3>
        
        {/* Sex Filter */}
        <div style={{ marginBottom: "10px" }}>
          <label style={{ fontWeight: "bold", marginRight: "10px", fontSize: "12px" }}>Sex:</label>
          {['female', 'male'].map(sex => (
            <label key={sex} style={{ marginRight: "10px", fontSize: "12px" }}>
              <input
                type="checkbox"
                checked={sexFilters[sex]}
                onChange={(e) => setSexFilters(prev => ({ ...prev, [sex]: e.target.checked }))}
                style={{ marginRight: "4px" }}
              />
              {sex.charAt(0).toUpperCase() + sex.slice(1)}
            </label>
          ))}
        </div>

        {/* Centroid Size Filters */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" }}>
          {/* Below Filter */}
          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px", fontSize: "11px" }}>
              Show below: {formatCentroidValue(centroidFilters.below)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={centroidFilters.below}
              onChange={(e) => setCentroidFilters(prev => ({ ...prev, below: +e.target.value }))}
              style={{ width: "100%", height: "6px" }}
            />
          </div>

          {/* Above Filter with highlighted right side */}
          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px", fontSize: "11px" }}>
              And above: {formatCentroidValue(centroidFilters.above)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={centroidFilters.above}
              onChange={(e) => setCentroidFilters(prev => ({ ...prev, above: +e.target.value }))}
              style={{ 
                width: "100%",
                height: "6px",
                background: `linear-gradient(to right, #ddd ${centroidFilters.above * 100}%, #4CAF50 ${centroidFilters.above * 100}%)`
              }}
            />
          </div>

          {/* Within Filter - Dual range slider */}
          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px", fontSize: "11px" }}>
              Within: {formatCentroidValue(centroidFilters.within[0])} - {formatCentroidValue(centroidFilters.within[1])}
            </label>
            <div style={{ position: "relative", height: "25px" }}>
              {/* Background track */}
              <div style={{
                position: "absolute",
                top: "50%",
                left: "0",
                right: "0",
                height: "4px",
                background: "#ddd",
                transform: "translateY(-50%)",
                borderRadius: "2px"
              }}></div>
              
              {/* Active range */}
              <div style={{
                position: "absolute",
                left: `${centroidFilters.within[0] * 100}%`,
                right: `${(1 - centroidFilters.within[1]) * 100}%`,
                top: "50%",
                height: "4px",
                background: "#2196F3",
                transform: "translateY(-50%)",
                borderRadius: "2px"
              }}></div>
              
              {/* Hidden input handles */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={centroidFilters.within[0]}
                onChange={(e) => handleWithinChange(0, e.target.value)}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                  zIndex: 2
                }}
              />
              
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={centroidFilters.within[1]}
                onChange={(e) => handleWithinChange(1, e.target.value)}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                  zIndex: 2
                }}
              />
              
              {/* Visual handles */}
              <div style={{
                position: "absolute",
                left: `${centroidFilters.within[0] * 100}%`,
                top: "50%",
                width: "12px",
                height: "12px",
                background: "#2196F3",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
              }}></div>
              <div style={{
                position: "absolute",
                left: `${centroidFilters.within[1] * 100}%`,
                top: "50%",
                width: "12px",
                height: "12px",
                background: "#2196F3",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
              }}></div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ color: "green", marginBottom: "10px", fontSize: "12px" }}>
        Showing {getFilteredData().length} of {data.length} landmark points
        {selectedIds.size > 0 && ` • ${selectedIds.size} wing(s) selected`}
      </div>
      
      <svg
        ref={svgRef}
        width={600}
        height={500}
        style={{ border: "1px solid #ddd", backgroundColor: "white" }}
      ></svg>

      {/* Selected Wings List */}
      {selectedIds.size > 0 && (
        <div style={{ 
          marginTop: "10px", 
          padding: "8px", 
          backgroundColor: "#e8f5e8", 
          borderRadius: "5px",
          border: "1px solid #c8e6c9"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "12px" }}>
              <strong>Selected Wings ({selectedIds.size}):</strong> {Array.from(selectedIds).join(", ")}
            </div>
            <button
              onClick={clearAllSelections}
              style={{
                padding: "3px 8px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "11px"
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
      
      {data.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "20px", color: "#666" }}>
          Loading wing coordinates...
        </div>
      )}
    </div>
  );
}