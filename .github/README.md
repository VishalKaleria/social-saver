# Social Saver: All-in-One Desktop Media Downloader

<p align="center">
  <strong>Effortlessly download videos, audio, playlists, and image galleries from your favorite social media platforms and websites directly to your desktop.</strong>
</p>

<p align="center">
  <a href="https://socialsaver.site/download"><img src="https://img.shields.io/badge/Windows%20Download-64--bit-blue?style=for-the-badge&logo=windows" alt="Download for Windows"></a>
  <a href="https://socialsaver.site/download"><img src="https://img.shields.io/badge/macOS%20Download-Universal-blueviolet?style=for-the-badge&logo=apple" alt="Download for macOS"></a>
  <a href="https://socialsaver.site/download"><img src="https://img.shields.io/badge/Linux%20Download-AppImage%20/%20deb%20/%20rpm-orange?style=for-the-badge&logo=linux" alt="Download for Linux"></a>
</p>

Social Saver is a powerful, user-friendly desktop application designed to help you save online media for offline viewing. Whether it's a single video, a full playlist, or an entire image gallery, Social Saver handles it with ease, powered by the robust `yt-dlp` and `gallery-dl` engines.

---

## ✨ Key Features

*   **Versatile Video & Audio Downloader:**
    *   Download single videos or audio tracks.
    *   Grab entire playlists with options to select individual items.
    *   Choose from various video qualities (144p up to 8K) and formats (MP4, MKV, etc.).
    *   Extract audio in multiple formats (MP3, M4A, Opus, etc.).
    *   Option to download video-only or audio-only streams, or combine them.
    *   Download videos without audio (muted).
*   **Powerful Image & Gallery Downloader:**
    *   Save entire image galleries or user profiles from sites like Instagram.
    *   Supports cookies for sites requiring login (via browser or file).
*   **Comprehensive Download Management:**
    *   Track active downloads with progress, speed, and ETA.
    *   View detailed download history (completed, failed, cancelled).
    *   Retry failed downloads or cancel ongoing ones.
*   **Highly Customizable Settings:**
    *   Set default download paths for videos, audio, and images.
    *   Choose default conversion formats and quality.
    *   Create custom filename templates using various metadata variables.
    *   Configure performance settings like max concurrent jobs and cooldowns.
    *   Manage application behavior, theme, and history preferences.
*   **Easy Download Engine Management:**
    *   Keep the core `yt-dlp` and `gallery-dl` engines updated with a single click from the "Dependencies" page.
    *   Option to prefer nightly builds for `yt-dlp` for the latest features.
*   **Cross-Platform:**
    *   Available for Windows, macOS, and Linux.
*   **User-Friendly Interface:**
    *   Clean, intuitive design with clear navigation.
    *   Light, Dark, and System theme options.

---

## 🚀 Supported Platforms

Social Saver is available for:

*   Windows (64-bit)
*   macOS (Universal - Intel & Apple Silicon)
*   Linux (AppImage, .deb, .rpm)

---

## 🌐 Supported Websites

Thanks to `yt-dlp` and `gallery-dl`, Social Saver supports downloading from a vast array of websites, including (but not limited to):

*   YouTube (Videos, Playlists, Audio)
*   Instagram (Images, Videos, Profiles)
*   Facebook
*   TikTok
*   Twitter / X
*   Vimeo
*   SoundCloud
*   And thousands more! (Check [yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) and [gallery-dl](https://github.com/mikf/gallery-dl/blob/master/docs/supported_sites.md) for extensive lists)

---

## 💾 Installation

1.  **Visit the Official Website:** Go to [socialsaver.site/download](https://socialsaver.site/download).
2.  **Download:** Click the download button for your operating system (Windows, macOS, or Linux).
3.  **Install:**
    *   **Windows:** Run the downloaded `.exe` installer and follow the on-screen instructions.
    *   **macOS:** Open the downloaded `.dmg` file and drag `Social Saver.app` to your Applications folder.
    *   **Linux:**
        *   **AppImage:** Make the `.AppImage` file executable (`chmod +x SocialSaver.AppImage`) and run it.
        *   **.deb:** Install using your package manager (e.g., `sudo dpkg -i socialsaver.deb && sudo apt-get install -f`).
        *   **.rpm:** Install using your package manager (e.g., `sudo rpm -i socialsaver.rpm`).

---

## 📖 How to Use Social Saver

Social Saver is designed to be intuitive. Here’s a guide to its main functionalities:

### Navigation
The application features a sidebar for easy navigation between different sections:
*   **Video Downloader:** For `yt-dlp` based video and audio downloads.
*   **Image & Gallery DL:** For `gallery-dl` based image and gallery downloads.
*   **History:** View your past and ongoing downloads.
*   **Settings:** Customize various aspects of the application.
*   **Dependencies:** Manage and update `yt-dlp` and `gallery-dl`.
*   **Donate:** Support the project.

### 1. Downloading a Single Video or Audio

![Social Saver Video Downloader - Choosing download options for a YouTube video](https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/downloding-a-video-in-social-saver.png)
*Caption: Selecting video quality and format options in the Video Downloader tab.*

1.  Navigate to the **Video Downloader** tab using the sidebar.
2.  Paste the URL of the video or audio you want to download into the input field.
3.  Click "Search". Social Saver will fetch media information.
4.  Once loaded, you'll see media details (thumbnail, title, etc.) and download options.
5.  **Choose Download Type:**
    *   **Combined:** Downloads a single file with both video and audio (if available).
    *   **Video + Audio:** Downloads the best video-only stream and the best audio-only stream, then merges them. You can select video quality and toggle audio on/off (for muted video).
    *   **Audio Only:** Downloads only the audio track.
6.  **Select Quality & Format:** Choose your preferred resolution/bitrate and file format from the available options.
7.  Click the **Download Selected** button.
8.  You can track progress in the "Downloads" sub-tab within the Video Downloader section or on the main "History" page.

### 2. Downloading Playlists

![Social Saver Video Downloader - Managing and downloading items from a YouTube playlist](https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/downloading-playlist.png)
*Caption: Viewing and selecting videos from a playlist for batch download.*

1.  Go to the **Video Downloader** tab.
2.  Paste the URL of the playlist.
3.  Click "Search". Social Saver will load all items in the playlist.
4.  **Manage Playlist Items:**
    *   Use the master checkbox at the top to select/deselect all items.
    *   Individually check/uncheck items you want to download.
    *   For each item, you can set a specific download type (Video/Audio) and quality.
5.  **Bulk Settings (Optional):** Use the "Bulk Type" and "Bulk Quality" dropdowns at the top to set defaults for all selected items.
6.  Click **Download Selected (`N`)** to start downloading all checked items.
7.  Progress for each item can be monitored in the table or on the "History" page.

### 3. Downloading Images & Galleries (e.g., Instagram)

![Social Saver Image & Gallery DL - Downloading an Instagram profile](https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/gallery-dl-screenshot.png)
*Caption: Using the Image & Gallery DL tab to download all images from an Instagram profile.*

1.  Navigate to the **Image & Gallery DL** tab.
2.  Paste the URL of the image gallery, user profile (e.g., an Instagram profile URL), or a single image page.
3.  **Configure Options (if needed):**
    *   **Output Path:** Set where images will be saved (can also be set globally in Settings).
    *   **Cookies:** For sites requiring login, you can configure Social Saver to use cookies from your browser or a cookies file. This is configured in the "Settings" for Gallery-DL within this page.
4.  Click the **Download** button.
5.  A terminal-like output will show the progress from `gallery-dl`.

### 4. Tracking Your Downloads

![Social Saver - Viewing the download history page](https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/download-history-page.png)
*Caption: Tracking completed, ongoing, and failed downloads in the history section.*

*   **Active Downloads Tab (Video Downloader):** When downloading single videos/audio or playlists, the "Downloads" tab within the "Video Downloader" section shows currently active `yt-dlp` jobs.
*   **History Page:**
    *   Accessible from the sidebar.
    *   Shows a comprehensive list of all downloads (video, audio, image).
    *   Displays status (Queued, Downloading, Processing, Completed, Failed, Cancelled), progress, and other details.
    *   Allows you to retry failed downloads, cancel ongoing ones, open downloaded files, or open their containing folder.

### 5. Customizing Settings

![Social Saver - Configuring application settings](https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/social-saver-settings.png)
*Caption: Customizing paths, default formats, filename templates, and other preferences.*

1.  Go to the **Settings** page from the sidebar.
2.  Settings are organized into tabs:
    *   **Downloads:** Set default download locations for videos, audio, images. Configure default formats (MP4, MP3, etc.) and conversion quality. Manage performance settings like max concurrent downloads.
    *   **Filenames:** Enable and create custom filename templates using variables like `${title}`, `${uploader}`, `${upload_date}`, etc.
    *   **Application:** Choose app theme (Light/Dark/System), history saving options, notification preferences.
    *   **Advanced:** Fine-tune `yt-dlp` engine parameters (retries, timeout, proxy), and history/job management settings. Configure cookie usage for authenticated downloads.

### 6. Managing Download Engines (Binaries)

![Social Saver - Checking and updating yt-dlp and gallery-dl engines](https://raw.githubusercontent.com/VishalKaleria/social-saver/main/public/screenshots/binary-management-page.png)
*Caption: Easily update the core yt-dlp and gallery-dl binaries from the Dependencies settings.*

1.  Navigate to the **Dependencies** page from the sidebar.
2.  Here you'll see the status and current versions of `yt-dlp` and `gallery-dl` (if detected/managed by the app).
3.  You can check for updates and install the latest versions of these engines with a single click to ensure compatibility with the latest website changes.
4.  You can also configure `yt-dlp` update preferences (e.g., prefer nightly builds, auto-update) in the main "Settings" page under the "Application" or "Advanced" tab.

---

## 🛠️ Troubleshooting Tips

*   **Download Failed?**
    1.  Try updating `yt-dlp` and `gallery-dl` from the "Dependencies" page. Websites change frequently, and updated engines are often required.
    2.  Ensure the URL is correct and the content is publicly accessible.
    3.  For private content or sites requiring login, ensure you have configured cookies correctly in the "Image & Gallery DL" settings or global "Settings" -> "Advanced" (for yt-dlp).
*   **"FFmpeg not found"?**
    *   Social Saver relies on FFmpeg for merging video/audio and format conversions. Ensure FFmpeg is installed on your system and accessible in your system's PATH, or specify its path in Social Saver's settings (if such an option is available). (Usually, Social Saver bundles or helps manage this).

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
  Made with ❤️ by <a href="https://github.com/vishalkaleria">Vishal Kaleria</a>
</p>
<div style="text-align: center">⁂</div>
