# YouTube Playlist Timer Extension

This browser extension calculates the total time of YouTube playlists and displays it both on the page and in the extension popup. Additionally, it allows you to calculate how many fixed-length time chunks (e.g., 25-minute Pomodoro sessions) would be needed to complete watching the playlist.

## Features

- Automatically displays the total duration of YouTube playlists
- Calculate how many time chunks of a specific length are needed to complete the playlist
- Works with any YouTube playlist, including Watch Later and custom playlists

## Installation

### Development Installation

1. Clone this repository or download the source code
2. Navigate to `chrome://extensions/` in Chrome
3. Enable "Developer mode" using the toggle in the top right
4. Click "Load unpacked" and select the extension directory

### Building for Distribution

To package the extension for distribution:

1. Create a ZIP file containing all the extension files
2. Submit to the Chrome Web Store or distribute privately

## Usage

1. Navigate to any YouTube playlist
2. The extension will automatically display the total playlist time at the bottom right of the page
3. Click on the extension icon to open the popup
4. Click "Calculate Time" to see the total playlist duration
5. Enter a time chunk size in minutes and click "Calculate Chunks" to see how many chunks are needed

## Directory Structure

```
youtube-playlist-timer/
├── manifest.json      # Extension configuration
├── content.js         # Content script that runs on YouTube pages
├── popup.html         # Popup UI HTML
├── popup.js           # Popup UI JavaScript
└── icons/             # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## License

MIT
