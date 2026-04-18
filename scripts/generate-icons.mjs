import sharp from 'sharp';

const SIZE = 1024;
const ADAPTIVE_SIZE = 1024;

// Carrefour Market rose-red palette
const RED = '#E3001B';
const RED_DARK = '#B8001A';
const WHITE = '#FFFFFF';

function createMainIcon() {
  return Buffer.from(`
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${RED};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${RED_DARK};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#00000033"/>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="${SIZE}" height="${SIZE}" rx="220" fill="url(#bg)"/>

      <!-- Calendar icon body -->
      <rect x="240" y="300" width="544" height="460" rx="48" fill="${WHITE}" opacity="0.95"/>

      <!-- Calendar top bar -->
      <rect x="240" y="300" width="544" height="120" rx="48" fill="${WHITE}"/>
      <rect x="240" y="370" width="544" height="50" fill="${WHITE}"/>

      <!-- Calendar hooks -->
      <rect x="380" y="250" width="40" height="100" rx="20" fill="${WHITE}"/>
      <rect x="604" y="250" width="40" height="100" rx="20" fill="${WHITE}"/>

      <!-- DLC text -->
      <text x="512" y="600" font-family="Arial, Helvetica, sans-serif" font-size="200" font-weight="900" fill="${RED}" text-anchor="middle" dominant-baseline="middle">DLC</text>

      <!-- Small clock indicator -->
      <circle cx="512" cy="710" r="30" fill="none" stroke="${RED}" stroke-width="8"/>
      <line x1="512" y1="695" x2="512" y2="710" stroke="${RED}" stroke-width="8" stroke-linecap="round"/>
      <line x1="512" y1="710" x2="525" y2="718" stroke="${RED}" stroke-width="8" stroke-linecap="round"/>
    </svg>
  `);
}

function createAdaptiveIcon() {
  // Adaptive icon needs more padding (safe zone is inner 66%)
  return Buffer.from(`
    <svg width="${ADAPTIVE_SIZE}" height="${ADAPTIVE_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${RED};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${RED_DARK};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${ADAPTIVE_SIZE}" height="${ADAPTIVE_SIZE}" fill="url(#bg)"/>

      <!-- Calendar icon body -->
      <rect x="300" y="350" width="424" height="370" rx="40" fill="${WHITE}" opacity="0.95"/>

      <!-- Calendar top bar -->
      <rect x="300" y="350" width="424" height="100" rx="40" fill="${WHITE}"/>
      <rect x="300" y="410" width="424" height="40" fill="${WHITE}"/>

      <!-- Calendar hooks -->
      <rect x="410" y="310" width="32" height="80" rx="16" fill="${WHITE}"/>
      <rect x="582" y="310" width="32" height="80" rx="16" fill="${WHITE}"/>

      <!-- DLC text -->
      <text x="512" y="590" font-family="Arial, Helvetica, sans-serif" font-size="160" font-weight="900" fill="${RED}" text-anchor="middle" dominant-baseline="middle">DLC</text>

      <!-- Clock -->
      <circle cx="512" cy="680" r="24" fill="none" stroke="${RED}" stroke-width="6"/>
      <line x1="512" y1="668" x2="512" y2="680" stroke="${RED}" stroke-width="6" stroke-linecap="round"/>
      <line x1="512" y1="680" x2="522" y2="686" stroke="${RED}" stroke-width="6" stroke-linecap="round"/>
    </svg>
  `);
}

function createSplashIcon() {
  return Buffer.from(`
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${RED};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${RED_DARK};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Calendar icon body -->
      <rect x="80" y="130" width="352" height="290" rx="32" fill="${RED}" opacity="0.95"/>

      <!-- Calendar top bar -->
      <rect x="80" y="130" width="352" height="80" rx="32" fill="${RED}"/>
      <rect x="80" y="185" width="352" height="25" fill="${RED}"/>

      <!-- Calendar hooks -->
      <rect x="170" y="95" width="28" height="70" rx="14" fill="${RED}"/>
      <rect x="314" y="95" width="28" height="70" rx="14" fill="${RED}"/>

      <!-- DLC text -->
      <text x="256" y="330" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="900" fill="${WHITE}" text-anchor="middle" dominant-baseline="middle">DLC</text>

      <!-- Clock -->
      <circle cx="256" cy="400" r="20" fill="none" stroke="${WHITE}" stroke-width="5"/>
      <line x1="256" y1="390" x2="256" y2="400" stroke="${WHITE}" stroke-width="5" stroke-linecap="round"/>
      <line x1="256" y1="400" x2="264" y2="406" stroke="${WHITE}" stroke-width="5" stroke-linecap="round"/>
    </svg>
  `);
}

async function generate() {
  // App icon (1024x1024)
  await sharp(createMainIcon())
    .resize(1024, 1024)
    .png()
    .toFile('assets/icon.png');
  console.log('icon.png generated');

  // Adaptive icon foreground for Android
  await sharp(createAdaptiveIcon())
    .resize(1024, 1024)
    .png()
    .toFile('assets/adaptive-icon.png');
  console.log('adaptive-icon.png generated');

  // Splash icon
  await sharp(createSplashIcon())
    .resize(512, 512)
    .png()
    .toFile('assets/splash-icon.png');
  console.log('splash-icon.png generated');

  // Favicon
  await sharp(createMainIcon())
    .resize(48, 48)
    .png()
    .toFile('assets/favicon.png');
  console.log('favicon.png generated');
}

generate().catch(console.error);
