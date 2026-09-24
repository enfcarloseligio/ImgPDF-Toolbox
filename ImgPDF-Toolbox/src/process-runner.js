const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Estado compartido de procesos ────────────────────────────────────────────

let currentProcess = null;
let isCancelled = false;

function resetCancelled() { isCancelled = false; }
function getIsCancelled() { return isCancelled; }
function setCancelled(v)  { isCancelled = v; }

/**
 * Registra un proceso como "el actual" para que killCurrentProcess
 * pueda alcanzarlo con taskkill /T /F.
 */
function registerProcess(proc) {
  currentProcess = proc;
}

/**
 * Limpia el proceso actual solo si coincide con el que se pasa.
 * Evita pisar a otro proceso registrado después.
 */
function clearProcess(proc) {
  if (currentProcess === proc) currentProcess = null;
}

// ── run — exec con encoding tolerante ────────────────────────────────────────

function run(cmd) {
  return new Promise((resolve, reject) => {
    currentProcess = exec(cmd, {
      maxBuffer: 1024 * 1024 * 50,
      encoding: 'buffer'
    }, (error, stdout, stderr) => {
      currentProcess = null;
      if (error) {
        if (isCancelled) return reject('Operación cancelada por el usuario.');
        const rawErr = (stderr && stderr.length)
          ? stderr
          : (error.message ? Buffer.from(error.message) : Buffer.from(''));
        let decoded = '';
        try {
          decoded = new TextDecoder('utf-8', { fatal: true }).decode(rawErr);
        } catch (_) {
          decoded = new TextDecoder('windows-1252').decode(rawErr);
        }
        reject(decoded.trim());
      } else {
        let decoded = '';
        try {
          decoded = new TextDecoder('utf-8', { fatal: true }).decode(stdout);
        } catch (_) {
          decoded = new TextDecoder('windows-1252').decode(stdout);
        }
        resolve(decoded.trim());
      }
    });
  });
}

// ── runSpawn — ejecución con streaming, sin límite de buffer ─────────────────

function runSpawn(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const cleanBin = bin.replace(/^"|"$/g, '');
    const proc = spawn(cleanBin, args, { windowsHide: true });
    currentProcess = proc;

    let stdout = '';
    let stderr = '';
    let stderrBuffer = '';
    let stdoutBytes = 0;

    const MAX_STDOUT = opts.maxStdout ?? (1024 * 1024);

    proc.stdout.on('data', chunk => {
      stdoutBytes += chunk.length;
      if (MAX_STDOUT === 0) return;
      if (stdoutBytes > MAX_STDOUT) {
        if (stdout && !stdout.endsWith('[... truncado ...]')) {
          stdout += '\n[... salida truncada ...]';
        }
        return;
      }
      stdout += chunk.toString('utf8');
    });

    proc.stderr.on('data', chunk => {
      const text = chunk.toString('utf8');
      stderr += text;
      stderrBuffer += text;
      if (opts.onStderr) {
        const lines = stderrBuffer.split(/\r?\n/);
        stderrBuffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) opts.onStderr(line.trim());
        }
      }
    });

    proc.on('error', err => {
      currentProcess = null;
      if (isCancelled) return reject('Operación cancelada por el usuario.');
      reject(err.message || String(err));
    });

    proc.on('close', code => {
      currentProcess = null;

      if (opts.onStderr && stderrBuffer.trim()) {
        opts.onStderr(stderrBuffer.trim());
      }

      if (isCancelled) return reject('Operación cancelada por el usuario.');
      if (code !== 0) {
        const msg = stderr.trim() || `Proceso terminó con código ${code}`;
        return reject(msg);
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

// ── Cancelación ──────────────────────────────────────────────────────────────

function killCurrentProcess() {
  if (!currentProcess) return;
  const pid = currentProcess.pid;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
    } else {
      currentProcess.kill('SIGTERM');
    }
  } catch (_) {}
  currentProcess = null;
}

function cancelCurrentOperation() {
  isCancelled = true;
  killCurrentProcess();
}

// ── Utilidades de sistema ────────────────────────────────────────────────────

function findGhostscript() {
  const pfDirs = ['C:\\Program Files\\gs', 'C:\\Program Files (x86)\\gs'];
  for (const base of pfDirs) {
    if (!fs.existsSync(base)) continue;
    for (const sub of fs.readdirSync(base)) {
      const p64 = path.join(base, sub, 'bin', 'gswin64c.exe');
      const p32 = path.join(base, sub, 'bin', 'gswin32c.exe');
      if (fs.existsSync(p64)) return `"${p64}"`;
      if (fs.existsSync(p32)) return `"${p32}"`;
    }
  }
  return 'gswin64c';
}

function getUniqueFilePath(targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const dir  = path.dirname(targetPath);
  const ext  = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let counter = 1, candidate;
  do { candidate = path.join(dir, `${base} (${counter++})${ext}`); }
  while (fs.existsSync(candidate));
  return candidate;
}

async function wingetAvailable() {
  try { await run('winget --version'); return true; }
  catch (_) { return false; }
}

module.exports = {
  run,
  runSpawn,
  registerProcess,
  clearProcess,
  killCurrentProcess,
  cancelCurrentOperation,
  resetCancelled,
  getIsCancelled,
  setCancelled,
  findGhostscript,
  getUniqueFilePath,
  wingetAvailable,
};