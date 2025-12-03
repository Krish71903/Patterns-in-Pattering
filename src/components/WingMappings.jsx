import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

import mergedWingCoordsCSV from "../data/mergedWingCoords.csv";

const colors = {
  standard: "#d95f02",
  hypoxia: "#7570b3",
  cold: "#1b9e77"
};

const getGradientColor = (condition, position) => {
  switch (condition) {
    case "standard": 
      return d3.interpolateRgbBasis([
        "#ffa54f",  
        "#ff8c00",  
        "#d95f02",  
        "#b34700",  
        "#8b0000",  
        "#660000"   
      ])(position);
      
  case "hypoxia":
  return d3.interpolateRgbBasis([
    "#b4a7d6",  
    "#8e7cc3",  
    "#6a5acd",  
    "#4b0082",  
    "#2d004d",  
    "#1c0333"   
  ])(position);

    case "cold": 
      return d3.interpolateRgbBasis([
        "#9ACD32",  
        "#6b8e23",  
        "#228B22",  
        "#002d00"   // Very dark green
      ])(position);
      
    default: return "#ccc";
  }
};

// For backward compatibility, create an object with functions
const gradientScales = {
  standard: (position) => getGradientColor("standard", position),
  hypoxia: (position) => getGradientColor("hypoxia", position),
  cold: (position) => getGradientColor("cold", position)
};

// Define connections between points
const connections = [
  [1, 7], [2, 6], [2, 7], [3, 5], [3, 9],
  [4, 5], [4, 15], [5, 11], [6, 12], [7, 12],
  [8, 6], [8, 9], [8, 13], [9, 10], [10, 11],
  [10, 14], [11, 15], [12, 13], [13, 14], [14, 15]
];

// Helper function to calculate point color (using full range 0-1)
const calculatePointColor = (d, filterMode, centroidStats, overallCentroidRange) => {
  let normalizedSize;
  if (filterMode === "percentile") {
    // Convert to percentile within condition
    const stats = centroidStats[d.condition];
    if (stats && stats.values.length > 0) {
      const index = stats.values.findIndex(v => v >= d.centroidSize);
      normalizedSize = index === -1 ? 1 : index / stats.values.length;
    } else {
      normalizedSize = 0;
    }
  } else {
    // Use absolute value normalized to overall range
    const overallMin = overallCentroidRange[0];
    const overallMax = overallCentroidRange[1];
    if (overallMax === overallMin) {
      normalizedSize = 0.5; // Avoid division by zero
    } else {
      normalizedSize = (d.centroidSize - overallMin) / (overallMax - overallMin);
    }
  }
  
  // Use full range (0 to 1) for the new gradients
  const gradientPosition = Math.max(0, Math.min(1, normalizedSize));
  return gradientScales[d.condition](gradientPosition);
};

// Helper to create gradient stops for legend (full range: 0 to 1)
const createGradientStops = (condition) => {
  // Create 5 stops from 0 to 1
  const stops = d3.range(0, 1.01, 0.25); // 0, 0.25, 0.5, 0.75, 1.0
  return stops.map(stop => {
    return {
      offset: stop * 100,
      color: getGradientColor(condition, stop)
    };
  });
};
export default function WingCoordinates() {
  const svgRef = useRef();
  const [data, setData] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [focusLetter, setFocusLetter] = useState("");
  const [autoZoomedLetter, setAutoZoomedLetter] = useState("");
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);
  const [visibleConditions, setVisibleConditions] = useState({
    standard: true,
    hypoxia: true,
    cold: true
  });
  
  // Filter states with percentile/absolute mode
  const [filterMode, setFilterMode] = useState("percentile"); // "percentile" or "absolute"
  const [centroidFilters, setCentroidFilters] = useState({
    below: 0.1,
    above: 0.9,
    within: [0.00, 1.00]
  });
  const [sexFilters, setSexFilters] = useState({
    female: true,
    male: true
  });
  
  // Store centroid size data per condition for percentile calculations
  const [centroidStats, setCentroidStats] = useState({
    standard: { min: 0, max: 1, values: [] },
    hypoxia: { min: 0, max: 1, values: [] },
    cold: { min: 0, max: 1, values: [] }
  });
  
  // Store all centroid values for overall stats
  const [allCentroidValues, setAllCentroidValues] = useState([]);
  const [overallCentroidRange, setOverallCentroidRange] = useState([0, 1]);

  // Zoom state
  const [transform, setTransform] = useState(d3.zoomIdentity);

  // Load data and calculate statistics
  useEffect(() => {
    d3.csv(mergedWingCoordsCSV).then(csvData => {
      console.log("Wing coordinates loaded:", csvData.length);
      
      // Group data by condition for percentile calculations
      const conditionGroups = {
        standard: [],
        hypoxia: [],
        cold: []
      };
      
      const allCentroids = [];
      const processed = csvData.map(row => {
        const condition = row.Condition?.toLowerCase() || "standard";
        const normalizedCondition = condition.includes("hypo") ? "hypoxia" : 
                                  condition.includes("cold") || condition.includes("17c") || condition.includes("low") ? "cold" : 
                                  "standard";
        
        const centroidSize = +row['Centroid.Size'];
        allCentroids.push(centroidSize);
        conditionGroups[normalizedCondition].push(centroidSize);
        
        const points = [];
        for (let i = 1; i <= 15; i++) {
          points.push({
            pointId: i,
            letter: String.fromCharCode(64 + i),
            x: +row[`X${i}`],
            y: +row[`Y${i}`],
            id: row.Id,
            condition: normalizedCondition,
            sex: row.Sex,
            centroidSize: centroidSize,
            logCentroidSize: +row['Log.Centroid.Size']
          });
        }
        return points;
      }).flat();

      // Calculate statistics for each condition
      const stats = {};
      Object.keys(conditionGroups).forEach(condition => {
        const values = conditionGroups[condition];
        if (values.length > 0) {
          stats[condition] = {
            min: d3.min(values),
            max: d3.max(values),
            values: values.sort((a, b) => a - b)
          };
        }
      });
      
      // Overall statistics
      setAllCentroidValues(allCentroids.sort((a, b) => a - b));
      const overallMin = d3.min(allCentroids);
      const overallMax = d3.max(allCentroids);
      setOverallCentroidRange([overallMin, overallMax]);
      setCentroidStats(stats);
      
      console.log("Processed points:", processed.length);
      console.log("Centroid stats:", stats);
      
      setData(processed);
    }).catch(err => console.error("Error loading wing coordinates:", err));
  }, []);

  // Convert between percentile and absolute values
  const convertToPercentile = (value, condition = "overall") => {
    if (condition === "overall") {
      if (allCentroidValues.length === 0) return 0;
      const index = allCentroidValues.findIndex(v => v >= value);
      return index === -1 ? 1 : index / allCentroidValues.length;
    } else {
      const stats = centroidStats[condition];
      if (!stats || stats.values.length === 0) return 0;
      const index = stats.values.findIndex(v => v >= value);
      return index === -1 ? 1 : index / stats.values.length;
    }
  };

  // Get current filter values in appropriate units
  const getFilterValue = (value, isBelow = false) => {
    if (filterMode === "percentile") {
      return value;
    } else {
      // For absolute mode, we need to handle "below" and "above" differently
      if (isBelow) {
        const minValues = Object.values(centroidStats).map(s => s.min).filter(v => v !== undefined);
        const overallMin = minValues.length > 0 ? d3.min(minValues) : overallCentroidRange[0];
        return overallMin + value * (overallCentroidRange[1] - overallMin);
      } else {
        const maxValues = Object.values(centroidStats).map(s => s.max).filter(v => v !== undefined);
        const overallMax = maxValues.length > 0 ? d3.max(maxValues) : overallCentroidRange[1];
        const overallMin = d3.min(Object.values(centroidStats).map(s => s.min).filter(v => v !== undefined)) || overallCentroidRange[0];
        return overallMin + value * (overallMax - overallMin);
      }
    }
  };

  // Apply filters to data
  const getFilteredData = () => {
    if (data.length === 0) return [];

    return data.filter(d => {
      if (!visibleConditions[d.condition]) return false;
      
      const sex = d.sex === 'F' ? 'female' : 'male';
      if (!sexFilters[sex]) return false;
      
      let normalizedSize;
      if (filterMode === "percentile") {
        // Use condition-specific percentile
        normalizedSize = convertToPercentile(d.centroidSize, d.condition);
      } else {
        // Use absolute value normalized to overall range
        const overallMin = overallCentroidRange[0];
        const overallMax = overallCentroidRange[1];
        normalizedSize = (d.centroidSize - overallMin) / (overallMax - overallMin);
      }
      
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
      newWithin[index] = Math.max(0, Math.min(1, +value));
      
      if (index === 0 && newWithin[0] > newWithin[1]) {
        newWithin[1] = newWithin[0];
      } else if (index === 1 && newWithin[1] < newWithin[0]) {
        newWithin[0] = newWithin[1];
      }
      
      return { ...prev, within: newWithin };
    });
  };

  // Handle manual input changes
  const handleManualInputChange = (field, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    if (field === 'below' || field === 'above') {
      setCentroidFilters(prev => ({
        ...prev,
        [field]: Math.max(0, Math.min(1, numValue))
      }));
    } else if (field === 'withinMin' || field === 'withinMax') {
      const index = field === 'withinMin' ? 0 : 1;
      handleWithinChange(index, Math.max(0, Math.min(1, numValue)));
    }
  };

  useEffect(() => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 875;
    const height = 680;
    const margin = { top: 36, right: 12, bottom: 24, left: 36 };

    const mainGroup = svg.append("g");
    const plotCenterX = (margin.left + width - margin.right) / 2;
    const plotCenterY = (margin.top + height - margin.bottom) / 2;

    // Get all coordinates for scaling - use ALL data for consistent scaling
    const allCoords = data.map(d => [d.x, d.y]);
    const xExtent = d3.extent(allCoords, d => d[0]);
    const yExtent = d3.extent(allCoords, d => d[1]);

    // Calculate equal scaling for X and Y axes
    const xRange = xExtent[1] - xExtent[0];
    const yRange = yExtent[1] - yExtent[0];
    const maxRange = Math.max(xRange, yRange);
    
    // Center the data in the plot area
    const xCenter = (xExtent[0] + xExtent[1]) / 2;
    const yCenter = (yExtent[0] + yExtent[1]) / 2;
    
    const xDomain = [xCenter - maxRange/2, xCenter + maxRange/2];
    const yDomain = [yCenter - maxRange/2, yCenter + maxRange/2];

    // Create scales with equal domains
    const xScale = d3.scaleLinear()
      .domain(xDomain)
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .range([height - margin.bottom, margin.top]);

    // Apply zoom transform
    const zoomedXScale = transform.rescaleX(xScale);
    const zoomedYScale = transform.rescaleY(yScale);

    // Setup zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 20])
      .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
      .on("zoom", (event) => {
        // If user is manually zooming with the mouse wheel, disable auto-zoom until a new letter is chosen
        if (event.sourceEvent && event.sourceEvent.type === "wheel") {
          setAutoZoomEnabled(false);
        }
        setTransform(event.transform);
      });

    svg.call(zoom);

    // Auto-zoom to selected letter cluster (only once per selection, and only while enabled)
    if (focusLetter && autoZoomEnabled && focusLetter !== autoZoomedLetter) {
      const focusPoints = filteredData.filter(d => d.letter === focusLetter);
      if (focusPoints.length > 0) {
        const xVals = focusPoints.map(d => d.x);
        const yVals = focusPoints.map(d => d.y);

        const xMin = d3.min(xVals);
        const xMax = d3.max(xVals);
        const yMin = d3.min(yVals);
        const yMax = d3.max(yVals);

        const focusXSpan = xMax - xMin || 1;
        const focusYSpan = yMax - yMin || 1;
        const fullXSpan = xDomain[1] - xDomain[0] || 1;
        const fullYSpan = yDomain[1] - yDomain[0] || 1;

        const scaleFactor = 1 / Math.max(focusXSpan / fullXSpan, focusYSpan / fullYSpan);
        const clampedScale = Math.max(1, Math.min(20, scaleFactor));

        const cx = (xMin + xMax) / 2;
        const cy = (yMin + yMax) / 2;

        const cxScreen = xScale(cx);
        const cyScreen = yScale(cy);

        const t = svg
          .transition()
          .duration(200)
          .call(
            zoom.transform,
            d3.zoomIdentity
              .translate(plotCenterX, plotCenterY)
              .scale(clampedScale)
              .translate(-cxScreen, -cyScreen)
          );

        t.on("end", () => {
          setAutoZoomedLetter(focusLetter);
        });
      }
    } else if (!focusLetter) {
      // Reset zoom to default view when "All letters" is selected
      if (autoZoomedLetter || transform.k !== 1 || transform.x !== 0 || transform.y !== 0) {
        svg
          .transition()
          .duration(200)
          .call(zoom.transform, d3.zoomIdentity);
      }
      // Clear auto-zoom state when reset to all letters
      setAutoZoomedLetter("");
    }

    // Axes with zoom (equal ticks for both axes)
    mainGroup.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(zoomedXScale).ticks(6))
      .selectAll("text")
      .style("font-size", "8px");

    mainGroup.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(zoomedYScale).ticks(6))
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

    // Create gradients for each condition (darker half only)
    const defs = svg.append("defs");
    
    Object.keys(gradientScales).forEach(condition => {
      const gradientId = `gradient-${condition}`;
      
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

      // Create gradient stops for darker half (0.5 to 1.0)
      const stops = createGradientStops(condition);
      gradient.selectAll("stop")
        .data(stops)
        .enter().append("stop")
        .attr("offset", d => `${d.offset}%`)
        .attr("stop-color", d => d.color);
    });

    // Draw connections for ALL selected IDs with matching stroke colors
    Array.from(selectedIds).forEach(selectedId => {
      const selectedWingData = filteredData.filter(d => d.id === selectedId);
      const pointMap = {};
      selectedWingData.forEach(d => {
        pointMap[d.pointId] = d;
      });

      connections.forEach(([p1, p2]) => {
        if (pointMap[p1] && pointMap[p2]) {
          // Get color from first point (matches point color)
          const pointColor = calculatePointColor(pointMap[p1], filterMode, centroidStats, overallCentroidRange);
          mainGroup.append("line")
            .attr("x1", zoomedXScale(pointMap[p1].x))
            .attr("y1", zoomedYScale(pointMap[p1].y))
            .attr("x2", zoomedXScale(pointMap[p2].x))
            .attr("y2", zoomedYScale(pointMap[p2].y))
            .attr("stroke", pointColor)
            .attr("stroke-width", 2)
            .attr("opacity", 0.9);
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

        let normalizedSize;
        let sizeDisplay;
        if (filterMode === "percentile") {
          normalizedSize = convertToPercentile(d.centroidSize, d.condition);
          sizeDisplay = `${(normalizedSize * 100).toFixed(1)}% (${d.centroidSize.toFixed(2)})`;
        } else {
          normalizedSize = (d.centroidSize - overallCentroidRange[0]) / (overallCentroidRange[1] - overallCentroidRange[0]);
          sizeDisplay = `${d.centroidSize.toFixed(2)} (${(normalizedSize * 100).toFixed(1)}%)`;
        }
        
        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>ID:</strong> ${d.id}</div>
            <div><strong>Point:</strong> ${d.letter} (${d.pointId})</div>
            <div><strong>Condition:</strong> ${d.condition}</div>
            <div><strong>Sex:</strong> ${d.sex === 'F' ? 'Female' : 'Male'}</div>
            <div><strong>Centroid Size (${filterMode}):</strong> ${sizeDisplay}</div>
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

    // Add circles for points with gradient colors - stroke matches fill for selected
    points.append("circle")
      .attr("r", 6)
      .attr("fill", d => calculatePointColor(d, filterMode, centroidStats, overallCentroidRange))
      .attr("stroke", d => selectedIds.has(d.id) ? calculatePointColor(d, filterMode, centroidStats, overallCentroidRange) : "#fff")
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

    // Condition Filter Legend with Gradient Bars (darker half only: 0.5 to 1.0)
    const legendX = 60;
    const legendY = margin.top + 25;

    mainGroup.append("text")
      .attr("x", legendX)
      .attr("y", legendY - 12)
      .style("font-size", "14px")
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

      // Gradient bar using the pre-defined gradient
      const gradientId = `gradient-${condition}`;
      
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
      .attr("x", 10)
      .attr("y", 20)
      .style("font-size", "14px")
      .style("fill", "#000")
      .text("Click any point to map the wing");

    return () => {
      tooltip.remove();
    };
  }, [data, selectedIds, visibleConditions, centroidFilters, sexFilters, filterMode, centroidStats, overallCentroidRange, transform, focusLetter, autoZoomedLetter, autoZoomEnabled]);

  // Format display value based on filter mode
  const formatDisplayValue = (value, isBelow = false) => {
    if (filterMode === "percentile") {
      return `${(value * 100).toFixed(1)}%`;
    } else {
      const absoluteValue = getFilterValue(value, isBelow);
      return absoluteValue.toFixed(2);
    }
  };

  // Parse manual input and update filters
  const handleManualInput = (field, inputValue) => {
    let value;
    if (filterMode === "percentile") {
      // Parse percentage input
      const match = inputValue.match(/(\d+(\.\d+)?)\s*%/);
      if (match) {
        value = parseFloat(match[1]) / 100;
      } else {
        value = parseFloat(inputValue);
        if (value > 1) value = value / 100; // Assume it's a percentage without %
      }
    } else {
      value = parseFloat(inputValue);
      // Convert to normalized value
      if (field === 'below') {
        const overallMin = overallCentroidRange[0];
        value = (value - overallMin) / (overallCentroidRange[1] - overallMin);
      } else {
        const maxValues = Object.values(centroidStats).map(s => s.max).filter(v => v !== undefined);
        const overallMax = maxValues.length > 0 ? d3.max(maxValues) : overallCentroidRange[1];
        const overallMin = d3.min(Object.values(centroidStats).map(s => s.min).filter(v => v !== undefined)) || overallCentroidRange[0];
        value = (value - overallMin) / (overallMax - overallMin);
      }
    }
    
    if (!isNaN(value)) {
      handleManualInputChange(field, Math.max(0, Math.min(1, value)));
    }
  };

  return (
    <div style={{ padding: "8px", backgroundColor: "#fff" }}>
      <h2>Wing Coordinate Landmarks</h2>
      
      {/* Filter Controls */}
      <div style={{ 
        marginBottom: "10px", 
        padding: "10px", 
        backgroundColor: "#f8f9fa", 
        borderRadius: "5px",
        border: "1px solid #dee2e6"
      }}>

        {/* Auto-zoom to letter cluster */}
        <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontWeight: "bold", fontSize: "12px" }}>Zoom to:</label>
          <select
            value={focusLetter}
            onChange={(e) => {
              const value = e.target.value;
              setFocusLetter(value);
              setAutoZoomedLetter("");
              setAutoZoomEnabled(true);
            }}
            style={{
              fontSize: "12px",
              padding: "4px 6px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff"
            }}
          >
            <option value="">All landmarks (reset zoom)</option>
            {Array.from({ length: 15 }, (_, i) => String.fromCharCode(65 + i)).map(letter => (
              <option key={letter} value={letter}>
                {letter}
              </option>
            ))}
          </select>
          <span style={{ fontSize: "12px", color: "#666" }}>
            Choose a landmark letter to zoom in on all points of that tag.
          </span>
        </div>
        
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
        
        {/* Filter Mode Toggle */}
        <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "15px" }}>
          <label style={{ fontWeight: "bold", fontSize: "12px" }}>Filter size by:</label>
          <div style={{ display: "flex", gap: "10px" }}>
            <label style={{ fontSize: "12px" }}>
              <input
                type="radio"
                name="filterMode"
                checked={filterMode === "percentile"}
                onChange={() => setFilterMode("percentile")}
                style={{ marginRight: "4px" }}
              />
              Percentile (per condition)
            </label>
            <label style={{ fontSize: "12px" }}>
              <input
                type="radio"
                name="filterMode"
                checked={filterMode === "absolute"}
                onChange={() => setFilterMode("absolute")}
                style={{ marginRight: "2px" }}
              />
              Absolute Value
            </label>
          </div>
                  <div style={{marginTop: "4px", fontSize: "12px", color: "#666"}}>
          {filterMode === "percentile" ? 
            "Values relative to each condition's distribution (0% = smallest, 100% = largest)." :
            "Values are actual centroid size measurements."
          }
        </div>
        </div>

        {/* Centroid Size Filters */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" }}>
          {/* Below Filter */}
          <div>
            <label style={{ fontWeight: "bold", marginBottom: "4px", marginRight: "4px", fontSize: "12px" }}>
              Show below: 
            </label>
            <input
                type="text"
                value={formatDisplayValue(centroidFilters.below, true)}
                onChange={(e) => handleManualInput('below', e.target.value)}
                style={{ 
                  width: "40px", 
                  padding: "2px 4px", 
                  fontSize: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "2px"
                }}
              />
            <div style={{ display: "flex", marginTop: "5px", gap: "8px", alignItems: "center" }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={centroidFilters.below}
                onChange={(e) => setCentroidFilters(prev => ({ ...prev, below: +e.target.value }))}
                style={{ flex: 1, height: "6px" }}
              />
            </div>
          </div>

          {/* Above Filter */}
          <div>
            <label style={{ fontWeight: "bold", marginBottom: "4px", marginRight: "4px", fontSize: "12px" }}>
              And above: 
            </label>
            <input
                type="text"
                value={formatDisplayValue(centroidFilters.above, false)}
                onChange={(e) => handleManualInput('above', e.target.value)}
                style={{ 
                  width: "40px", 
                  padding: "2px 4px", 
                  fontSize: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "3px"
                }}
              />
            <div style={{ display: "flex", marginTop: "5px", gap: "8px", alignItems: "center" }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={centroidFilters.above}
                onChange={(e) => setCentroidFilters(prev => ({ ...prev, above: +e.target.value }))}
                style={{ 
                  flex: 1,
                  height: "8px",
                  background: `linear-gradient(to right, #4CAF50 ${centroidFilters.above * 100}%, #ddd ${centroidFilters.above * 100}%)`
                }}
              />
            </div>
          </div>

          {/* Within Filter - Dual range slider */}
          
          <div>
            <label style={{ fontWeight: "bold", marginBottom: "4px", marginRight: "2px", fontSize: "12px" }}>
              Within: 
              <input
                type="text"
                value={formatDisplayValue(centroidFilters.within[0])}
                onChange={(e) => handleManualInput('withinMin', e.target.value)}
                style={{ 
                  width: "40px", 
                  padding: "2px 4px", 
                  marginLeft: "4px",
                  marginRight: "4px",
                  fontSize: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "3px"
                }}
                placeholder="Min"
              />
              <span style={{ fontSize: "12px", lineHeight: "24px" }}>to</span>
              <input
                type="text"
                value={formatDisplayValue(centroidFilters.within[1])}
                onChange={(e) => handleManualInput('withinMax', e.target.value)}
                style={{ 
                  width: "45px", 
                  marginLeft: "4px",
                  marginRight: "4px",
                  padding: "4px 4px", 
                  fontSize: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "3px"
                }}
                placeholder="Max"
              />
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
            {/* Manual inputs for within range */}
          </div>
        </div>
      </div>
      
      <div style={{ color: "green", marginBottom: "10px", fontSize: "12px" }}>
        Showing {getFilteredData().length} of {data.length} landmark points
        {selectedIds.size > 0 && ` • ${selectedIds.size} wing(s) selected`}
      </div>
      
      <svg
        ref={svgRef}
        width={875}
        height={680}
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
                fontSize: "12px"
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