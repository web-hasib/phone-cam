/**
 * Pure JavaScript Debian (.deb) Package Builder for PhoneCam Studio
 * Generates 100% standards-compliant Debian .deb packages with exact POSIX root permissions.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const PKG_NAME = 'phonecam-studio';
const VERSION = '2.0.0';
const ARCH = 'amd64';
const OUTPUT_DEB = path.join(__dirname, 'dist', `${PKG_NAME}_${VERSION}_${ARCH}.deb`);
const LINUX_UNPACKED_DIR = path.join(__dirname, 'dist', 'linux-unpacked');

if (!fs.existsSync(LINUX_UNPACKED_DIR)) {
  console.error('[Build-Deb] Error: dist/linux-unpacked directory not found. Please build linux binaries first.');
  process.exit(1);
}

/**
 * Creates Unix AR Archive entry header (60 bytes)
 */
function createArHeader(filename, size, mode = 0o100644) {
  const buf = Buffer.alloc(60, 0x20); // space-filled
  const now = Math.floor(Date.now() / 1000);
  
  // Filename (16 bytes, slash-terminated for GNU/Debian ar)
  const nameStr = (filename + '/').padEnd(16, ' ');
  buf.write(nameStr, 0, 16, 'ascii');
  
  // Timestamp (12 bytes)
  buf.write(String(now).padEnd(12, ' '), 16, 12, 'ascii');
  
  // Owner ID (6 bytes)
  buf.write('0'.padEnd(6, ' '), 28, 6, 'ascii');
  
  // Group ID (6 bytes)
  buf.write('0'.padEnd(6, ' '), 34, 6, 'ascii');
  
  // File Mode (8 bytes, octal)
  buf.write(mode.toString(8).padStart(6, '0').padEnd(8, ' '), 40, 8, 'ascii');
  
  // File Size (10 bytes)
  buf.write(String(size).padEnd(10, ' '), 48, 10, 'ascii');
  
  // Magic ending (2 bytes: `\n)
  buf.write('`\n', 58, 2, 'ascii');
  
  return buf;
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function createControlTarGz() {
  console.log('[Build-Deb] Creating control.tar.gz with POSIX root metadata...');
  const archive = archiver('tar', { gzip: true, gzipOptions: { level: 9 } });

  const controlContent = [
    `Package: ${PKG_NAME}`,
    `Version: ${VERSION}`,
    `Section: video`,
    `Priority: optional`,
    `Architecture: ${ARCH}`,
    `Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0`,
    `Installed-Size: 240000`,
    `Maintainer: PhoneCam <support@phonecam.app>`,
    `Homepage: https://cam-backend-4bdx.onrender.com`,
    `Description: PhoneCam Studio - Wireless Pro HD Webcam Receiver`,
    ` Turn your smartphone into a wireless pro HD webcam with ultra-low latency.`
  ].join('\n') + '\n';

  archive.append(controlContent, { 
    name: './control', 
    mode: 0o644,
    uid: 0,
    gid: 0,
    uname: 'root',
    gname: 'root'
  });

  // Postinst script
  const postinstContent = [
    '#!/bin/sh',
    'set -e',
    'chmod 4755 "/opt/phonecam-studio/chrome-sandbox" 2>/dev/null || true',
    'update-desktop-database -q 2>/dev/null || true',
    'exit 0'
  ].join('\n') + '\n';

  archive.append(postinstContent, { 
    name: './postinst', 
    mode: 0o755,
    uid: 0,
    gid: 0,
    uname: 'root',
    gname: 'root'
  });

  // Prerm script
  const prermContent = [
    '#!/bin/sh',
    'set -e',
    'exit 0'
  ].join('\n') + '\n';

  archive.append(prermContent, { 
    name: './prerm', 
    mode: 0o755,
    uid: 0,
    gid: 0,
    uname: 'root',
    gname: 'root'
  });

  archive.finalize();
  return await streamToBuffer(archive);
}

function addDirectoryRecursive(archive, sourceDir, targetPrefix) {
  const items = fs.readdirSync(sourceDir);

  for (const item of items) {
    const fullPath = path.join(sourceDir, item);
    const targetPath = `${targetPrefix}/${item}`;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Add directory entry with 0755
      archive.append(Buffer.alloc(0), {
        name: targetPath + '/',
        mode: 0o755,
        stats: stat,
        uid: 0,
        gid: 0,
        uname: 'root',
        gname: 'root'
      });
      addDirectoryRecursive(archive, fullPath, targetPath);
    } else {
      let fileMode = 0o644;
      const isExecutable = 
        item === 'phonecam-desktop' ||
        item === 'chrome-sandbox' ||
        item === 'chrome_crashpad_handler' ||
        item.endsWith('.so') ||
        item.includes('.so.');

      if (isExecutable) {
        fileMode = item === 'chrome-sandbox' ? 0o4755 : 0o755;
      }

      archive.file(fullPath, {
        name: targetPath,
        mode: fileMode,
        uid: 0,
        gid: 0,
        uname: 'root',
        gname: 'root'
      });
    }
  }
}

async function createDataTarGz() {
  console.log('[Build-Deb] Creating data.tar.gz with proper Debian directory hierarchy...');
  const archive = archiver('tar', { gzip: true, gzipOptions: { level: 6 } });

  // 1. Explicit directory structure headers
  const rootDirs = [
    './opt/',
    `./opt/${PKG_NAME}/`,
    './usr/',
    './usr/bin/',
    './usr/share/',
    './usr/share/applications/',
    './usr/share/icons/',
    './usr/share/icons/hicolor/',
    './usr/share/icons/hicolor/scalable/',
    './usr/share/icons/hicolor/scalable/apps/'
  ];

  for (const dir of rootDirs) {
    archive.append(Buffer.alloc(0), {
      name: dir,
      mode: 0o755,
      uid: 0,
      gid: 0,
      uname: 'root',
      gname: 'root'
    });
  }

  // 2. Add all application files in ./opt/phonecam-studio/
  addDirectoryRecursive(archive, LINUX_UNPACKED_DIR, `./opt/${PKG_NAME}`);

  // 3. Add /usr/bin launcher script
  const binLauncher = [
    '#!/bin/sh',
    `exec "/opt/${PKG_NAME}/phonecam-desktop" "$@"`
  ].join('\n') + '\n';
  archive.append(binLauncher, { 
    name: `./usr/bin/${PKG_NAME}`, 
    mode: 0o755,
    uid: 0,
    gid: 0,
    uname: 'root',
    gname: 'root'
  });

  // 4. Add desktop entry in /usr/share/applications
  const desktopEntry = [
    '[Desktop Entry]',
    'Name=PhoneCam Studio',
    'Comment=PhoneCam Desktop Studio - Wireless Pro HD Webcam Receiver',
    `Exec="/opt/${PKG_NAME}/phonecam-desktop" %U`,
    'Icon=phonecam-studio',
    'Type=Application',
    'StartupNotify=true',
    'Categories=AudioVideo;Video;AudioVideoEditing;',
    'Terminal=false'
  ].join('\n') + '\n';
  archive.append(desktopEntry, { 
    name: `./usr/share/applications/${PKG_NAME}.desktop`, 
    mode: 0o644,
    uid: 0,
    gid: 0,
    uname: 'root',
    gname: 'root'
  });

  // 5. Add icon if exists
  const iconSource = path.join(__dirname, '..', 'backend', 'public', 'icons', 'icon-512.svg');
  if (fs.existsSync(iconSource)) {
    archive.file(iconSource, { 
      name: `./usr/share/icons/hicolor/scalable/apps/${PKG_NAME}.svg`, 
      mode: 0o644,
      uid: 0,
      gid: 0,
      uname: 'root',
      gname: 'root'
    });
  }

  archive.finalize();
  return await streamToBuffer(archive);
}

async function buildDebianPackage() {
  console.log(`[Build-Deb] Packaging standards-compliant ${PKG_NAME}_${VERSION}_${ARCH}.deb...`);
  
  const debianBinary = Buffer.from('2.0\n', 'ascii');
  const controlTarGz = await createControlTarGz();
  const dataTarGz = await createDataTarGz();

  console.log(`[Build-Deb] Binary Payload Size: ${(dataTarGz.length / 1024 / 1024).toFixed(1)} MB`);
  console.log('[Build-Deb] Assembling Unix AR archive (.deb)...');

  const arMagic = Buffer.from('!<arch>\n', 'ascii');
  
  // Entry 1: debian-binary
  const header1 = createArHeader('debian-binary', debianBinary.length);
  const pad1 = (debianBinary.length % 2 !== 0) ? Buffer.from('\n') : Buffer.alloc(0);

  // Entry 2: control.tar.gz
  const header2 = createArHeader('control.tar.gz', controlTarGz.length);
  const pad2 = (controlTarGz.length % 2 !== 0) ? Buffer.from('\n') : Buffer.alloc(0);

  // Entry 3: data.tar.gz
  const header3 = createArHeader('data.tar.gz', dataTarGz.length);
  const pad3 = (dataTarGz.length % 2 !== 0) ? Buffer.from('\n') : Buffer.alloc(0);

  const debBuffer = Buffer.concat([
    arMagic,
    header1, debianBinary, pad1,
    header2, controlTarGz, pad2,
    header3, dataTarGz, pad3
  ]);

  fs.writeFileSync(OUTPUT_DEB, debBuffer);
  console.log(`=======================================================`);
  console.log(`✅ [SUCCESS] Debian Package Generated Successfully!`);
  console.log(`📦 File: ${OUTPUT_DEB}`);
  console.log(`📊 Size: ${(debBuffer.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`=======================================================`);
}

buildDebianPackage().catch(err => {
  console.error('[Build-Deb] Fatal error:', err);
  process.exit(1);
});
