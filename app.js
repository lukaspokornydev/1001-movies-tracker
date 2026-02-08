import moviesData from './list.js';
import { firebaseConfig } from './firebase-config.js';

const movies = moviesData.movies;
let watchedMovies = [];
let currentDecade = null;
let currentUser = null;
let unsubscribe = null;

// Firebase variables
let auth, db;

// Show/hide login modal
function showLoginModal() {
  document.getElementById('login-modal').classList.add('show');
}

function hideLoginModal() {
  document.getElementById('login-modal').classList.remove('show');
}

// Initialize Firebase
async function initFirebase() {
  if (!firebaseConfig) {
    console.log('Firebase not configured, using offline mode');
    document.getElementById('user-status').textContent = '📴 Offline mode';
    hideLoginModal();
    return;
  }

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { getFirestore, doc, setDoc, getDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Check if user is already logged in
    const savedUserId = localStorage.getItem('userId');
    if (!savedUserId) {
      showLoginModal();
    }

    // Google Sign-In
    document.getElementById('google-signin-btn').onclick = async () => {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error('Google sign-in error:', error);
        alert('Failed to sign in with Google: ' + error.message);
      }
    };

    // Email Sign-In
    document.getElementById('email-signin-btn').onclick = async () => {
      const email = document.getElementById('email-input').value;
      const password = document.getElementById('password-input').value;
      
      if (!email || !password) {
        alert('Please enter email and password');
        return;
      }
      
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        console.error('Email sign-in error:', error);
        alert('Failed to sign in: ' + error.message);
      }
    };

    // Email Sign-Up
    document.getElementById('email-signup-btn').onclick = async () => {
      const email = document.getElementById('email-input').value;
      const password = document.getElementById('password-input').value;
      
      if (!email || !password) {
        alert('Please enter email and password');
        return;
      }
      
      if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
      }
      
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (error) {
        console.error('Email sign-up error:', error);
        alert('Failed to create account: ' + error.message);
      }
    };

    // Anonymous Sign-In
    document.getElementById('anonymous-btn').onclick = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error('Anonymous sign-in error:', error);
        alert('Failed to continue: ' + error.message);
      }
    };

    // Logout
    document.getElementById('logout-btn').onclick = async () => {
      if (confirm('Are you sure you want to logout? Your data will be saved.')) {
        try {
          await signOut(auth);
          localStorage.removeItem('userId');
          watchedMovies = [];
          showLoginModal();
          displayDecades();
          updateStats();
          if (currentDecade) {
            displayMoviesByDecade(currentDecade);
          }
        } catch (error) {
          console.error('Logout error:', error);
          alert('Failed to logout: ' + error.message);
        }
      }
    };

    // Auth state observer
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        localStorage.setItem('userId', user.uid);
        
        // Update UI based on auth type
        if (user.isAnonymous) {
          document.getElementById('user-status').textContent = '📴 Local Only';
        } else if (user.providerData[0]?.providerId === 'google.com') {
          document.getElementById('user-status').textContent = `☁️ ${user.displayName || user.email}`;
        } else {
          document.getElementById('user-status').textContent = `☁️ ${user.email}`;
        }
        
        document.getElementById('logout-btn').style.display = 'block';
        hideLoginModal();
        
        await loadWatchedMoviesFromFirestore(user.uid);
        setupRealtimeSync(user.uid);
      } else {
        currentUser = null;
        document.getElementById('user-status').textContent = 'Not logged in';
        document.getElementById('logout-btn').style.display = 'none';
        
        // Only show modal if no local data exists
        const hasLocalData = localStorage.getItem('watchedMovies');
        if (!hasLocalData) {
          showLoginModal();
        }
      }
    });
  } catch (error) {
    console.error('Firebase initialization error:', error);
    document.getElementById('user-status').textContent = '📴 Offline mode';
    hideLoginModal();
  }
}

// Load watched movies from Firestore
async function loadWatchedMoviesFromFirestore(userId) {
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const firestoreMovies = docSnap.data().watchedMovies || [];
      const localMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
      
      // Merge local and firestore data (union of both)
      watchedMovies = [...new Set([...firestoreMovies, ...localMovies])];
      
      // Save merged data back to Firestore
      if (watchedMovies.length > firestoreMovies.length) {
        await saveWatchedMovies();
      }
    } else {
      // Migrate from localStorage if exists
      const localData = localStorage.getItem('watchedMovies');
      if (localData) {
        watchedMovies = JSON.parse(localData);
        await saveWatchedMovies();
      }
    }
    
    // Refresh UI
    displayDecades();
    updateStats();
    if (currentDecade) {
      displayMoviesByDecade(currentDecade);
    }
  } catch (error) {
    console.error('Error loading watched movies from Firestore:', error);
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
async function setupRealtimeSync(userId) {
  try {
    const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    if (unsubscribe) unsubscribe();
    
    const docRef = doc(db, 'users', userId);
    unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const newWatchedMovies = doc.data().watchedMovies || [];
        
        // Only update if data changed
        if (JSON.stringify(newWatchedMovies.sort()) !== JSON.stringify(watchedMovies.sort())) {
          watchedMovies = newWatchedMovies;
          localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
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
  
  if (!currentUser || !db) {
    return;
  }
  
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const docRef = doc(db, 'users', currentUser.uid);
    await setDoc(docRef, {
      watchedMovies: watchedMovies,
      lastUpdated: new Date().toISOString(),
      userEmail: currentUser.email || 'anonymous'
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

// Initialize app - Load movies immediately
console.log('Initializing app...');

// Load movies from localStorage immediately
loadLocalWatchedMovies();

// Then initialize Firebase in the background
initFirebase();