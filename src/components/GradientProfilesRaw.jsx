import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

import mergedRawGradCSV from "../data/mergedRawGrad.csv";

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

export default function GradientProfilesRaw({ selectedDiscIDs = [] }) {
  const svgRef = useRef();
  const containerRef = useRef();
  const [curves, setCurves] = useState([]);
  const [visibleConditions, setVisibleConditions] = useState({
    standard: true,
    hypoxia: true,
    cold: true
  });
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const width = containerWidth * 0.95;
        const height = width * 0.85; 
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    const timeoutId = setTimeout(updateDimensions, 100);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    d3.csv(mergedRawGradCSV)
      .then((raw) => {
        const byDisc = d3.group(raw, (d) => d.disc);
        const allCurves = [];

        byDisc.forEach((rows, discId) => {
          const condLabel = mapCondition(rows[0].condition);
          const area = +rows[0].area;

          const maxVal = d3.max(rows, (r) => +r.value || 0);
          if (!maxVal || !isFinite(maxVal)) return;

          const curvePoints = rows
            .map((r) => ({
              disc: discId,
              condition: condLabel,
              area,
              relativedistance: +r.relativedistance,
              value: +r.value / maxVal
            }))
            .filter((p) => !isNaN(p.relativedistance) && !isNaN(p.value))
            .sort((a, b) => a.relativedistance - b.relativedistance);

          if (curvePoints.length > 1) {
            allCurves.push(curvePoints);
          }
        });

        setCurves(allCurves);
        console.log("Loaded curves:", allCurves.length);
      })
      .catch((err) =>
        console.error("Error loading mergedRawGrad in GradientProfilesRaw:", err)
      );
  }, []);

  useEffect(() => {
    if (!curves.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = dimensions.width;
    const height = dimensions.height;

    const margin = { top: 30, right: 48, bottom: 60, left: 54 };
    const plotWidth = 215;
    const plotHeight = 170;

    const mainGroup = svg.append("g");

    const allPoints = curves.flat();
    const xExtent = d3.extent(allPoints, (d) => d.relativedistance);

    const xScale = d3
      .scaleLinear()
      .domain(xExtent)
      .nice()
      .range([margin.left, margin.left + plotWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([margin.top + plotHeight, margin.top]);

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

    mainGroup
      .append("text")
      .attr("x", margin.left + plotWidth / 2)
      .attr("y", margin.top + plotHeight + 35)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Actual Distance Relative to Peak (µm)");

    mainGroup
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + plotHeight / 2))
      .attr("y", margin.left - 36)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Relative Intensity");

    mainGroup
      .append("text")
      .attr("x", margin.left + plotWidth / 2)
      .attr("y", 24)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("Raw Gradient Profiles");

    const visibleCurves = curves.filter((curve) =>
      visibleConditions[curve[0].condition]
    );

    const lineGen = d3
      .line()
      .x((d) => xScale(d.relativedistance))
      .y((d) => yScale(d.value))
      .curve(d3.curveBasis);

    const haveSelection =
      selectedDiscIDs && selectedDiscIDs.length > 0;
    const selectedSet = new Set(selectedDiscIDs);

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


    const legendX = margin.left + 87;
    const legendY = margin.top + plotHeight - 45;

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
  }, [curves, visibleConditions, selectedDiscIDs, dimensions]);

  return (
    <div ref={containerRef} style={{ padding: "8px", backgroundColor: "#fff", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ 
          border: "1px solid #ddd",
          maxWidth: "100%",
          height: "auto"
        }}
      />
      {!curves.length && (
        <div
          style={{ textAlign: "center", marginTop: "10px", color: "#666" }}
        >
          Loading gradient profiles...
        </div>
      )}
    </div>
  );
}
