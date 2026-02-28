# mm-login-app-bar-section Component

This component provides the login/logout UI in the AppBar.

## Build Command

```bash
# From frontend-libraries directory
npm run build:shared-auth
```

## Styling Requirements

**Important:** This component must use **neutral, theme-agnostic styling** with CSS custom properties. Host applications apply their own theme via CSS variable overrides.

### Styling (login-app-bar-section.component.scss)

- **Content Container**: Uses CSS variables for background colors, centered layout
- **Avatar**: Styled via CSS variables for border and accent colors
- **Buttons**: Vertical stack layout (not horizontal!)
- **Typography**: Standard sans-serif font family

### CSS Variables (to be overridden by host app)

```scss
--mm-login-bg: <background color>;
--mm-login-accent: <accent color>;
--mm-login-text: <text color>;
```

### Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features or behavior is implemented
- Never commit code with failing tests

### Important Notes

1. **Button Layout**: `.buttons` uses `flex-direction: column` - do NOT change to row
2. **Encapsulation**: Component uses Angular View Encapsulation, so styles are scoped
3. **No hardcoded theme colors**: Use CSS custom properties with neutral defaults
4. **After Changes**: Always rebuild library with `npm run build:shared-auth`, then rebuild main project
