import * as d3 from "d3";
import React, { useEffect, useRef } from "react";

export default function ProfileLinePlot({ selectedDisc, discInfo, discProfile, colors }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!selectedDisc || !discProfile || discProfile.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Plot dimensions
    const margin = { top: 33, right: 33, bottom: 50, left: 58 };
    const width = 540;
    const height = 250;
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(discProfile, d => d.distance))
      .range([0, plotWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(discProfile, d => d.value) * 1.1])
      .range([plotHeight, 0]);

    // Background
    g.append("rect")
      .attr("width", plotWidth)
      .attr("height", plotHeight)
      .attr("fill", "#f9f9f9");

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(d3.axisLeft(yScale)
        .tickSize(-plotWidth)
        .tickFormat("")
      );

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${plotHeight})`)
      .call(d3.axisBottom(xScale))
      .style("font-size", "10px");

    g.append("g")
      .call(d3.axisLeft(yScale))
      .style("font-size", "10px");

    // Axis labels
    g.append("text")
      .attr("x", plotWidth / 2)
      .attr("y", plotHeight + 35)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .text("Relative Distance");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -plotHeight / 2)
      .attr("y", -42)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .text("Intensity Value");

    // Title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .style("font-size", "13px")
      .style("font-weight", "bold")
      .text(`Profile for ${selectedDisc} (${discInfo.condition})`);

    // Line
    const line = d3.line()
      .x(d => xScale(d.distance))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(discProfile)
      .attr("fill", "none")
      .attr("stroke", colors[discInfo.condition])
      .attr("stroke-width", 2)
      .attr("d", line);

  }, [selectedDisc, discProfile, discInfo, colors]);

  return (
    <div style={{ marginTop: "30px" }}>
      <svg ref={svgRef} width={600} height={250} style={{ border: "1px solid #ddd" }}></svg>
      <div style={{ textAlign: "center", marginTop: "10px", color: "#666", fontSize: "14px" }}>
        Click on a point again to hide the profile, or click another point to see its profile
      </div>
    </div>
  );
}

