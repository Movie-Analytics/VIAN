const { workerData } = require('worker_threads')
const fs = require('fs')
const path = require('path')

// Deletes unreferenced projects and images. This cannot happen immediately
// upon user action to provide undo functionality.

const cleanProjects = (vianPath, projects) => {
  fs.readdirSync(vianPath, { withFileTypes: true })
    .filter((i) => i.isDirectory())
    .forEach((d) => {
      if (!projects.has(d.name)) {
        console.log('Deleting unreferenced project', d.name, path.join(vianPath, d.name))
        fs.rmSync(path.join(vianPath, d.name), { recursive: true })
      }
    })
}

const cleanScreenshots = (projectPath) => {
  if (!fs.existsSync(path.join(projectPath, 'undoable.json'))) return
  const content = fs.readFileSync(path.join(projectPath, 'undoable.json'), 'utf8')
  const { timelines } = JSON.parse(content)
  const referencedImgs = new Set()
  timelines.forEach((t) => {
    t.data.forEach((d) => {
      if (d === null) return
      if (typeof d === 'object' && 'image' in d) referencedImgs.add(d.image.replace('app://', ''))
      if (typeof d === 'object' && 'thumbnail' in d) {
        referencedImgs.add(d.thumbnail.replace('app://', ''))
      }
    })
  })

  if (!fs.existsSync(path.join(projectPath, 'screenshots'))) return
  const fsImgs = fs
    .readdirSync(path.join(projectPath, 'screenshots'), { withFileTypes: true })
    .map((i) => path.join(i.parentPath, i.name))

  const diff = new Set(fsImgs).difference(referencedImgs)
  diff.forEach((i) => {
    fs.rmSync(i)
  })
  if (diff.size > 0) console.log('Deleted %d screenshots', diff.size)
}

console.log('Started cleanup worker')
const vianPath = workerData
const content = fs.readFileSync(path.join(vianPath, 'meta.json'), 'utf8')
const projects = new Set(JSON.parse(content).projects.map((p) => p.id))

cleanProjects(vianPath, projects)
projects.forEach((p) => {
  try {
    cleanScreenshots(path.join(vianPath, p))
  } catch (e) {
    console.log('Error cleaning screenshots:', e)
  }
})
console.log('Cleanup done')
