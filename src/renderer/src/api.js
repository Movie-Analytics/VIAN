/* eslint-disable no-empty-function */
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'

const TOKEN_REFRESH_INTERVAL = 15 * 60 * 1000
const JOB_REFRESH_INTERVAL = 2 * 1000

class RemoteApi {
  constructor() {
    this.callbacks = {
      'export-project': this.onExportProject,
      'export-screenshot': this.onExportScreenshot,
      'export-screenshots': this.onExportScreenshots
    }
    this.jobUpdate = null
    this.tokenUpdate = null
    this.bearerToken = null
    this.baseApi = '/'
    if (import.meta.env.DEV) {
      this.baseApi = '/api/'
    }
    if (import.meta.env.VITE_API_BASE) {
      this.baseApi = import.meta.env.VITE_API_BASE
    }
  }

  // Dummy implementations for menu actions
  onFrameBackward() {}
  onFrameForward() {}
  onPlaybackBackward() {}
  onPlaybackForward() {}
  onRedoAction() {}
  onSegmentDelete() {}
  onSegmentMerge() {}
  onSegmentNext() {}
  onSegmentPrevious() {}
  onSegmentSplit() {}
  onStopPlayback() {}
  onTogglePlayback() {}
  onUndoAction() {}
  unregisterVideoViewCallbacks() {}

  logError(msg) {
    console.log('Unhandled error:', msg)
  }

  async login(email, password) {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)

    const response = await fetch(this.baseApi + 'login', {
      body: formData,
      method: 'POST'
    })
    if (response.ok) {
      const jsonResponse = await response.json()
      const token = jsonResponse.access_token
      this.bearerToken = token
      localStorage.setItem('token', token)

      this.intervalCheckToken()
      return true
    }
    return false
  }

  intervalCheckToken() {
    if (this.tokenUpdate !== null) return

    this.tokenUpdate = setInterval(async () => {
      if (!(await this.checkToken())) {
        this.tokenUpdate = null
        this.logout()
      }
    }, TOKEN_REFRESH_INTERVAL)
  }

  async checkToken() {
    let token = this.bearerToken
    if (token === null) {
      token = localStorage.getItem('token')
    }
    if (token === null) return false

    const response = await fetch(this.baseApi + 'renew-token', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      method: 'GET'
    })
    if (response.ok) {
      token = (await response.json()).access_token
      this.bearerToken = token
      localStorage.setItem('token', token)
      return true
    }
    return false
  }

  async signup(email, password) {
    const response = await fetch(this.baseApi + 'signup', {
      body: JSON.stringify({
        email,
        password
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'POST'
    })
    return response.ok
  }

  openVideo(cb) {
    return new Promise((resolve) => {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'video/mp4,video/quicktime'

      fileInput.onchange = (event) => {
        const [file] = event.target.files
        if (!file) {
          resolve(null)
          return
        }

        const formData = new FormData()
        formData.append('file', file)

        const xhr = new XMLHttpRequest()

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && cb) {
            cb(Math.round((e.loaded / e.total) * 100))
          }
        }

        xhr.onload = () => {
          cb(null)
          if (xhr.status === 200) {
            try {
              resolve(JSON.parse(xhr.responseText))
            } catch {
              resolve(null)
            }
          } else {
            resolve(null)
          }
        }

        xhr.onerror = () => {
          cb(null)
          resolve(null)
        }

        xhr.open('POST', this.baseApi + 'upload-video')
        xhr.setRequestHeader('Authorization', `Bearer ${this.bearerToken}`)
        xhr.send(formData)
      }
      fileInput.click()
    })
  }

  async loadStore(name, id) {
    if (name === 'main') {
      this.callbacks['jobs-update'](await this.getJobs())
    }
    const response = await fetch(this.baseApi + 'load-store', {
      body: JSON.stringify({
        id: id || null,
        name
      }),
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'POST'
    })

    if (response.ok) return response.json()
    return null
  }

  async saveStore(name, store) {
    let id = null
    if (name !== 'meta') {
      id = store.id
    }

    const response = await fetch(this.baseApi + 'save-store', {
      body: JSON.stringify({
        data: store,
        id,
        name
      }),
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'POST'
    })

    return response.ok
  }

  logout() {
    localStorage.setItem('token', null)
    clearInterval(this.tokenUpdate)
    this.bearerToken = null
  }

  onJobsUpdate(cb) {
    this.callbacks['jobs-update'] = cb
  }

  async getVideoInfo(video) {
    this.callbacks['jobs-update'](await this.getJobs())

    const response = await fetch(this.baseApi + 'get-video-info', {
      body: JSON.stringify({
        id: useMainStore().id,
        video
      }),
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'POST'
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  onVideoInfo(cb) {
    this.callbacks['video-info'] = cb
  }
  onScreenshotsGeneration(cb) {
    this.callbacks['screenshots-generation'] = cb
  }
  onScreenshotGeneration(cb) {
    this.callbacks['screenshot-generation'] = cb
  }

  async runShotBoundaryDetection(video) {
    this.callbacks['jobs-update'](await this.getJobs())

    const response = await fetch(this.baseApi + 'shotboundary-detection', {
      body: JSON.stringify({
        id: useMainStore().id,
        video
      }),
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'POST'
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  loadSubtitles(id) {
    return new Promise((resolve) => {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'application/x-subrip'

      fileInput.onchange = async (event) => {
        const [file] = event.target.files
        if (!file) {
          resolve(null)
        }

        try {
          const token = this.bearerToken
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch(this.baseApi + `upload-subtitles/${id}`, {
            body: formData,
            headers: {
              Authorization: `Bearer ${token}`
            },
            method: 'POST'
          })

          if (!response.ok) {
            resolve(null)
          }

          const result = await response.json()
          resolve(result.location)
        } catch (error) {
          console.log('Error', error)
          resolve(null)
        }
      }
      fileInput.click()
    })
  }

  onShotBoundaryDetection(cb) {
    this.callbacks['shotboundary-detection'] = cb
  }

  async getJobs() {
    let url = this.baseApi + 'get-jobs/'
    if (useMainStore().id !== null) {
      url += useMainStore().id
    }
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'GET'
    })
    return await response.json()
  }

  startJobUpdateFetch() {
    if (this.jobUpdate !== null) return

    this.jobUpdate = setInterval(async () => {
      try {
        const jobs = await this.getJobs()
        if (jobs.every((j) => j.status !== 'RUNNING')) {
          clearInterval(this.jobUpdate)
          this.jobUpdate = null
        }

        const oldJobs = useTempStore().jobs
        const oldJobsDone = oldJobs.filter((o) => o.status === 'DONE').map((o) => o.id)
        jobs
          .filter((j) => j.status === 'DONE' && !oldJobsDone.includes(j.id))
          .forEach(async (j) => {
            // Fetch results for newly finished jobs
            const response = await fetch(this.baseApi + `get-result/${j.id}`, {
              headers: {
                Authorization: `Bearer ${this.bearerToken}`,
                'Content-type': 'application/json; charset=UTF-8'
              },
              method: 'GET'
            })
            if (response.ok) this.callbacks[j.type]((await response.json()).data)
          })
        this.callbacks['jobs-update'](jobs)
      } catch (e) {
        console.log('Error fetching job update', e)
        clearInterval(this.jobUpdate)
        this.jobUpdate = null
      }
    }, JOB_REFRESH_INTERVAL)
  }

  async runScreenshotsGeneration(video, frames, projectid) {
    this.callbacks['jobs-update'](await this.getJobs())

    const response = await fetch(this.baseApi + 'screenshots-generation', {
      body: JSON.stringify({
        frames,
        id: projectid,
        video
      }),
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'POST'
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  async runScreenshotGeneration(video, frame, projectid) {
    return await this.runScreenshotsGeneration(video, [frame], projectid)
  }

  async terminateJob(id) {
    const response = await fetch(this.baseApi + `terminate-job/${id}`, {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'GET'
    })

    return response.ok
  }

  async exportScreenshot(projectId, screenshot, associatedAnnotations) {
    const response = await fetch(this.baseApi + 'export-screenshot', {
      body: JSON.stringify({
        associatedAnnotations,
        id: projectId,
        screenshot
      }),
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'POST'
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  async exportScreenshots(projectId, frames) {
    const response = await fetch(this.baseApi + 'export-screenshots', {
      body: JSON.stringify({
        frames,
        id: projectId
      }),
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'POST'
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  onExportScreenshot(url) {
    const a = document.createElement('a')
    a.href = url
    a.download = 'screenshot.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  onExportScreenshots(url) {
    const a = document.createElement('a')
    a.href = url
    a.download = 'screenshots.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async exportProject(projectId) {
    const response = await fetch(this.baseApi + 'export-project', {
      body: JSON.stringify({
        id: projectId
      }),
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-type': 'application/json; charset=UTF-8'
      },
      method: 'POST'
    })
    this.startJobUpdateFetch()

    return response.ok
  }

  onExportProject(url) {
    const a = document.createElement('a')
    a.href = url
    a.download = 'vian.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async importProject(videoFile, zipFile) {
    this.callbacks['jobs-update'](await this.getJobs())
    const formData = new FormData()
    formData.append('zipfile', zipFile)
    formData.append('video', videoFile)

    const response = await fetch(this.baseApi + 'import-project', {
      body: formData,
      headers: {
        Authorization: `Bearer ${this.bearerToken}`
      },
      method: 'POST'
    })

    if (!response.ok) {
      return
    }

    await response.json()
    this.startJobUpdateFetch()
  }

  onImportProject(cb) {
    this.callbacks['import-project'] = cb
  }
}

const api = IS_ELECTRON ? window.electronAPI : new RemoteApi()

export default api
