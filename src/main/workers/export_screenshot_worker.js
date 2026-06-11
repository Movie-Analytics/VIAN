const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')

const timeSec = (t) => {
  const hours = Math.floor(t / 3600)
  const minutes = Math.floor((t % 3600) / 60)
  const seconds = (t % 60).toFixed(2).replace('.', ',')

  const formattedHours = String(hours).padStart(2, '0')
  const formattedMinutes = String(minutes).padStart(2, '0')
  const formattedSeconds = String(seconds).padStart(2, '0')

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
}

const exportScreenshot = async (storePath, location, screenshot, associatedAnnotations) => {
  const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-screenshot-'))
  const mainStore = JSON.parse(fs.readFileSync(path.join(storePath, 'main.json'), 'utf8'))

  const imagePath = screenshot.image.replace('app://', '')
  const imageName = timeSec(screenshot.frame / mainStore.fps)
    .replaceAll(':', '-')
    .replace(',', '_')
  try {
    fs.copyFileSync(imagePath, path.join(tmpPath, imageName + '.jpg'))
  } catch (err) {
    console.error('Failed to copy screenshot:', imagePath, err)
    throw new Error('Failed to copy screenshot', { cause: err })
  }

  const annotationsPath = path.join(tmpPath, imageName + '.json')
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
