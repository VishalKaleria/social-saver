import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { platform, arch } from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourceDir = path.resolve(__dirname, '../../resources/binaries');

// Create resources directory if it doesn't exist
if (!fs.existsSync(resourceDir)) {
  fs.mkdirSync(resourceDir, { recursive: true });
}

// Define platform and architecture
const currentPlatform = platform();
const currentArch = arch();
const isWin = currentPlatform === 'win32';
const isMac = currentPlatform === 'darwin';
const isLinux = !isWin && !isMac;

// Map Node.js arch to identifiers used in the release files
const getFFmpegIdentifier = () => {
  let platformId = currentPlatform;
  
  // For macOS, the release uses 'darwin'
  if (isMac) {
    platformId = 'darwin';
  }
  
  // For Windows, the release uses 'win32'
  if (isWin) {
    platformId = 'win32';
  }
  
  // Map architecture
  let archId;
  switch (currentArch) {
    case 'x64':
      archId = 'x64';
      break;
    case 'ia32':
      archId = 'ia32';
      break;
    case 'arm':
      archId = 'arm';
      break;
    case 'arm64':
      archId = 'arm64';
      break;
    default:
      archId = 'x64'; // Default to x64 if unknown
  }
  
  const identifier = `${platformId}-${archId}`;
  console.log(`Using FFmpeg identifier: ${identifier}`);
  return identifier;
};

// Get URLs for binaries
const ffmpegIdentifier = getFFmpegIdentifier();
const ffmpegReleasesUrl = 'https://github.com/w3vish/ffmpeg-installer/releases/download/v1.0.0';

// FFmpeg URL
const ffmpegUrl = isWin 
  ? `${ffmpegReleasesUrl}/${ffmpegIdentifier}-ffmpeg.exe`
  : `${ffmpegReleasesUrl}/${ffmpegIdentifier}-ffmpeg`;

// yt-dlp URL
let ytdlpUrl;
if (isWin) {
  ytdlpUrl = currentArch === 'ia32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_x86.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
} else if (isMac) {
  ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
} else {
  // Linux
  if (currentArch === 'ia32') {
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  } else if (currentArch === 'arm') {
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux.arm';
  } else if (currentArch === 'arm64') {
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux.aarch64';
  } else {
    ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
  }
}

console.log(`Detected platform: ${currentPlatform}, architecture: ${currentArch}`);
console.log(`FFmpeg URL: ${ffmpegUrl}`);
console.log(`yt-dlp URL: ${ytdlpUrl}`);

// Function to download a file with redirect support
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} to ${destination}...`);
    
    const request = https.get(url, (response) => {
      // Handle redirects (status codes 301, 302, 307, 308)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`Following redirect to ${response.headers.location}`);
        // Call the function again with the new URL
        downloadFile(response.headers.location, destination)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${url} successfully.`);
        
        // Make the binary executable on non-Windows platforms
        if (!isWin) {
          fs.chmodSync(destination, '755');
          console.log(`Made ${destination} executable.`);
        }
        
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(destination, () => {}); // Delete the file if there's an error
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    // Set a timeout
    request.setTimeout(60000, () => {
      request.abort();
      reject(new Error(`Request timeout for ${url}`));
    });
  });
}

// Set up file names and destinations
const ytdlpFilename = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const ffmpegFilename = isWin ? 'ffmpeg.exe' : 'ffmpeg';

const ytdlpDestination = path.join(resourceDir, ytdlpFilename);
const ffmpegDestination = path.join(resourceDir, ffmpegFilename);

// Download all binaries
console.log('Starting binary downloads...');

Promise.all([
  downloadFile(ytdlpUrl, ytdlpDestination),
  downloadFile(ffmpegUrl, ffmpegDestination)
])
  .then(() => {
    console.log('All binaries downloaded successfully.');
  })
  .catch((err) => {
    console.error('Error downloading binaries:', err);
    process.exit(1);
  });