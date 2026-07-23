const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')
import { readVianStore, screenshotFileName } from './annotation_export_helpers'

const exportScreenshots = async (storePath, location, frames) => {
  const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-screenshots-'))

  const { mainStore, undoableStore } = readVianStore(storePath)

  let copied = 0
  undoableStore.timelines.forEach((t) => {
    if (!t.type.startsWith('screenshots')) return
    const timelinePath = path.join(tmpPath, `${t.name}-${t.id}`)
    fs.mkdirSync(timelinePath)
    t.data.forEach((s) => {
      if (frames && !frames.includes(s.frame)) return
      const imagePath = s.image.replace('app://', '')

      const newImageName = screenshotFileName(s.frame, mainStore.fps)
      try {
        fs.copyFileSync(imagePath, path.join(timelinePath, newImageName))
        copied += 1
      } catch (err) {
        console.error('Failed to copy screenshot:', imagePath, err)
      }
    })
  })
  if (copied === 0) {
    throw new Error('Failed to copy screenshots')
  }

  const finalLocation = location.endsWith('.zip') ? location : `${location}.zip`
  const output = fs.createWriteStream(finalLocation)
  const archive = archiver('zip')

  archive.pipe(output)
  archive.directory(tmpPath, false)
  await archive.finalize()
  fs.rmSync(tmpPath, { recursive: true })
}

console.log('Started screenshot export worker')

exportScreenshots(workerData.storePath, workerData.location, workerData.frames)
  .then(() => {
    parentPort.postMessage(true)
  })
  .catch((error) => {
    throw error
  })
