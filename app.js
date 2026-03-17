import moviesData from './list.js';

const movies = moviesData.movies;
let watchedMovies = [];
let currentDecade = null;
let auth, db, userId;

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

    // Handle auth state
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        userId = user.uid;
        
        // Check if this is a new user or returning user
        const savedUserId = localStorage.getItem('firebaseUserId');
        
        if (!savedUserId) {
          // First time user - migrate localStorage data to Firebase
          console.log('New user - migrating local data to Firebase');
          localStorage.setItem('firebaseUserId', userId);
          await migrateLocalDataToFirebase();
        } else if (savedUserId === userId) {
          // Returning user - load from Firebase
          console.log('Returning user - loading from Firebase');
          await loadFromFirebase();
        } else {
          // Different user ID (shouldn't happen with anonymous auth, but just in case)
          console.log('Different user detected');
          localStorage.setItem('firebaseUserId', userId);
          await loadFromFirebase();
        }
        
        document.getElementById('user-status').textContent = `Synced`;
        setupRealtimeSync();
      } else {
        await signInAnonymously(auth);
      }
    });
    
  } catch (error) {
    console.error('Firebase error:', error);
    document.getElementById('user-status').textContent = 'Offline mode';
    loadFromLocalStorage();
  }
}

// Migrate existing localStorage data to Firebase
async function migrateLocalDataToFirebase() {
  const localData = localStorage.getItem('watchedMovies');
  if (localData) {
    watchedMovies = JSON.parse(localData);
    console.log(`Migrating ${watchedMovies.length} movies to Firebase`);
    await saveWatchedMovies();
  }
  refreshUI();
}

// Load watched movies from Firebase
async function loadFromFirebase() {
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const firebaseData = docSnap.data().watchedMovies || [];
      const localData = JSON.parse(localStorage.getItem('watchedMovies') || '[]');
      
      // Merge Firebase and local data (in case of any sync issues)
      watchedMovies = [...new Set([...firebaseData, ...localData])];
      
      // If we merged new data, save it back
      if (watchedMovies.length > firebaseData.length) {
        console.log('Merged local changes with Firebase data');
        await saveWatchedMovies();
      }
    } else {
      // No Firebase data yet, use local
      watchedMovies = JSON.parse(localStorage.getItem('watchedMovies') || '[]');
      if (watchedMovies.length > 0) {
        await saveWatchedMovies();
      }
    }
    
    refreshUI();
  } catch (error) {
    console.error('Error loading from Firebase:', error);
    loadFromLocalStorage();
  }
}

// Load from localStorage as fallback
function loadFromLocalStorage() {
  watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
  refreshUI();
}

// Setup realtime sync
async function setupRealtimeSync() {
  try {
    const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const docRef = doc(db, 'users', userId);
    
    onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const newWatchedMovies = doc.data().watchedMovies || [];
        if (JSON.stringify(newWatchedMovies.sort()) !== JSON.stringify(watchedMovies.sort())) {
          console.log('Remote changes detected, updating UI');
          watchedMovies = newWatchedMovies;
          localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
          refreshUI();
        }
      }
    });
  } catch (error) {
    console.error('Realtime sync error:', error);
  }
}

// Save watched movies
async function saveWatchedMovies() {
  // Always save to localStorage first
  localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
  
  // Save to Firebase if available
  if (userId && db) {
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const docRef = doc(db, 'users', userId);
      await setDoc(docRef, {
        watchedMovies: watchedMovies,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      console.log(`Saved ${watchedMovies.length} movies to Firebase`);
    } catch (error) {
      console.error('Error saving to Firebase:', error);
    }
  }
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
  refreshUI();
}

// Refresh all UI elements
function refreshUI() {
  displayDecades();
  updateStats();
  
  if (currentDecade) {
    displayMoviesByDecade(currentDecade);
  } else {
    const firstDecade = Math.floor(parseInt(movies[0].year) / 10) * 10;
    currentDecade = firstDecade;
    displayMoviesByDecade(firstDecade);
  }
}

// Group movies by decade
function groupByDecade(movies) {
  const decades = {};
  
  movies.forEach(movie => {
    const decade = Math.floor(parseInt(movie.year) / 10) * 10;
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
    const progressPercent = (watched / count) * 100;
    
    button.style.setProperty('--progress', `${progressPercent}%`);
    
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
}

// Update stats
function updateStats() {
  const totalCount = movies.length;
  document.getElementById('watched-count').textContent = watchedMovies.length;
  document.getElementById('total-count').textContent = totalCount;
  document.getElementById('total-count-title').textContent = totalCount;
}

// Search functionality
const searchInput = document.getElementById('movie-search');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.trim().toLowerCase();
  
  if (query.length < 2) {
    searchResults.classList.remove('show');
    return;
  }
  
  const results = movies.filter(movie => {
    return movie.title.toLowerCase().includes(query) ||
           movie.year.includes(query) ||
           movie.director.toLowerCase().includes(query);
  });
  
  displaySearchResults(results);
});

document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
    searchResults.classList.remove('show');
  }
});

function displaySearchResults(results) {
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-no-results">No movies found</div>';
    searchResults.classList.add('show');
    return;
  }
  
  searchResults.innerHTML = results.slice(0, 10).map(movie => {
    const isWatched = watchedMovies.includes(movie.title);
    return `
      <div class="search-result-item ${isWatched ? 'watched' : ''}" onclick="goToMovie('${movie.title.replace(/'/g, "\\'")}', '${movie.year}')">
        <span class="search-result-title">${movie.title}</span>
        <span class="search-result-year">${movie.year}</span>
        ${isWatched ? '<span class="search-result-watched">✓</span>' : ''}
      </div>
    `;
  }).join('');
  
  searchResults.classList.add('show');
}

window.goToMovie = function(title, year) {
  const decade = Math.floor(parseInt(year) / 10) * 10;
  currentDecade = decade;
  displayMoviesByDecade(decade);
  displayDecades();
  
  setTimeout(() => {
    const movieCards = document.querySelectorAll('.movie-card h3');
    movieCards.forEach(card => {
      if (card.textContent === title) {
        card.closest('.movie-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.closest('.movie-card').style.animation = 'highlight 1s ease';
      }
    });
  }, 100);
  
  searchResults.classList.remove('show');
  searchInput.value = '';
}

// Initialize app
loadFromLocalStorage(); // Load immediately from localStorage
initFirebase(); // Then init Firebase in background

// Export watched movies as JSON file
window.exportWatchedMovies = function() {
  const data = {
    watchedMovies: watchedMovies,
    exportDate: new Date().toISOString(),
    userId: userId || 'unknown'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `1001-movies-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  alert(`✅ Exported ${watchedMovies.length} watched movies!`);
}

// Import watched movies from JSON file
window.importWatchedMovies = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.watchedMovies || !Array.isArray(data.watchedMovies)) {
        alert('❌ Invalid backup file!');
        return;
      }
      
      // Merge with existing data
      const merged = [...new Set([...watchedMovies, ...data.watchedMovies])];
      const newCount = merged.length - watchedMovies.length;
      
      if (confirm(`Import ${data.watchedMovies.length} movies? (${newCount} new)`)) {
        watchedMovies = merged;
        await saveWatchedMovies();
        refreshUI();
        alert(`✅ Imported successfully! Added ${newCount} new movies.`);
      }
      
    } catch (error) {
      console.error('Import error:', error);
      alert('❌ Failed to import backup file!');
    }
  };
  
  input.click();
}

// Add export/import buttons to the UI
function addBackupButtons() {
  const stats = document.querySelector('.stats');
  
  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.cssText = 'margin-top: 15px; display: flex; gap: 10px; justify-content: center;';
  buttonsDiv.innerHTML = `
    <button onclick="exportWatchedMovies()" style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">
      📥 Export Backup
    </button>
    <button onclick="importWatchedMovies()" style="background: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">
      📤 Import Backup
    </button>
  `;
  
  stats.appendChild(buttonsDiv);
}

// Call this in your initialization
document.addEventListener('DOMContentLoaded', () => {
  addBackupButtons();
});