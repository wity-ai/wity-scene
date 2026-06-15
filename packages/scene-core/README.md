# @wity/scene-core

Headless, isomorphic XML scene-graph engine. Parse, evaluate, serialize, and validate wity-scene v1.0 documents. Zero dependencies.

**[Full documentation → wity.ai/stack/scene-graph](https://www.wity.ai/stack/scene-graph/packages/scene-core)**

---

The core package of [wity-scene](https://github.com/wity-ai/wity-scene). Use standalone or import via `@wity/scene` for a convenience re-export.

```bash
npm install @wity/scene-core
# Node.js only:
npm install @xmldom/xmldom
```

```js
import { parse, evaluate, serialize, validate } from '@wity/scene-core';

const scene = parse(xmlString);           // XML → WityScene
const frame = evaluate(scene, 2.5);       // f(scene, t) → ComputedFrame
const xml   = serialize(scene);           // WityScene → XML (round-trips cleanly)
const check = validate(scene);            // → { valid, errors, warnings }
```

Built by [Wity AI](https://www.wity.ai)
