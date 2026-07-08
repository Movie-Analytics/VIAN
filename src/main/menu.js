import { BrowserWindow, app, shell } from 'electron'
import path from 'path'

export const createMenu = () => {
  const template = [
    {
      label: 'Edit',
      submenu: [
        {
          accelerator: 'CmdOrCtrl+Z',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('undo-action')
            }
          },
          label: 'Undo'
        },
        {
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('redo-action')
            }
          },
          label: 'Redo'
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        {
          accelerator: 'Space',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('toggle-playback')
            }
          },
          label: 'Play/Pause'
        },
        {
          accelerator: 'Right',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('frame-forward')
            }
          },
          label: 'Frame Forward'
        },
        {
          accelerator: 'Left',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('frame-backward')
            }
          },
          label: 'Frame Backward'
        },
        { type: 'separator' },
        {
          accelerator: 'k',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('stop-playback')
            }
          },
          label: 'Stop'
        },
        {
          accelerator: 'l',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('playback-forward')
            }
          },
          label: 'Play Forward'
        }
      ]
    },
    {
      label: 'Timeline',
      submenu: [
        {
          accelerator: 'Up',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('segment-previous')
            }
          },
          label: 'Previous Segment'
        },
        {
          accelerator: 'Down',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('segment-next')
            }
          },
          label: 'Next Segment'
        },
        { type: 'separator' },
        {
          accelerator: 'Backspace',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('segment-delete')
            }
          },
          label: 'Delete Segment'
        },
        {
          accelerator: 'c',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('segment-split')
            }
          },
          label: 'Split Segment'
        },
        {
          accelerator: 'm',
          click: (_item, _window, event) => {
            if (!event.triggeredByAccelerator) {
              BrowserWindow.getFocusedWindow()?.webContents.send('segment-merge')
            }
          },
          label: 'Merge Segments'
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          click: () => {
            shell.openPath(path.join(app.getPath('userData'), 'vian'))
          },
          label: 'Open Files and Log'
        }
      ]
    }
  ]

  // Add macOS-specific menu items
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  return template
}
