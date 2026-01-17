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

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getInputs() {
  return {
    currentAge: toNumber(elements.currentAge.value),
    retirementAge: toNumber(elements.retirementAge.value),
    lifeExpectancy: toNumber(elements.lifeExpectancy.value),
    currentSavings: toNumber(elements.currentSavings.value),
    annualContribution: toNumber(elements.annualContribution.value),
    contributionGrowth: toNumber(elements.contributionGrowth.value) / 100,
    preReturn: toNumber(elements.preReturn.value) / 100,
    postReturn: toNumber(elements.postReturn.value) / 100,
    inflation: toNumber(elements.inflation.value) / 100,
    taxRate: toNumber(elements.taxRate.value) / 100,
    retirementSpend: toNumber(elements.retirementSpend.value),
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
    const spendInflated =
      settings.retirementSpend *
      Math.pow(1 + settings.inflation, yearsSinceRetirement);
    const grossWithdrawal = isRetired
      ? spendInflated / Math.max(1 - settings.taxRate, 0.0001)
      : 0;
    const tax = isRetired ? grossWithdrawal - spendInflated : 0;

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
        animation: {
          duration: 850,
          easing: "easeOutQuart",
        },
        plugins: {
          legend: {
            position: "bottom",
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
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 850,
          easing: "easeOutQuart",
        },
        plugins: {
          legend: {
            position: "bottom",
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
    cashflowChart.update();
  }
}

function render() {
  const settings = getInputs();

  if (settings.retirementAge <= settings.currentAge) {
    settings.retirementAge = settings.currentAge + 1;
    elements.retirementAge.value = settings.retirementAge;
  }

  if (settings.lifeExpectancy <= settings.retirementAge) {
    settings.lifeExpectancy = settings.retirementAge + 1;
    elements.lifeExpectancy.value = settings.lifeExpectancy;
  }

  const result = calculateProjection(settings);
  renderSummary(result);
  renderTable(result.data);
  buildCharts(result);
}

inputIds.forEach((id) => {
  elements[id].addEventListener("input", render);
});

toggleTable.addEventListener("click", () => {
  showAllRows = !showAllRows;
  render();
});

render();
