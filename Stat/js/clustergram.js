"use strict";

async function insertClustergram() {
    // read in div text file
    const clustDivResp = await fetch("clustergram_div.txt?1");
    const clustDivText = await clustDivResp.text();

    // extract plotly div and script content
    const clustDiv = document.createElement("div");
    clustDiv.innerHTML = clustDivText;
    const plotlyDiv = clustDiv.children[0].children[0];
    const plotlyScript = clustDiv.children[0].children[1];

    // add plotly object to DOM
    // note: need to explicitly specify script tag, or it will not work
    const container = document.querySelector("#container");
    container.appendChild(plotlyDiv);
    const containerScript = document.createElement("script");
    containerScript.innerText = plotlyScript.innerText;
    container.appendChild(containerScript);
}
