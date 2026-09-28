const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

let ffmpegPath = 'ffmpeg';
try { ffmpegPath = require('ffmpeg-static') || 'ffmpeg'; } catch (_) {}

function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 6) return '••••••';
  return `${s.slice(0, 3)}••••••${s.slice(-3)}`;
}

function normalizeDestination(input) {
  const type = ['youtube', 'twitch', 'instagram', 'facebook', 'rtmp'].includes(String(input?.type)) ? String(input.type) : 'rtmp';
  const id = String(input?.id || crypto.randomUUID());
  const name = String(input?.name || (type === 'youtube' ? 'YouTube' : type === 'twitch' ? 'Twitch' : type === 'instagram' ? 'Instagram' : type === 'facebook' ? 'Facebook' : 'Outro RTMP')).trim().slice(0, 80);
  const url = String(input?.url || '').trim();
  const key = String(input?.key || '').trim();
  if (!url || !key) throw new Error(`Preencha a URL e a chave de ${name}.`);
  if (!/^rtmps?:\/\//i.test(url)) throw new Error(`A URL de ${name} precisa começar com rtmp:// ou rtmps://.`);
  return { id, type, name, url, key, enabled: input?.enabled !== false, updatedAt: Date.now() };
}

function publicDestinations(destinations) {
  return (Array.isArray(destinations) ? destinations : []).map(d => ({
    id: d.id, type: d.type, name: d.name, url: d.url, enabled: d.enabled !== false,
    keyConfigured: Boolean(d.key), keyMasked: maskSecret(d.key)
  }));
}

function getDestinations(database, ownerId) {
  database.multistreamDestinations = database.multistreamDestinations || {};
  return Array.isArray(database.multistreamDestinations[String(ownerId)]) ? database.multistreamDestinations[String(ownerId)] : [];
}

function setDestinations(database, ownerId, destinations) {
  database.multistreamDestinations = database.multistreamDestinations || {};
  database.multistreamDestinations[String(ownerId)] = destinations;
}

function buildRtmpUrl(destination) {
  return `${String(destination.url).replace(/\/+$/, '')}/${encodeURIComponent(String(destination.key))}`;
}

function startEncoder(destinations, onLog) {
  const usable = destinations.filter(d => d && d.enabled !== false && d.url && d.key);
  if (!usable.length) return null;
  const outputs = usable.map(d => `[f=flv:onfail=ignore]${buildRtmpUrl(d)}`).join('|');
  const args = [
    '-hide_banner', '-loglevel', 'warning',
    '-fflags', '+genpts',
    '-f', 'webm', '-i', 'pipe:0',
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-f', 'tee', outputs
  ];
  const child = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  child.stderr.on('data', chunk => onLog?.(String(chunk)));
  child.on('error', error => onLog?.(`FFmpeg error: ${error.message}`));
  return child;
}

function websocketAccept(key) {
  return crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
}

function encodeWsFrame(payload, opcode = 2) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (body.length < 126) header = Buffer.from([0x80 | opcode, body.length]);
  else if (body.length < 65536) {
    header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  return Buffer.concat([header, body]);
}

function attachMultistreamWebSocket(socket, request, live, ownerId, selectedIds) {
  const accept = websocketAccept(request.headers['sec-websocket-key'] || '');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket', 'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`, '\r\n'
  ].join('\r\n'));

  const database = live.database;
  const all = getDestinations(database, ownerId);
  const selected = (selectedIds?.length ? all.filter(d => selectedIds.includes(String(d.id))) : all.filter(d => d.enabled !== false));
  const encoder = startEncoder(selected, msg => {
    live.multistreamLastError = msg.slice(-500);
    if (/error|failed|invalid|could not|connection/i.test(msg)) {
      try { socket.write(encodeWsFrame(JSON.stringify({ type: 'status', status: 'error', message: msg.slice(-400) }), 1)); } catch (_) {}
    }
  });
  live.multistreamSocket = socket;
  live.multistreamEncoder = encoder;
  live.multistreamDestinations = selected.map(d => d.name);
  live.multistreamStatus = encoder ? 'connecting' : 'disabled';
  live.multistreamLastError = '';

  if (!encoder) {
    socket.write(encodeWsFrame(JSON.stringify({ type: 'status', status: 'disabled', message: 'Nenhum destino multistream configurado.' }), 1));
  } else {
    socket.write(encodeWsFrame(JSON.stringify({ type: 'status', status: 'starting', destinations: selected.map(d => d.name) }), 1));
  }

  let buffer = Buffer.alloc(0);
  const close = () => {
    try { encoder?.stdin.end(); } catch (_) {}
    try { encoder?.kill('SIGTERM'); } catch (_) {}
    if (live.multistreamSocket === socket) live.multistreamSocket = null;
    if (live.multistreamEncoder === encoder) live.multistreamEncoder = null;
    live.multistreamStatus = 'stopped';
  };
  socket.on('close', close);
  socket.on('error', close);
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const b1 = buffer[0], b2 = buffer[1];
      let offset = 2;
      let length = b2 & 0x7f;
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (buffer.length < 10) return; const n = Number(buffer.readBigUInt64BE(2)); if (!Number.isSafeInteger(n)) return close(); length = n; offset = 10; }
      const masked = Boolean(b2 & 0x80);
      if (!masked) return close();
      if (buffer.length < offset + 4 + length) return;
      const mask = buffer.subarray(offset, offset + 4); offset += 4;
      const payload = Buffer.from(buffer.subarray(offset, offset + length));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      buffer = buffer.subarray(offset + length);
      const opcode = b1 & 0x0f;
      if (opcode === 0x8) return close();
      if (opcode === 0x9) { try { socket.write(encodeWsFrame(payload, 0xA)); } catch (_) {} continue; }
      if (opcode === 0x2 && encoder?.stdin?.writable && payload.length) {
        if (!encoder.stdin.write(payload)) { /* backpressure handled by ffmpeg pipe */ }
      }
    }
  });
  return { selected, encoder };
}

module.exports = { publicDestinations, getDestinations, setDestinations, normalizeDestination, attachMultistreamWebSocket, maskSecret };
