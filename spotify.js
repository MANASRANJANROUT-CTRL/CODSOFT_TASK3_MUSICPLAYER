(function(){
  "use strict";

  // ---------------------------------------------------------------
  // Spotify Connect (Implicit Grant flow — no backend required).
  // You must register your own free app at
  // https://developer.spotify.com/dashboard and add the redirect URI
  // shown in the modal. Anthropic cannot ship a shared Client ID
  // because Spotify issues credentials per-application.
  //
  // Note: the access token lives only in memory for this tab (no
  // localStorage/sessionStorage is used), so reloading the page will
  // require reconnecting.
  // ---------------------------------------------------------------

  const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
  const API_BASE = 'https://api.spotify.com/v1';
  const SCOPES = ['playlist-read-private', 'playlist-read-collaborative', 'user-read-private'];

  let accessToken = null;
  let currentPlaylistTracks = [];

  const redirectUri = window.location.origin + window.location.pathname;

  // ---------- Elements ----------
  const connectBtn1 = document.getElementById('spotifyConnectBtn');
  const connectBtn2 = document.getElementById('spotifyConnectBtn2');
  const spotifyBtnLabel = document.getElementById('spotifyBtnLabel');
  const modalBackdrop = document.getElementById('spotifyModalBackdrop');
  const modalClose = document.getElementById('spotifyModalClose');
  const redirectUriDisplay = document.getElementById('redirectUriDisplay');
  const copyRedirectBtn = document.getElementById('copyRedirectBtn');
  const clientIdInput = document.getElementById('clientIdInput');
  const authorizeBtn = document.getElementById('authorizeBtn');

  const disconnectedView = document.getElementById('spotifyDisconnected');
  const connectedView = document.getElementById('spotifyConnected');
  const profileEl = document.getElementById('spotifyProfile');
  const playlistsView = document.getElementById('spotifyPlaylistsView');
  const tracksView = document.getElementById('spotifyTracksView');

  redirectUriDisplay.textContent = redirectUri;

  // ---------- Modal open/close ----------
  function openModal(){ modalBackdrop.hidden = false; }
  function closeModal(){ modalBackdrop.hidden = true; }
  connectBtn1.addEventListener('click', openModal);
  connectBtn2.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => { if(e.target === modalBackdrop) closeModal(); });

  copyRedirectBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(redirectUri).then(() => {
      copyRedirectBtn.textContent = 'Copied';
      setTimeout(() => copyRedirectBtn.textContent = 'Copy', 1500);
    });
  });

  // ---------- Kick off auth ----------
  authorizeBtn.addEventListener('click', () => {
    const clientId = clientIdInput.value.trim();
    if(!clientId){
      clientIdInput.style.borderColor = 'var(--red)';
      clientIdInput.focus();
      return;
    }
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'token',
      redirect_uri: redirectUri,
      scope: SCOPES.join(' '),
      show_dialog: 'true'
    });
    window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
  });

  // ---------- Handle redirect back with token in URL hash ----------
  function parseTokenFromHash(){
    if(!window.location.hash) return null;
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');
    if(token){
      history.replaceState(null, '', window.location.pathname + window.location.search);
      return token;
    }
    return null;
  }

  async function spotifyFetch(path){
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if(!res.ok){
      if(res.status === 401){ disconnect(); }
      throw new Error(`Spotify API error ${res.status}`);
    }
    return res.json();
  }

  // ---------- Connected state ----------
  async function onConnected(){
    disconnectedView.hidden = true;
    connectedView.hidden = false;
    spotifyBtnLabel.textContent = 'Connected';
    connectBtn1.classList.add('toggled');
    closeModal();

    try{
      const me = await spotifyFetch('/me');
      profileEl.innerHTML = `
        ${me.images && me.images[0] ? `<img src="${me.images[0].url}" alt="">` : ''}
        <span class="sp-name">${escapeHtml(me.display_name || 'Spotify user')}</span>
        <span class="sp-disconnect" id="spDisconnectBtn">Disconnect</span>
      `;
      document.getElementById('spDisconnectBtn').addEventListener('click', disconnect);
      await loadPlaylists();
    }catch(err){
      playlistsView.innerHTML = `<p class="spotify-empty">Couldn't load your Spotify account. Try reconnecting.</p>`;
    }
  }

  function disconnect(){
    accessToken = null;
    disconnectedView.hidden = false;
    connectedView.hidden = true;
    spotifyBtnLabel.textContent = 'Connect Spotify';
    connectBtn1.classList.remove('toggled');
  }

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ---------- Playlists ----------
  async function loadPlaylists(){
    playlistsView.innerHTML = `<p class="spotify-empty">Loading playlists…</p>`;
    tracksView.hidden = true;
    playlistsView.hidden = false;
    try{
      const data = await spotifyFetch('/me/playlists?limit=50');
      if(!data.items || !data.items.length){
        playlistsView.innerHTML = `<p class="spotify-empty">No playlists found on this account.</p>`;
        return;
      }
      playlistsView.innerHTML = '';
      data.items.forEach(pl => {
        const cover = pl.images && pl.images[0] ? pl.images[0].url : '';
        const row = document.createElement('div');
        row.className = 'sp-playlist-row';
        row.innerHTML = `
          ${cover ? `<img class="sp-cover" src="${cover}" alt="">` : `<span class="sp-cover"></span>`}
          <span class="sp-pl-info">
            <span class="sp-pl-name">${escapeHtml(pl.name)}</span>
            <span class="sp-pl-count">${pl.tracks.total} tracks</span>
          </span>
        `;
        row.addEventListener('click', () => openPlaylist(pl));
        playlistsView.appendChild(row);
      });
    }catch(err){
      playlistsView.innerHTML = `<p class="spotify-empty">Couldn't load playlists.</p>`;
    }
  }

  // ---------- Playlist tracks ----------
  async function openPlaylist(playlist){
    playlistsView.hidden = true;
    tracksView.hidden = false;
    tracksView.innerHTML = `<p class="spotify-empty">Loading tracks…</p>`;
    try{
      const data = await spotifyFetch(`/playlists/${playlist.id}/tracks?limit=100&fields=items(track(id,name,artists,album,preview_url,external_urls))`);
      currentPlaylistTracks = (data.items || [])
        .map(it => it.track)
        .filter(Boolean);

      tracksView.innerHTML = '';

      const back = document.createElement('div');
      back.className = 'sp-back';
      back.innerHTML = `&larr; ${escapeHtml(playlist.name)}`;
      back.addEventListener('click', () => { tracksView.hidden = true; playlistsView.hidden = false; });
      tracksView.appendChild(back);

      const importAllBtn = document.createElement('button');
      importAllBtn.className = 'pill-btn spotify-btn sp-import-all';
      const playableCount = currentPlaylistTracks.filter(t => t.preview_url).length;
      importAllBtn.textContent = `Import all (${playableCount} playable of ${currentPlaylistTracks.length})`;
      importAllBtn.addEventListener('click', () => {
        const toImport = currentPlaylistTracks
          .filter(t => t.preview_url)
          .map(mapSpotifyTrack);
        window.Player.addTracks(toImport, { play:false });
        window.Player.switchToLibraryTab();
      });
      tracksView.appendChild(importAllBtn);

      currentPlaylistTracks.forEach(t => {
        const cover = t.album && t.album.images && t.album.images[t.album.images.length-1]
          ? t.album.images[t.album.images.length-1].url : '';
        const artists = (t.artists || []).map(a => a.name).join(', ');
        const row = document.createElement('div');
        row.className = 'sp-track-row';
        if(t.preview_url){
          row.innerHTML = `
            ${cover ? `<img class="sp-cover" src="${cover}" alt="">` : `<span class="sp-cover"></span>`}
            <span class="sp-track-info">
              <span class="sp-track-title">${escapeHtml(t.name)}</span>
              <span class="sp-track-artist">${escapeHtml(artists)}</span>
            </span>
            <button class="sp-add-btn" title="Add to queue">+</button>
          `;
          row.querySelector('.sp-add-btn').addEventListener('click', (e) => {
            window.Player.addTracks([mapSpotifyTrack(t)], { play:false });
            e.currentTarget.textContent = '✓';
            e.currentTarget.classList.add('added');
          });
        } else {
          row.innerHTML = `
            ${cover ? `<img class="sp-cover" src="${cover}" alt="">` : `<span class="sp-cover"></span>`}
            <span class="sp-track-info">
              <span class="sp-track-title">${escapeHtml(t.name)}</span>
              <span class="sp-track-artist">${escapeHtml(artists)}</span>
            </span>
            <a class="sp-no-preview" href="${t.external_urls ? t.external_urls.spotify : '#'}" target="_blank" rel="noopener">Open in Spotify</a>
          `;
        }
        tracksView.appendChild(row);
      });
    }catch(err){
      tracksView.innerHTML = `<p class="spotify-empty">Couldn't load tracks.</p>`;
    }
  }

  function mapSpotifyTrack(t){
    const cover = t.album && t.album.images && t.album.images[0] ? t.album.images[0].url : null;
    return {
      title: t.name,
      artist: (t.artists || []).map(a => a.name).join(', '),
      src: t.preview_url,
      art: cover,
      source: 'spotify'
    };
  }

  // ---------- Init ----------
  const tokenFromHash = parseTokenFromHash();
  if(tokenFromHash){
    accessToken = tokenFromHash;
    onConnected();
  }

})();