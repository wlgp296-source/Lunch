---
name: Gourmet Roulette
colors:
  surface: '#f9faf2'
  surface-dim: '#d9dbd3'
  surface-bright: '#f9faf2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4ed'
  surface-container: '#edefe7'
  surface-container-high: '#e7e9e1'
  surface-container-highest: '#e2e3dc'
  on-surface: '#191c18'
  on-surface-variant: '#42493e'
  inverse-surface: '#2e312c'
  inverse-on-surface: '#f0f1ea'
  outline: '#72796e'
  outline-variant: '#c2c9bb'
  surface-tint: '#3b6934'
  primary: '#154212'
  on-primary: '#ffffff'
  primary-container: '#2d5a27'
  on-primary-container: '#9dd090'
  inverse-primary: '#a1d494'
  secondary: '#615e57'
  on-secondary: '#ffffff'
  secondary-container: '#e7e2d8'
  on-secondary-container: '#67645d'
  tertiary: '#60233e'
  on-tertiary: '#ffffff'
  tertiary-container: '#7c3a55'
  on-tertiary-container: '#ffaac8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bcf0ae'
  primary-fixed-dim: '#a1d494'
  on-primary-fixed: '#002201'
  on-primary-fixed-variant: '#23501e'
  secondary-fixed: '#e7e2d8'
  secondary-fixed-dim: '#cac6bd'
  on-secondary-fixed: '#1d1c16'
  on-secondary-fixed-variant: '#494740'
  tertiary-fixed: '#ffd9e4'
  tertiary-fixed-dim: '#ffb0cc'
  on-tertiary-fixed: '#3b0520'
  on-tertiary-fixed-variant: '#71314c'
  background: '#f9faf2'
  on-background: '#191c18'
  surface-variant: '#e2e3dc'
  accent-orange: '#F37021'
  accent-red: '#E14A3B'
  accent-lime: '#A4C639'
  neutral-text: '#1A1C19'
  surface-stroke: '#E9E3D5'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  title-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 20px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is built on a **"Modern Korean Editorial"** aesthetic. It moves away from the typical loud, aggressive food delivery apps and instead embraces the calm, sophisticated warmth of a premium lifestyle magazine. The experience should feel like browsing a curated collection of culinary recommendations rather than a utilitarian search tool.

### Visual Pillars
- **Warm & Appetizing:** A foundation of soft cream tones keeps the UI inviting and high-end, while deep greens ground the experience in freshness.
- **Editorial Precision:** Large, elegant serif headlines paired with generous whitespace create a sense of order and quality.
- **Organic Softness:** Every corner is rounded, reflecting the organic shapes of food and providing a "friendly" tactile feel.
- **Playful Engagement:** Functional elements like the roulette wheel and mood tags use vibrant accents to inject energy and delight into the decision-making process.

The target audience includes discerning professionals and groups who value both convenience and the aesthetic quality of their daily dining rituals.

## Colors

The palette is anchored by **Appetizing Green** and **Warm Cream**, creating a high-contrast yet soothing base that mimics a linen-paper menu.

- **Primary (Appetizing Green):** Used for primary actions, success states, and brand-heavy components. It conveys freshness and reliability.
- **Secondary (Warm Cream):** The bedrock of the system. This replaces stark whites to reduce eye strain and provide a premium, organic feel.
- **Named Accents:** Vibrant tones like `accent-orange`, `accent-red`, and `accent-lime` are reserved for emotional triggers—mood tags, status indicators, and the decorative wedges of the roulette wheel.
- **Neutrals:** Text uses a very dark charcoal green-black rather than pure black to maintain harmony with the warm background.

## Typography

This design system uses a sophisticated typographic pairing to balance tradition and modernity.

- **Headlines (Playfair Display):** Chosen for its elegant, high-contrast serifs. It should be used for page titles, menu names, and the brand logo to evoke a "lifestyle magazine" feel.
- **Body & UI (Manrope):** A highly legible, modern sans-serif. Its geometric yet friendly character makes it perfect for functional data—distances, prices, and settings.
- **Hierarchy:** Use `display-lg` sparingly for landing states. `label-caps` should be used for metadata like "DISTANCE" or "BUDGET" to create clear structural headers within cards.

## Layout & Spacing

The layout follows a **Fluid Margin Model** optimized for mobile-first interactions.

- **Safe Zones:** A minimum horizontal margin of `20px` is maintained on mobile to prevent content from hitting the screen edges.
- **Grid:** A simple 12-column system is used for desktop, but mobile relies on a single-column stack with nested horizontal scrolling for "Mood Tags" or "Recent Menus."
- **Rhythm:** Vertical spacing follows an 8px scale. Use `stack-lg` to separate major logical sections (e.g., Input sections vs. the "Recommend" button) and `stack-sm` for internal component spacing (e.g., a label and its input field).

## Elevation & Depth

To maintain the "premium" feel, the design system avoids heavy, dark shadows in favor of **Tonal Layering** and **Soft Ambient Occlusion.**

- **Surface Levels:** The base level is `Warm Cream`. Elements like cards and inputs sit on a `White` surface to create a subtle lift.
- **Shadows:** Use extremely diffused, low-opacity shadows (Opacity: 5-8%) with a hint of the primary green or warm brown in the shadow color. This creates a "soft paper" effect rather than a "digital plastic" effect.
- **Interaction Depth:** When a card is selected (e.g., a chosen menu), it should use a subtle inner stroke of `Appetizing Green` rather than an increased shadow to maintain the clean editorial aesthetic.

## Shapes

The shape language is defined by **Hyper-Roundedness**. This choice softens the UI, making it feel approachable and "appetizing."

- **Pill Shapes:** Primary buttons, input fields, and mood tags should utilize the full pill shape (`rounded-full`).
- **Cards:** Use `rounded-lg` (2rem) for main content containers and `rounded-xl` (3rem) for large image-heavy menu cards.
- **Icons:** Icons should have rounded terminals and a medium stroke weight to match the `Manrope` font character. Avoid sharp 90-degree angles in any custom illustrations or decorative elements.

## Components

### Buttons
- **Primary:** Filled with `Appetizing Green`, white text, pill-shaped. High emphasis.
- **Secondary:** `Warm Cream` background with an `Appetizing Green` border. Used for "Add more" or "Refresh" actions.
- **Ghost:** No background, just green text. Used for "Back" or "Cancel."

### Cards (Menu Items)
- White background with a 1px `surface-stroke`. 
- Image at the top or left with a large radius.
- Includes a "Match %" badge in the top right using `accent-lime`.

### Input Fields
- White background with a soft `surface-stroke`. 
- High focus on the "Mood Tags"—pill-shaped chips that toggle between `Warm Cream` (inactive) and a light tint of their respective accent color (active).

### The Roulette Wheel
- A central circular component. 
- Dividers should be thin and neutral. 
- The pointer is a simplified "Seed" or "Leaf" shape in `Appetizing Green`.

### Progress Indicators
- For team voting, use a horizontal bar with a rounded track. The fill color should be `accent-orange` to indicate active momentum.