/**
 * Reader for .mediapkg archives — parses manifest.json and decodes each
 * referenced Parquet file back into row objects, keyed by track name.
 */
const yauzl = require('yauzl')
const arrow = require('apache-arrow')
const pq = require('parquet-wasm/node')

function readZipEntry(zipfile, entry) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) return reject(err)
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  })
}

function readZip(path) {
  return new Promise((resolve, reject) => {
    yauzl.open(path, (err, zipfile) => {
      if (err) return reject(err)
      zipfile.on('error', reject)

      const entriesByName = new Map()
      const readPromises = []

      zipfile.on('entry', (entry) => {
        if (entry.fileName.endsWith('/')) return
        readPromises.push(
          readZipEntry(zipfile, entry).then((buf) => entriesByName.set(entry.fileName, buf))
        )
      })

      zipfile.on('end', () => {
        Promise.all(readPromises)
          .then(() => resolve(entriesByName))
          .catch(reject)
      })
    })
  })
}

/** Decodes list<string> `annotations` cells (Arrow Vector) into plain arrays. */
function rowsFromParquetBuffer(buf, track) {
  const wasmTable = pq.readParquet(buf)
  const table = arrow.tableFromIPC(wasmTable.intoIPCStream())
  return table.toArray().map((row) => {
    const obj = row.toJSON()
    if (typeof obj.annotations?.toArray === 'function') {
      obj.annotations = obj.annotations.toArray()
    }
    return obj
  })
}

async function readMediaPackage(path) {
  const entriesByName = await readZip(path)
  const manifest = JSON.parse(entriesByName.get('manifest.json').toString('utf8'))

  const videos = manifest.videos.map((video) => {
    const tracks = {}
    for (const [trackName, filePath] of Object.entries(video.files || {})) {
      const track = manifest.tracks[trackName]
      tracks[trackName] = { ...track, rows: rowsFromParquetBuffer(entriesByName.get(filePath), track) }
    }
    return { ...video, tracks }
  })

  return { manifest, videos }
}

module.exports = { readMediaPackage }
