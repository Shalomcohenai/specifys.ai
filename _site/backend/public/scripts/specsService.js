import { db } from './firebaseConfig.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SPECS_COLLECTION = 'specs';

/**
 * Create a new spec for a user
 * @param {Object} specData - Spec data object
 * @param {string} specData.title - Spec title
 * @param {string} specData.content - Spec content
 * @param {string} specData.userId - User ID
 * @returns {Promise<string>} - Document ID of created spec
 */
export async function createSpec(specData) {
  try {
    const { title, content, userId } = specData;
    
    if (!title || !content || !userId) {
      throw new Error('All fields are required');
    }
    
    const specDoc = {
      title: title.trim(),
      content: content.trim(),
      userId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, SPECS_COLLECTION), specDoc);
    return docRef.id;
  } catch (error) {
    console.error('Error creating spec:', error);
    throw new Error('Error creating spec: ' + error.message);
  }
}

/**
 * Fetch all specs for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of user's specs
 */
export async function fetchUserSpecs(userId) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const q = query(
      collection(db, SPECS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const specs = [];
    
    querySnapshot.forEach((doc) => {
      specs.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return specs;
  } catch (error) {
    console.error('Error fetching user specs:', error);
    throw new Error('Error loading specs: ' + error.message);
  }
}

/**
 * Delete a spec
 * @param {string} specId - Spec document ID
 * @returns {Promise<void>}
 */
export async function deleteSpec(specId) {
  try {
    if (!specId) {
      throw new Error('Spec ID is required');
    }
    
    await deleteDoc(doc(db, SPECS_COLLECTION, specId));
  } catch (error) {
    console.error('Error deleting spec:', error);
    throw new Error('Error deleting spec: ' + error.message);
  }
}

/**
 * Update a spec
 * @param {string} specId - Spec document ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<void>}
 */
export async function updateSpec(specId, updateData) {
  try {
    if (!specId) {
      throw new Error('Spec ID is required');
    }
    
    const updatePayload = {
      ...updateData,
      updatedAt: serverTimestamp()
    };
    
    // Remove undefined values
    Object.keys(updatePayload).forEach(key => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });
    
    await updateDoc(doc(db, SPECS_COLLECTION, specId), updatePayload);
  } catch (error) {
    console.error('Error updating spec:', error);
    throw new Error('Error updating spec: ' + error.message);
  }
}

/**
 * Get a specific spec by ID
 * @param {string} specId - Spec document ID
 * @returns {Promise<Object|null>} - Spec data or null if not found
 */
export async function getSpec(specId) {
  try {
    if (!specId) {
      throw new Error('Spec ID is required');
    }
    
    const specDoc = await getDoc(doc(db, SPECS_COLLECTION, specId));
    
    if (specDoc.exists()) {
      return {
        id: specDoc.id,
        ...specDoc.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting spec:', error);
    throw new Error('Error loading spec: ' + error.message);
  }
}

/**
 * Search specs by title or content
 * @param {string} userId - User ID
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} - Array of matching specs
 */
export async function searchSpecs(userId, searchTerm) {
  try {
    if (!userId || !searchTerm) {
      throw new Error('User ID and search term are required');
    }
    
    const userSpecs = await fetchUserSpecs(userId);
    const searchLower = searchTerm.toLowerCase();
    
    return userSpecs.filter(spec => 
      spec.title.toLowerCase().includes(searchLower) ||
      spec.content.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error('Error searching specs:', error);
    throw new Error('Error searching specs: ' + error.message);
  }
}
