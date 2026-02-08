let profileAuth, profileDb;

export async function initProfile(authInstance, dbInstance) {
  profileAuth = authInstance;
  profileDb = dbInstance;
  
  setupProfileUI();
}

function setupProfileUI() {
  const userStatus = document.getElementById('user-status');
  if (!userStatus) {
    console.error('user-status element not found');
    return;
  }
  
  userStatus.style.cursor = 'pointer';
  userStatus.title = 'Click to manage profile';
  userStatus.onclick = showProfileModal;
  
  console.log('Profile UI setup complete - user-status is now clickable');
}

function showProfileModal() {
  console.log('Profile modal opened');
  
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
        <strong>Your User ID:</strong><br>
        <code style="background: #f0f0f0; padding: 0.25rem 0.5rem; border-radius: 3px; display: inline-block; margin-top: 0.25rem;">${userId}</code>
      </p>
      <p style="font-size: 0.85em; color: #999; margin-top: 0.5rem;">
        Save this ID to login from another device
      </p>
      <button onclick="window.profileLogout()" style="background: #dc3545; margin-top: 1rem;">
        Logout & Create New Profile
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
  if (!confirm('Are you sure you want to logout and create a NEW profile? Your current data will remain saved in the cloud.\n\nTo access this profile again, save your User ID before logging out.')) {
    return;
  }
  
  try {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    
    // Clear stored user ID
    localStorage.removeItem('savedUserId');
    localStorage.removeItem('watchedMovies');
    
    await signOut(profileAuth);
    
    alert('Logged out successfully! Creating new profile...');
    document.getElementById('profile-modal')?.remove();
    
    // Reload page to create new anonymous user
    window.location.reload();
  } catch (error) {
    alert('Error logging out: ' + error.message);
  }
}