export const IPC_CHANNELS = {
  tasksList: 'tasks:list',
  tasksCreate: 'tasks:create',
  tasksUpdate: 'tasks:update',
  tasksDelete: 'tasks:delete',
  logsList: 'logs:list',
  logsAdd: 'logs:add',
  excelImport: 'excel:import',
  excelExportTasks: 'excel:exportTasks',
  excelExportDaily: 'excel:exportDaily',
  shareCopyText: 'share:copyText',
  shareSaveImage: 'share:saveImage',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set'
} as const;
