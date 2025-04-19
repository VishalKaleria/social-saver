name: 🐞 Bug Report
description: Create a report to help us improve Social Saver
title: "[Bug]: "
labels: ["bug", "triage"]
assignees:
  - VishalKaleria
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report! Please be as detailed as possible.
        **Before submitting:** Have you checked the [Troubleshooting Guide](https://socialsaver.site/docs/troubleshooting.md) and updated the download engine via `Settings > Binaries`?
  - type: dropdown
    id: os
    attributes:
      label: Operating System
      description: What operating system are you using?
      options:
        - Windows 11
        - Windows 10
        - macOS Sonoma (14.x)
        - macOS Ventura (13.x)
        - macOS Monterey (12.x)
        - macOS Big Sur (11.x)
        - Linux (Ubuntu/Debian based)
        - Linux (Fedora/RPM based)
        - Linux (Arch based)
        - Linux (Other AppImage)
        - Other
      multiple: false
    validations:
      required: true
  - type: input
    id: app-version
    attributes:
      label: Social Saver Version
      description: Which version of the Social Saver app are you using? (Check title bar or About section if available)
      placeholder: "e.g., v1.0.0"
    validations:
      required: true
  - type: input
    id: ytdlp-version
    attributes:
      label: yt-dlp Version (Optional but helpful)
      description: What version does it show under `Settings > Binaries > Installed Version`?
      placeholder: "e.g., 2023.10.13"
  - type: textarea
    id: description
    attributes:
      label: Describe the Bug
      description: A clear and concise description of what the bug is.
      placeholder: "When I try to download a playlist from [website], it fails with the error '...'."
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: Steps To Reproduce
      description: Steps to reproduce the behavior. Be specific!
      placeholder: |
        1. Go to '...' URL
        2. Paste link '...' into Social Saver
        3. Click on '...' format
        4. Click 'Download Selected'
        5. See error '...'
    validations:
      required: true
  - type: input
    id: url
    attributes:
      label: Relevant URL (Optional)
      description: If the bug relates to a specific website or video, please provide the URL. (Remove personal info if necessary).
      placeholder: "https://www.example.com/video/12345"
  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What did you expect to happen?
      placeholder: "The playlist items should download successfully."
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happened? Include any error messages shown in the app or History page.
      placeholder: "The download failed immediately, showing 'Error: Network Error' in the History tab."
    validations:
      required: true
  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots (Optional)
      description: If applicable, add screenshots to help explain your problem. Drag & drop images here.
  - type: textarea
    id: logs
    attributes:
      label: Logs (Optional / Advanced)
      description: If you enabled Verbose Logging (Settings > Advanced), you can paste relevant log snippets here. Please don't paste huge logs directly, use a service like pastebin.com if necessary.
      render: shell
  - type: markdown
    attributes:
      value: |
        Thanks for your help!