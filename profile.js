let profileAuth, profileDb;
let currentUserId = null;

export async function initProfile(authInstance, dbInstance) {
  profileAuth = authInstance;
  profileDb = dbInstance;
  
  // Listen for auth state changes
  const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
  
  onAuthStateChanged(profileAuth, async (user) => {
    if (user) {
      // User is signed in
      currentUserId = user.uid;
      console.log('User authenticated:', currentUserId);
      await loadUserData();
    } else {
      // No user, sign in anonymously
      await signInAnonymously();
    }
  });
}

async function signInAnonymously() {
  try {
    const { signInAnonymously: firebaseSignIn } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const userCredential = await firebaseSignIn(profileAuth);
    currentUserId = userCredential.user.uid;
    console.log('Anonymous user created:', currentUserId);
    
    // Initialize empty watched movies list for new user
    await saveWatchedMovies([]);
  } catch (error) {
    console.error('Error signing in anonymously:', error);
  }
}

async function loadUserData() {
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const docRef = doc(profileDb, 'users', currentUserId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const watchedMovies = data.watchedMovies || [];
      
      // Dispatch event to update the UI
      window.dispatchEvent(new CustomEvent('watchedMoviesLoaded', { 
        detail: { watchedMovies } 
      }));
      
      console.log('Loaded watched movies:', watchedMovies.length);
    } else {
      console.log('No existing data for user');
    }
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

export async function saveWatchedMovies(watchedMovies) {
  if (!currentUserId) {
    console.error('No user ID available');
    return;
  }
  
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const docRef = doc(profileDb, 'users', currentUserId);
    
    await setDoc(docRef, {
      watchedMovies: watchedMovies,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    
    console.log('Saved watched movies:', watchedMovies.length);
  } catch (error) {
    console.error('Error saving watched movies:', error);
  }
}

export function getCurrentUserId() {
  return currentUserId;
}