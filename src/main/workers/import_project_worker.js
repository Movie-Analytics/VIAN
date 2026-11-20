const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
const yauzl = require('yauzl')

// Names the step that failed, so the error log says where an import went wrong
const withContext = (step, err) => {
  const wrapped = new Error(`Import failed while ${step}: ${err.message}`)
  wrapped.stack = `${wrapped.message}\n${err.stack}`
  return wrapped
}

const inStep = (step, fn) => {
  try {
    return fn()
  } catch (err) {
    throw withContext(step, err)
  }
}

const importProject = (videoPath, zipPath, dataPath) => {
  return new Promise((resolve, reject) => {
    const name = path.basename(zipPath)
    const id = crypto.randomUUID()
    const projectPath = path.join(dataPath, id)

    fs.mkdirSync(projectPath, { recursive: true })

    yauzl.open(zipPath, (err, zipfile) => {
      if (err) {
        reject(withContext('opening the zip file', err))
        return
      }
      zipfile.on('error', (zipErr) => reject(withContext('reading the zip file', zipErr)))

      const extractionPromises = []

      zipfile.on('entry', (entry) => {
        if (entry.fileName.endsWith('/')) {
          fs.mkdirSync(path.join(projectPath, entry.fileName), { recursive: true })
        } else if (
          !entry.fileName.startsWith('__MACOS') &&
          !path.basename(entry.fileName).startsWith('.')
        ) {
          console.log(entry, entry.fileName)
          const extractPromise = new Promise((resolveExtract, rejectExtract) => {
            zipfile.openReadStream(entry, (err3, readStream) => {
              console.log('Entry:', entry)
              if (err3) {
                rejectExtract(err3)
                return
              }

              const entryPath = path.join(projectPath, entry.fileName)
              console.log('Entry path:', entryPath)
              const writeStream = fs.createWriteStream(entryPath)

              readStream.on('end', () => {
                console.log('Extracted:', entry.fileName)
                resolveExtract()
              })

              readStream.on('error', rejectExtract)
              writeStream.on('error', rejectExtract)
              readStream.pipe(writeStream)
              console.log('Reached end')
            })
          })

          extractionPromises.push(
            extractPromise.catch((extractErr) => {
              throw withContext(`extracting ${entry.fileName}`, extractErr)
            })
          )
        }
      })

      zipfile.on('end', () => {
        Promise.all(extractionPromises)
          .then(() => {
            const readJson = (file) =>
              inStep(`reading ${file}`, () =>
                JSON.parse(fs.readFileSync(path.join(projectPath, file), 'utf8'))
              )
            const mainStore = readJson('main.json')
            const undoableStore = readJson('undoable.json')

            inStep('updating paths in the project data', () => {
              mainStore.video = 'app://' + videoPath
              mainStore.id = id
              undoableStore.id = id

              if (undoableStore.subtitles !== null) {
                undoableStore.subtitles = 'app://' + path.join(projectPath, 'subtitles.vtt')
              }

              // Stored paths come from the exporting machine, so they may use backslashes
              // (Windows) or slashes (macOS/Linux). win32.basename splits on both.
              const screenshotPath = (stored) =>
                'app://' + path.join(projectPath, 'screenshots', path.win32.basename(stored))

              undoableStore.timelines.forEach((t) => {
                if (t.type.startsWith('screenshot')) {
                  t.data.forEach((d) => {
                    d.image = screenshotPath(d.image)
                    d.thumbnail = screenshotPath(d.thumbnail)
                  })
                }
              })
            })

            inStep('saving the project data', () => {
              fs.writeFileSync(
                path.join(projectPath, 'main.json'),
                JSON.stringify(mainStore),
                'utf8'
              )
              fs.writeFileSync(
                path.join(projectPath, 'undoable.json'),
                JSON.stringify(undoableStore),
                'utf8'
              )
            })

            resolve({ id, name })
          })
          .catch(reject)
      })
    })
  })
}

console.log('Started project import worker', workerData)

importProject(workerData.videoFile, workerData.zipFile, workerData.dataPath)
  .then((result) => {
    parentPort.postMessage(result)
  })
  .catch((err) => {
    throw err
  })
