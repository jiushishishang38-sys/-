import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: '.',
  base: process.env.GITHUB_ACTIONS ? '/-/' : './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        course: resolve(__dirname, 'course.html'),
        guide: resolve(__dirname, 'guide.html'),
        experiment: resolve(__dirname, 'experiment.html'),
        eye: resolve(__dirname, 'eye.html'),
        quiz: resolve(__dirname, 'quiz.html'),
        report: resolve(__dirname, 'report.html')
      }
    }
  }
});
