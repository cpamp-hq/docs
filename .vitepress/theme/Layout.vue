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
          <strong>v2 Beta</strong>
          <span class="beta-note">— prerelease documentation.</span>
          <a href="https://cpamp-docs.seakee.dev/en/">Read 1.x Stable docs</a>
        </template>
        <template v-else>
          <strong>v2 Beta</strong>
          <span class="beta-note">— 预发布版本文档。</span>
          <a href="https://cpamp-docs.seakee.dev/">查看 1.x 稳定版文档</a>
        </template>
      </div>
    </template>
  </DefaultTheme.Layout>
</template>

<style>
html:has(.beta-banner) { --vp-layout-top-height: 40px; }
.beta-banner {
  position: fixed;
  z-index: 40;
  inset: 0 0 auto;
  height: 40px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  overflow: hidden;
  white-space: nowrap;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
  font-size: 13.5px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.beta-banner a { color: var(--vp-c-brand-1); text-decoration: underline; }
.beta-banner .beta-note { overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 640px) {
  .beta-banner .beta-note { display: none; }
}
@media (max-width: 640px) {
  html:has(.beta-banner) .VPHome .VPHero {
    padding-top: calc(var(--vp-nav-height) + var(--vp-layout-top-height) + 54px);
  }
}
</style>
