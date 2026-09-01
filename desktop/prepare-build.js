const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Copy SVG to build directory
const svgSource = path.join(__dirname, '..', 'backend', 'public', 'icons', 'icon-512.svg');
if (fs.existsSync(svgSource)) {
  fs.copyFileSync(svgSource, path.join(buildDir, 'icon.svg'));
}

console.log('Build directory prepared.');
