import { isObject } from "util";
import { mrdPeriod, mrdRate } from "./minimum-required-distribution";

interface IAccount {
  openingBalance: number;
  closingBalance: number;
  investmentProceeds: number;
  withdrawal: number;
}

interface IWithDrawal {
  target: number;
  mrd: number;
  excess: number;
  actual: number;
}

interface IAssumptions {
  startBalance: number;
  annualContribution: number;
  currentAge: number;
  startAge: number;
  finalAge: number;
  withdrawalRate: number;
  expectedRealReturn: number;
  expectedInflationRate: number;
  output: "real" | "nominal";
}

export function deterministicProjection(assumptions: IAssumptions) {
  const {
    startBalance,
    annualContribution,
    currentAge,
    startAge,
    finalAge,
    withdrawalRate,
    expectedRealReturn,
    expectedInflationRate,
    output,
  } = assumptions;

  const expectedNominalReturn =
    (1 + expectedRealReturn) * (1 + expectedInflationRate) - 1;
  // const balanceAtStartAge =
  //   startBalance * (1 + expectedNominalReturn) ** (startAge - currentAge);

  // const results = [];
  let accAge = { age: [] };
  let accYear = { year: [] };
  let accTaxDeferredAccount = {};
  let accTaxableAccount = {};
  let accWithdrawal = {};

  let inflationFactor = 1;
  // 1 / (1 + expectedInflationRate) ** (startAge - currentAge);
  let targetWithdrawal = 0; //balanceAtStartAge * withdrawalRate;
  let openingTaxDeferredBalance = startBalance; // balanceAtStartAge;
  let openingTaxableBalance = 0;
  let contribution = annualContribution;

  for (let age = currentAge; age <= finalAge; age++) {
    if (age === startAge) {
      targetWithdrawal = openingTaxDeferredBalance * withdrawalRate;
      contribution = 0;
    }

    const taxDeferredInvestmentProceeds =
      openingTaxDeferredBalance * expectedNominalReturn;
    const mrdWithdrawal =
      age < 70 ? 0 : mrdRate[age] * openingTaxDeferredBalance;
    const actualWithdrawal =
      age < startAge
        ? -contribution
        : Math.min(
            Math.max(targetWithdrawal, mrdWithdrawal),
            openingTaxDeferredBalance + taxDeferredInvestmentProceeds
          );
    const closingTaxDeferredBalance =
      openingTaxDeferredBalance +
      taxDeferredInvestmentProceeds -
      actualWithdrawal;

    const excessWithdrawal = Math.max(0, actualWithdrawal - targetWithdrawal);

    const taxableInvestmentProceeds =
      openingTaxableBalance * expectedNominalReturn;
    const closingTaxableBalance =
      openingTaxableBalance + taxableInvestmentProceeds + excessWithdrawal;

    const taxDeferredAccount = {
      openingBalance: openingTaxDeferredBalance,
      closingBalance: closingTaxDeferredBalance,
      investmentProceeds: taxDeferredInvestmentProceeds,
      withdrawal: actualWithdrawal,
    };

    const taxableAccount = {
      openingBalance: openingTaxableBalance,
      closingBalance: closingTaxableBalance,
      investmentProceeds: taxableInvestmentProceeds,
      withdrawal: 0,
    };

    const withdrawal = {
      actual: actualWithdrawal,
      target: targetWithdrawal,
      mrd: mrdWithdrawal,
      excess: excessWithdrawal,
    };

    const year = new Date().getFullYear() + age - currentAge;
    const outputFactor = output === "nominal" ? 1 : inflationFactor;

    accAge = accumulateSeries(accAge, { age });
    accYear = accumulateSeries(accYear, { year });
    accTaxDeferredAccount = accumulateSeries(
      accTaxDeferredAccount,
      taxDeferredAccount,
      round(0, outputFactor)
    );
    accTaxableAccount = accumulateSeries(
      accTaxableAccount,
      taxableAccount,
      round(0, outputFactor)
    );
    accWithdrawal = accumulateSeries(
      accWithdrawal,
      withdrawal,
      round(0, outputFactor)
    );

    inflationFactor /= 1 + expectedInflationRate;
    targetWithdrawal *= 1 + expectedInflationRate;
    openingTaxDeferredBalance = closingTaxDeferredBalance;
    openingTaxableBalance = closingTaxableBalance;
    contribution *= 1 + expectedInflationRate;
  }

  return {
    output,
    assumptions,
    age: accAge.age,
    year: accYear.year,
    taxDeferredAccount: accTaxDeferredAccount,
    taxableAccount: accTaxableAccount,
    withdrawal: accWithdrawal,
  };
}

const round = (decimals: number, scale: number = 1) => (x: number) => {
  const factor = 10 ** decimals;
  return Math.round(x * scale * factor) / factor;
};

function accumulateSeries<T>(
  acc: Record<string, T[]> | undefined = undefined,
  current: Record<string, T>,
  transform: (x: T) => T = (x) => x
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  Object.keys(current).forEach((key: string) => {
    const a = (acc && acc[key]) ?? [];
    result[key] = a.concat(transform(current[key]));
  });

  return result;
}
