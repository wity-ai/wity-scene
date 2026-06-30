# Audio Profile Service

**Lambda:** `wityAudioProfile`
**Path:** `services/scene-analyze/audio-profile/`

Analyzes actual audio loudness over time from a wity-scene document. Downloads all `ws-video` and `ws-audio` media files, decodes their audio tracks via FFmpeg, and measures RMS loudness per configurable time window.

## What it does

1. Parses the scene XML and extracts all media elements (`ws-video`, `ws-audio`)
2. Downloads media files to `/tmp` (reuses `@wity/scene-compose` downloader — handles HTTPS and S3 URLs)
3. Probes each file for audio streams (skips silent videos, muted elements)
4. Decodes audio to raw PCM via FFmpeg (`f32le`, mono, 16kHz default)
5. Measures RMS loudness per time window (default 100ms)
6. Applies XML `volume` multipliers to reflect intended output levels
7. Builds a mixed profile by power-summing all active tracks at each time window

## Input

```json
{
  "sceneXml": "<wity-scene ...>...</wity-scene>",
  "options": {
    "windowMs": 100,
    "sampleRate": 16000
  }
}
```

## Output

```json
{
  "sceneDuration": 15.0,
  "windowMs": 100,
  "sampleRate": 16000,
  "elements": [
    {
      "id": "el1",
      "tag": "ws-video",
      "src": "https://...",
      "begin": 0,
      "dur": 15,
      "volume": 0.8,
      "hasAudio": true,
      "profile": {
        "startTime": 0,
        "windowCount": 150,
        "windowMs": 100,
        "rmsLinear": [0.12, 0.15, ...],
        "rmsDbfs": [-18.4, -16.5, ...],
        "peakDbfs": -6.2,
        "avgDbfs": -18.1
      }
    }
  ],
  "mixed": {
    "startTime": 0,
    "windowCount": 150,
    "windowMs": 100,
    "rmsLinear": [...],
    "rmsDbfs": [...],
    "peakDbfs": -5.8,
    "avgDbfs": -16.3
  }
}
```

## Relationship to other services

This is an **analysis** service under `services/scene-analyze/`. It is independent from the rendering pipeline (`services/scene-render/`). It does not produce video — it produces structured data about audio loudness that AI agents and authoring tools can use for decisions like highlight extraction, volume normalization, or energy-based editing.
