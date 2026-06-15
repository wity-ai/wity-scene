# Rendering

wity-scene produces `ComputedFrame` objects — resolved pixel state at a given time. Connecting that to a display surface is left entirely to the renderer.

## ComputedFrame shape

```js
{
  t: 1.0,
  width: 1920,
  height: 1080,
  elements: [
    {
      id: 'scrim-rect',
      tag: 'ws-rect',
      x: 0,
      y: 0,
      opacity: 0.65,   // layer opacity × element opacity × animation opacity
      z: 0,
      visible: true,
      props: {
        width: 1920, height: 1080,
        fill: '#000000', stroke: null, strokeWidth: 1, rx: 0,
      },
      content: null,
    },
    {
      id: 'title-text',
      tag: 'ws-text',
      x: 960,          // 50% of 1920, anchor-adjusted
      y: 387,          // 38% of 1080, plus animate-in translateY offset at t=1.0
      opacity: 1,
      z: 10000,        // layer.z(10) * 1000 + el.z(0)
      visible: true,
      props: {
        fontSize: 64.8,   // 6% of min(1920,1080)
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
        lineHeight: 1.4,
        maxWidth: null,
        letterSpacing: 0,
      },
      content: 'Nocturne',
    },
  ],
}
```

Elements are sorted by `z` ascending (painters algorithm). Render them in order.

## HTML/CSS renderer (browser)

```js
import { parse, evaluate } from '@wity/scene-core';

const scene = parse(xmlString);

function render(t) {
  const frame = evaluate(scene, t);
  container.innerHTML = '';

  for (const el of frame.elements) {
    if (!el.visible) continue;

    const div = document.createElement('div');
    div.style.position  = 'absolute';
    div.style.left      = `${el.x}px`;
    div.style.top       = `${el.y}px`;
    div.style.opacity   = String(el.opacity);
    div.style.zIndex    = String(el.z);

    if (el.tag === 'ws-text') {
      div.style.fontSize   = `${el.props.fontSize}px`;
      div.style.color      = el.props.color;
      div.style.fontFamily = el.props.fontFamily;
      div.style.fontWeight = el.props.fontWeight;
      div.style.textAlign  = el.props.textAlign;
      div.textContent      = el.content ?? '';
    }

    if (el.tag === 'ws-rect') {
      div.style.width      = `${el.props.width}px`;
      div.style.height     = `${el.props.height}px`;
      div.style.background = el.props.fill;
      if (el.props.rx) div.style.borderRadius = `${el.props.rx}px`;
    }

    container.appendChild(div);
  }
}

// Drive with requestAnimationFrame
let start = null;
function tick(ts) {
  if (!start) start = ts;
  render((ts - start) / 1000);
  if ((ts - start) / 1000 < scene.dur) requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

## Canvas 2D renderer

```js
function renderCanvas(ctx, frame) {
  ctx.clearRect(0, 0, frame.width, frame.height);

  for (const el of frame.elements) {
    if (!el.visible) continue;
    ctx.globalAlpha = el.opacity;

    if (el.tag === 'ws-rect') {
      ctx.fillStyle = el.props.fill;
      ctx.fillRect(el.x, el.y, el.props.width, el.props.height);
    }

    if (el.tag === 'ws-text') {
      ctx.fillStyle  = el.props.color;
      ctx.font       = `${el.props.fontWeight} ${el.props.fontSize}px ${el.props.fontFamily}`;
      ctx.textAlign  = el.props.textAlign;
      ctx.fillText(el.content ?? '', el.x, el.y);
    }
  }

  ctx.globalAlpha = 1;
}
```
