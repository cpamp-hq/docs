<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import { channel } from '../channel';
const { lang } = useData();
</script>

<template>
  <DefaultTheme.Layout>
    <template v-if="channel.beta" #layout-top>
      <div class="beta-banner" role="status">
        <template v-if="lang.startsWith('en')">
          v2 Beta — prerelease documentation.
          <a href="https://cpamp-docs.seakee.dev/en/">Read 1.x Stable documentation</a>
        </template>
        <template v-else>
          v2 Beta — 预发布版本文档。
          <a href="https://cpamp-docs.seakee.dev/">查看 1.x 稳定版文档</a>
        </template>
      </div>
    </template>
  </DefaultTheme.Layout>
</template>

<style>
html:has(.beta-banner) { --vp-layout-top-height: 64px; }
.beta-banner {
  position: fixed;
  z-index: 40;
  inset: 0 0 auto;
  min-height: 64px;
  padding: 6px 16px;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  gap: 0 8px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
  font-size: 14px;
  line-height: 24px;
  text-align: center;
  border-bottom: 1px solid var(--vp-c-divider);
}
.beta-banner a { color: var(--vp-c-brand-1); text-decoration: underline; }
@media (max-width: 640px) {
  html:has(.beta-banner) .VPHome .VPHero {
    padding-top: calc(var(--vp-nav-height) + var(--vp-layout-top-height) + 54px);
  }
}
</style>
