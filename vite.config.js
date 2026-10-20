import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base =
  repositoryName && repositoryName !== 'wldbrrt.github.io'
    ? `/${repositoryName}/`
    : '/';

export default defineConfig({ base });