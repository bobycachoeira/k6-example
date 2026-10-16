export const newPostPayloads = [
  {
    title: 'Testes de carga com k6',
    body: 'Cenários, thresholds e métricas customizadas em um projeto de exemplo.',
    userId: 1,
  },
  {
    title: 'Smoke, load, stress e spike',
    body: 'Quatro perfis de execução cobrindo desde validação rápida até picos de tráfego.',
    userId: 2,
  },
  {
    title: 'Resultados para análise',
    body: 'Cada execução gera artefatos (JSON, CSV, HTML, log) para investigação posterior.',
    userId: 3,
  },
];

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
