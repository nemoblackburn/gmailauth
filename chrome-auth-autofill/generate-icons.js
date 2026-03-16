#!/usr/bin/env node

/**
 * Simple icon generator for the Chrome extension
 * Creates basic placeholder icons if you don't have design tools
 *
 * Usage: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// SVG template for icons
function createSVG(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#1a73e8" rx="${size * 0.15}"/>

  <!-- Envelope -->
  <g transform="translate(${size * 0.2}, ${size * 0.25})">
    <!-- Envelope body -->
    <rect x="0" y="0" width="${size * 0.6}" height="${size * 0.42}"
          fill="none" stroke="white" stroke-width="${size * 0.05}" rx="${size * 0.03}"/>

    <!-- Envelope flap -->
    <path d="M 0,0 L ${size * 0.3},${size * 0.21} L ${size * 0.6},0"
          fill="none" stroke="white" stroke-width="${size * 0.05}"
          stroke-linejoin="round" stroke-linecap="round"/>

    <!-- Code symbol (123) -->
    <text x="${size * 0.3}" y="${size * 0.55}"
          font-family="Arial, sans-serif"
          font-size="${size * 0.15}"
          font-weight="bold"
          fill="white"
          text-anchor="middle">#</text>
  </g>
</svg>`;
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Generate SVG files (browsers can use SVG directly for development)
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const svg = createSVG(size);
  const filename = path.join(iconsDir, `icon${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`✓ Created ${filename}`);
});

console.log(`\n✓ Generated ${sizes.length} SVG icons in the icons/ folder`);
console.log('\nNote: Chrome extensions prefer PNG files.');
console.log('To convert SVG to PNG, you can:');
console.log('1. Open each SVG in a browser and take a screenshot');
console.log('2. Use an online converter like https://convertio.co/svg-png/');
console.log('3. Use ImageMagick: convert icon.svg icon.png');
console.log('\nOr just use these SVGs for now - they work for testing!');
console.log('\nFor production, replace with proper PNG icons.');
