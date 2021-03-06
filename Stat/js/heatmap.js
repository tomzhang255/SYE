"use strict";

// constructs the element
async function constructHeatmap() {
    // set the dimensions and margins of the graph
    const margin = { top: 100, right: 100, bottom: 100, left: 100 },
        width = 1100 - margin.left - margin.right,
        height = 1100 - margin.top - margin.bottom;

    // to return
    const heatmapContainer = d3.create("div");

    // create svg object
    const svg = heatmapContainer
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // read the data
    const graphResp = await fetch("graph_lasso_0.001.json?0");
    const weightedGraph = await graphResp.json();
    const weights = weightedGraph.wgt;

    // transform into correct data format
    const uniqueIntCards = Object.keys(weights)
        .map((interaction) => interaction.match(".*:").toString().slice(0, -1)) // keep first card
        .filter((v, i, a) => a.indexOf(v) === i) // unique
        .sort();

    const data = [];

    const vertexCardMap = await makeVertexCardMap();

    for (let i = 0; i < uniqueIntCards.length; i++) {
        const card1 = uniqueIntCards[i];
        for (let j = 0; j < uniqueIntCards.length; j++) {
            const card2 = uniqueIntCards[j];
            const pair = {
                card1: vertexCardMap[card1],
                card2: vertexCardMap[card2],
                weight: weights[card1 + ":" + card2] || 0, // if no weight, use 0
            };
            data.push(pair);
        }
    }

    // labels of row and columns
    const xCards = Array.from(new Set(data.map((d) => d.card1)));
    const yCards = Array.from(new Set(data.map((d) => d.card2)));

    // build X scales and axis:
    const x = d3.scaleBand().range([0, width]).domain(xCards).padding(0.05);
    svg.append("g")
        .style("font-size", 8)
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).tickSize(0))
        .selectAll("text")
        .attr("y", 0)
        .attr("x", 4)
        .attr("dy", ".35em")
        .attr("transform", "rotate(90)")
        .style("text-anchor", "start")
        .select(".domain")
        .remove();

    // build Y scales and axis:
    const y = d3.scaleBand().range([height, 0]).domain(yCards).padding(0.05);
    svg.append("g")
        .style("font-size", 8)
        .call(d3.axisLeft(y).tickSize(0))
        .select(".domain")
        .remove();

    // build color scale
    const weightValues = Object.values(weights);
    const maxWeight = Math.max(...weightValues);
    const myColor = d3
        .scaleSequential()
        .interpolator(d3.interpolateGreys)
        .domain([0, maxWeight]);

    // create a tooltip
    const tooltip = heatmapContainer
        .append("div")
        .style("position", "absolute")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("font-size", "14px")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "4px")
        .style("padding", "4px");

    // three function that change the tooltip when user hover / move / leave a cell
    const mouseover = function (event, d) {
        tooltip.style("opacity", 1);
        // d3.select(this)
        // .style("stroke", "black")
        // .style("opacity", 1)
    };
    const mousemove = function (event, d) {
        tooltip
            .html(d.card1 + "<br>" + d.card2 + "<br>" + "Strength: " + d.weight)
            .style("left", event.pageX + 20 + "px")
            .style("top", event.pageY - 25 + "px");
    };
    const mouseleave = function (event, d) {
        tooltip.style("opacity", 0);
        // d3.select(this)
        // .style("stroke", "none")
        // .style("opacity", 0.8)
    };

    // add the squares
    svg.selectAll()
        .data(data, function (d) {
            return d.card1 + ":" + d.card2;
        })
        .join("rect")
        .attr("x", function (d) {
            return x(d.card1);
        })
        .attr("y", function (d) {
            return y(d.card2);
        })
        // .attr("rx", 1)
        // .attr("ry", 1)
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", function (d) {
            return myColor(d.weight);
        })
        // .style("stroke-width", 4)
        // .style("stroke", "none")
        // .style("opacity", 0.8)
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);

    // add title to graph
    svg.append("text")
        .attr("x", 0)
        .attr("y", -50)
        .attr("text-anchor", "left")
        .style("font-size", "22px")
        .text("Card Synergy Heatmap");

    // add subtitle to graph
    svg.append("text")
        .attr("x", 0)
        .attr("y", -20)
        .attr("text-anchor", "left")
        .style("font-size", "14px")
        .style("fill", "grey")
        .style("max-width", 400)
        .text(
            "Synergy strengths are simply the coefficients of interaction terms in our lasso regression model."
        );

    return heatmapContainer.node();
}

// insert element into DOM
function insertHeatmap() {
    constructHeatmap().then((heatmap) =>
        document.querySelector("#container").appendChild(heatmap)
    );
}
