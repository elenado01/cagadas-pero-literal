const COLORS = {
  ink: "#1d2723",
  muted: "#718078",
  coral: "#ff765f",
  acid: "#d7ed45",
  blue: "#a7d9de",
  paper: "#ebe2d5",
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const PERSON_COLORS = { Elena: "#9eb72a", Sol: "#f2c94c", "Lucía": "#df3f45" };
let rows = [];
let topicMessages = [];
let charts = {};
let people = [];
let historySelection = { title: "Histórico completo", type: "records", predicate: () => true };
let pendingHistoryAction = null;

const $ = (selector) => document.querySelector(selector);
const getPersonColor = (person) => PERSON_COLORS[person] || COLORS.muted;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const date = new Date(row["timestamp cagada"].replace(" ", "T"));
    return {
      ...row,
      date,
      year: Number(row["año"]),
      month: Number(row["mes"]),
      day: Number(row["día"]),
    };
  });
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = typeof key === "function" ? key(item) : item[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function formatNumber(number) {
  return new Intl.NumberFormat("es-ES").format(number);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(date).replace(".", "");
}

function formatTimestamp(date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(".", "");
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getFilteredRows() {
  const year = $("#year-filter").value;
  const person = $("#person-filter").value;
  return rows.filter((row) => (year === "all" || row.year === Number(year)) && (person === "all" || row.cagadora === person));
}

function showView(view) {
  const isHistory = view === "history";
  const isTopics = view === "topics";
  $("#dashboard-view").hidden = isHistory || isTopics;
  $("#history-view").hidden = !isHistory;
  $("#topics-view").hidden = !isTopics;
  $("#dashboard-tab").classList.toggle("is-active", !isHistory && !isTopics);
  $("#history-tab").classList.toggle("is-active", isHistory);
  $("#topics-tab").classList.toggle("is-active", isTopics);
  $("#dashboard-tab").setAttribute("aria-selected", String(!isHistory && !isTopics));
  $("#history-tab").setAttribute("aria-selected", String(isHistory));
  $("#topics-tab").setAttribute("aria-selected", String(isTopics));
}

function getFilteredTopics() {
  const year = $("#year-filter").value;
  const person = $("#person-filter").value;
  const topic = $("#topic-filter").value;
  return topicMessages.filter((item) =>
    (year === "all" || item.year === Number(year)) &&
    (person === "all" || item.person === person) &&
    (topic === "all" || item.topic === topic)
  );
}

function renderTopics() {
  const items = getFilteredTopics();
  $("#topics-context").textContent = `${formatNumber(items.length)} mensajes relacionados · más recientes primero`;
  $("#topics-tab-count").textContent = formatNumber(items.length);
  $("#topics-list").innerHTML = items.map((item) => `
    <tr>
      <td><span class="topic-tag">${escapeHtml(item.topic)}</span></td>
      <td><span class="history-person"><i style="background: ${getPersonColor(item.person)}"></i><strong>${escapeHtml(item.person)}</strong></span></td>
      <td><time>${escapeHtml(formatTimestamp(item.date))}</time></td>
      <td>${escapeHtml(item.text)}</td>
    </tr>
  `).join("");
  $("#topics-empty").hidden = items.length > 0;
}

function renderHistory() {
  const filtered = getFilteredRows();
  const items = historySelection.type === "absence"
    ? getAbsencePeriods(filtered, historySelection.person).filter((period) => period.days === historySelection.days).sort((a, b) => b.end - a.end)
    : filtered.filter(historySelection.predicate).sort((a, b) => b.date - a.date);
  $("#history-title").textContent = historySelection.title;
  $("#history-context").textContent = `${formatNumber(items.length)} ${historySelection.type === "absence" ? "periodos" : "registros"} · más recientes primero`;
  $("#history-tab-count").textContent = formatNumber(items.length);
  $("#history-head").innerHTML = historySelection.type === "absence"
    ? "<tr><th>Cagadora</th><th>Desde</th><th>Hasta</th><th>Días</th></tr>"
    : "<tr><th>Cagadora</th><th>Fecha</th><th>Hora</th></tr>";
  $("#history-list").innerHTML = historySelection.type === "absence"
    ? items.map((period) => `
      <tr><td><span class="history-person"><i style="background: ${getPersonColor(period.person)}"></i><strong>${period.person}</strong></span></td><td>${formatDate(period.start)}</td><td>${formatDate(period.end)}</td><td><strong>${period.days}</strong></td></tr>
    `).join("")
    : items.map((row) => `
      <tr><td><span class="history-person"><i style="background: ${getPersonColor(row.cagadora)}"></i><strong>${row.cagadora}</strong></span></td><td>${formatDate(row.date)}</td><td><time>${new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(row.date)}</time></td></tr>
    `).join("");
  $("#history-empty").hidden = items.length > 0;
}

function selectHistory(title, predicate) {
  historySelection = { title, type: "records", predicate };
  renderHistory();
  showView("history");
  $("#history-view").scrollIntoView({ behavior: "smooth", block: "start" });
}

function requestHistory(title, predicate, navigate = () => selectHistory(title, predicate)) {
  if (!window.matchMedia("(max-width: 820px)").matches) {
    navigate();
    return;
  }
  pendingHistoryAction = { navigate };
  $("#chart-history-selection").textContent = title;
  $("#chart-history-action").hidden = false;
}

function clearPendingHistoryAction() {
  pendingHistoryAction = null;
  $("#chart-history-action").hidden = true;
}

function selectAbsenceHistory(person, days) {
  historySelection = { title: `${person} · ${days} días sin cagar`, type: "absence", person, days };
  renderHistory();
  showView("history");
  $("#history-view").scrollIntoView({ behavior: "smooth", block: "start" });
}

function chartOptions({ yTitle = "", integer = true } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: "easeOutQuart" },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: COLORS.ink, padding: 12, titleFont: { family: "DM Mono" }, bodyFont: { family: "DM Mono" }, displayColors: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: COLORS.muted, font: { family: "DM Mono", size: 10 } }, border: { display: false } },
      y: { beginAtZero: true, suggestedMax: 10, grid: { color: "rgba(113,128,120,.16)" }, ticks: { color: COLORS.muted, font: { family: "DM Mono", size: 10 }, precision: integer ? 0 : 1 }, border: { display: false }, title: { display: Boolean(yTitle), text: yTitle, color: COLORS.muted, font: { family: "DM Mono", size: 10 } } },
    },
  };
}

function updateKpis(filtered) {
  const dayCounts = countBy(filtered, (row) => row["fecha cagada"]);
  const peakDayEntry = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  const yearCounts = countBy(filtered, "year");
  const peakYearEntry = Object.entries(yearCounts).sort((a, b) => b[1] - a[1])[0];
  const activeDays = new Set(filtered.map((row) => row["fecha cagada"])).size;

  $("#total-count").textContent = formatNumber(filtered.length);
  $("#peak-day").textContent = peakDayEntry ? formatDate(new Date(`${peakDayEntry[0]}T12:00:00`)) : "—";
  $("#peak-day-note").textContent = peakDayEntry ? `${peakDayEntry[1]} cagadas ese día` : "sin datos";
  $("#peak-year").textContent = peakYearEntry ? peakYearEntry[0] : "—";
  $("#peak-year-note").textContent = peakYearEntry ? `${formatNumber(peakYearEntry[1])} cagadas` : "sin datos";
  $("#daily-average").textContent = activeDays ? (filtered.length / activeDays).toFixed(1).replace(".", ",") : "—";
  $("#donut-total").textContent = formatNumber(filtered.length);
}

function updateYearChart(filtered) {
  const counts = countBy(filtered, "year");
  const years = Object.keys(counts).sort((a, b) => a - b);
  charts.year.data.labels = years;
  charts.year.data.datasets[0].data = years.map((year) => counts[year]);
  charts.year.update();
  $("#year-range").textContent = years.length ? `${years[0]} — ${years[years.length - 1]}` : "sin datos";
}

function updateMonthChart(filtered) {
  const visiblePeople = [...new Set(filtered.map((row) => row.cagadora))].sort();
  const counts = filtered.reduce((result, row) => {
    result[row.cagadora] ??= {};
    result[row.cagadora][row.month] = (result[row.cagadora][row.month] || 0) + 1;
    return result;
  }, {});
  charts.month.data.datasets = visiblePeople.map((person) => {
    return {
    label: person,
    data: MONTHS.map((_, monthIndex) => counts[person]?.[monthIndex + 1] || 0),
    borderColor: getPersonColor(person),
    backgroundColor: "transparent",
    pointBackgroundColor: getPersonColor(person),
    pointBorderColor: COLORS.ink,
    pointBorderWidth: 1.5,
    pointRadius: 3,
    pointHoverRadius: 5,
    tension: .35,
    fill: false,
    };
  });
  charts.month.update();
}

function updateHourChart(filtered) {
  const counts = countBy(filtered, (row) => row.date.getHours());
  charts.hour.data.datasets[0].data = Array.from({ length: 24 }, (_, hour) => counts[hour] || 0);
  charts.hour.update();
}

function updateDailyChart(filtered) {
  if (!filtered.length) {
    charts.daily.data.labels = [];
    charts.daily.data.datasets[0].data = [];
    charts.daily.update();
    return;
  }

  const countsByDate = countBy(filtered, "fecha cagada");
  const dates = filtered.map((row) => row.date.getTime());
  const firstDate = new Date(Math.min(...dates));
  const lastDate = new Date(Math.max(...dates));
  firstDate.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);

  const maxDailyCount = Math.max(...Object.values(countsByDate), 0);
  const frequency = Array(maxDailyCount + 1).fill(0);
  for (const date = new Date(firstDate); date <= lastDate; date.setDate(date.getDate() + 1)) {
    const dateKey = formatDateKey(date);
    const count = countsByDate[dateKey] || 0;
    frequency[count] = (frequency[count] || 0) + 1;
  }

  charts.daily.data.labels = frequency.map((_, count) => String(count));
  charts.daily.data.datasets[0].data = frequency;
  charts.daily.update();
}

function getAbsencePeriods(filtered, person) {
  const dates = [...new Set(filtered.filter((row) => row.cagadora === person).map((row) => row["fecha cagada"]))].sort();
  const periods = [];
  for (let index = 1; index < dates.length; index += 1) {
    const previousPoop = new Date(`${dates[index - 1]}T12:00:00`);
    const nextPoop = new Date(`${dates[index]}T12:00:00`);
    const days = Math.max(0, Math.round((nextPoop - previousPoop) / 86400000) - 1);
    if (days === 0) continue;
    const start = new Date(previousPoop);
    const end = new Date(nextPoop);
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() - 1);
    periods.push({ person, start, end, days });
  }
  return periods;
}

function updateAbsenceChart(filtered) {
  const periodsByPerson = filtered.reduce((result, row) => {
    result[row.cagadora] ??= getAbsencePeriods(filtered, row.cagadora);
    return result;
  }, {});
  const distributions = {};
  let maxGap = 0;

  for (const [person, periods] of Object.entries(periodsByPerson)) {
    const gaps = {};
    for (const period of periods) {
      gaps[period.days] = (gaps[period.days] || 0) + 1;
      maxGap = Math.max(maxGap, period.days);
    }
    distributions[person] = gaps;
  }

  const labels = Array.from({ length: maxGap }, (_, index) => String(index + 1));
  charts.absence.data.labels = labels;
  charts.absence.data.datasets = Object.keys(distributions).sort().map((person) => ({
    label: person,
    data: labels.map((gap) => distributions[person][gap] || null),
    backgroundColor: getPersonColor(person),
    borderColor: COLORS.ink,
    borderWidth: 1,
    borderRadius: 2,
    barPercentage: .82,
    categoryPercentage: .78,
    minBarLength: 9,
    hoverBorderWidth: 2,
  }));
  charts.absence.update();
}

function updateRanking(filtered) {
  const counts = countBy(filtered, "cagadora");
  const ranking = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = ranking[0]?.[1] || 1;
  $("#ranking-list").innerHTML = ranking.length ? ranking.map(([name, count], index) => `
    <div class="ranking-row">
      <span class="ranking-number">0${index + 1}</span>
      <span class="ranking-name">${name}</span>
      <strong class="ranking-value">${formatNumber(count)}</strong>
      <div class="ranking-bar"><span style="width: ${(count / max) * 100}%; background: ${getPersonColor(name)}"></span></div>
    </div>
  `).join("") : "<p class=\"kpi-note\">No hay datos para este filtro.</p>";
  $("#leader-callout").textContent = ranking.length ? `${ranking[0][0]} lidera con ${formatNumber(ranking[0][1])} registros.` : "Sin registros en esta selección.";
}

function updatePersonChart(filtered) {
  const counts = countBy(filtered, "cagadora");
  const people = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  charts.person.data.labels = people;
  charts.person.data.datasets[0].data = people.map((person) => counts[person]);
  charts.person.data.datasets[0].backgroundColor = people.map(getPersonColor);
  charts.person.update();
  $("#person-legend").innerHTML = people.map((person) => `
    <div class="person-legend-row"><span class="person-legend-label"><i class="person-legend-swatch" style="background: ${getPersonColor(person)}"></i>${person}</span><span class="person-legend-value">${formatNumber(counts[person])} · ${Math.round((counts[person] / filtered.length) * 100)}%</span></div>
  `).join("");
}

function updateInsight(filtered) {
  const monthCounts = countBy(filtered, "month");
  const peakMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
  const hourCounts = countBy(filtered, (row) => row.date.getHours());
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  if (!peakMonth || !peakHour) {
    $("#insight-text").textContent = "No hay suficientes datos para encontrar un patrón.";
    return;
  }
  const hour = String(peakHour[0]).padStart(2, "0");
  $("#insight-text").textContent = `El mes más movido es ${MONTH_NAMES[Number(peakMonth[0]) - 1]}, y la hora punta aparece alrededor de las ${hour}:00. La estadística no miente.`;
}

function updateDashboard() {
  const filtered = getFilteredRows();
  updateKpis(filtered);
  updateYearChart(filtered);
  updateMonthChart(filtered);
  updateHourChart(filtered);
  updateDailyChart(filtered);
  updateAbsenceChart(filtered);
  updateRanking(filtered);
  updatePersonChart(filtered);
  updateInsight(filtered);
  renderHistory();
}

function initializeCharts() {
  charts.year = new Chart($("#year-chart"), {
    type: "bar",
    data: { labels: [], datasets: [{ data: [], backgroundColor: COLORS.coral, borderRadius: 2, barPercentage: .65 }] },
    options: { ...chartOptions(), onClick: (event, elements, chart) => { if (!elements.length) return; const year = Number(chart.data.labels[elements[0].index]); requestHistory(`Año ${year}`, (row) => row.year === year); }, plugins: { ...chartOptions().plugins, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => `${formatNumber(context.raw)} cagadas` } } } },
  });
  charts.month = new Chart($("#month-chart"), {
    type: "line",
    data: { labels: MONTHS.map((month) => month.toUpperCase()), datasets: [] },
    options: { ...chartOptions(), onClick: (event, elements, chart) => { if (!elements.length) return; const point = elements[0]; const month = point.index + 1; const person = chart.data.datasets[point.datasetIndex].label; requestHistory(`${person} · ${MONTH_NAMES[month - 1]}`, (row) => row.cagadora === person && row.month === month); }, scales: { ...chartOptions().scales, y: { ...chartOptions().scales.y, suggestedMax: 10 } }, plugins: { ...chartOptions().plugins, legend: { display: true, position: "top", align: "end", labels: { color: COLORS.muted, boxWidth: 10, boxHeight: 10, padding: 14, font: { family: "DM Mono", size: 10 } } }, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => `${context.dataset.label}: ${formatNumber(context.raw)} cagadas` } } } },
  });
  charts.hour = new Chart($("#hour-chart"), {
    type: "bar",
    data: { labels: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}h`), datasets: [{ data: [], backgroundColor: COLORS.blue, borderRadius: 2, barPercentage: .72 }] },
    options: { ...chartOptions(), interaction: { mode: "index", intersect: false }, onHover: (event, elements) => { if (window.matchMedia("(min-width: 821px)").matches) event.native.target.style.cursor = elements.length ? "pointer" : "default"; }, onClick: (event, elements, chart) => { if (!elements.length) return; const hour = elements[0].index; requestHistory(`Cagadas a las ${String(hour).padStart(2, "0")}:00`, (row) => row.date.getHours() === hour); }, scales: { ...chartOptions().scales, x: { ...chartOptions().scales.x, categoryPercentage: .95, ticks: { ...chartOptions().scales.x.ticks, maxRotation: 0, autoSkip: false, callback: (value, index) => index % 3 === 0 ? `${String(index).padStart(2, "0")}h` : "" } } }, plugins: { ...chartOptions().plugins, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => `${formatNumber(context.raw)} cagadas` } } } },
  });
  charts.daily = new Chart($("#daily-chart"), {
    type: "line",
    data: { labels: [], datasets: [{ data: [], borderColor: COLORS.coral, backgroundColor: "rgba(255,118,95,.18)", pointBackgroundColor: COLORS.coral, pointBorderColor: COLORS.ink, pointBorderWidth: 1.5, pointRadius: 3.5, pointHoverRadius: 5, tension: .25, fill: true }] },
    options: { ...chartOptions(), onClick: (event, elements, chart) => { if (!elements.length) return; const count = Number(chart.data.labels[elements[0].index]); const dailyCounts = countBy(getFilteredRows(), "fecha cagada"); requestHistory(`Días con ${count} cagadas`, (row) => dailyCounts[row["fecha cagada"]] === count); }, scales: { ...chartOptions().scales, x: { ...chartOptions().scales.x, title: { display: true, text: "cagadas en el día", color: COLORS.muted, font: { family: "DM Mono", size: 10 } } }, y: { ...chartOptions().scales.y, title: { display: true, text: "número de días", color: COLORS.muted, font: { family: "DM Mono", size: 10 } } } }, plugins: { ...chartOptions().plugins, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => `${formatNumber(context.raw)} días con ${context.label} cagadas` } } } },
  });
  charts.absence = new Chart($("#absence-chart"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: { ...chartOptions(), interaction: { mode: "nearest", intersect: true }, onHover: (event, elements) => { if (window.matchMedia("(min-width: 821px)").matches) event.native.target.style.cursor = elements.length ? "pointer" : "default"; }, onClick: (event, elements, chart) => { const clicked = elements[0]; if (!clicked) return; const person = chart.data.datasets[clicked.datasetIndex].label; const days = Number(chart.data.labels[clicked.index]); requestHistory(`${person} · ${days} días sin cagar`, null, () => selectAbsenceHistory(person, days)); }, scales: { ...chartOptions().scales, x: { ...chartOptions().scales.x, stacked: false, title: { display: true, text: "días seguidos sin cagar", color: COLORS.muted, font: { family: "DM Mono", size: 10 } } }, y: { ...chartOptions().scales.y, stacked: false, title: { display: true, text: "número de intervalos", color: COLORS.muted, font: { family: "DM Mono", size: 10 } } } }, plugins: { ...chartOptions().plugins, legend: { display: true, position: "top", align: "end", labels: { color: COLORS.muted, boxWidth: 10, boxHeight: 10, padding: 14, font: { family: "DM Mono", size: 10 } } }, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => `${context.dataset.label}: ${formatNumber(context.raw)} intervalos` } } } },
  });
  charts.person = new Chart($("#person-chart"), {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 3, borderColor: "#fffdf9", hoverOffset: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "72%", animation: { duration: 600 }, onClick: (event, elements, chart) => { if (!elements.length) return; const person = chart.data.labels[elements[0].index]; requestHistory(`${person} · todos los registros`, (row) => row.cagadora === person); }, plugins: { legend: { display: false }, tooltip: { backgroundColor: COLORS.ink, padding: 12, displayColors: false } } },
  });
}

async function init() {
  try {
    const [response, topicsResponse] = await Promise.all([
      fetch("data/staging/cagadas.csv"),
      fetch("data/staging/conversaciones_caca.json"),
    ]);
    if (!response.ok) throw new Error(`CSV request failed: ${response.status}`);
    if (!topicsResponse.ok) throw new Error(`Topics request failed: ${topicsResponse.status}`);
    rows = parseCsv(await response.text());
    topicMessages = (await topicsResponse.json()).map((item) => ({ ...item, date: new Date(item.timestamp) }));
    const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
    people = [...new Set(rows.map((row) => row.cagadora))].sort();
    years.forEach((year) => $("#year-filter").insertAdjacentHTML("beforeend", `<option value="${year}">${year}</option>`));
    people.forEach((person) => $("#person-filter").insertAdjacentHTML("beforeend", `<option value="${person}">${person}</option>`));
    [...new Set(topicMessages.map((item) => item.topic))].sort().forEach((topic) => $("#topic-filter").insertAdjacentHTML("beforeend", `<option value="${topic}">${topic}</option>`));
    initializeCharts();
    updateDashboard();
    renderTopics();
    const latestPoop = rows.reduce((latest, row) => row.date > latest.date ? row : latest, rows[0]);
    $("#status-text").textContent = `${formatNumber(rows.length)} registros sincronizados · última cagada: ${formatTimestamp(latestPoop.date)}`;
    const handleFilterChange = (event) => { event.target.blur(); clearPendingHistoryAction(); updateDashboard(); };
    $("#year-filter").addEventListener("change", handleFilterChange);
    $("#person-filter").addEventListener("change", handleFilterChange);
    $("#dashboard-tab").addEventListener("click", () => showView("dashboard"));
    $("#history-tab").addEventListener("click", () => { renderHistory(); showView("history"); });
    $("#topics-tab").addEventListener("click", () => { renderTopics(); showView("topics"); });
    $("#topic-filter").addEventListener("change", renderTopics);
    $("#year-filter").addEventListener("change", renderTopics);
    $("#person-filter").addEventListener("change", renderTopics);
    $("#history-all").addEventListener("click", () => selectHistory("Histórico completo", () => true));
    $("#chart-history-confirm").addEventListener("click", () => { if (!pendingHistoryAction) return; const { navigate } = pendingHistoryAction; clearPendingHistoryAction(); navigate(); });
  } catch (error) {
    console.error(error);
    $("#status-text").textContent = "error al cargar datos";
    $("#insight-text").textContent = "No se pudo cargar el archivo de datos. Comprueba que la página se sirve desde GitHub Pages.";
  }
}

document.addEventListener("DOMContentLoaded", init);
