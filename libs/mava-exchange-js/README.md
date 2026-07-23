# mava-exchange-js

A small, self-contained JavaScript/Node port of the
[mava-exchange](https://github.com/sdsc-ordes/mava-exchange) `.mediapkg`
interchange format for video annotations. It exists so VIAN can write
`.mediapkg` packages directly from its Electron main process, without a
Python runtime dependency.

This package deliberately knows nothing about VIAN. It only deals in generic
tracks, rows, and video metadata, matching the vocabulary of the upstream
Python library (`ObservationSeries`, `AnnotationSeries`,
`AnnotationListSeries`, ...). It is kept in its own directory with its own
`package.json` so it can be lifted out into a standalone package later.

## Scope

Implements:

- `manifest.json` construction (JSON-LD context + track defs + video list),
  matching the upstream spec fields.
- Track types: `ObservationSeries`, `AnnotationSeries`, `AnnotationListSeries`.
- Parquet encoding/decoding (via `apache-arrow` + `parquet-wasm`) and ZIP
  packaging/unpacking (via `archiver` / `yauzl`).
- Reading a `.mediapkg` archive back into `{ manifest, videos }`, with each
  video's tracks resolved to row objects (`readMediaPackage`).

Not implemented (not needed by VIAN today): `RegionSeries`, RDF/JSON-LD
export, validation.

Screenshots (a single marked frame) are written as `AnnotationSeries` rows
spanning exactly that one frame's duration (`start_seconds` to
`start_seconds + 1/fps`), rather than as a new track type — no upstream
spec change needed.

## `vian` track metadata (VIAN-only extension)

Every track builder accepts an optional `vian` object, merged verbatim into
that track's manifest entry under a `vian` key (e.g.
`manifest.tracks.shots.vian`). It's opaque to this library and to the spec —
plain extra JSON a conformant reader can ignore. VIAN uses it to round-trip
information the spec has no field for: the track's original (non-slugified,
cased) display name, and a `kind` marker (`"screenshots"`) so its own importer
can tell a screenshot-marker `AnnotationSeries` apart from a regular one and
regenerate the frames instead of importing it as a plain shots timeline.
