"use strict";

async function insertSelectEgoFloat(graphVertices) {
    // the multiselect dropdown menu
    const select = document.querySelector("#select-ego");

    // all cards available - need their nicely formatted names
    const cardsResp = await fetch("cards.json");
    const cardsJSON = await cardsResp.json();
    let cards = cardsJSON.items.map((item) => item.name);

    // only keep names for cards that exist in the graph
    cards = cards.filter((card) => graphVertices.includes(cleanUpName(card)));
    cards.sort();

    // each option is a card
    cards.forEach((card, i) => {
        const option = document.createElement("option");
        option.innerText = card;
        if (i == 0) {
            // pre-select the first option
            option.selected = true;
        }
        select.appendChild(option);
    });

    return select;
}

async function insertSimilarEgoFloat(graph, graphVertices, mainValues) {
    // a user can select from a list of cards that are similar to the main ego cards
    const selectSimilar = document.createElement("select");
    selectSimilar.id = "select-similar";
    selectSimilar.classList.add("form-select", "form-select-sm");

    // get set of adjacent cards of curr ego cards
    const mainEgos = mainValues.map((card) => cleanUpName(card));
    let mainAdjCards = [];
    mainEgos.forEach((main) => {
        mainAdjCards = mainAdjCards.concat(graph[main]);
    });
    const mainAdjVertices = mainAdjCards.map((card) => cleanUpName(card));

    // iterate through graph (adjacency list) to identify all similar ego cards
    // threshold: if at least 1/2 of a card's adjacencies are in current ego network
    const similarEgos = graphVertices.filter((vertex) => {
        const currAdjVertices = graph[vertex];
        // set intersection
        const mainIntersectCurr = mainAdjVertices.filter((v) =>
            currAdjVertices.includes(v)
        );
        // if similarity size exceeds threshould, filter keeps it
        return mainIntersectCurr.length / currAdjVertices.length >= 0.5;
    });

    similarEgos.sort();

    const vertexCardMap = await makeVertexCardMap();

    // those similar egos will be the options for select-similar
    similarEgos
        .map((vertex) => vertexCardMap[vertex])
        .forEach((card) => {
            const option = document.createElement("option");
            option.innerText = card;
            selectSimilar.appendChild(option);
        });

    selectSimilar.value = similarEgos[0];

    // label for select-similar
    const selectSimilarLabel = document.createElement("label");
    selectSimilarLabel.htmlFor = "select-similar";
    selectSimilarLabel.innerText = "Similar Ego Card:";
    selectSimilarLabel.style.fontSize = "0.85rem";
    selectSimilarLabel.classList.add("pb-2");

    // insert floating menu to DOM
    const floating = document.querySelector("#similar-ego-float");
    floating.innerHTML = "";
    floating.appendChild(selectSimilarLabel);
    floating.appendChild(selectSimilar);

    // make select-similar responsive
    selectSimilar.addEventListener("change", async () => {
        document.querySelector("#container").innerHTML = "";
        insertGraph([selectSimilar.value]);
    });
}
