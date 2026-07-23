/**
 * Writer for .mediapkg archives — the JS counterpart of mava-exchange's
 * `writer.py`. Builds a manifest.json plus one Parquet file per (video,
 * track), zipped together.
 *
 * Parquet encoding: rows are converted to an in-memory Arrow table
 * (apache-arrow), then to Parquet bytes via parquet-wasm — the same
 * arrow-rs/parquet implementation pyarrow itself is built on, so the output
 * is real, spec-compliant Parquet.
 */
const fs = require('fs')
const archiver = require('archiver')
const arrow = require('apache-arrow')
// The published root of parquet-wasm resolves to an ESM build; its `node`
// subpath carries its own `{"type":"commonjs"}` and is plain `require`-able.
const pq = require('parquet-wasm/node')

const MAVA = 'http://example.org/mava/ontology#'

const FORMAT_VERSION = '0.2'

const JSONLD_CONTEXT = {
  '@context': {
    annotations: { '@id': 'mava:stringValue', '@type': 'xsd:string' },
    end_seconds: { '@id': 'mava:endTime', '@type': 'xsd:decimal' },
    mava: MAVA,
    start_seconds: { '@id': 'mava:atTime', '@type': 'xsd:decimal' },
    xsd: 'http://www.w3.org/2001/XMLSchema#'
  }
}

/** Arrow type to use for a given track column name. */
function arrowTypeForColumn(column) {
  if (column === 'start_seconds' || column === 'end_seconds') return new arrow.Float64()
  if (column === 'annotations') return new arrow.Utf8()
  // Dimension columns (ObservationSeries) are always numeric.
  return new arrow.Float64()
}

/**
 * Builds an Arrow table from row objects, one column per `track.columns`,
 * in that declared order. `annotations` is treated as a list-of-strings
 * column when `listValued` is set (AnnotationListSeries).
 */
function rowsToArrowTable(rows, track, { listValued = false } = {}) {
  const vectors = {}
  for (const column of track.columns) {
    const values = rows.map((r) => (r[column] === undefined ? null : r[column]))
    if (column === 'annotations' && listValued) {
      vectors[column] = arrow.vectorFromArray(
        values,
        new arrow.List(arrow.Field.new('item', new arrow.Utf8(), true))
      )
    } else {
      vectors[column] = arrow.vectorFromArray(values, arrowTypeForColumn(column))
    }
  }
  return new arrow.Table(vectors)
}

function rowsToParquetBytes(rows, track, opts) {
  const table = rowsToArrowTable(rows, track, opts)
  const ipcBytes = arrow.tableToIPC(table, 'stream')
  const wasmTable = pq.Table.fromIPCStream(ipcBytes)
  const writerProperties = new pq.WriterPropertiesBuilder()
    .setCompression(pq.Compression.SNAPPY)
    .build()
  return pq.writeParquet(wasmTable, writerProperties)
}

class MediaPackageWriter {
  /**
   * @param {string} path Output path for the .mediapkg file.
   * @param {object} [opts]
   * @param {string} [opts.description] Human-readable corpus description.
   * @param {Date} [opts.created] Creation timestamp; defaults to now.
   */
  constructor(path, { description = '', created } = {}) {
    this.path = path
    this.description = description
    this.created = created
    this._videos = new Map() // videoId -> metadata
    this._tracks = new Map() // trackName -> track def
    this._data = new Map() // videoId -> Map(trackName -> { rows, listValued })
  }

  addVideo(videoId, src, { title, durationSeconds, width, height, fps } = {}) {
    if (this._videos.has(videoId)) throw new Error(`Video '${videoId}' already added`)
    this._videos.set(videoId, {
      id: videoId,
      src,
      ...(title ? { title } : {}),
      ...(width != null ? { width } : {}),
      ...(height != null ? { height } : {}),
      ...(fps != null ? { fps } : {}),
      ...(durationSeconds != null ? { duration_seconds: durationSeconds } : {})
    })
    this._data.set(videoId, new Map())
    return this
  }

  /**
   * @param {string} videoId Must have been registered with addVideo().
   * @param {object} track Track definition from tracks.js.
   * @param {object[]} rows Row objects keyed by the track's column names.
   * @param {object} [opts]
   * @param {boolean} [opts.listValued] Treat `annotations` as list<string>
   *   (AnnotationListSeries) instead of string.
   */
  addTrack(videoId, track, rows, opts = {}) {
    if (!this._videos.has(videoId)) {
      throw new Error(`Unknown video '${videoId}'. Call addVideo() first.`)
    }
    const existing = this._tracks.get(track.name)
    if (existing) {
      if (JSON.stringify(existing.toManifest()) !== JSON.stringify(track.toManifest())) {
        throw new Error(
          `Track '${track.name}' was already added with a different definition. ` +
            'Track definitions must be consistent across videos.'
        )
      }
    } else {
      this._tracks.set(track.name, track)
    }
    this._data.get(videoId).set(track.name, { listValued: !!opts.listValued, rows })
    return this
  }

  _buildManifest(filesMap, created) {
    return {
      context: JSONLD_CONTEXT,
      created: created.toISOString(),
      description: this.description,
      ontology: MAVA,
      tracks: Object.fromEntries(
        [...this._tracks].map(([name, track]) => [name, track.toManifest()])
      ),
      version: FORMAT_VERSION,
      videos: [...this._videos.entries()].map(([videoId, meta]) => ({
        ...meta,
        files: filesMap[videoId] || {}
      }))
    }
  }

  async write() {
    if (this._videos.size === 0) throw new Error('No videos added — nothing to write.')

    const created = this.created ? new Date(this.created) : new Date()

    const output = fs.createWriteStream(this.path)
    const archive = archiver('zip', { zlib: { level: 9 } })
    const finished = new Promise((resolve, reject) => {
      output.on('close', resolve)
      output.on('error', reject)
      archive.on('error', reject)
    })
    archive.pipe(output)

    const filesMap = {}
    for (const [videoId, tracks] of this._data) {
      filesMap[videoId] = {}
      for (const [trackName, { rows, listValued }] of tracks) {
        const track = this._tracks.get(trackName)
        const entry = `${videoId}/${trackName}.parquet`
        const buf = rowsToParquetBytes(rows, track, { listValued })
        archive.append(Buffer.from(buf), { date: created, name: entry })
        filesMap[videoId][trackName] = entry
      }
    }

    const manifest = this._buildManifest(filesMap, created)
    archive.append(JSON.stringify(manifest, null, 2), { date: created, name: 'manifest.json' })

    await archive.finalize()
    await finished
  }
}

module.exports = { MediaPackageWriter }
