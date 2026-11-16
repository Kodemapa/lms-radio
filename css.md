Graphy.com — UI/UX Design Specification
Nov 15, 2026 · @KODE MAPA
Overview
Graphy's homepage is a clean, high-contrast SaaS landing page. It alternates white and near-black sections, uses one indigo brand colour for actions, and adds motion through CSS loops (a rotating hero word, auto-scrolling card rows, auto-advancing tabs) rather than heavy scroll effects. Every value below was read from the live site's computed styles on 15 Nov 2026, at a 1470 px wide desktop viewport.
Design principles to copy
• Black and white first, colour as accent. Headings are black or white. Indigo #5766F2 marks the main action, and lime #D8FD49 is the accent on dark sections.
• Big, tight, medium-weight headings. Every section title is 48 px Inter at weight 500 with -1.5 px letter spacing, centred and split across two lines.
• Rhythm through alternation. White → black → white → black → white → white → light grey → black hero image → black footer.
• Pill buttons, rounded cards. Buttons are fully rounded (41 px radius). Cards use 16 px, 24 px or 32 px radius.
• Calm, linear motion. Loops run linearly over 5–45 s. Interactions take 0.15–0.25 s with ease-out curves.
Tech the site uses: Next.js with Tailwind CSS and styled-jsx; all animations are plain CSS @keyframes. There is no GSAP, Lottie or scroll library, so you can rebuild everything with CSS plus a little JavaScript for timers.
Before you ship: the Graphy logo, creator photos, product screenshots and copy are Graphy's own. Use this spec for the layout, colours and motion, and put your own brand, images and text in their place.
Colour system
The palette is black, white and grey, with indigo for buttons and five accent colours used only for the small labels above section titles. The token names in the first column are the site's own Tailwind names where it has them.
Core colours
Token
Hex
RGB
Where it's used
brandPrimary
#5766F2
87 102 242
Primary actions, progress bars, hero glow
primary (text)
#5361E9
83 97 233
The rotating hero word
brandSecondary
#D8FD49
216 253 73
Lime accent on dark sections: active tab underline, eyebrow dot
black
#000000
0 0 0
Headings, dark section backgrounds, footer
ink
#232228
35 34 40
Secondary dark text
button-text
#3A3D50
58 61 80
Text in white outline buttons
grey-500
#878C90
135 140 144
Paragraph and subtitle text on white
grey-400
#AAB1B7
170 177 183
Muted text, captions
border
#E5E5E5
229 229 229
Card borders, button borders, dividers
slateLight
#F7F9FA
247 249 250
Light grey section background, card fill
dark-card
#0E0E14
14 14 20
Cards and panels on black sections
white
#FFFFFF
255 255 255
Page background, text on dark
Text on dark backgrounds
Use
Value
Body text
rgba(255,255,255,0.75)
Strong body text
rgba(255,255,255,0.8)
Card border
rgba(255,255,255,0.1), rising to 0.2 on hover
Glass fill
rgba(255,255,255,0.1)
Section eyebrow colours. Each section's small uppercase label has its own colour and a matching 6 px dot.
Eyebrow
Hex
Section background
CREATE
#D8FD49 lime
Black
LAUNCH
#007F8C teal
White
SCALE
#D8FD49 lime
Black
STORIES
#4F7F06 green
White
FEATURES
#CA26A5 magenta
Light grey
The feature icons also use #B3741A amber, #B92B39 red, #877102 olive and #EF64F2 pink.
Gradients
Name
CSS
Primary button
linear-gradient(to right, #4E5DE0 10%, #5868F7 100%)
Hero glow (600 px tall, behind the hero)
linear-gradient(90deg, rgba(87,102,242,.08) 0%, rgba(87,102,242,.02) 45%, rgba(255,223,112,.04) 70%, rgba(255,223,112,.14) 100%), radial-gradient(85% 65% at 25% 0%, rgba(87,102,242,.34) 0%, rgba(87,102,242,.16) 30%, rgba(87,102,242,.05) 55%, transparent 80%), radial-gradient(55% 70% at 95% 0%, rgba(255,223,112,.55) 0%, rgba(255,223,112,.28) 18%, rgba(255,223,112,.10) 38%, rgba(255,223,112,.03) 60%, transparent 82%)
Launch cards
linear-gradient(to bottom right, #F3EEFF, #FFFFFF, #FFF9E8)
Automation mock-up panel
linear-gradient(to bottom right, #FFE0EE, #FFC9DE, #FF9FC7)
Photo card overlay
linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,.75) 70%, rgba(0,0,0,.85) 100%)
CTA banner photo overlay
linear-gradient(to right, rgba(0,0,0,.7), rgba(0,0,0,.25), rgba(0,0,0,0))
Typography
The whole site uses one typeface: Inter, loaded through next/font, in weights 400, 500, 600 and 700. The fallback stack is Inter, "Instrument Sans", sans-serif. Headings use weight 500, not bold, which gives the page its soft, modern look.
font-family: 'Inter', 'Instrument Sans', system-ui, sans-serif;
/* Google Fonts: Inter 400;500;600;700 */
Type scale (desktop)
Role
Size
Weight
Line height
Letter spacing
Colour
Section title (H1/H2)
48 px
500
52.8 px (1.1)
-1.5 px
#000 or #FFF
Title, two-line variant
48 px
500
55.2 px (1.15)
-1.5 px
#000
Stat / large label
28 px
500
28 px (1.0)
-0.6 px
#000
Card heading, large
24 px
500
36 px (1.5)
-0.6 px
#000 / #FFF
Card heading
18 px
600
22.5 px (1.25)
normal
#000 / #FFF
Card heading, medium
18 px
500
27 px (1.5)
-0.45 px
#000
Hero paragraph
16 px
400
24 px (1.5)
-0.08 px
#878C90
Button label
16 px
500
16 px
0.32 px
see buttons
Body / tab label
15 px
400
22.5 px (1.5)
normal
#878C90 or rgba(255,255,255,.75)
Small body
14 px
400
19.25 px (1.375)
normal
#878C90
Caption
13 px
400
19.5 px (1.5)
normal
#AAB1B7
Eyebrow label
12 px
500
18 px (1.5)
0.6 px, UPPERCASE
accent colour
Footer column title
12 px
600
18 px
0.6 px, UPPERCASE
#FFF
Heading pattern. Every section title is centred and has two lines, with a manual <br> between them, for example "Real Creators / Real Revenue". Keep each line to 2–4 words.
Paragraph width. The hero paragraph is capped at max-width: 672px and centred, which keeps lines to about 90 characters.
Layout and spacing
Content sits in a 1152 px column (max-w-6xl) centred inside a 1440 px outer frame with 48 px side padding. Sections are full-bleed colour bands about 900–1400 px tall, and the full desktop page is about 8200 px long.
Containers
Container
Max width
Side padding
Used for
Page frame
1440 px
48 px
Navigation bar, footer
Content
1152 px
—
Card grids, dark platform panel
Narrow content
1024 px
40 px
Text-heavy rows
Heading block
896 px
—
Section titles
Paragraph
672 px
—
Intro paragraphs under titles
Form / small
480 px
—
Narrow forms
Spacing. The site uses Tailwind's 4 px scale. Common values are 8, 12, 16, 20, 24, 28, 40, 48 and 56 px. The eyebrow sits about 16 px above the title. There is about 16 px between title and paragraph, and 24–32 px from the paragraph to the buttons. Content starts 40 px (mobile) or 48–56 px (desktop) below the buttons. Sections have about 96–120 px of padding top and bottom.
Corner radius
Token
Value
Used for
rounded-2xl
16 px
Creator cards, feature cards (most common)
rounded-3xl
24 px
AI cards, launch cards
rounded-[32px]
32 px
Large dark platform panel, pink automation panel
rounded-[41px]
41 px
All buttons (looks fully round at 48 px tall)
rounded-full
9999 px
Eyebrow dots, avatars, small pills
Shadows
Name
Value
Used for
Card
0 8px 24px rgba(0,0,0,0.08)
Creator cards in the hero
Panel
0 24px 60px -24px rgba(35,34,40,0.18)
Pink automation mock-up panel
Hover
Tailwind shadow-md
Feature cards on hover
Borders. Use 1px solid #E5E5E5 on cards and 1.5px solid #E5E5E5 on white buttons. On dark sections use 1px solid rgba(255,255,255,0.1).
Breakpoints (from the site's CSS): 480, 640, 768, 960, 1024, 1088, 1280, 1440, 1536 and 1920 px. The main switch from mobile to desktop layout happens at 768 px.
Page structure
The homepage has a sticky navigation bar, eight content sections and a footer. Each section follows the same header pattern: eyebrow, two-line title, grey paragraph, then optional buttons. Heights are measured at 1470 px wide.
#
Section
Background
Height
Layout
Motion
0
Navigation bar
Transparent, then frosted white when scrolled
89 px
Logo left, three menu links centred (Products ▾, Resources ▾, Pricing), Login link + Sign Up button right
Background fades in on scroll
1
Hero
White + indigo/gold glow
1152 px
Centred title with a rotating word, paragraph, two buttons (Start Free Trial, Book A Demo), then a full-width row of 300×450 px creator photo cards
Rotating word every 3 s; card row scrolls left (40 s loop)
2
Platform (eyebrow CREATE)
Black
1386 px
Header, then a row of 7 tabs (Courses, Memberships, Communities, Coaching, Webinars, Digital Products, AI Avatars). Below them, a 1152 px dark panel (#0E0E14, 32 px radius) with tab title, text, two buttons and a product screenshot
Tabs auto-advance every 5 s with a lime progress bar
3
Launch (eyebrow LAUNCH)
White
982 px
Header, then 2 equal cards (560×559 px, lavender-to-cream gradient, 24 px radius) with a pink eyebrow, title, text and a mock-up (website builder, mobile app)
None
4
AI team (eyebrow SCALE)
Black
1024 px
Header + two buttons, then 3 dark cards (368×481 px, #0E0E14, 24 px radius, white/10 border). Each has a colourful illustration with a frosted stat pill ("Launch 80% faster"), then a title and one line of text
Card border brightens on hover
5
Automations (no eyebrow)
White
1001 px
Header, then 2 columns: left is an accordion of 3 rows (title, text, 4-item checklist); right is a pink gradient panel with a chat mock-up
Rows auto-advance every 5 s with a 1 px indigo progress line
6
Stories (eyebrow STORIES)
White
440 px + collage
Header + two buttons, then a full-width collage of creator portraits in staggered columns (one wide image)
None (static image)
7
Features (eyebrow FEATURES)
Light grey #F7F9FA
879 px
Header, then 2 rows of white cards (360×184 px, 16 px radius, 28 px padding) with a coloured icon, title and one line of text
Rows scroll in opposite directions (45 s loop)
8
Final CTA
Black + full-bleed photo
542 px
Left-aligned white title, paragraph, two buttons over a photo with a black-to-clear overlay from the left
None
9
Footer
Black
718 px
Left: logo, 4-line description, 6 social icons, copyright. Right: two link columns (COMPANY, LEGAL). Bottom: a huge dark-grey "GRAPHY" wordmark cut off at the bottom edge
Link colour change on hover
Section header recipe (used in sections 2–7):
1.  Eyebrow: a 6 px coloured dot + a 12 px uppercase label in the same colour, centred.
2.  Title: 48 px / 500, two lines, centred.
3.  Paragraph: 15–16 px grey, max 672 px wide, centred.
4.  Optional buttons: Start Free Trial (white outline) + Book A Demo (indigo), 12 px apart.
Components
There are two button styles, four card styles, a tab bar, an accordion and a sticky navigation bar. They are specified below with exact CSS.
Buttons. Both are 48 px tall pills with 10 px × 24 px padding and 16 px / 500 labels.
.btn { height:48px; padding:10px 24px; border-radius:41px; font:500 16px/1 Inter; display:inline-flex; align-items:center; gap:4px;
  transition: color .15s, background-color .15s, border-color .15s, box-shadow .15s, transform .15s; transition-timing-function: cubic-bezier(.4,0,.2,1); }
.btn-primary { color:#fff; border:0; background:linear-gradient(to right,#4E5DE0 10%,#5868F7 100%); }
.btn-secondary { color:#3A3D50; background:#fff; border:1.5px solid #E5E5E5; }
Nav "Sign Up" uses the secondary style. On black sections the secondary button keeps its white fill.
Navigation bar
.nav { position:sticky; top:0; z-index:1100; height:89px; background:transparent; border-bottom:1px solid transparent;
  transition: background-color .2s, backdrop-filter .2s, border-color .2s; transition-timing-function: cubic-bezier(.4,0,.2,1); }
.nav.is-scrolled { background:rgba(255,255,255,.6); backdrop-filter:blur(12px); border-bottom-color:rgba(255,255,255,.4); }
.nav a { font:500 14px Inter; color:#000; } .nav a:hover { color: var(--brand); }
The menu items with ▾ open dropdowns that slide 0.75 rem into place while fading in.
Eyebrow
.eyebrow { display:inline-flex; align-items:center; gap:6px; font:500 12px/18px Inter; letter-spacing:.6px; text-transform:uppercase; color:var(--accent); }
.eyebrow::before { content:''; width:6px; height:6px; border-radius:9999px; background:var(--accent); }
Cards
Card
Size
Fill
Border
Radius
Padding
Hover
Creator photo card
300×450 px (180×270 on mobile)
Photo + bottom black gradient
none
16 px
0
Row pauses
Launch card
560×559 px
#F3EEFF → #FFF → #FFF9E8
1px #E5E5E5
24 px
24 px sides/top
none
AI card (dark)
368×481 px
#0E0E14
1px white/10
24 px
20 px
Border to white/20
Feature card
360×184 px
#FFFFFF
1px #E5E5E5
16 px
28 px
shadow-md + border indigo/30, 200 ms
Creator cards also have transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease-out. Use this for a 4 px lift on hover.
Platform tab bar (black section). Seven buttons, each 15 px / 400, rgba(255,255,255,.75), padding 8 px 24px 12 px, with a 16 px icon left of the label. The active tab turns lime #D8FD49. A 2 px lime bar fills along its bottom over 5 s, then the next tab activates. A 1 px white/10 line runs under the whole row. On mobile the labels shrink to 11 px with 8 px 4 px padding.
Accordion (automations section). There are three rows, separated by a 1 px #E5E5E5 line. The open row shows its 18 px / 600 title, a 15 px grey description, a "How it works" label and a 4-item icon list. A 1 px indigo line fills along the divider over 5 s, then the next row opens. Closed rows show only the title.
Frosted stat pill (on AI cards). A small pill with a dark translucent fill, white 13–14 px text and a sparkle icon, sitting top-right on the illustration. Example: "✨ Launch 80% faster".
Footer. Black, 718 px tall. Column titles are 12 px / 600 uppercase white with 0.6 px tracking. Links are 13–14 px white at 75% opacity and turn lime (hover:text-brandSecondary) on hover. Social icons are 16 px white. The oversized wordmark at the bottom is dark grey (about #1A1A1A) on black and fills the width.
Animations and motion
The page has 7 signature animations, all pure CSS @keyframes, plus 4 hover/scroll transitions. There are no scroll-triggered reveals and no parallax. Nothing fades in as you scroll, so the page feels instant.
Inventory
#
Animation
Where
Trigger
Duration
Easing
Loop
1
flipWordIn / flipWordOut
Hero title word
Timer, every 3 s
0.65 s
cubic-bezier(.22,1,.36,1)
Forever
2
creator-scroll
Hero creator cards
On load
40 s
linear
Infinite, pauses on hover
3
platform-tab-progress
Platform tab underline
Tab becomes active
5 s
linear
Once, then next tab
4
accordion-row-progress
Automation accordion
Row opens
5 s
linear
Once, then next row
5
feature-marquee-left
Features row 1
On load
45 s
linear
Infinite
6
feature-marquee-right
Features row 2
On load
45 s
linear
Infinite
7
Nav frosting
Navigation bar
Scroll past top
0.2 s
cubic-bezier(.4,0,.2,1)
—
8
Card lift
Creator cards
Hover
0.25 s
cubic-bezier(.16,1,.3,1)
—
9
Button / link colour
All buttons and links
Hover
0.15 s
cubic-bezier(.4,0,.2,1)
—
10
Card border / shadow
AI cards, feature cards
Hover
0.15–0.2 s
cubic-bezier(.4,0,.2,1)
—
11
Dropdown menu
Nav Products / Resources
Click / hover
~0.15 s
ease
—
1. Rotating hero word. The title reads "Your Coaching Business", and the indigo word cycles Coaching → Education → Creator every 3000 ms. The word box is display:inline-block; overflow:hidden; white-space:nowrap; vertical-align:bottom and sized to the widest word (about 207×55 px). The outgoing word slides up and blurs while the new one rises from below, both over 650 ms.
@keyframes flipWordIn  { from { opacity:0; transform:translateY(90%);  filter:blur(2px); } to { opacity:1; transform:translateY(0); filter:blur(0); } }
@keyframes flipWordOut { from { opacity:1; transform:translateY(0);    filter:blur(0); }   to { opacity:0; transform:translateY(-90%); filter:blur(2px); } }
.flip-wrap { position:relative; display:inline-block; overflow:hidden; white-space:nowrap; vertical-align:bottom; color:#5361E9; }
.flip-word { position:absolute; inset:0; }
.flip-word.in  { animation: flipWordIn  .65s cubic-bezier(.22,1,.36,1) both; }
.flip-word.out { animation: flipWordOut .65s cubic-bezier(.22,1,.36,1) both; }
const words = ['Coaching','Education','Creator']; let i = 0;
setInterval(() => {
  const wrap = document.querySelector('.flip-wrap');
  const old = wrap.querySelector('.in'); old.className = 'flip-word out';
  setTimeout(() => old.remove(), 650);
  const next = document.createElement('span');
  next.className = 'flip-word in'; next.textContent = words[i = (i + 1) % words.length];
  wrap.append(next);
}, 3000);
2. Creator card row. There are 16 cards (8 photos duplicated) in a flex row with a 20 px gap. The row slides left by exactly 8 cards' width, then jumps back seamlessly. Hovering pauses it.
.creator-root { --card-w:180px; --card-h:270px; --gap:12px; overflow:hidden; }
@media (min-width:768px) { .creator-root { --card-w:300px; --card-h:450px; --gap:20px; } }
.creator-card { width:var(--card-w); height:var(--card-h); flex-shrink:0; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.08); }
.creator-marquee { display:flex; gap:var(--gap); animation: creator-scroll 40s linear infinite; }
.creator-marquee:hover { animation-play-state: paused; }
@keyframes creator-scroll { from { transform:translateX(0); } to { transform:translateX(calc(-8 * (var(--card-w) + var(--gap)))); } }
Each card has a bottom overlay, linear-gradient(transparent 0%, rgba(0,0,0,.75) 70%, rgba(0,0,0,.85) 100%), with the creator's name and niche in white.
3. Auto-advancing tabs. When a tab activates, a 2 px lime bar slides in from the left over 5 s. When the animation ends, the next tab activates and the panel content swaps. Clicking a tab jumps straight to it and restarts the bar.
.tab { position:relative; overflow:hidden; }
.tab .progress { position:absolute; left:0; right:0; bottom:0; height:2px; background:#D8FD49; transform:translateX(-100%); }
.tab.active { color:#D8FD49; }
.tab.active .progress { animation: platform-tab-progress 5s linear forwards; }
@keyframes platform-tab-progress { from { transform:translateX(-100%); } to { transform:translateX(0); } }
tabs.forEach((t, i) => t.querySelector('.progress')
  .addEventListener('animationend', () => activate((i + 1) % tabs.length)));
4. Accordion progress. This works like the tabs, but uses a 1 px indigo #5766F2 line inside the 1 px #E5E5E5 divider of the open row, with @keyframes accordion-row-progress (same keyframes, 5 s linear). On animationend the next row opens.
5–6. Feature marquee. There are two rows of feature cards, each holding the card set twice. Row 1 slides left and row 2 slides right, both over 45 s, linear and infinite. Moving by -50% makes the loop seamless.
.marquee { display:flex; gap:16px; width:max-content; }
.marquee.left  { animation: feature-marquee-left  45s linear infinite; }
.marquee.right { animation: feature-marquee-right 45s linear infinite; }
@keyframes feature-marquee-left  { from { transform:translateX(0); }    to { transform:translateX(-50%); } }
@keyframes feature-marquee-right { from { transform:translateX(-50%); } to { transform:translateX(0); } }
Add a fade at both edges with mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent) on the wrapper.
7. Nav frosting. Add .is-scrolled once window.scrollY > 10, using the CSS in Components. Over black sections the frosted white bar shows as light grey, which is the intended effect.
8–10. Hover micro-interactions.
.creator-card { transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease-out; }
.creator-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,.12); }
.ai-card { border:1px solid rgba(255,255,255,.1); transition: border-color .15s cubic-bezier(.4,0,.2,1); }
.ai-card:hover { border-color: rgba(255,255,255,.2); }
.feature-card { transition: box-shadow .2s, border-color .2s; }
.feature-card:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1); border-color: rgba(87,102,242,.3); }
.footer a:hover { color:#D8FD49; }
Reduced motion. The site defines prefers-reduced-motion rules. Do the same: stop the loops and show static states.
@media (prefers-reduced-motion: reduce) {
  .creator-marquee, .marquee, .flip-word, .progress { animation: none !important; }
}
Imagery, icons and assets
The imagery is real people and real product UI, not illustration. Plan on four kinds of asset.
• Portrait photos. Waist-up shots of creators against plain, warm or muted backgrounds (beige, grey, blue). They are cropped 2:3 for the hero cards and in mixed sizes for the stories collage. Use consistent lighting and friendly expressions.
• Product mock-ups. Clean UI screenshots inside device frames: a browser window with traffic-light dots, a phone frame and a chat window. They sit on soft pastel gradient panels (lavender/cream for launch, pink for automation, and pink, peach or blue for the AI cards).
• Icons. Thin-stroke line icons at 16–20 px (Font Awesome is loaded, and Lucide is a close match). On white feature cards each icon takes one accent colour: teal, magenta, amber, red, olive or indigo. In the tab bar they are white at 75% opacity.
• Logo. A bold, condensed, all-caps sans-serif wordmark, black in the nav and white in the footer, about 26 px tall. The footer repeats it at roughly 220 px tall in dark grey, cut off by the page edge.
Photo treatment. Apply a black gradient over the bottom 30% of every photo card so white text stays readable. The final CTA uses a full-bleed lifestyle photo with a left-to-right black overlay (rgba(0,0,0,.7) → transparent).
Chat widget. A 48 px indigo circle with a white chat icon is fixed 24 px from the bottom-right corner (Freshchat).
Responsive behaviour
The layout switches from mobile to desktop at 768 px. Everything stacks to a single column below that width. The card and tab sizes below come from the site's CSS. The other mobile values are estimates, because the site was only measured at desktop width.
Element
Mobile (< 768 px)
Desktop (≥ 768 px)
Section title
about 32–36 px, still two lines
48 px
Creator cards
180×270 px, 12 px gap
300×450 px, 20 px gap
Platform tabs
11 px labels, 8×4 px padding, row scrolls sideways
15 px labels, 8×24 px padding
Launch cards
Stacked, 16 px padding
2 columns, 24 px padding
AI cards
Stacked
3 columns
Automation section
Accordion above the mock-up
2 columns
Feature marquee
Same rows; cards keep 360 px width
Same
Navigation
Logo + hamburger menu
Full links
Footer
Columns stack
Brand left, link columns right
Page side padding
16–20 px
48 px
Implementation starter
To match the original most closely, use Next.js (or plain HTML) with Tailwind CSS and Inter from Google Fonts. Paste the tokens below into your global CSS, then build each section from the Page structure table.
:root {
  /* colour */
  --brand: #5766F2;          --brand-text: #5361E9;
  --brand-grad: linear-gradient(to right, #4E5DE0 10%, #5868F7 100%);
  --lime: #D8FD49;           --teal: #007F8C;  --green: #4F7F06;  --magenta: #CA26A5;
  --black: #000;             --ink: #232228;   --btn-text: #3A3D50;
  --grey-500: #878C90;       --grey-400: #AAB1B7;
  --border: #E5E5E5;         --slate-light: #F7F9FA;
  --dark-card: #0E0E14;      --white: #FFF;
  --on-dark: rgba(255,255,255,.75);  --dark-border: rgba(255,255,255,.1);
  /* type */
  --font: 'Inter', 'Instrument Sans', system-ui, sans-serif;
  --h1: 500 48px/1.1 var(--font);   --h1-track: -1.5px;
  --body: 400 15px/1.5 var(--font);
  --eyebrow: 500 12px/1.5 var(--font); --eyebrow-track: .6px;
  /* shape */
  --r-card: 16px; --r-card-lg: 24px; --r-panel: 32px; --r-btn: 41px;
  --shadow-card: 0 8px 24px rgba(0,0,0,.08);
  --shadow-panel: 0 24px 60px -24px rgba(35,34,40,.18);
  /* layout */
  --frame: 1440px; --content: 1152px; --para: 672px; --gutter: 48px;
  /* motion */
  --ease-std: cubic-bezier(.4,0,.2,1);
  --ease-out-expo: cubic-bezier(.16,1,.3,1);
  --ease-flip: cubic-bezier(.22,1,.36,1);
  --dur-fast: .15s; --dur-base: .2s; --dur-card: .25s; --dur-flip: .65s;
}
h1, h2 { font: var(--h1); letter-spacing: var(--h1-track); text-align: center; }
Tailwind config equivalent
theme: { extend: {
  colors: { brandPrimary:'#5766F2', brandSecondary:'#D8FD49', slateLight:'#F7F9FA', ink:'#232228', darkCard:'#0E0E14' },
  fontFamily: { sans: ['Inter','Instrument Sans','sans-serif'] },
  borderRadius: { btn:'41px', panel:'32px' },
  maxWidth: { frame:'1440px' },
}}
Build order
1.  Tokens, font and the two button styles.
2.  The sticky nav with its scroll state.
3.  The section header recipe (eyebrow, title, paragraph, buttons), reused 6 times.
4.  Each section top to bottom, with static content first.
5.  Animations 1–6, then the hover states, then the reduced-motion rule.
6.  A responsive pass at 375 px, 768 px and 1440 px.
Sources
• graphy.com homepage — computed styles, CSS keyframes and screenshots taken from the live page in Chrome on 15 Nov 2026 at 1470 px wide.