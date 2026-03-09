export interface PricingRule {
  base_multiplier: number;
  base_discount_percent: number;
  fixed_cost_addition: number;
  vat_multiplier: number;
  margin_multiplier: number;
  exchange_rate: number;
  final_divider: number;
}

export interface PriceCalculationResult {
  finalPrice: number;
  isValid: boolean;
  error?: string;
}

export const calculateFinalPrice = (
  rawPrice: number,
  rule: PricingRule
): PriceCalculationResult => {
  if (typeof rawPrice !== 'number' || isNaN(rawPrice) || rawPrice <= 0) {
    return { finalPrice: 0, isValid: false, error: 'Invalid raw price' };
  }

  try {
    // Formula: (((rawPrice * base_multiplier * (1 - base_discount_percent)) + fixed_cost_addition) * vat_multiplier * margin_multiplier * exchange_rate) / final_divider
    const discountedBase = rawPrice * rule.base_multiplier * (1 - rule.base_discount_percent);
    const withFixedCost = discountedBase + rule.fixed_cost_addition;
    const withVat = withFixedCost * rule.vat_multiplier;
    const withMargin = withVat * rule.margin_multiplier;
    const inLocalCurrency = withMargin * rule.exchange_rate;
    const finalPrice = Math.round(inLocalCurrency / rule.final_divider);

    if (isNaN(finalPrice) || !isFinite(finalPrice) || finalPrice <= 0) {
      return { finalPrice: 0, isValid: false, error: 'Calculation resulted in invalid price' };
    }

    return { finalPrice, isValid: true };
  } catch (error) {
    return { finalPrice: 0, isValid: false, error: 'Calculation exception' };
  }
};
