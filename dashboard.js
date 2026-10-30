const COLORS = {
  ink: "#1d2723",
  muted: "#718078",
  coral: "#ff765f",
  acid: "#d7ed45",
  blue: "#a7d9de",
  paper: "#ebe2d5",
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const PERSON_COLORS = [COLORS.coral, COLORS.blue, "#9eb72a"];
let rows = [];
let charts = {};

const $ = (selector) => document.querySelector(selector);

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
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(date).replace(".", "");
}

function getFilteredRows() {
  const year = $("#year-filter").value;
  const person = $("#person-filter").value;
  return rows.filter((row) => (year === "all" || row.year === Number(year)) && (person === "all" || row.cagadora === person));
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
  const counts = countBy(filtered, "month");
  charts.month.data.datasets[0].data = MONTHS.map((_, index) => counts[index + 1] || 0);
  charts.month.update();
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
      <div class="ranking-bar"><span style="width: ${(count / max) * 100}%"></span></div>
    </div>
  `).join("") : "<p class=\"kpi-note\">No hay datos para este filtro.</p>";
  $("#leader-callout").textContent = ranking.length ? `${ranking[0][0]} lidera con ${formatNumber(ranking[0][1])} registros.` : "Sin registros en esta selección.";
}

function updatePersonChart(filtered) {
  const counts = countBy(filtered, "cagadora");
  const people = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  charts.person.data.labels = people;
  charts.person.data.datasets[0].data = people.map((person) => counts[person]);
  charts.person.data.datasets[0].backgroundColor = people.map((_, index) => PERSON_COLORS[index % PERSON_COLORS.length]);
  charts.person.update();
  $("#person-legend").innerHTML = people.map((person, index) => `
    <div class="person-legend-row"><span class="person-legend-label"><i class="person-legend-swatch" style="background: ${PERSON_COLORS[index % PERSON_COLORS.length]}"></i>${person}</span><span class="person-legend-value">${formatNumber(counts[person])} · ${Math.round((counts[person] / filtered.length) * 100)}%</span></div>
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
  $("#insight-text").textContent = `El mes más movido es ${MONTHS[Number(peakMonth[0]) - 1]}, y la hora punta aparece alrededor de las ${hour}:00. La estadística no miente.`;
}

function updateDashboard() {
  const filtered = getFilteredRows();
  updateKpis(filtered);
  updateYearChart(filtered);
  updateMonthChart(filtered);
  updateRanking(filtered);
  updatePersonChart(filtered);
  updateInsight(filtered);
}

function initializeCharts() {
  charts.year = new Chart($("#year-chart"), {
    type: "bar",
    data: { labels: [], datasets: [{ data: [], backgroundColor: COLORS.coral, borderRadius: 2, barPercentage: .65 }] },
    options: { ...chartOptions(), plugins: { ...chartOptions().plugins, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => `${formatNumber(context.raw)} cagadas` } } } },
  });
  charts.month = new Chart($("#month-chart"), {
    type: "line",
    data: { labels: MONTHS.map((month) => month.toUpperCase()), datasets: [{ data: [], borderColor: COLORS.ink, backgroundColor: COLORS.acid, pointBackgroundColor: COLORS.coral, pointBorderColor: COLORS.ink, pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: .35, fill: true }] },
    options: { ...chartOptions(), scales: { ...chartOptions().scales, y: { ...chartOptions().scales.y, suggestedMax: 10 } }, plugins: { ...chartOptions().plugins, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => `${formatNumber(context.raw)} cagadas` } } } },
  });
  charts.person = new Chart($("#person-chart"), {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [], backgroundColor: PERSON_COLORS, borderWidth: 3, borderColor: "#fffdf9", hoverOffset: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "72%", animation: { duration: 600 }, plugins: { legend: { display: false }, tooltip: { backgroundColor: COLORS.ink, padding: 12, displayColors: false } } },
  });
}

async function init() {
  try {
    const response = await fetch("data/staging/cagadas.csv");
    if (!response.ok) throw new Error(`CSV request failed: ${response.status}`);
    rows = parseCsv(await response.text());
    const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
    const people = [...new Set(rows.map((row) => row.cagadora))].sort();
    years.forEach((year) => $("#year-filter").insertAdjacentHTML("beforeend", `<option value="${year}">${year}</option>`));
    people.forEach((person) => $("#person-filter").insertAdjacentHTML("beforeend", `<option value="${person}">${person}</option>`));
    initializeCharts();
    updateDashboard();
    $("#status-text").textContent = `${formatNumber(rows.length)} registros sincronizados`;
    $("#year-filter").addEventListener("change", updateDashboard);
    $("#person-filter").addEventListener("change", updateDashboard);
    $("#reset-filters").addEventListener("click", () => { $("#year-filter").value = "all"; $("#person-filter").value = "all"; updateDashboard(); });
  } catch (error) {
    console.error(error);
    $("#status-text").textContent = "error al cargar datos";
    $("#insight-text").textContent = "No se pudo cargar el archivo de datos. Comprueba que la página se sirve desde GitHub Pages.";
  }
}

document.addEventListener("DOMContentLoaded", init);
