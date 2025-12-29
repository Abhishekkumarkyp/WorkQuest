import { createRouter, createWebHashHistory } from 'vue-router';
import Dashboard from '../pages/Dashboard.vue';
import Tasks from '../pages/Tasks.vue';
import WorkLog from '../pages/WorkLog.vue';
import ExcelCenter from '../pages/ExcelCenter.vue';
import ShareCenter from '../pages/ShareCenter.vue';
import LanConnect from '../pages/LanConnect.vue';
import LanChat from '../pages/LanChat.vue';
import Settings from '../pages/Settings.vue';

const routes = [
  { path: '/', name: 'dashboard', component: Dashboard },
  { path: '/tasks', name: 'tasks', component: Tasks },
  { path: '/work-log', name: 'work-log', component: WorkLog },
  { path: '/excel', name: 'excel', component: ExcelCenter },
  { path: '/share', name: 'share', component: ShareCenter },
  { path: '/lan-connect', name: 'lan-connect', component: LanConnect },
  { path: '/lan-chat', name: 'lan-chat', component: LanChat },
  { path: '/settings', name: 'settings', component: Settings }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
