function calculateProjection(settings, now = new Date()) {
  const years = settings.lifeExpectancy - settings.currentAge + 1;
  const data = [];
  let balance = settings.currentSavings;
  let yearsFunded = 0;
  let balanceAtRetirement = null;
  let realBalanceAtRetirement = null;
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
      isRetired && age >= settings.socialSecurityStartAge
        ? settings.socialSecurityBenefit *
          Math.pow(1 + settings.inflation, timeFromStart)
        : 0;
    const spendNeedProrated = isRetired ? spendInflated * yearFraction : 0;
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
    const returnRate = isRetired ? settings.postReturn : settings.preReturn;
    const balanceAfterWithdrawal = startBalance - grossWithdrawal;
    const balanceAfterGrowth =
      balanceAfterWithdrawal > 0
        ? balanceAfterWithdrawal * Math.pow(1 + returnRate, yearFraction)
        : balanceAfterWithdrawal;
    const endBalance = balanceAfterGrowth + contribution;
    const growth =
      balanceAfterWithdrawal > 0 ? balanceAfterGrowth - balanceAfterWithdrawal : 0;
    const realEndBalance = endBalance / inflationFactor;

    if (balanceAtRetirement === null && age === settings.retirementAge) {
      balanceAtRetirement = startBalance;
      realBalanceAtRetirement =
        i === 0 ? startBalance : data[i - 1].realEndBalance;
    }

    if (isRetired && endBalance > 0) {
      yearsFunded += 1;
    }

    data.push({
      age,
      year: now.getFullYear() + i,
      startBalance,
      contribution,
      spendingNeed: spendNeedProrated,
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

  const lastRow = data[data.length - 1];

  return {
    data,
    balanceAtRetirement: balanceAtRetirement ?? settings.currentSavings,
    realBalanceAtRetirement: realBalanceAtRetirement ?? settings.currentSavings,
    yearsFunded,
    endingBalance: balance,
    realEndingBalance: lastRow ? lastRow.realEndBalance : balance,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateProjection };
}
