# mm-login-app-bar-section Component

This component provides the login/logout UI in the AppBar with LCARS styling.

## Build Command

```bash
# From frontend-libraries directory
npm run build:shared-auth
```

## LCARS Theme Applied

The component uses LCARS-inspired styling matching the main application theme:

### Styling (login-app-bar-section.component.scss)

- **Content Container**: Gradient background (Iron Navy → Surface), centered layout
- **Avatar**: Mint border with glow effect
- **Buttons**: Vertical stack layout (not horizontal!)
  - Logout: Mint gradient background
  - Manage Profile: Outline with mint border
- **Typography**: Montserrat font, uppercase, letter-spacing

### Color Variables Used

```scss
#64ceb9  // Octo Mint - primary accent
#394555  // Iron Navy - surface
#1f2e40  // Surface Elevated
#07172b  // Deep Sea - dark background
```

### Important Notes

1. **Button Layout**: `.buttons` uses `flex-direction: column` - do NOT change to row
2. **Encapsulation**: Component uses Angular View Encapsulation, so styles are scoped
3. **After Changes**: Always rebuild library with `npm run build:shared-auth`, then rebuild main project
