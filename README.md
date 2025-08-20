# 🚀 Specifys.ai - AI-Powered Application Specification Platform

## 📖 Overview

Specifys.ai is a comprehensive platform that helps users create detailed application specifications using AI. Whether you're a non-coder with big ideas, a developer building robust apps, or an entrepreneur validating startup ideas, Specifys.ai provides the tools and guidance you need.

## ✨ Features

### 🎯 **Core Functionality**
- **AI-Powered Spec Generation** - Create detailed application specifications
- **Multiple User Tracks** - Novice, Developer, and Market-focused approaches
- **Tool Finder** - Discover the perfect tools for your project
- **Vibe Coding Tools Map** - Explore coding tools and platforms
- **Interactive Learning** - Step-by-step guidance for different skill levels

### 🛠️ **Technical Features**
- **Responsive Design** - Works on all devices
- **Dark/Light Mode** - Customizable user experience
- **Modern UI/UX** - Beautiful, intuitive interface
- **Performance Optimized** - Fast loading and smooth interactions
- **SEO Optimized** - Built for search engine visibility

### 📊 **Content Management**
- **Blog System** - Articles about AI, coding, and tech trends
- **Dynamic Content** - Personalized recommendations
- **Multi-language Support** - Hebrew and English content
- **Rich Media** - Images, videos, and interactive elements

## 🏗️ Architecture

### **Frontend**
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS variables
- **JavaScript (ES6+)** - Interactive functionality
- **Responsive Grid** - Flexbox and CSS Grid layouts

### **Backend Services**
- **Node.js Server** - Express.js framework
- **Google Apps Script** - Google Sheets integration
- **Email Services** - Nodemailer integration
- **CORS Handling** - Cross-origin request management

### **Data Storage**
- **Google Sheets** - Feedback and user data
- **JSON Files** - Static content and configuration
- **Environment Variables** - Secure configuration management

## 🚀 Getting Started

### **Prerequisites**
- Node.js (v14 or higher)
- npm or yarn
- Git
- Google account (for Google Apps Script)

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/Shalomcohenai/specifys.ai.git
   cd specifys.ai
   ```

2. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   ./start-server.sh  # macOS/Linux
   # or
   start-server.bat   # Windows
   # or
   npm start
   ```

### **Environment Variables**

Create a `.env` file in the `server` directory:

```env
# Server Configuration
PORT=10000
NODE_ENV=development

# Email Configuration (Optional)
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password
FEEDBACK_EMAIL=feedback@specifys-ai.com

# API Keys (Optional)
API_KEY=your-openai-api-key

# Google Services (Optional)
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

## 📁 Project Structure

```
specifys-ai/
├── 📄 index.html              # Main homepage
├── 📄 about.html              # About us page
├── 📄 how.html                # How it works page
├── 📄 blog.html               # Blog listing page
├── 📄 styles.css              # Main stylesheet
├── 📄 script.js               # Main JavaScript
├── 📄 typingEffect.js         # Typing animation
├── 📄 common-header-footer.css # Shared styles
├── 📄 common-header-footer.js  # Shared functionality
├── 📁 blog/                   # Blog articles
│   ├── 📄 article1.html
│   ├── 📄 article2.html
│   └── ...
├── 📁 map/                    # Tools mapping
│   ├── 📄 vibe-coding-tools-map.html
│   └── 📄 tools.json
├── 📁 server/                 # Backend services
│   ├── 📄 server.js           # Main server
│   ├── 📄 config.js           # Configuration
│   ├── 📄 google-apps-script.js # Google Apps Script
│   ├── 📄 package.json        # Dependencies
│   ├── 📄 start-server.sh     # Startup script (Unix)
│   ├── 📄 start-server.bat    # Startup script (Windows)
│   └── 📄 README-FEEDBACK-FIX.md # Feedback system docs
├── 📁 try/                    # Try page
│   └── 📄 index.html
└── 📄 README.md               # This file
```

## 🔧 Configuration

### **Server Configuration**

The server runs on port 10000 by default. You can change this in `server/config.js`:

```javascript
module.exports = {
  port: process.env.PORT || 10000,
  googleAppsScriptUrl: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  productionServerUrl: 'https://your-production-server.com',
  allowedOrigins: [
    'http://localhost:3000',
    'https://specifys-ai.com'
  ]
};
```

### **Google Apps Script Setup**

1. **Create a new Google Apps Script project**
2. **Copy the code from** `server/google-apps-script.js`
3. **Deploy as a web app**
4. **Update the URL in** `server/config.js`

## 🚀 Deployment

### **Local Development**
```bash
cd server
npm start
# Server runs on http://localhost:10000
```

### **Production Deployment**

1. **Deploy to your hosting provider**
2. **Update production URLs in configuration**
3. **Set environment variables**
4. **Configure CORS origins**

### **GitHub Pages**
The project is configured for GitHub Pages deployment. Simply push to the main branch and enable GitHub Pages in your repository settings.

## 📝 API Endpoints

### **Feedback System**
- **POST** `/api/feedback` - Submit user feedback
- **POST** `/api/generate-spec` - Generate AI specifications

### **Response Format**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

## 🎨 Customization

### **Styling**
- **CSS Variables** - Easy color scheme changes
- **Dark/Light Mode** - Toggle between themes
- **Responsive Breakpoints** - Mobile-first design

### **Content**
- **Blog Articles** - Add new articles in the `blog/` directory
- **Tool Data** - Update `map/tools.json` for new tools
- **Configuration** - Modify `server/config.js` for settings

## 🐛 Troubleshooting

### **Common Issues**

1. **Server won't start**
   - Check if Node.js is installed
   - Verify port 10000 is available
   - Check console for error messages

2. **Feedback not working**
   - Ensure Google Apps Script is deployed
   - Check server logs for errors
   - Verify CORS configuration

3. **Styling issues**
   - Clear browser cache
   - Check CSS file paths
   - Verify CSS variables are defined

### **Debug Mode**

Enable debug logging in the server:

```javascript
// In server/server.js
console.log('Debug mode enabled');
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

## 📄 License

This project is licensed under the ISC License.

## 📞 Support

- **Email**: specifysai@gmail.com
- **Website**: https://specifys-ai.com
- **GitHub**: https://github.com/Shalomcohenai/specifys.ai

## 🗺️ Roadmap

### **Phase 1** ✅
- [x] Core platform development
- [x] AI specification generation
- [x] Tool finder system
- [x] Blog platform

### **Phase 2** 🚧
- [ ] Enhanced AI capabilities
- [ ] User authentication
- [ ] Advanced analytics
- [ ] Mobile app

### **Phase 3** 📋
- [ ] Community features
- [ ] API marketplace
- [ ] Enterprise solutions
- [ ] International expansion

## 🙏 Acknowledgments

- **OpenAI** - AI technology
- **Google Apps Script** - Backend services
- **Font Awesome** - Icons
- **Community contributors** - Feedback and suggestions

---

**Built with ❤️ by the Specifys.ai team**

*Last updated: January 2025*
