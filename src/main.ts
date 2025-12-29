import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './styles/base.css';
import './styles/theme.css';
import { registerLanHandlers } from './lan/registerLanHandlers';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
registerLanHandlers(pinia);
app.mount('#app');
