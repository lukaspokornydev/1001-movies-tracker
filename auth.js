export class ProfileAuth {
  constructor() {
    this.db = null;
    this.userId = null;
    this.username = null;
  }

  async initialize(db) {
    this.db = db;
    
    // Check if user has a profile
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      this.userId = profile.id;
      this.username = profile.username;
      return profile;
    } else {
      await this.showProfileModal();
      return null;
    }
  }

  showProfileModal() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'profile-modal';
      modal.innerHTML = `
        <div class="profile-modal-content">
          <h2>Create Your Profile</h2>
          <p>Choose a username to track your movies</p>
          <input type="text" id="username-input" placeholder="Enter username" maxlength="20" autocomplete="off">
          <div id="username-error" class="error-message"></div>
          <button id="create-profile-btn">Create Profile</button>
          <div class="profile-modal-footer">
            <p>Or load existing profile:</p>
            <input type="text" id="profile-id-input" placeholder="Enter your profile ID" autocomplete="off">
            <button id="load-profile-btn">Load Profile</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const usernameInput = document.getElementById('username-input');
      const createBtn = document.getElementById('create-profile-btn');
      const loadBtn = document.getElementById('load-profile-btn');
      const profileIdInput = document.getElementById('profile-id-input');

      usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createBtn.click();
      });

      createBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        if (!username) {
          this.showError('Please enter a username');
          return;
        }
        if (username.length < 3) {
          this.showError('Username must be at least 3 characters');
          return;
        }
        
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';
        
        const profile = await this.createProfile(username);
        if (profile) {
          modal.remove();
          resolve(profile);
        } else {
          createBtn.disabled = false;
          createBtn.textContent = 'Create Profile';
        }
      });

      profileIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadBtn.click();
      });

      loadBtn.addEventListener('click', async () => {
        const profileId = profileIdInput.value.trim();
        if (!profileId) {
          this.showError('Please enter a profile ID');
          return;
        }
        
        loadBtn.disabled = true;
        loadBtn.textContent = 'Loading...';
        
        const profile = await this.loadProfile(profileId);
        if (profile) {
          modal.remove();
          resolve(profile);
        } else {
          loadBtn.disabled = false;
          loadBtn.textContent = 'Load Profile';
        }
      });
    });
  }

  async createProfile(username) {
    try {
      const { collection, query, where, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      // Check if username already exists
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        this.showError('Username already taken');
        return null;
      }

      // Generate unique ID
      const profileId = this.generateProfileId();
      
      // Create profile in Firestore
      await setDoc(doc(this.db, 'users', profileId), {
        username: username,
        createdAt: new Date().toISOString(),
        watchedMovies: []
      });

      // Save to localStorage
      const profile = { id: profileId, username: username };
      localStorage.setItem('userProfile', JSON.stringify(profile));
      
      this.userId = profileId;
      this.username = username;
      
      // Show profile ID to user
      this.showProfileIdNotification(profileId);
      
      return profile;
    } catch (error) {
      console.error('Error creating profile:', error);
      this.showError('Error creating profile. Please try again.');
      return null;
    }
  }

  async loadProfile(profileId) {
    try {
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      const docRef = doc(this.db, 'users', profileId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        this.showError('Profile not found');
        return null;
      }

      const profileData = docSnap.data();
      const profile = { id: profileId, username: profileData.username };
      localStorage.setItem('userProfile', JSON.stringify(profile));
      
      this.userId = profileId;
      this.username = profileData.username;
      
      return profile;
    } catch (error) {
      console.error('Error loading profile:', error);
      this.showError('Error loading profile. Please try again.');
      return null;
    }
  }

  generateProfileId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  showProfileIdNotification(profileId) {
    const notification = document.createElement('div');
    notification.className = 'profile-id-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <h3>Profile Created!</h3>
        <p>Save this ID to access your profile from any device:</p>
        <div class="profile-id-display">
          <code id="profile-id-code">${profileId}</code>
          <button id="copy-profile-id" class="copy-btn">Copy</button>
        </div>
        <button id="close-notification" class="close-btn">Got it!</button>
      </div>
    `;
    document.body.appendChild(notification);

    document.getElementById('copy-profile-id').addEventListener('click', () => {
      navigator.clipboard.writeText(profileId);
      const btn = document.getElementById('copy-profile-id');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 2000);
    });

    document.getElementById('close-notification').addEventListener('click', () => {
      notification.remove();
    });
  }

  showError(message) {
    const errorDiv = document.getElementById('username-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      setTimeout(() => errorDiv.textContent = '', 3000);
    }
  }

  logout() {
    localStorage.removeItem('userProfile');
    this.userId = null;
    this.username = null;
    window.location.reload();
  }

  getUserId() {
    return this.userId;
  }

  getUsername() {
    return this.username;
  }
}