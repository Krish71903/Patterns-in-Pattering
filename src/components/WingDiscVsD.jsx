import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";
import ProfileLinePlot from "./ProfileLinePlot";

const colors = {
  standard: "#d95f02",
  hypoxia: "#7570b3",
  cold: "#1b9e77"
};

export default function WingDiscVsD({ onSelectionChange = () => {} }) {
  const svgRef = useRef(null);

  const [scatterData, setScatterData] = useState([]);
  const [profileData, setProfileData] = useState([]);
  const [selectedDisc, setSelectedDisc] = useState(null);
  const [selectedDiscInfo, setSelectedDiscInfo] = useState(null);
  const [selectedDiscProfile, setSelectedDiscProfile] = useState([]);
  const [visibleConditions, setVisibleConditions] = useState({
    standard: true,
    hypoxia: true,
    cold: true
  });
  const [selectedDiscIDs, setSelectedDiscIDs] = useState([]);

  // ------------------------------------------------------------
  // Load CSV data
  // ------------------------------------------------------------
  useEffect(() => {
    Promise.all([
      d3.csv("/data/mergedNormalizedGrad.csv"),
      d3.csv("/data/mergedRawGrad.csv")
    ])
      .then(([csvData, rawData]) => {
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

        // Profile data (raw gradients)
        const profiles = rawData.map((d) => ({
          disc: d.disc, 
          distance: +d.distance,
          value: +d.value,
          condition: d.condition
        }));

        console.log("Profile data loaded:", profiles.length, "points");
        setProfileData(profiles);
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

    const scatterMargin = { top: 120, right: 200, bottom: 40, left: 100 };
    const scatterSize = 500;
    const histWidth = 60;
    const histHeight = 60;

    // Tooltip div (single global div on body)
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
        .style("opacity", 0);
    }

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
      .style("font-size", "12px");

    mainGroup
      .append("g")
      .attr("transform", `translate(${scatterMargin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll("text")
      .style("font-size", "12px");

    // Labels
    mainGroup
      .append("text")
      .attr("x", scatterMargin.left + scatterSize / 2)
      .attr("y", scatterMargin.top + scatterSize + 50)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Area");

    mainGroup
      .append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -(scatterMargin.top + scatterSize / 2))
      .attr("y", scatterMargin.left - 60)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Lambda");

    mainGroup
      .append("text")
      .attr("x", scatterMargin.left + scatterSize / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .text("Wing Disc Area vs Lambda");

    // Shapes for conditions
    const symbolGenerator = d3.symbol().size(45);
    const shapeMap = {
      standard: d3.symbolCircle,
      hypoxia: d3.symbolTriangle,
      cold: d3.symbolSquare
    };

    const hasSelection = selectedDiscIDs.length > 0;
    const selectedSet = new Set(selectedDiscIDs);

    // Scatter points
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
      .attr("stroke", (d) =>
        d.disc === selectedDisc ? "#000" : "#fff"
      )
      .attr("stroke-width", (d) => (d.disc === selectedDisc ? 3 : 1))
      .attr("opacity", (d) => {
        if (!hasSelection) return 0.7;
        return selectedSet.has(d.disc) ? 0.9 : 0.15;
      })
      .style("cursor", "pointer")
      // click: select disc and show profile
      .on("click", function (event, d) {
        console.log("Clicked disc ID:", d.disc);

        if (d.disc === selectedDisc) {
          // deselect
          setSelectedDisc(null);
          setSelectedDiscInfo(null);
          setSelectedDiscProfile([]);
        } else {
          // select
          setSelectedDisc(d.disc);
        }
      })
      // tooltip events
      .on("mouseover", function (event, d) {
        tooltip
          .style("opacity", 1)
          .html(
            `Disc: ${d.disc}<br>Area: ${d.area.toFixed(
              2
            )}<br>Lambda: ${d.D.toFixed(2)}<br>Condition: ${d.condition}`
          )
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 10 + "px");

        d3.select(this)
          .attr("opacity", 1)
          .attr("stroke-width", 2);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 10 + "px");
      })
      .on("mouseout", function (event, d) {
        tooltip.style("opacity", 0);

        d3.select(this)
          .attr("stroke-width", d.disc === selectedDisc ? 3 : 1)
          .attr("opacity", () => {
            if (!hasSelection) return 0.7;
            return selectedSet.has(d.disc) ? 0.9 : 0.15;
          });
      });

    // ------- BRUSH (X-axis only, Area) -------
    const brush = d3
      .brushX()
      .extent([
        [scatterMargin.left, scatterMargin.top],
        [scatterMargin.left + scatterSize, scatterMargin.top + scatterSize]
      ])
      .on("brush end", (event) => {
        const sel = event.selection;

        if (!sel) {
          // Clear selection
          setSelectedDiscIDs([]);
          onSelectionChange([]);
          return;
        }

        const [x0, x1] = sel;
        const areaMin = xScale.invert(x0);
        const areaMax = xScale.invert(x1);

        const selected = filteredData
          .filter((d) => d.area >= areaMin && d.area <= areaMax)
          .map((d) => d.disc);

        setSelectedDiscIDs(selected);
        onSelectionChange(selected);
      });

    mainGroup.append("g").attr("class", "brush").call(brush);

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
    const legendX = scatterMargin.left + scatterSize + 30;
    const legendY = scatterMargin.top - 65;

    mainGroup
      .append("text")
      .attr("x", legendX)
      .attr("y", legendY - 20)
      .style("font-size", "16px")
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
        .attr("transform", `translate(${legendX}, ${legendY + i * 30})`)
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
        .style("font-size", "13px")
        .style("opacity", visibleConditions[item.label] ? 1 : 0.5)
        .text(item.label);
    });
  }, [
    scatterData,
    visibleConditions,
    selectedDisc,
    selectedDiscIDs,
    onSelectionChange
  ]);

  // ------------------------------------------------------------
  // When a disc is selected, filter profile data for that disc
  // ------------------------------------------------------------
  useEffect(() => {
    if (!selectedDisc || profileData.length === 0) {
      setSelectedDiscInfo(null);
      setSelectedDiscProfile([]);
      return;
    }

    const discInfo = scatterData.find((d) => d.disc === selectedDisc);
    if (!discInfo) {
      console.warn("Could not find disc info for:", selectedDisc);
      return;
    }

    const discProfile = profileData.filter((d) => d.disc === selectedDisc);

    console.log(
      `Found ${discProfile.length} profile points for disc: ${selectedDisc}`
    );

    if (discProfile.length === 0) {
      console.warn("No profile data found for disc:", selectedDisc);
    }

    setSelectedDiscInfo(discInfo);
    setSelectedDiscProfile(discProfile);
  }, [selectedDisc, profileData, scatterData]);

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div style={{ padding: "20px", backgroundColor: "#fff" }}>
      <svg
        ref={svgRef}
        width={1000}
        height={800}
        style={{ border: "1px solid #ddd" }}
      />
      {scatterData.length === 0 && (
        <div
          style={{ textAlign: "center", marginTop: "20px", color: "#666" }}
        >
          Loading data...
        </div>
      )}

      {selectedDisc &&
        selectedDiscInfo &&
        selectedDiscProfile.length > 0 && (
          <ProfileLinePlot
            selectedDisc={selectedDisc}
            discInfo={selectedDiscInfo}
            discProfile={selectedDiscProfile}
            colors={colors}
          />
        )}
    </div>
  );
}
