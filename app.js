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

function calculateProjection(settings) {
  const years = settings.lifeExpectancy - settings.currentAge + 1;
  const data = [];
  let balance = settings.currentSavings;
  let yearsFunded = 0;
  let balanceAtRetirement = null;
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
  const daysInYear = Math.floor((startOfNextYear - startOfYear) / 86400000);
  const firstYearFraction = (daysInYear - (dayOfYear - 1)) / daysInYear;

  for (let i = 0; i < years; i += 1) {
    const age = settings.currentAge + i;
    const yearIndex = i;
    const isRetired = age >= settings.retirementAge;
    const yearFraction = i === 0 ? firstYearFraction : 1;
    const timeFromStart = i === 0 ? firstYearFraction : i;
    const inflationFactor = Math.pow(1 + settings.inflation, timeFromStart);
    const yearsSinceRetirement = Math.max(0, age - settings.retirementAge);
    const retirementTime =
      isRetired && i === 0 ? yearsSinceRetirement + yearFraction : yearsSinceRetirement;
    const spendInflated =
      settings.retirementSpend *
      Math.pow(1 + settings.inflation, timeFromStart) *
      Math.pow(1 + settings.retirementCOLA, retirementTime);
    const socialSecurityIncome =
      age >= settings.socialSecurityStartAge
        ? settings.socialSecurityBenefit *
          Math.pow(1 + settings.inflation, timeFromStart)
        : 0;
    const spendNeedProrated = spendInflated * yearFraction;
    const socialSecurityProrated = socialSecurityIncome * yearFraction;
    const netSpendingNeed = Math.max(
      spendNeedProrated - socialSecurityProrated,
      0
    );
    const grossWithdrawal = isRetired
      ? netSpendingNeed / Math.max(1 - settings.taxRate, 0.0001)
      : 0;
    const tax = isRetired ? grossWithdrawal - netSpendingNeed : 0;

    const contribution = isRetired
      ? 0
      : settings.annualContribution *
        Math.pow(1 + settings.contributionGrowth, yearIndex) *
        yearFraction;

    const startBalance = balance;
    const balanceAfterCashflow = startBalance + contribution - grossWithdrawal;
    const returnRate = isRetired ? settings.postReturn : settings.preReturn;
    const endBalance =
      balanceAfterCashflow * Math.pow(1 + returnRate, yearFraction);
    const growth = endBalance - balanceAfterCashflow;
    const realEndBalance = endBalance / inflationFactor;

    if (balanceAtRetirement === null && age === settings.retirementAge) {
      balanceAtRetirement = startBalance;
    }

    if (isRetired && balanceAfterCashflow > 0) {
      yearsFunded += 1;
    }

    data.push({
      age,
      year: new Date().getFullYear() + i,
      startBalance,
      contribution,
      withdrawal: grossWithdrawal,
      socialSecurity: socialSecurityProrated,
      growth,
      tax,
      endBalance,
      realEndBalance,
      isRetired,
    });

    balance = endBalance;
  }

  return {
    data,
    balanceAtRetirement: balanceAtRetirement ?? settings.currentSavings,
    realBalanceAtRetirement:
      (balanceAtRetirement ?? settings.currentSavings) /
      Math.pow(
        1 + settings.inflation,
        Math.max(0, settings.retirementAge - settings.currentAge)
      ),
    yearsFunded,
    endingBalance: balance,
    realEndingBalance:
      balance /
      Math.pow(
        1 + settings.inflation,
        Math.max(0, settings.lifeExpectancy - settings.currentAge)
      ),
  };
}

function buildTableRows(rows) {
  return rows
    .map((row) => {
      return `
        <tr>
          <td>${row.year}</td>
          <td>${row.age}</td>
          <td>${currency.format(row.startBalance)}</td>
          <td>${currency.format(row.contribution)}</td>
          <td>${currency.format(row.withdrawal)}</td>
          <td>${currency.format(row.socialSecurity)}</td>
          <td>${currency.format(row.growth)}</td>
          <td>${currency.format(row.tax)}</td>
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

function buildCharts(result) {
  const labels = result.data.map((row) => row.age);
  const nominal = result.data.map((row) => row.endBalance);
  const real = result.data.map((row) => row.realEndBalance);
  const contributions = result.data.map((row) => row.contribution);
  const withdrawals = result.data.map((row) => -row.withdrawal);
  const socialSecurity = result.data.map((row) => row.socialSecurity);

  if (!balanceChart) {
    const ctx = document.getElementById("balanceChart");
    balanceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Nominal balance",
            data: nominal,
            borderColor: "#1b6ca8",
            backgroundColor: "rgba(27, 108, 168, 0.2)",
            tension: 0.35,
            fill: true,
          },
          {
            label: "Real balance",
            data: real,
            borderColor: "#d98324",
            backgroundColor: "rgba(217, 131, 36, 0.2)",
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
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
      },
    });
  } else {
    balanceChart.data.labels = labels;
    balanceChart.data.datasets[0].data = nominal;
    balanceChart.data.datasets[1].data = real;
    balanceChart.update();
  }

  if (!cashflowChart) {
    const ctx = document.getElementById("cashflowChart");
    cashflowChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Contributions",
            data: contributions,
            backgroundColor: "rgba(0, 126, 105, 0.6)",
            borderRadius: 8,
          },
          {
            label: "Withdrawals",
            data: withdrawals,
            backgroundColor: "rgba(213, 94, 0, 0.7)",
            borderRadius: 8,
          },
          {
            label: "Social Security",
            data: socialSecurity,
            backgroundColor: "rgba(86, 180, 233, 0.65)",
            borderRadius: 8,
          },
        ],
      },
      options: {
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
      },
    });
  } else {
    cashflowChart.data.labels = labels;
    cashflowChart.data.datasets[0].data = contributions;
    cashflowChart.data.datasets[1].data = withdrawals;
    cashflowChart.data.datasets[2].data = socialSecurity;
    cashflowChart.update();
  }
}

function render() {
  const settings = getInputs();

  if (
    settings.currentAge === null ||
    settings.retirementAge === null ||
    settings.lifeExpectancy === null
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

function clampOnBlur() {
  const settings = getInputs();

  if (
    settings.currentAge === null ||
    settings.retirementAge === null ||
    settings.lifeExpectancy === null
  ) {
    return;
  }

  if (settings.retirementAge <= settings.currentAge) {
    elements.retirementAge.value = String(settings.currentAge + 1);
  }

  if (settings.lifeExpectancy <= settings.retirementAge) {
    elements.lifeExpectancy.value = String(settings.retirementAge + 1);
  }

  if (settings.socialSecurityStartAge !== null) {
    if (settings.socialSecurityStartAge < settings.currentAge) {
      elements.socialSecurityStartAge.value = String(settings.currentAge);
    }

    if (settings.socialSecurityStartAge > settings.lifeExpectancy) {
      elements.socialSecurityStartAge.value = String(settings.lifeExpectancy);
    }
  }
}

inputIds.forEach((id) => {
  elements[id].addEventListener("input", () => {
    saveInputs();
    render();
  });
  if (
    id === "currentAge" ||
    id === "retirementAge" ||
    id === "lifeExpectancy" ||
    id === "socialSecurityStartAge"
  ) {
    elements[id].addEventListener("blur", () => {
      clampOnBlur();
      saveInputs();
      render();
    });
  }
});

toggleTable.addEventListener("click", () => {
  showAllRows = !showAllRows;
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
render();
