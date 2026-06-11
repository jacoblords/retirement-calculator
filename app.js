const inputIds = [
  "currentAge",
  "retirementAge",
  "lifeExpectancy",
  "currentSavings",
  "annualContribution",
  "contributionGrowth",
  "preReturn",
  "postReturn",
  "inflation",
  "taxRate",
  "retirementSpend",
  "retirementCOLA",
  "socialSecurityStartAge",
  "socialSecurityBenefit",
];

const elements = Object.fromEntries(
  inputIds.map((id) => [id, document.getElementById(id)])
);

const balanceAtRetirementEl = document.getElementById("balanceAtRetirement");
const balanceAtRetirementLabelEl = document.getElementById(
  "balanceAtRetirementLabel"
);
const yearsFundedEl = document.getElementById("yearsFunded");
const endingBalanceEl = document.getElementById("endingBalance");
const endingBalanceLabelEl = document.getElementById("endingBalanceLabel");
const breakdownBody = document.getElementById("breakdownBody");
const toggleTable = document.getElementById("toggleTable");
const summaryToggleButtons = document.querySelectorAll("[data-summary]");

let showAllRows = false;
let summaryMode = "nominal";
const storageKey = "retirementCalculator.inputs";
const summaryKey = "retirementCalculator.summaryMode";
const tableKey = "retirementCalculator.showAllYears";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

let balanceChart;
let cashflowChart;

function toNumber(value, fallback = 0) {
  if (value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumberNullable(value) {
  if (value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getInputs() {
  return {
    currentAge: toNumberNullable(elements.currentAge.value),
    retirementAge: toNumberNullable(elements.retirementAge.value),
    lifeExpectancy: toNumberNullable(elements.lifeExpectancy.value),
    currentSavings: toNumber(elements.currentSavings.value),
    annualContribution: toNumber(elements.annualContribution.value),
    contributionGrowth: toNumber(elements.contributionGrowth.value) / 100,
    preReturn: toNumber(elements.preReturn.value) / 100,
    postReturn: toNumber(elements.postReturn.value) / 100,
    inflation: toNumber(elements.inflation.value) / 100,
    taxRate: toNumber(elements.taxRate.value) / 100,
    retirementSpend: toNumber(elements.retirementSpend.value),
    retirementCOLA: toNumber(elements.retirementCOLA.value) / 100,
    socialSecurityStartAge: toNumberNullable(
      elements.socialSecurityStartAge.value
    ),
    socialSecurityBenefit: toNumber(elements.socialSecurityBenefit.value),
  };
}

function buildTableRows(rows) {
  return rows
    .map((row) => {
      const changeValue = row.growth;
      const changeClass = changeValue >= 0 ? "delta positive" : "delta negative";
      const changeDisplay =
        `${changeValue >= 0 ? "+" : "-"}${currency.format(Math.abs(changeValue))}`;
      return `
        <tr>
          <td>${row.year}</td>
          <td>${row.age}</td>
          <td>${currency.format(row.startBalance)}</td>
          <td>${currency.format(row.contribution)}</td>
          <td>${currency.format(row.spendingNeed)}</td>
          <td>${currency.format(row.withdrawal)}</td>
          <td>${currency.format(row.socialSecurity)}</td>
          <td>${currency.format(row.tax)}</td>
          <td class="${changeClass}">${changeDisplay}</td>
          <td>${currency.format(row.endBalance)}</td>
          <td>${currency.format(row.realEndBalance)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderTable(data) {
  const rows = showAllRows ? data : data.slice(0, 18);
  breakdownBody.innerHTML = buildTableRows(rows);
  toggleTable.textContent = showAllRows ? "Show fewer years" : "Show all years";
}

function renderSummary(result) {
  const showReal = summaryMode === "real";
  balanceAtRetirementEl.textContent = currency.format(
    showReal ? result.realBalanceAtRetirement : result.balanceAtRetirement
  );
  const retirementYears =
    result.data[result.data.length - 1].age -
    result.data.find((row) => row.isRetired)?.age +
    1;
  yearsFundedEl.textContent =
    result.yearsFunded >= retirementYears
      ? "Fully funded"
      : `${result.yearsFunded} years`;
  endingBalanceEl.textContent = currency.format(
    showReal ? result.realEndingBalance : result.endingBalance
  );
  balanceAtRetirementLabelEl.textContent = showReal
    ? "Balance at retirement (today)"
    : "Balance at retirement";
  endingBalanceLabelEl.textContent = showReal
    ? "Ending balance (today)"
    : "Ending balance";
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        bottom: 16,
      },
    },
    animation: {
      duration: 850,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${currency.format(context.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => currency.format(value),
        },
      },
    },
  };
}

function upsertChart(chart, canvasId, type, labels, datasets) {
  if (!chart) {
    return new Chart(document.getElementById(canvasId), {
      type,
      data: { labels, datasets },
      options: chartOptions(),
    });
  }

  chart.data.labels = labels;
  datasets.forEach((dataset, i) => {
    chart.data.datasets[i].data = dataset.data;
  });
  chart.update();
  return chart;
}

function buildCharts(result) {
  const labels = result.data.map((row) => row.age);

  balanceChart = upsertChart(balanceChart, "balanceChart", "line", labels, [
    {
      label: "Nominal balance",
      data: result.data.map((row) => row.endBalance),
      borderColor: "#1b6ca8",
      backgroundColor: "rgba(27, 108, 168, 0.2)",
      tension: 0.35,
      fill: true,
    },
    {
      label: "Balance (today $)",
      data: result.data.map((row) => row.realEndBalance),
      borderColor: "#d98324",
      backgroundColor: "rgba(217, 131, 36, 0.2)",
      tension: 0.35,
      fill: true,
    },
  ]);

  cashflowChart = upsertChart(cashflowChart, "cashflowChart", "bar", labels, [
    {
      label: "Contributions",
      data: result.data.map((row) => row.contribution),
      backgroundColor: "rgba(0, 126, 105, 0.6)",
      borderRadius: 8,
    },
    {
      label: "Withdrawals",
      data: result.data.map((row) => -row.withdrawal),
      backgroundColor: "rgba(213, 94, 0, 0.7)",
      borderRadius: 8,
    },
    {
      label: "Social Security",
      data: result.data.map((row) => row.socialSecurity),
      backgroundColor: "rgba(86, 180, 233, 0.65)",
      borderRadius: 8,
    },
  ]);
}

function render() {
  const settings = getInputs();

  if (
    settings.currentAge === null ||
    settings.retirementAge === null ||
    settings.lifeExpectancy === null ||
    settings.lifeExpectancy < settings.currentAge
  ) {
    return;
  }

  const ssStartAge =
    settings.socialSecurityStartAge === null
      ? settings.retirementAge
      : settings.socialSecurityStartAge;

  const result = calculateProjection({
    ...settings,
    socialSecurityStartAge: ssStartAge,
  });
  renderSummary(result);
  renderTable(result.data);
  buildCharts(result);
}

function saveInputs() {
  const payload = {};
  inputIds.forEach((id) => {
    payload[id] = elements[id].value;
  });
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

function loadInputs() {
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return;
  }

  try {
    const payload = JSON.parse(stored);
    inputIds.forEach((id) => {
      if (typeof payload[id] === "string") {
        elements[id].value = payload[id];
      }
    });
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function loadSummaryMode() {
  const stored = localStorage.getItem(summaryKey);
  if (stored !== "nominal" && stored !== "real") {
    return;
  }
  summaryMode = stored;
  summaryToggleButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.summary === stored);
  });
}

function loadTableState() {
  const stored = localStorage.getItem(tableKey);
  showAllRows = stored === "true";
}

function clampInputToRange(id) {
  const el = elements[id];
  const value = toNumberNullable(el.value);
  if (value === null) {
    return;
  }

  const min = el.getAttribute("min");
  const max = el.getAttribute("max");
  const clamped = clampToRange(
    value,
    min === null ? null : Number(min),
    max === null ? null : Number(max)
  );
  if (clamped !== value) {
    el.value = String(clamped);
  }
}

function applyAgeClamps() {
  const settings = getInputs();

  if (
    settings.currentAge === null ||
    settings.retirementAge === null ||
    settings.lifeExpectancy === null
  ) {
    return;
  }

  const clamped = clampAgeRelationships({
    currentAge: settings.currentAge,
    retirementAge: settings.retirementAge,
    lifeExpectancy: settings.lifeExpectancy,
    socialSecurityStartAge: settings.socialSecurityStartAge,
  });

  if (clamped.retirementAge !== settings.retirementAge) {
    elements.retirementAge.value = String(clamped.retirementAge);
  }
  if (clamped.lifeExpectancy !== settings.lifeExpectancy) {
    elements.lifeExpectancy.value = String(clamped.lifeExpectancy);
  }
  if (clamped.socialSecurityStartAge !== settings.socialSecurityStartAge) {
    elements.socialSecurityStartAge.value = String(
      clamped.socialSecurityStartAge
    );
  }
}

const ageFields = new Set([
  "currentAge",
  "retirementAge",
  "lifeExpectancy",
  "socialSecurityStartAge",
]);

inputIds.forEach((id) => {
  elements[id].addEventListener("input", () => {
    saveInputs();
    render();
  });
  elements[id].addEventListener("blur", () => {
    clampInputToRange(id);
    if (ageFields.has(id)) {
      applyAgeClamps();
    }
    saveInputs();
    render();
  });
});

toggleTable.addEventListener("click", () => {
  showAllRows = !showAllRows;
  localStorage.setItem(tableKey, String(showAllRows));
  render();
});

summaryToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    summaryMode = button.dataset.summary;
    summaryToggleButtons.forEach((btn) =>
      btn.classList.toggle("is-active", btn === button)
    );
    localStorage.setItem(summaryKey, summaryMode);
    render();
  });
});

loadInputs();
loadSummaryMode();
loadTableState();
render();
