function clampToRange(value, min, max) {
  let clamped = value;
  if (min !== null && min !== undefined) {
    clamped = Math.max(clamped, min);
  }
  if (max !== null && max !== undefined) {
    clamped = Math.min(clamped, max);
  }
  return clamped;
}

// Each clamp uses the already-corrected values above it, so a bumped
// retirement age also pushes life expectancy and the SS start age.
function clampAgeRelationships(ages) {
  const { currentAge } = ages;
  let { retirementAge, lifeExpectancy, socialSecurityStartAge } = ages;

  if (retirementAge <= currentAge) {
    retirementAge = currentAge + 1;
  }

  if (lifeExpectancy <= retirementAge) {
    lifeExpectancy = retirementAge + 1;
  }

  if (socialSecurityStartAge !== null && socialSecurityStartAge !== undefined) {
    if (socialSecurityStartAge < currentAge) {
      socialSecurityStartAge = currentAge;
    }
    if (socialSecurityStartAge > lifeExpectancy) {
      socialSecurityStartAge = lifeExpectancy;
    }
  }

  return { currentAge, retirementAge, lifeExpectancy, socialSecurityStartAge };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { clampToRange, clampAgeRelationships };
}
