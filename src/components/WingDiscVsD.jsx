import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

// Import CSV file
import normVgHypoNormoCSV from "../data/norm_vghypo-normo.csv";

const colors = {
  Normoxia: "#ff9900",
  Hypoxia: "#a56cc1",
  LowTemp: "#4ab8a1"
};

export default function WingDiscVsD() {
  const svgRef = useRef();
  const [scatterData, setScatterData] = useState([]);
  const [visibleConditions, setVisibleConditions] = useState({
    Normoxia: true,
    Hypoxia: true
  });

  // Load data
  useEffect(() => {
    d3.csv(normVgHypoNormoCSV).then((paramsData) => {
      // Process scatter data
      const processed = paramsData.map(d => ({
        disc: d.disc,
        area: +d.area,
        A: +d.A,
        B: +d.B,
        C: +d.C,
        D: +d.D,
        condition: d.O2 === "normoxia" ? "Normoxia" : "Hypoxia"
      })).filter(d => 
        !isNaN(d.area) && !isNaN(d.D) && 
        isFinite(d.area) && isFinite(d.D)
      );
      
      // Normalize area to 0-1
      const areaExtent = d3.extent(processed, d => d.area);
      const areaMin = areaExtent[0];
      const areaMax = areaExtent[1];
      
      processed.forEach(d => {
        d.normalizedArea = (d.area - areaMin) / (areaMax - areaMin);
      });
      
      console.log("Processed data:", processed.slice(0, 5));
      console.log("Area range:", areaExtent);
      console.log("D range:", d3.extent(processed, d => d.D));
      console.log("Normalized area range:", d3.extent(processed, d => d.normalizedArea));
      
      setScatterData(processed);
    }).catch(err => console.error("Error loading data:", err));
  }, []);

  useEffect(() => {
    if (scatterData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Main container
    const mainGroup = svg.append("g");

    // ============ SCATTER PLOT WITH HISTOGRAMS ============
    const scatterMargin = { top: 120, right: 200, bottom: 80, left: 100 };
    const scatterSize = 500;
    const histWidth = 60;
    const histHeight = 60;
    
    // Filter data based on visible conditions
    const filteredData = scatterData.filter(d => visibleConditions[d.condition]);

    // Scales for scatter - use normalized area vs D (use all data for consistent scales)
    const xExtent = d3.extent(scatterData, d => d.normalizedArea);
    const yExtent = d3.extent(scatterData, d => d.D);
    
    console.log("X extent (normalized area):", xExtent);
    console.log("Y extent (D):", yExtent);
    
    const xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([scatterMargin.left, scatterMargin.left + scatterSize]);

    const yScale = d3.scaleLinear()
      .domain(yExtent).nice()
      .range([scatterMargin.top + scatterSize, scatterMargin.top]);

    // Background
    mainGroup.append("rect")
      .attr("x", scatterMargin.left)
      .attr("y", scatterMargin.top)
      .attr("width", scatterSize)
      .attr("height", scatterSize)
      .attr("fill", "#f0f0f5");

    // Grid
    mainGroup.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .selectAll("line.v")
      .data(xScale.ticks(5))
      .join("line")
      .attr("x1", d => xScale(d))
      .attr("x2", d => xScale(d))
      .attr("y1", scatterMargin.top)
      .attr("y2", scatterMargin.top + scatterSize);

    mainGroup.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .selectAll("line.h")
      .data(yScale.ticks(5))
      .join("line")
      .attr("x1", scatterMargin.left)
      .attr("x2", scatterMargin.left + scatterSize)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d));

    // Axes
    mainGroup.append("g")
      .attr("transform", `translate(0,${scatterMargin.top + scatterSize})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .selectAll("text")
      .style("font-size", "12px");

    mainGroup.append("g")
      .attr("transform", `translate(${scatterMargin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll("text")
      .style("font-size", "12px");

    // Axis labels
    mainGroup.append("text")
      .attr("x", scatterMargin.left + scatterSize / 2)
      .attr("y", scatterMargin.top + scatterSize + 50)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Normalized Wing Disc Area");

    mainGroup.append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -(scatterMargin.top + scatterSize / 2))
      .attr("y", scatterMargin.left - 60)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Standard Deviation (D)");
    
    // Title
    mainGroup.append("text")
      .attr("x", scatterMargin.left + scatterSize / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .text("Wing Disc vs Standard Deviation");

    // Scatter points
    mainGroup.selectAll("circle.scatter")
      .data(filteredData)
      .join("circle")
      .attr("class", "scatter")
      .attr("cx", d => xScale(d.normalizedArea))
      .attr("cy", d => yScale(d.D))
      .attr("r", 4)
      .attr("fill", d => colors[d.condition])
      .attr("opacity", 0.7)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    // Top histogram
    Object.entries(colors).forEach(([condition, color]) => {
      if (!visibleConditions[condition]) return;
      const subset = filteredData.filter(d => d.condition === condition);
      if (subset.length === 0) return;

      const bins = d3.bin()
        .value(d => d.normalizedArea)
        .domain(xScale.domain())
        .thresholds(20)(subset);

      const yH = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .range([scatterMargin.top, scatterMargin.top - histHeight]);

      mainGroup.selectAll(`path.hist-top-${condition}`)
        .data([bins])
        .join("path")
        .attr("d", d3.area()
          .x(d => xScale((d.x0 + d.x1) / 2))
          .y0(scatterMargin.top)
          .y1(d => yH(d.length))
          .curve(d3.curveBasis)
        )
        .attr("fill", color)
        .attr("opacity", 0.5);
    });

    // Right histogram
    Object.entries(colors).forEach(([condition, color]) => {
      if (!visibleConditions[condition]) return;
      const subset = filteredData.filter(d => d.condition === condition);
      if (subset.length === 0) return;

      const bins = d3.bin()
        .value(d => d.D)
        .domain(yScale.domain())
        .thresholds(15)(subset);

      const xH = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .range([scatterMargin.left + scatterSize, scatterMargin.left + scatterSize + histWidth]);

      mainGroup.selectAll(`path.hist-right-${condition}`)
        .data([bins])
        .join("path")
        .attr("d", d3.area()
          .x0(scatterMargin.left + scatterSize)
          .x1(d => xH(d.length))
          .y(d => yScale((d.x0 + d.x1) / 2))
          .curve(d3.curveBasis)
        )
        .attr("fill", color)
        .attr("opacity", 0.5);
    });

    // Legend (top right)
    const legendX = scatterMargin.left + scatterSize + 100;
    const legendY = scatterMargin.top + 50;

    mainGroup.append("text")
      .attr("x", legendX)
      .attr("y", legendY - 20)
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Condition");

    const legendItems = [
      { label: "Normoxia", color: colors.Normoxia, checked: true },
      { label: "Hypoxia", color: colors.Hypoxia, checked: true }
    ];

    legendItems.forEach((item, i) => {
      const g = mainGroup.append("g")
        .attr("transform", `translate(${legendX}, ${legendY + i * 30})`)
        .style("cursor", "pointer")
        .on("click", () => {
          setVisibleConditions(prev => ({
            ...prev,
            [item.label]: !prev[item.label]
          }));
        });

      // Checkbox background
      g.append("rect")
        .attr("x", -20)
        .attr("y", -10)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", visibleConditions[item.label] ? item.color : "white")
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

      // Color indicator
      g.append("rect")
        .attr("x", 5)
        .attr("y", -8)
        .attr("width", 20)
        .attr("height", 12)
        .attr("fill", item.color)
        .attr("opacity", visibleConditions[item.label] ? 1 : 0.3);

      // Label
      g.append("text")
        .attr("x", 35)
        .attr("y", 2)
        .style("font-size", "13px")
        .style("opacity", visibleConditions[item.label] ? 1 : 0.5)
        .text(item.label);
    });


  }, [scatterData, visibleConditions]);

  return (
    <div style={{ padding: "20px", backgroundColor: "#fff" }}>
      <svg ref={svgRef} width={1000} height={800} style={{ border: "1px solid #ddd" }}></svg>
      
      {scatterData.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "20px", color: "#666" }}>
          Loading data...
        </div>
      )}
    </div>
  );
}

