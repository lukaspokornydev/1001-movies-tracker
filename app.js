import moviesList from './list.js';
import { ProfileAuth } from './auth.js';

let db;
let profileAuth;
let watchedMovies = new Set();
let allMovies = moviesList.movies;

// Initialize Firebase
async function initFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { firebaseConfig } = await import('./firebase-config.js');

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);

    // Initialize profile authentication
    profileAuth = new ProfileAuth();
    const profile = await profileAuth.initialize(db);
    
    if (profile) {
      updateUserStatus(profile.username);
      await loadWatchedMovies();
      setupRealtimeSync();
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    document.getElementById('user-status').textContent = 'Offline mode';
    loadLocalWatchedMovies();
  }
}

function updateUserStatus(username) {
  const userStatus = document.getElementById('user-status');
  userStatus.innerHTML = `
    <span class="username">${username}</span>
    <button id="logout-btn" class="logout-btn">Logout</button>
  `;
  
  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      profileAuth.logout();
    }
  });
}

async function loadWatchedMovies() {
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const userId = profileAuth.getUserId();
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      watchedMovies = new Set(data.watchedMovies || []);
      updateStats();
      renderMovies();
    }
  } catch (error) {
    console.error('Error loading watched movies:', error);
  }
}

async function setupRealtimeSync() {
  try {
    const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const userId = profileAuth.getUserId();
    const docRef = doc(db, 'users', userId);
    
    onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        watchedMovies = new Set(data.watchedMovies || []);
        updateStats();
        renderMovies();
      }
    });
  } catch (error) {
    console.error('Error setting up realtime sync:', error);
  }
}

async function toggleWatched(movieTitle) {
  if (watchedMovies.has(movieTitle)) {
    watchedMovies.delete(movieTitle);
  } else {
    watchedMovies.add(movieTitle);
  }
  
  updateStats();
  saveToLocalStorage();
  
  if (db && profileAuth.getUserId()) {
    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const userId = profileAuth.getUserId();
      await updateDoc(doc(db, 'users', userId), {
        watchedMovies: Array.from(watchedMovies)
      });
    } catch (error) {
      console.error('Error updating Firestore:', error);
    }
  }
}

function loadLocalWatchedMovies() {
  const saved = localStorage.getItem('watchedMovies');
  if (saved) {
    watchedMovies = new Set(JSON.parse(saved));
  }
  updateStats();
  renderMovies();
}

function saveToLocalStorage() {
  localStorage.setItem('watchedMovies', JSON.stringify(Array.from(watchedMovies)));
}

function updateStats() {
  document.getElementById('watched-count').textContent = watchedMovies.size;
  document.getElementById('total-count').textContent = allMovies.length;
}

function renderMovies() {
  const container = document.getElementById('movies-container');
  container.innerHTML = '';
  
  allMovies.forEach(movie => {
    const movieCard = document.createElement('div');
    movieCard.className = `movie-card ${watchedMovies.has(movie.title) ? 'watched' : ''}`;
    movieCard.innerHTML = `
      <img src="${movie.img}" alt="${movie.title}">
      <div class="movie-info">
        <h3>${movie.title}</h3>
        <p class="director">${movie.director}</p>
        <p class="year">${movie.year}</p>
        <p class="tags">${movie.tags}</p>
        <p class="length">${movie.length}</p>
      </div>
      <button class="watch-btn">${watchedMovies.has(movie.title) ? '✓ Watched' : 'Mark as Watched'}</button>
    `;
    
    movieCard.querySelector('.watch-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWatched(movie.title);
      movieCard.classList.toggle('watched');
      e.target.textContent = watchedMovies.has(movie.title) ? '✓ Watched' : 'Mark as Watched';
    });
    
    container.appendChild(movieCard);
  });
}

// Initialize app
initFirebase();