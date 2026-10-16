import { buildOptions } from '../config/options.js';
import { fullJourney } from '../lib/journey.js';
import { makeHandleSummary } from '../lib/report.js';

export const options = buildOptions();

export default function () {
  fullJourney();
}

export const handleSummary = makeHandleSummary();
