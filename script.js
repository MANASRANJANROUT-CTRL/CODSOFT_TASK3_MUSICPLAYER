(function(){
  "use strict";

  // ---------- Data ----------
  const palettes = [
    ['#f0b458','#c97a2e'], ['#e8896a','#b34a3a'], ['#7fbfa0','#3f7a5f'],
    ['#8fa8d6','#4a5e8f'], ['#d6a5d9','#8a5a90'], ['#e0c96a','#a68a2e']
  ];

  const tracks = [
    { title:"Nocturne Radio", artist:"Midnight Frequency", src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", fav:false, dur:0 },
    { title:"Cassette Bloom", artist:"Analog Drift", src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", fav:false, dur:0 },
    { title:"Static & Amber", artist:"Low Fidelity Society", src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", fav:false, dur:0 },
    { title:"Second Floor Lounge", artist:"Vinyl Room", src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", fav:false, dur:0 },
    { title:"Slow Dial", artist:"Copper Wire", src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", fav:false, dur:0 },
    { title:"After Hours Static", artist:"Nocturne Radio", src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", fav:false, dur:0 }
  ];

  // ---------- State ----------
  let current = 0;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 0; // 0 off, 1 all, 2 one
  let isMuted = false;
  let lastVolume = 80;
  let history = [];

  // ---------- Elements ----------
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('playBtn');
  const playIcon = document.getElementById('playIcon');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const favBtn = document.getElementById('favBtn');
  const muteBtn = document.getElementById('muteBtn');
  const volIcon = document.getElementById('volIcon');
  const volumeInput = document.getElementById('volume');
  const seek = document.getElementById('seek');
  const progressFill = document.getElementById('progressFill');
  const curTimeEl = document.getElementById('curTime');
  const durTimeEl = document.getElementById('durTime');
  const trackTitleEl = document.getElementById('trackTitle');
  const trackArtistEl = document.getElementById('trackArtist');
  const labelTitleEl = document.getElementById('labelTitle');
  const recordLabelEl = document.getElementById('recordLabel');
  const recordEl = document.getElementById('record');
  const tonearmEl = document.getElementById('tonearm');
  const ledDot = document.getElementById('ledDot');
  const playlistEl = document.getElementById('playlist');
  const trackCountEl = document.getElementById('trackCount');
  const fileInput = document.getElementById('fileInput');

  // ---------- Helpers ----------
  function fmtTime(s){
    if(!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2,'0');
    return `${m}:${sec}`;
  }

  function paletteFor(i){ return palettes[i % palettes.length]; }

  function renderPlaylist(){
    playlistEl.innerHTML = '';
    tracks.forEach((t, i) => {
      const [c1,c2] = paletteFor(i);
      const li = document.createElement('li');
      li.className = 'track-row' + (i === current ? ' active' : '');
      li.innerHTML = `
        <span class="track-num mono">${String(i+1).padStart(2,'0')}</span>
        <span class="track-swatch" style="background:linear-gradient(135deg, ${c1}, ${c2})"></span>
        <span class="track-info">
          <span class="t-title">${escapeHtml(t.title)}</span>
          <span class="t-artist">${escapeHtml(t.artist)}</span>
        </span>
        <span class="track-dur mono">${t.dur ? fmtTime(t.dur) : '--:--'}</span>
        <button class="fav-toggle${t.fav ? ' active' : ''}" data-idx="${i}" title="Favorite">
          <svg viewBox="0 0 24 24" fill="${t.fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>
        </button>
      `;
      li.addEventListener('click', (e) => {
        if(e.target.closest('.fav-toggle')) return;
        loadTrack(i, true);
      });
      li.querySelector('.fav-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        t.fav = !t.fav;
        renderPlaylist();
        if(i === current) updateFavButton();
      });
      playlistEl.appendChild(li);
    });
    trackCountEl.textContent = `${String(current+1).padStart(2,'0')} / ${String(tracks.length).padStart(2,'0')}`;
  }

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function updateFavButton(){
    const on = tracks[current].fav;
    favBtn.classList.toggle('toggled', on);
    favBtn.querySelector('svg').setAttribute('fill', on ? 'currentColor' : 'none');
    favBtn.style.color = on ? 'var(--red)' : '';
  }

  function loadTrack(index, autoplay){
    current = index;
    const t = tracks[current];
    audio.src = t.src;
    trackTitleEl.textContent = t.title;
    trackArtistEl.textContent = t.artist;
    labelTitleEl.textContent = t.title;
    const [c1,c2] = paletteFor(current);
    recordLabelEl.style.background = `radial-gradient(circle at 35% 30%, ${c1}, ${c2} 75%)`;
    updateFavButton();
    renderPlaylist();
    seek.value = 0;
    progressFill.style.width = '0%';
    curTimeEl.textContent = '0:00';
    durTimeEl.textContent = t.dur ? fmtTime(t.dur) : '0:00';
    history.push(current);
    if(autoplay !== false){
      play();
    } else {
      pause();
    }
  }

  function play(){
    audio.play().catch(()=>{ /* autoplay may be blocked until user interacts */ });
    isPlaying = true;
    playIcon.innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"></path>';
    recordEl.classList.add('spinning');
    tonearmEl.classList.add('active');
    ledDot.classList.add('on');
  }

  function pause(){
    audio.pause();
    isPlaying = false;
    playIcon.innerHTML = '<path d="M8 5v14l11-7z"></path>';
    recordEl.classList.remove('spinning');
    tonearmEl.classList.remove('active');
    ledDot.classList.remove('on');
  }

  function togglePlay(){ isPlaying ? pause() : play(); }

  function pickShuffleIndex(){
    if(tracks.length <= 1) return current;
    let idx;
    do { idx = Math.floor(Math.random() * tracks.length); } while(idx === current);
    return idx;
  }

  function goNext(userTriggered){
    if(repeatMode === 2 && !userTriggered){
      audio.currentTime = 0;
      play();
      return;
    }
    let nextIdx;
    if(isShuffle){
      nextIdx = pickShuffleIndex();
    } else {
      nextIdx = current + 1;
      if(nextIdx >= tracks.length){
        if(repeatMode === 1){ nextIdx = 0; }
        else { pause(); return; }
      }
    }
    loadTrack(nextIdx, true);
  }

  function goPrev(){
    if(audio.currentTime > 3){
      audio.currentTime = 0;
      return;
    }
    let prevIdx = isShuffle ? pickShuffleIndex() : (current - 1 + tracks.length) % tracks.length;
    loadTrack(prevIdx, true);
  }

  // ---------- Events ----------
  playBtn.addEventListener('click', togglePlay);
  nextBtn.addEventListener('click', () => goNext(true));
  prevBtn.addEventListener('click', goPrev);

  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('toggled', isShuffle);
  });

  repeatBtn.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.classList.toggle('toggled', repeatMode !== 0);
    repeatBtn.style.color = repeatMode === 2 ? 'var(--amber)' : (repeatMode === 1 ? 'var(--amber)' : '');
    repeatBtn.title = repeatMode === 0 ? 'Repeat: off' : (repeatMode === 1 ? 'Repeat: all' : 'Repeat: one');
  });

  favBtn.addEventListener('click', () => {
    tracks[current].fav = !tracks[current].fav;
    updateFavButton();
    renderPlaylist();
  });

  audio.addEventListener('timeupdate', () => {
    if(!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = pct + '%';
    seek.value = pct;
    curTimeEl.textContent = fmtTime(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', () => {
    durTimeEl.textContent = fmtTime(audio.duration);
    tracks[current].dur = audio.duration;
    renderPlaylist();
  });

  audio.addEventListener('ended', () => goNext(false));

  seek.addEventListener('input', () => {
    if(!audio.duration) return;
    audio.currentTime = (seek.value / 100) * audio.duration;
    progressFill.style.width = seek.value + '%';
  });

  volumeInput.addEventListener('input', () => {
    const v = Number(volumeInput.value);
    audio.volume = v / 100;
    isMuted = v === 0;
    lastVolume = v || lastVolume;
    updateVolIcon();
  });

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    if(isMuted){
      lastVolume = Number(volumeInput.value) || lastVolume;
      audio.volume = 0;
      volumeInput.value = 0;
    } else {
      audio.volume = (lastVolume || 80) / 100;
      volumeInput.value = lastVolume || 80;
    }
    updateVolIcon();
  });

  function updateVolIcon(){
    const v = Number(volumeInput.value);
    let path;
    if(v === 0){
      path = '<path d="M16.5 12L20 15.5l-1.4 1.4L15 13.4l-3.5 3.5L10 15.5 13.6 12 10 8.5 11.5 7 15 10.6 18.5 7 20 8.5z"></path>';
    } else if(v < 50){
      path = '<path d="M5 9v6h4l5 5V4L9 9H5zM16.5 12a3.5 3.5 0 0 0-2-3.16v6.32A3.5 3.5 0 0 0 16.5 12z"></path>';
    } else {
      path = '<path d="M5 9v6h4l5 5V4L9 9H5zM16.5 12a3.5 3.5 0 0 0-2-3.16v6.32A3.5 3.5 0 0 0 16.5 12zM19 12a6.98 6.98 0 0 0-4-6.32v1.9A5 5 0 0 1 17 12a5 5 0 0 1-2 4.42v1.9A6.98 6.98 0 0 0 19 12z"></path>';
    }
    volIcon.innerHTML = path;
  }

  // File upload — play local files
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if(!files.length) return;
    const startIdx = tracks.length;
    files.forEach((f) => {
      const url = URL.createObjectURL(f);
      const name = f.name.replace(/\.[^/.]+$/, '');
      tracks.push({ title: name, artist: "Local file", src: url, fav:false, dur:0 });
    });
    renderPlaylist();
    loadTrack(startIdx, true);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if(e.target.tagName === 'INPUT') return;
    if(e.code === 'Space'){ e.preventDefault(); togglePlay(); }
    else if(e.code === 'ArrowRight'){ audio.currentTime = Math.min(audio.duration||0, audio.currentTime + 5); }
    else if(e.code === 'ArrowLeft'){ audio.currentTime = Math.max(0, audio.currentTime - 5); }
    else if(e.code === 'ArrowUp'){ e.preventDefault(); volumeInput.value = Math.min(100, Number(volumeInput.value)+5); volumeInput.dispatchEvent(new Event('input')); }
    else if(e.code === 'ArrowDown'){ e.preventDefault(); volumeInput.value = Math.max(0, Number(volumeInput.value)-5); volumeInput.dispatchEvent(new Event('input')); }
  });

  // ---------- Init ----------
  audio.volume = 0.8;
  renderPlaylist();
  loadTrack(0, false);
  updateVolIcon();

})();