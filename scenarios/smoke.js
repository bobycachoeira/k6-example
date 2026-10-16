import { buildOptions } from '../config/options.js';
import { createJourney, getJourney } from '../lib/journey.js';
import { makeHandleSummary } from '../lib/report.js';

export const options = buildOptions('smoke');

export default function () {
  getJourney();
  createJourney();
}

export const handleSummary = makeHandleSummary('smoke');
