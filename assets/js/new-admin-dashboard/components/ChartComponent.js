/**
 * Chart Component - Wrapper for Chart.js with animations
 */

export class ChartComponent {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.chart = null;
    
    if (window.Chart) {
      this.init();
    } else {
      console.warn('[ChartComponent] Chart.js not loaded');
    }
  }
  
  /**
   * Initialize chart
   */
  init() {
    if (!this.canvas || !window.Chart) return;
    
    const ctx = this.canvas.getContext('2d');
    
    // Default options
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutCubic'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 8,
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
          cornerRadius: 4
        }
      },
      scales: {
        x: {
          ticks: { 
            color: '#6b7280',
            font: { size: 10 }
          },
          grid: { 
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          }
        },
        y: {
          ticks: { 
            color: '#6b7280',
            font: { size: 10 }
          },
          grid: { 
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          beginAtZero: true
        }
      }
    };
    
    const mergedConfig = {
      ...this.config,
      options: {
        ...defaultOptions,
        ...this.config.options
      }
    };
    
    this.chart = new window.Chart(ctx, mergedConfig);
  }
  
  /**
   * Update chart data
   */
  updateData(newData) {
    if (!this.chart) return;
    
    if (newData.labels) {
      this.chart.data.labels = newData.labels;
    }
    
    if (newData.datasets) {
      this.chart.data.datasets = newData.datasets;
    } else if (newData.data) {
      // Update first dataset data
      if (this.chart.data.datasets[0]) {
        this.chart.data.datasets[0].data = newData.data;
      }
    }
    
    this.chart.update('active');
  }
  
  /**
   * Update chart with animation
   */
  updateWithAnimation(newData) {
    if (!this.chart) return;
    
    this.updateData(newData);
    this.chart.update();
  }
  
  /**
   * Destroy chart
   */
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
  
  /**
   * Get chart instance
   */
  getChart() {
    return this.chart;
  }
}

