import * as d3 from "d3";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";

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
        "#002d00"   
      ])(position);
      
    default: return "#ccc";
  }
};

const gradientScales = {
  standard: (position) => getGradientColor("standard", position),
  hypoxia: (position) => getGradientColor("hypoxia", position),
  cold: (position) => getGradientColor("cold", position)
};

const connections = [
  [1, 7], [2, 6], [2, 7], [3, 5], [3, 9],
  [4, 5], [4, 15], [5, 11], [6, 12], [7, 12],
  [8, 6], [8, 9], [8, 13], [9, 10], [10, 11],
  [10, 14], [11, 15], [12, 13], [13, 14], [14, 15]
];

const calculatePointColor = (d, filterMode, centroidStats, overallCentroidRange) => {
  let normalizedSize;
  if (filterMode === "percentile") {
    const stats = centroidStats[d.condition];
    if (stats && stats.values.length > 0) {
      const index = stats.values.findIndex(v => v >= d.centroidSize);
      normalizedSize = index === -1 ? 1 : index / stats.values.length;
    } else {
      normalizedSize = 0;
    }
  } else {
    const overallMin = overallCentroidRange[0];
    const overallMax = overallCentroidRange[1];
    if (overallMax === overallMin) {
      normalizedSize = 0.5;
    } else {
      normalizedSize = (d.centroidSize - overallMin) / (overallMax - overallMin);
    }
  }
  
  const gradientPosition = Math.max(0, Math.min(1, normalizedSize));
  return gradientScales[d.condition](gradientPosition);
};

const createGradientStops = (condition) => {
  const stops = d3.range(0, 1.01, 0.25);
  return stops.map(stop => ({
    offset: stop * 100,
    color: getGradientColor(condition, stop)
  }));
};

export default function WingCoordinates() {
  const svgRef =  useRef();
  const prevFocusLetterRef = useRef("");
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
  
  const [filterMode, setFilterMode] = useState("percentile");
  const [centroidFilters, setCentroidFilters] = useState({
    below: 0.1,
    above: 0.9,
    within: [0.00, 1.00]
  });
  const [sexFilters, setSexFilters] = useState({
    female: true,
    male: true
  });
  
  const [centroidStats, setCentroidStats] = useState({
    standard: { min: 0, max: 1, values: [] },
    hypoxia: { min: 0, max: 1, values: [] },
    cold: { min: 0, max: 1, values: [] }
  });
  
  const [allCentroidValues, setAllCentroidValues] = useState([]);
  const [overallCentroidRange, setOverallCentroidRange] = useState([0, 1]);
  const [transform, setTransform] = useState(d3.zoomIdentity);

  // State for manual inputs with pending changes
  const [manualInputs, setManualInputs] = useState({
    below: "10%",
    above: "90%",
    withinMin: "0%",
    withinMax: "100%"
  });
  
  // State to track which inputs have pending changes
  const [pendingChanges, setPendingChanges] = useState({
    below: false,
    above: false,
    withinMin: false,
    withinMax: false
  });

  // Load data
  useEffect(() => {
    d3.csv(mergedWingCoordsCSV).then(csvData => {
      const conditionGroups = { standard: [], hypoxia: [], cold: [] };
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
      
      setAllCentroidValues(allCentroids.sort((a, b) => a - b));
      const overallMin = d3.min(allCentroids);
      const overallMax = d3.max(allCentroids);
      setOverallCentroidRange([overallMin, overallMax]);
      setCentroidStats(stats);
      setData(processed);
    }).catch(err => console.error("Error loading wing coordinates:", err));
  }, []);

  // Memoized filtered data calculation
  const filteredData = useMemo(() => {
    if (data.length === 0) return [];

    return data.filter(d => {
      if (!visibleConditions[d.condition]) return false;
      
      const sex = d.sex === 'F' ? 'female' : 'male';
      if (!sexFilters[sex]) return false;
      
      let normalizedSize;
      if (filterMode === "percentile") {
        const stats = centroidStats[d.condition];
        if (stats && stats.values.length > 0) {
          const index = stats.values.findIndex(v => v >= d.centroidSize);
          normalizedSize = index === -1 ? 1 : index / stats.values.length;
        } else {
          normalizedSize = 0;
        }
      } else {
        const overallMin = overallCentroidRange[0];
        const overallMax = overallCentroidRange[1];
        normalizedSize = (d.centroidSize - overallMin) / (overallMax - overallMin);
      }
      
      const showBelow = normalizedSize <= centroidFilters.below;
      const showAbove = normalizedSize >= centroidFilters.above;
      const showWithin = normalizedSize >= centroidFilters.within[0] && normalizedSize <= centroidFilters.within[1];
      
      return (showBelow || showAbove) && showWithin;
    });
  }, [data, visibleConditions, sexFilters, filterMode, centroidFilters, centroidStats, overallCentroidRange]);

  // Memoized convertToPercentile
  const convertToPercentile = useCallback((value, condition = "overall") => {
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
  }, [allCentroidValues, centroidStats]);

  // Memoized format display value
  const formatDisplayValue = useCallback((value, isBelow = false) => {
    if (filterMode === "percentile") {
      return `${Math.round(value * 100)}%`;
    } else {
      if (isBelow) {
        const minValues = Object.values(centroidStats).map(s => s.min).filter(v => v !== undefined);
        const overallMin = minValues.length > 0 ? d3.min(minValues) : overallCentroidRange[0];
        return (overallMin + value * (overallCentroidRange[1] - overallMin)).toFixed(2);
      } else {
        const maxValues = Object.values(centroidStats).map(s => s.max).filter(v => v !== undefined);
        const overallMax = maxValues.length > 0 ? d3.max(maxValues) : overallCentroidRange[1];
        const overallMin = d3.min(Object.values(centroidStats).map(s => s.min).filter(v => v !== undefined)) || overallCentroidRange[0];
        return (overallMin + value * (overallMax - overallMin)).toFixed(2);
      }
    }
  }, [filterMode, centroidStats, overallCentroidRange]);
  
  // Add these functions after handlePointClick and before handleWithinChange

// Zoom in/out handlers - zoom around the center of the current view
const handleZoomIn = () => {
  setAutoZoomEnabled(false);
  const svg = d3.select(svgRef.current);
  if (svg.empty()) return;
  
  const width = 875;
  const height = 640;
  const margin = { top: 36, right: 12, bottom: 24, left: 36 };
  const centerX = (margin.left + width - margin.right) / 2;
  const centerY = (margin.top + height - margin.bottom) / 2;
  
  setTransform(prev => {
    const newScale = Math.min(20, prev.k * 1.5);
    // Zoom around the center of the current view
    const k = newScale / prev.k;
    const newX = centerX - (centerX - prev.x) * k;
    const newY = centerY - (centerY - prev.y) * k;
    return d3.zoomIdentity.translate(newX, newY).scale(newScale);
  });
};

const handleZoomOut = () => {
  setAutoZoomEnabled(false);
  const svg = d3.select(svgRef.current);
  if (svg.empty()) return;
  
  const width = 875;
  const height = 640;
  const margin = { top: 36, right: 12, bottom: 24, left: 36 };
  const centerX = (margin.left + width - margin.right) / 2;
  const centerY = (margin.top + height - margin.bottom) / 2;
  
  setTransform(prev => {
    const newScale = Math.max(0.5, prev.k / 1.5);
    // Zoom around the center of the current view
    const k = newScale / prev.k;
    const newX = centerX - (centerX - prev.x) * k;
    const newY = centerY - (centerY - prev.y) * k;
    return d3.zoomIdentity.translate(newX, newY).scale(newScale);
  });
};

  // Handle input changes (on blur or enter)
  const handleInputChange = (field, value) => {
    let numValue;
    
    if (filterMode === "percentile") {
      // For percentile mode: only accept whole numbers 0-100
      const match = value.match(/^(\d{1,3})\s*%?$/);
      if (!match) {
        // Revert to previous value
        setPendingChanges(prev => ({ ...prev, [field]: false }));
        return;
      }
      numValue = parseInt(match[1], 10);
      if (numValue < 0 || numValue > 100) {
        setPendingChanges(prev => ({ ...prev, [field]: false }));
        return;
      }
      numValue = numValue / 100;
    } else {
      // For absolute mode: accept decimal numbers
      numValue = parseFloat(value);
      if (isNaN(numValue)) {
        setPendingChanges(prev => ({ ...prev, [field]: false }));
        return;
      }
      
      if (field === 'below') {
        const overallMin = overallCentroidRange[0];
        numValue = (numValue - overallMin) / (overallCentroidRange[1] - overallMin);
      } else if (field === 'above') {
        const maxValues = Object.values(centroidStats).map(s => s.max).filter(v => v !== undefined);
        const overallMax = maxValues.length > 0 ? d3.max(maxValues) : overallCentroidRange[1];
        const overallMin = d3.min(Object.values(centroidStats).map(s => s.min).filter(v => v !== undefined)) || overallCentroidRange[0];
        numValue = (numValue - overallMin) / (overallMax - overallMin);
      } else if (field === 'withinMin' || field === 'withinMax') {
        const overallMin = overallCentroidRange[0];
        const overallMax = overallCentroidRange[1];
        numValue = (parseFloat(value) - overallMin) / (overallMax - overallMin);
      }
    }
    
    // Clamp value to 0-1 range
    numValue = Math.max(0, Math.min(1, numValue));
    
    // Update filters
    if (field === 'below' || field === 'above') {
      setCentroidFilters(prev => ({ ...prev, [field]: numValue }));
    } else if (field === 'withinMin') {
      setCentroidFilters(prev => {
        const newWithin = [...prev.within];
        newWithin[0] = numValue;
        if (newWithin[0] > newWithin[1]) newWithin[1] = newWithin[0];
        return { ...prev, within: newWithin };
      });
    } else if (field === 'withinMax') {
      setCentroidFilters(prev => {
        const newWithin = [...prev.within];
        newWithin[1] = numValue;
        if (newWithin[1] < newWithin[0]) newWithin[0] = newWithin[1];
        return { ...prev, within: newWithin };
      });
    }
    
    // Clear pending flag
    setPendingChanges(prev => ({ ...prev, [field]: false }));
  };

  const handleInputFocus = (field) => {
    setPendingChanges(prev => ({ ...prev, [field]: true }));
  };

  const handleInputBlur = (field) => {
    if (pendingChanges[field]) {
      handleInputChange(field, manualInputs[field]);
    }
  };

  const handleInputKeyPress = (field, e) => {
    if (e.key === 'Enter') {
      handleInputChange(field, manualInputs[field]);
    }
  };

  useEffect(() => {
    if (!pendingChanges.below) {
      setManualInputs(prev => ({ ...prev, below: formatDisplayValue(centroidFilters.below, true) }));
    }
    if (!pendingChanges.above) {
      setManualInputs(prev => ({ ...prev, above: formatDisplayValue(centroidFilters.above, false) }));
    }
    if (!pendingChanges.withinMin) {
      setManualInputs(prev => ({ ...prev, withinMin: formatDisplayValue(centroidFilters.within[0]) }));
    }
    if (!pendingChanges.withinMax) {
      setManualInputs(prev => ({ ...prev, withinMax: formatDisplayValue(centroidFilters.within[1]) }));
    }
  }, [centroidFilters, filterMode, pendingChanges, formatDisplayValue]);

  // Handle point click
  const handlePointClick = useCallback((id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const clearAllSelections = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handle within change for sliders
  const handleWithinChange = useCallback((index, value) => {
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
  }, []);

  // Main rendering effect
  useEffect(() => {
    if (filteredData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 875;
    const height = 640;
    const margin = { top: 36, right: 12, bottom: 24, left: 36 };

    const mainGroup = svg.append("g");
    const plotCenterX = (margin.left + width - margin.right) / 2;
    const plotCenterY = (margin.top + height - margin.bottom) / 2;
    
    // Get all coordinates for scaling
    const allCoords = data.map(d => [d.x, d.y]);
    const xExtent = d3.extent(allCoords, d => d[0]);
    const yExtent = d3.extent(allCoords, d => d[1]);

    // Calculate equal scaling
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const xDataRange = xExtent[1] - xExtent[0];
    const yDataRange = yExtent[1] - yExtent[0];
    const plotAspectRatio = plotHeight / plotWidth;
    const dataAspectRatio = yDataRange / xDataRange;

    let xDomain, yDomain;
    if (plotAspectRatio > dataAspectRatio) {
      const xPadding = xDataRange * 0.05;
      xDomain = [xExtent[0] - xPadding, xExtent[1] + xPadding];
      const xRangeAdjusted = xDomain[1] - xDomain[0];
      const yNeededRange = xRangeAdjusted * plotAspectRatio;
      const yCenter = (yExtent[0] + yExtent[1]) / 2;
      yDomain = [yCenter - yNeededRange/2, yCenter + yNeededRange/2];
    } else {
      const yPadding = yDataRange * 0.05;
      yDomain = [yExtent[0] - yPadding, yExtent[1] + yPadding];
      const yRangeAdjusted = yDomain[1] - yDomain[0];
      const xNeededRange = yRangeAdjusted / plotAspectRatio;
      const xCenter = (xExtent[0] + xExtent[1]) / 2;
      xDomain = [xCenter - xNeededRange/2, xCenter + xNeededRange/2];
    }

    const xScale = d3.scaleLinear()
      .domain(xDomain)
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .range([height - margin.bottom, margin.top]);

    const zoomedXScale = transform.rescaleX(xScale);
    const zoomedYScale = transform.rescaleY(yScale);

    // Setup zoom behavior (disable wheel zoom, only allow drag to pan)
const zoom = d3.zoom()
  .scaleExtent([0.5, 20])
  .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
  .filter((event) => {
    // Disable wheel zoom, only allow drag to pan
    return event.type === "mousedown" || event.type === "mousemove" || event.type === "touchstart" || event.type === "touchmove";
  })
  .on("zoom", (event) => {
    setTransform(event.transform);
  });

svg.call(zoom);
// Sync zoom behavior with transform state (for button-based zooming)
svg.call(zoom.transform, transform);

    // Auto-zoom logic (same as before but optimized)
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
          .duration(50)
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
    } else if (!focusLetter && prevFocusLetterRef.current !== "") {
      svg
        .transition()
        .duration(50)
        .call(zoom.transform, d3.zoomIdentity);
      setTransform(d3.zoomIdentity);
      setAutoZoomedLetter("");
    }
    
    prevFocusLetterRef.current = focusLetter;

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

    mainGroup.append("text")
      .attr("x", width / 2)
      .attr("y", height + 2)
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

    const defs = svg.append("defs");
    Object.keys(gradientScales).forEach(condition => {
      const gradientId = `gradient-${condition}`;
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

      const stops = createGradientStops(condition);
      gradient.selectAll("stop")
        .data(stops)
        .enter().append("stop")
        .attr("offset", d => `${d.offset}%`)
        .attr("stop-color", d => d.color);
    });

    Array.from(selectedIds).forEach(selectedId => {
      const selectedWingData = filteredData.filter(d => d.id === selectedId);
      const pointMap = {};
      selectedWingData.forEach(d => {
        pointMap[d.pointId] = d;
      });

      connections.forEach(([p1, p2]) => {
        if (pointMap[p1] && pointMap[p2]) {
          const pointColor = calculatePointColor(pointMap[p1], filterMode, centroidStats, overallCentroidRange);
          mainGroup.append("line")
            .attr("x1", zoomedXScale(pointMap[p1].x))
            .attr("y1", zoomedYScale(pointMap[p1].y))
            .attr("x2", zoomedXScale(pointMap[p2].x))
            .attr("y2", zoomedYScale(pointMap[p2].y))
            .attr("stroke", pointColor)
            .attr("stroke-width", 2)
            .attr("opacity", 0.8);
        }
      });
    });

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

    const points = mainGroup.selectAll("g.point")
      .data(filteredData)
      .join("g")
      .attr("class", "point")
      .attr("transform", d => `translate(${zoomedXScale(d.x)}, ${zoomedYScale(d.y)})`)
      .style("cursor", "pointer")
      .style("opacity", d => selectedIds.size === 0 ? 0.8 : selectedIds.has(d.id) ? 1 : 0.6)
      .on("click", (event, d) => handlePointClick(d.id))
      .on("mouseover", function(event, d) {
        const currentPointId = d.pointId;
        mainGroup.selectAll("g.point")
          .transition()
          .duration(200)
          .style("opacity", point => {
            if (selectedIds.has(point.id)) return 1;
            if (point.pointId === currentPointId) return 0.8;
            return 0.3;
          });

        let normalizedSize;
        let sizeDisplay;
        if (filterMode === "percentile") {
          normalizedSize = convertToPercentile(d.centroidSize, d.condition);
          sizeDisplay = `${Math.round(normalizedSize * 100)}% (${d.centroidSize.toFixed(2)})`;
        } else {
          normalizedSize = (d.centroidSize - overallCentroidRange[0]) / (overallCentroidRange[1] - overallCentroidRange[0]);
          sizeDisplay = `${d.centroidSize.toFixed(2)} (${Math.round(normalizedSize * 100)}%)`;
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
          .style("opacity", d => selectedIds.size === 0 ? 0.8 : selectedIds.has(d.id) ? 1 : 0.6);
        tooltip.style("opacity", 0);
      });

    points.append("circle")
      .attr("r", 6)
      .attr("fill", d => calculatePointColor(d, filterMode, centroidStats, overallCentroidRange))
      .attr("stroke", d => selectedIds.has(d.id) ? calculatePointColor(d, filterMode, centroidStats, overallCentroidRange) : "#fff")
      .attr("stroke-width", d => selectedIds.has(d.id) ? 2 : 1);

    points.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .style("font-size", "8px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .style("pointer-events", "none")
      .text(d => d.letter);

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
          setVisibleConditions(prev => ({ ...prev, [condition]: !prev[condition] }));
        });

      legendItem.append("rect")
        .attr("x", -15)
        .attr("y", -8)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", visibleConditions[condition] ? color : "white")
        .attr("stroke", "#333")
        .attr("stroke-width", 1);

      const gradientId = `gradient-${condition}`;
      legendItem.append("rect")
        .attr("x", 5)
        .attr("y", -6)
        .attr("width", 80)
        .attr("height", 8)
        .attr("fill", `url(#${gradientId})`)
        .attr("opacity", visibleConditions[condition] ? 1 : 0.3);

      legendItem.append("text")
        .attr("x", 90)
        .attr("y", 2)
        .style("font-size", "10px")
        .style("opacity", visibleConditions[condition] ? 1 : 0.5)
        .text(condition);
    });
    mainGroup.append("text")
      .attr("x", 10)
      .attr("y", 20)
      .style("font-size", "14px")
      .style("fill", "#000")
      .text("Click any point to map the whole wing.");
    return () => {
      tooltip.remove();
    };
  }, [data, selectedIds, visibleConditions, centroidFilters, sexFilters, filterMode, centroidStats, overallCentroidRange, transform, focusLetter, autoZoomedLetter, autoZoomEnabled, filteredData, handlePointClick, convertToPercentile]);

  return (
    <div style={{ padding: "8px", backgroundColor: "#fff" }}>
      <h2>Wing Coordinate Landmarks</h2>
      

      <div style={{ 
        marginBottom: "10px", 
        padding: "10px", 
        backgroundColor: "#f8f9fa", 
        borderRadius: "5px",
        border: "1px solid #dee2e6"
      }}>
        
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
              <option key={letter} value={letter}>{letter}</option>
            ))}
          </select>
          <span style={{ fontSize: "12px", color: "#666" }}>
            Choose a landmark letter to zoom in on all points of that tag.
          </span>
  

  <div style={{ display: "flex", gap: "4px", marginLeft: "auto" }}>
    <button
      onClick={handleZoomOut}
      style={{
        fontSize: "16px",
        padding: "4px 10px",
        borderRadius: "4px",
        border: "1px solid #ccc",
        backgroundColor: "#fff",
        cursor: "pointer",
        fontWeight: "bold"
      }}
      title="Zoom out"
    >
      −
    </button>
    <button
      onClick={handleZoomIn}
      style={{
        fontSize: "16px",
        padding: "4px 10px",
        borderRadius: "4px",
        border: "1px solid #ccc",
        backgroundColor: "#fff",
        cursor: "pointer",
        fontWeight: "bold"
      }}
      title="Zoom in"
    >
      +
    </button>
  </div>
        </div>
        

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


        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" }}>
{/* Below Filter */}
<div>
  <label style={{ fontWeight: "bold", marginBottom: "4px", marginRight: "4px", fontSize: "12px" }}>
    Show below: 
  </label>
  <input
    type="text"
    value={manualInputs.below}
    onChange={(e) => setManualInputs(prev => ({ ...prev, below: e.target.value }))}
    onFocus={() => handleInputFocus('below')}
    onBlur={() => handleInputBlur('below')}
    onKeyPress={(e) => handleInputKeyPress('below', e)}
    style={{ 
      width: "60px", 
      padding: "2px 4px", 
      fontSize: "12px",
      border: "1px solid #ccc",
      borderRadius: "3px",
      backgroundColor: pendingChanges.below ? "#ffffe0" : "white"
    }}
    placeholder={filterMode === "percentile" ? "0-100%" : "value"}
  />
  <div style={{ display: "flex", marginTop: "5px", gap: "8px", alignItems: "center" }}>
    <div style={{ position: "relative", flex: 1, height: "20px" }}>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={centroidFilters.below}
        onChange={(e) => {
          setCentroidFilters(prev => ({ ...prev, below: +e.target.value }));
          setPendingChanges(prev => ({ ...prev, below: false }));
        }}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          margin: 0,
          opacity: 1,
          cursor: "pointer",
          WebkitAppearance: "none",
          appearance: "none",
          background: "transparent",
          zIndex: 2
        }}
      />

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

      <div style={{
        position: "absolute",
        top: "50%",
        left: "0",
        width: `${centroidFilters.below * 100}%`,
        height: "4px",
        background: "#63d0df",
        transform: "translateY(-50%)",
        borderRadius: "2px"
      }}></div>
    </div>
  </div>
</div>


<div>
  <label style={{ fontWeight: "bold", marginBottom: "4px", marginRight: "4px", fontSize: "12px" }}>
    And above: 
  </label>
  <input
    type="text"
    value={manualInputs.above}
    onChange={(e) => setManualInputs(prev => ({ ...prev, above: e.target.value }))}
    onFocus={() => handleInputFocus('above')}
    onBlur={() => handleInputBlur('above')}
    onKeyPress={(e) => handleInputKeyPress('above', e)}
    style={{ 
      width: "60px", 
      padding: "2px 4px", 
      fontSize: "12px",
      border: "1px solid #ccc",
      borderRadius: "3px",
      backgroundColor: pendingChanges.above ? "#ffffe0" : "white"
    }}
    placeholder={filterMode === "percentile" ? "0-100%" : "value"}
  />
  <div style={{ display: "flex", marginTop: "5px", gap: "8px", alignItems: "center" }}>
    <div style={{ position: "relative", flex: 1, height: "20px" }}>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={centroidFilters.above}
        onChange={(e) => {
          setCentroidFilters(prev => ({ ...prev, above: +e.target.value }));
          setPendingChanges(prev => ({ ...prev, above: false }));
        }}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          margin: 0,
          opacity: 1,
          cursor: "pointer",
          WebkitAppearance: "none",
          appearance: "none",
          background: "transparent",
          zIndex: 2
        }}
      />

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

      <div style={{
        position: "absolute",
        top: "50%",
        left: `${centroidFilters.above * 100}%`,
        right: "0",
        height: "4px",
        background: "#63d0df",
        transform: "translateY(-50%)",
        borderRadius: "2px"
      }}></div>
    </div>
  </div>
</div>


          <div>
            <label style={{ fontWeight: "bold", marginBottom: "4px", fontSize: "12px" }}>
              Within:
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "5px" }}>
              <input
                type="text"
                value={manualInputs.withinMin}
                onChange={(e) => setManualInputs(prev => ({ ...prev, withinMin: e.target.value }))}
                onFocus={() => handleInputFocus('withinMin')}
                onBlur={() => handleInputBlur('withinMin')}
                onKeyPress={(e) => handleInputKeyPress('withinMin', e)}
                style={{ 
                  width: "60px", 
                  padding: "2px 4px", 
                  fontSize: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "3px",
                  backgroundColor: pendingChanges.withinMin ? "#ffffe0" : "white"
                }}
                placeholder="Min"
              />
              <span style={{ fontSize: "12px" }}>to</span>
              <input
                type="text"
                value={manualInputs.withinMax}
                onChange={(e) => setManualInputs(prev => ({ ...prev, withinMax: e.target.value }))}
                onFocus={() => handleInputFocus('withinMax')}
                onBlur={() => handleInputBlur('withinMax')}
                onKeyPress={(e) => handleInputKeyPress('withinMax', e)}
                style={{ 
                  width: "60px", 
                  padding: "2px 4px", 
                  fontSize: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "3px",
                  backgroundColor: pendingChanges.withinMax ? "#ffffe0" : "white"
                }}
                placeholder="Max"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ color: "green", marginBottom: "10px", fontSize: "12px" }}>
        Showing {filteredData.length} of {data.length} landmark points
        {selectedIds.size > 0 && ` • ${selectedIds.size} wing(s) selected`}
      </div>
      
      <svg
        ref={svgRef}
        width={875}
        height={645}
        style={{ border: "1px solid #ddd", backgroundColor: "white" }}
      ></svg>

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