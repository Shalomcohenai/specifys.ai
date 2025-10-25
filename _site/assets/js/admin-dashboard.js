// Admin Dashboard JavaScript

// Security utilities for safe HTML rendering
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

class AdminDashboard {
    constructor() {
        // Check if Firebase is available
        if (typeof firebase === 'undefined') {
            console.error('Firebase is not loaded');
            this.updateFirebaseStatus('error', 'Firebase not loaded');
            return;
        }
        
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.currentUser = null;
        this.allUsers = [];
        this.allSpecs = [];
        this.allMarketResearch = [];
        this.allDashboards = [];
        this.allTasks = [];
        this.allMilestones = [];
        this.allSavedTools = [];
        this.allLikes = [];
        this.allNotes = [];
        this.allExpenses = [];
        this.allPurchases = [];
        this.allSubscriptions = [];
        this.allEntitlements = [];
        this.autoRefreshInterval = null;
        this.lastRefreshTime = null;
        
        this.init();
    }

    async init() {
        // Setup event listeners
        this.setupTabs();
        this.setupSubTabs();
        this.setupFilters();
    
    // Check Firebase connection
        this.updateFirebaseStatus('connecting', 'Connecting to Firebase...');
        
        // Get current user
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                this.updateFirebaseStatus('connected', 'Connected to Firebase');
                await this.loadAllData();
                
                // Setup auto-refresh every 24 hours
                this.setupAutoRefresh();
            } else {
                this.updateFirebaseStatus('error', 'Not authenticated');
            }
        });
    }

    // Update Firebase connection status
    updateFirebaseStatus(status, text) {
        const statusIndicator = document.getElementById('firebase-status');
        if (!statusIndicator) return;
        
        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = statusIndicator.querySelector('.status-text');
        
        // Remove all status classes
        statusDot.classList.remove('connected', 'error');
        
        // Add appropriate class
        if (status === 'connected') {
            statusDot.classList.add('connected');
        } else if (status === 'error') {
            statusDot.classList.add('error');
        }
        
        statusText.textContent = text;
    }

    // Setup auto-refresh every 24 hours
    setupAutoRefresh() {
        // Clear existing interval if any
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Refresh every 24 hours (86400000 ms)
        this.autoRefreshInterval = setInterval(() => {
            this.refreshAllData();
        }, 86400000);
    }

    // Load payment data from Firestore
    async loadPaymentData() {
        try {
            // Load purchases
            const purchasesSnapshot = await this.db.collection('purchases').get();
            this.allPurchases = purchasesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load subscriptions
            const subscriptionsSnapshot = await this.db.collection('subscriptions').get();
            this.allSubscriptions = subscriptionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load entitlements
            const entitlementsSnapshot = await this.db.collection('entitlements').get();
            this.allEntitlements = entitlementsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.updatePaymentStats();
            this.updateRevenueAnalytics();
            this.updateProductPerformance();
            this.updateSubscriptionAnalytics();
            this.updateTransactionsTable();
            this.updateUserPaymentsTable();

        } catch (error) {
            console.error('Error loading payment data:', error);
            this.showNotification('❌ Error loading payment data: ' + error.message, 'error');
        }
    }

    // Manual refresh all data
    async refreshAllData() {
        const refreshBtn = document.getElementById('refresh-all-data');
        if (refreshBtn) {
            refreshBtn.classList.add('refreshing');
            refreshBtn.disabled = true;
        }
        
        this.showNotification('Refreshing all data...', 'info');
        
        try {
            await this.loadAllData();
            this.lastRefreshTime = new Date();
            this.updateLastRefreshTime();
            this.showNotification('Data refreshed successfully', 'success');
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showNotification('Error refreshing data: ' + error.message, 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('refreshing');
                refreshBtn.disabled = false;
            }
        }
    }

    // Sync current user to Firestore (creates user document if missing)
    async syncUsersFromAuth() {
        const syncBtn = document.getElementById('sync-users-btn');
        if (syncBtn) {
            syncBtn.classList.add('syncing');
            syncBtn.disabled = true;
        }
        
        this.showNotification('🔄 Creating user documents in Firestore...', 'info');
        
        try {
            // For now, we can only sync the current user and create a template
            // A full sync would require Firebase Admin SDK with service account
            
            if (!this.currentUser) {
                throw new Error('No user logged in');
            }
            
            // Create/update current user document
            const userRef = this.db.collection('users').doc(this.currentUser.uid);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                await userRef.set({
                    email: this.currentUser.email,
                    displayName: this.currentUser.displayName || this.currentUser.email.split('@')[0],
                    emailVerified: this.currentUser.emailVerified,
                    createdAt: new Date().toISOString(),
                    lastActive: new Date().toISOString(),
                    newsletterSubscription: false
                });
                this.showNotification('✅ Current user synced! Note: Other users will be synced when they login.', 'success');
            } else {
                // Update lastActive
                await userRef.update({
                    lastActive: new Date().toISOString()
                });
                this.showNotification('✅ Current user updated! Note: Other users will be synced when they login.', 'success');
            }
            
            // Reload users data
            await this.loadUsersData();
            this.updateStatsCards();
            this.updateAnalytics();
            
        } catch (error) {
            console.error('❌ Error syncing users:', error);
            this.showNotification('❌ Error: ' + error.message, 'error');
        } finally {
            if (syncBtn) {
                syncBtn.classList.remove('syncing');
                syncBtn.disabled = false;
            }
        }
    }

    // Update last refresh time display
    updateLastRefreshTime() {
        const lastRefreshEl = document.getElementById('last-refresh-time');
        if (!lastRefreshEl) return;
        
        if (!this.lastRefreshTime) {
            lastRefreshEl.textContent = 'Never refreshed';
            return;
        }
        
        const now = new Date();
        const diff = now - this.lastRefreshTime;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        
        if (minutes < 1) {
            lastRefreshEl.textContent = 'Just now';
        } else if (minutes < 60) {
            lastRefreshEl.textContent = `Last refresh: ${minutes} min ago`;
        } else if (hours < 24) {
            lastRefreshEl.textContent = `Last refresh: ${hours} hours ago`;
                } else {
            lastRefreshEl.textContent = `Last refresh: ${this.lastRefreshTime.toLocaleString()}`;
        }
    }

    // Setup main tabs
    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // Remove active class from all
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked
                btn.classList.add('active');
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });
    }

    // Setup sub tabs
    setupSubTabs() {
        const subTabBtns = document.querySelectorAll('.sub-tab-btn');
        const subTabContents = document.querySelectorAll('.sub-tab-content');

        subTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetSubTab = btn.dataset.subtab;
                
                // Remove active class from all
                subTabBtns.forEach(b => b.classList.remove('active'));
                subTabContents.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked
                btn.classList.add('active');
                document.getElementById(`${targetSubTab}-subtab`).classList.add('active');
                });
            });
    }

    // Setup filters and search
    setupFilters() {
        // Users filters
        document.getElementById('users-search')?.addEventListener('input', (e) => {
            this.filterUsers(e.target.value, document.getElementById('users-newsletter-filter').value);
        });
        
        document.getElementById('users-newsletter-filter')?.addEventListener('change', (e) => {
            this.filterUsers(document.getElementById('users-search').value, e.target.value);
        });

        // Specs filters
        document.getElementById('specs-search')?.addEventListener('input', () => this.filterSpecs());
        document.getElementById('specs-user-filter')?.addEventListener('input', () => this.filterSpecs());
        document.getElementById('specs-date-from')?.addEventListener('change', () => this.filterSpecs());
        document.getElementById('specs-date-to')?.addEventListener('change', () => this.filterSpecs());

        // Market Research filters
        document.getElementById('market-search')?.addEventListener('input', () => this.filterMarketResearch());
        document.getElementById('market-user-filter')?.addEventListener('input', () => this.filterMarketResearch());
        document.getElementById('market-date-from')?.addEventListener('change', () => this.filterMarketResearch());
        document.getElementById('market-date-to')?.addEventListener('change', () => this.filterMarketResearch());

        // Dashboards filters
        document.getElementById('dashboards-search')?.addEventListener('input', () => this.filterDashboards());
        document.getElementById('dashboards-user-filter')?.addEventListener('input', () => this.filterDashboards());
        document.getElementById('dashboards-date-from')?.addEventListener('change', () => this.filterDashboards());
        document.getElementById('dashboards-date-to')?.addEventListener('change', () => this.filterDashboards());
    }

    // Load all data
    async loadAllData() {
        try {
            // Load data sequentially to better track errors
            await this.loadUsersData();
            await this.loadSpecsData();
            await this.loadMarketResearchData();
            await this.loadDashboardsData();
            await this.loadActivityData();
            await this.loadPaymentData();
            
            this.updateStatsCards();
            this.updateAnalytics();
            
            // Update last refresh time
            this.lastRefreshTime = new Date();
            this.updateLastRefreshTime();
        } catch (error) {
            console.error('=== Error loading data ===', error);
            this.showNotification('Error loading data: ' + error.message, 'error');
        }
    }

    // Load users data
    async loadUsersData() {
        try {
            const usersSnapshot = await this.db.collection('users').get();
            
            // NO MOCK DATA - Only real data from Firebase
            this.allUsers = usersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data
                };
            });
            
            this.renderUsersTable(this.allUsers);
        } catch (error) {
            console.error('❌ Error loading users:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Full error:', error);
            
            // Show error in table
            const tbody = document.getElementById('users-table-body');
            if (tbody) {
                let errorMessage = error.message;
                if (error.code === 'permission-denied') {
                    errorMessage = 'Permission denied. Firestore Rules not deployed yet.';
                }
                
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--danger-color); padding: 20px;">
                            <strong>Error loading users:</strong> ${errorMessage}
                            <br><br>
                            <small>
                                <strong>Possible reasons:</strong><br>
                                1. Firestore Rules not deployed yet (most likely)<br>
                                2. Current user email: ${this.currentUser?.email}<br>
                                3. Please deploy the rules manually via Firebase Console
                            </small>
                        </td>
                    </tr>
                `;
            }
            
            // Don't throw - continue loading other data
            this.allUsers = [];
        }
    }

    // Load specs data
    async loadSpecsData() {
        try {
            const specsSnapshot = await this.db.collection('specs').get();
            
            // NO MOCK DATA - Only real data from Firebase
            this.allSpecs = specsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderSpecsTable(this.allSpecs);
        } catch (error) {
            console.error('Error loading specs:', error);
            const tbody = document.getElementById('specs-table-body');
            if (tbody) {
            tbody.innerHTML = `
                <tr>
                        <td colspan="5" style="text-align: center; color: var(--danger-color); padding: 20px;">
                            Error: ${error.message}
                    </td>
                </tr>
            `;
            }
            throw error;
        }
    }

    // Load market research data
    async loadMarketResearchData() {
        try {
            const marketSnapshot = await this.db.collection('marketResearch').get();
            
            // NO MOCK DATA - Only real data from Firebase
            this.allMarketResearch = marketSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderMarketResearchTable(this.allMarketResearch);
        } catch (error) {
            console.error('Error loading market research:', error);
            const tbody = document.getElementById('market-table-body');
            if (tbody) {
            tbody.innerHTML = `
                <tr>
                        <td colspan="5" style="text-align: center; color: var(--danger-color); padding: 20px;">
                            Error: ${error.message}
                    </td>
                </tr>
            `;
        }
            throw error;
        }
    }

    // Load dashboards data
    async loadDashboardsData() {
        try {
            // NO MOCK DATA - Only real data from Firebase
            const dashboardsSnapshot = await this.db.collection('apps').get();
            this.allDashboards = dashboardsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load tasks and milestones
            const tasksSnapshot = await this.db.collection('appTasks').get();
            this.allTasks = tasksSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const milestonesSnapshot = await this.db.collection('appMilestones').get();
            this.allMilestones = milestonesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderDashboardsTable(this.allDashboards);
        } catch (error) {
            console.error('Error loading dashboards:', error);
            const tbody = document.getElementById('dashboards-table-body');
            if (tbody) {
            tbody.innerHTML = `
                <tr>
                        <td colspan="7" style="text-align: center; color: var(--danger-color); padding: 20px;">
                            Error: ${error.message}
                    </td>
                </tr>
            `;
        }
            throw error;
        }
    }

    // Render users table
    renderUsersTable(users) {
        const tbody = document.getElementById('users-table-body');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${escapeHTML(user.email || 'N/A')}</td>
                <td>${this.formatDate(user.createdAt)}</td>
                <td><span class="status-badge status-${user.newsletterSubscription ? 'subscribed' : 'unsubscribed'}">${user.newsletterSubscription ? 'Subscribed' : 'Unsubscribed'}</span></td>
                <td>${this.formatDate(user.lastActive)}</td>
                <td>
                    <button class="btn-delete" onclick="adminDashboard.confirmDeleteUser('${escapeHTML(user.id)}', '${escapeHTML(user.email)}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Render specs table
    renderSpecsTable(specs) {
        const tbody = document.getElementById('specs-table-body');
        
        if (!specs || specs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No specs found</td></tr>';
            return;
        }

        tbody.innerHTML = specs.map(spec => `
            <tr>
                <td>${spec.title || 'Untitled'}</td>
                <td>${spec.userName || 'Unknown'}</td>
                <td>${this.formatDate(spec.createdAt)}</td>
                <td>${spec.mode || 'N/A'}</td>
                <td>
                    <button class="btn-view" onclick="adminDashboard.viewSpec('${spec.id}', 'specs')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
                </tr>
            `).join('');
    }

    // Render market research table
    renderMarketResearchTable(research) {
        const tbody = document.getElementById('market-table-body');
        
        if (!research || research.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No market research found</td></tr>';
            return;
        }

        tbody.innerHTML = research.map(item => `
            <tr>
                <td>${item.title || 'Untitled'}</td>
                <td>${item.userName || 'Unknown'}</td>
                <td>${this.formatDate(item.createdAt)}</td>
                <td>${item.mode || 'Market Research'}</td>
                <td>
                    <button class="btn-view" onclick="adminDashboard.viewSpec('${item.id}', 'marketResearch')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    </td>
                </tr>
        `).join('');
    }

    // Load activity data (saved tools, likes, notes, expenses)
    async loadActivityData() {
        console.log('📊 Loading activity data...');
        
        // Load saved tools with individual error handling
        try {
            const savedToolsSnapshot = await this.db.collectionGroup('savedTools').get();
            this.allSavedTools = savedToolsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`✅ Loaded ${this.allSavedTools.length} saved tools`);
        } catch (error) {
            console.warn('⚠️ Could not load saved tools:', error.code, error.message);
            this.allSavedTools = [];
            if (error.code === 'permission-denied') {
                console.warn('💡 Deploy updated Firestore Rules to enable saved tools data');
            }
        }

        // Load likes with individual error handling
        try {
            const likesSnapshot = await this.db.collection('userLikes').get();
            this.allLikes = likesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`✅ Loaded ${this.allLikes.length} likes`);
        } catch (error) {
            console.warn('⚠️ Could not load likes:', error.code, error.message);
            this.allLikes = [];
            if (error.code === 'permission-denied') {
                console.warn('💡 Deploy updated Firestore Rules to enable likes data');
            }
        }

        // Load notes with individual error handling
        try {
            const notesSnapshot = await this.db.collection('appNotes').get();
            this.allNotes = notesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`✅ Loaded ${this.allNotes.length} notes`);
        } catch (error) {
            console.warn('⚠️ Could not load notes:', error.code, error.message);
            this.allNotes = [];
        }

        // Load expenses with individual error handling
        try {
            const expensesSnapshot = await this.db.collection('appExpenses').get();
            this.allExpenses = expensesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`✅ Loaded ${this.allExpenses.length} expenses`);
        } catch (error) {
            console.warn('⚠️ Could not load expenses:', error.code, error.message);
            this.allExpenses = [];
        }

        // Render activity tables
        this.renderSavedToolsTable();
        this.renderActiveUsersTable();
        this.updateEngagementStats();
        
        console.log('📊 Activity data loading completed');
    }

    // Render saved tools table
    renderSavedToolsTable() {
        const tbody = document.getElementById('saved-tools-table-body');
        if (!tbody) return;
        
        if (!this.allSavedTools || this.allSavedTools.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px;">
                        <div style="color: var(--warning-color);">
                            <i class="fas fa-exclamation-triangle"></i> No saved tools data available
                        </div>
                        <small style="color: var(--primary-color);">
                            This might be due to:<br>
                            1. No users have saved tools yet, OR<br>
                            2. Firestore Rules need to be updated (check console for permission errors)
                        </small>
                    </td>
                        </tr>
            `;
            return;
        }

        // Group by tool name and count
        const toolStats = {};
        this.allSavedTools.forEach(tool => {
            const toolName = tool.toolName || 'Unknown Tool';
            if (!toolStats[toolName]) {
                toolStats[toolName] = {
                    count: 0,
                    users: new Set()
                };
            }
            toolStats[toolName].count++;
            if (tool.userId) {
                toolStats[toolName].users.add(tool.userId);
            }
        });

        // Convert to array and sort
        const toolArray = Object.entries(toolStats).map(([name, stats]) => ({
            name,
            count: stats.count,
            uniqueUsers: stats.users.size,
            popularity: ((stats.users.size / Math.max(this.allUsers.length, 1)) * 100).toFixed(1)
        })).sort((a, b) => b.count - a.count);

        tbody.innerHTML = toolArray.slice(0, 10).map((tool, index) => `
            <tr>
                <td><strong>${index + 1}.</strong> ${tool.name}</td>
                <td>${tool.count}</td>
                <td>${tool.uniqueUsers}</td>
                <td>${tool.popularity}%</td>
                            </tr>
        `).join('');
    }

    // Render active users table
    renderActiveUsersTable() {
        const tbody = document.getElementById('active-users-table-body');
        if (!tbody) return;
        
        if (!this.allUsers || this.allUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px;">
                        <div style="color: var(--warning-color);">
                            <i class="fas fa-exclamation-triangle"></i> No users data available
                        </div>
                        <small style="color: var(--primary-color);">
                            Click "Sync Users" button to sync your user data
                        </small>
                    </td>
                        </tr>
            `;
            return;
        }

        // Calculate activity per user
        const userActivity = this.allUsers.map(user => {
            const dashboards = this.allDashboards.filter(d => d.userId === user.id).length;
            const specs = this.allSpecs.filter(s => s.userId === user.id).length;
            const notes = this.allNotes.filter(n => n.userId === user.id).length;
            const total = dashboards + specs + notes;

            return {
                email: user.email || 'N/A',
                dashboards,
                specs,
                notes,
                total
            };
        }).filter(u => u.total > 0).sort((a, b) => b.total - a.total);

        if (userActivity.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px;">
                        <div style="color: var(--info-color);">
                            <i class="fas fa-info-circle"></i> No active users yet
                        </div>
                        <small style="color: var(--primary-color);">
                            Users will appear here once they create dashboards, specs, or notes
                        </small>
                    </td>
                            </tr>
            `;
            return;
        }

        tbody.innerHTML = userActivity.slice(0, 10).map((user, index) => `
            <tr>
                <td><strong>${index + 1}.</strong> ${user.email}</td>
                <td>${user.dashboards}</td>
                <td>${user.specs}</td>
                <td>${user.notes}</td>
                <td><strong>${user.total}</strong></td>
                        </tr>
        `).join('');
    }

    // Update engagement statistics
    updateEngagementStats() {
        if (this.allUsers.length === 0) {
            document.getElementById('users-with-dashboards-percent').textContent = '0%';
            document.getElementById('users-with-saved-tools-percent').textContent = '0%';
            document.getElementById('avg-dashboards-per-user').textContent = '0';
            document.getElementById('avg-specs-per-user').textContent = '0';
            return;
        }

        // Users with dashboards percentage
        const usersWithDashboards = new Set(this.allDashboards.map(d => d.userId)).size;
        const dashboardsPercent = ((usersWithDashboards / this.allUsers.length) * 100).toFixed(1);
        document.getElementById('users-with-dashboards-percent').textContent = dashboardsPercent + '%';

        // Users with saved tools percentage
        const usersWithTools = new Set(this.allSavedTools.map(t => t.userId).filter(Boolean)).size;
        const toolsPercent = ((usersWithTools / this.allUsers.length) * 100).toFixed(1);
        document.getElementById('users-with-saved-tools-percent').textContent = toolsPercent + '%';

        // Average dashboards per user
        const avgDashboards = (this.allDashboards.length / this.allUsers.length).toFixed(1);
        document.getElementById('avg-dashboards-per-user').textContent = avgDashboards;

        // Average specs per user
        const avgSpecs = (this.allSpecs.length / this.allUsers.length).toFixed(1);
        document.getElementById('avg-specs-per-user').textContent = avgSpecs;
    }

    renderDashboardsTable(dashboards) {
        const tbody = document.getElementById('dashboards-table-body');
        
        if (!dashboards || dashboards.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">No app dashboards found</td></tr>';
            return;
        }

        tbody.innerHTML = dashboards.map(dashboard => {
            const tasksCount = this.allTasks.filter(t => t.appId === dashboard.id).length;
            const milestonesCount = this.allMilestones.filter(m => m.appId === dashboard.id).length;
            const notesCount = this.allNotes.filter(n => n.appId === dashboard.id).length;
            const expensesCount = this.allExpenses.filter(e => e.appId === dashboard.id).length;
            
            return `
                <tr>
                    <td>${dashboard.appName || 'Untitled App'}</td>
                    <td>${dashboard.userEmail || 'Unknown'}</td>
                    <td>${this.formatDate(dashboard.createdAt)}</td>
                    <td><span class="status-badge status-active">Active</span></td>
                    <td>${tasksCount}</td>
                    <td>${milestonesCount}</td>
                    <td>${notesCount}</td>
                    <td>${expensesCount}</td>
                    <td>
                        <button class="btn-view" onclick="adminDashboard.viewDashboard('${dashboard.id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                            </tr>
            `;
        }).join('');
    }

    // Update stats cards - NO MOCK DATA, only real Firebase data
    updateStatsCards() {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Total users - REAL DATA ONLY
        document.getElementById('total-users').textContent = this.allUsers.length;

        // New users this week - REAL DATA ONLY
        const newUsersWeek = this.allUsers.filter(u => {
            const created = this.getDate(u.createdAt);
            return created && created >= oneWeekAgo;
        }).length;
        document.getElementById('new-users-week').textContent = newUsersWeek;

        // Total dashboards - REAL DATA ONLY
        document.getElementById('total-dashboards').textContent = this.allDashboards.length;

        // New dashboards this week - REAL DATA ONLY
        const newDashboardsWeek = this.allDashboards.filter(d => {
            const created = this.getDate(d.createdAt);
            return created && created >= oneWeekAgo;
        }).length;
        document.getElementById('new-dashboards-week').textContent = newDashboardsWeek;

        // Total specs - REAL DATA ONLY
        document.getElementById('total-specs').textContent = this.allSpecs.length;

        // Total market research - REAL DATA ONLY
        document.getElementById('total-market-research').textContent = this.allMarketResearch.length;

        // Total saved tools - REAL DATA ONLY
        document.getElementById('total-saved-tools').textContent = this.allSavedTools.length;

        // Total likes - REAL DATA ONLY
        document.getElementById('total-likes').textContent = this.allLikes.length;

        // Total notes - REAL DATA ONLY
        document.getElementById('total-notes').textContent = this.allNotes.length;

        // Total expenses - REAL DATA ONLY
        document.getElementById('total-expenses').textContent = this.allExpenses.length;
    }

    // Update analytics
    updateAnalytics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        oneWeekAgo.setHours(0, 0, 0, 0);
        
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        oneMonthAgo.setHours(0, 0, 0, 0);

        // Users analytics
        const usersToday = this.allUsers.filter(u => {
            const created = this.getDate(u.createdAt);
            return created && created >= today;
        }).length;
        
        const usersWeek = this.allUsers.filter(u => {
            const created = this.getDate(u.createdAt);
            return created && created >= oneWeekAgo;
        }).length;
        
        const usersMonth = this.allUsers.filter(u => {
            const created = this.getDate(u.createdAt);
            return created && created >= oneMonthAgo;
        }).length;

        document.getElementById('users-today').textContent = usersToday;
        document.getElementById('users-week').textContent = usersWeek;
        document.getElementById('users-month').textContent = usersMonth;

        // Dashboards analytics
        const dashboardsToday = this.allDashboards.filter(d => {
            const created = this.getDate(d.createdAt);
            return created && created >= today;
        }).length;
        
        const dashboardsWeek = this.allDashboards.filter(d => {
            const created = this.getDate(d.createdAt);
            return created && created >= oneWeekAgo;
        }).length;
        
        const dashboardsMonth = this.allDashboards.filter(d => {
            const created = this.getDate(d.createdAt);
            return created && created >= oneMonthAgo;
        }).length;

        document.getElementById('dashboards-today').textContent = dashboardsToday;
        document.getElementById('dashboards-week').textContent = dashboardsWeek;
        document.getElementById('dashboards-month').textContent = dashboardsMonth;

        // Specs analytics
        const specsToday = this.allSpecs.filter(s => {
            const created = this.getDate(s.createdAt);
            return created && created >= today;
        }).length;
        
        const specsWeek = this.allSpecs.filter(s => {
            const created = this.getDate(s.createdAt);
            return created && created >= oneWeekAgo;
        }).length;
        
        const specsMonth = this.allSpecs.filter(s => {
            const created = this.getDate(s.createdAt);
            return created && created >= oneMonthAgo;
        }).length;

        document.getElementById('specs-today').textContent = specsToday;
        document.getElementById('specs-week').textContent = specsWeek;
        document.getElementById('specs-month').textContent = specsMonth;
    }

    // Update payment statistics
    updatePaymentStats() {
        // Calculate total revenue
        const totalRevenue = this.allPurchases.reduce((sum, purchase) => {
            return sum + (purchase.total_amount_cents || 0);
        }, 0) / 100; // Convert cents to shekels

        // Calculate monthly revenue
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        const monthlyRevenue = this.allPurchases.filter(purchase => {
            const purchaseDate = this.getDate(purchase.purchased_at);
            return purchaseDate && purchaseDate >= oneMonthAgo;
        }).reduce((sum, purchase) => {
            return sum + (purchase.total_amount_cents || 0);
        }, 0) / 100;

        // Count active subscriptions
        const activeSubscriptions = this.allSubscriptions.filter(sub => 
            sub.status === 'active' || sub.status === 'trialing'
        ).length;

        // Count Pro users
        const proUsers = this.allEntitlements.filter(entitlement => 
            entitlement.unlimited === true
        ).length;

        // Calculate conversion rate
        const totalUsers = this.allUsers.length;
        const payingUsers = new Set([
            ...this.allPurchases.map(p => p.userId),
            ...this.allSubscriptions.map(s => s.userId)
        ]).size;
        const conversionRate = totalUsers > 0 ? (payingUsers / totalUsers * 100).toFixed(1) : 0;

        // Update DOM elements
        document.getElementById('total-revenue').textContent = `₪${totalRevenue.toFixed(0)}`;
        document.getElementById('total-purchases').textContent = this.allPurchases.length;
        document.getElementById('active-subscriptions').textContent = activeSubscriptions;
        document.getElementById('pro-users').textContent = proUsers;
        document.getElementById('monthly-revenue').textContent = `₪${monthlyRevenue.toFixed(0)}`;
        document.getElementById('conversion-rate').textContent = `${conversionRate}%`;
    }

    // Update revenue analytics
    updateRevenueAnalytics() {
        const today = new Date();
        const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);

        // Calculate revenue for different periods
        const revenueToday = this.calculateRevenueForPeriod(today, today);
        const revenueWeek = this.calculateRevenueForPeriod(oneWeekAgo, today);
        const revenueMonth = this.calculateRevenueForPeriod(oneMonthAgo, today);
        const revenueYear = this.calculateRevenueForPeriod(oneYearAgo, today);

        // Update DOM
        document.getElementById('revenue-today').textContent = `₪${revenueToday.toFixed(0)}`;
        document.getElementById('revenue-week').textContent = `₪${revenueWeek.toFixed(0)}`;
        document.getElementById('revenue-month').textContent = `₪${revenueMonth.toFixed(0)}`;
        document.getElementById('revenue-year').textContent = `₪${revenueYear.toFixed(0)}`;
    }

    // Calculate revenue for a specific period
    calculateRevenueForPeriod(startDate, endDate) {
        return this.allPurchases.filter(purchase => {
            const purchaseDate = this.getDate(purchase.purchased_at);
            return purchaseDate && purchaseDate >= startDate && purchaseDate <= endDate;
        }).reduce((sum, purchase) => {
            return sum + (purchase.total_amount_cents || 0);
        }, 0) / 100;
    }

    // Update product performance table
    updateProductPerformance() {
        const productStats = {};
        
        // Initialize product stats
        const products = {
            '671441': { name: 'Single AI Specification', price: 19 },
            '671442': { name: '3-Pack AI Specifications', price: 38 },
            '671443': { name: 'Pro Monthly Subscription', price: 115 },
            '671444': { name: 'Pro Yearly Subscription', price: 1150 }
        };

        Object.keys(products).forEach(productId => {
            productStats[productId] = {
                ...products[productId],
                salesCount: 0,
                revenue: 0
            };
        });

        // Calculate stats from purchases
        this.allPurchases.forEach(purchase => {
            if (productStats[purchase.product_id]) {
                productStats[purchase.product_id].salesCount++;
                productStats[purchase.product_id].revenue += (purchase.total_amount_cents || 0) / 100;
            }
        });

        // Calculate stats from subscriptions
        this.allSubscriptions.forEach(subscription => {
            if (productStats[subscription.product_id]) {
                productStats[subscription.product_id].salesCount++;
                // For subscriptions, calculate monthly revenue
                const monthlyRevenue = productStats[subscription.product_id].price;
                productStats[subscription.product_id].revenue += monthlyRevenue;
            }
        });

        // Update table
        const tbody = document.getElementById('product-performance-table');
        tbody.innerHTML = '';

        Object.values(productStats).forEach(product => {
            const conversionRate = this.allUsers.length > 0 ? 
                (product.salesCount / this.allUsers.length * 100).toFixed(1) : 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHTML(product.name)}</td>
                <td>₪${product.price}</td>
                <td>${product.salesCount}</td>
                <td>₪${product.revenue.toFixed(0)}</td>
                <td>${conversionRate}%</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(conversionRate * 10, 100)}%"></div>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Update subscription analytics
    updateSubscriptionAnalytics() {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const totalSubscribers = this.allSubscriptions.length;
        const newSubscribersMonth = this.allSubscriptions.filter(sub => {
            const createdDate = this.getDate(sub.created_at);
            return createdDate && createdDate >= oneMonthAgo;
        }).length;

        const cancelledSubscriptionsMonth = this.allSubscriptions.filter(sub => {
            const cancelledDate = this.getDate(sub.cancelled_at);
            return cancelledDate && cancelledDate >= oneMonthAgo;
        }).length;

        const churnRate = totalSubscribers > 0 ? 
            (cancelledSubscriptionsMonth / totalSubscribers * 100).toFixed(1) : 0;

        document.getElementById('total-subscribers').textContent = totalSubscribers;
        document.getElementById('new-subscribers-month').textContent = newSubscribersMonth;
        document.getElementById('cancelled-subscriptions-month').textContent = cancelledSubscriptionsMonth;
        document.getElementById('churn-rate').textContent = `${churnRate}%`;
    }

    // Update transactions table
    updateTransactionsTable() {
        const tbody = document.getElementById('transactions-table-body');
        tbody.innerHTML = '';

        // Combine purchases and subscriptions
        const allTransactions = [
            ...this.allPurchases.map(p => ({ ...p, type: 'purchase' })),
            ...this.allSubscriptions.map(s => ({ ...s, type: 'subscription' }))
        ].sort((a, b) => {
            const dateA = this.getDate(a.purchased_at || a.created_at);
            const dateB = this.getDate(b.purchased_at || b.created_at);
            return dateB - dateA;
        });

        allTransactions.slice(0, 50).forEach(transaction => {
            const date = this.getDate(transaction.purchased_at || transaction.created_at);
            const userEmail = this.getUserEmailById(transaction.userId);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date ? date.toLocaleDateString() : 'N/A'}</td>
                <td>${escapeHTML(userEmail || 'Unknown')}</td>
                <td>${escapeHTML(this.getProductName(transaction.product_id))}</td>
                <td>₪${((transaction.total_amount_cents || 0) / 100).toFixed(0)}</td>
                <td><span class="status-badge status-${transaction.type}">${transaction.type}</span></td>
                <td><span class="status-badge status-${transaction.status}">${transaction.status}</span></td>
                <td>
                    <button class="btn-view" onclick="adminDashboard.viewTransaction('${transaction.id}', '${transaction.type}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Update user payments table
    updateUserPaymentsTable() {
        const tbody = document.getElementById('user-payments-table-body');
        tbody.innerHTML = '';

        // Create user payment summary
        const userPayments = {};
        
        this.allUsers.forEach(user => {
            userPayments[user.id] = {
                email: user.email,
                plan: 'free',
                totalSpent: 0,
                purchases: 0,
                subscriptions: 0,
                lastPayment: null,
                status: 'active'
            };
        });

        // Add purchase data
        this.allPurchases.forEach(purchase => {
            if (userPayments[purchase.userId]) {
                userPayments[purchase.userId].totalSpent += (purchase.total_amount_cents || 0) / 100;
                userPayments[purchase.userId].purchases++;
                userPayments[purchase.userId].lastPayment = purchase.purchased_at;
            }
        });

        // Add subscription data
        this.allSubscriptions.forEach(subscription => {
            if (userPayments[subscription.userId]) {
                userPayments[subscription.userId].plan = 'pro';
                userPayments[subscription.userId].subscriptions++;
                userPayments[subscription.userId].lastPayment = subscription.created_at;
                userPayments[subscription.userId].status = subscription.status;
            }
        });

        // Sort by total spent
        const sortedUsers = Object.values(userPayments)
            .sort((a, b) => b.totalSpent - a.totalSpent);

        sortedUsers.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHTML(user.email)}</td>
                <td><span class="status-badge status-${user.plan}">${user.plan}</span></td>
                <td>₪${user.totalSpent.toFixed(0)}</td>
                <td>${user.purchases}</td>
                <td>${user.subscriptions}</td>
                <td>${user.lastPayment ? this.getDate(user.lastPayment).toLocaleDateString() : 'Never'}</td>
                <td><span class="status-badge status-${user.status}">${user.status}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    // Get product name by ID
    getProductName(productId) {
        const products = {
            '671441': 'Single AI Specification',
            '671442': '3-Pack AI Specifications',
            '671443': 'Pro Monthly Subscription',
            '671444': 'Pro Yearly Subscription'
        };
        return products[productId] || 'Unknown Product';
    }

    // Get user email by ID
    getUserEmailById(userId) {
        const user = this.allUsers.find(u => u.id === userId);
        return user ? user.email : null;
    }

    // Filter users
    filterUsers(searchTerm = '', newsletterFilter = 'all') {
        let filtered = [...this.allUsers];

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(u => 
                (u.email || '').toLowerCase().includes(term)
            );
        }

        // Newsletter filter
        if (newsletterFilter === 'subscribed') {
            filtered = filtered.filter(u => u.newsletterSubscription === true);
        } else if (newsletterFilter === 'unsubscribed') {
            filtered = filtered.filter(u => !u.newsletterSubscription);
        }

        this.renderUsersTable(filtered);
    }

    // Filter specs
    filterSpecs() {
        const searchTerm = document.getElementById('specs-search').value.toLowerCase();
        const userFilter = document.getElementById('specs-user-filter').value.toLowerCase();
        const dateFrom = document.getElementById('specs-date-from').value;
        const dateTo = document.getElementById('specs-date-to').value;

        let filtered = [...this.allSpecs];

        if (searchTerm) {
            filtered = filtered.filter(s => 
                (s.title || '').toLowerCase().includes(searchTerm)
            );
        }

        if (userFilter) {
            filtered = filtered.filter(s => 
                (s.userName || '').toLowerCase().includes(userFilter)
            );
        }

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filtered = filtered.filter(s => {
                const created = this.getDate(s.createdAt);
                return created && created >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(s => {
                const created = this.getDate(s.createdAt);
                return created && created <= toDate;
            });
        }

        this.renderSpecsTable(filtered);
    }

    // Filter market research
    filterMarketResearch() {
        const searchTerm = document.getElementById('market-search').value.toLowerCase();
        const userFilter = document.getElementById('market-user-filter').value.toLowerCase();
        const dateFrom = document.getElementById('market-date-from').value;
        const dateTo = document.getElementById('market-date-to').value;

        let filtered = [...this.allMarketResearch];

        if (searchTerm) {
            filtered = filtered.filter(m => 
                (m.title || '').toLowerCase().includes(searchTerm)
            );
        }

        if (userFilter) {
            filtered = filtered.filter(m => 
                (m.userName || '').toLowerCase().includes(userFilter)
            );
        }

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filtered = filtered.filter(m => {
                const created = this.getDate(m.createdAt);
                return created && created >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(m => {
                const created = this.getDate(m.createdAt);
                return created && created <= toDate;
            });
        }

        this.renderMarketResearchTable(filtered);
    }

    // Filter dashboards
    filterDashboards() {
        const searchTerm = document.getElementById('dashboards-search').value.toLowerCase();
        const userFilter = document.getElementById('dashboards-user-filter').value.toLowerCase();
        const dateFrom = document.getElementById('dashboards-date-from').value;
        const dateTo = document.getElementById('dashboards-date-to').value;

        let filtered = [...this.allDashboards];

        if (searchTerm) {
            filtered = filtered.filter(d => 
                (d.appName || '').toLowerCase().includes(searchTerm)
            );
        }

        if (userFilter) {
            filtered = filtered.filter(d => 
                (d.userEmail || '').toLowerCase().includes(userFilter)
            );
        }

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filtered = filtered.filter(d => {
                const created = this.getDate(d.createdAt);
                return created && created >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(d => {
                const created = this.getDate(d.createdAt);
                return created && created <= toDate;
            });
        }

        this.renderDashboardsTable(filtered);
    }

    // View spec in modal with Mermaid rendering
    async viewSpec(specId, collection) {
        try {
            const doc = await this.db.collection(collection).doc(specId).get();
            if (!doc.exists) {
                this.showNotification('Spec not found', 'error');
                return;
            }

            const data = doc.data();
            const content = data.content || 'No content available';
            
            document.getElementById('modal-title').textContent = data.title || 'Specification';
            
            // Store raw content for toggle
            document.getElementById('modal-spec-raw').textContent = content;
            
            // Render with Markdown and Mermaid
            await this.renderSpecContent(content);
            
            // Show modal
            document.getElementById('spec-modal').style.display = 'block';
            
            // Reset toggle button
            const toggleBtn = document.getElementById('toggle-view-btn');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="fas fa-code"></i> Show Raw';
            }
        } catch (error) {
            console.error('Error viewing spec:', error);
            this.showNotification('Error loading spec: ' + error.message, 'error');
        }
    }

    // Render spec content with Markdown and Mermaid
    async renderSpecContent(content) {
        const container = document.getElementById('modal-spec-content');
        if (!container) return;

        try {
            // First, convert Markdown to HTML
            let html = marked.parse(content);
            
            // Replace mermaid code blocks with divs for rendering
            html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, 
                '<div class="mermaid">$1</div>');
            
            // Also handle ```mermaid blocks that might not have the language class
            html = html.replace(/<pre><code>mermaid\n([\s\S]*?)<\/code><\/pre>/g, 
                '<div class="mermaid">$1</div>');
            
            // Set the HTML
            container.innerHTML = html;
            
            // Render all Mermaid diagrams
            const mermaidDivs = container.querySelectorAll('.mermaid');
            if (mermaidDivs.length > 0) {
                console.log(`🎨 Rendering ${mermaidDivs.length} Mermaid diagrams...`);
                
                for (let i = 0; i < mermaidDivs.length; i++) {
                    const div = mermaidDivs[i];
                    const code = div.textContent;
                    const id = `mermaid-${Date.now()}-${i}`;
                    
                    try {
                        const { svg } = await mermaid.render(id, code);
                        div.innerHTML = svg;
                        console.log(`✅ Rendered diagram ${i + 1}`);
                    } catch (error) {
                        console.error(`Error rendering Mermaid diagram ${i + 1}:`, error);
                        div.innerHTML = `<pre style="color: var(--danger-color);">Error rendering diagram:\n${code}</pre>`;
                    }
                }
            }
        } catch (error) {
            console.error('Error rendering content:', error);
            // Fallback to plain text
            container.textContent = content;
        }
    }

    // Toggle between rendered and raw view
    toggleView() {
        const renderedView = document.getElementById('modal-spec-content');
        const rawView = document.getElementById('modal-spec-raw');
        const toggleBtn = document.getElementById('toggle-view-btn');
        
        if (renderedView.style.display === 'none') {
            // Show rendered view
            renderedView.style.display = 'block';
            rawView.style.display = 'none';
            toggleBtn.innerHTML = '<i class="fas fa-code"></i> Show Raw';
        } else {
            // Show raw view
            renderedView.style.display = 'none';
            rawView.style.display = 'block';
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i> Show Rendered';
        }
    }

    // View dashboard details
    async viewDashboard(dashboardId) {
        try {
            const doc = await this.db.collection('apps').doc(dashboardId).get();
            if (!doc.exists) {
                this.showNotification('Dashboard not found', 'error');
                return;
            }

                const data = doc.data();
            const tasks = this.allTasks.filter(t => t.appId === dashboardId);
            const milestones = this.allMilestones.filter(m => m.appId === dashboardId);
            const notes = this.allNotes.filter(n => n.appId === dashboardId);
            const expenses = this.allExpenses.filter(e => e.appId === dashboardId);

            // Create formatted content in Markdown
            let content = `# ${data.appName || 'App Dashboard'}\n\n`;
            content += `**User:** ${data.userEmail || 'N/A'}  \n`;
            content += `**Created:** ${this.formatDate(data.createdAt)}\n\n`;
            
            content += `## Tasks (${tasks.length})\n\n`;
            if (tasks.length > 0) {
                tasks.forEach(task => {
                    const status = task.status || 'pending';
                    const icon = status === 'completed' ? '✅' : status === 'in-progress' ? '🔄' : '⏳';
                    content += `- ${icon} **${task.title || 'Untitled'}** - ${status}\n`;
                });
            } else {
                content += `*No tasks yet*\n`;
            }
            
            content += `\n## Milestones (${milestones.length})\n\n`;
            if (milestones.length > 0) {
                milestones.forEach(milestone => {
                    content += `- 🎯 ${milestone.title || 'Untitled'}\n`;
                });
            } else {
                content += `*No milestones yet*\n`;
            }
            
            content += `\n## Notes (${notes.length})\n\n`;
            if (notes.length > 0) {
                notes.forEach((note, i) => {
                    content += `${i + 1}. ${note.content || 'No content'}\n\n`;
                });
            } else {
                content += `*No notes yet*\n`;
            }
            
            content += `\n## Expenses (${expenses.length})\n\n`;
            if (expenses.length > 0) {
                let totalExpenses = 0;
                expenses.forEach(expense => {
                    const amount = expense.amount || 0;
                    totalExpenses += amount;
                    content += `- 💰 **${expense.description || 'N/A'}:** $${amount}\n`;
                });
                content += `\n**Total Expenses:** $${totalExpenses}\n`;
            } else {
                content += `*No expenses tracked yet*\n`;
            }

            document.getElementById('modal-title').textContent = data.appName || 'App Dashboard';
            
            // Store raw content for toggle
            document.getElementById('modal-spec-raw').textContent = content;
            
            // Render with Markdown
            await this.renderSpecContent(content);
            
            document.getElementById('spec-modal').style.display = 'block';
            
            // Reset toggle button
            const toggleBtn = document.getElementById('toggle-view-btn');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="fas fa-code"></i> Show Raw';
            }
        } catch (error) {
            console.error('Error viewing dashboard:', error);
            this.showNotification('Error loading dashboard: ' + error.message, 'error');
        }
    }

    // Close modal
    closeModal() {
        document.getElementById('spec-modal').style.display = 'none';
    }

    // Confirm delete user
    confirmDeleteUser(userId, userEmail) {
        document.getElementById('confirm-message').textContent = 
            `Are you sure you want to delete user "${userEmail}"? This will also delete all their specs, dashboards, and data.`;
        
        const confirmBtn = document.getElementById('confirm-delete-btn');
        confirmBtn.onclick = () => this.deleteUser(userId);
        
        document.getElementById('confirm-modal').style.display = 'block';
    }

    // Delete user
    async deleteUser(userId) {
        try {
            this.closeConfirmModal();
            this.showNotification('Deleting user...', 'info');

            // Delete user document
            await this.db.collection('users').doc(userId).delete();

            // Delete user's specs
            const specsSnapshot = await this.db.collection('specs')
                .where('userId', '==', userId).get();
            const specsDeletePromises = specsSnapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(specsDeletePromises);

            // Delete user's market research
            const marketSnapshot = await this.db.collection('marketResearch')
                .where('userId', '==', userId).get();
            const marketDeletePromises = marketSnapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(marketDeletePromises);

            // Delete user's apps
            const appsSnapshot = await this.db.collection('apps')
                .where('userId', '==', userId).get();
            const appsDeletePromises = appsSnapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(appsDeletePromises);

            // Delete user's tasks
            const tasksSnapshot = await this.db.collection('appTasks')
                .where('userId', '==', userId).get();
            const tasksDeletePromises = tasksSnapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(tasksDeletePromises);

            // Delete user's milestones
            const milestonesSnapshot = await this.db.collection('appMilestones')
                .where('userId', '==', userId).get();
            const milestonesDeletePromises = milestonesSnapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(milestonesDeletePromises);

            this.showNotification('User deleted successfully', 'success');
            await this.loadAllData();
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification('Error deleting user: ' + error.message, 'error');
        }
    }

    // Close confirm modal
    closeConfirmModal() {
        document.getElementById('confirm-modal').style.display = 'none';
    }

    // Format date
    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else {
            return 'N/A';
        }

        if (isNaN(date.getTime())) return 'N/A';
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Get date object
    getDate(timestamp) {
        if (!timestamp) return null;
        
        if (timestamp.toDate) {
            return timestamp.toDate();
        } else if (timestamp instanceof Date) {
            return timestamp;
        } else if (typeof timestamp === 'string') {
            return new Date(timestamp);
        }
        
        return null;
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10001;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const specModal = document.getElementById('spec-modal');
    const confirmModal = document.getElementById('confirm-modal');
    
    if (event.target === specModal) {
        adminDashboard.closeModal();
    }
    if (event.target === confirmModal) {
        adminDashboard.closeConfirmModal();
    }
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

