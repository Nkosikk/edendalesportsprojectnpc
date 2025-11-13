# Deployment Instructions for cPanel

## Build for Production
```bash
npm run build
```

## Upload to cPanel
1. Zip the entire `dist` folder after building
2. Upload to your cPanel File Manager
3. Extract to `public_html` (or subdomain folder)
4. Done! 

## Files to Upload
- Upload everything from the `dist` folder
- The built files will work directly with your API

## Note
- No proxy needed in production
- API calls go directly to: https://www.ndosiautomation.co.za/EDENDALESPORTSPROJECTNPC/api
- CORS is already configured on the server