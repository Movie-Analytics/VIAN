import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  exportProject: (p) => ipcRenderer.send('export-project', p),
  exportScreenshot: (p, s, a) => ipcRenderer.send('export-screenshot', p, s, a),
  exportScreenshots: (p, f) => ipcRenderer.send('export-screenshots', p, f),
  getVideoInfo: (arg) => ipcRenderer.send('get-video-info', arg),
  importProject: (arg, v, z) => ipcRenderer.send('import-project', arg, v, z),
  loadStore: (arg1, arg2) => ipcRenderer.invoke('load-store', arg1, arg2),
  loadSubtitles: (p) => ipcRenderer.invoke('load-subtitles', p),
  logError: (msg) => ipcRenderer.send('log-error', msg),
  onFrameBackward: (cb) => ipcRenderer.on('frame-backward', (c, ...args) => cb(...args)),
  onFrameForward: (cb) => ipcRenderer.on('frame-forward', (c, ...args) => cb(...args)),
  onImportProject: (cb) => ipcRenderer.on('imported-project', (c, ...args) => cb(...args)),
  onJobsUpdate: (cb) => ipcRenderer.on('jobs-update', (c, ...args) => cb(...args)),
  onPlaybackForward: (cb) => ipcRenderer.on('playback-forward', (c, ...args) => cb(...args)),
  onRedoAction: (cb) => ipcRenderer.on('redo-action', (c, ...args) => cb(...args)),
  onScreenshotGeneration: (cb) =>
    ipcRenderer.on('screenshot-generated', (c, ...args) => cb(...args)),
  onScreenshotsGeneration: (cb) =>
    ipcRenderer.on('screenshots-generated', (c, ...args) => cb(...args)),
  onSegmentDelete: (cb) => ipcRenderer.on('segment-delete', (c, ...args) => cb(...args)),
  onSegmentMerge: (cb) => ipcRenderer.on('segment-merge', (c, ...args) => cb(...args)),
  onSegmentNext: (cb) => ipcRenderer.on('segment-next', (c, ...args) => cb(...args)),
  onSegmentPrevious: (cb) => ipcRenderer.on('segment-previous', (c, ...args) => cb(...args)),
  onSegmentSplit: (cb) => ipcRenderer.on('segment-split', (c, ...args) => cb(...args)),
  onShotBoundaryDetection: (cb) =>
    ipcRenderer.on('shotboundary-detected', (c, ...args) => cb(...args)),
  onStopPlayback: (cb) => ipcRenderer.on('stop-playback', (c, ...args) => cb(...args)),
  onTogglePlayback: (cb) => ipcRenderer.on('toggle-playback', (c, ...args) => cb(...args)),
  onUndoAction: (cb) => ipcRenderer.on('undo-action', (c, ...args) => cb(...args)),
  onVideoInfo: (cb) => ipcRenderer.on('video-info', (c, ...args) => cb(...args)),
  openVideo: () => ipcRenderer.invoke('open-video'),
  runScreenshotGeneration: (v, f, i) => ipcRenderer.send('run-screenshot-generation', v, f, i),
  runScreenshotsGeneration: (v, f, i) => ipcRenderer.send('run-screenshots-generation', v, f, i),
  runShotBoundaryDetection: (arg) => ipcRenderer.send('run-shotboundary-detection', arg),
  saveStore: (arg1, arg2) => ipcRenderer.send('save-store', arg1, arg2),
  terminateJob: (arg) => ipcRenderer.send('terminate-job', arg),
  unregisterVideoViewCallbacks: () => {
    ipcRenderer.removeAllListeners('toggle-playback')
    ipcRenderer.removeAllListeners('frame-forward')
    ipcRenderer.removeAllListeners('frame-backward')
    ipcRenderer.removeAllListeners('playback-forward')
    ipcRenderer.removeAllListeners('stop-playback')
    ipcRenderer.removeAllListeners('segment-next')
    ipcRenderer.removeAllListeners('segment-previous')
    ipcRenderer.removeAllListeners('undo-action')
    ipcRenderer.removeAllListeners('redo-action')
  }
})
