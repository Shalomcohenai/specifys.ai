// ============================================
// Demo Spec Charts - Chart initialization functions
// ============================================
// This file contains functions for initializing Chart.js charts
// extracted from old demo-spec.html

// Initialize Charts
function initializeCharts(charts) {
    if (!charts) return;
    
    // Market Growth Chart
    if (charts.marketGrowth) {
        const ctx = document.getElementById('marketGrowthChart');
        if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['2024', '2025', '2026', '2027', '2028', '2029', '2030'],
                    datasets: [{
                        label: 'Market Size (Billions $)',
                        data: charts.marketGrowth.data,
                        borderColor: '#6366F1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: true },
                        title: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            title: { display: true, text: 'Billions USD', font: { size: 14 } }
                        }
                    }
                }
            });
        }
    }
    
    // Search Trends Chart - Multi-line showing different keywords
    if (charts.searchTrends && charts.searchTrends.data) {
        const ctx = document.getElementById('searchTrendsChart');
        if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, {
                type: 'line',
                data: charts.searchTrends.data,
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: true, position: 'top' },
                        title: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: { 
                                display: true, 
                                text: 'Search Interest (0-100)', 
                                font: { size: 14 }
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        }
    }
    
    // Keyword Demand Bar Chart
    if (charts.keywordDemand && charts.keywordDemand.keywords) {
        const ctx = document.getElementById('keywordDemandChart');
        if (ctx && typeof Chart !== 'undefined') {
            const labels = charts.keywordDemand.keywords.map(k => k.term);
            const data = charts.keywordDemand.keywords.map(k => k.searches);
            
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Monthly Searches',
                        data: data,
                        backgroundColor: [
                            'rgba(99, 102, 241, 0.8)',
                            'rgba(16, 185, 129, 0.8)',
                            'rgba(139, 92, 246, 0.8)',
                            'rgba(245, 158, 11, 0.8)',
                            'rgba(236, 72, 153, 0.8)'
                        ],
                        borderColor: [
                            '#6366F1',
                            '#10B981',
                            '#8B5CF6',
                            '#F59E0B',
                            '#EC4899'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        title: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { 
                                display: true, 
                                text: 'Monthly Searches', 
                                font: { size: 14 }
                            }
                        },
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    }
                }
            });
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.initializeCharts = initializeCharts;
}
