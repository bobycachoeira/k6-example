# Playbook: criar uma nova jornada (fluxo de negócio)

Jornadas ficam em `lib/journey.js` — são a camada que compõe os fluxos de negócio.

Exemplo: `postComComentariosJourney()` que lê um post e seus comentários.

## 1. Implemente em `lib/journey.js`

```js
export function postComComentariosJourney() {
  readPost();
  readComments();
  businessFlows.add(1);
}
```

Composição livre: use os passos existentes (`listPosts`, `readPost`, `readComments`,
`createPost`, `listUsers`) ou crie passos novos no mesmo arquivo, seguindo o padrão:

```js
export function novoPasso() {
  group('nome do passo', () => {
    const res = get('/rota');
    statusIs(res, 200, 'GET /rota');
    isJson(res, 'GET /rota');
  });
}
```

> Se um passo precisar devolver dados para o próximo (ex.: criar e depois ler o criado),
> faça o passo **retornar** `res` — mudança segura, os contratos continuam passando.

## 2. Referencie nos cenários

- **Perfis fixos** (`scenarios/smoke.js`, `load.js`, ...): chame a jornada no `default`.
- **Perfil dynamic (por RPS)**: adicione a entrada em `config/dynamic.js`:

```js
const JOURNEYS = {
  // ...
  comentarios: { exec: 'postComComentariosJourney', envVar: 'COMENTARIOS_RPS', defaultRate: 0 },
};
```

E exporte a função em `scenarios/dynamic.js`:

```js
export { createJourney, fullJourney, getJourney, postComComentariosJourney };
```

## 3. Contratos e documentação

- `tests/contracts.js`: adicione o check de export no bloco final:
  `'postComComentariosJourney exportado': (m) => typeof m.postComComentariosJourney === 'function'`
- `README.md`: atualize a tabela de jornadas e, se aplicável, a tabela de variáveis do dynamic.

## Validação

```bash
./scripts/check.sh
COMENTARIOS_RPS=2 DURATION=10s ./scripts/run.sh dynamic
```
