<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>Excel Center</h2>
        <p>Import and export WorkQuest data with precision.</p>
      </div>
    </div>

    <div class="excel-grid">
      <AppCard>
        <h3>Import Tasks</h3>
        <p class="muted">Bring in your tasks from an .xlsx file.</p>
        <div class="button-row">
          <AppButton @click="selectFile">Select Excel File</AppButton>
          <AppButton variant="ghost" @click="importTasks" :disabled="!canImport">Import</AppButton>
        </div>

        <div v-if="preview" class="preview-panel">
          <AppSelect v-model="sheetName" label="Sheet" :options="preview.sheets" />
          <div class="mapping-grid">
          <AppSelect v-model="columnMap.title" label="Title" :options="preview.headers" empty-label="Select" />
          <AppSelect v-model="columnMap.dueDate" label="Due Date" :options="preview.headers" empty-label="Skip" />
          <AppSelect v-model="columnMap.priority" label="Priority" :options="preview.headers" empty-label="Skip" />
          <AppSelect v-model="columnMap.tags" label="Tags" :options="preview.headers" empty-label="Skip" />
          <AppSelect v-model="columnMap.estimateMinutes" label="Estimate" :options="preview.headers" empty-label="Skip" />
          </div>

          <div class="preview-table">
            <div class="preview-row header">
              <span v-for="header in preview.headers" :key="header">{{ header }}</span>
            </div>
            <div v-for="(row, index) in preview.rows.slice(1, 11)" :key="index" class="preview-row">
              <span v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</span>
            </div>
          </div>
        </div>

        <div v-if="importResult" class="import-result">
          Imported {{ importResult.imported }} tasks. Skipped {{ importResult.skipped }}.
        </div>
      </AppCard>

      <AppCard>
        <h3>Export</h3>
        <p class="muted">Keep a copy of your tasks and daily report.</p>
        <div class="button-column">
          <AppButton @click="exportTasks">Export Tasks</AppButton>
          <AppButton variant="ghost" @click="exportDaily">Export Daily Report</AppButton>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<script lang="ts">
import dayjs from 'dayjs';
import AppButton from '../components/AppButton.vue';
import AppCard from '../components/AppCard.vue';
import AppSelect from '../components/AppSelect.vue';
import { useToastStore } from '../stores/toast';
import { useTasksStore } from '../stores/tasks';
import type { ExcelImportPreview, ExcelImportResult } from '@shared/types';

export default {
  name: 'ExcelCenter',
  components: { AppButton, AppCard, AppSelect },
  data() {
    return {
      preview: null as ExcelImportPreview | null,
      sheetName: '',
      columnMap: {
        title: '',
        dueDate: '',
        priority: '',
        tags: '',
        estimateMinutes: ''
      },
      importResult: null as ExcelImportResult | null,
      loading: false
    };
  },
  computed: {
    canImport() {
      return this.preview && this.columnMap.title;
    }
  },
  watch: {
    sheetName(newValue: string) {
      if (this.preview && newValue) {
        this.loadPreview(newValue);
      }
    }
  },
  methods: {
    async selectFile() {
      const toast = useToastStore();
      try {
        const response = await window.electronAPI.excelImport({ action: 'pick' });
        if ('preview' in response) {
          this.preview = response.preview;
          this.sheetName = response.preview.sheetName;
          this.columnMap.title = response.preview.headers[0] || '';
        }
      } catch (error) {
        toast.addToast('Failed to load Excel file.', 'error');
      }
    },
    async loadPreview(sheetName: string) {
      if (!this.preview) return;
      const response = await window.electronAPI.excelImport({
        action: 'preview',
        filePath: this.preview.filePath,
        sheetName
      });
      if ('preview' in response) {
        this.preview = response.preview;
      }
    },
    async importTasks() {
      if (!this.preview || !this.sheetName) return;
      const toast = useToastStore();
      try {
        const response = await window.electronAPI.excelImport({
          action: 'import',
          filePath: this.preview.filePath,
          sheetName: this.sheetName,
          columnMap: this.columnMap
        });
        if ('result' in response) {
          this.importResult = response.result;
          await useTasksStore().load();
          toast.addToast('Import complete.', 'success');
        }
      } catch (error) {
        toast.addToast('Import failed.', 'error');
      }
    },
    async exportTasks() {
      const toast = useToastStore();
      const result = await window.electronAPI.excelExportTasks();
      if (result.filePath) {
        toast.addToast(`Tasks exported to ${result.filePath}`, 'success');
      }
    },
    async exportDaily() {
      const toast = useToastStore();
      const date = dayjs().format('YYYY-MM-DD');
      const result = await window.electronAPI.excelExportDaily(date);
      if (result.filePath) {
        toast.addToast(`Report saved to ${result.filePath}`, 'success');
      }
    }
  }
};
</script>
