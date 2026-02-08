import moviesData from './list.js';

const movies = moviesData.movies;
let watchedMovies = [];
let currentDecade = null;
let userId = null;
let unsubscribe = null;

// Firebase variables
let auth, db;

// Initialize Firebase
async function initFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { getFirestore, doc, setDoc, getDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { firebaseConfig } = await import('./firebase-config.js');

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Auth state observer
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        userId = user.uid;
        document.getElementById('user-status').textContent = `Synced (ID: ${userId.substring(0, 8)}...)`;
        await loadWatchedMovies();
        setupRealtimeSync();
      } else {
        // Sign in anonymously
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('Auth error:', error);
          document.getElementById('user-status').textContent = 'Offline mode';
          loadLocalWatchedMovies();
        }
      }
    });
  } catch (error) {
    console.error('Firebase initialization error:', error);
    document.getElementById('user-status').textContent = 'Offline mode';
    loadLocalWatchedMovies();
  }
}

// Load watched movies from Firestore
async function loadWatchedMovies() {
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      watchedMovies = docSnap.data().watchedMovies || [];
    } else {
      // Migrate from localStorage if exists
      const localData = localStorage.getItem('watchedMovies');
      if (localData) {
        watchedMovies = JSON.parse(localData);
        await saveWatchedMovies();
      }
    }
    
    displayDecades();
    updateStats();
    
    if (currentDecade) {
      displayMoviesByDecade(currentDecade);
    } else {
      const firstDecade = Math.floor(parseInt(movies[0].year) / 10) * 10;
      currentDecade = firstDecade;
      displayMoviesByDecade(firstDecade);
    }
  } catch (error) {
    console.error('Error loading watched movies:', error);
    loadLocalWatchedMovies();
  }
}

// Load from localStorage as fallback
function loadLocalWatchedMovies() {
  watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
  displayDecades();
  updateStats();
  
  const firstDecade = Math.floor(parseInt(movies[0].year) / 10) * 10;
  currentDecade = firstDecade;
  displayMoviesByDecade(firstDecade);
}

// Setup realtime sync
async function setupRealtimeSync() {
  try {
    const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    if (unsubscribe) unsubscribe();
    
    const docRef = doc(db, 'users', userId);
    unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const newWatchedMovies = doc.data().watchedMovies || [];
        
        // Only update if data changed
        if (JSON.stringify(newWatchedMovies) !== JSON.stringify(watchedMovies)) {
          watchedMovies = newWatchedMovies;
          displayDecades();
          updateStats();
          
          if (currentDecade) {
            displayMoviesByDecade(currentDecade);
          }
        }
      }
    });
  } catch (error) {
    console.error('Error setting up realtime sync:', error);
  }
}

// Save watched movies to Firestore
async function saveWatchedMovies() {
  // Always save to localStorage first
  localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
  
  if (!userId || !db) {
    return;
  }
  
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, {
      watchedMovies: watchedMovies,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving to Firestore:', error);
  }
}

// Group movies by decade
function groupByDecade(movies) {
  const decades = {};
  
  movies.forEach(movie => {
    const year = parseInt(movie.year);
    const decade = Math.floor(year / 10) * 10;
    
    if (!decades[decade]) {
      decades[decade] = [];
    }
    decades[decade].push(movie);
  });
  
  return decades;
}

// Display decade buttons
function displayDecades() {
  const decadesNav = document.getElementById('decades-nav');
  const groupedMovies = groupByDecade(movies);
  const sortedDecades = Object.keys(groupedMovies).sort((a, b) => a - b);
  
  decadesNav.innerHTML = '';
  
  sortedDecades.forEach(decade => {
    const button = document.createElement('button');
    button.className = 'decade-btn';
    if (currentDecade && parseInt(decade) === parseInt(currentDecade)) {
      button.classList.add('active');
    }
    button.textContent = `${decade}s`;
    button.onclick = () => {
      currentDecade = decade;
      displayMoviesByDecade(decade);
      displayDecades();
    };
    
    const count = groupedMovies[decade].length;
    const watched = groupedMovies[decade].filter(m => watchedMovies.includes(m.title)).length;
    
    const badge = document.createElement('span');
    badge.className = 'decade-badge';
    badge.textContent = `${watched}/${count}`;
    button.appendChild(badge);
    
    decadesNav.appendChild(button);
  });
}

// Display movies for a specific decade
function displayMoviesByDecade(decade) {
  const container = document.getElementById('movies-container');
  const groupedMovies = groupByDecade(movies);
  const decadeMovies = groupedMovies[decade];
  
  container.innerHTML = `<h2 class="decade-title">${decade}s (${decadeMovies.length} movies)</h2>`;
  
  const grid = document.createElement('div');
  grid.className = 'movies-grid';
  
  decadeMovies.forEach(movie => {
    const isWatched = watchedMovies.includes(movie.title);
    
    const movieCard = document.createElement('div');
    movieCard.className = `movie-card ${isWatched ? 'watched' : ''}`;
    movieCard.innerHTML = `
      <div class="movie-poster">
        <img src="${movie.img}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
        ${isWatched ? '<div class="watched-badge">✓</div>' : ''}
      </div>
      <div class="movie-info">
        <h3>${movie.title}</h3>
        <p class="movie-year">${movie.year}</p>
        <p class="movie-director">${movie.director}</p>
        <button class="watch-btn ${isWatched ? 'watched' : ''}" onclick="toggleWatched('${movie.title.replace(/'/g, "\\'")}')">
          ${isWatched ? '✓ Watched' : 'Mark Watched'}
        </button>
      </div>
    `;
    
    grid.appendChild(movieCard);
  });
  
  container.appendChild(grid);
  updateStats();
}

// Toggle watched status
window.toggleWatched = async function(title) {
  const index = watchedMovies.indexOf(title);
  
  if (index > -1) {
    watchedMovies.splice(index, 1);
  } else {
    watchedMovies.push(title);
  }
  
  await saveWatchedMovies();
  
  // Refresh current view
  if (currentDecade) {
    displayMoviesByDecade(currentDecade);
  }
  
  displayDecades();
}

// Update stats
function updateStats() {
  document.getElementById('watched-count').textContent = watchedMovies.length;
  document.getElementById('total-count').textContent = movies.length;
}

// Initialize app
console.log('Initializing app...');
loadLocalWatchedMovies(); // Load immediately from localStorage
initFirebase(); // Then try to init Firebase in background