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
  
  if (profileAuth.currentUser) {
    loadProfileForm();
  } else {
    showLoginForm();
  }
  
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

function showLoginForm() {
  const form = document.getElementById('profile-form');
  
  form.innerHTML = `
    <div class="auth-tabs">
      <button class="tab-btn active" onclick="window.showLoginTab()">Login</button>
      <button class="tab-btn" onclick="window.showSignupTab()">Sign Up</button>
    </div>
    
    <div id="login-tab" class="tab-content active">
      <h3>Login to Your Profile</h3>
      <input type="email" id="login-email" placeholder="Email" />
      <input type="password" id="login-password" placeholder="Password" />
      <button onclick="window.handleLogin()">Login</button>
      <p style="font-size: 0.85em; color: #666; margin-top: 1rem;">
        Don't have an account? Click "Sign Up" above.
      </p>
    </div>
    
    <div id="signup-tab" class="tab-content">
      <h3>Create New Profile</h3>
      <input type="text" id="signup-name" placeholder="Your Name" />
      <input type="email" id="signup-email" placeholder="Email" />
      <input type="password" id="signup-password" placeholder="Password (min 6 characters)" />
      <button onclick="window.handleSignup()">Create Profile</button>
      <p style="font-size: 0.85em; color: #666; margin-top: 1rem;">
        Already have an account? Click "Login" above.
      </p>
    </div>
  `;
}

window.showLoginTab = function() {
  document.getElementById('login-tab').classList.add('active');
  document.getElementById('signup-tab').classList.remove('active');
  document.querySelectorAll('.tab-btn')[0].classList.add('active');
  document.querySelectorAll('.tab-btn')[1].classList.remove('active');
}

window.showSignupTab = function() {
  document.getElementById('signup-tab').classList.add('active');
  document.getElementById('login-tab').classList.remove('active');
  document.querySelectorAll('.tab-btn')[1].classList.add('active');
  document.querySelectorAll('.tab-btn')[0].classList.remove('active');
}

window.handleLogin = async function() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    alert('Please enter both email and password');
    return;
  }
  
  try {
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    await signInWithEmailAndPassword(profileAuth, email, password);
    
    alert('Login successful!');
    document.getElementById('profile-modal').remove();
    window.location.reload();
  } catch (error) {
    console.error('Login error:', error);
    if (error.code === 'auth/user-not-found') {
      alert('No account found with this email. Please sign up first.');
    } else if (error.code === 'auth/wrong-password') {
      alert('Incorrect password. Please try again.');
    } else if (error.code === 'auth/invalid-email') {
      alert('Invalid email address.');
    } else {
      alert('Login failed: ' + error.message);
    }
  }
}

window.handleSignup = async function() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  
  if (!name || !email || !password) {
    alert('Please fill in all fields');
    return;
  }
  
  if (password.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }
  
  try {
    const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    const userCredential = await createUserWithEmailAndPassword(profileAuth, email, password);
    const userId = userCredential.user.uid;
    
    // Save profile name
    const docRef = doc(profileDb, 'users', userId);
    await setDoc(docRef, {
      profileName: name,
      email: email,
      watchedMovies: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });
    
    alert('Profile created successfully!');
    document.getElementById('profile-modal').remove();
    window.location.reload();
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 'auth/email-already-in-use') {
      alert('This email is already registered. Please login instead.');
    } else if (error.code === 'auth/invalid-email') {
      alert('Invalid email address.');
    } else if (error.code === 'auth/weak-password') {
      alert('Password is too weak. Please use at least 6 characters.');
    } else {
      alert('Signup failed: ' + error.message);
    }
  }
}

async function loadProfileForm() {
  const form = document.getElementById('profile-form');
  
  if (!profileAuth.currentUser) {
    showLoginForm();
    return;
  }
  
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const userId = profileAuth.currentUser.uid;
    const email = profileAuth.currentUser.email;
    const docRef = doc(profileDb, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    const profileName = docSnap.exists() && docSnap.data().profileName 
      ? docSnap.data().profileName 
      : '';
    
    form.innerHTML = `
      <h3>Your Profile</h3>
      <p><strong>Email:</strong> ${email}</p>
      <p>Profile name:</p>
      <input type="text" id="profile-name" placeholder="Enter your name" value="${profileName}" />
      <button onclick="window.saveProfileName()">Save Name</button>
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
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }
  
  try {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    await signOut(profileAuth);
    
    alert('Logged out successfully!');
    document.getElementById('profile-modal')?.remove();
    window.location.reload();
  } catch (error) {
    alert('Error logging out: ' + error.message);
  }
}