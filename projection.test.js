const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateProjection } = require("./projection.js");

// January 1 makes firstYearFraction exactly 1, so years are whole.
const jan1 = new Date(2026, 0, 1);

const base = {
  currentAge: 30,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentSavings: 100000,
  annualContribution: 10000,
  contributionGrowth: 0,
  preReturn: 0.06,
  postReturn: 0.04,
  inflation: 0.02,
  taxRate: 0.2,
  retirementSpend: 40000,
  retirementCOLA: 0,
  socialSecurityStartAge: 67,
  socialSecurityBenefit: 20000,
};

test("contributions are added after growth each year", () => {
  const result = calculateProjection(
    {
      ...base,
      currentAge: 30,
      retirementAge: 33,
      lifeExpectancy: 34,
      currentSavings: 1000,
      annualContribution: 100,
      preReturn: 0.1,
      inflation: 0,
      retirementSpend: 0,
      socialSecurityBenefit: 0,
    },
    jan1
  );

  assert.equal(result.data[0].endBalance, 1000 * 1.1 + 100);
  assert.equal(result.data[1].endBalance, 1200 * 1.1 + 100);
});

test("contribution growth compounds from the second year", () => {
  const result = calculateProjection(
    {
      ...base,
      currentAge: 30,
      retirementAge: 33,
      lifeExpectancy: 34,
      currentSavings: 0,
      annualContribution: 100,
      contributionGrowth: 0.05,
      preReturn: 0,
      inflation: 0,
      retirementSpend: 0,
      socialSecurityBenefit: 0,
    },
    jan1
  );

  assert.equal(result.data[0].contribution, 100);
  assert.equal(result.data[1].contribution, 105);
});

test("withdrawals are grossed up to cover taxes", () => {
  const result = calculateProjection(
    {
      ...base,
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 66,
      currentSavings: 1000,
      retirementSpend: 100,
      taxRate: 0.5,
      inflation: 0,
      postReturn: 0,
      socialSecurityBenefit: 0,
    },
    jan1
  );

  const row = result.data[0];
  assert.equal(row.withdrawal, 200);
  assert.equal(row.tax, 100);
  assert.equal(row.endBalance, 800);
});

test("social security offsets the withdrawal need", () => {
  const result = calculateProjection(
    {
      ...base,
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 66,
      currentSavings: 1000,
      retirementSpend: 100,
      taxRate: 0.5,
      inflation: 0,
      postReturn: 0,
      socialSecurityStartAge: 65,
      socialSecurityBenefit: 100,
    },
    jan1
  );

  const row = result.data[0];
  assert.equal(row.withdrawal, 0);
  assert.equal(row.tax, 0);
  assert.equal(row.endBalance, 1000);
});

test("social security is not paid before retirement", () => {
  const result = calculateProjection(
    {
      ...base,
      currentAge: 60,
      retirementAge: 65,
      lifeExpectancy: 70,
      socialSecurityStartAge: 62,
    },
    jan1
  );

  for (const row of result.data) {
    if (row.age < 65) {
      assert.equal(row.socialSecurity, 0, `age ${row.age} should have no SS`);
    } else {
      assert.ok(row.socialSecurity > 0, `age ${row.age} should have SS`);
    }
  }
});

test("yearsFunded counts only retirement years that end positive", () => {
  const result = calculateProjection(
    {
      ...base,
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 67,
      currentSavings: 250,
      retirementSpend: 100,
      taxRate: 0,
      inflation: 0,
      postReturn: 0,
      retirementCOLA: 0,
      socialSecurityBenefit: 0,
    },
    jan1
  );

  assert.equal(result.yearsFunded, 2);
  assert.equal(result.data[2].endBalance, -50);
});

test("shortfalls do not compound", () => {
  const result = calculateProjection(
    {
      ...base,
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 68,
      currentSavings: 0,
      retirementSpend: 100,
      taxRate: 0,
      inflation: 0,
      postReturn: 0.5,
      socialSecurityBenefit: 0,
    },
    jan1
  );

  for (const row of result.data) {
    assert.equal(row.growth, 0);
  }
  assert.equal(result.endingBalance, -400);
});

test("first year is prorated when starting mid-year", () => {
  const july = new Date(2026, 6, 2);
  const result = calculateProjection(
    {
      ...base,
      currentAge: 30,
      retirementAge: 33,
      lifeExpectancy: 34,
      annualContribution: 10000,
    },
    july
  );

  const firstContribution = result.data[0].contribution;
  assert.ok(firstContribution > 4000 && firstContribution < 6000);
  assert.equal(result.data[1].contribution, 10000);
});

test("summary real-dollar values match the table rows", () => {
  const result = calculateProjection(base, jan1);
  const retirementIndex = result.data.findIndex((row) => row.isRetired);
  const lastRow = result.data[result.data.length - 1];

  assert.equal(
    result.realBalanceAtRetirement,
    result.data[retirementIndex - 1].realEndBalance
  );
  assert.equal(result.realEndingBalance, lastRow.realEndBalance);
  assert.equal(
    result.balanceAtRetirement,
    result.data[retirementIndex].startBalance
  );
});

test("already-retired start uses current savings as retirement balance", () => {
  const result = calculateProjection(
    {
      ...base,
      currentAge: 70,
      retirementAge: 65,
      lifeExpectancy: 75,
    },
    jan1
  );

  assert.equal(result.balanceAtRetirement, base.currentSavings);
  assert.equal(result.realBalanceAtRetirement, base.currentSavings);
});

test("returns an empty projection when life expectancy is below current age", () => {
  const result = calculateProjection(
    {
      ...base,
      currentAge: 50,
      lifeExpectancy: 40,
    },
    jan1
  );

  assert.equal(result.data.length, 0);
  assert.equal(result.endingBalance, base.currentSavings);
  assert.equal(result.realEndingBalance, base.currentSavings);
});
