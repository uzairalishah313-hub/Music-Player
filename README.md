# Aurora — Premium Music Player

A production-ready web music player built with plain HTML5, CSS3, and vanilla
ES6 JavaScript — no frameworks, no build step. Just open `index.html`.

## Adding your music

The player ships with 6 demo tracks wired up in `script.js` (`songs` array),
plus three generated gradient cover images so the UI looks finished out of
the box. It does **not** ship with actual audio for those demo entries —
you have two ways to add real, playable songs:

### Option A — Add songs from the app (instant, no editing files)
Click the **+** button next to "Your Playlist", or just drag MP3/WAV/M4A/OGG
files straight onto the sidebar and drop them. Each file is added to the
playlist immediately and the first one starts playing right away — nothing
leaves your browser, the audio plays from a local object URL. You can
favorite (heart icon) or search these uploaded tracks exactly like the
built-in ones.

> Uploaded songs live for the current browser session only — the browser
> discards local file references on reload, so if you refresh the page
> you'll need to add them again. Everything else (theme, volume, favorites
> list *contents*, shuffle/repeat, last-played demo track) still persists.

### Option B — Bundle files into the project (permanent)
1. Drop files into `assets/songs/` named `song1.mp3` … `song6.mp3` (or edit
   the `src` paths in the `songs` array in `script.js` to match your files).
2. Optionally replace `assets/images/cover1.jpg` … `cover3.jpg` with real
   album art (any image size works; it's cropped to a circle).
3. Reload the page. Track durations are detected automatically the first
   time each file loads and cached in `localStorage`.

If a file is missing or fails to load, the player shows a friendly toast
instead of crashing, and the album art falls back to a disc icon.

## Favoriting

Click the heart icon on any track in the playlist, or the heart on the
large player artwork, to favorite/unfavorite the current song. Favorites
are saved to `localStorage` and are always available under the
**Favorites** tab in the sidebar, even after a reload (uploaded songs stay
in that list too, though you'll need to re-add the audio file itself to
play them again after refreshing — see the note above).

## Features

- Dark/light theme toggle, persisted
- Glassmorphism cards, aurora-gradient ambient background, animated wave
- Sidebar playlist with live search (song / artist / album), favorites and
  recently-played tabs
- Large rotating album art with a glowing circular equalizer ring that
  traces playback progress
- Click-and-drag progress bar and volume slider, both keyboard accessible
- Shuffle, three repeat modes (off / all / one), playback speed 0.5×–2×
- Queue panel showing what's up next
- Full keyboard shortcuts: `Space` play/pause, `←/→` prev/next, `↑/↓`
  volume, `M` mute, `S` shuffle, `R` repeat
- State (last song, position, volume, theme, favorites, shuffle/repeat,
  speed) restored from `localStorage` on reload
- Responsive down to mobile, semantic HTML, ARIA labels, visible focus
  states, `prefers-reduced-motion` support

## File structure

```
index.html      structure & markup
style.css       theme tokens, layout, animations, responsive rules
script.js       state, audio engine, rendering, events
assets/songs/   put your MP3s here
assets/images/  album covers (3 generated placeholders included)
```
