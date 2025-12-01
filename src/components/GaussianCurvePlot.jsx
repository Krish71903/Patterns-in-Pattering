import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

import mergedNormalizedGradCSV from "../data/mergedNormalizedGrad.csv";

const colors = {
  standard: "#d95f02",
  hypoxia: "#7570b3",
  cold: "#1b9e77"
};

function mapCondition(raw) {
  if (!raw) return "standard";
  const s = raw.toLowerCase();
  if (s.includes("hypo")) return "hypoxia";
  if (s.includes("cold") || s.includes("17c") || s.includes("low"))
    return "cold";
  return "standard";
}

// Gaussian function: y = B * exp(-((x-C)²)/(2*D²))
function gaussianFunction(x, A, B, C, D) {
  return A + (1 - A) * Math.exp(-((x - C) ** 2) / (2 * D ** 2));
}

// Generate points for the Gaussian curve
function generateGaussianCurve(A, B, C, D, xRange = [-50, 50], numPoints = 200) {
  const points = [];
  const step = (xRange[1] - xRange[0]) / (numPoints - 1);
  
  for (let i = 0; i < numPoints; i++) {
    const x = xRange[0] + i * step;
    const y = gaussianFunction(x, A, B, C, D);
    points.push({ x, y });
  }
  
  return points;
}

export default function GradientProfilesNormalized({ selectedDiscIDs = [] }) {
  const svgRef = useRef();
  const [curves, setCurves] = useState([]);
  const [visibleConditions, setVisibleConditions] = useState({
    standard: true,
    hypoxia: true,
    cold: true
  });

  // Load & preprocess
  useEffect(() => {
    d3.csv(mergedNormalizedGradCSV)
      .then((raw) => {
        const allCurves = [];

        raw.forEach((row) => {
          const discId = row.disc;
          const condLabel = mapCondition(row.condition);
          const area = +row.area;
          
          // Parse the Gaussian parameters
          const A = +row.A;
          const B = +row.B;
          const C = +row.C;
          const D = +row.D;
          
          // Skip if any parameter is invalid
          if ([A, B, C, D].some(isNaN)) return;
          
          // Generate the Gaussian curve points
          // Using x-range based on C ± 3*D to capture most of the curve
          const xMin = C - 3 * Math.abs(D);
          const xMax = C + 3 * Math.abs(D);
          const xRange = [Math.min(xMin, -50), Math.max(xMax, 50)];
          
          const curvePoints = generateGaussianCurve(A, B, C, D, xRange, 200)
            .map(point => ({
              disc: discId,
              condition: condLabel,
              area,
              A, B, C, D, // Store parameters for reference
              x: point.x,
              y: point.y
            }));
          
          if (curvePoints.length > 1) {
            allCurves.push(curvePoints);
          }
        });

        setCurves(allCurves);
        console.log("Loaded normalized curves:", allCurves.length);
      })
      .catch((err) =>
        console.error("Error loading mergedNormalizedGrad in GradientProfilesNormalized:", err)
      );
  }, []);

  useEffect(() => {
    if (!curves.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600;
    const height = 500;

    const margin = { top: 48, right: 48, bottom: 42, left: 54 };
    const plotWidth = 360;
    const plotHeight = 300;

    const mainGroup = svg.append("g");

    // Calculate x and y extents from all curves
    const allPoints = curves.flat();
    const xExtent = d3.extent(allPoints, (d) => d.x);
    const yExtent = [0, d3.max(allPoints, (d) => d.y) * 1.1]; // Add 10% padding on top

    const xScale = d3
      .scaleLinear()
      .domain(xExtent)
      .nice()
      .range([margin.left, margin.left + plotWidth]);

    const yScale = d3
      .scaleLinear()
      .domain(yExtent)
      .range([margin.top + plotHeight, margin.top]);

    // Grid lines
    mainGroup
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .selectAll("line.h")
      .data(yScale.ticks(5))
      .join("line")
      .attr("x1", margin.left)
      .attr("x2", margin.left + plotWidth)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d));

    // Axes
    mainGroup
      .append("g")
      .attr("transform", `translate(0,${margin.top + plotHeight})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .selectAll("text")
      .style("font-size", "10px");

    mainGroup
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll("text")
      .style("font-size", "10px");

    // Axis labels
    mainGroup
      .append("text")
      .attr("x", margin.left + plotWidth / 2)
      .attr("y", margin.top + plotHeight + 30)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Distance from Peak (µm)");

    mainGroup
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + plotHeight / 2))
      .attr("y", margin.left - 36)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Normalized Intensity");

    mainGroup
      .append("text")
      .attr("x", margin.left + plotWidth / 2)
      .attr("y", 24)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("Gaussian Curves of Profiles");

    const visibleCurves = curves.filter((curve) =>
      visibleConditions[curve[0].condition]
    );

    // Line generator for Gaussian curves
    const lineGen = d3
      .line()
      .x((d) => xScale(d.x - d.C)) 
      .y((d) => yScale(d.y))
      .curve(d3.curveBasis);

    const haveSelection =
      selectedDiscIDs && selectedDiscIDs.length > 0;
    const selectedSet = new Set(selectedDiscIDs);

    // Background curves (all visible)
    mainGroup
      .selectAll("path.curve-bg")
      .data(visibleCurves)
      .join("path")
      .attr("class", "curve-bg")
      .attr("d", (d) => lineGen(d))
      .attr("fill", "none")
      .attr("stroke", (d) => colors[d[0].condition] || "#999")
      .attr("stroke-width", 1)
      .attr("opacity", haveSelection ? 0.1 : 0.25);

    // Selected curves (bold)
    if (haveSelection) {
      const selectedCurves = visibleCurves.filter((curve) =>
        selectedSet.has(curve[0].disc)
      );

      mainGroup
        .selectAll("path.curve-selected")
        .data(selectedCurves)
        .join("path")
        .attr("class", "curve-selected")
        .attr("d", (d) => lineGen(d))
        .attr("fill", "none")
        .attr("stroke", (d) => colors[d[0].condition] || "#999")
        .attr("stroke-width", 2)
        .attr("opacity", 0.9);
    }

    // Legend
    const legendX = margin.left + 35;
    const legendY = margin.top + 24;

    mainGroup
      .append("text")
      .attr("x", legendX)
      .attr("y", legendY - 12)
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Condition");

    const legendItems = [
      { label: "standard", color: colors.standard },
      { label: "hypoxia", color: colors.hypoxia },
      { label: "cold", color: colors.cold }
    ];

    legendItems.forEach((item, i) => {
      const g = mainGroup
        .append("g")
        .attr("transform", `translate(${legendX}, ${legendY + i * 18})`)
        .style("cursor", "pointer")
        .on("click", () => {
          setVisibleConditions((prev) => ({
            ...prev,
            [item.label]: !prev[item.label]
          }));
        });
        
      g.append("rect")
        .attr("x", -20)
        .attr("y", -10)
        .attr("width", 15)
        .attr("height", 15)
        .attr(
          "fill",
          visibleConditions[item.label] ? item.color : "white"
        )
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

      g.append("text")
        .attr("x", 3)
        .attr("y", 2)
        .style("font-size", "10px")
        .style("opacity", visibleConditions[item.label] ? 1 : 0.5)
        .text(item.label);
    });
  }, [curves, visibleConditions, selectedDiscIDs]);

  return (
    <div style={{ padding: "10px", backgroundColor: "#fff" }}>
      <svg
        ref={svgRef}
        width={600}
        height={500}
        style={{ border: "1px solid #ddd" }}
      />
      {!curves.length && (
        <div
          style={{ textAlign: "center", marginTop: "20px", color: "#666" }}
        >
        </div>
      )}
    </div>
  );
}