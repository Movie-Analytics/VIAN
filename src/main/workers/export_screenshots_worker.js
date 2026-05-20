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

const exportScreenshots = async (storePath, location, frames) => {
  const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-screenshots-'))

  const undoableStore = JSON.parse(fs.readFileSync(path.join(storePath, 'undoable.json'), 'utf8'))
  const mainStore = JSON.parse(fs.readFileSync(path.join(storePath, 'main.json'), 'utf8'))

  let copied = 0
  undoableStore.timelines.forEach((t) => {
    if (!t.type.startsWith('screenshots')) return
    const timelinePath = path.join(tmpPath, `${t.name}-${t.id}`)
    fs.mkdirSync(timelinePath)
    t.data.forEach((s) => {
      if (frames && !frames.includes(s.frame)) return
      const imagePath = s.image.replace('app://', '')

      const newImageName = (timeSec(s.frame / mainStore.fps) + '.jpg')
        .replaceAll(':', '-')
        .replace(',', '_')
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
