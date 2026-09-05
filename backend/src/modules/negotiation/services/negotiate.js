/**
 * Pure, zero-dependency negotiation engine.
 *
 * Simulates one full round-trip negotiation session between a buyer and seller
 * using a symmetric converging-bid algorithm:
 *
 *  - Each round: seller steps down by stepPercent, buyer steps up by stepPercent
 *  - Convergence: |sellerOffer - buyerOffer| / sellerMin <= convergenceThreshold
 *  - DEAL:        both offers cross (buyer >= seller offer)
 *  - FAILED:      maxRounds exhausted without convergence
 *
 * This function has NO side effects — it does not write to any database.
 * Call it, inspect the result, then persist the outcome in the service layer.
 *
 * @param {Object} params
 * @param {number} params.sellerMin           - Seller's absolute floor (won't go below this)
 * @param {number} params.sellerMax           - Seller's starting ask (current list/negotiated price)
 * @param {number} params.buyerMin            - Buyer's starting offer
 * @param {number} params.buyerMax            - Buyer's absolute ceiling (won't go above this)
 * @param {number} [params.stepPercent=5]     - Percentage each side moves per round (of their current position)
 * @param {number} [params.maxRounds=10]      - Maximum number of negotiation rounds
 * @param {number} [params.convergenceThreshold=0.02] - Gap ratio below which deal is accepted (relative to sellerMin)
 * @returns {Object} NegotiationResult
 */
export function negotiate({
  sellerMin,
  sellerMax,
  buyerMin,
  buyerMax,
  stepPercent = 5,
  maxRounds = 10,
  convergenceThreshold = 0.02,
}) {
  // --- Input validation
  if (sellerMin == null || sellerMax == null || buyerMin == null || buyerMax == null) {
    throw new Error('negotiate(): sellerMin, sellerMax, buyerMin, buyerMax are all required');
  }

  const sMin = Number(sellerMin);
  const sMax = Number(sellerMax);
  const bMin = Number(buyerMin);
  const bMax = Number(buyerMax);
  const step = Number(stepPercent) / 100;
  const maxR = Math.max(1, Math.floor(Number(maxRounds)));
  const threshold = Number(convergenceThreshold);

  if (sMin > sMax) {
    throw new Error('negotiate(): sellerMin must be <= sellerMax');
  }
  if (bMin > bMax) {
    throw new Error('negotiate(): buyerMin must be <= buyerMax');
  }

  // If the buyer's max can't meet seller's min, no deal is possible at all
  if (bMax < sMin) {
    return {
      result: 'FAILED',
      reason: 'Buyer ceiling is below seller floor — no deal possible',
      finalPrice: null,
      rounds: [],
      totalRounds: 0,
    };
  }

  let sellerOffer = sMax;
  let buyerOffer = bMin;
  const rounds = [];

  for (let round = 1; round <= maxR; round++) {
    // Check for immediate deal (buyer offer has already crossed seller offer)
    if (buyerOffer >= sellerOffer) {
      const finalPrice = round_2dp((buyerOffer + sellerOffer) / 2);
      rounds.push(buildRoundRecord(round, sellerOffer, buyerOffer, 'DEAL', finalPrice));
      return { result: 'DEAL', finalPrice, rounds, totalRounds: round };
    }

    // Check convergence threshold
    const gap = sellerOffer - buyerOffer;
    const relativeGap = sMin > 0 ? gap / sMin : gap;
    if (relativeGap <= threshold) {
      const finalPrice = round_2dp((sellerOffer + buyerOffer) / 2);
      rounds.push(buildRoundRecord(round, sellerOffer, buyerOffer, 'DEAL_CONVERGENCE', finalPrice));
      return { result: 'DEAL', finalPrice, rounds, totalRounds: round };
    }

    // Step: seller moves down, buyer moves up
    const sellerStep = sellerOffer * step;
    const buyerStep = buyerOffer * step;

    const nextSellerOffer = Math.max(sMin, round_2dp(sellerOffer - sellerStep));
    const nextBuyerOffer = Math.min(bMax, round_2dp(buyerOffer + buyerStep));

    rounds.push(buildRoundRecord(round, sellerOffer, buyerOffer, 'IN_PROGRESS', null));

    sellerOffer = nextSellerOffer;
    buyerOffer = nextBuyerOffer;
  }

  // Check one final time after all rounds
  if (buyerOffer >= sellerOffer) {
    const finalPrice = round_2dp((buyerOffer + sellerOffer) / 2);
    return { result: 'DEAL', finalPrice, rounds, totalRounds: maxR };
  }

  return {
    result: 'FAILED',
    reason: `No convergence after ${maxR} rounds. Final gap: seller=${sellerOffer}, buyer=${buyerOffer}`,
    finalPrice: null,
    finalSellerOffer: sellerOffer,
    finalBuyerOffer: buyerOffer,
    rounds,
    totalRounds: maxR,
  };
}

function buildRoundRecord(roundNumber, sellerOffer, buyerOffer, status, agreedPrice) {
  return {
    round: roundNumber,
    seller_offer: round_2dp(sellerOffer),
    buyer_offer: round_2dp(buyerOffer),
    gap: round_2dp(Math.abs(sellerOffer - buyerOffer)),
    status,
    agreed_price: agreedPrice,
  };
}

function round_2dp(val) {
  return Math.round(val * 100) / 100;
}

export default negotiate;
