import { Counter, Trend } from 'k6/metrics';

export const apiLatency = new Trend('api_latency', true);

export const apiErrors = new Counter('api_errors');

export const businessFlows = new Counter('business_flows');
