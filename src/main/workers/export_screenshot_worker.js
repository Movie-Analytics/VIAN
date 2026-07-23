const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')
import { readVianStore, screenshotFileName } from './annotation_export_helpers'

const exportScreenshot = async (storePath, location, screenshot, associatedAnnotations) => {
  const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-screenshot-'))
  const { mainStore } = readVianStore(storePath)

  const imagePath = screenshot.image.replace('app://', '')
  const imageName = screenshotFileName(screenshot.frame, mainStore.fps)
  try {
    fs.copyFileSync(imagePath, path.join(tmpPath, imageName))
  } catch (err) {
    console.error('Failed to copy screenshot:', imagePath, err)
    throw new Error('Failed to copy screenshot', { cause: err })
  }

  const annotationsPath = path.join(tmpPath, imageName.replace(/\.jpg$/u, '.json'))
  fs.writeFileSync(annotationsPath, JSON.stringify(associatedAnnotations, null, 2))

  const finalLocation = location.endsWith('.zip') ? location : `${location}.zip`
  const output = fs.createWriteStream(finalLocation)
  const archive = archiver('zip')

  archive.pipe(output)
  archive.directory(tmpPath, false)
  await archive.finalize()
  fs.rmSync(tmpPath, { recursive: true })
}

console.log('Started screenshot export worker')

exportScreenshot(
  workerData.storePath,
  workerData.location,
  workerData.screenshot,
  workerData.associatedAnnotations
)
  .then(() => {
    parentPort.postMessage(true)
  })
  .catch((error) => {
    throw error
  })
