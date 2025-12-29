<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>Share Center</h2>
        <p>Celebrate the day and send a crisp update.</p>
      </div>
      <div class="header-actions">
        <AppButton variant="ghost" @click="copyText">Copy Text</AppButton>
        <AppButton @click="saveImage">Save Image</AppButton>
      </div>
    </div>

    <div class="share-grid">
      <AppCard>
        <h3>WhatsApp Ready Summary</h3>
        <textarea class="share-text" readonly :value="summaryText"></textarea>
      </AppCard>

      <AppCard>
        <h3>Share Card</h3>
        <div ref="cardRef">
          <ShareCard
            :date="date"
            :summary="summaryLine"
            :highlight="highlight"
            :completed="completedToday"
            :focus-sessions="focusSessions"
            :streak="streak"
            :points="points"
          />
        </div>
      </AppCard>
    </div>
  </div>
</template>

<script lang="ts">
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import AppButton from '../components/AppButton.vue';
import AppCard from '../components/AppCard.vue';
import ShareCard from '../components/ShareCard.vue';
import { useStatsStore } from '../stores/stats';
import { useTasksStore } from '../stores/tasks';
import { useLogsStore } from '../stores/logs';
import { useToastStore } from '../stores/toast';

export default {
  name: 'ShareCenter',
  components: { AppButton, AppCard, ShareCard },
  computed: {
    date() {
      return dayjs().format('YYYY-MM-DD');
    },
    completedToday() {
      return useLogsStore().logs.filter((log) => log.type === 'task' && log.date === this.date).length;
    },
    focusSessions() {
      return useLogsStore().logs.filter((log) => log.type === 'focus' && log.date === this.date).length;
    },
    streak() {
      return useStatsStore().streak;
    },
    points() {
      return useStatsStore().points;
    },
    highlight() {
      const tasks = useTasksStore().tasks.filter((task) => task.status === 'Done');
      const highlightTask = tasks.find((task) => task.priority === 'High') || tasks[0];
      return highlightTask?.title || 'Stayed on track.';
    },
    summaryLine() {
      return `Completed ${this.completedToday} tasks and ${this.focusSessions} focus sessions today.`;
    },
    summaryText() {
      return `WorkQuest Daily Update (${this.date})\n\nTasks Done: ${this.completedToday}\nFocus Sessions: ${this.focusSessions}\nStreak: ${this.streak} days\nPoints: ${this.points}\n\nHighlight: ${this.highlight}`;
    }
  },
  methods: {
    async copyText() {
      const toast = useToastStore();
      await window.electronAPI.shareCopyText(this.summaryText);
      toast.addToast('Summary copied to clipboard.', 'success');
    },
    async saveImage() {
      const toast = useToastStore();
      const node = this.$refs.cardRef as HTMLElement;
      if (!node) return;
      const canvas = await html2canvas(node, { backgroundColor: null, scale: 2 });
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `workquest_${this.date}.png`;
      const result = await window.electronAPI.shareSaveImage(dataUrl, fileName);
      toast.addToast(`Image saved to ${result.filePath}`, 'success');
    }
  }
};
</script>
