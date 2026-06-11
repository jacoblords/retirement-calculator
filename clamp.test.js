const test = require("node:test");
const assert = require("node:assert/strict");
const { clampToRange, clampAgeRelationships } = require("./clamp.js");

test("clampToRange enforces min and max", () => {
  assert.equal(clampToRange(5, 0, 10), 5);
  assert.equal(clampToRange(-3, 0, 10), 0);
  assert.equal(clampToRange(15, 0, 10), 10);
});

test("clampToRange ignores missing bounds", () => {
  assert.equal(clampToRange(-100, null, 10), -100);
  assert.equal(clampToRange(100, 0, null), 100);
  assert.equal(clampToRange(7, null, null), 7);
});

test("valid ages pass through unchanged", () => {
  const result = clampAgeRelationships({
    currentAge: 35,
    retirementAge: 67,
    lifeExpectancy: 95,
    socialSecurityStartAge: 67,
  });
  assert.deepEqual(result, {
    currentAge: 35,
    retirementAge: 67,
    lifeExpectancy: 95,
    socialSecurityStartAge: 67,
  });
});

test("retirement age is pushed above current age", () => {
  const result = clampAgeRelationships({
    currentAge: 50,
    retirementAge: 45,
    lifeExpectancy: 90,
    socialSecurityStartAge: 67,
  });
  assert.equal(result.retirementAge, 51);
  assert.equal(result.lifeExpectancy, 90);
});

test("clamps chain: bumped retirement age also pushes life expectancy", () => {
  const result = clampAgeRelationships({
    currentAge: 50,
    retirementAge: 40,
    lifeExpectancy: 41,
    socialSecurityStartAge: null,
  });
  assert.equal(result.retirementAge, 51);
  assert.equal(result.lifeExpectancy, 52);
});

test("social security start age is bounded by current age and life expectancy", () => {
  const low = clampAgeRelationships({
    currentAge: 65,
    retirementAge: 70,
    lifeExpectancy: 90,
    socialSecurityStartAge: 62,
  });
  assert.equal(low.socialSecurityStartAge, 65);

  const high = clampAgeRelationships({
    currentAge: 35,
    retirementAge: 67,
    lifeExpectancy: 80,
    socialSecurityStartAge: 85,
  });
  assert.equal(high.socialSecurityStartAge, 80);
});

test("social security start age clamps against the corrected life expectancy", () => {
  const result = clampAgeRelationships({
    currentAge: 50,
    retirementAge: 40,
    lifeExpectancy: 41,
    socialSecurityStartAge: 85,
  });
  assert.equal(result.lifeExpectancy, 52);
  assert.equal(result.socialSecurityStartAge, 52);
});

test("null social security start age passes through", () => {
  const result = clampAgeRelationships({
    currentAge: 35,
    retirementAge: 67,
    lifeExpectancy: 95,
    socialSecurityStartAge: null,
  });
  assert.equal(result.socialSecurityStartAge, null);
});
