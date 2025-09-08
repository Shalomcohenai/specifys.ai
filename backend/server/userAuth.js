const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, 'users.json');

// Initialize users file if it doesn't exist
async function initializeUsersFile() {
  try {
    await fs.access(USERS_FILE);
  } catch (error) {
    await fs.writeFile(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

// Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate JWT-like token (simple implementation)
function generateToken(userId) {
  const payload = {
    userId,
    timestamp: Date.now(),
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// Verify token
function verifyToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now()) {
      return null; // Token expired
    }
    return payload;
  } catch (error) {
    return null;
  }
}

// Register new user
async function registerUser(email, password, name = '') {
  await initializeUsersFile();
  
  const usersData = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  
  // Check if user already exists
  const existingUser = usersData.users.find(user => user.email === email);
  if (existingUser) {
    throw new Error('User already exists');
  }
  
  // Create new user
  const newUser = {
    id: Date.now().toString(),
    email,
    password: hashPassword(password),
    name,
    createdAt: new Date().toISOString(),
    lastLogin: null,
    isActive: true
  };
  
  usersData.users.push(newUser);
  await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

// Login user
async function loginUser(email, password) {
  await initializeUsersFile();
  
  const usersData = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  
  const user = usersData.users.find(u => u.email === email && u.isActive);
  if (!user) {
    throw new Error('User not found');
  }
  
  if (user.password !== hashPassword(password)) {
    throw new Error('Invalid password');
  }
  
  // Update last login
  user.lastLogin = new Date().toISOString();
  await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
  
  // Generate token
  const token = generateToken(user.id);
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

// Get user by ID
async function getUserById(userId) {
  await initializeUsersFile();
  
  const usersData = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  
  const user = usersData.users.find(u => u.id === userId && u.isActive);
  if (!user) {
    return null;
  }
  
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// Update user profile
async function updateUserProfile(userId, updates) {
  await initializeUsersFile();
  
  const usersData = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  
  const userIndex = usersData.users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    throw new Error('User not found');
  }
  
  // Update allowed fields only
  const allowedFields = ['name', 'email'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      usersData.users[userIndex][field] = updates[field];
    }
  }
  
  await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
  
  const { password: _, ...userWithoutPassword } = usersData.users[userIndex];
  return userWithoutPassword;
}

// Change password
async function changePassword(userId, currentPassword, newPassword) {
  await initializeUsersFile();
  
  const usersData = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  
  const userIndex = usersData.users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    throw new Error('User not found');
  }
  
  const user = usersData.users[userIndex];
  if (user.password !== hashPassword(currentPassword)) {
    throw new Error('Current password is incorrect');
  }
  
  usersData.users[userIndex].password = hashPassword(newPassword);
  await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
  
  return { success: true };
}

// Delete user account
async function deleteUser(userId, password) {
  await initializeUsersFile();
  
  const usersData = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  
  const userIndex = usersData.users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    throw new Error('User not found');
  }
  
  const user = usersData.users[userIndex];
  if (user.password !== hashPassword(password)) {
    throw new Error('Password is incorrect');
  }
  
  // Soft delete - mark as inactive
  usersData.users[userIndex].isActive = false;
  await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
  
  return { success: true };
}

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  updateUserProfile,
  changePassword,
  deleteUser,
  verifyToken,
  generateToken
};
