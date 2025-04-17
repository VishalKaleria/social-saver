import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// For ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BinaryManager {
  private ytdlpPath: string;
  private ffmpegPath: string;

  constructor() {
    this.ytdlpPath = this.getYtDlpPath();
    this.ffmpegPath = this.getFFmpegPath();
  }

  /**
   * Gets the base path for binaries based on the environment
   */
  private getBinariesBasePath(): string {
    const appPath = app.getAppPath();
    const isProduction = app.isPackaged;
    
    if (isProduction) {
      // In production, use the binary from unpacked resources
      return path.join(process.resourcesPath, 'resources', 'binaries');
    } else {
      // In development, use the binary from the resources folder
      return path.join(appPath, 'resources', 'binaries');
    }
  }

  /**
   * Gets the path to the yt-dlp binary
   */
  public getYtDlpPath(): string {
    const isWin = process.platform === 'win32';
    const binPath = path.join(this.getBinariesBasePath(), isWin ? 'yt-dlp.exe' : 'yt-dlp');

    // Verify the binary exists
    if (!fs.existsSync(binPath)) {
      console.error(`yt-dlp binary not found at ${binPath}`);
      throw new Error(`yt-dlp binary not found at ${binPath}`);
    }

    console.log(`Using yt-dlp binary at: ${binPath}`);
    return `"${binPath}"`; // for child_process.exec
  }

  /**
   * Gets the path to the FFmpeg binary
   */
  public getFFmpegPath(): string {
    const isWin = process.platform === 'win32';
    const binPath = path.join(this.getBinariesBasePath(), isWin ? 'ffmpeg.exe' : 'ffmpeg');

    // Verify the binary exists
    if (!fs.existsSync(binPath)) {
      console.error(`FFmpeg binary not found at ${binPath}`);
      throw new Error(`FFmpeg binary not found at ${binPath}`);
    }

    console.log(`Using FFmpeg binary at: ${binPath}`);
    return binPath;
  }

  /**
   * Gets all binary paths
   */
  public getBinaryPaths() {
    return {
      ytdlp: this.ytdlpPath,
      ffmpeg: this.ffmpegPath
    };
  }
}

// Export a singleton instance
export default new BinaryManager();