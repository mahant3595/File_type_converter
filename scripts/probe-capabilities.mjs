const out = {};
const ff = (await import('ffmpeg-static')).default;
const { execFileSync } = await import('node:child_process');
// 1) encoders
const enc = execFileSync(ff, ['-hide_banner', '-encoders'], { encoding: 'utf8', maxBuffer: 1e7 });
out.encoders = {
  libmp3lame: enc.includes('libmp3lame'),
  aac: /\baac\b/.test(enc),
  libvpx_vp9: enc.includes('libvpx-vp9'),
  libvpx_vp8: enc.includes('libvpx-vp8'),
  libx264: enc.includes('libx264'),
  gif: /\bgif\b/.test(enc),
  flac: enc.includes('flac'),
  libopus: enc.includes('libopus'),
  png: /\bpng\b/.test(enc),
  libwebp: enc.includes('libwebp'),
  prores: enc.includes('prores'),
  mjpeg: enc.includes('mjpeg'),
};
const dec = execFileSync(ff, ['-hide_banner', '-decoders'], { encoding: 'utf8', maxBuffer: 1e7 });
out.decoders = { hevc: dec.includes('hevc'), h264: dec.includes('h264'), vp9: dec.includes('vp9'), mpeg4: dec.includes('mpeg4'), mjpeg: dec.includes('mjpeg') };
// 2) ffmpeg real conversion: testsrc mp4 -> mp3, webm, gif
try {
  execFileSync(ff, ['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc=duration=1:size=160x120:rate=10','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y','/tmp/probe.mp4']);
  out.makeMp4 = 'OK';
  execFileSync(ff, ['-hide_banner','-loglevel','error','-i','/tmp/probe.mp4','-vn','-c:a','libmp3lame','-q:a','4','-y','/tmp/probe.mp3']);
  out.mp4ToMp3 = 'OK';
  execFileSync(ff, ['-hide_banner','-loglevel','error','-i','/tmp/probe.mp4','-c:v','libvpx-vp9','-b:a','64k','-deadline','realtime','-cpu-used','8','-an','-y','/tmp/probe.webm']);
  out.mp4ToWebm = 'OK';
  execFileSync(ff, ['-hide_banner','-loglevel','error','-i','/tmp/probe.mp4','-vf','fps=8,scale=320:-1:flags=lanczos','-loop','0','-y','/tmp/probe.gif']);
  out.mp4ToGif = 'OK';
} catch (e) { out.ffmpegPipelineError = String(e.stderr || e).slice(0, 400); }
// wav generate for audio tests
try {
  execFileSync(ff, ['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=1','-y','/tmp/probe.wav']);
  execFileSync(ff, ['-hide_banner','-loglevel','error','-i','/tmp/probe.wav','-c:a','flac','-y','/tmp/probe.flac']);
  execFileSync(ff, ['-hide_banner','-loglevel','error','-i','/tmp/probe.wav','-c:a','libvorbis','-y','/tmp/probe.ogg']);
  out.wavToFlacOgg = 'OK';
} catch (e) { out.audioPipelineError = String(e.stderr || e).slice(0, 300); }
// 3) SheetJS ODS
const XLSX = await import('xlsx');
const ws = XLSX.utils.aoa_to_sheet([['a','b'],[1,2]]);
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'S');
out.odsWrite = 'unsupported';
try {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'ods' });
  out.odsWrite = buf.length > 100 ? 'OK(' + buf.length + ')' : 'tiny';
  const back = XLSX.read(buf);
  out.odsRead = XLSX.utils.sheet_to_json(back.Sheets[back.SheetNames[0]]).length === 1 ? 'OK' : 'rows-mismatch';
} catch (e) { out.odsError = String(e).slice(0, 200); }
// xls write/read
try {
  const xls = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' });
  out.xlsWrite = xls.length > 100 ? 'OK' : 'tiny';
  const rx = XLSX.read(xls);
  out.xlsRead = XLSX.utils.sheet_to_json(rx.Sheets[rx.SheetNames[0]]).length === 1 ? 'OK' : 'mismatch';
} catch (e) { out.xlsError = String(e).slice(0, 200); }
// 4) system libs for chromium (non-root check)
const fs = await import('node:fs');
const libDirs = ['/usr/lib/x86_64-linux-gnu', '/lib/x86_64-linux-gnu'];
const wanted = ['libnss3.so', 'libatk-1.0.so.0', 'libatk-bridge-2.0.so.0', 'libcups.so.2', 'libdrm.so.2', 'libgbm.so.1', 'libasound.so.2', 'libxkbcommon.so.0', 'libpango-1.0.so.0', 'libcairo.so.2'];
out.chromiumLibs = {};
for (const w of wanted) out.chromiumLibs[w] = libDirs.some(d => fs.existsSync(`${d}/${w}`));
console.log(JSON.stringify(out, null, 2));
