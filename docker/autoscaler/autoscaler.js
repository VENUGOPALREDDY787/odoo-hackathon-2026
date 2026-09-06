/**
 * DealFlow360 backend autoscaler (watcher container).
 *
 * Behavior (per requirements):
 *  - Watches the CPU utilization of every `backend` replica via the Docker API.
 *  - When ANY replica sustains >= 70% of its CPU limit, scale up by one
 *    replica, up to MAX_REPLICAS (respecting a cooldown to avoid flapping).
 *  - When ALL replicas are idle (< 20% CPU and zero queued BullMQ jobs)
 *    continuously for 3 minutes, scale down by one replica, down to
 *    MIN_REPLICAS.
 *  - Scaling is executed with:
 *      docker compose -p <project> up -d --no-deps --scale backend=N backend
 *    which adds/removes backend containers without touching mysql, redis or
 *    the rest of the stack. Data lives in mysql/redis/volumes so replicas can
 *    come and go freely.
 */
import http from 'node:http';
import { execFile } from 'node:child_process';
import Redis from 'ioredis';

const {
  DOCKER_SOCKET = '/var/run/docker.sock',
  BACKEND_SERVICE = 'backend',
  COMPOSE_PROJECT = '',
  COMPOSE_FILE = '/compose/docker-compose.yml',
  MIN_REPLICAS = '2',
  MAX_REPLICAS = '6',
  SCALE_UP_CPU_THRESHOLD = '0.70',   // 70% of the container's CPU limit
  SCALE_DOWN_IDLE_CPU = '0.20',      // below 20% counts as idle
  SCALE_DOWN_IDLE_MS = '180000',     // 3 minutes
  SCALE_UP_COOLDOWN_MS = '60000',    // 1 min between any two scaling actions
  POLL_INTERVAL_MS = '10000',
  REDIS_HOST = '',
  REDIS_PORT = '6379',
  QUEUE_NAME = 'dealflow-requests',
} = process.env;

const MIN = Number(MIN_REPLICAS);
const MAX = Number(MAX_REPLICAS);
const UP_THRESHOLD = Number(SCALE_UP_CPU_THRESHOLD);
const IDLE_CPU = Number(SCALE_DOWN_IDLE_CPU);
const IDLE_MS = Number(SCALE_DOWN_IDLE_MS);
const COOLDOWN_MS = Number(SCALE_UP_COOLDOWN_MS);
const POLL_MS = Number(POLL_INTERVAL_MS);

const log = (...args) => console.log(new Date().toISOString(), '[autoscaler]', ...args);

// ---------------------------------------------------------------------------
// Docker API over the unix socket
// ---------------------------------------------------------------------------
function dockerReq(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: DOCKER_SOCKET, path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('docker socket timeout')));
    req.end();
  });
}

async function listBackendContainers() {
  const filter = JSON.stringify({ label: [`com.docker.compose.service=${BACKEND_SERVICE}`] });
  const { status, body } = await dockerReq(`/containers/json?filters=${encodeURIComponent(filter)}`);
  if (status !== 200) throw new Error(`docker list failed: ${status}`);
  const containers = (body || []).filter((c) => !COMPOSE_PROJECT || c.Labels?.['com.docker.compose.project'] === COMPOSE_PROJECT);
  // Auto-discover the compose project from the running containers — required
  // so `docker compose up --scale` targets the SAME project instead of
  // creating a parallel one.
  if (containers.length > 0 && !discoveredProject) {
    discoveredProject = containers[0].Labels?.['com.docker.compose.project'] || '';
    if (discoveredProject) log(`discovered compose project: ${discoveredProject}`);
  }
  return containers;
}

let discoveredProject = COMPOSE_PROJECT;

async function containerUtilization(id) {
  const { status, body } = await dockerReq(`/containers/${id}/stats?stream=false&one-shot=false`);
  if (status !== 200) throw new Error(`docker stats failed: ${status}`);
  const cpuDelta = body.cpu_stats.cpu_usage.total_usage - body.precpu_stats.cpu_usage.total_usage;
  const systemDelta = body.cpu_stats.system_cpu_usage - body.precpu_stats.system_cpu_usage;
  const onlineCpus = body.cpu_stats.online_cpus || 1;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;
  const limitCores = body.host_config?.nano_cpus > 0 ? body.host_config.nano_cpus / 1e9 : onlineCpus;
  return Math.min(cpuPercent / (limitCores * 100), 2); // utilization ratio vs limit
}

// ---------------------------------------------------------------------------
// Optional BullMQ depth check (secondary scale signal)
// ---------------------------------------------------------------------------
let redis = null;
function getRedis() {
  if (!REDIS_HOST) return null;
  if (!redis) {
    redis = new Redis({ host: REDIS_HOST, port: Number(REDIS_PORT), lazyConnect: true, maxRetriesPerRequest: 1 });
    redis.on('error', () => {});
  }
  return redis;
}

async function queueWaitingCount() {
  const client = getRedis();
  if (!client) return 0;
  try {
    if (client.status !== 'ready') await client.connect().catch(() => {});
    return await client.zcard(`bull:${QUEUE_NAME}:waiting`);
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Scaling
// ---------------------------------------------------------------------------
let scaling = false;
let cooldownUntil = 0;
let idleSince = null;

function composeScale(desired) {
  const args = ['compose'];
  const project = discoveredProject || COMPOSE_PROJECT;
  if (project) args.push('-p', project);
  // --no-build: the watcher has no build contexts mounted; images already exist.
  // --no-deps: never touch mysql/redis/seed services when scaling.
  args.push('up', '-d', '--no-deps', '--no-build', '--scale', `${BACKEND_SERVICE}=${desired}`, BACKEND_SERVICE);
  return new Promise((resolve, reject) => {
    execFile('docker', args, {
      env: { ...process.env, COMPOSE_FILE },
      timeout: 120000,
    }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(stdout);
    });
  });
}

async function applyScale(desired) {
  scaling = true;
  try {
    log(`scaling ${BACKEND_SERVICE} -> ${desired} replicas...`);
    const out = await composeScale(desired);
    log(out.trim().split('\n').slice(-3).join(' | '));
    log(`now running ${desired} replica(s)`);
    cooldownUntil = Date.now() + COOLDOWN_MS;
  } finally {
    scaling = false;
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
async function tick() {
  if (scaling || Date.now() < cooldownUntil) return;

  const containers = await listBackendContainers();
  const replicas = containers.length;
  if (replicas === 0) {
    idleSince = null;
    return; // stack not up yet
  }

  const utils = [];
  for (const c of containers) {
    try {
      utils.push(await containerUtilization(c.Id));
    } catch (error) {
      log(`warn: stats for ${c.Id.slice(0, 12)} failed: ${error.message}`);
    }
  }
  if (!utils.length) return;

  const maxUtil = Math.max(...utils);
  const avgUtil = utils.reduce((a, b) => a + b, 0) / utils.length;
  const waiting = await queueWaitingCount();

  log(`replicas=${replicas} cpu(max=${(maxUtil * 100).toFixed(0)}% avg=${(avgUtil * 100).toFixed(0)}%) queueWaiting=${waiting}`);

  // --- Scale UP: any replica at/over the 70% capability line, or a real
  // --- backlog in the request queue.
  const busy = maxUtil >= UP_THRESHOLD || waiting >= 25;
  if (busy && replicas < MAX) {
    idleSince = null;
    await applyScale(Math.min(replicas + 1, MAX));
    return;
  }
  if (busy) {
    idleSince = null;
    log('at MAX_REPLICAS — holding');
    return;
  }

  // --- Scale DOWN: every replica idle (cpu + queue) for 3 straight minutes.
  const allIdle = maxUtil < IDLE_CPU && waiting === 0;
  if (!allIdle) {
    idleSince = null;
    return;
  }
  idleSince = idleSince ?? Date.now();
  const idleFor = Date.now() - idleSince;
  if (idleFor >= IDLE_MS && replicas > MIN) {
    await applyScale(Math.max(replicas - 1, MIN));
    idleSince = Date.now(); // restart the idle window for the next step-down
    return;
  }
  if (replicas > MIN) {
    log(`idle for ${(idleFor / 1000).toFixed(0)}s / ${IDLE_MS / 1000}s — waiting before scale-down`);
  }
}

async function loop() {
  log(`started: service=${BACKEND_SERVICE} min=${MIN} max=${MAX} scaleUp@${UP_THRESHOLD * 100}% idleDown<${IDLE_CPU * 100}% after ${IDLE_MS / 1000}s`);
  for (;;) {
    try {
      await tick();
    } catch (error) {
      log(`error: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

process.on('SIGTERM', () => {
  log('SIGTERM — exiting');
  redis?.disconnect();
  process.exit(0);
});

loop();
