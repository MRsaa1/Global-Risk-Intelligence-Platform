/**
 * Unified regulatory disclaimer texts for UI (Board Mode, Dashboard, Analytics, reports).
 * Keep in sync with API core/regulatory_disclaimers.py.
 */

export const FORWARD_LOOKING =
  'Estimates and projections are indicative and do not constitute a guarantee of future results.'

export const INTERNAL_USE_ONLY =
  'For internal risk management purposes. Not intended for regulatory submission without separate review.'

export const SHORT_DISCLAIMER = `${FORWARD_LOOKING} ${INTERNAL_USE_ONLY}`

/** One line for dashboard / board: projections + internal use */
export const DASHBOARD_DISCLAIMER =
  'Projections and risk metrics are indicative and for internal use only. Not for regulatory submission.'

/** Board / executive view */
export const BOARD_DISCLAIMER =
  'For board and executive use. Not for regulatory submission. Methodology and data as of report date.'

export function getModelDisclaimer(methodology?: string, reportDate?: string): string {
  const meth = methodology || 'Universal Stress Testing Methodology v2.0'
  let s = `Results are based on model assumptions and data as of the calculation date. Methodology: ${meth}. Model validation is conducted periodically.`
  if (reportDate) s += ` Data as of: ${reportDate}.`
  return s
}
