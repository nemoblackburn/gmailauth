#!/usr/bin/env node

/**
 * Creates minimal PNG icons using base64 data URIs
 * These are simple blue squares - replace with better icons later
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG data (1x1 blue pixel) - we'll write this for each size
// A simple blue square PNG in base64
const bluePNG = {
  16: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAF0lEQVR42mNk+M9Qz0AEYBxVPqp8+JQDAHmFAQHj7XPRAAAAAElFTkSuQmCC',
  48: 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAWklEQVR42u3PQREAIBDEsJ/tEVjBD4eiADIz6dw7tzMhQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQOAfAWgMA8EmRCo8AAAAAElFTkSuQmCC',
  128: 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAA6UlEQVR42u3RAQ0AAAgDoL9/aBYCDVIaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4K8B8wUAAM5KgZ4AAAAASUVORK5CYII='
};

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

Object.entries(bluePNG).forEach(([size, base64]) => {
  const buffer = Buffer.from(base64, 'base64');
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`✓ Created ${filename}`);
});

console.log('\n✓ PNG icons created! Extension is ready to load.');
console.log('💡 Replace these with better icons later for production.');
