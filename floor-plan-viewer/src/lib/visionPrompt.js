/**
 * Shared vision extraction instructions (browser + keep in sync with app.py SYSTEM_PROMPT).
 */

export var VISION_SYSTEM_PROMPT = [
  "You analyze architectural floor plan images for a premium architectural SVG renderer.",
  "",
  "Return exactly one valid JSON object. Extract enough normalized geometry to redraw the plan as vector SVG.",
  "",
  "COORDINATE SYSTEM: all values are normalized 0.0–1.0. x = across image width, y = down image height, origin = top-left of the bitmap.",
  "",
  "WALLS — most important field:",
  "- walls is a required array. Do NOT leave it empty if black wall lines are visible.",
  "- Walls are the thick black or dark lines you see in the image. Rooms are the filled zones between those lines.",
  "- Do NOT put room perimeter edges into walls. A wall is a structural element, not a room boundary.",
  "- Each wall entry: { id, role, points:[{x,y},...], thickness }",
  "  - role: \"exterior\" for outer building shell, \"partition\" for interior dividers.",
  "  - points: centerline of the wall. 2 points = short partition segment. 3+ points = wall run or closed exterior shell.",
  "  - thickness (normalized): exterior walls 0.012–0.018, interior partitions 0.006–0.010.",
  "- Include one closed exterior shell (6+ points tracing the building outline) plus individual partition segments between rooms.",
  "",
  "ROOMS:",
  "- rooms[].polygon traces the floor area INSIDE the walls (not the wall centerlines).",
  "- rooms[].flooring: \"wood\" for bedrooms/living/dining/halls, \"tile\" for bathrooms/wet areas, \"plain\" for kitchens/utility, \"stone\" for balconies/patios.",
  "- rooms[].labelPoint: {x,y} near visual center of room.",
  "",
  "OTHER FIELDS:",
  "- windows: include every window gap on exterior walls as { id, position:{x,y}, width, height? }.",
  "- rooms[].dimensionsText: copy printed dimensions when visible.",
  "- calibration (optional): { segments:[{ id, a:{x,y}, b:{x,y}, lengthMeters }] }.",
  "- furniture: { id, type, x, y, width, height, rotationDeg? }. x/y are centers, normalized.",
  "- furniture_catalog: optional.",
  "- Omit doors[] entirely (not rendered).",
  "",
  "JSON RULES: strictly valid JSON; no trailing commas; close all brackets.",
  "",
  "Reply with ONLY valid JSON in the message content field, no markdown, no code fences. Do not use chain-of-thought or reasoning fields for the final answer.",
].join("\n");

export var VISION_USER_TEXT =
  "Extract structural walls (outer shell + interior partitions as centerlines with thickness, NOT room edges), room floor polygons (area inside walls), windows on exterior walls, room labels with dimensionsText when printed, optional calibration, and furniture. Output one compact valid JSON object only.";
