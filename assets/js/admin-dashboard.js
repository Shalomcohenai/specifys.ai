// Admin Dashboard JavaScript Functions
// This file contains all the admin-specific functionality

class AdminDashboard {
    constructor() {
        this.init();
    }

    init() {
        // Clear all tables immediately on init
        this.clearAllTables();
        this.checkFirebaseConnection();
        this.loadDashboardData();
        this.setupEventListeners();
        // Removed automatic updates - only manual refresh
    }
    
    // Check Firebase connection
    async checkFirebaseConnection() {
        try {
            const db = firebase.firestore();
            
            // Enable offline persistence
            await db.enablePersistence({
                synchronizeTabs: true
            }).catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                } else if (err.code === 'unimplemented') {
                    console.warn('The current browser does not support all features required for persistence');
                }
            });
            
            // Test connection with a simple read
            const testDoc = await db.collection('test').doc('connection').get();
            
            // Update connection status
            this.updateConnectionStatus(true);
            
        } catch (error) {
            console.error('Firebase connection error:', error);
            this.updateConnectionStatus(false);
            
            // Check if it's a permission error
            if (error.code === 'permission-denied') {
                this.showError('Firebase permission denied. Please check your authentication.');
            } else if (error.code === 'unavailable') {
                this.showError('Firebase service unavailable. Please check your internet connection.');
            } else {
                this.showError('Firebase connection failed. Please refresh the page.');
            }
        }
    }
    
    // Update connection status indicator
    updateConnectionStatus(isConnected) {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;
        
        if (isConnected) {
            statusElement.innerHTML = '<i class="fas fa-circle" style="font-size: 8px; margin-right: 5px; color: var(--success-color);"></i>Connected to Firebase';
            statusElement.style.color = 'var(--success-color)';
        } else {
            statusElement.innerHTML = '<i class="fas fa-circle" style="font-size: 8px; margin-right: 5px; color: var(--danger-color);"></i>Firebase Connection Failed';
            statusElement.style.color = 'var(--danger-color)';
        }
    }
    
    // No sample data creation - only real data from Firebase

    // Load initial dashboard data
    async loadDashboardData() {
        try {
            this.showInfo('Loading dashboard data from Firebase...');
            
            // Clear all tables first
            this.clearAllTables();
            
            const stats = await this.fetchStats();
            const toolUsage = await this.fetchToolUsage();
            const userActivity = await this.fetchUserActivity();
            
            this.updateStatsCards(stats);
            this.updateToolUsageTable(toolUsage);
            this.updateUserActivityTable(userActivity);
            
            this.showSuccess('Dashboard data loaded successfully from Firebase');
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data from Firebase. Please check your connection.');
            
            // Show empty tables on error
            this.clearAllTables();
        }
    }
    
    // Clear all tables
    clearAllTables() {
        const allTbodies = document.querySelectorAll('.admin-table tbody');
        allTbodies.forEach((tbody, index) => {
            if (index === 0) {
                // Tool usage table
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--primary-color); padding: 20px;">
                            Loading tool usage data from Firebase...
                        </td>
                    </tr>
                `;
            } else if (index === 1) {
                // Specs table
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--primary-color); padding: 20px;">
                            Loading spec data from Firebase...
                        </td>
                    </tr>
                `;
            } else if (index === 2) {
                // User activity table
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--primary-color); padding: 20px;">
                            Loading user activity data from Firebase...
                        </td>
                    </tr>
                `;
            }
        });
    }

    // Fetch statistics from Firebase
    async fetchStats() {
        try {
            const db = firebase.firestore();
            
            // Get total users
            const usersSnapshot = await db.collection('users').get();
            const totalUsers = usersSnapshot.size;
            
            // Get total specs
            const specsSnapshot = await db.collection('specs').get();
            const totalSpecs = specsSnapshot.size;
            
            // Get total chats
            const chatsSnapshot = await db.collection('chats').get();
            const totalChats = chatsSnapshot.size;
            
            // Get incomplete chats
            let incompleteChats = 0;
            chatsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.status !== 'completed' && data.status !== 'cancelled') {
                    incompleteChats++;
                }
            });
            
            // Get active tools (tools used in last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const toolUsageSnapshot = await db.collection('toolUsage')
                .where('timestamp', '>=', sevenDaysAgo)
                .get();
            const activeTools = new Set();
            toolUsageSnapshot.forEach(doc => {
                activeTools.add(doc.data().toolName);
            });
            
            // Get daily usage (today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const dailyUsageSnapshot = await db.collection('toolUsage')
                .where('timestamp', '>=', today)
                .where('timestamp', '<', tomorrow)
                .get();
            const dailyUsage = dailyUsageSnapshot.size;
            
            return {
                totalUsers,
                activeTools: activeTools.size,
                totalSpecs,
                totalChats,
                incompleteChats,
                dailyUsage
            };
        } catch (error) {
            console.error('Error fetching stats:', error);
            throw error; // Re-throw to be handled by loadDashboardData
        }
    }

    // Fetch tool usage data
    async fetchToolUsage() {
        try {
            const db = firebase.firestore();
            const toolUsageSnapshot = await db.collection('toolUsage').get();
            
            const toolStats = {};
            toolUsageSnapshot.forEach(doc => {
                const data = doc.data();
                const toolName = data.toolName || 'Unknown Tool';
                
                if (!toolStats[toolName]) {
                    toolStats[toolName] = {
                        usage: 0,
                        lastWeek: 0,
                        thisWeek: 0
                    };
                }
                
                toolStats[toolName].usage++;
                
                // Calculate weekly trends
                const timestamp = data.timestamp?.toDate() || new Date();
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                
                if (timestamp >= oneWeekAgo) {
                    toolStats[toolName].thisWeek++;
                } else {
                    toolStats[toolName].lastWeek++;
                }
            });
            
            // Convert to array and calculate percentages
            const totalUsage = Object.values(toolStats).reduce((sum, tool) => sum + tool.usage, 0);
            const toolArray = Object.entries(toolStats).map(([name, stats]) => {
                const percentage = totalUsage > 0 ? (stats.usage / totalUsage * 100).toFixed(1) : 0;
                const trend = stats.lastWeek > 0 ? 
                    ((stats.thisWeek - stats.lastWeek) / stats.lastWeek * 100).toFixed(1) : 0;
                
                return {
                    name,
                    usage: stats.usage,
                    percentage: parseFloat(percentage),
                    trend: parseFloat(trend),
                    status: 'active'
                };
            }).sort((a, b) => b.usage - a.usage);
            
            return toolArray;
        } catch (error) {
            console.error('Error fetching tool usage:', error);
            throw error; // Re-throw to be handled by loadDashboardData
        }
    }

    // Fetch user activity data
    async fetchUserActivity() {
        try {
            const db = firebase.firestore();
            const activities = [];
            
            // Get recent specs
            const specsSnapshot = await db.collection('specs')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();
            
            specsSnapshot.forEach(doc => {
                const data = doc.data();
                const createdAt = data.createdAt?.toDate() || new Date();
                activities.push({
                    user: data.userEmail || 'Unknown User',
                    activity: 'Created spec',
                    tool: data.specType || 'Unknown Type',
                    time: this.getTimeAgo(createdAt),
                    status: 'completed',
                    timestamp: createdAt
                });
            });
            
            // Get recent chats
            const chatsSnapshot = await db.collection('chats')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();
            
            chatsSnapshot.forEach(doc => {
                const data = doc.data();
                const createdAt = data.createdAt?.toDate() || new Date();
                activities.push({
                    user: data.userEmail || 'Unknown User',
                    activity: data.status === 'completed' ? 'Completed chat' : 
                             data.status === 'in_progress' ? 'Started chat' : 'Abandoned chat',
                    tool: data.chatType || 'Unknown Type',
                    time: this.getTimeAgo(createdAt),
                    status: data.status || 'unknown',
                    timestamp: createdAt
                });
            });
            
            // Get recent tool usage
            const toolUsageSnapshot = await db.collection('toolUsage')
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();
            
            toolUsageSnapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = data.timestamp?.toDate() || new Date();
                activities.push({
                    user: data.userEmail || 'Unknown User',
                    activity: 'Used tool',
                    tool: data.toolName || 'Unknown Tool',
                    time: this.getTimeAgo(timestamp),
                    status: 'completed',
                    timestamp: timestamp
                });
            });
            
            // Sort by timestamp and return top 10
            return activities
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10);
                
        } catch (error) {
            console.error('Error fetching user activity:', error);
            throw error; // Re-throw to be handled by loadDashboardData
        }
    }
    
    // Helper function to get time ago string
    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) {
            return `${diffInSeconds} seconds ago`;
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} min ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} hours ago`;
        } else {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days} days ago`;
        }
    }

    // Update stats cards
    updateStatsCards(stats) {
        document.getElementById('total-users').textContent = stats.totalUsers.toLocaleString();
        document.getElementById('active-tools').textContent = stats.activeTools.toLocaleString();
        document.getElementById('total-specs').textContent = stats.totalSpecs.toLocaleString();
        document.getElementById('total-chats').textContent = stats.totalChats.toLocaleString();
        document.getElementById('incomplete-chats').textContent = stats.incompleteChats.toLocaleString();
        document.getElementById('daily-usage').textContent = stats.dailyUsage.toLocaleString();
    }

    // Update tool usage table
    updateToolUsageTable(toolUsage) {
        const tbody = document.querySelector('.admin-table tbody');
        if (!tbody) return;

        // Clear any existing data first
        tbody.innerHTML = '';
        
        // Only show real data from Firebase
        if (toolUsage && toolUsage.length > 0) {
            tbody.innerHTML = toolUsage.map(tool => `
                <tr>
                    <td><i class="fas fa-search"></i> ${tool.name}</td>
                    <td>${tool.usage.toLocaleString()}</td>
                    <td>${tool.percentage}%</td>
                    <td><span class="stat-card-change ${tool.trend > 0 ? 'positive' : 'negative'}">${tool.trend > 0 ? '↗' : '↘'} ${Math.abs(tool.trend)}%</span></td>
                    <td><span class="status-badge status-active">Active</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--primary-color); padding: 20px;">
                        No real tool usage data found in Firebase
                    </td>
                </tr>
            `;
        }
    }

    // Update user activity table
    updateUserActivityTable(userActivity) {
        const tbody = document.querySelectorAll('.admin-table tbody')[2]; // Third table
        if (!tbody) return;

        // Clear any existing data first
        tbody.innerHTML = '';
        
        // Only show real data from Firebase
        if (userActivity && userActivity.length > 0) {
            tbody.innerHTML = userActivity.map(activity => `
                <tr>
                    <td>${activity.user}</td>
                    <td>${activity.activity}</td>
                    <td>${activity.tool}</td>
                    <td>${activity.time}</td>
                    <td><span class="status-badge status-${activity.status === 'completed' ? 'active' : activity.status === 'in_progress' ? 'pending' : 'inactive'}">${this.formatStatus(activity.status)}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--primary-color); padding: 20px;">
                        No real user activity data found in Firebase
                    </td>
                </tr>
            `;
        }
    }

    // Format status for display
    formatStatus(status) {
        const statusMap = {
            'completed': 'Completed',
            'in_progress': 'In Progress',
            'abandoned': 'Abandoned'
        };
        return statusMap[status] || status;
    }

    // Charts removed - only real data tables

    // Setup event listeners
    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.manualRefresh());
        }

        // Export buttons
        const exportBtns = document.querySelectorAll('.export-btn');
        exportBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.exportData(e.target.dataset.format));
        });

        // Search functionality
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterTables(e.target.value));
        }
    }

    // Manual refresh only - no automatic updates
    manualRefresh() {
        this.showInfo('Refreshing data from Firebase...');
        this.loadDashboardData();
    }

    // Export data functionality
    exportData(format) {
        switch (format) {
            case 'csv':
                this.exportToCSV();
                break;
            case 'pdf':
                this.exportToPDF();
                break;
            case 'excel':
                this.exportToExcel();
                break;
            default:
                console.error('Unknown export format:', format);
        }
    }

    // Export to CSV
    exportToCSV() {
        const data = this.getTableData();
        const csv = this.convertToCSV(data);
        this.downloadFile(csv, 'admin-dashboard-data.csv', 'text/csv');
    }

    // Export to PDF
    exportToPDF() {
        try {
            // Create a simple HTML report
            const reportData = this.generateReportData();
            const htmlContent = this.generateHTMLReport(reportData);
            
            // Open in new window for printing
            const printWindow = window.open('', '_blank');
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();
            
            // Wait for content to load then print
            setTimeout(() => {
                printWindow.print();
            }, 500);
            
            this.showSuccess('PDF report opened for printing');
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showError('Failed to generate PDF report');
        }
    }

    // Export to Excel
    exportToExcel() {
        try {
            const data = this.getTableData();
            const csvContent = this.convertToCSV(data);
            
            // Convert CSV to Excel format (simple approach)
            const excelContent = this.convertCSVToExcel(csvContent);
            this.downloadFile(excelContent, 'admin-dashboard-data.xls', 'application/vnd.ms-excel');
            
            this.showSuccess('Excel file downloaded successfully');
        } catch (error) {
            console.error('Error generating Excel:', error);
            this.showError('Failed to generate Excel file');
        }
    }
    
    // Generate report data
    generateReportData() {
        const stats = {
            totalUsers: document.getElementById('total-users').textContent,
            activeTools: document.getElementById('active-tools').textContent,
            totalSpecs: document.getElementById('total-specs').textContent,
            totalChats: document.getElementById('total-chats').textContent,
            incompleteChats: document.getElementById('incomplete-chats').textContent,
            dailyUsage: document.getElementById('daily-usage').textContent
        };
        
        const toolUsage = this.getTableData()[0] || [];
        const userActivity = this.getTableData()[2] || [];
        
        return { stats, toolUsage, userActivity };
    }
    
    // Generate HTML report
    generateHTMLReport(data) {
        const currentDate = new Date().toLocaleDateString();
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Specifys.ai Admin Report - ${currentDate}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #0078d4; }
                    h2 { color: #666; border-bottom: 2px solid #0078d4; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                    .stat-item { text-align: center; padding: 20px; background: #f9f9f9; border-radius: 8px; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #0078d4; }
                    .stat-label { color: #666; }
                </style>
            </head>
            <body>
                <h1>Specifys.ai Admin Dashboard Report</h1>
                <p>Generated on: ${currentDate}</p>
                
                <h2>Statistics Overview</h2>
                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-value">${data.stats.totalUsers}</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${data.stats.activeTools}</div>
                        <div class="stat-label">Active Tools</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${data.stats.totalSpecs}</div>
                        <div class="stat-label">Total Specs</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${data.stats.totalChats}</div>
                        <div class="stat-label">Total Chats</div>
                    </div>
                </div>
                
                <h2>Tool Usage</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Tool Name</th>
                            <th>Usage Count</th>
                            <th>Percentage</th>
                            <th>Trend</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.toolUsage.map(row => `
                            <tr>
                                <td>${row[0]}</td>
                                <td>${row[1]}</td>
                                <td>${row[2]}</td>
                                <td>${row[3]}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <h2>Recent User Activity</h2>
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Activity</th>
                            <th>Tool Used</th>
                            <th>Time</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.userActivity.map(row => `
                            <tr>
                                <td>${row[0]}</td>
                                <td>${row[1]}</td>
                                <td>${row[2]}</td>
                                <td>${row[3]}</td>
                                <td>${row[4]}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
    }
    
    // Convert CSV to Excel format
    convertCSVToExcel(csvContent) {
        // Simple Excel format - just add BOM for UTF-8
        return '\uFEFF' + csvContent;
    }

    // Get table data for export
    getTableData() {
        const tables = document.querySelectorAll('.admin-table');
        const data = [];
        
        tables.forEach(table => {
            const rows = Array.from(table.querySelectorAll('tr'));
            const tableData = rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td, th'));
                return cells.map(cell => cell.textContent.trim());
            });
            data.push(tableData);
        });
        
        return data;
    }

    // Convert data to CSV format
    convertToCSV(data) {
        return data.map(table => 
            table.map(row => row.join(',')).join('\n')
        ).join('\n\n');
    }

    // Download file
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Filter tables based on search input
    filterTables(searchTerm) {
        const tables = document.querySelectorAll('.admin-table tbody');
        const term = searchTerm.toLowerCase();
        
        tables.forEach(tbody => {
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const shouldShow = text.includes(term);
                row.style.display = shouldShow ? '' : 'none';
            });
        });
    }

    // Show success message
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // Show error message
    showError(message) {
        this.showNotification(message, 'error');
    }

    // Show info message
    showInfo(message) {
        this.showNotification(message, 'info');
    }

    // Show notification
    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            animation: slideUp 0.3s ease-out;
        `;

        // Add to page
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Get notification icon
    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Get notification color
    getNotificationColor(type) {
        const colors = {
            'success': '#28a745',
            'error': '#dc3545',
            'info': '#17a2b8'
        };
        return colors[type] || '#17a2b8';
    }

    // Get user analytics
    async getUserAnalytics() {
        try {
            // This would connect to Firebase and get real user data
            const db = firebase.firestore();
            const usersSnapshot = await db.collection('users').get();
            const specsSnapshot = await db.collection('specs').get();
            const chatsSnapshot = await db.collection('chats').get();
            
            return {
                totalUsers: usersSnapshot.size,
                totalSpecs: specsSnapshot.size,
                totalChats: chatsSnapshot.size,
                activeUsers: await this.getActiveUsers(),
                completionRate: await this.getCompletionRate()
            };
        } catch (error) {
            console.error('Error fetching user analytics:', error);
            return null;
        }
    }

    // Get active users (users who used the site in the last 7 days)
    async getActiveUsers() {
        const db = firebase.firestore();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const activeUsersSnapshot = await db.collection('users')
            .where('lastActive', '>=', sevenDaysAgo)
            .get();
            
        return activeUsersSnapshot.size;
    }

    // Get completion rate for chat sessions
    async getCompletionRate() {
        const db = firebase.firestore();
        const chatsSnapshot = await db.collection('chats').get();
        
        let completed = 0;
        let total = chatsSnapshot.size;
        
        chatsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'completed') {
                completed++;
            }
        });
        
        return total > 0 ? (completed / total * 100).toFixed(1) : 0;
    }

    // Get tool usage analytics
    async getToolUsageAnalytics() {
        try {
            const db = firebase.firestore();
            const toolUsageSnapshot = await db.collection('toolUsage').get();
            
            const toolStats = {};
            toolUsageSnapshot.forEach(doc => {
                const data = doc.data();
                const toolName = data.toolName;
                
                if (!toolStats[toolName]) {
                    toolStats[toolName] = {
                        count: 0,
                        users: new Set()
                    };
                }
                
                toolStats[toolName].count++;
                toolStats[toolName].users.add(data.userId);
            });
            
            // Convert to array and sort by usage
            return Object.entries(toolStats).map(([name, stats]) => ({
                name,
                usage: stats.count,
                uniqueUsers: stats.users.size
            })).sort((a, b) => b.usage - a.usage);
            
        } catch (error) {
            console.error('Error fetching tool usage analytics:', error);
            return [];
        }
    }
}

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
