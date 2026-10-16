/* Custom D3 dashboard. No framework, server API, or external runtime requests. */
"use strict";

const pct = d3.format(".1%");
const populationPct = (value) => d3.format(".3~g")(value * 100) + "%";
const integer = d3.format(",d");
const decimal = d3.format(".1f");
const colors = ["#b6d7d4", "#80b8b6", "#4b9a9d", "#237b87", "#173e58"];
const quintiles = ["Lowest 20%", "20–40%", "40–60%", "60–80%", "Highest 20%"];
const raceNames = [
  "Asian / Pacific Islander",
  "Black",
  "Hispanic",
  "International",
  "Other / unreported",
];
const raceColor = "#147d85";
const groupNames = {
  ivy: "Ivy-Plus",
  all: "All selective colleges",
  public: "All public colleges",
  private: "All private colleges",
  NESCAC: "NESCAC",
  "Tier 2 Private": "Other highly selective private",
  Flagship: "Public flagships",
  "Other Top 100 Private": "Other top-100 private",
  "Other Top 100 Public": "Other top-100 public",
};
const descriptions = {
  ivy: "Ivy-Plus: eight Ivy League colleges, Stanford, MIT, Duke, and the University of Chicago.",
  all: "All 139 colleges / clusters released in the admissions-study dataset. This is a selected sample, not all US colleges.",
  public:
    "All public colleges / clusters included in the admissions-study dataset.",
  private: "All private colleges included in the admissions-study dataset.",
  NESCAC:
    "The 11 New England Small College Athletic Conference colleges in the dataset.",
  "Tier 2 Private":
    "The source’s “Tier 2 Private” category: remaining private colleges in Barron’s top selectivity group.",
  Flagship:
    "The source’s “Flagship” category of public universities. Some observations pool multiple campuses.",
  "Other Top 100 Private":
    "The source’s “Other Top 100 Private” category; rankings follow the study’s historical definitions.",
  "Other Top 100 Public":
    "The source’s “Other Top 100 Public” category; rankings follow the study’s historical definitions.",
};
const stateAbbreviations = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  10: "DE",
  11: "DC",
  12: "FL",
  13: "GA",
  15: "HI",
  16: "ID",
  17: "IL",
  18: "IN",
  19: "IA",
  20: "KS",
  21: "KY",
  22: "LA",
  23: "ME",
  24: "MD",
  25: "MA",
  26: "MI",
  27: "MN",
  28: "MS",
  29: "MO",
  30: "MT",
  31: "NE",
  32: "NV",
  33: "NH",
  34: "NJ",
  35: "NM",
  36: "NY",
  37: "NC",
  38: "ND",
  39: "OH",
  40: "OK",
  41: "OR",
  42: "PA",
  44: "RI",
  45: "SC",
  46: "SD",
  47: "TN",
  48: "TX",
  49: "UT",
  50: "VT",
  51: "VA",
  53: "WA",
  54: "WV",
  55: "WI",
  56: "WY",
};
const dimensions = [
  { key: "bottom20", title: ["Bottom 20%", "income share"], format: pct },
  { key: "top20", title: ["Top 20%", "income share"], format: pct },
  { key: "admitRate", title: ["Admission rate", "2013"], format: pct },
];
const selection = {
  group: "all",
  state: null,
  mapMetric: "populationRate",
  query: "",
  brushes: {},
  regions: {},
  highlighted: null,
  pinned: null,
};
let schools = [],
  features = [],
  selected = [],
  candidates = [],
  scales = {},
  brushControls = {},
  originDenominators = {},
  statePopulations = {};
const byId = new Map();
const tip = document.getElementById("tooltip");
const $ = (id) => document.getElementById(id);
const goodNumber = (v) => Number.isFinite(v);
const formatPct = (v) => (goodNumber(v) ? pct(v) : "—");
const formatRatio = (v) => (goodNumber(v) ? decimal(v) + "×" : "—");

let tipOwner = null;
function showTip(event, title, lines) {
  tipOwner = event.currentTarget || null;
  tip.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = title;
  tip.append(heading);
  lines.forEach((line, index) => {
    const element = document.createElement("div");
    element.textContent = line;
    if (index === lines.length - 1) element.className = "tip-muted";
    tip.append(element);
  });
  tip.hidden = false;
  let point = { x: event.clientX, y: event.clientY };
  if (!goodNumber(point.x) || (!point.x && !point.y)) {
    const bounds = event.currentTarget.getBoundingClientRect();
    point = {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
  }
  tip.style.left =
    Math.max(
      8,
      Math.min(point.x + 15, window.innerWidth - tip.offsetWidth - 12),
    ) + "px";
  tip.style.top =
    Math.max(
      8,
      Math.min(point.y + 12, window.innerHeight - tip.offsetHeight - 12),
    ) + "px";
}
function hideTip() {
  tip.hidden = true;
  tipOwner = null;
}
function tipAllowed(event) {
  if (event.type !== "focus") return true;
  try {
    return event.target.matches(":focus-visible");
  } catch (e) {
    return true;
  }
}
window.addEventListener("scroll", hideTip, { passive: true, capture: true });
window.addEventListener("blur", hideTip);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideTip();
});
document.addEventListener(
  "pointermove",
  (event) => {
    if (
      !tip.hidden &&
      tipOwner &&
      event.pointerType === "mouse" &&
      !tipOwner.contains(event.target)
    )
      hideTip();
  },
  { passive: true },
);
function markEvents(marks, contents) {
  return marks
    .on("pointerenter focus", (event, d) => {
      if (!tipAllowed(event)) return;
      const c = contents(d);
      showTip(event, c.title, c.lines);
    })
    .on("pointermove", (event, d) => {
      const c = contents(d);
      showTip(event, c.title, c.lines);
    })
    .on("pointerleave blur", hideTip);
}
function svgAt(id, width, height, label) {
  const element = d3.select("#" + id);
  element.selectAll("*").remove();
  return element
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", label);
}
function emptyAt(id, message) {
  d3.select("#" + id)
    .selectAll("*")
    .remove();
  d3.select("#" + id)
    .append("div")
    .attr("class", "empty-chart")
    .text(message);
}
function groupMatches(school) {
  const g = selection.group;
  return (
    (g === "all" ||
      (g === "ivy" && school.group === "Ivy Plus") ||
      (g === "public" && school.public) ||
      (g === "private" && !school.public) ||
      school.group === g) &&
    school.name.toLowerCase().includes(selection.query)
  );
}
function passesBrush(school) {
  return Object.entries(selection.brushes).every(
    ([key, [low, high]]) =>
      goodNumber(school[key]) &&
      school[key] >= low - 1e-10 &&
      school[key] <= high + 1e-10,
  );
}
function setHighlight(id) {
  selection.highlighted = id;
  d3.selectAll(".college-dot").classed("highlighted", (d) => d.id === id);
  d3.selectAll(".dot-label").style("opacity", (d) => (d.id === id ? 1 : 0));
  if (id)
    d3.selectAll(".college-dot")
      .filter((d) => d.id === id)
      .raise();
}
function clearRanges() {
  selection.brushes = {};
  selection.regions = {};
}
function stateChosen(abbreviation) {
  selection.state = abbreviation || null;
  hideTip();
  update(false);
}
function update(redrawParallel = false) {
  hideTip();
  const group = schools.filter(groupMatches);
  candidates = group;
  selected = candidates.filter(passesBrush);
  if (redrawParallel) drawScatter();
  drawMap(group.filter(passesBrush));
  drawRace();
  drawIncome();
  drawTable();
  updateStats(group);
  updateLines();
}
function updateStats(group) {
  $("school-count").textContent = selected.length;
  $("count-note").textContent =
    `${selected.length} of ${group.length} in ${groupNames[selection.group]}`;
  const income = incomeAggregate(selected);
  $("top-share").textContent = income ? pct(income.shares[4]) : "—";
  const admissions = selected.filter((s) => goodNumber(s.admitRate));
  $("admit-average").textContent = admissions.length
    ? pct(d3.mean(admissions, (s) => s.admitRate))
    : "—";
  $("group-description").textContent = descriptions[selection.group];
  const brushCount = Object.keys(selection.brushes).length;
  $("brush-status").textContent = brushCount
    ? "College selection active"
    : "All matching colleges";
  const active = $("active-state");
  active.replaceChildren();
  if (selection.state) {
    const button = document.createElement("button");
    button.textContent = "Home state: " + selection.state + " ×";
    button.setAttribute(
      "aria-label",
      "Clear selected state " + selection.state,
    );
    button.addEventListener("click", () => stateChosen(null));
    active.append(button);
  }
  const states = Object.values(stateAbbreviations).sort();
  const options = d3
    .select("#state-select")
    .selectAll("option")
    .data(["", ...states], (d) => d);
  options
    .join("option")
    .attr("value", (d) => d)
    .text((d) => (d ? d : "All states"));
  $("state-select").value = selection.state || "";
  $("clear-state").hidden = !selection.state;
  const complete = selected.filter((s) =>
    dimensions.every((d) => goodNumber(s[d.key])),
  ).length;
  $("parallel-count").textContent = `${complete} colleges with comparison data`;
  const clusterCount = selected.filter((s) => s.multi).length;
  $("selection-note").textContent = selected.length
    ? `${selected.length} selected college${selected.length === 1 ? "" : "s"} / cluster${selected.length === 1 ? "" : "s"}. ${clusterCount ? clusterCount + " multi-campus cluster" + (clusterCount === 1 ? "" : "s") + ". " : ""}The map shows students’ home states; the other views show national college-level measures. Charts omit missing values separately.`
    : "No colleges match this selection. Clear a brush, change the search, or reset the views.";
  $("download").disabled = !selected.length;
}

function originSummary(rows = selected) {
  const counts = Object.fromEntries(
    Object.keys(stateAbbreviations).map((fips) => [fips, 0]),
  );
  const available = rows.filter((s) => s.homeStateCounts);
  available.forEach((s) =>
    Object.entries(s.homeStateCounts).forEach(([fips, n]) => {
      if (fips in counts) counts[fips] += n;
    }),
  );
  const knownUS = d3.sum(Object.values(counts));
  const other = d3.sum(available, (s) => s.originOtherStudents);
  const states = Object.fromEntries(
    Object.entries(counts).map(([fips, count]) => [
      fips,
      {
        count,
        share: knownUS ? count / knownUS : 0,
        stateEntrants: originDenominators[fips] || 0,
        rate: originDenominators[fips] ? count / originDenominators[fips] : 0,
        population: statePopulations[fips],
        populationRate: count / statePopulations[fips],
      },
    ]),
  );
  return { states, knownUS, other, available };
}
function updateOriginDetails(summary) {
  const box = $("origin-detail");
  box.replaceChildren();
  if (!selection.state) {
    box.textContent =
      "Click a state to see where its incoming students enrolled.";
    return;
  }
  const fips = Object.entries(stateAbbreviations).find(
    ([_, abbr]) => abbr === selection.state,
  )?.[0];
  const name =
    features.find((f) => f.id === fips)?.properties.name || selection.state;
  const value = summary.states[fips];
  const heading = document.createElement("strong");
  heading.textContent = "Students from " + name;
  box.append(heading);
  const sentence = document.createElement("p");
  sentence.textContent = `${integer(value.count)} new students from ${name} enrolled in the selected colleges, out of ${integer(value.population)} residents: ${populationPct(value.populationRate)} of the state’s population.`;
  box.append(sentence);
  const caption = document.createElement("p");
  caption.className = "origin-detail-caption";
  caption.textContent = `Calculation: ${integer(value.count)} ÷ ${integer(value.population)} × 100 = ${populationPct(value.populationRate)}. The denominator includes all ages. This measures enrolled entrants per resident, not the percentage of applicants admitted. Other charts retain national college-level data.`;
  box.append(caption);
  const destinations = summary.available
    .map((s) => ({ school: s, count: s.homeStateCounts[fips] || 0 }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  if (destinations.length) {
    const title = document.createElement("span");
    title.className = "origin-list-title";
    title.textContent = "Top destination colleges in your selection";
    box.append(title);
    const list = document.createElement("ol");
    destinations.forEach(({ school, count }) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.className = "origin-school";
      button.textContent = school.name;
      button.addEventListener("click", () => {
        selection.pinned = school.id;
        setHighlight(school.id);
        updateCollegeDetail();
      });
      const number = document.createElement("strong");
      number.textContent = integer(count);
      item.append(button, number);
      list.append(item);
    });
    box.append(list);
  }
}
function drawMap(mapSchools) {
  const width = 550,
    height = 300;
  const svg = svgAt(
    "map",
    width,
    height,
    "US map of incoming students’ permanent home states in Fall 2014.",
  );
  const projection = d3.geoAlbersUsa().fitExtent(
    [
      [7, 5],
      [width - 7, height - 5],
    ],
    { type: "FeatureCollection", features },
  );
  const path = d3.geoPath(projection),
    summary = originSummary(mapSchools),
    metric = selection.mapMetric;
  const maximum = d3.max(Object.values(summary.states), (d) => d[metric]) || 1;
  const upper = d3.scaleLinear().domain([0, maximum]).nice(4).domain()[1];
  const fill = d3
    .scaleSequential()
    .domain([0, upper])
    .interpolator(d3.interpolateRgb("#e5f2ef", "#137c84"));
  const format =
    metric === "count"
      ? integer
      : metric === "populationRate"
        ? populationPct
        : pct;
  $("map-title").textContent =
    metric === "populationRate"
      ? "Top-college enrollment (% of state population)"
      : "Where do students come from?";
  const paths = svg
    .append("g")
    .selectAll("path")
    .data(features)
    .join("path")
    .attr("class", "state")
    .attr("d", path)
    .attr("fill", (d) =>
      summary.available.length ? fill(summary.states[d.id][metric]) : "#e9edf0",
    )
    .attr("stroke", (d) =>
      stateAbbreviations[d.id] === selection.state ? "#c17449" : "#fff",
    )
    .attr("stroke-width", (d) =>
      stateAbbreviations[d.id] === selection.state ? 2.5 : 1,
    )
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr(
      "aria-label",
      (d) =>
        `${d.properties.name}: ${integer(summary.states[d.id].count)} incoming students at selected colleges, ${populationPct(summary.states[d.id].populationRate)} of ${integer(summary.states[d.id].population)} state residents. Activate for details.`,
    )
    .on("click", (event, d) => {
      const abbr = stateAbbreviations[d.id];
      stateChosen(selection.state === abbr ? null : abbr);
    })
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const abbr = stateAbbreviations[d.id];
        stateChosen(selection.state === abbr ? null : abbr);
      }
    });
  markEvents(paths, (d) => {
    const v = summary.states[d.id];
    return {
      title: "Students from " + d.properties.name,
      lines: [
        `${integer(v.count)} entrants ÷ ${integer(v.population)} residents`,
        `${populationPct(v.populationRate)} of the state’s population`,
        `${decimal(v.populationRate * 100000)} entrants per 100,000 residents`,
        `${pct(v.share)} of selected colleges’ incoming US students`,
        "Fall 2014 · Permanent home state · Click for destinations",
      ],
    };
  });
  svg
    .append("g")
    .attr("pointer-events", "none")
    .selectAll("text")
    .data(
      features.filter(
        (d) => !["09", "10", "11", "24", "25", "34", "44"].includes(d.id),
      ),
    )
    .join("text")
    .attr("transform", (d) => `translate(${path.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("dy", ".3em")
    .attr("font-size", 9)
    .attr("fill", (d) =>
      summary.states[d.id][metric] > upper * 0.58 ? "#fff" : "#355566",
    )
    .text((d) => stateAbbreviations[d.id]);
  const labels = {
    populationRate: "Entrants as % of state population",
    share: "Share of incoming US students",
    count: "Incoming students",
    rate: "Share of state college entrants",
  };
  $("map-legend").innerHTML =
    `<span>${labels[metric]}</span><div class="gradient-legend"><div class="gradient-track"></div><div class="legend-values"><span>${format(0)}</span><span>${format(upper / 2)}</span><span>${format(upper)}</span></div></div>`;
  $("origin-coverage").textContent =
    `${summary.available.length} / ${mapSchools.length} selected colleges matched · ${integer(summary.knownUS)} entrants from 50 states + DC · ${integer(summary.other)} other/unknown residences excluded · US population-weighted rate: ${populationPct(summary.knownUS / d3.sum(Object.values(statePopulations)))}`;
  $("download-origins").disabled = !summary.available.length;
  updateOriginDetails(summary);
}

function drawRace() {
  const rows = selected.filter(
    (s) => s.race && goodNumber(s.enrollment2000) && s.enrollment2000 > 0,
  );
  $("race-coverage").textContent =
    `Coverage: ${rows.length} / ${selected.length} selected colleges · enrollment-weighted`;
  if (!rows.length) {
    emptyAt("race", "No enrollment data for this selection.");
    return;
  }
  const total = d3.sum(rows, (s) => s.enrollment2000);
  const data = raceNames.map((name, i) => ({
    name,
    value: d3.sum(rows, (s) => s.race[i] * s.enrollment2000) / total,
    index: i,
  }));
  const width = 550,
    height = 300,
    margin = { top: 7, right: 48, bottom: 58, left: 151 };
  const svg = svgAt(
    "race",
    width,
    height,
    "Undergraduate enrollment shares in Fall 2000, weighted by enrollment.",
  );
  const x = d3
    .scaleLinear()
    .domain([0, 1])
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleBand()
    .domain(data.map((d) => d.name))
    .range([margin.top, height - margin.bottom])
    .padding(0.45);
  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickSize(-(height - margin.top - margin.bottom))
        .tickFormat(""),
    );
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(x).ticks(5).tickFormat(d3.format(".0%")).tickSizeOuter(0),
    );
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .call((g) => g.select(".domain").remove())
    .selectAll("text")
    .attr("dx", -8)
    .attr("font-size", 11);
  const bars = svg
    .append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("class", "chart-mark")
    .attr("x", margin.left)
    .attr("y", (d) => y(d.name))
    .attr("width", (d) => x(d.value) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", (d) => raceColor)
    .attr("rx", 2)
    .attr("tabindex", 0)
    .attr(
      "aria-label",
      (d) =>
        `${d.name}: ${pct(d.value)} of undergraduate enrollment, Fall 2000.`,
    );
  markEvents(bars, (d) => ({
    title: d.name,
    lines: [
      `${pct(d.value)} of undergraduate enrollment`,
      `${rows.length} colleges with complete data`,
      "Fall 2000 · Enrollment-weighted · Not an admission rate",
    ],
  }));
  svg
    .append("g")
    .selectAll("text")
    .data(data)
    .join("text")
    .attr("x", (d) => x(d.value) + 7)
    .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
    .attr("dy", ".35em")
    .attr("fill", "#173247")
    .attr("font-size", 12)
    .attr("font-weight", 700)
    .text((d) => pct(d.value));
  svg
    .append("text")
    .attr("class", "scatter-axis-label")
    .attr("text-anchor", "middle")
    .attr("x", (margin.left + width - margin.right) / 2)
    .attr("y", height - 10)
    .text("Share of undergraduate enrollment (%) · Fall 2000");
}

function incomeAggregate(rows) {
  const available = rows.filter(
    (s) => s.income && goodNumber(s.cohortCount) && s.cohortCount > 0,
  );
  if (!available.length) return null;
  const weights = quintiles.map((_, i) =>
    d3.sum(available, (s) => s.income[i] * s.cohortCount),
  );
  const total = d3.sum(weights);
  return { available, shares: weights.map((v) => v / total) };
}
function drawIncome() {
  const aggregate = incomeAggregate(selected);
  $("income-coverage").textContent =
    `Coverage: ${aggregate?.available.length || 0} / ${selected.length} selected colleges · cohort-count-weighted`;
  $("income-legend").replaceChildren();
  if (!aggregate) {
    emptyAt("income", "No parent-income data for this selection.");
    return;
  }
  const data = aggregate.shares.map((value, i) => ({
    name: quintiles[i],
    value,
    index: i,
  }));
  const width = 550,
    height = 250;
  const svg = svgAt(
    "income",
    width,
    height,
    "Parent-income quintile shares among students in 1980–82 birth cohorts.",
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);
  const pie = d3
    .pie()
    .sort(null)
    .value((d) => d.value)
    .padAngle(0.011)(data);
  const arc = d3.arc().innerRadius(64).outerRadius(112);
  const label = d3.arc().innerRadius(88).outerRadius(88);
  const slices = g
    .selectAll("path")
    .data(pie)
    .join("path")
    .attr("class", "chart-mark")
    .attr("d", arc)
    .attr("fill", (d) => colors[d.data.index])
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .attr("tabindex", 0)
    .attr(
      "aria-label",
      (d) => `${d.data.name}: ${pct(d.data.value)} of students.`,
    );
  markEvents(slices, (d) => ({
    title: d.data.name,
    lines: [
      `${pct(d.data.value)} of attending students`,
      `${decimal(d.data.value / 0.2)}× its 20% national population share`,
      "1980–82 birth cohorts · Attendees, not admission rates",
    ],
  }));
  g.selectAll("text.slice-label")
    .data(pie.filter((d) => d.data.value > 0.045))
    .join("text")
    .attr("class", "slice-label")
    .attr("transform", (d) => `translate(${label.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .attr("fill", (d) => (d.data.index < 2 ? "#173247" : "white"))
    .attr("pointer-events", "none")
    .text((d) => d3.format(".0%")(d.data.value));
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("y", -2)
    .attr("font-size", 29)
    .attr("font-weight", 700)
    .attr("fill", "#173247")
    .text(pct(aggregate.shares[4]));
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 20)
    .attr("font-size", 10)
    .attr("fill", "#5d707f")
    .text("from highest 20%");
  const items = d3
    .select("#income-legend")
    .selectAll("div")
    .data(data)
    .join("div")
    .attr("class", "legend-item");
  items
    .append("i")
    .attr("class", "legend-dot")
    .style("background", (d) => colors[d.index]);
  items.append("span").text((d) => d.name);
  items.append("strong").text((d) => pct(d.value));
}

const plotDefinitions = [
  {
    id: "admissions",
    container: "admission-scatter",
    x: "admitRate",
    y: "bottom20",
    label: "Lower-income student share (%)",
  },
];
function recomputeRanges() {
  const ranges = {};
  function merge(key, range) {
    if (ranges[key])
      ranges[key] = [
        Math.max(ranges[key][0], range[0]),
        Math.min(ranges[key][1], range[1]),
      ];
    else ranges[key] = range;
  }
  Object.values(selection.regions).forEach((region) =>
    Object.entries(region).forEach(([key, range]) => merge(key, range)),
  );
  selection.brushes = ranges;
}
function collegeTip(s) {
  return {
    title: s.name,
    lines: [
      `${s.state} · ${s.public ? "Public" : "Private"}${s.multi ? " · Multi-campus cluster" : ""}`,
      `From lowest-income families: ${pct(s.bottom20)}`,
      `From highest-income families: ${pct(s.top20)}`,
      `Admission rate: ${pct(s.admitRate)}`,
      "Income: 1980–82 cohorts · Admissions: 2013",
    ],
  };
}
function drawScatter() {
  const width = Math.max(
    320,
    Math.round($("admission-scatter").getBoundingClientRect().width) || 900,
  );
  const height = width < 550 ? 390 : Math.min(520, width * 0.48 + 90),
    margin = { top: 25, right: 25, bottom: 90, left: 75 };
  const xMaximum = d3.max(schools, (s) => s.bottom20) * 1.02;
  scales = {
    bottom20: d3.scaleLinear().domain([0, xMaximum]).nice(4),
    top20: d3.scaleLinear().domain([0, 1]),
    admitRate: d3.scaleLinear().domain([0, 1]),
  };
  brushControls = {};
  plotDefinitions.forEach((plot) => {
    const svg = svgAt(
      plot.container,
      width,
      height,
      "College scatterplot: admission rate on X, lower-income student share on Y. Drag a rectangle to select colleges.",
    );
    const x = scales[plot.x].copy().range([margin.left, width - margin.right]);
    const y = scales[plot.y].copy().range([height - margin.bottom, margin.top]);
    const rows = candidates.filter(
      (s) => goodNumber(s[plot.x]) && goodNumber(s[plot.y]),
    );
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(4)
          .tickFormat("")
          .tickSize(-(height - margin.top - margin.bottom)),
      );
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat("")
          .tickSize(-(width - margin.left - margin.right)),
      );
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(x).ticks(4).tickFormat(d3.format(".0%")).tickSizeOuter(0),
      )
      .selectAll("text")
      .attr("font-size", 12);
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")).tickSizeOuter(0),
      )
      .selectAll("text")
      .attr("font-size", 12);
    svg
      .append("text")
      .attr("class", "scatter-axis-label")
      .attr("text-anchor", "middle")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 39)
      .text("Admission rate (%) · 2013");
    svg
      .append("text")
      .attr("class", "scatter-axis-subtitle")
      .attr("text-anchor", "middle")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 19)
      .text("Farther left = more selective admissions");
    svg
      .append("text")
      .attr("class", "scatter-axis-label")
      .attr("text-anchor", "middle")
      .attr(
        "transform",
        `translate(18,${(margin.top + height - margin.bottom) / 2}) rotate(-90)`,
      )
      .text(plot.label);
    // Brush first, dots second: marks stay available for hover and click.
    const brush = d3
      .brush()
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ])
      .on("brush end", (event) => {
        if (event.selection) {
          const [[x0, y0], [x1, y1]] = event.selection;
          selection.regions[plot.id] = {
            [plot.x]: [x.invert(x0), x.invert(x1)],
            [plot.y]: [y.invert(y1), y.invert(y0)],
          };
        } else delete selection.regions[plot.id];
        recomputeRanges();
        update(false);
      });
    const brushGroup = svg.append("g").attr("class", "brush").call(brush);
    brushControls[plot.id] = { brush, group: brushGroup, x, y };
    const ordered = [...rows].sort(
      (a, b) => b.enrollment2013 - a.enrollment2013,
    );
    const dots = svg
      .append("g")
      .selectAll("circle")
      .data(ordered, (d) => d.id)
      .join("circle")
      .attr("class", "college-dot")
      .attr("cx", (s) => x(s[plot.x]))
      .attr("cy", (s) => y(s[plot.y]))
      .attr("r", 5.3)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr(
        "aria-label",
        (s) =>
          `${s.name}. Lowest-income enrollment share ${pct(s.bottom20)}, highest-income share ${pct(s.top20)}, admission rate ${pct(s.admitRate)}. Activate to show details.`,
      )
      .on("pointerenter focus", (event, s) => {
        if (!tipAllowed(event)) return;
        setHighlight(s.id);
        const c = collegeTip(s);
        showTip(event, c.title, c.lines);
      })
      .on("pointermove", (event, s) => {
        const c = collegeTip(s);
        showTip(event, c.title, c.lines);
      })
      .on("pointerleave blur", () => {
        setHighlight(selection.pinned);
        hideTip();
      })
      .on("click", (event, s) => {
        event.stopPropagation();
        selection.pinned = s.id;
        setHighlight(s.id);
        updateCollegeDetail();
      })
      .on("keydown", (event, s) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selection.pinned = s.id;
          setHighlight(s.id);
          updateCollegeDetail();
        }
      });
    svg
      .append("g")
      .attr("pointer-events", "none")
      .selectAll("text")
      .data(rows, (d) => d.id)
      .join("text")
      .attr("class", "dot-label")
      .attr("x", (s) => x(s[plot.x]) + (x(s[plot.x]) > width - 170 ? -10 : 10))
      .attr("y", (s) => y(s[plot.y]) - 10)
      .attr("text-anchor", (s) =>
        x(s[plot.x]) > width - 170 ? "end" : "start",
      )
      .style("opacity", 0)
      .text((s) => (s.name.length > 32 ? s.name.slice(0, 30) + "…" : s.name));
    if (!rows.length)
      svg
        .append("text")
        .attr("x", (width + margin.left) / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("fill", "#5d707f")
        .text("No colleges with data in this selection.");
  });
  updateLines();
  // Restore the visual rectangle when redrawing after a viewport resize.
  for (const plot of plotDefinitions) {
    const region = selection.regions[plot.id],
      control = brushControls[plot.id];
    if (region && control)
      control.group.call(control.brush.move, [
        [control.x(region[plot.x][0]), control.y(region[plot.y][1])],
        [control.x(region[plot.x][1]), control.y(region[plot.y][0])],
      ]);
  }
}
function updateCollegeDetail() {
  const school = selection.pinned
    ? candidates.find((s) => s.id === selection.pinned)
    : null;
  const target = $("college-detail");
  target.replaceChildren();
  if (!school) {
    selection.pinned = null;
    target.textContent =
      "Hover for a college’s name; click a dot to keep its exact values here.";
    return;
  }
  const identity = document.createElement("div");
  identity.className = "detail-identity";
  const title = document.createElement("strong");
  title.textContent = school.name;
  identity.append(title);
  const location = document.createElement("span");
  location.textContent = `${school.state} · ${school.public ? "Public" : "Private"}${school.multi ? " · Campus cluster" : ""}`;
  identity.append(location);
  target.append(identity);
  for (const [label, value] of [
    ["From lowest-income families", formatPct(school.bottom20)],
    ["From highest-income families", formatPct(school.top20)],
    ["Admission rate (2013)", formatPct(school.admitRate)],
  ]) {
    const item = document.createElement("div");
    item.className = "detail-value";
    const heading = document.createElement("span");
    heading.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value;
    item.append(heading, number);
    target.append(item);
  }
}
function updateLines() {
  d3.selectAll(".college-dot")
    .classed("outside-selection", (s) => !passesBrush(s))
    .style("fill", (s) =>
      passesBrush(s) ? (s.public ? "#147d85" : "#c17449") : "#d5dfe5",
    );
  setHighlight(selection.highlighted || selection.pinned);
  updateCollegeDetail();
  updateBrushSummary();
}
function updateBrushSummary() {
  const plotted = candidates.filter(
    (s) => goodNumber(s.bottom20) && goodNumber(s.admitRate),
  );
  const active = Object.keys(selection.brushes).length > 0;
  const selectedPlotted = plotted.filter(passesBrush).length;
  $("scatter-selection-count").textContent = active
    ? `${selectedPlotted} of ${plotted.length} plotted colleges selected`
    : `${plotted.length} colleges plotted`;
  const labels = {
    admitRate: "Admission rate",
    bottom20: "Lower-income share",
    top20: "Higher-income share",
  };
  $("scatter-selection-ranges").textContent = active
    ? Object.entries(selection.brushes)
        .map(
          ([key, range]) => `${labels[key]}: ${pct(range[0])}–${pct(range[1])}`,
        )
        .join(" · ")
    : `Drag on the plot to select a range.${candidates.length - plotted.length ? " " + (candidates.length - plotted.length) + " college has no income estimate and is omitted from the plot." : ""}`;
  $("brush-summary").classList.toggle("has-selection", active);
  $("clear-brush").disabled = !active;
}
function drawTable() {
  const rows = [...selected].sort((a, b) => a.name.localeCompare(b.name));
  $("roster-count").textContent =
    `${rows.length} ${rows.length === 1 ? "college" : "colleges"}`;
  const joined = d3
    .select("#school-rows")
    .selectAll("tr")
    .data(rows, (d) => d?.id || "empty")
    .join("tr")
    .attr("tabindex", 0)
    .on("pointerenter focus", (event, s) => setHighlight(s.id))
    .on("pointerleave blur", () => setHighlight(selection.pinned));
  joined.each(function (s) {
    const values = [
      s.name + (s.multi ? " *" : ""),
      s.state,
      formatPct(s.admitRate),
      formatPct(s.bottom20),
      formatPct(s.top20),
    ];
    d3.select(this)
      .selectAll("td")
      .data(values)
      .join("td")
      .text((d) => d);
  });
  if (!rows.length)
    d3.select("#school-rows")
      .append("tr")
      .append("td")
      .attr("colspan", 5)
      .text("No colleges match the current filters.");
}
function downloadText(text, name, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function bindControls() {
  $("group").addEventListener("change", (event) => {
    selection.group = event.target.value;
    selection.state = null;
    clearRanges();
    update(true);
  });
  $("search").addEventListener("input", (event) => {
    selection.query = event.target.value.trim().toLowerCase();
    selection.state = null;
    clearRanges();
    update(true);
  });
  $("state-select").addEventListener("change", (event) =>
    stateChosen(event.target.value),
  );
  $("map-metric").addEventListener("change", (event) => {
    selection.mapMetric = event.target.value;
    update(false);
  });
  $("download-origins").addEventListener("click", () => {
    const summary = originSummary();
    const data = features.map((f) => ({
      home_state: stateAbbreviations[f.id],
      home_state_name: f.properties.name,
      incoming_students_2014: summary.states[f.id].count,
      state_population_2014: summary.states[f.id].population,
      entrants_as_fraction_of_state_population:
        summary.states[f.id].populationRate,
      entrants_as_percent_of_state_population:
        summary.states[f.id].populationRate * 100,
      share_of_selected_incoming_us_students: summary.states[f.id].share,
      all_ipeds_college_entrants_from_state_2014:
        summary.states[f.id].stateEntrants,
      share_of_state_college_entrants: summary.states[f.id].rate,
    }));
    downloadText(
      d3.csvFormat(data),
      "student-home-state-selection-2014.csv",
      "text/csv",
    );
  });
  $("clear-state").addEventListener("click", () => stateChosen(null));
  $("reset").addEventListener("click", () => {
    selection.group = "all";
    selection.state = null;
    selection.mapMetric = "populationRate";
    $("map-metric").value = "populationRate";
    selection.query = "";
    clearRanges();
    $("group").value = "all";
    $("search").value = "";
    hideTip();
    update(true);
  });
  $("clear-brush").addEventListener("click", () => {
    clearRanges();
    update(true);
  });
  $("download").addEventListener("click", () => {
    const data = selected.map((s) => ({
      super_opeid: s.id,
      college: s.name,
      state: s.state,
      source_school_group: s.group,
      multi_campus_cluster: s.multi,
      admission_rate_2013: s.admitRate,
      parent_q1_share_1980_82: s.income?.[0] ?? null,
      parent_q2_share_1980_82: s.income?.[1] ?? null,
      parent_q3_share_1980_82: s.income?.[2] ?? null,
      parent_q4_share_1980_82: s.income?.[3] ?? null,
      parent_q5_share_1980_82: s.income?.[4] ?? null,
      mean_students_per_birth_cohort: s.cohortCount,
      asian_or_pacific_enrollment_share_2000: s.race?.[0] ?? null,
      black_enrollment_share_2000: s.race?.[1] ?? null,
      hispanic_enrollment_share_2000: s.race?.[2] ?? null,
      international_enrollment_share_2000: s.race?.[3] ?? null,
      other_unreported_enrollment_share_2000: s.race?.[4] ?? null,
      enrollment_2000: s.enrollment2000,
      score_adjusted_attendance_top1_to_middle_ratio_2011_13_15:
        s.attendanceGap,
    }));
    downloadText(
      d3.csvFormat(data),
      "college-access-selection.csv",
      "text/csv",
    );
  });
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => update(true), 120);
  });
}

Promise.all([
  d3.json("data/schools.json"),
  d3.json("data/us-states.json"),
  d3.json("data/origin-state-totals.json"),
  d3.json("data/state-populations-2014.json"),
])
  .then(([data, topology, denominators, populations]) => {
    statePopulations = populations;
    originDenominators = denominators;
    schools = data;
    schools.forEach((s) => byId.set(s.id, s));
    features = topojson
      .feature(topology, topology.objects.states)
      .features.filter((d) => stateAbbreviations[d.id]);
    bindControls();
    update(true);
    // Read-only metadata supports checking the loaded dataset in a browser.
    window.collegeExplorer = {
      version: "4.1",
      schoolCount: schools.length,
      getOrigins: () => originSummary(),
      getSelection: () => ({
        group: selection.group,
        state: selection.state,
        mapMetric: selection.mapMetric,
        brushes: { ...selection.brushes },
        ids: selected.map((s) => s.id),
      }),
    };
  })
  .catch((error) => {
    console.error(error);
    $("load-error").hidden = false;
  });
