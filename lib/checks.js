import { check } from 'k6';

export function statusIs(res, expected, label) {
  return check(res, {
    [`${label} | status é ${expected}`]: (r) => r.status === expected,
  });
}

export function respondsFast(res, maxMs, label) {
  return check(res, {
    [`${label} | resposta abaixo de ${maxMs}ms`]: (r) => r.timings.duration < maxMs,
  });
}

export function isJson(res, label) {
  return check(res, {
    [`${label} | corpo é JSON válido`]: (r) => {
      try {
        r.json();
        return true;
      } catch (err) {
        return false;
      }
    },
  });
}

export function hasFields(obj, fields, label) {
  return check(obj, {
    [`${label} | campos presentes`]: (o) => fields.every((field) => o && o[field] !== undefined),
  });
}
