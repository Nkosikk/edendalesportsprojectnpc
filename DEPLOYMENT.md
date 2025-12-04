# cPanel Deployment Guide

## Prerequisites
- cPanel hosting account with Node.js support
- SSH/FTP access to your server
- Your cPanel domain/subdomain configured

## Build Steps

### 1. Build the Production Bundle
```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

### 2. Verify Build Output
Check that the `dist` folder contains:
- `index.html`
- `assets/` folder with JS and CSS files
- `.htaccess` file (for routing)
- `favicon.ico` and other static assets

## Deployment Methods

### Method 1: Manual Upload via File Manager

1. **Access cPanel File Manager**
   - Log into your cPanel account
   - Navigate to File Manager
   - Go to `public_html` (or your domain's root directory)

2. **Clear Existing Files** (if updating)
   - Select all files in the directory
   - Delete them (backup first if needed)

3. **Upload Build Files**
   - Upload all contents from the `dist` folder
   - Make sure `.htaccess` is included (enable "Show Hidden Files" in File Manager)

4. **Set Permissions**
   - Set folders to 755
   - Set files to 644

### Method 2: FTP Upload

1. **Connect via FTP Client** (FileZilla, Cyberduck, etc.)
   - Host: Your domain or cPanel server
   - Username: Your cPanel username
   - Password: Your cPanel password
   - Port: 21 (FTP) or 22 (SFTP)

2. **Navigate to public_html**

3. **Upload dist contents**
   - Drag and drop all files from `dist/` folder
   - Ensure `.htaccess` is uploaded

### Method 3: SSH/Terminal

1. **Connect via SSH**
   ```bash
   ssh username@yourdomain.com
   ```

2. **Navigate to your web directory**
   ```bash
   cd public_html
   ```

3. **Upload via SCP/rsync** (from your local machine)
   ```bash
   # Using SCP
   scp -r dist/* username@yourdomain.com:~/public_html/
   
   # Using rsync
   rsync -avz --delete dist/ username@yourdomain.com:~/public_html/
   ```

### Method 4: Git Deployment (if cPanel supports it)

1. **Setup Git Repository in cPanel**
   - Use cPanel's Git Version Control
   - Clone your repository
   - Configure `.cpanel.yml` for automated deployment

2. **Update .cpanel.yml** with your actual path:
   ```yaml
   ---
   deployment:
     tasks:
       - export DEPLOYPATH=/home/yourusername/public_html
       - /bin/cp -R dist/* $DEPLOYPATH
   ```

## Post-Deployment Configuration

### 1. Verify .htaccess
Ensure `.htaccess` exists in your root directory with proper rewrite rules for React Router.

### 2. Update API Configuration
If your API endpoint changes, you'll need to rebuild with updated environment variables.

Current API proxy target: `https://www.ndosiautomation.co.za/EDENDALESPORTSPROJECTNPC/api`

For production, consider creating a production environment file or updating `vite.config.ts` to point to your production API.

### 3. SSL Certificate
- Enable SSL in cPanel (Let's Encrypt is usually free)
- Verify HTTPS redirect works via .htaccess

### 4. Test Deployment
- Visit your domain
- Test all routes (login, bookings, admin panel)
- Verify API calls work correctly
- Check browser console for errors
- Test on mobile devices

## Troubleshooting

### Blank Page After Deployment
- Check browser console for errors
- Verify `.htaccess` file exists and has correct rewrite rules
- Check file permissions (755 for folders, 644 for files)
- Ensure all files from `dist/` were uploaded

### 404 Errors on Page Refresh
- `.htaccess` file is missing or not working
- Enable mod_rewrite in cPanel (contact host if needed)

### API Calls Failing
- Check CORS settings on your backend
- Verify API endpoint URL is correct
- Check browser network tab for actual error messages
- Ensure SSL certificates are valid

### Images Not Loading
- Verify file paths are relative, not absolute
- Check that images were uploaded to the correct directory
- Clear browser cache

### White Screen / React Errors
- Check browser console for specific error messages
- Verify all dependencies were bundled correctly
- Try rebuilding the project

## Build Optimization

Before building, consider:

1. **Remove console.logs** (production build already minimizes them)
2. **Optimize images** in `public/images/`
3. **Check bundle size**: 
   ```bash
   npm run build
   ```
   Review the dist/assets folder sizes

## Environment Variables

If you need different configurations for production:

1. Create `.env.production`:
   ```
   VITE_API_URL=https://yourdomain.com/api
   ```

2. Update API calls to use: `import.meta.env.VITE_API_URL`

3. Rebuild for production:
   ```bash
   npm run build:prod
   ```

## Maintenance

### Updating the Site
1. Make changes locally
2. Test with `npm run dev`
3. Build: `npm run build`
4. Upload new `dist/` contents
5. Clear browser cache
6. Test production site

### Monitoring
- Enable cPanel error logs
- Monitor API response times
- Check cPanel bandwidth/resource usage

## Quick Deployment Checklist

- [ ] Run `npm run build`
- [ ] Verify `dist/` folder created successfully
- [ ] Upload all `dist/` contents to `public_html`
- [ ] Verify `.htaccess` is present
- [ ] Set correct file permissions
- [ ] Enable SSL certificate
- [ ] Test all routes and functionality
- [ ] Verify API connectivity
- [ ] Test on multiple devices/browsers
- [ ] Clear CDN cache if using one

## Support

If you encounter issues:
1. Check cPanel error logs
2. Review browser console errors
3. Contact your hosting provider about server configuration
4. Verify DNS settings are correct
