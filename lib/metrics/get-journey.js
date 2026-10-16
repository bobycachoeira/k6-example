import { Counter, Trend } from 'k6/metrics';

export const successfulReads = new Counter('successful_reads');

export const failedReads = new Counter('failed_reads');

export const readResponseTime = new Trend('read_response_time', true);

export const getJourneyDuration = new Trend('get_journey_duration', true);

export function recordRead(ok, startedAt) {
  (ok ? successfulReads : failedReads).add(1);
  readResponseTime.add(Date.now() - startedAt);
  return ok;
}
