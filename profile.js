let profileAuth, profileDb;

export async function initProfile() {
  try {
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    profileAuth = getAuth();
    profileDb = getFirestore();
    
    setupProfileUI();
  } catch (error) {
    console.error('Profile init error:', error);
  }
}

function setupProfileUI() {
  const userStatus = document.getElementById('user-status');
  userStatus.style.cursor = 'pointer';
  userStatus.title = 'Click to manage profile';
  userStatus.onclick = showProfileModal;
}

function showProfileModal() {
  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="this.closest('#profile-modal').remove()">&times;</span>
      <h2>Profile</h2>
      <div id="profile-form"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
  loadProfileForm();
  
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

async function loadProfileForm() {
  const form = document.getElementById('profile-form');
  
  if (!profileAuth.currentUser) {
    form.innerHTML = '<p>Loading...</p>';
    return;
  }
  
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const userId = profileAuth.currentUser.uid;
    const docRef = doc(profileDb, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    const profileName = docSnap.exists() && docSnap.data().profileName 
      ? docSnap.data().profileName 
      : '';
    
    form.innerHTML = `
      <p>Set your profile name:</p>
      <input type="text" id="profile-name" placeholder="Enter your name" value="${profileName}" />
      <button onclick="window.saveProfileName()">Save</button>
      <p style="font-size: 0.9em; color: #666; margin-top: 1rem;">
        User ID: ${userId.substring(0, 12)}...
      </p>
      <button onclick="window.profileLogout()" style="background: #dc3545; margin-top: 1rem;">
        Logout
      </button>
    `;
  } catch (error) {
    console.error('Error loading profile:', error);
    form.innerHTML = '<p>Error loading profile</p>';
  }
}

window.saveProfileName = async function() {
  const nameInput = document.getElementById('profile-name');
  const name = nameInput.value.trim();
  
  if (!name) {
    alert('Please enter a name');
    return;
  }
  
  try {
    const { doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const userId = profileAuth.currentUser.uid;
    const docRef = doc(profileDb, 'users', userId);
    
    // Get existing data
    const docSnap = await getDoc(docRef);
    const existingData = docSnap.exists() ? docSnap.data() : {};
    
    // Update with profile name
    await setDoc(docRef, {
      ...existingData,
      profileName: name,
      lastUpdated: new Date().toISOString()
    });
    
    // Update user status display
    document.getElementById('user-status').textContent = `${name} (Synced)`;
    
    alert('Profile saved!');
    document.getElementById('profile-modal').remove();
  } catch (error) {
    alert('Error saving profile: ' + error.message);
  }
}

window.profileLogout = async function() {
  if (!confirm('Are you sure you want to logout? Your data will remain saved in the cloud.')) {
    return;
  }
  
  try {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    await signOut(profileAuth);
    
    // Clear local storage
    localStorage.removeItem('watchedMovies');
    
    alert('Logged out successfully! Reloading...');
    document.getElementById('profile-modal').remove();
    
    // Reload page to reset to new anonymous user
    window.location.reload();
  } catch (error) {
    alert('Error logging out: ' + error.message);
  }
}