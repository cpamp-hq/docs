---
layout: home
title: Documentation
description: Documentation for CPA Manager Plus, the self-hosted CPA / CLIProxyAPI management panel — installation, request monitoring, cost analytics, quotas, account health and operations.

hero:
  name: CPA Manager Plus
  text: Documentation
  tagline: Install, operate and troubleshoot the self-hosted management panel for CPA / CLIProxyAPI.
  actions:
    - theme: brand
      text: Get started
      link: /en/guide/getting-started
    - theme: alt
      text: Choose a mode
      link: /en/guide/choosing-a-panel
    - theme: alt
      text: Live demo
      link: https://cpamp-demo.seakee.dev/
---

<script setup>
import homePreview from '../images/home.webp';
</script>

<figure class="cpamp-home-preview">
  <img :src="homePreview" alt="CPA Manager Plus dashboard screenshot" />
  <figcaption>CPA / CLIProxyAPI gateway management, request monitoring, cost analytics, and account health in one self-hosted panel.</figcaption>
</figure>

## Read by task

<div class="cpamp-doc-grid">
  <section class="cpamp-doc-card">
    <h3>Get started</h3>
    <p>Choose the right mode, then complete installation, login, and the first verification.</p>
    <ul>
      <li><a href="./guide/choosing-a-panel.html">Choose the Lightweight Panel or Full Mode</a></li>
      <li><a href="./guide/getting-started.html">Quick start</a></li>
      <li><a href="./deployment/cpa-panel.html">Install the Lightweight Panel</a></li>
      <li><a href="./deployment/installer.html">Install Full Mode</a></li>
    </ul>
  </section>
  <section class="cpamp-doc-card">
    <h3>Manage models and accounts</h3>
    <p>Handle providers, OAuth, Accounts, and client setup for daily use.</p>
    <ul>
      <li><a href="./manual/ai-providers.html">AI providers</a></li>
      <li><a href="./manual/accounts.html">Accounts</a></li>
      <li><a href="./manual/oauth.html">OAuth login</a></li>
      <li><a href="./gateway/clients.html">Client configuration</a></li>
    </ul>
  </section>
  <section class="cpamp-doc-card">
    <h3>Understand requests and cost</h3>
    <p>Use Dashboard to spot a problem, then investigate failures, cost, and account health.</p>
    <ul>
      <li><a href="./manual/dashboard.html">Dashboard</a></li>
      <li><a href="./manual/monitoring.html">Monitoring</a></li>
      <li><a href="./manual/usage-analytics.html">Usage analytics</a></li>
      <li><a href="./manual/accounts.html">Account health and quota</a></li>
    </ul>
  </section>
  <section class="cpamp-doc-card">
    <h3>Maintain and troubleshoot</h3>
    <p>Upgrade and back up safely, then troubleshoot monitoring, login, or network problems by symptom.</p>
    <ul>
      <li><a href="./operations/update.html">Upgrade CPAMP</a></li>
      <li><a href="./operations/backup.html">Backup and restore</a></li>
      <li><a href="./troubleshooting/request-monitoring.html">Monitoring has no data</a></li>
      <li><a href="./reference/faq.html">FAQ</a></li>
    </ul>
  </section>
</div>

## Choose how to use CPAMP

<div class="cpamp-mode-grid">
  <section class="cpamp-mode-card">
    <h3>CPAMP Lightweight Panel</h3>
    <p>Keep your existing CPA and replace only the management UI, with no additional service, database, or port.</p>
    <a href="./deployment/cpa-panel.html">Install the Lightweight Panel</a>
  </section>
  <section class="cpamp-mode-card">
    <h3>CPAMP Full Mode</h3>
    <p>Use request history, cost analytics, account inspection, and automation through Docker or a native package.</p>
    <a href="./deployment/docker.html">Docker deployment (recommended)</a>
    <a href="./deployment/native.html">Native package deployment</a>
  </section>
</div>

## Preview the interface

The Live Demo only previews the interface with fictional data. It is not a deployment or runtime mode and cannot connect to, manage, or monitor a real CPA instance.

[Open Live Demo](https://cpamp-demo.seakee.dev/)
