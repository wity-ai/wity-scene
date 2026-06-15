/**
 * @wity/scene-player
 * Headless composition player for wity-scene.
 *
 * Drives evaluate(scene, t) at playback rate via RAF (or setTimeout in Node.js).
 * Presentation-agnostic — wire any renderer to the 'frame' event.
 *
 *   const player = new HeadlessPlayer();
 *   player.loadXml(xml);
 *   player.on('frame', ({ frame }) => renderFrame(frame));
 *   player.play();
 */

export { HeadlessPlayer } from './HeadlessPlayer.js';
