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

    const width = 1000;
    const height = 800;
    const margin = { top: 60, right: 20, bottom: 40, left: 60 };

    const mainGroup = svg.append("g");

    // Get all coordinates for scaling
    const allCoords = data.map(d => [d.x, d.y]);
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
      .style("font-size", "10px");

    mainGroup.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("font-size", "10px");

    // Labels
    mainGroup.append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("X Coordinate");

    mainGroup.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Y Coordinate");

    // Title
    mainGroup.append("text")
      .attr("x", width / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Wing Coordinate Landmarks");

    // Draw connections for selected ID
    if (selectedId) {
      const selectedWingData = data.filter(d => d.id === selectedId);
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
            .attr("stroke-width", 2)
            .attr("opacity", 0.6);
        }
      });
    }

    // Calculate opacity for each point
    const getOpacity = (d) => {
      if (!selectedId) return 0.7;
      
      if (d.id === selectedId) {
        return 1;
      } else if (d.pointId === selectedId) {
        return 0.5;
      } else {
        return 0.1;
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
    mainGroup.selectAll("g.point")
      .data(data)
      .join("g")
      .attr("class", "point")
      .attr("transform", d => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedId(selectedId === d.id ? null : d.id);
      })
      .on("mouseover", function(event, d) {
        // Highlight this point and same-number points
        const currentPointId = d.pointId;
        
        mainGroup.selectAll("g.point")
          .transition()
          .duration(200)
          .style("opacity", point => {
            if (point.id === d.id) return 1;
            if (point.pointId === currentPointId) return 0.5;
            return 0.1;
          });

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
        // Reset opacities
        mainGroup.selectAll("g.point")
          .transition()
          .duration(200)
          .style("opacity", d => getOpacity(d));
        
        tooltip.style("opacity", 0);
      });

    // Add circles for points
    mainGroup.selectAll("g.point")
      .append("circle")
      .attr("r", 6)
      .attr("fill", d => colors[d.condition] || "#999")
      .style("opacity", d => getOpacity(d));

    // Add letters for points
    mainGroup.selectAll("g.point")
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .style("pointer-events", "none")
      .style("opacity", d => getOpacity(d))
      .text(d => d.letter);

    // Legend
    const legend = mainGroup.append("g")
      .attr("transform", `translate(${width - 150}, ${margin.top})`);

    legend.append("text")
      .attr("x", 0)
      .attr("y", 0)
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("Conditions");

    Object.entries(colors).forEach(([condition, color], i) => {
      const legendItem = legend.append("g")
        .attr("transform", `translate(0, ${25 + i * 20})`);

      legendItem.append("circle")
        .attr("r", 6)
        .attr("fill", color);

      legendItem.append("text")
        .attr("x", 15)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(condition);
    });

    // Instructions
    mainGroup.append("text")
      .attr("x", width - 150)
      .attr("y", height - 20)
      .style("font-size", "11px")
      .style("fill", "#666")
      .text("Click: show connections • Hover: highlight");

    return () => {
      tooltip.remove();
    };
  }, [data, selectedId]);

  return (
    <div style={{ padding: "20px", backgroundColor: "#fff" }}>
      <h2>Wing Coordinate Landmarks</h2>
      <div style={{ color: "green", marginBottom: "10px" }}>
        Loaded {data.length} landmark points
        {selectedId && ` • Showing connections for: ${selectedId}`}
      </div>
      <svg
        ref={svgRef}
        width={1000}
        height={800}
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