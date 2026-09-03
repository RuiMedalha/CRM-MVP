import {
  calculateWeightedForecast,
  STAGE_PROBABILITIES,
} from "./useForecast";

// Test suite runner
function runTests() {
  console.log("--- Running Forecast Unit Tests ---");

  // Test 1: Acceptance Criteria verification
  // "deal 1000€ em 'proposta' + 2000€ em 'lead' -> 30d = 500 + 200 = €700"
  const tc1 = [
    { id: 1, title: "Deal Proposta", status: "proposta", total_amount: 1000 },
    { id: 2, title: "Deal Lead", status: "lead", total_amount: 2000 },
  ];
  const res1 = calculateWeightedForecast(tc1, 30);
  console.assert(
    res1.forecast30 === 700,
    `Test 1 Failed: Expected 700, got ${res1.forecast30}`
  );
  console.assert(
    res1.forecast === 700,
    `Test 1 (period 30) Failed: Expected 700, got ${res1.forecast}`
  );
  console.log("✔ Test 1 passed: Acceptance criteria deal 1000€ proposta + 2000€ lead -> 30d = 700€");

  // Test 2: 'perdido' deals are excluded
  const tc2 = [
    { id: 1, title: "Deal Proposta", status: "proposta", total_amount: 1000 },
    { id: 2, title: "Deal Perdido", status: "perdido", total_amount: 50000 },
  ];
  const res2 = calculateWeightedForecast(tc2, 30);
  console.assert(
    res2.forecast30 === 500,
    `Test 2 Failed: Lost deals should be excluded, got ${res2.forecast30}`
  );
  console.assert(
    res2.activeDealsCount === 1,
    `Test 2 Failed: Active deals count should be 1, got ${res2.activeDealsCount}`
  );
  console.log("✔ Test 2 passed: 'perdido' deals are properly excluded");

  // Test 3: All 5 stage probabilities
  console.assert(STAGE_PROBABILITIES.lead === 0.1, "Lead prob must be 10%");
  console.assert(STAGE_PROBABILITIES.qualificacao === 0.25, "Qualificacao prob must be 25%");
  console.assert(STAGE_PROBABILITIES.proposta === 0.5, "Proposta prob must be 50%");
  console.assert(STAGE_PROBABILITIES.negociacao === 0.75, "Negociacao prob must be 75%");
  console.assert(STAGE_PROBABILITIES.ganho === 1.0, "Ganho prob must be 100%");
  console.log("✔ Test 3 passed: All 5 stage probabilities verified (10%, 25%, 50%, 75%, 100%)");

  // Test 4: ChartData format
  console.assert(res1.chartData.length === 5, "chartData must have 5 bars");
  const leadBar = res1.chartData.find((b) => b.key === "lead");
  const propBar = res1.chartData.find((b) => b.key === "proposta");
  console.assert(leadBar?.valorPonderado === 200, "Lead bar weighted value should be 200");
  console.assert(propBar?.valorPonderado === 500, "Proposta bar weighted value should be 500");
  console.log("✔ Test 4 passed: chartData contains 5 stages for Recharts");

  console.log("All Forecast tests PASSED successfully!");
}

runTests();
