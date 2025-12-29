import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';

const traySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#62F3FF"/>
      <stop offset="1" stop-color="#7C6CFF"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="48" height="48" rx="14" fill="url(#g)"/>
  <path d="M20 34h24M20 24h16" stroke="#0B0C10" stroke-width="4" stroke-linecap="round"/>
</svg>
`;

export function createTray(window: BrowserWindow, onQuit: () => void) {
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(traySvg).toString('base64')}`
  );
  const tray = new Tray(image);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show WorkQuest',
      click: () => {
        window.show();
        window.focus();
      }
    },
    {
      label: 'Add Task',
      click: () => {
        window.show();
        window.webContents.send('tray:addTask');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        onQuit();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('WorkQuest');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    window.show();
    window.focus();
  });

  return tray;
}
