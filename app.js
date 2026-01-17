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
const yearsFundedEl = document.getElementById("yearsFunded");
const endingBalanceEl = document.getElementById("endingBalance");
const breakdownBody = document.getElementById("breakdownBody");
const toggleTable = document.getElementById("toggleTable");

let showAllRows = false;
const storageKey = "retirementCalculator.inputs";

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

  for (let i = 0; i < years; i += 1) {
    const age = settings.currentAge + i;
    const yearIndex = i;
    const isRetired = age >= settings.retirementAge;
    const inflationFactor = Math.pow(1 + settings.inflation, i);
    const yearsSinceRetirement = Math.max(0, age - settings.retirementAge);
    const yearsSinceStart = Math.max(0, age - settings.currentAge);
    const spendInflated =
      settings.retirementSpend *
      Math.pow(1 + settings.retirementCOLA, yearsSinceRetirement) *
      Math.pow(1 + settings.inflation, yearsSinceRetirement);
    const socialSecurityIncome =
      age >= settings.socialSecurityStartAge
        ? settings.socialSecurityBenefit *
          Math.pow(1 + settings.inflation, yearsSinceStart)
        : 0;
    const netSpendingNeed = Math.max(spendInflated - socialSecurityIncome, 0);
    const grossWithdrawal = isRetired
      ? netSpendingNeed / Math.max(1 - settings.taxRate, 0.0001)
      : 0;
    const tax = isRetired ? grossWithdrawal - netSpendingNeed : 0;

    const contribution = isRetired
      ? 0
      : settings.annualContribution *
        Math.pow(1 + settings.contributionGrowth, yearIndex);

    const startBalance = balance;
    const balanceAfterCashflow = startBalance + contribution - grossWithdrawal;
    const returnRate = isRetired ? settings.postReturn : settings.preReturn;
    const endBalance = balanceAfterCashflow * (1 + returnRate);
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
      socialSecurity: socialSecurityIncome,
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
    yearsFunded,
    endingBalance: balance,
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
  balanceAtRetirementEl.textContent = currency.format(result.balanceAtRetirement);
  yearsFundedEl.textContent = `${result.yearsFunded} years`;
  endingBalanceEl.textContent = currency.format(result.endingBalance);
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
            borderColor: "#176d81",
            backgroundColor: "rgba(23, 109, 129, 0.2)",
            tension: 0.35,
            fill: true,
          },
          {
            label: "Real balance",
            data: real,
            borderColor: "#f08a4b",
            backgroundColor: "rgba(240, 138, 75, 0.2)",
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
            backgroundColor: "rgba(23, 109, 129, 0.6)",
            borderRadius: 8,
          },
          {
            label: "Withdrawals",
            data: withdrawals,
            backgroundColor: "rgba(240, 138, 75, 0.7)",
            borderRadius: 8,
          },
          {
            label: "Social Security",
            data: socialSecurity,
            backgroundColor: "rgba(74, 127, 191, 0.55)",
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

loadInputs();
render();
