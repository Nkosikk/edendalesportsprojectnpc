Image assets

Put component-imported images (png, jpg, svg, webp, gif) here.

Import example:

```tsx
import fieldPhoto from '../assets/images/field1.png';

<img src={fieldPhoto} alt="Field" />
```

Guidelines:
- Use lowercase, hyphen-separated filenames (e.g. booking-icon.png)
- Prefer optimized formats (webp when possible)
- Keep large background or globally referenced images in `public/` if you need a static URL path
- Remove unused images to avoid bundle bloat
