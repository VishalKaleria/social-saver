# Social Saver: Your All-in-One Desktop Media Downloader

<p align="center">
  <strong>Effortlessly download videos, audio, playlists, and image galleries from your favorite social media platforms and websites directly to your desktop.</strong>
</p>

<p align="center">
  <a href="https://socialsaver.site/download" title="Download Social Saver for Windows"><img src="https://img.shields.io/badge/Download%20for-Windows-blue?style=for-the-badge&logo=windows" alt="Download Social Saver for Windows"></a>
  <a href="https://socialsaver.site/download" title="Download Social Saver for macOS"><img src="https://img.shields.io/badge/Download%20for-macOS-blueviolet?style=for-the-badge&logo=apple" alt="Download Social Saver for macOS"></a>
  <a href="https://socialsaver.site/download" title="Download Social Saver for Linux"><img src="https://img.shields.io/badge/Download%20for-Linux-orange?style=for-the-badge&logo=linux" alt="Download Social Saver for Linux"></a>
</p>

Social Saver is a user-friendly desktop application for Windows, macOS, and Linux that makes saving online media simple. Powered by the robust `yt-dlp` and `gallery-dl` engines, it allows you to easily download videos, audio tracks, entire playlists, and full image galleries for offline access.

---

## ✨ Key Features

*   **Universal Media Downloader:**
    *   **Videos & Audio:** Download single videos or audio tracks.
    *   **Playlists:** Grab entire playlists with options to select individual items.
    *   **Versatile Quality & Formats:** Choose from various video qualities (144p up to 8K) and formats (MP4, MKV, WebM). Extract audio in multiple formats (MP3, M4A, Opus, FLAC, WAV).
    *   **Flexible Streams:** Download video-only, audio-only, or combined streams. Option to download videos without audio (muted).
*   **Powerful Image & Gallery Downloader:**
    *   Save entire image galleries or user profiles from sites like Instagram.
    *   Supports cookies (via browser or file) for sites requiring login.
*   **Comprehensive Download Management:**
    *   Track active downloads with real-time progress, speed, and ETA.
    *   View detailed download history (completed, failed, cancelled).
    *   Retry failed downloads or cancel ongoing ones with ease.
*   **Highly Customizable Settings:**
    *   Set default download paths for videos, audio, and images.
    *   Choose default conversion formats and quality.
    *   Create custom filename templates using various metadata variables (title, uploader, date, etc.).
    *   Configure performance settings like max concurrent jobs and cooldowns.
    *   Manage application behavior, theme (Light/Dark/System), and history preferences.
*   **Easy Download Engine Management:**
    *   Keep the core `yt-dlp` and `gallery-dl` engines updated with a single click from the "Dependencies" page.
    *   Option to prefer nightly builds for `yt-dlp` for the latest features.
*   **Cross-Platform:** Available for Windows, macOS, and Linux.
*   **User-Friendly Interface:** Clean, intuitive design with clear navigation.

---

## 🚀 Supported Platforms

*   **Windows** (64-bit)
*   **macOS** (Universal - Intel & Apple Silicon)
*   **Linux** (AppImage, .deb, .rpm)

---

## 🌐 Supported Websites

Thanks to the power of `yt-dlp` and `gallery-dl`, Social Saver supports downloading from thousands of websites, including (but not limited to):

*   YouTube (Videos, Playlists, Audio)
*   Instagram (Images, Videos, User Profiles)
*   Facebook
*   TikTok
*   Twitter / X
*   Vimeo
*   SoundCloud
*   And many, many more! (Check the official [yt-dlp supported sites list](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) and [gallery-dl supported sites list](https://github.com/mikf/gallery-dl/blob/master/docs/supportedsites.md) for extensive details.)

---

## 🖼️ Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/downloding-a-video-in-social-saver.png" alt="Social Saver video downloader interface showing download options" width="48%">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/downloading-playlist.png" alt="Social Saver playlist downloader interface with item selection" width="48%">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/gallery-dl-screenshot.png" alt="Social Saver image and gallery downloader (gallery-dl) interface" width="48%">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/download-history-page.png" alt="Social Saver download history page displaying past downloads" width="48%">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/binary-management-page.png" alt="Social Saver dependencies management page for yt-dlp and gallery-dl" width="48%">
  <img src="https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/social-saver-settings.png" alt="Social Saver application settings page" width="48%">
</p>

---

## 💾 Installation

1.  **Visit the Official Website:** Go to [socialsaver.site/download](https://socialsaver.site/download).
2.  **Download:** Click the download button for your operating system.
3.  **Install:**
    *   **Windows:** Run the downloaded `.exe` installer and follow the on-screen instructions.
    *   **macOS:** Open the downloaded `.dmg` file and drag `Social Saver.app` to your Applications folder.
    *   **Linux:**
        *   **AppImage:** Make the `.AppImage` file executable (`chmod +x SocialSaver.AppImage`) and run it.
        *   **.deb:** Install using your package manager (e.g., `sudo dpkg -i socialsaver.deb && sudo apt-get install -f`).
        *   **.rpm:** Install using your package manager (e.g., `sudo rpm -i socialsaver.rpm`).

---

## 📖 How to Use Social Saver

Social Saver is designed for ease of use. Navigate using the sidebar:

*   **Video Downloader:** For `yt-dlp` based video and audio downloads.
*   **Image & Gallery DL:** For `gallery-dl` based image and gallery downloads.
*   **History:** View your past and ongoing downloads.
*   **Settings:** Customize various aspects of the application.
*   **Dependencies:** Manage and update `yt-dlp` and `gallery-dl`.
*   **Donate:** Support the project (if applicable).

### 1. Downloading a Single Video or Audio
*Example: Selecting video quality and format for a YouTube video.*

1.  Navigate to the **Video Downloader** tab.
2.  Paste the URL of the video or audio into the input field and click "Search".
3.  Once media info loads, choose your **Download Type** (Combined, Video + Audio, Audio Only), **Quality**, and **Format**.
4.  Click the **Download Selected** button. Track progress in the "Downloads" sub-tab or on the main "History" page.

### 2. Downloading Playlists
*Example: Managing and downloading items from a YouTube playlist.*

1.  Go to the **Video Downloader** tab.
2.  Paste the URL of the playlist and click "Search".
3.  Use the master checkbox to select/deselect all items, or pick items individually.
4.  Set download type and quality for each item, or use the **Bulk Settings** for selected items.
5.  Click **Download Selected (`N`)** to start downloading.

### 3. Downloading Images & Galleries (e.g., Instagram)
*Example: Downloading all images from an Instagram profile.*

1.  Navigate to the **Image & Gallery DL** tab.
2.  Paste the URL of the image gallery, user profile, or single image page.
3.  Configure **Cookies** on this page if the site requires login (details in Settings).
4.  Click the **Download** button. Progress is shown in a terminal-like output.

### 4. Tracking Your Downloads
*Example: Viewing the download history page.*

*   **Video Downloader > Downloads Tab:** Shows active `yt-dlp` jobs with details.
*   **History Page:** A comprehensive list of all downloads (video, audio, image) with status. Allows retry, cancel, open file, or open containing folder.

### 5. Customizing Settings
*Example: Configuring application settings for paths, formats, and filenames.*

1.  Go to the **Settings** page.
2.  Tabs for:
    *   **Downloads:** Default save locations, formats, conversion quality, performance (concurrent jobs).
    *   **Filenames:** Custom filename templates (e.g., `${uploader} - ${title}.${ext}`).
    *   **Application:** App theme, history saving, notifications.
    *   **Advanced:** Fine-tune `yt-dlp` (retries, timeout, proxy), cookie settings for authentication.

### 6. Managing Download Engines (Dependencies)
*Example: Checking and updating yt-dlp and gallery-dl engines.*

1.  Navigate to the **Dependencies** page.
2.  View status and versions of `yt-dlp` and `gallery-dl`.
3.  Check for updates and install the latest versions to ensure compatibility.

---

## 🛠️ Troubleshooting Tips

*   **Download Failed?**
    1.  **Update Engines:** Go to "Dependencies" and update `yt-dlp` and `gallery-dl`. This is the most common fix.
    2.  **Check URL:** Ensure the URL is correct and the content is publicly accessible.
    3.  **Cookies:** For private content or sites needing login, configure cookies (in "Image & Gallery DL" page settings or global "Settings" -> "Advanced").
*   **"FFmpeg not found"?**
    *   Social Saver uses FFmpeg for merging/conversions. Ensure FFmpeg is installed and in your system's PATH, or specify its path in Social Saver's settings (if available - usually managed by the app).

---

## 💻 Tech Stack

*   **Frontend:** React, Shadcn/ui, Tailwind CSS
*   **Backend Logic/Desktop Framework:** Electron, Node.js
*   **Core Download Engines:** `yt-dlp`, `gallery-dl`
*   **Video/Audio Processing:** FFmpeg

---

## 📄 License

Social Saver is provided free for personal, non-commercial use.
Download official versions only from [socialsaver.site/download](https://socialsaver.site/download).

Copyright © 2025 Vishal Kaleria.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/vishalkaleria" title="Vishal Kaleria's GitHub Profile">Vishal Kaleria</a>
</p>
