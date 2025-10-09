# Blog Management System - User Guide

## 🎉 System Successfully Installed!

Your blog management system is now integrated into the Admin Dashboard with full GitHub automation.

---

## ✨ Features

- **Create Blog Posts** - Simple form interface with markdown editor
- **Automatic Publishing** - Posts automatically committed to GitHub
- **SEO Optimized** - Auto-generated meta tags and sitemap updates
- **Post Management** - View, search, and delete posts
- **Preview** - See how your post looks before publishing
- **GitHub Integration** - All changes automatically synced to your repository

---

## 🚀 How to Use

### 1. Start the Backend Server

The blog system requires the backend server to be running:

```bash
cd backend
node server.js
```

The server will start on `http://localhost:3001`

### 2. Access Admin Dashboard

1. Go to your site: `https://specifys-ai.com`
2. Log in with your admin account: `specifysai@gmail.com`
3. Navigate to: **Admin Dashboard** → **Blog Management** tab

### 3. Create a New Blog Post

1. Click **"New Post"** button
2. Fill in the form:
   - **Title** (required) - Your post title in English
   - **Description** (required) - SEO description (max 160 chars)
   - **Publish Date** (required) - When to publish
   - **Author** (optional) - Default: "specifys.ai Team"
   - **Tags** (optional) - Comma-separated tags
   - **Content** (required) - Your post content in Markdown

3. Use the toolbar for Markdown formatting:
   - H2, H3 headings
   - **Bold**, *Italic*
   - Lists
   - Links
   - Code blocks

4. Click **"Preview"** to see how it looks
5. Click **"Publish Post"** to create the post

### 4. What Happens When You Publish

The system automatically:

1. ✅ Creates a markdown file in `_posts/` directory
2. ✅ Commits the file to your GitHub repository
3. ✅ Updates the sitemap.xml
4. ✅ Triggers GitHub Pages rebuild (1-2 minutes)
5. ✅ Your post is live!

---

## 📁 File Structure

Posts are created as:
```
_posts/YYYY-MM-DD-title-slug.md
```

Example:
```
_posts/2025-10-09-how-to-build-ai-apps.md
```

The post will be available at:
```
https://specifys-ai.com/blog/how-to-build-ai-apps.html
```

---

## 🔧 GitHub Configuration

The system is configured with:

- **Repository**: `Shalomcohenai/specifys.ai`
- **Branch**: `jekyll`
- **Token**: Pre-configured (expires based on GitHub settings)

### Important: Token Security

⚠️ The GitHub token is stored in `backend/server/blog-routes.js`

**To update the token** (if it expires):

1. Go to: https://github.com/settings/tokens
2. Generate new token (classic) with `repo` scope
3. Update in `blog-routes.js`:
   ```javascript
   const GITHUB_CONFIG = {
       token: 'YOUR_NEW_TOKEN_HERE'
   };
   ```

---

## 📝 Markdown Guide

Your posts support full Markdown:

### Headings
```markdown
## Heading 2
### Heading 3
```

### Text Formatting
```markdown
**bold text**
*italic text*
```

### Lists
```markdown
- Item 1
- Item 2
- Item 3
```

### Links
```markdown
[Link text](https://example.com)
```

### Code
```markdown
Inline `code`

```javascript
// Code block
function example() {
    return "Hello";
}
```
```

### Images
```markdown
![Alt text](image-url.jpg)
```

---

## 🎨 SEO & Meta Tags

Every post automatically gets:

- ✅ Title tag
- ✅ Meta description
- ✅ Open Graph tags (Facebook, LinkedIn)
- ✅ Twitter Card tags
- ✅ Canonical URL
- ✅ Structured data (JSON-LD)
- ✅ Sitemap entry

All configured from the form fields you fill in!

---

## 📊 Managing Posts

### View All Posts

The "Published Posts" section shows:
- All published posts
- Creation date
- Author
- Tags
- Quick actions

### Search & Filter

- **Search** - By title or description
- **Date Range** - Filter by date range

### Delete Posts

1. Click the trash icon next to a post
2. Confirm deletion
3. Post is removed from GitHub and sitemap

---

## ⚡ Quick Tips

1. **Always Preview** - Check your post before publishing
2. **SEO Description** - Keep it 120-160 characters for best results
3. **Title Length** - Keep titles under 60 characters
4. **Tags** - Use 3-5 relevant tags
5. **Content** - Write in clear, structured Markdown
6. **Images** - Upload to GitHub first, then reference in Markdown

---

## 🔍 Troubleshooting

### "Failed to create post"
- ✅ Check backend server is running
- ✅ Check GitHub token is valid
- ✅ Check internet connection

### "Post not appearing on site"
- ✅ Wait 1-2 minutes for GitHub Pages to rebuild
- ✅ Clear browser cache
- ✅ Check sitemap.xml was updated

### "GitHub API error"
- ✅ Token might be expired - generate new one
- ✅ Check repository permissions
- ✅ Check branch name is correct

---

## 📞 Support

For issues:
- Check browser console for errors
- Check backend server logs
- Email: specifysai@gmail.com

---

## 🎯 Workflow Summary

```
1. Fill form in Admin Dashboard
   ↓
2. Click "Publish Post"
   ↓
3. Backend creates markdown file
   ↓
4. Backend commits to GitHub
   ↓
5. Backend updates sitemap
   ↓
6. GitHub Pages rebuilds site
   ↓
7. Post is live! 🎉
```

---

**Built with ❤️ for Specifys.ai**

*All content must be in English as per site language requirements*

