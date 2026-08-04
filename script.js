/* ==========================================================================
   AURORA — Premium Music Player
   Vanilla ES6. Organised as small, single-purpose modules glued together
   at the bottom in init(). No frameworks, no build step.
   ========================================================================== */

'use strict';

/* ==========================================================================
   1. SONG DATA
   Replace the `src` / `cover` paths with your own files inside
   assets/songs/ and assets/images/. `duration` is filled in automatically
   the first time each track's metadata loads (via the Audio API), and the
   value is cached in localStorage so subsequent visits don't need to probe
   every file again.
   ========================================================================== */
const songs = [
  { id: 1, title: 'Violet Horizon',   artist: 'Nova Ray',        album: 'Aurora Skies',   cover: 'assets/images/cover1.jpg', src: 'assets/songs/song1.mp3', duration: 0 },
  { id: 2, title: 'Midnight Transit', artist: 'Kilo Bloom',      album: 'Neon Districts', cover: 'assets/images/cover2.jpg', src: 'assets/songs/song2.mp3', duration: 0 },
  { id: 3, title: 'Glass Cathedral',  artist: 'Sable & Wren',    album: 'Interior Light',  cover: 'assets/images/cover3.jpg', src: 'assets/songs/song3.mp3', duration: 0 },
  { id: 4, title: 'Paper Satellites', artist: 'Nova Ray',        album: 'Aurora Skies',   cover: 'assets/images/cover1.jpg', src: 'assets/songs/song4.mp3', duration: 0 },
  { id: 5, title: 'Slow Static',      artist: 'Odd Harbor',      album: 'Tape Memory',    cover: 'assets/images/cover2.jpg', src: 'assets/songs/song5.mp3', duration: 0 },
  { id: 6, title: 'Copper Light',     artist: 'Sable & Wren',    album: 'Interior Light',  cover: 'assets/images/cover3.jpg', src: 'assets/songs/song6.mp3', duration: 0 },
];

/* ==========================================================================
   2. STORAGE KEYS + SMALL STORAGE HELPER
   ========================================================================== */
const STORE = {
  theme: 'aurora_theme',
  volume: 'aurora_volume',
  muted: 'aurora_muted',
  lastSongId: 'aurora_last_song',
  position: 'aurora_position',
  favorites: 'aurora_favorites',
  recent: 'aurora_recent',
  shuffle: 'aurora_shuffle',
  repeat: 'aurora_repeat',
  speed: 'aurora_speed',
  durations: 'aurora_durations',
};

const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full / unavailable */ }
  },
};

/* ==========================================================================
   3. APPLICATION STATE
   ========================================================================== */
const state = {
  currentIndex: 0,
  isPlaying: false,
  isShuffle: storage.get(STORE.shuffle, false),
  repeatMode: storage.get(STORE.repeat, 'off'),     // 'off' | 'one' | 'all'
  volume: storage.get(STORE.volume, 0.7),
  isMuted: storage.get(STORE.muted, false),
  favorites: new Set(storage.get(STORE.favorites, [])),
  recent: storage.get(STORE.recent, []),            // array of song ids, most recent first
  shuffleOrder: [],
  filter: 'all',                                    // 'all' | 'favorites' | 'recent'
  searchQuery: '',
  playbackRate: storage.get(STORE.speed, 1),
  isSeeking: false,
  rafId: null,
};

/* Restore previously known durations so the playlist doesn't show 0:00
   before each file has been probed. */
const savedDurations = storage.get(STORE.durations, {});
songs.forEach(s => { if (savedDurations[s.id]) s.duration = savedDurations[s.id]; });

/* ==========================================================================
   4. DOM REFERENCES
   ========================================================================== */
const $ = (sel) => document.querySelector(sel);
const dom = {
  loadingScreen: $('#loading-screen'),
  app: $('#app'),
  audio: $('#audio'),

  // header
  themeToggle: $('#theme-toggle'),
  themeIcon: $('#theme-icon'),
  searchInput: $('#search-input'),
  searchClear: $('#search-clear'),
  nowPlayingIndicator: $('#now-playing-indicator'),
  nowPlayingText: $('#now-playing-text'),

  // sidebar
  sidebar: $('#sidebar'),
  playlistEl: $('#playlist'),
  playlistEmpty: $('#playlist-empty'),
  playlistCount: $('#playlist-count'),
  tabs: document.querySelectorAll('.sidebar__tab'),
  addSongsBtn: $('#add-songs-btn'),
  fileInput: $('#file-input'),
  dropHint: $('#drop-hint'),

  // player
  coverImg: $('#cover-img'),
  coverBox: $('#player-cover'),
  coverFallback: $('#cover-fallback'),
  eqRingProgress: $('#eq-ring-progress'),
  favoriteBtn: $('#favorite-btn'),
  songTitle: $('#song-title'),
  songArtist: $('#song-artist'),
  songAlbum: $('#song-album'),
  equalizer: $('#equalizer'),

  currentTimeEl: $('#current-time'),
  totalTimeEl: $('#total-time'),
  progressBar: $('#progress-bar'),
  progressFill: $('#progress-fill'),
  progressBuffered: $('#progress-buffered'),
  progressHandle: $('#progress-handle'),

  shuffleBtn: $('#shuffle-btn'),
  prevBtn: $('#prev-btn'),
  playBtn: $('#play-btn'),
  playIcon: $('#play-icon'),
  nextBtn: $('#next-btn'),
  repeatBtn: $('#repeat-btn'),
  repeatOneDot: $('#repeat-one-dot'),

  muteBtn: $('#mute-btn'),
  volumeIcon: $('#volume-icon'),
  volumeBar: $('#volume-bar'),
  volumeFill: $('#volume-fill'),
  volumeHandle: $('#volume-handle'),

  speedBtn: $('#speed-btn'),
  speedLabel: $('#speed-label'),
  speedMenu: $('#speed-menu'),

  queueBtn: $('#queue-btn'),
  queuePanel: $('#queue-panel'),
  queueClose: $('#queue-close'),
  queueList: $('#queue-list'),

  toastContainer: $('#toast-container'),
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 150; // matches the r=150 circle in the SVG

/* ==========================================================================
   5. UTILITIES
   ========================================================================== */
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function toast(message, type = 'info', duration = 3200) {
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  const icon = type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check';
  el.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;
  dom.toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function ripple(e, btn) {
  const circle = document.createElement('span');
  circle.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  circle.style.width = circle.style.height = `${size}px`;
  const x = (e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
  const y = (e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;
  circle.style.left = `${x}px`;
  circle.style.top = `${y}px`;
  btn.style.position = btn.style.position || 'relative';
  btn.appendChild(circle);
  circle.addEventListener('animationend', () => circle.remove());
}

/* ==========================================================================
   6. DERIVED LISTS (search / filter / shuffle order)
   ========================================================================== */
function getFilteredSongs() {
  let list = songs;

  if (state.filter === 'favorites') {
    list = list.filter(s => state.favorites.has(s.id));
  } else if (state.filter === 'recent') {
    list = state.recent.map(id => songs.find(s => s.id === id)).filter(Boolean);
  }

  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.album.toLowerCase().includes(q)
    );
  }
  return list;
}

function buildShuffleOrder() {
  const indices = songs.map((_, i) => i).filter(i => i !== state.currentIndex);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  state.shuffleOrder = [state.currentIndex, ...indices];
}

/* ==========================================================================
   7. RENDERING — PLAYLIST
   ========================================================================== */
function renderPlaylist() {
  const list = getFilteredSongs();
  dom.playlistEl.innerHTML = '';
  dom.playlistEmpty.hidden = list.length !== 0;
  dom.playlistCount.textContent = `${songs.length} song${songs.length !== 1 ? 's' : ''}`;

  list.forEach((song) => {
    const realIndex = songs.indexOf(song);
    const isActive = realIndex === state.currentIndex;
    const isFav = state.favorites.has(song.id);

    const li = document.createElement('li');
    li.className = `track${isActive ? ' is-active' : ''}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(isActive));
    li.tabIndex = 0;
    li.dataset.index = String(realIndex);

    const artMarkup = song.cover
      ? `<img src="${song.cover}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" />
         <i class="fa-solid fa-compact-disc" style="display:none"></i>`
      : `<i class="fa-solid fa-compact-disc"></i>`;

    li.innerHTML = `
      <div class="track__art">
        ${artMarkup}
        <div class="track__play-overlay"><i class="fa-solid ${isActive && state.isPlaying ? 'fa-pause' : 'fa-play'}"></i></div>
      </div>
      <div class="track__body">
        <p class="track__title">${escapeHtml(song.title)}</p>
        <p class="track__artist">${escapeHtml(song.artist)}</p>
      </div>
      <div class="track__meta">
        <span class="track__duration">${song.duration ? formatTime(song.duration) : '--:--'}</span>
        <button type="button" class="track__fav${isFav ? ' is-fav' : ''}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${isFav}">
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.closest('.track__fav')) return; // handled separately
      loadSong(realIndex, { autoplay: true });
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadSong(realIndex, { autoplay: true }); }
    });
    li.querySelector('.track__fav').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(song.id);
    });

    dom.playlistEl.appendChild(li);
  });
}

function renderQueue() {
  const order = state.isShuffle && state.shuffleOrder.length ? state.shuffleOrder : songs.map((_, i) => i);
  const currentPos = order.indexOf(state.currentIndex);
  const upcoming = order.slice(currentPos + 1).concat(state.repeatMode === 'all' ? order.slice(0, currentPos + 1) : []);

  dom.queueList.innerHTML = upcoming.length
    ? upcoming.map((idx, pos) => {
        const s = songs[idx];
        return `<li data-index="${idx}"><span class="q-index">${pos + 1}</span><span>${escapeHtml(s.title)} — ${escapeHtml(s.artist)}</span></li>`;
      }).join('')
    : '<li style="color:var(--text-faint)">Queue is empty — enable repeat to loop the playlist.</li>';

  dom.queueList.querySelectorAll('li[data-index]').forEach(li => {
    li.addEventListener('click', () => loadSong(Number(li.dataset.index), { autoplay: true }));
  });
}

/* ==========================================================================
   8. FAVORITES / RECENT
   ========================================================================== */
function toggleFavorite(songId) {
  if (state.favorites.has(songId)) {
    state.favorites.delete(songId);
  } else {
    state.favorites.add(songId);
    toast('Added to favorites', 'info', 1800);
  }
  storage.set(STORE.favorites, [...state.favorites]);
  syncFavoriteUI();
  if (state.filter === 'favorites') renderPlaylist();
}

function syncFavoriteUI() {
  const song = songs[state.currentIndex];
  const isFav = song && state.favorites.has(song.id);
  dom.favoriteBtn.classList.toggle('is-active', !!isFav);
  dom.favoriteBtn.setAttribute('aria-pressed', String(!!isFav));
  dom.favoriteBtn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
  document.querySelectorAll('.track').forEach(li => {
    const idx = Number(li.dataset.index);
    const fav = state.favorites.has(songs[idx].id);
    const btn = li.querySelector('.track__fav');
    if (btn) {
      btn.classList.toggle('is-fav', fav);
      btn.setAttribute('aria-pressed', String(fav));
    }
  });
}

function pushRecent(songId) {
  state.recent = [songId, ...state.recent.filter(id => id !== songId)].slice(0, 20);
  storage.set(STORE.recent, state.recent);
  if (state.filter === 'recent') renderPlaylist();
}

/* ==========================================================================
   8b. ADD SONGS FROM DEVICE (file picker + drag & drop)
   Uploaded files never leave the browser: each one gets a local
   `URL.createObjectURL()` reference so it can be played immediately.
   Note: object URLs don't survive a page reload (the browser discards
   them), so uploaded songs live for the current session — re-add them
   after refreshing if you want to keep listening.
   ========================================================================== */
let uploadIdCounter = 100000; // keeps generated ids well clear of the demo songs

function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f =>
    f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)
  );

  if (!files.length) {
    toast('Please choose audio files (mp3, wav, m4a, ogg…).', 'error');
    return;
  }

  const addedSongs = [];

  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    const rawName = file.name.replace(/\.[^/.]+$/, '');

    // Support "Artist - Title.mp3" naming; otherwise use the filename as the title.
    let title = rawName;
    let artist = 'Local upload';
    if (rawName.includes(' - ')) {
      const [a, ...rest] = rawName.split(' - ');
      artist = a.trim();
      title = rest.join(' - ').trim();
    }

    const song = {
      id: ++uploadIdCounter,
      title: title || 'Untitled track',
      artist,
      album: 'My Uploads',
      cover: null,
      src: url,
      duration: 0,
      isLocal: true,
    };
    songs.push(song);
    addedSongs.push(song);

    // Probe duration in the background (without playing) so the playlist
    // shows a real time instead of "--:--" even before the track is opened.
    const probe = new Audio(url);
    probe.addEventListener('loadedmetadata', () => {
      song.duration = probe.duration || 0;
      renderPlaylist();
    }, { once: true });
    probe.addEventListener('error', () => {
      toast(`"${file.name}" couldn't be read as audio.`, 'error');
    }, { once: true });
  });

  if (!addedSongs.length) return;

  toast(`${addedSongs.length} song${addedSongs.length > 1 ? 's' : ''} added — playing now`, 'info');
  renderPlaylist();
  renderQueue();

  // Jump straight to the first newly-added track so it's obvious it works.
  const firstNewIndex = songs.indexOf(addedSongs[0]);
  loadSong(firstNewIndex, { autoplay: true });
}

function bindUploadEvents() {
  dom.addSongsBtn.addEventListener('click', () => dom.fileInput.click());

  dom.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) handleFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file later
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dom.sidebar.addEventListener(evt, (e) => {
      e.preventDefault();
      dom.sidebar.classList.add('is-drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dom.sidebar.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === 'dragleave' && dom.sidebar.contains(e.relatedTarget)) return;
      dom.sidebar.classList.remove('is-drag-over');
    });
  });
  dom.sidebar.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });
}

/* ==========================================================================
   9. PLAYBACK — LOADING & TRANSPORT
   ========================================================================== */
function loadSong(index, { autoplay = false, resumeAt = 0 } = {}) {
  if (index < 0 || index >= songs.length) return;
  state.currentIndex = index;
  const song = songs[index];

  // --- Update audio source ---
  dom.audio.src = song.src;
  dom.audio.playbackRate = state.playbackRate;
  dom.progressBar.classList.add('is-loading');

  // --- Update info panel ---
  dom.songTitle.textContent = song.title;
  dom.songArtist.textContent = song.artist;
  dom.songAlbum.textContent = song.album;
  document.title = `${song.title} · ${song.artist} — Aurora`;

  // --- Cover art (with graceful fallback for local uploads that have none) ---
  dom.coverBox.classList.remove('is-loaded');
  if (song.cover) {
    dom.coverImg.style.display = '';
    dom.coverImg.src = song.cover;
    dom.coverImg.alt = `${song.title} album cover`;
    dom.coverImg.onload = () => dom.coverBox.classList.add('is-loaded');
    dom.coverImg.onerror = () => dom.coverBox.classList.remove('is-loaded');
  } else {
    dom.coverImg.style.display = 'none';
    dom.coverImg.removeAttribute('src');
  }

  dom.totalTimeEl.textContent = song.duration ? formatTime(song.duration) : '0:00';
  dom.currentTimeEl.textContent = '0:00';
  updateProgressUI(0);

  syncFavoriteUI();
  renderPlaylist();
  renderQueue();
  storage.set(STORE.lastSongId, song.id);

  if (state.isShuffle) buildShuffleOrder();

  const onReady = () => {
    if (resumeAt > 0 && resumeAt < dom.audio.duration) dom.audio.currentTime = resumeAt;
    dom.progressBar.classList.remove('is-loading');
    if (autoplay) play();
    dom.audio.removeEventListener('loadedmetadata', onReady);
  };
  dom.audio.addEventListener('loadedmetadata', onReady);
}

function play() {
  const playPromise = dom.audio.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch((err) => {
      console.warn('Playback failed:', err);
      toast('Add your audio files to assets/songs/ to enable playback.', 'error', 4500);
      setPlayingState(false);
    });
  }
}

function pause() { dom.audio.pause(); }

function togglePlay() {
  if (state.isPlaying) pause(); else play();
}

function setPlayingState(playing) {
  state.isPlaying = playing;
  dom.playIcon.className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
  dom.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  dom.coverBox.classList.toggle('is-spinning', playing);
  dom.coverBox.classList.toggle('is-floating', !playing);
  dom.equalizer.classList.toggle('is-playing', playing);
  dom.nowPlayingIndicator.classList.toggle('is-playing', playing);
  dom.nowPlayingText.textContent = playing
    ? `${songs[state.currentIndex].title} — ${songs[state.currentIndex].artist}`
    : 'Nothing playing';

  document.querySelectorAll('.track').forEach(li => {
    const idx = Number(li.dataset.index);
    const overlayIcon = li.querySelector('.track__play-overlay i');
    if (overlayIcon) overlayIcon.className = `fa-solid ${idx === state.currentIndex && playing ? 'fa-pause' : 'fa-play'}`;
  });

  if (playing) startProgressLoop(); else stopProgressLoop();
}

function nextIndex() {
  if (state.isShuffle) {
    const pos = state.shuffleOrder.indexOf(state.currentIndex);
    if (pos === -1 || pos === state.shuffleOrder.length - 1) {
      if (state.repeatMode === 'all') { buildShuffleOrder(); return state.shuffleOrder[0]; }
      return null;
    }
    return state.shuffleOrder[pos + 1];
  }
  if (state.currentIndex < songs.length - 1) return state.currentIndex + 1;
  return state.repeatMode === 'all' ? 0 : null;
}

function prevIndex() {
  if (state.isShuffle) {
    const pos = state.shuffleOrder.indexOf(state.currentIndex);
    if (pos > 0) return state.shuffleOrder[pos - 1];
    return state.repeatMode === 'all' ? state.shuffleOrder[state.shuffleOrder.length - 1] : state.currentIndex;
  }
  if (state.currentIndex > 0) return state.currentIndex - 1;
  return state.repeatMode === 'all' ? songs.length - 1 : 0;
}

function goNext(auto = false) {
  // If we're more than 3s into a track and the user hit "previous" logic doesn't apply here;
  // "next" always advances.
  const idx = nextIndex();
  if (idx === null) { setPlayingState(false); return; }
  loadSong(idx, { autoplay: state.isPlaying || auto });
}

function goPrev() {
  // Standard UX: if more than 3s elapsed, restart current track instead of going back.
  if (dom.audio.currentTime > 3) {
    dom.audio.currentTime = 0;
    return;
  }
  const idx = prevIndex();
  loadSong(idx, { autoplay: state.isPlaying });
}

/* ==========================================================================
   10. PROGRESS / SEEK (rAF-driven for smooth 60fps updates)
   ========================================================================== */
function updateProgressUI(ratio) {
  const pct = Math.min(1, Math.max(0, ratio)) * 100;
  dom.progressFill.style.width = `${pct}%`;
  dom.progressHandle.style.left = `${pct}%`;
  dom.progressBar.setAttribute('aria-valuenow', String(Math.round(pct)));

  const offset = RING_CIRCUMFERENCE * (1 - pct / 100);
  dom.eqRingProgress.style.strokeDashoffset = String(offset);
}

function startProgressLoop() {
  stopProgressLoop();
  const tick = () => {
    if (!state.isSeeking && dom.audio.duration) {
      updateProgressUI(dom.audio.currentTime / dom.audio.duration);
      dom.currentTimeEl.textContent = formatTime(dom.audio.currentTime);
    }
    state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}
function stopProgressLoop() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
}

function seekToRatio(ratio) {
  if (!dom.audio.duration) return;
  const time = Math.min(1, Math.max(0, ratio)) * dom.audio.duration;
  dom.audio.currentTime = time;
  updateProgressUI(ratio);
  dom.currentTimeEl.textContent = formatTime(time);
}

function bindSeekBar(bar, onSeek) {
  const ratioFromEvent = (e) => {
    const rect = bar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) / rect.width;
  };

  bar.addEventListener('pointerdown', (e) => {
    state.isSeeking = true;
    bar.classList.add('is-dragging');
    onSeek(ratioFromEvent(e));
    const move = (ev) => onSeek(ratioFromEvent(ev));
    const up = () => {
      state.isSeeking = false;
      bar.classList.remove('is-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  bar.addEventListener('keydown', (e) => {
    const step = 0.02;
    let ratio = null;
    if (bar === dom.progressBar) {
      const current = dom.audio.duration ? dom.audio.currentTime / dom.audio.duration : 0;
      if (e.key === 'ArrowRight') ratio = current + step;
      if (e.key === 'ArrowLeft') ratio = current - step;
    } else {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') ratio = state.volume + 0.05;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ratio = state.volume - 0.05;
    }
    if (ratio !== null) {
      e.preventDefault();
      e.stopPropagation();
      onSeek(Math.min(1, Math.max(0, ratio)));
    }
  });
}

/* ==========================================================================
   11. VOLUME
   ========================================================================== */
function applyVolume(vol, { persist = true } = {}) {
  state.volume = Math.min(1, Math.max(0, vol));
  dom.audio.volume = state.volume;
  if (state.volume > 0 && state.isMuted) setMuted(false);
  dom.volumeFill.style.width = `${state.volume * 100}%`;
  dom.volumeHandle.style.left = `${state.volume * 100}%`;
  dom.volumeBar.setAttribute('aria-valuenow', String(Math.round(state.volume * 100)));
  updateVolumeIcon();
  if (persist) storage.set(STORE.volume, state.volume);
}

function setMuted(muted) {
  state.isMuted = muted;
  dom.audio.muted = muted;
  dom.muteBtn.setAttribute('aria-pressed', String(muted));
  dom.muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  updateVolumeIcon();
  storage.set(STORE.muted, muted);
}

function updateVolumeIcon() {
  let icon = 'fa-volume-high';
  if (state.isMuted || state.volume === 0) icon = 'fa-volume-xmark';
  else if (state.volume < 0.5) icon = 'fa-volume-low';
  dom.volumeIcon.className = `fa-solid ${icon}`;
}

/* ==========================================================================
   12. SHUFFLE / REPEAT
   ========================================================================== */
function setShuffle(on) {
  state.isShuffle = on;
  dom.shuffleBtn.classList.toggle('is-active', on);
  dom.shuffleBtn.setAttribute('aria-pressed', String(on));
  storage.set(STORE.shuffle, on);
  if (on) buildShuffleOrder();
  renderQueue();
  toast(on ? 'Shuffle on' : 'Shuffle off', 'info', 1500);
}

const REPEAT_CYCLE = ['off', 'all', 'one'];
const REPEAT_ICON = { off: 'fa-repeat', all: 'fa-repeat', one: 'fa-1' };
function setRepeat(mode) {
  state.repeatMode = mode;
  dom.repeatBtn.dataset.mode = mode;
  dom.repeatBtn.classList.toggle('is-active', mode !== 'off');
  dom.repeatBtn.setAttribute('aria-label', `Repeat ${mode === 'off' ? 'off' : mode === 'all' ? 'all' : 'one'}`);
  dom.repeatOneDot.hidden = mode !== 'one';
  storage.set(STORE.repeat, mode);
  renderQueue();
  toast(`Repeat: ${mode === 'off' ? 'off' : mode === 'all' ? 'all tracks' : 'one track'}`, 'info', 1500);
}
function cycleRepeat() {
  const idx = REPEAT_CYCLE.indexOf(state.repeatMode);
  setRepeat(REPEAT_CYCLE[(idx + 1) % REPEAT_CYCLE.length]);
}

/* ==========================================================================
   13. THEME
   ========================================================================== */
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  dom.themeIcon.className = `fa-solid ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`;
  dom.themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
  dom.themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  storage.set(STORE.theme, theme);
}

/* ==========================================================================
   14. EVENT WIRING
   ========================================================================== */
function bindEvents() {
  bindUploadEvents();

  // --- Transport controls ---
  dom.playBtn.addEventListener('click', (e) => { ripple(e, dom.playBtn); togglePlay(); });
  dom.nextBtn.addEventListener('click', (e) => { ripple(e, dom.nextBtn); goNext(); });
  dom.prevBtn.addEventListener('click', (e) => { ripple(e, dom.prevBtn); goPrev(); });
  dom.shuffleBtn.addEventListener('click', (e) => { ripple(e, dom.shuffleBtn); setShuffle(!state.isShuffle); });
  dom.repeatBtn.addEventListener('click', (e) => { ripple(e, dom.repeatBtn); cycleRepeat(); });
  dom.favoriteBtn.addEventListener('click', () => toggleFavorite(songs[state.currentIndex].id));

  // --- Audio element events ---
  dom.audio.addEventListener('play', () => setPlayingState(true));
  dom.audio.addEventListener('pause', () => setPlayingState(false));
  dom.audio.addEventListener('loadedmetadata', () => {
    const song = songs[state.currentIndex];
    song.duration = dom.audio.duration || 0;
    const durations = storage.get(STORE.durations, {});
    durations[song.id] = song.duration;
    storage.set(STORE.durations, durations);
    dom.totalTimeEl.textContent = formatTime(song.duration);
    renderPlaylist();
  });
  dom.audio.addEventListener('progress', () => {
    if (dom.audio.buffered.length && dom.audio.duration) {
      const end = dom.audio.buffered.end(dom.audio.buffered.length - 1);
      dom.progressBuffered.style.width = `${(end / dom.audio.duration) * 100}%`;
    }
  });
  dom.audio.addEventListener('waiting', () => dom.progressBar.classList.add('is-loading'));
  dom.audio.addEventListener('canplay', () => dom.progressBar.classList.remove('is-loading'));
  dom.audio.addEventListener('ended', () => {
    if (state.repeatMode === 'one') { dom.audio.currentTime = 0; play(); return; }
    pushRecent(songs[state.currentIndex].id);
    goNext(true);
  });
  dom.audio.addEventListener('error', () => {
    dom.progressBar.classList.remove('is-loading');
    const code = dom.audio.error ? dom.audio.error.code : 0;
    const messages = {
      1: 'Playback was aborted.',
      2: 'A network error interrupted the download.',
      3: 'This audio file could not be decoded.',
      4: 'Audio file not found — add it to assets/songs/.',
    };
    toast(messages[code] || 'This track could not be loaded.', 'error');
    setPlayingState(false);
  });

  // --- Progress + volume bars ---
  bindSeekBar(dom.progressBar, seekToRatio);
  bindSeekBar(dom.volumeBar, applyVolume);
  dom.volumeBar.addEventListener('pointerdown', (e) => {
    const rect = dom.volumeBar.getBoundingClientRect();
    applyVolume((e.clientX - rect.left) / rect.width);
  });

  dom.muteBtn.addEventListener('click', () => setMuted(!state.isMuted));

  // --- Speed menu ---
  dom.speedBtn.addEventListener('click', () => {
    const isOpen = !dom.speedMenu.hidden;
    dom.speedMenu.hidden = isOpen;
    dom.speedBtn.setAttribute('aria-expanded', String(!isOpen));
  });
  dom.speedMenu.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      const rate = parseFloat(li.dataset.speed);
      state.playbackRate = rate;
      dom.audio.playbackRate = rate;
      dom.speedLabel.textContent = `${rate.toFixed(2).replace(/\.?0+$/, '') || rate}x`.replace(/^(\d)x$/, '$1.0x');
      dom.speedMenu.querySelectorAll('li').forEach(o => o.setAttribute('aria-selected', 'false'));
      li.setAttribute('aria-selected', 'true');
      dom.speedMenu.hidden = true;
      dom.speedBtn.setAttribute('aria-expanded', 'false');
      storage.set(STORE.speed, rate);
    });
  });
  document.addEventListener('click', (e) => {
    if (!dom.speed.contains(e.target)) { dom.speedMenu.hidden = true; dom.speedBtn.setAttribute('aria-expanded', 'false'); }
  });

  // --- Queue panel ---
  dom.queueBtn.addEventListener('click', () => {
    const isHidden = dom.queuePanel.hidden;
    dom.queuePanel.hidden = !isHidden;
    dom.queueBtn.setAttribute('aria-pressed', String(isHidden));
    if (isHidden) renderQueue();
  });
  dom.queueClose.addEventListener('click', () => {
    dom.queuePanel.hidden = true;
    dom.queueBtn.setAttribute('aria-pressed', 'false');
  });

  // --- Theme ---
  dom.themeToggle.addEventListener('click', () => {
    applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  // --- Search ---
  const runSearch = debounce((value) => {
    state.searchQuery = value;
    dom.searchClear.hidden = value.length === 0;
    renderPlaylist();
  }, 220);
  dom.searchInput.addEventListener('input', (e) => runSearch(e.target.value));
  dom.searchClear.addEventListener('click', () => {
    dom.searchInput.value = '';
    state.searchQuery = '';
    dom.searchClear.hidden = true;
    renderPlaylist();
    dom.searchInput.focus();
  });

  // --- Sidebar tabs ---
  dom.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.tabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      state.filter = tab.dataset.filter;
      renderPlaylist();
    });
  });

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement.tagName;
    const isTypingContext = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
    const isSliderFocused = document.activeElement === dom.progressBar || document.activeElement === dom.volumeBar;
    if (isTypingContext || isSliderFocused) return; // sliders handle their own arrow keys

    switch (e.key) {
      case ' ':
        e.preventDefault(); togglePlay(); break;
      case 'ArrowRight':
        goNext(); break;
      case 'ArrowLeft':
        goPrev(); break;
      case 'ArrowUp':
        e.preventDefault(); applyVolume(state.volume + 0.05); break;
      case 'ArrowDown':
        e.preventDefault(); applyVolume(state.volume - 0.05); break;
      case 'm': case 'M':
        setMuted(!state.isMuted); break;
      case 's': case 'S':
        setShuffle(!state.isShuffle); break;
      case 'r': case 'R':
        cycleRepeat(); break;
    }
  });

  // --- Persist playback position periodically & on unload ---
  setInterval(() => {
    if (state.isPlaying) storage.set(STORE.position, dom.audio.currentTime);
  }, 5000);
  window.addEventListener('beforeunload', () => {
    storage.set(STORE.position, dom.audio.currentTime);
  });
}

/* ==========================================================================
   15. INIT
   ========================================================================== */
function init() {
  // Theme
  const savedTheme = storage.get(STORE.theme, 'dark');
  applyTheme(savedTheme);

  // Volume / mute
  applyVolume(state.volume, { persist: false });
  setMuted(state.isMuted);

  // Shuffle / repeat UI
  dom.shuffleBtn.classList.toggle('is-active', state.isShuffle);
  dom.shuffleBtn.setAttribute('aria-pressed', String(state.isShuffle));
  setRepeatSilently(state.repeatMode);

  // Speed label
  const rateOption = dom.speedMenu.querySelector(`li[data-speed="${state.playbackRate}"]`);
  if (rateOption) {
    dom.speedMenu.querySelectorAll('li').forEach(o => o.setAttribute('aria-selected', 'false'));
    rateOption.setAttribute('aria-selected', 'true');
    dom.speedLabel.textContent = `${state.playbackRate}x`.replace(/^(\d)x$/, '$1.0x');
  }

  bindEvents();

  // Restore last song (without autoplay — browsers block that anyway)
  const lastId = storage.get(STORE.lastSongId, songs[0].id);
  const lastIndex = Math.max(0, songs.findIndex(s => s.id === lastId));
  const resumeAt = storage.get(STORE.position, 0);
  if (state.isShuffle) buildShuffleOrder();
  loadSong(lastIndex, { autoplay: false, resumeAt });

  renderPlaylist();
  renderQueue();

  revealApp();
}

function setRepeatSilently(mode) {
  state.repeatMode = mode;
  dom.repeatBtn.dataset.mode = mode;
  dom.repeatBtn.classList.toggle('is-active', mode !== 'off');
  dom.repeatOneDot.hidden = mode !== 'one';
}

function revealApp() {
  const finish = () => {
    dom.loadingScreen.classList.add('is-hidden');
    dom.app.hidden = false;
    setTimeout(() => dom.loadingScreen.remove(), 650);
  };
  // Give the loading screen a brief, deliberate moment rather than an instant cut.
  if (document.readyState === 'complete') setTimeout(finish, 500);
  else window.addEventListener('load', () => setTimeout(finish, 500));
}

/* ==========================================================================
   16. ERROR BOUNDARY — unsupported browser check
   ========================================================================== */
(function checkSupport() {
  if (typeof Audio === 'undefined' || !document.createElement('audio').canPlayType) {
    document.addEventListener('DOMContentLoaded', () => {
      dom.loadingScreen.innerHTML = `
        <div class="loading-content">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;color:#ff6b6b"></i>
          <p class="loading-text">Your browser doesn't support the HTML5 Audio API needed for Aurora.</p>
        </div>`;
    });
    return;
  }
  document.addEventListener('DOMContentLoaded', init);
})();
