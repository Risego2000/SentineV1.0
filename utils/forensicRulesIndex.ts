import { FORENSIC_RULES } from '../types/forensicRules';
import { normalizeRuleToken } from './infractionFormatters';

interface IndexedRule {
  rule: any;
  normalizedOperativeCode: string;
  normalizedName: string;
  normalizedId: string;
}

let ruleIndex: Map<string, IndexedRule> | null = null;

export const getForensicRulesIndex = (): Map<string, IndexedRule> => {
  if (ruleIndex) return ruleIndex;

  ruleIndex = new Map();

  FORENSIC_RULES.forEach((rule) => {
    const normOpCode = normalizeRuleToken(rule.operativeCode);
    const normName = normalizeRuleToken(rule.name);
    const normId = normalizeRuleToken(rule.id);

    ruleIndex!.set(normOpCode, { rule, normalizedOperativeCode: normOpCode, normalizedName: normName, normalizedId: normId });
    ruleIndex!.set(normName, { rule, normalizedOperativeCode: normOpCode, normalizedName: normName, normalizedId: normId });
    ruleIndex!.set(normId, { rule, normalizedOperativeCode: normOpCode, normalizedName: normName, normalizedId: normId });
  });

  return ruleIndex;
};

export const findForensicRule = (
  typeCandidates: string[],
  ruleCategory?: string
): any | undefined => {
  const index = getForensicRulesIndex();

  for (const candidate of typeCandidates) {
    const normalized = normalizeRuleToken(candidate);
    const found = index.get(normalized);
    if (found) return found.rule;
  }

  if (ruleCategory) {
    const normalized = normalizeRuleToken(ruleCategory);
    const found = index.get(normalized);
    if (found) return found.rule;
  }

  return undefined;
};
