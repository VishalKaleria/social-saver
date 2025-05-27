# Social Saver: Your All-in-One Desktop Media Downloader

<p align="center">
  <strong>Effortlessly save videos, audio, playlists, and image galleries from your favorite websites directly to your desktop.</strong>
</p>

<p align="center">
  <img src="https://socialsaver.site/screenshots/social-saver-hero-overview.webp" alt="Social Saver Application Overview" style="width: 100%; max-width: 800px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
</p>

<p align="center">
  <a href="https://socialsaver.site/download" title="Download Social Saver for Windows">
    <img src="https://img.shields.io/badge/Download%20for-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Download Social Saver for Windows">
  </a>
  <a href="https://socialsaver.site/download" title="Download Social Saver for macOS">
    <img src="https://img.shields.io/badge/Download%20for-macOS-6B4FBC?style=for-the-badge&logo=apple&logoColor=white" alt="Download Social Saver for macOS">
  </a>
  <a href="https://socialsaver.site/download" title="Download Social Saver for Linux">
    <img src="https://img.shields.io/badge/Download%20for-Linux-F37626?style=for-the-badge&logo=linux&logoColor=white" alt="Download Social Saver for Linux">
  </a>
</p>

Social Saver is a free, user-friendly desktop application for **Windows, macOS, and Linux** that simplifies saving online media. Powered by the robust `yt-dlp` and `gallery-dl` engines, it allows you to easily download videos, audio tracks, entire playlists, and full image galleries for offline access.

---

## ✨ Key Features

*   **Universal Media Downloader:**
    *   **Videos & Audio:** Download single videos or extract audio tracks.
    *   **Playlists:** Grab entire playlists with options to select/deselect individual items.
    *   **Flexible Quality & Formats:** Choose from various video qualities (144p up to 8K) and formats (MP4, MKV, WebM). Extract audio in multiple formats (MP3, M4A, Opus, FLAC, WAV).
    *   **Stream Selection:** Download video-only, audio-only, or combined streams. Option to download muted videos.
*   **Powerful Image & Gallery Archiver:**
    *   Save complete image galleries or user profiles from sites like Instagram.
    *   Supports cookies (via browser or file) for sites requiring login.
*   **Comprehensive Download Management:**
    *   Track active downloads with real-time progress, speed, and ETA.
    *   View detailed download history (completed, failed, cancelled).
    *   Retry failed downloads or cancel ongoing ones with ease.
*   **Highly Customizable:**
    *   Set default download paths for videos, audio, and images.
    *   Choose default conversion formats and quality.
    *   Create custom filename templates using various metadata variables (title, uploader, date, etc.).
    *   Configure performance settings like max concurrent jobs and cooldowns.
*   **Easy Engine Management:**
    *   Keep the core `yt-dlp` and `gallery-dl` engines updated with a single click from the "Dependencies" page.
    *   Option to prefer nightly builds for `yt-dlp` for the latest features.
*   **User-Friendly Interface:** Clean, intuitive design with clear navigation and light/dark/system theme support.
*   **Cross-Platform:** Native application for Windows, macOS, and Linux.

---

## 🚀 Supported Platforms

*   **Windows** (64-bit)
*   **macOS** (Universal - Intel & Apple Silicon)
*   **Linux** (AppImage, .deb, .rpm)

---

## 🌐 Supported Websites

Thanks to `yt-dlp` and `gallery-dl`, Social Saver supports thousands of websites, including:

*   YouTube (Videos, Playlists, Audio)
*   Instagram (Images, Videos, User Profiles)
*   Facebook
*   TikTok
*   Twitter / X
*   Vimeo
*   SoundCloud
*   ...and many more!

For a comprehensive list, check the official documentation for [yt-dlp supported sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) and [gallery-dl supported sites](https://github.com/mikf/gallery-dl/blob/master/docs/supportedsites.md).

---

## 💾 Installation

1.  **Visit the Official Website:** Go to [**socialsaver.site/download**](https://socialsaver.site/download).
2.  **Download:** Click the download button for your operating system.
3.  **Install:**
    *   **Windows:** Run the downloaded `.exe` installer.
    *   **macOS:** Open the downloaded `.dmg` file and drag `Social Saver.app` to your Applications folder.
    *   **Linux:**
        *   **AppImage:** Make it executable (`chmod +x SocialSaver*.AppImage`) and run.
        *   **.deb / .rpm:** Install using your system's package manager (e.g., `sudo dpkg -i socialsaver*.deb` or `sudo rpm -i socialsaver*.rpm`).

---

## 📖 How to Use Social Saver

Social Saver's interface is straightforward. Use the sidebar to navigate:

*   **Video/Audio Downloader:** For `yt-dlp` based video and audio downloads.
*   **Image/Gallery Downloader:** For `gallery-dl` based image and gallery downloads.
*   **Active Downloads:** View currently processing downloads.
*   **History:** See all your past and ongoing downloads.
*   **Settings:** Customize the app.
*   **Dependencies:** Manage `yt-dlp` and `gallery-dl` updates.

### 1. Downloading Videos or Audio
<p align="center">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/downloding-a-video-in-social-saver.png" alt="Social Saver video downloader interface" width="70%">
</p>

1.  Go to the **Video/Audio Downloader** tab.
2.  Paste the URL of the video or audio and click "Search".
3.  After the media info loads, select your desired **Download Type** (e.g., Video + Audio, Audio Only), **Quality**, and **Format**.
4.  Click **Download Selected**. Track progress in "Active Downloads" or "History".

### 2. Downloading Playlists
<p align="center">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/downloading-playlist.png" alt="Social Saver playlist downloader interface" width="70%">
</p>

1.  Go to the **Video/Audio Downloader** tab.
2.  Paste the playlist URL and click "Search".
3.  Select/deselect all items or pick individual ones.
4.  Adjust download type and quality for each item or use **Bulk Settings**.
5.  Click **Download Selected (`N`)**.

### 3. Downloading Images & Galleries
<p align="center">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/gallery-dl-screenshot.png" alt="Social Saver image and gallery downloader" width="70%">
</p>

1.  Go to the **Image/Gallery Downloader** tab.
2.  Paste the URL of the gallery, user profile, or single image.
3.  If login is needed, configure **Cookies** in this page's settings or globally via **Settings > Downloads > Cookies**.
4.  Click **Download**. Output appears in the terminal view.

### 4. Customizing Settings
<p align="center">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/social-saver-settings.png" alt="Social Saver application settings" width="70%">
</p>

1.  Go to the **Settings** page.
2.  Explore tabs for:
    *   **Downloads:** Set default save locations, formats, quality, performance.
    *   **Filenames:** Create custom filename patterns (e.g., `${uploader} - ${title}.${ext}`).
    *   **Application:** Choose app theme, history preferences, notifications.
    *   **Advanced:** Fine-tune `yt-dlp` options (retries, timeout, proxy) and advanced cookie settings.

### 5. Keeping Engines Updated
<p align="center">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/binary-management-page.png" alt="Social Saver dependencies management" width="70%">
</p>

1.  Go to the **Dependencies** page.
2.  Check the status and versions of `yt-dlp` and `gallery-dl`.
3.  Click "Check for Updates" and then "Update" if available to ensure best compatibility.

---

## 🛠️ Troubleshooting

*   **Download Failed?**
    1.  **Update Engines:** The most common fix! Go to "Dependencies" and update `yt-dlp` and `gallery-dl`.
    2.  **Check URL:** Ensure it's correct and the content is public or accessible.
    3.  **Cookies:** For private content, configure cookies in **Settings > Downloads > Cookies** or via the **Image/Gallery Downloader** page settings.
*   **"FFmpeg not found" (or similar for yt-dlp/gallery-dl)?**
    *   Social Saver attempts to manage these. If issues persist, ensure the executables are findable by the system (e.g., in PATH) or correctly configured in Social Saver's settings (usually done automatically by the app).

---

## 💻 Tech Stack

*   **Framework:** Electron
*   **UI:** React, Next.js (for landing page), Shadcn/ui, Tailwind CSS
*   **Core Download Engines:** `yt-dlp`, `gallery-dl`
*   **Media Processing:** FFmpeg (for merging/conversion)
*   **Language:** TypeScript

---

## 📄 License

Social Saver is provided free for personal, non-commercial use.
Please download official versions only from [**socialsaver.site/download**](https://socialsaver.site/download).

Copyright © 2024 Vishal Kaleria. All Rights Reserved.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/vishalkaleria" title="Vishal Kaleria's GitHub Profile">Vishal Kaleria</a>.
</p>
