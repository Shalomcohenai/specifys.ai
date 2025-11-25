// Admin Academy JavaScript

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9hr0IWM4EREzkKDxBxYoYinV6LJXWXV4",
  authDomain: "specify-ai.firebaseapp.com",
  projectId: "specify-ai",
  storageBucket: "specify-ai.firebasestorage.app",
  messagingSenderId: "734278787482",
  appId: "1:734278787482:web:0e312fb6f197e849695a23",
  measurementId: "G-4YR9LK63MR"
};

const ADMIN_EMAILS = new Set([
  "specifysai@gmail.com",
  "admin@specifys.ai",
  "shalom@specifys.ai"
]);

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class AdminAcademy {
  constructor() {
    this.categories = [];
    this.guides = [];
    this.init();
  }

  init() {
    // Setup auth gate
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = '/pages/auth.html';
        return;
      }

      const email = user.email?.toLowerCase();
      if (!email || !ADMIN_EMAILS.has(email)) {
        alert('Access denied. Admin privileges required.');
        window.location.href = '/';
        return;
      }

      // Setup sign out
      const signOutBtn = document.getElementById('sign-out-btn');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
          signOut(auth).then(() => {
            window.location.href = '/pages/auth.html';
          });
        });
      }

      // Determine which page
      const path = window.location.pathname;
      if (path.includes('/new-category.html')) {
        this.setupNewCategoryPage();
      } else if (path.includes('/new-guide.html')) {
        this.setupNewGuidePage();
      } else if (path.includes('/edit-guide.html')) {
        this.setupEditGuidePage();
      } else {
        this.setupDashboardPage();
      }
    });
  }

  async setupDashboardPage() {
    await this.loadCategories();
    await this.loadGuides();
    this.renderCategories();
    this.renderGuides();
  }

  async loadCategories() {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'academy_categories'), orderBy('title'))
      );
      this.categories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      // Error loading categories
    }
  }

  async loadGuides() {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'academy_guides'), orderBy('title'))
      );
      this.guides = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      // Error loading guides
    }
  }

  renderCategories() {
    const tbody = document.querySelector('#categories-table tbody');
    if (!tbody) return;

    if (this.categories.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No categories yet. Create one to get started.</td></tr>';
      return;
    }

    tbody.innerHTML = this.categories.map(cat => `
      <tr>
        <td><i class="fas fa-${cat.icon || 'book'}"></i></td>
        <td>${this.escapeHTML(cat.title)}</td>
        <td>${this.escapeHTML(cat.description || '')}</td>
        <td>
          <button class="action-btn small critical" onclick="adminAcademy.deleteCategory('${cat.id}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </td>
      </tr>
    `).join('');
  }

  renderGuides() {
    const tbody = document.querySelector('#guides-table tbody');
    if (!tbody) return;

    if (this.guides.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No guides yet. Create one to get started.</td></tr>';
      return;
    }

    tbody.innerHTML = this.guides.map(guide => {
      const category = this.categories.find(c => c.id === guide.category);
      const questionCount = guide.questions ? guide.questions.length : 0;
      return `
        <tr>
          <td>${this.escapeHTML(guide.title)}</td>
          <td>${category ? this.escapeHTML(category.title) : 'Unknown'}</td>
          <td><span class="level-badge ${(guide.level || 'beginner').toLowerCase()}">${guide.level || 'Beginner'}</span></td>
          <td>${questionCount}</td>
          <td>
            <a href="/pages/admin/academy/edit-guide.html?guide=${guide.id}" class="action-btn small">
              <i class="fas fa-edit"></i> Edit
            </a>
            <button class="action-btn small critical" onclick="adminAcademy.deleteGuide('${guide.id}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async setupNewCategoryPage() {
    const form = document.getElementById('category-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('form-feedback');
      
      try {
        const title = document.getElementById('category-title').value.trim();
        const icon = document.getElementById('category-icon').value.trim();
        const description = document.getElementById('category-description').value.trim();

        await addDoc(collection(db, 'academy_categories'), {
          title,
          icon,
          description,
          createdAt: new Date().toISOString()
        });

        feedback.innerHTML = '<div style="color: green;">Category created successfully! Redirecting...</div>';
        setTimeout(() => {
          window.location.href = '/pages/admin/academy/index.html';
        }, 1500);
      } catch (error) {
        // Error creating category
        feedback.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
      }
    });
  }

  async setupNewGuidePage() {
    await this.loadCategories();
    this.populateCategorySelect();

    const form = document.getElementById('guide-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('form-feedback');
      
      try {
        const guideData = this.collectGuideFormData();
        await addDoc(collection(db, 'academy_guides'), guideData);

        feedback.innerHTML = '<div style="color: green;">Guide created successfully! Redirecting...</div>';
        setTimeout(() => {
          window.location.href = '/pages/admin/academy/index.html';
        }, 1500);
      } catch (error) {
        // Error creating guide
        feedback.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
      }
    });
  }

  async setupEditGuidePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const guideId = urlParams.get('guide');

    if (!guideId) {
      window.location.href = '/pages/admin/academy/index.html';
      return;
    }

    await this.loadCategories();
    this.populateCategorySelect();

    try {
      const guideDoc = await getDoc(doc(db, 'academy_guides', guideId));
      if (!guideDoc.exists()) {
        alert('Guide not found');
        window.location.href = '/pages/admin/academy/index.html';
        return;
      }

      const guide = { id: guideDoc.id, ...guideDoc.data() };
      this.populateGuideForm(guide);

      const form = document.getElementById('guide-form');
      const loading = document.getElementById('loading-placeholder');
      if (loading) loading.style.display = 'none';
      if (form) form.style.display = 'block';

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedback = document.getElementById('form-feedback');
        
        try {
          const guideData = this.collectGuideFormData();
          await updateDoc(doc(db, 'academy_guides', guideId), guideData);

          feedback.innerHTML = '<div style="color: green;">Guide updated successfully! Redirecting...</div>';
          setTimeout(() => {
            window.location.href = '/pages/admin/academy/index.html';
          }, 1500);
        } catch (error) {
          // Error updating guide
          feedback.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
        }
      });
    } catch (error) {
      // Error loading guide
      alert('Error loading guide');
      window.location.href = '/pages/admin/academy/index.html';
    }
  }

  populateCategorySelect() {
    const select = document.getElementById('guide-category');
    if (!select) return;

    select.innerHTML = '<option value="">Select a category</option>' +
      this.categories.map(cat => 
        `<option value="${cat.id}">${this.escapeHTML(cat.title)}</option>`
      ).join('');
  }

  populateGuideForm(guide) {
    document.getElementById('guide-id').value = guide.id;
    document.getElementById('guide-category').value = guide.category || '';
    document.getElementById('guide-title').value = guide.title || '';
    document.getElementById('guide-level').value = guide.level || 'Beginner';
    document.getElementById('guide-what-you-learn').value = (guide.whatYouLearn || []).join('\n');
    document.getElementById('guide-content').value = guide.content || '';
    document.getElementById('guide-summary').value = guide.summary || '';

    // Questions
    if (guide.questions && guide.questions.length > 0) {
      const q1 = guide.questions[0];
      document.getElementById('q1-question').value = q1.q || '';
      document.getElementById('q1-answer0').value = q1.answers[0] || '';
      document.getElementById('q1-answer1').value = q1.answers[1] || '';
      document.getElementById('q1-answer2').value = q1.answers[2] || '';
      document.getElementById('q1-answer3').value = q1.answers[3] || '';
      document.getElementById('q1-correct').value = q1.correctIndex || 0;

      if (guide.questions.length > 1) {
        const q2 = guide.questions[1];
        document.getElementById('q2-question').value = q2.q || '';
        document.getElementById('q2-answer0').value = q2.answers[0] || '';
        document.getElementById('q2-answer1').value = q2.answers[1] || '';
        document.getElementById('q2-answer2').value = q2.answers[2] || '';
        document.getElementById('q2-answer3').value = q2.answers[3] || '';
        document.getElementById('q2-correct').value = q2.correctIndex || 0;
      }
    }
  }

  collectGuideFormData() {
    const whatYouLearn = document.getElementById('guide-what-you-learn').value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const questions = [
      {
        q: document.getElementById('q1-question').value.trim(),
        answers: [
          document.getElementById('q1-answer0').value.trim(),
          document.getElementById('q1-answer1').value.trim(),
          document.getElementById('q1-answer2').value.trim(),
          document.getElementById('q1-answer3').value.trim()
        ],
        correctIndex: parseInt(document.getElementById('q1-correct').value)
      },
      {
        q: document.getElementById('q2-question').value.trim(),
        answers: [
          document.getElementById('q2-answer0').value.trim(),
          document.getElementById('q2-answer1').value.trim(),
          document.getElementById('q2-answer2').value.trim(),
          document.getElementById('q2-answer3').value.trim()
        ],
        correctIndex: parseInt(document.getElementById('q2-correct').value)
      }
    ];

    return {
      category: document.getElementById('guide-category').value,
      title: document.getElementById('guide-title').value.trim(),
      level: document.getElementById('guide-level').value,
      whatYouLearn,
      content: document.getElementById('guide-content').value.trim(),
      summary: document.getElementById('guide-summary').value.trim(),
      questions,
      updatedAt: new Date().toISOString()
    };
  }

  async deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category? This will not delete guides in this category.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'academy_categories', categoryId));
      await this.loadCategories();
      this.renderCategories();
    } catch (error) {
      // Error deleting category
      alert('Error deleting category: ' + error.message);
    }
  }

  async deleteGuide(guideId) {
    if (!confirm('Are you sure you want to delete this guide?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'academy_guides', guideId));
      await this.loadGuides();
      this.renderGuides();
    } catch (error) {
      // Error deleting guide
      alert('Error deleting guide: ' + error.message);
    }
  }

  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Initialize
const adminAcademy = new AdminAcademy();
window.adminAcademy = adminAcademy; // For onclick handlers

