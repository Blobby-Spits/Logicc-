import { loadPersonaFile, listComingSoon, listEnabledScenarios } from "./load.ts";
import { DEFAULT_SCENARIO_ID } from "./types.ts";

export function buildCatalog() {
  const enabled = listEnabledScenarios().map((scenario) => ({
    id: scenario.id,
    enabled: true,
    title: scenario.title,
    callType: scenario.callType,
    direction: scenario.direction,
    companyName: scenario.company.name,
    productModule: scenario.company.productModule,
    industryModule: scenario.company.industryModule,
    personas: scenario.personas,
    gatekeeperFirst: scenario.gatekeeperFirst,
  }));
  const defaultScenario = enabled.find((item) => item.id === DEFAULT_SCENARIO_ID) ?? enabled[0];
  const company = defaultScenario?.companyName ?? "";
  const personas = (defaultScenario?.personas ?? ["empfang", "entscheider"]).map((id) => {
    const file = loadPersonaFile(id);
    return {
      ...file,
      company: company,
      openingLineHint: file.openingLineHint.replaceAll("{company}", company),
      transferInHint: file.transferInHint.replaceAll("{company}", company),
    };
  });
  return {
    traineeRoles: [
      { id: "sdr", label: "SDR" },
      { id: "ae", label: "AE" },
    ],
    modes: [
      { id: "roleplay", label: "Rollenspiel" },
      { id: "coaching", label: "Coaching-Pause" },
      { id: "demo", label: "Demonstration" },
      { id: "debrief", label: "Debrief" },
    ],
    scenarios: [...enabled, ...listComingSoon()],
    personas,
    modules: {
      product: defaultScenario?.productModule,
      industry: defaultScenario?.industryModule,
    },
  };
}
