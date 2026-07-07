---
name: Sonic Impact (Neo-Brutalism)
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1b1b1b'
  on-surface-variant: '#434655'
  inverse-surface: '#303030'
  inverse-on-surface: '#f1f1f1'
  outline: '#1b1b1b'
  outline-variant: '#1b1b1b'
  surface-tint: '#2563eb'
  primary: '#2563eb'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#ffffff'
  inverse-primary: '#b4c5ff'
  secondary: '#fed01b'
  on-secondary: '#1b1b1b'
  secondary-container: '#fed01b'
  on-secondary-container: '#1b1b1b'
  tertiary: '#535555'
  on-tertiary: '#ffffff'
  tertiary-container: '#6c6d6d'
  on-tertiary-container: '#f0f0f0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  background: '#f9f9f9'
  on-background: '#1b1b1b'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '800'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: '1.6'
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The brand personality is high-energy, confident, and unapologetically bold. It targets a modern audience of concert-goers and music enthusiasts who value clarity and a distinct aesthetic over corporate softness. 

The design style is **Neo-Brutalism**. This approach prioritizes raw structural elements, utilizing heavy strokes and high-contrast color blocking to create a tactile, "physical" digital interface. The emotional response should be one of urgency and excitement—matching the vibe of a live music venue. Every element feels intentional, grounded, and reactive.

## Colors
This design system utilizes a high-contrast, functional palette:
- **Primary Blue:** `#2563eb` - Used for main actions, ticket confirmation, and navigation highlights.
- **Accent Yellow:** `#fed01b` - Used for key highlights, category tags, features background, and secondary attention-grabbing elements.
- **Background:** `#f9f9f9` - A neutral, slightly off-white that makes black borders pop without the harshness of pure white.
- **Text & Stroke:** `#1b1b1b` (pure/near-black) - Used for all borders, shadows, and primary typography to maintain a crisp "ink-on-paper" look.
- **Dark Surface:** `#1b1b1b` - Used for inverted card designs (e.g. Backstage ticket tier) and dark theme accents.

## Typography
The typography is centered around **Inter**, specifically leveraging its heavier weights. 
- Headlines use **Extra Bold (800)** or **Black (900)** weights with tight letter spacing (`tracking-tight`) to command attention.
- Body text uses **Medium (500)** weights to balance readability with high contrast.
- Labels are frequently uppercased to enhance the "industrial" aesthetic.

## Elevation & Depth
Depth in this design system is achieved through **Hard Shadows** rather than soft blurs or smooth gradients.
- **Standard Border:** `4px` black border (`border-4 border-black`).
- **Hard Shadow Level 1 (Buttons/Interactive):** `4px` horizontal and vertical offset, black, 100% opacity (`shadow-[4px_4px_0px_0px_#1b1b1b]`).
- **Hard Shadow Level 2 (Large Cards):** `8px` horizontal and vertical offset, black, 100% opacity (`shadow-[8px_8px_0px_0px_#1b1b1b]`).

### Interactive Feedback Mechanics
When interactive elements are hovered or clicked, they respond with physical translation offsets:
- **Hover State:** Translate `-2px` on X and Y axis, while keeping shadow depth, or increasing visual feedback.
- **Active (Pressed) State:** Translate `4px` down and right (matching the shadow offset) and set the shadow offset to `0px`. This mimics physically pushing a block down.

## Components Specification

### 1. Navigation Bar
- Semi-transparent or solid off-white background with a thick bottom border.
- Highlighted links get a custom under-line in brand blue.
- Interactive login button with a blue background, black border, and offset shadow.

### 2. Event & Info Cards
- White background, `4px` black border, and `8px` offset black shadow.
- Imagery is styled with high contrast to fit the rock/underground theme.
- Actionable buy button is docked at the bottom of the card.

### 3. Feature Banner
- Full-width bright yellow (`#fed01b`) block.
- Columns featuring tilted cards (using `rotate-1` or `rotate-2` values) to break grid rigidity and add visual playfulness.

## Tailwind CSS v4 Configuration Guide
In Tailwind CSS v4, theme variables are declared directly in your main CSS file (`globals.css`) within the `@theme` directive:
```css
@theme {
  --color-brand-blue: #2563eb;
  --color-brand-yellow: #fed01b;
  --color-brand-black: #1b1b1b;
  --color-brand-bg: #f9f9f9;
  
  --shadow-brutalist-sm: 4px 4px 0px 0px #1b1b1b;
  --shadow-brutalist-md: 8px 8px 0px 0px #1b1b1b;
}
```
Use these variables across your markup (e.g., `bg-brand-blue`, `shadow-brutalist-md`) to ensure absolute fidelity to the design system.