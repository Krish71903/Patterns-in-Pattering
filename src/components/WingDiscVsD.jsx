import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

const colors = {
  standard: "#d95f02",
  hypoxia: "#7570b3",
  cold: "#1b9e77"
};

export default function WingDiscVsD() {
  const svgRef = useRef();
  const [scatterData, setScatterData] = useState([]);
  const [visibleConditions, setVisibleConditions] = useState({
    standard: true,
    hypoxia: true,
    cold: true
  });

  // Load data - SIMPLE AND RELIABLE
  useEffect(() => {
    d3.csv("/data/mergedNormalizedGrad.csv").then((csvData) => {
      console.log("CSV loaded successfully!", csvData);
      
      // Process scatter data
      const processed = csvData.map(d => ({
        disc: d.disc,
        area: +d.area, //log transformed already, no need to transform
        A: +d.A,
        B: +d.B,
        C: +d.C,
        D: +d.D,
        condition: d.condition
      })).filter(d => 
        !isNaN(d.area) && !isNaN(d.D) && 
        isFinite(d.area) && isFinite(d.D)
      );
      
      console.log("Processed data points:", processed.length);
      console.log("Conditions found:", [...new Set(processed.map(d => d.condition))]);
      setScatterData(processed);
      
    }).catch(err => {
      console.error("Error loading data:", err);
    });
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

    // Scales for scatter - using raw area values
    const xScale = d3.scaleLinear()
      .domain(d3.extent(scatterData, d => d.area)).nice()
      .range([scatterMargin.left, scatterMargin.left + scatterSize]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(scatterData, d => d.D)).nice()
      .range([scatterMargin.top + scatterSize, scatterMargin.top]);

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

    //Labels
    mainGroup.append("text")
      .attr("x", scatterMargin.left + scatterSize / 2)
      .attr("y", scatterMargin.top + scatterSize + 50)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Area");

    mainGroup.append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -(scatterMargin.top + scatterSize / 2))
      .attr("y", scatterMargin.left - 60)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Lambda");
    
    mainGroup.append("text")
      .attr("x", scatterMargin.left + scatterSize / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .text("Wing Disc Area vs Lambda");

    // Scatter points with different shapes and tooltips
    const symbolGenerator = d3.symbol()
      .size(40); // Size of the symbols

    // Shape mapping for each condition
    const shapeMap = {
      standard: d3.symbolCircle,
      hypoxia: d3.symbolTriangle, 
      cold: d3.symbolSquare
    };

    // Get tooltip element
    const tooltip = d3.select("#tooltip");

    // Create scatter points with different shapes
    mainGroup.selectAll("path.scatter")
      .data(filteredData)
      .join("path")
      .attr("class", "scatter")
      .attr("d", d => symbolGenerator.type(shapeMap[d.condition])())
      .attr("transform", d => `translate(${xScale(d.area)}, ${yScale(d.D)})`)
      .attr("fill", d => colors[d.condition] || "#999")
      .attr("opacity", 0.7)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
    // Tooltip events
      .on("mouseover", function(event, d) {
        tooltip
          .style("opacity", 1)
          .html(`Disc: ${d.disc}<br>Area: ${d.area.toFixed(2)}<br>Lambda: ${d.D.toFixed(2)}<br>Condition: ${d.condition}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");    
    // Highlight on hover
        d3.select(this)
          .attr("opacity", 1)
          .attr("stroke-width", 2);
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
        d3.select(this)
          .attr("opacity", 0.7)
          .attr("stroke-width", 1);
      });

    // Top histogram
    Object.entries(colors).forEach(([condition, color]) => {
      if (!visibleConditions[condition]) return;
      const subset = filteredData.filter(d => d.condition === condition);
      if (subset.length === 0) return;

      const bins = d3.bin()
        .value(d => d.area)
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

    // Create legend items based on actual conditions in data
    const conditionsInData = [...new Set(scatterData.map(d => d.condition))];
    const legendItems = conditionsInData.map(condition => ({
      label: condition,
      color: colors[condition] || "#999"
    }));

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

      // Shape indicator (instead of rectangle)
      g.append("path")
        .attr("d", symbolGenerator.type(shapeMap[item.label])())
        .attr("transform", `translate(${5}, ${2})`)
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
      <h2>Wing Disc Area vs Standard Deviation (D)</h2>
      <div style={{ color: "green", marginBottom: "10px" }}>
        Loaded {scatterData.length} data points
      </div>
      <svg ref={svgRef} width={1000} height={800} style={{ border: "1px solid #ddd" }}></svg>
      
      {scatterData.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "20px", color: "#666" }}>
          Loading data...
        </div>
      )}
    </div>
  );
}