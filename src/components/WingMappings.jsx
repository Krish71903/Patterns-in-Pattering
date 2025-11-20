import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

import mergedRawGradCSV from "../data/mergedWingCoords.csv";

const colors = {
  standard: "#d95f02",
  hypoxia: "#7570b3",
  cold: "#1b9e77"
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
  const [selectedId, setSelectedId] = useState(null);
  const [visibleConditions, setVisibleConditions] = useState({
    standard: true,
    hypoxia: true,
    cold: true
  });

  // Load data
  useEffect(() => {
    d3.csv("/data/mergedWingCoords.csv").then(csvData => {
      console.log("Wing coordinates loaded:", csvData.length);
      
      const processed = csvData.map(row => {
        const points = [];
        // Extract all 15 points (X1,Y1 through X15,Y15)
        for (let i = 1; i <= 15; i++) {
          points.push({
            pointId: i,
            letter: String.fromCharCode(64 + i), // A, B, C, ...
            x: +row[`X${i}`],
            y: +row[`Y${i}`],
            id: row.Id,
            condition: row.Condition,
            sex: row.Sex,
            centroidSize: +row['Centroid Size'],
            logCentroidSize: +row['Log Centroid Size']
          });
        }
        return points;
      }).flat();

      console.log("Processed points:", processed.length);
      setData(processed);
    }).catch(err => console.error("Error loading wing coordinates:", err));
  }, []);

  useEffect(() => {
    if (data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600;
    const height = 500;
    const margin = { top: 36, right: 12, bottom: 24, left: 36 };

    const mainGroup = svg.append("g");

    // Filter data based on visible conditions
    const filteredData = data.filter(d => visibleConditions[d.condition]);

    // Get all coordinates for scaling
    const allCoords = filteredData.map(d => [d.x, d.y]);
    const xExtent = d3.extent(allCoords, d => d[0]);
    const yExtent = d3.extent(allCoords, d => d[1]);

    // Create scales (flip y-axis to match typical coordinate systems)
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height - margin.bottom, margin.top]); // flipped

    // Axes
    mainGroup.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("font-size", "8px");

    mainGroup.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
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

    // Draw connections for selected ID
    if (selectedId) {
      const selectedWingData = filteredData.filter(d => d.id === selectedId);
      const pointMap = {};
      selectedWingData.forEach(d => {
        pointMap[d.pointId] = d;
      });

      connections.forEach(([p1, p2]) => {
        if (pointMap[p1] && pointMap[p2]) {
          mainGroup.append("line")
            .attr("x1", xScale(pointMap[p1].x))
            .attr("y1", yScale(pointMap[p1].y))
            .attr("x2", xScale(pointMap[p2].x))
            .attr("y2", yScale(pointMap[p2].y))
            .attr("stroke", colors[pointMap[p1].condition] || "#999")
            .attr("stroke-width", 6)
            .attr("opacity", 0.95);
        }
      });
    }

    // Calculate opacity for each point - IMPROVED VISIBILITY
    const getOpacity = (d, isHovered = false, hoveredPointId = null) => {
      if (isHovered) {
        if (d.id === selectedId) return 1;
        if (d.pointId === hoveredPointId) return 0.8;
        return 0.3;
      }
      
      if (!selectedId) return 0.8; // Much higher default opacity
      
      if (d.id === selectedId) {
        return 1;
      } else {
        return 0.6; // Higher opacity for unselected points
      }
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

    // Draw points
    const points = mainGroup.selectAll("g.point")
      .data(filteredData)
      .join("g")
      .attr("class", "point")
      .attr("transform", d => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
      .style("cursor", "pointer")
      .style("opacity", d => getOpacity(d))
      .on("click", (event, d) => {
        setSelectedId(selectedId === d.id ? null : d.id);
      })
      .on("mouseover", function(event, d) {
        const currentPointId = d.pointId;
        
        // Highlight this point and same-number points
        mainGroup.selectAll("g.point")
          .transition()
          .duration(200)
          .style("opacity", point => getOpacity(point, true, currentPointId));

        // Show tooltip
        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>ID:</strong> ${d.id}</div>
            <div><strong>Point:</strong> ${d.letter} (${d.pointId})</div>
            <div><strong>Condition:</strong> ${d.condition}</div>
            <div><strong>Sex:</strong> ${d.sex}</div>
            <div><strong>Coordinates:</strong> (${d.x.toFixed(2)}, ${d.y.toFixed(2)})</div>
            <div><strong>Centroid Size:</strong> ${d.centroidSize.toFixed(4)}</div>
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
        // Reset opacities to non-hover state
        mainGroup.selectAll("g.point")
          .transition()
          .duration(200)
          .style("opacity", d => getOpacity(d));
        
        tooltip.style("opacity", 0);
      });

    // Add circles for points
    points.append("circle")
      .attr("r", 4)
      .attr("fill", d => colors[d.condition] || "#999");

    // Add letters for points
    points.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .style("font-size", "8px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .style("pointer-events", "none")
      .text(d => d.letter);

    // Condition Filter Legend with Checkboxes
    const legendX = width - 96;
    const legendY = margin.top;

    mainGroup.append("text")
      .attr("x", legendX)
      .attr("y", legendY - 6)
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Condition");

    Object.entries(colors).forEach(([condition, color], i) => {
      const legendItem = mainGroup.append("g")
        .attr("transform", `translate(${legendX}, ${legendY + i * 15})`)
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

      // Color indicator
      legendItem.append("circle")
        .attr("cx", 5)
        .attr("cy", 0)
        .attr("r", 5)
        .attr("fill", color)
        .attr("opacity", visibleConditions[condition] ? 1 : 0.3);

      // Label
      legendItem.append("text")
        .attr("x", 15)
        .attr("y", 4)
        .style("font-size", "10px")
        .style("opacity", visibleConditions[condition] ? 1 : 0.5)
        .text(condition);
    });

    // Selected ID display
    if (selectedId) {
      mainGroup.append("text")
        .attr("x", width / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#d95f02")
        .text(`Showing connections for: ${selectedId}`);
    }

    // Instructions
    mainGroup.append("text")
      .attr("x", width - 108)
      .attr("y", height - 36)
      .style("font-size", "9px")
      .style("fill", "#666")
      .text("Click: show connections");

    mainGroup.append("text")
      .attr("x", width - 108)
      .attr("y", height - 27)
      .style("font-size", "9px")
      .style("fill", "#666")
      .text("Hover: highlight same points");

    return () => {
      tooltip.remove();
    };
  }, [data, selectedId, visibleConditions]);

  return (
    <div style={{ padding: "10px", backgroundColor: "#fff" }}>
      <h2>Wing Coordinate Landmarks</h2>
      <div style={{ color: "green", marginBottom: "10px" }}>
        Loaded {data.length} landmark points • Showing {data.filter(d => visibleConditions[d.condition]).length} points
        {selectedId && ` • Connections for: ${selectedId}`}
      </div>
      <svg
        ref={svgRef}
        width={600}
        height={500}
        style={{ border: "1px solid #ddd", backgroundColor: "white" }}
      ></svg>
      {data.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "20px", color: "#666" }}>
          Loading wing coordinates...
        </div>
      )}
    </div>
  );
}