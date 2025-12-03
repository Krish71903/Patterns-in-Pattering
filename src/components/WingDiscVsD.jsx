import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

import mergedNormalizedGradCSV from "../data/mergedNormalizedGrad.csv";

const colors = {
  standard: "#d95f02",
  hypoxia: "#7570b3",
  cold: "#1b9e77"
};

export default function WingDiscVsD({ onSelectionChange = () => {} }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [scatterData, setScatterData] = useState([]);
  const [visibleConditions, setVisibleConditions] = useState({
    standard: true,
    hypoxia: true,
    cold: true
  });
  const [selectedDiscIDs, setSelectedDiscIDs] = useState([]);
  const [brushSelection, setBrushSelection] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 900 });

  // Handle responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Account for side panel (150px) + gap (15px) + padding
        const sidePanelWidth = 165;
        const availableWidth = containerWidth - sidePanelWidth - 20; // 20px for container padding
        const width = Math.max(availableWidth * 0.9, 400); // Use 90% of available, min 400px
        const height = width * 0.9; // Maintain aspect ratio
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Small delay to ensure container is rendered
    const timeoutId = setTimeout(updateDimensions, 100);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeoutId);
    };
  }, []);

  // Add CSS for brush styling - hide selection rectangle
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .brush .selection {
        fill: transparent !important;
        fill-opacity: 0 !important;
        stroke: none !important;
        pointer-events: none !important;
      }
      .brush .handle {
        display: none !important;
      }
      .brush .overlay {
        fill: none !important;
        pointer-events: all !important;
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // ------------------------------------------------------------
  // Load CSV data
  // ------------------------------------------------------------
  useEffect(() => {
    d3.csv(mergedNormalizedGradCSV)
      .then((csvData) => {
        console.log("CSV loaded successfully!", csvData);

        // Scatter data
        const processed = csvData
          .map((d) => ({
            disc: d.disc,
            area: +d.area, // already log-transformed
            A: +d.A,
            B: +d.B,
            C: +d.C,
            D: +d.D,
            condition: d.condition
          }))
          .filter(
            (d) =>
              !isNaN(d.area) &&
              !isNaN(d.D) &&
              isFinite(d.area) &&
              isFinite(d.D)
          );

        console.log("Processed data points:", processed.length);
        console.log(
          "Conditions found:",
          [...new Set(processed.map((d) => d.condition))]
        );
        setScatterData(processed);
      })
      .catch((err) => {
        console.error("Error loading data:", err);
      });
  }, []);

  // ------------------------------------------------------------
  // Draw scatterplot, histograms, legend & brush
  // ------------------------------------------------------------
  useEffect(() => {
    if (scatterData.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const mainGroup = svg.append("g");

    const scatterMargin = { top: 72, right: 120, bottom: 24, left: 60 };
    const scatterSize = Math.min(dimensions.width - scatterMargin.left - scatterMargin.right - 50, dimensions.height - scatterMargin.top - scatterMargin.bottom - 50);
    const histWidth = 36;
    const histHeight = 36;

    // Create tooltip (ONCE at the top)
    let tooltip = d3.select("#wingdisc-tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("id", "wingdisc-tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "rgba(0,0,0,0.75)")
        .style("color", "#fff")
        .style("padding", "6px 8px")
        .style("border-radius", "4px")
        .style("font-size", "11px")
        .style("opacity", 0)
        .style("z-index", "1000")
        .style("white-space", "nowrap");
    }

    // Throttle tooltip position updates for better performance
    let lastTooltipUpdate = 0;
    const tooltipUpdateThrottle = 16; // ~60fps
    
    // Cache tooltip HTML to avoid regenerating on every mousemove
    let cachedTooltipHtml = null;
    let cachedDiscId = null;

    // Filter data by visible conditions
    const filteredData = scatterData.filter(
      (d) => visibleConditions[d.condition]
    );

    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(scatterData, (d) => d.area))
      .nice()
      .range([scatterMargin.left, scatterMargin.left + scatterSize]);

    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(scatterData, (d) => d.D))
      .nice()
      .range([scatterMargin.top + scatterSize, scatterMargin.top]);

    // Axes
    mainGroup
      .append("g")
      .attr("transform", `translate(0,${scatterMargin.top + scatterSize})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .selectAll("text")
      .style("font-size", "10px");

    mainGroup
      .append("g")
      .attr("transform", `translate(${scatterMargin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll("text")
      .style("font-size", "10px");

    // Labels
    mainGroup
      .append("text")
      .attr("x", scatterMargin.left + scatterSize / 2)
      .attr("y", scatterMargin.top + scatterSize + 30)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Area");

    mainGroup
      .append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -(scatterMargin.top + scatterSize / 2))
      .attr("y", scatterMargin.left - 36)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Lambda");

    // Title is now in the JSX return statement

    // Shapes for conditions - slightly larger for better hover accuracy
    const symbolGenerator = d3.symbol().size(40);
    const shapeMap = {
      standard: d3.symbolCircle,
      hypoxia: d3.symbolTriangle,
      cold: d3.symbolSquare
    };

    const hasSelection = selectedDiscIDs.length > 0;
    const selectedSet = new Set(selectedDiscIDs);

    // ------- 2D BRUSH (X and Y axes) -------
    // Create brush FIRST so its overlay is on top and can capture all events
    const brushGroup = mainGroup.append("g").attr("class", "brush");
    
    const brush = d3
      .brush()
      .extent([
        [scatterMargin.left, scatterMargin.top],
        [scatterMargin.left + scatterSize, scatterMargin.top + scatterSize]
      ])
      .on("start", (event) => {
        // Prevent click events on scatter points when brushing starts
        if (event.sourceEvent) {
          event.sourceEvent.preventDefault();
          event.sourceEvent.stopPropagation();
        }
        // Hide tooltip when brushing starts
        tooltip.style("opacity", 0);
        // Completely disable hit area interactions during brushing
        hitAreaGroup.style("pointer-events", "none");
      })
      .on("brush", (event) => {
        // Update selection in real-time for smooth brushing
        const sel = event.selection;
        if (sel) {
          const [[x0, y0], [x1, y1]] = sel;
          // Ensure we get min/max correctly regardless of drag direction
          const areaMin = Math.min(xScale.invert(x0), xScale.invert(x1));
          const areaMax = Math.max(xScale.invert(x0), xScale.invert(x1));
          // Y axis is inverted: top (smaller y screen coord) = larger D value
          const dMin = Math.min(yScale.invert(y0), yScale.invert(y1));
          const dMax = Math.max(yScale.invert(y0), yScale.invert(y1));

          const selected = filteredData
            .filter((d) => 
              d.area >= areaMin && 
              d.area <= areaMax &&
              d.D >= dMin &&
              d.D <= dMax
            )
            .map((d) => d.disc);

          setSelectedDiscIDs(selected);
          setBrushSelection({
            area: [areaMin, areaMax],
            d: [dMin, dMax]
          });
          onSelectionChange(selected);
        } else {
          // Clear selection if no selection
          setSelectedDiscIDs([]);
          setBrushSelection(null);
          onSelectionChange([]);
        }
      })
      .on("end", (event) => {
        // Selection is already updated in real-time during brush event
        // Just re-enable hit area interactions after brush ends
        hitAreaGroup.style("pointer-events", "all");
      });

    brushGroup.call(brush);

    // Scatter points with tooltip functionality
    // Create invisible larger hit areas for better hover accuracy
    // These are placed AFTER the brush so brush overlay is on top
    const hitAreaGroup = mainGroup.append("g").attr("class", "hit-areas");
    hitAreaGroup
      .selectAll("circle.hit-area")
      .data(filteredData)
      .join("circle")
      .attr("class", "hit-area")
      .attr("cx", (d) => xScale(d.area))
      .attr("cy", (d) => yScale(d.D))
      .attr("r", 8) // Larger hit area for easier hovering
      .attr("fill", "transparent")
      .attr("stroke", "none")
      .style("pointer-events", "all")
      // hover: show tooltip on hit area
      .on("mouseover", function (event, d) {
        // Only regenerate HTML if disc changed
        if (cachedDiscId !== d.disc) {
          cachedTooltipHtml = `Disc: ${d.disc}<br>Area: ${d.area.toFixed(2)}<br>Lambda: ${d.D.toFixed(2)}<br>Condition: ${d.condition}`;
          cachedDiscId = d.disc;
        }
        
        tooltip
          .style("opacity", 1)
          .html(cachedTooltipHtml)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
        
        lastTooltipUpdate = performance.now();
      })
      .on("mousemove", function(event) {
        const now = performance.now();
        // Throttle position updates only, not content
        if (now - lastTooltipUpdate < tooltipUpdateThrottle) return;
        lastTooltipUpdate = now;
        
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
        cachedDiscId = null;
        cachedTooltipHtml = null;
      });

    // Then create the visible scatter points
    mainGroup
      .selectAll("path.scatter")
      .data(filteredData)
      .join("path")
      .attr("class", "scatter")
      .attr("d", (d) =>
        symbolGenerator.type(shapeMap[d.condition] || d3.symbolCircle)()
      )
      .attr("transform", (d) => `translate(${xScale(d.area)}, ${yScale(d.D)})`)
      .attr("fill", (d) => colors[d.condition] || "#999")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("opacity", (d) => {
        if (!hasSelection) return 0.7;
        return selectedSet.has(d.disc) ? 0.9 : 0.15;
      })
      .style("pointer-events", "none"); // Let hit area handle events

    // Restore brush selection if it exists
    if (brushSelection && brushSelection.area && brushSelection.d) {
      const [areaMin, areaMax] = brushSelection.area;
      const [dMin, dMax] = brushSelection.d;
      const x0 = xScale(areaMin);
      const x1 = xScale(areaMax);
      const y0 = yScale(dMax); // dMax maps to top (smaller y screen coord)
      const y1 = yScale(dMin); // dMin maps to bottom (larger y screen coord)
      
      // Only restore if the selection is still valid
      if (isFinite(x0) && isFinite(x1) && isFinite(y0) && isFinite(y1)) {
        brush.move(brushGroup, [[x0, y0], [x1, y1]]);
      }
    }

    // Hide brush handles and selection rectangle
    brushGroup.selectAll(".handle")
      .style("display", "none");
    
    brushGroup.selectAll(".selection")
      .attr("fill", "transparent")
      .attr("fill-opacity", 0)
      .attr("stroke", "none");

    // Top histogram (by condition)
    Object.entries(colors).forEach(([condition, color]) => {
      if (!visibleConditions[condition]) return;
      const subset = filteredData.filter((d) => d.condition === condition);
      if (subset.length === 0) return;

      const bins = d3
        .bin()
        .value((d) => d.area)
        .domain(xScale.domain())
        .thresholds(20)(subset);

      const yH = d3
        .scaleLinear()
        .domain([0, d3.max(bins, (d) => d.length) || 0])
        .range([scatterMargin.top, scatterMargin.top - histHeight]);

      mainGroup
        .selectAll(`path.hist-top-${condition}`)
        .data([bins])
        .join("path")
        .attr(
          "d",
          d3
            .area()
            .x((d) => xScale(((d.x0 || 0) + (d.x1 || 0)) / 2))
            .y0(scatterMargin.top)
            .y1((d) => yH(d.length))
            .curve(d3.curveBasis)
        )
        .attr("fill", color)
        .attr("opacity", 0.4);
    });

    // Right histogram (by D)
    Object.entries(colors).forEach(([condition, color]) => {
      if (!visibleConditions[condition]) return;
      const subset = filteredData.filter((d) => d.condition === condition);
      if (subset.length === 0) return;

      const bins = d3
        .bin()
        .value((d) => d.D)
        .domain(yScale.domain())
        .thresholds(15)(subset);

      const xH = d3
        .scaleLinear()
        .domain([0, d3.max(bins, (d) => d.length) || 0])
        .range([
          scatterMargin.left + scatterSize,
          scatterMargin.left + scatterSize + histWidth
        ]);

      mainGroup
        .selectAll(`path.hist-right-${condition}`)
        .data([bins])
        .join("path")
        .attr(
          "d",
          d3
            .area()
            .x0(scatterMargin.left + scatterSize)
            .x1((d) => xH(d.length))
            .y((d) => yScale(((d.x0 || 0) + (d.x1 || 0)) / 2))
            .curve(d3.curveBasis)
        )
        .attr("fill", color)
        .attr("opacity", 0.4);
    });

    // Legend (conditions)
    const legendX = scatterMargin.left + scatterSize + 18;
    const legendY = scatterMargin.top - 39;

    mainGroup
      .append("text")
      .attr("x", legendX)
      .attr("y", legendY - 12)
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Condition");

    const conditionsInData = [
      ...new Set(scatterData.map((d) => d.condition))
    ];
    const legendItems = conditionsInData.map((condition) => ({
      label: condition,
      color: colors[condition] || "#999"
    }));

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
        .attr("y", -6)
        .attr("width", 15)
        .attr("height", 15)
        .attr(
          "fill",
          visibleConditions[item.label] ? item.color : "white"
        )
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

      g.append("path")
        .attr(
          "d",
          symbolGenerator.type(
            shapeMap[item.label] || d3.symbolCircle
          )()
        )
        .attr("transform", `translate(5, 2)`)
        .attr("fill", item.color)
        .attr("opacity", visibleConditions[item.label] ? 1 : 0.3);

      g.append("text")
        .attr("x", 15)
        .attr("y", 7)
        .style("font-size", "10px")
        .style("opacity", visibleConditions[item.label] ? 1 : 0.5)
        .text(item.label);
    });
  }, [
    scatterData,
    visibleConditions,
    selectedDiscIDs,
    brushSelection,
    onSelectionChange,
    dimensions
  ]);

  // Format range display
  const formatRange = (range) => {
    if (!range) return null;
    return `${range[0].toFixed(2)} - ${range[1].toFixed(2)}`;
  };

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div ref={containerRef} style={{ padding: "10px", backgroundColor: "#fff", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <h2 style={{ marginBottom: "10px", marginTop: "0" }}>Wing Disc Area vs Lambda</h2>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "15px", width: "100%", justifyContent: "center", flexWrap: "nowrap" }}>
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ 
            border: "1px solid #ddd",
            maxWidth: "100%",
            height: "auto",
            flexShrink: 1,
            minWidth: 0
          }}
        />
        <div style={{ 
          marginTop: "72px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "150px"
        }}>
          <div style={{ 
            padding: "8px 12px", 
            backgroundColor: "#f8f9fa", 
            borderRadius: "5px",
            fontSize: "13px",
            width: "100%",
            boxSizing: "border-box"
          }}>
            <div style={{ marginBottom: "8px" }}>
              <strong>Area range:</strong><br />
              {brushSelection ? formatRange(brushSelection.area) : "—"}
            </div>
            <div>
              <strong>D range:</strong><br />
              {brushSelection ? formatRange(brushSelection.d) : "—"}
            </div>
          </div>
          <div style={{ 
            padding: "8px 12px", 
            backgroundColor: "#f8f9fa", 
            borderRadius: "5px",
            fontSize: "12px",
            color: "#555",
            width: "100%",
            boxSizing: "border-box",
            wordWrap: "break-word",
            overflowWrap: "break-word"
          }}>
            <strong>Instructions:</strong><br />
            Brush slowly over the points in X or Y direction to select discs.
          </div>
        </div>
      </div>
      {scatterData.length === 0 && (
        <div
          style={{ textAlign: "center", marginTop: "20px", color: "#666" }}
        >
          Loading data...
        </div>
      )}
    </div>
  );
}