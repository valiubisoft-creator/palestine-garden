// ═══════════════════════════════════════════════════════════════════
// GARDEN OF FLEETING MEMORIES — بجشن... انقلاب
// Palestine Birth Data → Flower Garden
//
// Each flower = one Palestinian governorate
// petalLength  → mapped from birth count for selected year
// numPetals    → fixed at 6 (adjust later)
// color        → West Bank = warm tones, Gaza = cool tones
//
// CONTROLS:
//   - Slider at bottom → scrubs through years 2007–2023
//   - Hover a flower   → shows governorate name + birth count
//   - Click a flower   → pins the detail panel open
//
// HOW map() IS USED:
//   map(value, inMin, inMax, outMin, outMax)
//   Example:
//     map(19758, minBirths, maxBirths, 20, 80)
//   Takes a raw birth number and rescales it to a petal length
//   between 20px (smallest) and 80px (largest)
// ═══════════════════════════════════════════════════════════════════


// ── GLOBAL STATE ────────────────────────────────────────────────────

let birthData;           // will hold the loaded JSON
let allFlowers = [];     // array of flower objects, one per governorate
let selectedYear = "2007";
let hoveredFlower = null;
let pinnedFlower  = null;

// Year list matches the keys in the JSON
const YEARS = [
  "2007","2008","2009","2010","2011","2012","2013",
  "2014","2015","2016","2017","2018","2019","2020",
  "2021","2022","2023"
];

// Grid layout — 4 columns, rows as needed
const COLS        = 4;
const CELL_W      = 200;
const CELL_H      = 200;
const GRID_OFFSET = { x: 60, y: 108 };

// Slider UI
let sliderX, sliderY, sliderW;
let isDragging = false;
let lastSortedYear = null;


// ── PRELOAD ─────────────────────────────────────────────────────────
// p5.js calls preload() before setup().
// Use it to load external files so they're ready when you need them.

function preload() {
  birthData = loadJSON("palestine_births.json");
}


// ── SETUP ────────────────────────────────────────────────────────────

function setup() {
  createCanvas(920, 920);
  colorMode(HSB, 360, 100, 100, 100);
  textFont("monospace");

  // Slider dimensions — wide, centered below title
  sliderW = 500;
  sliderX = (width - sliderW) / 2;
  sliderY = 84;

  // Once data is loaded, build the flower objects
  buildFlowers();
}


// ── BUILD FLOWERS ────────────────────────────────────────────────────
// This runs once in setup().
// For each governorate in the JSON, we create one flower object
// and place it in a grid cell.

function buildFlowers() {
  allFlowers = []; // clear first

  const govs = birthData.governorates;

  // Find the global min and max births across ALL governorates
  // and ALL years — so the scale is consistent when you scrub the slider.
  //
  // We use a flat array of every single birth number in the dataset,
  // then take the min and max of that.
  let allValues = [];
  govs.forEach(g => {
    YEARS.forEach(yr => {
      let v = g.births[yr];
      if (v !== null) allValues.push(v);  // null = no data (Gaza 2023)
    });
  });

  const minBirths = min(allValues);  // p5's min()
  const maxBirths = max(allValues);  // p5's max()

  // Place each governorate into the grid
  govs.forEach((gov, i) => {

    // Grid position — i goes 0,1,2,3,4,5...
    // col = i % COLS  →  which column (0,1,2,3 then wraps)
    // row = floor(i / COLS)  →  which row
    let col = i % COLS;
    let row = floor(i / COLS);

    let x = GRID_OFFSET.x + col * CELL_W + CELL_W / 2;
    let y = GRID_OFFSET.y + row * CELL_H + CELL_H / 2;

    // Color by region
    // West Bank → warm (olive/amber hues, HSB ~40–80)
    // Gaza Strip → cool (teal/blue hues, HSB ~180–220)
    let baseHue = gov.region === "Gaza Strip" ? 190 : 50;

    allFlowers.push(createFlower(x, y, gov, minBirths, maxBirths, baseHue));
  });

  // Sort by 2007 data immediately and snap positions (no animation on load)
  sortFlowers();
  allFlowers.forEach(f => { f.x = f.targetX; f.y = f.targetY; });
  lastSortedYear = selectedYear;
}


// ── FACTORY FUNCTION: createFlower ───────────────────────────────────
// Takes position, governorate data, scale info, and returns a flower object.
// The flower object stores everything needed to draw + interact with it.

function createFlower(x, y, gov, minBirths, maxBirths, baseHue) {
  return {
    x, y,
    name:      gov.name,
    region:    gov.region,
    births:    gov.births,      // the full births dict, all years
    minBirths, maxBirths,
    baseHue,

    numPetals:     6,
    curveIntensity: 0.5,

    // Random hues for petal gradient (assigned once, fixed per flower)
    startHue: random(0, 360),
    tipHue:   random(0, 360),

    // Unique noise seed for independent sway per flower
    noiseOffset: random(0, 1000),

    // Animated position targets — updated by sortFlowers()
    targetX: x,
    targetY: y,

    // These get recalculated each frame based on selectedYear
    petalLength: 40,
    petalWidth:  14,
    baseCol:     null,
    tipCol:      null,

    isHovered: false,
    isPinned:  false,
  };
}


// ── DRAW ─────────────────────────────────────────────────────────────

function draw() {
  drawBackground();

  drawTitle();
  updateFlowers();         // recalculate petalLength etc for current year
  drawAllFlowers();
  drawSlider();
  drawInfoPanel();
}


// ── UPDATE FLOWERS ───────────────────────────────────────────────────
// Each frame, recalculate each flower's visual properties
// based on the currently selected year.

function updateFlowers() {
  // Re-sort whenever the year changes
  if (selectedYear !== lastSortedYear) {
    sortFlowers();
    lastSortedYear = selectedYear;
  }

  allFlowers.forEach(f => {
    // Smoothly animate toward target grid position
    f.x = lerp(f.x, f.targetX, 0.07);
    f.y = lerp(f.y, f.targetY, 0.07);

    // Get the birth value for this governorate + current year
    let rawValue = f.births[selectedYear];

    // null means no data (Gaza governorates in 2023)
    // Use minBirths as fallback so the flower draws at minimum size
    if (rawValue === null || rawValue === undefined) rawValue = f.minBirths;

    // ── THIS IS THE map() CALL ──────────────────────────────────────
    // map(value, inMin, inMax, outMin, outMax)
    //
    // We take the raw birth count and rescale it to a petal length
    // between 16px (smallest govornate) and 72px (largest).
    //
    // If rawValue = minBirths → petalLength = 16
    // If rawValue = maxBirths → petalLength = 72
    // If rawValue is in between → petalLength is proportionally in between
    // ───────────────────────────────────────────────────────────────
    f.petalLength = map(rawValue, f.minBirths, f.maxBirths, 28, 92);
    f.petalWidth  = map(rawValue, f.minBirths, f.maxBirths, 12, 30);

    // Saturation/brightness still encode birth count; hues are random per flower
    let sat = map(rawValue, f.minBirths, f.maxBirths, 35, 85);
    let bri = map(rawValue, f.minBirths, f.maxBirths, 55, 90);

    f.baseCol = color(f.startHue, sat,      bri,     60);
    f.tipCol  = color(f.tipHue,   sat - 10, bri + 5, 60);
  });
}


// ── SORT FLOWERS ─────────────────────────────────────────────────────
// Assigns target grid positions in descending birth-count order.
// Flowers with null data rank last.

function sortFlowers() {
  let ranked = [...allFlowers].sort((a, b) => {
    let va = a.births[selectedYear] ?? -1;
    let vb = b.births[selectedYear] ?? -1;
    return vb - va;
  });

  ranked.forEach((f, i) => {
    let col = i % COLS;
    let row = floor(i / COLS);
    f.targetX = GRID_OFFSET.x + col * CELL_W + CELL_W / 2;
    f.targetY = GRID_OFFSET.y + row * CELL_H + CELL_H / 2;
  });
}


// ── DRAW ALL FLOWERS ─────────────────────────────────────────────────

function drawAllFlowers() {
  allFlowers.forEach(f => {
    drawFlower(f);
  });
}


// ── DRAW ONE FLOWER ──────────────────────────────────────────────────
// Draws a single flower at its (x, y) position.
// Uses push()/pop() to isolate the coordinate transform.

function drawFlower(f) {
  push();
  translate(f.x, f.y);

  let rawVal  = f.births[selectedYear];
  let hasData = rawVal !== null && rawVal !== undefined;
  let shortName = f.name.replace("& Northern Valleys", "").replace("& Al Bireh", "").replace("& Al Aghwar", "").trim();

  if (!hasData) {
    // No data — static placeholder REPLACES the flower entirely
    let size = 48;
    drawStaticPlaceholder(-size / 2, -size / 2, size, f.noiseOffset);

    noStroke();
    textFont("monospace");
    textAlign(CENTER, TOP);
    fill(20, 55, 22, 85);
    textSize(11);
    text(shortName, 0, size / 2 + 8);

    pop();
    return;  // skip petals, centre dot, and count
  }

  // Has data — draw normally with sway
  let swayAngle = map(noise(f.noiseOffset + frameCount * 0.007), 0, 1, -0.12, 0.12);
  rotate(swayAngle);

  // Draw each petal
  for (let i = 0; i < f.numPetals; i++) {
    push();
    rotate((TWO_PI / f.numPetals) * i);
    drawBezierPetal(f.petalLength, f.petalWidth, f.baseCol, f.tipCol);
    pop();
  }

  // Centre dot
  fill(f.baseHue, 60, 40, 95);
  noStroke();
  circle(0, 0, 8);

  // Name + birth count
  noStroke();
  textFont("monospace");
  textAlign(CENTER, TOP);
  fill(20, 55, 22, 85);
  textSize(11);
  text(shortName, 0, f.petalLength + 8);
  fill(20, 45, 30, 75);
  textSize(9);
  text(rawVal.toLocaleString(), 0, f.petalLength + 22);

  pop();
}


// ── BEZIER PETAL ─────────────────────────────────────────────────────
// Draws one smooth petal pointing upward using the canvas 2D API directly.
// A linear gradient runs from baseCol at the base to tipCol at the tip.
// Using drawingContext lets us combine a bezier path with a gradient fill,
// which isn't possible through p5's standard fill() system.

function drawBezierPetal(len, maxW, baseCol, tipCol) {
  let ctx = drawingContext;

  // Linear gradient along the petal axis: base (y=0) → tip (y=-len)
  let grad = ctx.createLinearGradient(0, 0, 0, -len);
  let c1 = `rgba(${floor(red(baseCol))},${floor(green(baseCol))},${floor(blue(baseCol))},${alpha(baseCol) / 100})`;
  let c2 = `rgba(${floor(red(tipCol))},${floor(green(tipCol))},${floor(blue(tipCol))},${alpha(tipCol) / 100})`;
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  // Left arc: base → tip
  ctx.bezierCurveTo(-maxW * 0.55, -len * 0.25, -maxW * 0.35, -len * 0.75, 0, -len);
  // Right arc: tip → base
  ctx.bezierCurveTo( maxW * 0.35, -len * 0.75,  maxW * 0.55, -len * 0.25, 0, 0);
  ctx.closePath();
  ctx.fill();
}


// ── BACKGROUND GRADIENT ──────────────────────────────────────────────
// Warm radial gradient — replaces flat background() call.

function drawBackground() {
  let ctx = drawingContext;
  let grad = ctx.createLinearGradient(0, 0, 0, height);  // top → bottom
  grad.addColorStop(0,   '#fdf0e6');  // very light warm cream  (palette: #D9A491 lightened)
  grad.addColorStop(0.5, '#f5ceac');  // soft peach mid          (palette: #F2AB6D lightened)
  grad.addColorStop(1,   '#e8a87a');  // warm terracotta base    (palette: #D95E32 lightened)
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}


// ── STATIC PLACEHOLDER ───────────────────────────────────────────────
// Drawn when birth data is null (e.g. Gaza governorates in 2023).
// Renders a flickering pixel-noise grid — like a TV with no signal.
//
// NOTE: fill(grey, grey, grey, alpha) would be interpreted as HSB in this
// sketch's colorMode. To get true achromatic grey we use fill(0, 0, grey, alpha)
// — H=0, S=0 means no hue/saturation, so B alone controls lightness.

function drawStaticPlaceholder(x, y, size, seedId) {
  // Update static every 8 frames only — prevents buzzy rapid flicker
  // while keeping the rest of the animation (sway etc.) at full speed.
  randomSeed(floor(frameCount / 8) * 1000 + seedId);

  let pixelSize = size / 16;
  noStroke();

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      let grey  = random(20, 85);   // B value 0–100 in HSB
      let alpha = random(60, 90);   // A value 0–100 in HSB
      fill(0, 0, grey, alpha);      // H=0, S=0 → true grey at brightness=grey
      square(x + i * pixelSize, y + j * pixelSize, pixelSize);
    }
  }

  randomSeed();  // restore p5's default random state for everything else
}


// ── SLIDER ──────────────────────────────────────────────────────────
// A simple custom scrubber at the bottom of the canvas.
// Maps mouse X position → year index → selectedYear string.

function drawSlider() {
  let yearIndex = YEARS.indexOf(selectedYear);
  let knobX = map(yearIndex, 0, YEARS.length - 1, sliderX, sliderX + sliderW);

  // Track
  stroke(20, 50, 30);
  strokeWeight(2);
  line(sliderX, sliderY, sliderX + sliderW, sliderY);

  // Year ticks — taller marks
  YEARS.forEach((yr, i) => {
    let tx = map(i, 0, YEARS.length - 1, sliderX, sliderX + sliderW);
    stroke(20, 40, 35);
    strokeWeight(1);
    line(tx, sliderY - 5, tx, sliderY + 5);
  });

  // Knob
  fill(20, 75, 45);
  noStroke();
  circle(knobX, sliderY, 14);

  // Year label — below knob
  fill(20, 60, 18);
  noStroke();
  textSize(10);
  textAlign(CENTER, TOP);
  text(selectedYear, knobX, sliderY + 9);

}


// ── INFO PANEL ───────────────────────────────────────────────────────
// Shows governorate name + birth count for hovered or pinned flower.

function drawInfoPanel() {
  let target = pinnedFlower;  // only show when pinned (clicked)
  if (!target) return;

  let rawValue = target.births[selectedYear];
  let displayValue = rawValue !== null && rawValue !== undefined
    ? rawValue.toLocaleString()
    : "No data";

  // Panel background — light warm with dark border
  fill(30, 20, 92, 92);
  stroke(20, 40, 50, 80);
  strokeWeight(1);
  rect(width - 190, 10, 178, 90, 6);

  // Text
  noStroke();
  fill(20, 65, 15);
  textSize(11);
  textAlign(LEFT, TOP);
  text(target.name, width - 178, 22);

  fill(20, 40, 35);
  textSize(9);
  text(target.region, width - 178, 38);

  fill(20, 50, 25);
  textSize(10);
  text(`${selectedYear}  births`, width - 178, 56);

  fill(20, 70, 20);
  textSize(18);
  text(displayValue, width - 178, 70);
}


// ── TITLE ────────────────────────────────────────────────────────────

function drawTitle() {
  textFont("Cormorant Garamond");
  textAlign(CENTER, TOP);

  fill(20, 65, 20);
  noStroke();
  textSize(24);
  text("Garden of Fleeting Memories  ·  Palestine Live Birth Data", width / 2, 12);

  fill(20, 50, 30);
  textSize(13);
  text("Petal length = births  ·  Click to pin  ·  Drag slider to change year", width / 2, 42);

  textFont("monospace");  // restore default for all other text
}


// ── MOUSE INTERACTION ────────────────────────────────────────────────

function mouseMoved() {
  hoveredFlower = null;
  allFlowers.forEach(f => {
    f.isHovered = false;
    // Simple circular hit area around flower centre
    let d = dist(mouseX, mouseY, f.x, f.y);
    if (d < f.petalLength + 10) {
      f.isHovered = true;
      hoveredFlower = f;
    }
  });
}

function mousePressed() {
  // Check if clicking on slider
  if (abs(mouseY - sliderY) < 16 && mouseX >= sliderX && mouseX <= sliderX + sliderW) {
    isDragging = true;
    updateYearFromMouse();
    return;
  }

  // Check if clicking on a flower
  let clicked = null;
  allFlowers.forEach(f => {
    let d = dist(mouseX, mouseY, f.x, f.y);
    if (d < f.petalLength + 10) clicked = f;
  });

  if (clicked) {
    // Toggle pin
    if (pinnedFlower === clicked) {
      pinnedFlower = null;
      clicked.isPinned = false;
    } else {
      if (pinnedFlower) pinnedFlower.isPinned = false;
      pinnedFlower = clicked;
      clicked.isPinned = true;
    }
  } else {
    // Click on empty space = unpin
    if (pinnedFlower) pinnedFlower.isPinned = false;
    pinnedFlower = null;
  }
}

function mouseDragged() {
  if (isDragging) updateYearFromMouse();
}

function mouseReleased() {
  isDragging = false;
}

// Converts mouse X position into a year string
function updateYearFromMouse() {
  let t          = constrain(mouseX, sliderX, sliderX + sliderW);
  let yearIndex  = round(map(t, sliderX, sliderX + sliderW, 0, YEARS.length - 1));
  selectedYear   = YEARS[yearIndex];
}