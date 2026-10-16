import { buildOptions } from '../config/options.js';
import { createJourney, fullJourney, getJourney } from '../lib/journey.js';
import { makeHandleSummary } from '../lib/report.js';

export const options = buildOptions('dynamic');

export { createJourney, fullJourney, getJourney };

export default function () {
  fullJourney();
}

export const handleSummary = makeHandleSummary('dynamic');
