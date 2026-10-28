import * as THREE from 'three';
import { Jl, Vl, Yu, _a, ko, assemble } from './shaders.js';

// Full-index text: exact Ko raster fallback, tF/nF and OF.field/mask.
// Shaders below are statically extracted; no reference app is imported.
const tF =
  "\nuniform float u_tunnelR; // tunnel radius, world units (0 = flat)\nuniform float u_tunnelY; // world y of the tunnel axis (viewport center)\nuniform float u_tunnelP; // wrap strength: 1 in the list, 0 once flown out\nuniform float u_fadeAng; // wrap angle at which a line is fully gone\nuniform float u_bow;     // signed scroll velocity, world units\n\n// The full index's mouse field — see the sway below. xy the field's centre in\n// world, zw its half-extents (the picture's own), then spread and amplitude,\n// then presence. Zero everywhere the index has not claimed (see syncRail).\nuniform vec4 u_avoid;\nuniform vec2 u_avoidF;\nuniform float u_avoidP;\n\n// The blast: a SECOND field, same shape, for the chosen row's sheet growing\n// in. Separate on purpose — at that moment the hover field above FREEZES at\n// its exact last state (syncRail just stops writing it), so the lean the\n// pointer built is never lost; this one grows from the sheet and the two\n// displacements simply sum.\nuniform vec4 u_avoid2;\nuniform vec2 u_avoidF2;\nuniform float u_avoidP2;\n\n// The carousel titles' float off the ribbon, toward the camera — see the\n// note at the sheet() call below. World units; 0 for every other line of\n// type on the site.\nuniform float u_lift;\n\nattribute float aLine;  // line index — drives the stagger\nattribute float aPitch; // px: slide distance = the mask window's height\nattribute float aCut;   // px from the plane's top: this line's resting ink top\nattribute float aOver;  // px: ink taller than the window (tight leading)\nattribute float aMid;   // plane-local y of this line's resting centre\n\nuniform float u_twist;   // resting roll across a LINE's width, radians\nuniform float u_twistIn; // extra roll the reveal unwinds from\nuniform float u_riseIn;  // entrance travel, in line heights (see RISE_IN)\n\n\nuniform float u_progress;\nuniform float u_window;  // one line's duration, as a share of the timeline\nuniform float u_stagger; // per-line start offset, same units\nuniform float u_planeH;  // plane height in css px\n\nvarying vec2 vUv;\nvarying float vWrap;\nvarying float vP;\nvarying float vYEl;      // fragment y in plane px, top-down, AFTER the slide\nvarying float vEdgeTop;\nvarying float vEdgeBot;\n\n#include <chunks>\n\nvoid main() {\n\tvUv = uv;\n\n\tvec3 p = position;\n\n\t// ── Line reveal ──\n\t// Ordered top-to-bottom stagger, expo out per line. Run once per vertex\n\t// rather than per pixel: the quad IS the line, so its own progress is all\n\t// it needs to carry.\n\t//\n\tfloat lp = clamp((u_progress - aLine * u_stagger) / max(u_window, 0.0001), 0.0, 1.0);\n\tlp = 1.0 - pow(2.0, -10.0 * lp);\n\n\t// The quad slides: (1 - p) of its pitch, downward. At rest it sits exactly\n\t// where the raster was measured, so quad and texture line up 1:1.\n\tfloat slide = (1.0 - lp) * aPitch / u_planeH;\n\tp.y -= slide;\n\n\t// The window it rises into. The top edge is the line's resting ink top,\n\t// starting a touch lower to keep filter bleed out, and lifting as the line\n\t// lands. The bottom edge eases down by aOver so a descender is released\n\t// smoothly instead of popping in at the end.\n\tvEdgeTop = aCut + (1.0 - lp) * 1.5;\n\tvEdgeBot = aCut + aPitch + lp * aOver;\n\tvYEl = (0.5 - p.y) * u_planeH;\n\tvP = lp;\n\n\tvec4 w = modelMatrix * vec4(p, 1.0);\n\n\t// The line's own roll: its top and bottom edges wind past each other across\n\t// its length, so a line reads as a ribbon laid on the surface rather than\n\t// as a decal printed on it. Taken before the bow and the wrap, in the\n\t// plane's own frame — the tunnel and the door are where the line IS, this\n\t// is only how it is held there. See TWIST in chunks.js.\n\t//\n\t// TWO sources, summed, and that is the whole trick of the entrance: the\n\t// resting roll (u_tunnelP, so a title flying to the detail page unrolls it\n\t// off the tube) plus the reveal's own, which every line unwinds as it\n\t// arrives. Summed rather than crossfaded, so a line settles INTO the roll\n\t// it is going to keep instead of passing through flat on the way to it.\n\t//\n\t// The reveal's term rides lp — the SAME eased progress the slide and the\n\t// mask window take, not a curve of its own. One line arriving is one\n\t// gesture: it rises, it unwinds, and its window opens on a single expo\n\t// out, so there is no moment where the type has landed but is still\n\t// visibly turning. Giving the roll its own timing was tried and reads as\n\t// two animations that happened to start together.\n\t//\n\t// The pivot follows the slide, so a line rolls about where it currently\n\t// IS rather than about the rest position it has not reached yet.\n\tw = twist(w, p.x, vec3(0.0, aMid - slide, 0.0), u_twist * u_tunnelP + u_twistIn * (1.0 - lp));\n\n\t// The entrance TRAVEL (see RISE_IN): the line starts below its slot by a\n\t// real distance and rises on the same eased clock the slide and the mask\n\t// window share. aPitch/u_planeH is the line's height as a fraction of the\n\t// plane, modelMatrix[1][1] carries the plane's world scale, so their\n\t// product is one line height in world units whatever size the type is.\n\t// A landed line (lp 1) is untouched.\n\tw.y -= (1.0 - lp) * u_riseIn * (aPitch / u_planeH) * modelMatrix[1][1];\n\n\t// Velocity bow: the middle of each line lags behind its ends, so the\n\t// type flexes like a rope being dragged rather than sliding rigidly.\n\t// Parabolic across the line's own width — zero at both ends, so\n\t// neighbouring lines never tear apart at the seams.\n\tfloat across = uv.x * 2.0 - 1.0;\n\tw.y += u_bow * (1.0 - across * across);\n\n\t// ── The sway ──\n\t//\n\t// The cursor's field on the full index: a round MAGNIFIER, not a\n\t// starburst. The displacement is the offset from the field's centre\n\t// itself, scaled — so it vanishes smoothly into the middle instead of\n\t// pointing at it, the word under the pointer swells gently, the ring\n\t// around it leans away, and the far page sleeps a few rims out. Two\n\t// earlier forms pushed a fixed amount along normalize(aq), whose\n\t// direction turns hard through the centre: zeroed there the middle\n\t// went dead flat, floored there it pinched into an angular star.\n\t// Scaling the offset has no direction of its own to disagree about.\n\t// Nothing is ever removed: at these amplitudes there is nothing to\n\t// tear and nothing to hide. See RAIL's amp for how much this is.\n\tif (u_avoidP > 0.0005) {\n\t\tvec2 aq = w.xy - u_avoid.xy;\n\t\tfloat t = max(length(aq / u_avoid.zw), 0.001);\n\n\t\tw.xy += aq * u_avoidF.y * exp(-t / max(u_avoidF.x, 0.001)) * u_avoidP;\n\t}\n\n\t// The blast, summed on top — see the u_avoid2 note above: the field the\n\t// pointer built holds perfectly still while this one shoves.\n\tif (u_avoidP2 > 0.0005) {\n\t\tvec2 aq2 = w.xy - u_avoid2.xy;\n\t\tfloat t2 = max(length(aq2 / u_avoid2.zw), 0.001);\n\n\t\tw.xy += aq2 * u_avoidF2.y * exp(-t2 / max(u_avoidF2.x, 0.001)) * u_avoidP2;\n\t}\n\n\tfloat th = 0.0;\n\n\t// u_tunnelP eases the whole wrap out, so a title flying to the detail\n\t// page unrolls off the tube instead of cutting to flat.\n\tif (u_tunnelR > 0.001 && u_tunnelP > 0.001) {\n\t\tth = (w.y - u_tunnelY) / u_tunnelR;\n\t\tw.y = mix(w.y, u_tunnelY + u_tunnelR * sin(th), u_tunnelP);\n\t\tw.z += u_tunnelR * (cos(th) - 1.0) * u_tunnelP;\n\t\tth *= u_tunnelP;\n\t}\n\n\t// How far around the tube this fragment has travelled, normalized so 1\n\t// is fully faded. The mask keys off the ANGLE rather than screen y\n\t// because the wrap compresses y toward the poles — a screen-space fade\n\t// would stall before reaching zero and leave lines visible at the ends.\n\t// The angle is monotonic along the list, so the fade always completes,\n\t// and it retires each line before it can fold over the tube's side.\n\tvWrap = u_fadeAng > 0.0001 ? abs(th) / u_fadeAng : 0.0;\n\n\t// ── Onto the ribbon ──\n\t//\n\t// The same surface the cards lie on, taken through the same function off\n\t// the same uniforms — not a curve shaped like it, THE curve. A title and\n\t// the card behind it at the same world x now get the same displacement,\n\t// which is the difference between type lying on a surface and type floating\n\t// in front of one.\n\t//\n\t// This is the argument LEAN below already makes, one scale up: a shared\n\t// function of world x is how two objects that share no frame agree, and the\n\t// alternative — matching numbers by eye in two places — drifts the moment\n\t// either is tuned.\n\t//\n\t// Page text passes no attitude, so u_sheetD stays 0 and both terms fall out.\n\t//\n\t// NOT exact, and the inexactness is the tunnel above rather than anything\n\t// here: the tube has already moved this point in y and z as a function of\n\t// its own angle, so a line lies on the ribbon PLUS the tube. Through the\n\t// middle of the column, where the tube is nearly flat and the cards\n\t// actually are, they agree. Toward the top and bottom the type curls away\n\t// on a surface the cards do not have — which is the tunnel doing its job,\n\t// and would only be worth removing if the column stopped being a tube.\n\tw = sheet(w);\n\n\t// And then a small constant float toward the camera, AFTER the curve, so\n\t// the type rides the identical surface a fixed distance above it — a\n\t// parallel copy of the ribbon, not a flattened one. This exists because\n\t// the sweep's far side genuinely shrinks whatever lies on it, titles\n\t// included, and the honest fix is to move them nearer rather than fatten\n\t// the type in CSS: perspective then restores their size by the same rule\n\t// that took it, and they stay proportioned to the scene at every depth.\n\t// Rides u_sheetP, so a title flying to the detail page sets down onto the\n\t// page as the ribbon lets go of it.\n\tw.z += u_lift * u_sheetP;\n\n\t// The same door the cards hang off — the identical world-x ramp, not a\n\t// copy of the angle, so the tunnel swings with the strip it runs through\n\t// instead of leaning near enough to notice the difference. Page text\n\t// passes amplitude 0, so this is a no-op there. See LEAN in chunks.js.\n\tw = lean(w, u_tunnelP);\n\n\t// A pill's fisheye, when this label sits on one: the SAME world-space\n\t// field its fill takes, off the same uniforms, so the word stretches with\n\t// the surface under it instead of sitting flat on a bulging pill. Last,\n\t// because the pill is flat page furniture — nothing above has moved it —\n\t// and because the field is written in the world the pill actually\n\t// occupies. Zero for every other label on the site, which is all of them\n\t// bar the one being pointed at. See PILL_LENS in chunks.js.\n\tw = pillLens(w);\n\n\t// Same world curve the sheet and stack use, but page text passes\n\t// amplitude 0, so this is a no-op there — kept because it costs nothing\n\t// and the carousel may yet want it.\n\tw = bulge(w);\n\n\tgl_Position = projectionMatrix * viewMatrix * w;\n}\n";
const nF =
  "\nuniform sampler2D u_texture;\nuniform float u_alpha;\n// The full index's counter-dim: what this row fades to WHERE THE PICTURE\n// COVERS IT. Not a screen-space box — the card TILTS, and a flat rect can\n// only ever approximate a rotated quad's silhouette, which shows as a dark\n// seam of half-dimmed type along the picture's edge in motion. Instead each\n// fragment is ray-cast from the camera into the CARD'S OWN PLANE (u_maskM is\n// its world->local matrix) and tested against the identical collapsed\n// rounded box the card's fragment shader draws — same SDF, same reveal, same\n// corner, same fwidth edge — so the dim's boundary IS the picture's, at any\n// tilt, exactly. The active row rides at u_dim 1 and never dips. A\n// multiplier of its own rather than u_alpha, which the reveal and hover\n// tweens still own.\nuniform float u_dim;\nuniform mat4 u_maskM;   // world -> card local (unit plane)\nuniform vec3 u_maskCam; // frustum half-width, half-height at z=0, camera z\nuniform vec3 u_maskShape; // card aspect (w/h), corner (height-norm), reveal\nuniform vec2 u_maskRes; // viewport in framebuffer px\nuniform float u_mask; // normalized wrap where the fade begins (1 = no fade)\nuniform vec3 u_c0;    // colour the type currently reads as\nuniform vec3 u_c1;    // colour it is travelling to\nuniform float u_ink;  // 0 = c0, 1 = c1\nuniform float u_slide; // entrance offset, in plane heights (0 = at rest)\n\nuniform float u_gamma; // coverage exponent — see the stem note below\n\n// How far the channels come apart under the middle of a pill's lens, in\n// screen px at full hover — falling to nothing at its rim, on the lens's own\n// profile. Three pixels: far enough that the colour is a colour rather than a\n// suspicion, and about where it stops. Past this the ghosts separate from the\n// stems they came off and the word starts to double rather than to disperse.\nconst float PILL_SPLIT = 3.0;\n\n// Declared here too, having been declared in the vert by PILL_LENS, for one\n// reason: the dispersion exists to answer the stretch the lens causes, so a\n// pill with no lens — the round ones, whose radius is zeroed — must have no\n// dispersion either. A single glyph sitting at dead centre would otherwise\n// take the field's strongest split for a stretch that never happened.\nuniform vec3 u_lens;\n\n// Same rounded-box cut the detail stack takes, in framebuffer px. Type that\n// belongs TO the page rather than travelling with it is clipped to the sheet,\n// so the sheet's own growing shape is what reveals it — see CLIP in chunks.js.\nuniform vec4 u_clip;\nuniform float u_clipR;\nuniform float u_clipOn;\n\nvarying vec2 vUv;\nvarying float vWrap;\nvarying float vP;\nvarying float vYEl;\nvarying float vEdgeTop;\nvarying float vEdgeBot;\n\n#include <chunks>\n\nvoid main() {\n\t// Entrance: the TEXTURE slides inside a fixed quad, rather than the mesh\n\t// moving. Two reasons — the ink is masked by the plane's own box for\n\t// free (sampling outside [0,1] is simply nothing, which is gil-v2's\n\t// masked line reveal), and the geometry never moves, so the tunnel wrap\n\t// is untouched. Moving the mesh instead would need a screen-space mask,\n\t// and the wrap means a line's rendered position is nowhere near its DOM\n\t// rect — that mask would cut in the wrong place.\n\tvec2 suv = vUv + vec2(0.0, u_slide);\n\n\tvec4 tex = texture2D(u_texture, suv);\n\n\tfloat win = step(0.0, suv.y) * (1.0 - step(1.0, suv.y));\n\n\t// The CSS mask-image equivalent: the column dissolves as it rolls around\n\t// the tube, reaching zero at both ends, so lines fade fully in and out\n\t// of the scroll instead of clipping. No depth shade here — the type\n\t// stays at full value over the shaded planes.\n\tfloat mask = 1.0 - smoothstep(u_mask, 1.0, vWrap);\n\n\t// Glyph colour comes from uniforms, not the raster — the type is\n\t// rasterized in flat white purely for clean alpha coverage. That lets a\n\t// title flying to the detail page cross-fade from the carousel's white\n\t// to the sheet's near-black without re-rasterizing (which would pop).\n\tfloat ink_t = u_ink;\n\n\t// On a pill, the opening disc decides that ramp PER FRAGMENT rather than\n\t// the tween deciding it for the whole label: the letters go white where\n\t// the pink has reached them and stay dark where it has not, so the\n\t// frontier runs THROUGH the word. What mix-blend-mode would give between\n\t// black and white, without a blend mode, a second pass or a render target\n\t// — the label simply evaluates the same mask the fill does.\n\t//\n\t// Branch on a uniform: every fragment in the draw takes the same side, so\n\t// there is no divergence, and every label that is not on a hovered pill —\n\t// which is nearly all of them, nearly always — pays nothing.\n\tif (u_pillA > 0.0001) ink_t = pillMask();\n\n\tvec3 ink = mix(u_c0, u_c1, ink_t);\n\n\tfloat clip = u_clipOn > 0.5 ? clipMask(u_clip, u_clipR) : 1.0;\n\n\t// The reveal's mask window, its edges computed per line in the vertex\n\t// stage. The landed-line lift is a safety net: with the edges resolved\n\t// correctly it changes nothing, but it guarantees resting ink is never\n\t// clipped even if a font misreports its extents.\n\t//\n\t// It is only a safety net while the reveal never overshoots. An ease that\n\t// carries a line PAST its rest pushes its top through the window's top\n\t// edge — the edges are pinned to the resting ink band — and this becomes\n\t// the one thing stopping the window from shaving it. Worth knowing before\n\t// reaching for a back or an elastic on the line easing above.\n\tfloat show = max(\n\t\tstep(vEdgeTop, vYEl) * (1.0 - step(vEdgeBot, vYEl)),\n\t\tstep(0.9995, vP)\n\t);\n\n\t// Stem correction. The canvas rasterizes glyphs white-on-transparent, so\n\t// tex.a is pure coverage — and this renderer composites in linear space\n\t// (see Core: outputColorSpace = LinearSRGBColorSpace, samples pass through\n\t// unconverted). The browser does NOT: it blends text gamma-aware, which\n\t// thins dark type on a light ground. Blending the same coverage linearly\n\t// therefore lands heavier than the DOM it is mirroring, and at body size\n\t// that reads as the wrong weight rather than as a rendering difference.\n\t//\n\t// Raising coverage to a power pulls the mid-tones — the partly covered\n\t// pixels along every stem edge — back down without touching the solid\n\t// interior at 1.0 or the empty ground at 0.0.\n\t//\n\t// Applied in proportion to how DARK the ink is, because the problem is\n\t// not symmetric: light type on a dark ground is already the thin case, and\n\t// pulling its edges back too would eat the carousel's titles. Keying off\n\t// the ink rather than off a flag also means a title FLYING from the strip\n\t// to a page — white to near-black, on the u_ink ramp — picks up the\n\t// correction as it darkens, instead of switching at some point mid-flight.\n\tfloat dark = 1.0 - clamp(dot(ink, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);\n\tfloat gam = mix(1.0, u_gamma, dark);\n\tfloat cov = pow(tex.a, gam);\n\n\t// ── Dispersion ──\n\t//\n\t// The lens the pill's fill runs on magnifies this raster, and a raster\n\t// cannot be magnified: the glyph edges go soft. Two things answer that.\n\t// The label is rasterized with headroom so there are real pixels to\n\t// stretch (see supersample below) — and what softness is left is turned\n\t// into something deliberate, which is the only honest way to hide it.\n\t//\n\t// So the word is drawn through the lens the way glass would pass it: each\n\t// channel from its own place, red fetched from a hair one way and blue\n\t// from a hair the other.\n\t//\n\t// How far apart follows the LENS'S OWN PROFILE — the same squared\n\t// parabola PILL_LENS displaces on, peaking at the pill's centre and gone\n\t// by its rim. That is where the magnification is, so that is where the\n\t// raster is stretched thinnest and where there is softness to answer;\n\t// driving it off the radius instead put the colour at the ends of the\n\t// word, which are the one part the lens leaves alone.\n\t//\n\t// Along x, not along the radius. At the centre of a radial field there is\n\t// no outward to speak of — the magnification there is even in every\n\t// direction — so the split is taken across the pill's long axis, which is\n\t// the way a word runs and the way its stems are spaced.\n\t//\n\t// A real split, not a tint. Alpha becomes the WIDEST of the three, so a\n\t// pixel that only red reaches is drawn as red: the glyph gets a coloured\n\t// ghost on each side rather than an existing edge being stained, which is\n\t// the difference between reading as dispersion and reading as dirty type.\n\t// The earlier version could only subtract from what was already there and\n\t// turned the outer letters yellow.\n\t//\n\t// The profile is clamped at zero and never exceeds one, so the offset\n\t// cannot run past PILL_SPLIT however the box and the reach happen to\n\t// relate — the earlier version scaled on an unbounded radius, and one bad\n\t// frame of either fetched from halfway across the word.\n\t//\n\t// Uniform branch, so the derivatives and the samples are taken by every\n\t// fragment in the draw or by none.\n\tvec3 split = vec3(1.0);\n\n\tif (u_pillA > 0.0001 && u_lens.z > 0.0001) {\n\t\t// The disc's frame IS the lens's, near enough: both are centred where\n\t\t// the glass is and both reach the far end of the pill (see syncPill),\n\t\t// so the profile below lands where the magnification actually is\n\t\t// without the lens having to be handed over a second time.\n\t\tvec2 rad = (gl_FragCoord.xy - u_pillDisc.xy) / max(u_pillDisc.z, 1.0);\n\n\t\tfloat k = max(1.0 - dot(rad, rad), 0.0);\n\t\tvec2 off = vec2(k * k * PILL_SPLIT * u_pillA * fwidth(suv).x, 0.0);\n\n\t\tfloat cr = pow(texture2D(u_texture, suv + off).a, gam);\n\t\tfloat cb = pow(texture2D(u_texture, suv - off).a, gam);\n\n\t\tfloat a = max(cov, max(cr, cb));\n\n\t\tsplit = vec3(cr, cov, cb) / max(a, 0.001);\n\t\tcov = a;\n\t}\n\n\tink *= split;\n\n\t// The counter-dim, gated by the card itself — see the u_mask* note at\n\t// the top. Branch on the uniforms: every plane at rest (u_dim 1) and\n\t// every page without the card (reveal 0) pays nothing.\n\tfloat dim = 1.0;\n\tif (u_dim < 0.9995 && u_maskShape.z > 0.001) {\n\t\t// This fragment's pixel, unprojected to the z=0 plane; the camera\n\t\t// sits on the axis at u_maskCam.z. Both carried into the card's\n\t\t// local frame, where the card is the unit plane at z=0 — the ray\n\t\t// through them lands on it at hit, in [-0.5, 0.5] when on the card.\n\t\tvec2 ndc = (gl_FragCoord.xy / u_maskRes) * 2.0 - 1.0;\n\t\tvec3 C = (u_maskM * vec4(0.0, 0.0, u_maskCam.z, 1.0)).xyz;\n\t\tvec3 P = (u_maskM * vec4(ndc.x * u_maskCam.x, ndc.y * u_maskCam.y, 0.0, 1.0)).xyz;\n\t\tvec3 dir = P - C;\n\n\t\tfloat t = -C.z / (abs(dir.z) > 1e-6 ? dir.z : 1e-6);\n\t\tvec2 hit = C.xy + t * dir.xy;\n\n\t\t// The card frag's own maths, verbatim: height-normalized frame,\n\t\t// box collapsed about its centre by the reveal, radius closing\n\t\t// with it. fwidth gives the same one-screen-pixel edge the card's\n\t\t// cut has, so the two boundaries land on the same pixels.\n\t\tfloat pr = u_maskShape.z;\n\t\tvec2 msz = vec2(u_maskShape.x, 1.0);\n\t\tvec2 mq = (hit + 0.5) * msz;\n\t\tvec2 mmid = msz * 0.5 * pr;\n\t\tfloat mr = min(u_maskShape.y * pr, min(mmid.x, mmid.y));\n\n\t\tfloat md = roundedBox(mq - (msz * 0.5 - mmid), mmid, mr);\n\t\tfloat maa = max(fwidth(md), 0.0001);\n\n\t\tfloat cov = t > 0.0 ? 1.0 - smoothstep(-maa, maa, md) : 0.0;\n\n\t\tdim = mix(1.0, u_dim, cov);\n\t}\n\n\tgl_FragColor = vec4(ink, cov * u_alpha * dim * mask * win * clip * show);\n}\n";
const HU =
  "\n// across is -0.5…0.5 over the whole ribbon this vertex belongs to, which is\n// the plane itself only when the plane is the whole line.\nvec4 twist(vec4 w, float across, vec3 pivot, float a) {\n\tif (abs(a) < 0.0001) return w;\n\n\t// The pivot through the model matrix, so the offset from it already\n\t// carries the mesh's (non-uniform) scale — this rolls the quad as it is\n\t// actually drawn.\n\tvec3 c = (modelMatrix * vec4(pivot, 1.0)).xyz;\n\tvec3 d = w.xyz - c;\n\n\tfloat s = sin(a * across);\n\tfloat co = cos(a * across);\n\n\treturn vec4(c + vec3(d.x, d.y * co - d.z * s, d.y * s + d.z * co), w.w);\n}\n";
const IS =
  '\nuniform vec3 u_lens;  // xy: centre in world; z: radius, world units\nuniform float u_lensA; // how far the surface gives at the centre of the field\nuniform float u_pillA;\n\nvec4 pillLens(vec4 w) {\n\tif (u_pillA < 0.0001 || u_lens.z < 0.0001) return w;\n\n\tvec2 q = w.xy - u_lens.xy;\n\n\t// dot() rather than length(): the profile is a function of the SQUARED\n\t// distance either way, so the root would only be squared again.\n\tfloat k = max(1.0 - dot(q, q) / (u_lens.z * u_lens.z), 0.0);\n\n\tw.xy += q * u_lensA * u_pillA * k * k;\n\n\treturn w;\n}\n';
const PS =
  '\nuniform vec3 u_pillDisc; // xy: centre, z: radius at full hover — framebuffer px\nuniform float u_pillA;\n\nfloat pillMask() {\n\tfloat d = length(gl_FragCoord.xy - u_pillDisc.xy)\n\t\t- mix(-0.04 * u_pillDisc.z, u_pillDisc.z, u_pillA);\n\tfloat aa = max(fwidth(d), 0.0001);\n\n\treturn 1.0 - smoothstep(-aa, aa, d);\n}\n';
export const FULL_TEXT_VERTEX = assemble(tF, Jl, Vl, Yu, HU, IS);
export const FULL_TEXT_FRAGMENT = assemble(nF, _a, ko, PS);

export const FULL_FIELD = Object.freeze({
  follow: 10,
  amp: 0.4,
  spread: 0.9,
  blastAmp: 1.6,
  blastSpread: 0.75,
  dim: 0.1,
});
const follow = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

/** Exact CPU twin of the tF/QU sway. Positions and half-extents are world units. */
export function titleField(position, field, blast = null) {
  let x = position.x,
    y = position.y;
  for (const f of [field, blast]) {
    if (!f || (f.presence ?? 0) <= 0.0005) continue;
    const center = f.center || [f.x || 0, f.y || 0];
    const half = f.halfExtents || [f.halfWidth || 1, f.halfHeight || 1];
    const dx = x - (center.x ?? center[0]);
    const dy = y - (center.y ?? center[1]);
    const hx = Math.max(0.000001, half.x ?? half[0]);
    const hy = Math.max(0.000001, half.y ?? half[1]);
    const distance = Math.max(Math.hypot(dx / hx, dy / hy), 0.001);
    const strength =
      (f.amp ?? FULL_FIELD.amp) *
      Math.exp(-distance / Math.max(f.spread ?? FULL_FIELD.spread, 0.001)) *
      f.presence;
    x += dx * strength;
    y += dy * strength;
  }
  return { x, y, z: position.z ?? 0 };
}

function textUniforms(texture) {
  return {
    u_texture: { value: texture },
    u_alpha: { value: 1 },
    u_dim: { value: 1 },
    u_maskM: { value: new THREE.Matrix4() },
    u_maskCam: { value: new THREE.Vector3() },
    u_maskShape: { value: new THREE.Vector3(1, 0, 0) },
    u_maskRes: { value: new THREE.Vector2(1, 1) },
    u_clip: { value: new THREE.Vector4() },
    u_clipR: { value: 0 },
    u_clipOn: { value: 0 },
    u_clipBow: { value: 0 },
    u_clipWarp: { value: new THREE.Vector3() },
    u_tunnelR: { value: 0 },
    u_tunnelY: { value: 0 },
    u_tunnelP: { value: 1 },
    u_fadeAng: { value: 0 },
    u_twist: { value: 0 },
    u_twistIn: { value: 0 },
    u_riseIn: { value: 0 },
    u_bow: { value: 0 },
    u_leanA: { value: 0 },
    u_leanW: { value: 0 },
    u_sheetW: { value: 0 },
    u_sheetD: { value: 0 },
    u_sheetT: { value: 1 },
    u_sheetC: { value: 1 },
    u_sheetP: { value: 0 },
    u_sheetV: { value: 0 },
    u_lift: { value: 0 },
    u_avoid: { value: new THREE.Vector4(0, 0, 1, 1) },
    u_avoidF: { value: new THREE.Vector2(FULL_FIELD.spread, FULL_FIELD.amp) },
    u_avoidP: { value: 0 },
    u_avoid2: { value: new THREE.Vector4(0, 0, 1, 1) },
    u_avoidF2: { value: new THREE.Vector2(FULL_FIELD.blastSpread, FULL_FIELD.blastAmp) },
    u_avoidP2: { value: 0 },
    u_mask: { value: 0.35 },
    u_c0: { value: new THREE.Color(0xffffff) },
    u_c1: { value: new THREE.Color(0xffffff) },
    u_ink: { value: 0 },
    u_pillDisc: { value: new THREE.Vector3() },
    u_pillA: { value: 0 },
    u_lens: { value: new THREE.Vector3() },
    u_lensA: { value: 0 },
    u_slide: { value: 0 },
    u_gamma: { value: 1.45 },
    u_bulgeA: { value: 0 },
    u_bulgeH: { value: 0 },
    u_progress: { value: 1 },
    u_window: { value: 1 },
    u_stagger: { value: 0 },
    u_planeH: { value: 1 },
  };
}

/**
 * Source Ko canvas fallback for the Full index. Labels live in the same scene
 * as the rail so page wipe and lens sample their actual distorted pixels.
 * DOM buttons remain the layout and accessible click/focus targets.
 *
 * new FullField(scene, camera, renderer)
 * update({elements, rail, hovered, presence, dt, enabled, alpha, blast})
 * - elements: current buttons; text from data-title or textContent.
 * - rail: the actual tilted Three mesh, not its approximate DOM rectangle.
 * - presence: source rail bindAlpha*reveal (default rail's reveal).
 * - blast: optional growing case mesh; holds the first field still.
 */
export default class FullField {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.entries = new Map();
    this.disposed = false;
    this.document = renderer.domElement?.ownerDocument ?? globalThis.document;
    this.inverse = new THREE.Matrix4();
    this.size = new THREE.Vector2();
    this.framebuffer = new THREE.Vector2();
    this.document?.fonts?.ready.then(() => {
      if (!this.disposed) for (const entry of this.entries.values()) entry.dirty = true;
    });
  }

  _create(element) {
    const canvas = this.document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.ShaderMaterial({
      vertexShader: FULL_TEXT_VERTEX,
      fragmentShader: FULL_TEXT_FRAGMENT,
      uniforms: textUniforms(texture),
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 32, 8), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 30;
    mesh.visible = false;
    this.scene.add(mesh);
    // The Full index has white DOM type and white GPU ink. Do not sample
    // computed color after the DOM glyphs have been made transparent.
    const entry = {
      element,
      canvas,
      context,
      texture,
      material,
      mesh,
      dirty: true,
      width: 0,
      height: 0,
      padX: 0,
      padY: 0,
      signature: '',
      original: {
        color: element.style.color,
        fill: element.style.webkitTextFillColor,
        shadow: element.style.textShadow,
      },
    };
    this.entries.set(element, entry);
    return entry;
  }

  _showDOM(entry, show) {
    const element = entry.element;
    if (show) {
      element.style.color = entry.original.color;
      element.style.webkitTextFillColor = entry.original.fill;
      element.style.textShadow = entry.original.shadow;
      element.classList.remove('gl-text-ready');
    } else {
      element.style.color = 'transparent';
      element.style.webkitTextFillColor = 'transparent';
      element.style.textShadow = 'none';
      element.classList.add('gl-text-ready');
    }
  }

  _chipLayout(element, rect, css) {
    const label = element.querySelector?.('.case-link-label');
    if (!label && !element.classList.contains?.('case-link')) return null;
    const value = (name) => css.getPropertyValue?.(name)?.trim();
    const border = Math.max(0, parseFloat(css.borderTopWidth) || 0);
    const left = border + (parseFloat(css.paddingLeft) || 0),
      right = border + (parseFloat(css.paddingRight) || 0);
    const top = border + (parseFloat(css.paddingTop) || 0),
      bottom = border + (parseFloat(css.paddingBottom) || 0);
    const actual = element._vrect ? element.getBoundingClientRect() : rect;
    const relative = (box) => ({
      x: box.left - actual.left,
      y: box.top - actual.top,
      width: box.width,
      height: box.height,
    });
    const svg = element.querySelector?.('svg');
    const svgCSS = svg ? this.document.defaultView.getComputedStyle(svg) : null;
    const svgRect = svg?.getBoundingClientRect();
    const iconWidth = svgRect?.width || parseFloat(svgCSS?.width) || 16;
    const iconHeight = svgRect?.height || parseFloat(svgCSS?.height) || 16;
    const icon = svg
      ? svgRect?.width && svgRect?.height
        ? relative(svgRect)
        : {
            x: rect.width - right - iconWidth,
            y: (rect.height - iconHeight) / 2,
            width: iconWidth,
            height: iconHeight,
          }
      : null;
    const labelRect = label?.getBoundingClientRect();
    const labelBox =
      labelRect?.width && labelRect?.height
        ? relative(labelRect)
        : {
            x: left,
            y: top,
            width: Math.max(
              0,
              rect.width -
                left -
                right -
                (icon ? icon.width + (parseFloat(css.columnGap) || 0) : 0),
            ),
            height: Math.max(0, rect.height - top - bottom),
          };
    const labelCSS = label ? this.document.defaultView.getComputedStyle(label) : css;
    const rawViewBox = (svg?.getAttribute('viewBox') || '0 0 256 256')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const viewBox =
      rawViewBox.length === 4 &&
      rawViewBox.every(Number.isFinite) &&
      rawViewBox[2] > 0 &&
      rawViewBox[3] > 0
        ? rawViewBox
        : [0, 0, 256, 256];
    const paths = [...(svg?.querySelectorAll('path') || [])]
      .map((path) => ({
        d: path.getAttribute('d'),
        opacity: Number(path.getAttribute('opacity') ?? 1),
      }))
      .filter((path) => path.d);
    const fill = value('--case-fill') || 'rgba(255,255,255,.10)';
    const stroke = value('--case-stroke') || 'rgba(255,255,255,.16)';
    const radius = Math.min(
      rect.width / 2,
      rect.height / 2,
      Math.max(0, parseFloat(value('--case-radius') || css.borderTopLeftRadius) || 0),
    );
    const coordinates = (box) => Object.values(box).map((value) => Math.round(value * 1000) / 1000);
    const signature = [
      fill,
      stroke,
      radius,
      border,
      element.dataset.filterMatch,
      ...coordinates(labelBox),
      ...(icon ? coordinates(icon) : []),
      ...viewBox,
      ...paths.flatMap((path) => [path.d, path.opacity]),
      labelCSS.font,
      labelCSS.fontStyle,
      labelCSS.fontSize,
      labelCSS.fontFamily,
      labelCSS.fontWeight,
      labelCSS.letterSpacing,
      labelCSS.lineHeight,
      labelCSS.textTransform,
    ].join('|');
    return {
      fill,
      stroke,
      radius,
      border,
      labelBox,
      icon,
      viewBox,
      paths,
      css: labelCSS,
      signature,
    };
  }

  _raster(entry, rect, css, text, chip = null) {
    const fontCSS = chip?.css || css;
    const fontSize = parseFloat(fontCSS.fontSize) || 16;
    const pixelRatio = Math.min(2, this.renderer.getPixelRatio?.() || 1);
    const padX = Math.ceil(fontSize * 0.35),
      padY = Math.ceil(fontSize * 0.25);
    const planeWidth = rect.width + padX * 2,
      planeHeight = rect.height + padY * 2;
    const canvasWidth = Math.ceil(planeWidth * pixelRatio),
      canvasHeight = Math.ceil(planeHeight * pixelRatio);
    if (entry.canvas.width !== canvasWidth || entry.canvas.height !== canvasHeight) {
      entry.texture.dispose();
      entry.canvas.width = canvasWidth;
      entry.canvas.height = canvasHeight;
    }
    const context = entry.context;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, planeWidth, planeHeight);
    if (chip) {
      context.beginPath();
      context.roundRect(padX, padY, rect.width, rect.height, chip.radius);
      context.fillStyle = chip.fill;
      context.fill();
      if (chip.border > 0) {
        const inset = chip.border / 2;
        context.beginPath();
        context.roundRect(
          padX + inset,
          padY + inset,
          Math.max(0, rect.width - chip.border),
          Math.max(0, rect.height - chip.border),
          Math.max(0, chip.radius - inset),
        );
        context.lineWidth = chip.border;
        context.strokeStyle = chip.stroke;
        context.stroke();
      }
    }
    context.font = `${fontCSS.fontStyle} ${fontCSS.fontWeight} ${fontCSS.fontSize} ${fontCSS.fontFamily}`;
    if ('letterSpacing' in context)
      context.letterSpacing = fontCSS.letterSpacing === 'normal' ? 'normal' : fontCSS.letterSpacing;
    if ('textRendering' in context) context.textRendering = 'optimizeLegibility';
    context.fillStyle = '#fff';
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    const metrics = context.measureText('Hg');
    const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
    const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.25;
    const box = chip?.labelBox || { x: 0, y: 0, width: rect.width, height: rect.height };
    const baseline = padY + box.y + box.height / 2 + (ascent - descent) / 2;
    const transformedText =
      fontCSS.textTransform === 'uppercase'
        ? text.toUpperCase()
        : fontCSS.textTransform === 'lowercase'
          ? text.toLowerCase()
          : text;
    if (chip) {
      context.save();
      context.beginPath();
      context.rect(padX + box.x, padY + box.y, box.width, box.height);
      context.clip();
    }
    context.fillText(transformedText, padX + box.x, baseline);
    if (chip) context.restore();
    if (chip?.icon) {
      const [vx, vy, vw, vh] = chip.viewBox,
        icon = chip.icon;
      context.save();
      context.translate(padX + icon.x, padY + icon.y);
      context.scale(icon.width / vw, icon.height / vh);
      context.translate(-vx, -vy);
      context.fillStyle = context.strokeStyle = '#fff';
      const Path = this.document.defaultView.Path2D || globalThis.Path2D;
      if (Path && chip.paths.length) {
        for (const path of chip.paths) {
          context.globalAlpha = path.opacity;
          context.fill(new Path(path.d));
        }
      } else {
        // Phosphor ArrowUpRight regular: 256 viewBox, 16-unit round stroke.
        context.lineWidth = 16;
        context.lineCap = context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(64, 192);
        context.lineTo(192, 64);
        context.moveTo(88, 64);
        context.lineTo(192, 64);
        context.lineTo(192, 168);
        context.stroke();
      }
      context.restore();
    }
    entry.texture.needsUpdate = true;
    entry.width = rect.width;
    entry.height = rect.height;
    entry.padX = padX;
    entry.padY = padY;
    entry.material.uniforms.u_planeH.value = planeHeight;
    // Source Ko.geometry's single-line 32x8 grid, including ink window attrs.
    const positions = [],
      uvs = [],
      indices = [],
      line = [],
      pitch = [],
      cut = [],
      over = [],
      middle = [];
    for (let row = 0; row <= 8; row += 1)
      for (let column = 0; column <= 32; column += 1) {
        const x = column / 32,
          y = 0.5 - (padY + (row / 8) * rect.height) / planeHeight;
        positions.push(x - 0.5, y, 0);
        uvs.push(x, y + 0.5);
        line.push(0);
        pitch.push(rect.height * 1.15);
        cut.push(padY);
        over.push(0);
        middle.push(0.5 - (padY + rect.height / 2) / planeHeight);
      }
    for (let row = 0; row < 8; row += 1)
      for (let column = 0; column < 32; column += 1) {
        const a = row * 33 + column,
          b = a + 1,
          c = a + 33,
          d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    const geometry = new THREE.BufferGeometry();
    for (const [name, values, itemSize] of [
      ['position', positions, 3],
      ['uv', uvs, 2],
      ['aLine', line, 1],
      ['aPitch', pitch, 1],
      ['aCut', cut, 1],
      ['aOver', over, 1],
      ['aMid', middle, 1],
    ])
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, itemSize));
    geometry.setIndex(indices);
    entry.mesh.geometry.dispose();
    entry.mesh.geometry = geometry;
    entry.dirty = false;
  }

  _viewport(element, width, height, cache) {
    const viewport = element.closest?.('.full-index');
    if (!viewport) return null;
    if (cache.has(viewport)) return cache.get(viewport);
    const rect = viewport.getBoundingClientRect();
    const css = this.document.defaultView.getComputedStyle(viewport);
    const hidden =
      css.visibility === 'hidden' || css.visibility === 'collapse' || css.display === 'none';
    // client* describes the scrollport: borders and the native scrollbar do
    // not belong to the area where the DOM can paint its text.
    const rawLeft = rect.left + (viewport.clientLeft || 0);
    const rawTop = rect.top + (viewport.clientTop || 0);
    const left = Math.max(0, rawLeft);
    const top = Math.max(0, rawTop);
    const right = Math.min(width, rawLeft + (viewport.clientWidth ?? rect.width));
    const bottom = Math.min(height, rawTop + (viewport.clientHeight ?? rect.height));
    const clip = {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      hidden,
    };
    cache.set(viewport, clip);
    return clip;
  }

  _visibleBounds(rect, entry, uniforms, width, height, worldWidth, worldHeight, bulge) {
    let padX = Math.max(entry.padX, rect.height * 0.35);
    let padY = Math.max(entry.padY, rect.height * 0.25);
    // For d = q*A*exp(-length(q/half)/S)*P, each displacement
    // component is bounded by half*A*S/e*P. Include both source fields so a
    // line just outside the viewport is not culled while sway bends it in.
    for (const suffix of ['', '2']) {
      const field = uniforms[`u_avoid${suffix}`].value;
      const shape = uniforms[`u_avoidF${suffix}`].value;
      const presence = uniforms[`u_avoidP${suffix}`].value;
      const strength = Math.abs((shape.y * Math.max(shape.x, 0.001) * presence) / Math.E);
      padX += (Math.abs(field.z) * strength * width) / worldWidth;
      padY += (Math.abs(field.w) * strength * height) / worldHeight;
    }
    let left = rect.left - padX,
      right = rect.left + rect.width + padX;
    let top = rect.top - padY,
      bottom = rect.top + rect.height + padY;
    if (bulge) {
      // The source bulge changes Z, hence perspective scale. Its amplitude
      // ranges from zero to bulge; encompass both projected endpoints.
      const cameraZ = this.camera.position.z;
      const scale = cameraZ / Math.max(0.001, cameraZ - bulge);
      const cx = width / 2,
        cy = height / 2;
      const x = [left, right, cx + (left - cx) * scale, cx + (right - cx) * scale];
      const y = [top, bottom, cy + (top - cy) * scale, cy + (bottom - cy) * scale];
      left = Math.min(...x);
      right = Math.max(...x);
      top = Math.min(...y);
      bottom = Math.max(...y);
    }
    return { left, top, right, bottom };
  }

  update({
    elements = [],
    rail = null,
    hovered = 0,
    presence,
    dt = 1 / 60,
    enabled = true,
    alpha = 1,
    blast = null,
    bulge = 0,
  } = {}) {
    if (this.disposed) return;
    const buttons = [...elements];
    const current = new Set(buttons);
    for (const [element, entry] of this.entries) if (!current.has(element)) this._remove(entry);
    this.renderer.getSize(this.size);
    this.renderer.getDrawingBufferSize(this.framebuffer);
    const width = this.size.x,
      height = this.size.y;
    const worldHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const worldWidth = worldHeight * this.camera.aspect;
    const mesh = rail?.mesh || rail;
    const blastMesh = blast?.mesh || blast;
    const reveal = mesh?.material?.uniforms?.u_reveal?.value ?? 0;
    const amount = presence ?? (mesh?.visible ? reveal : 0);
    const seconds = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const viewportCache = new Map();
    const scaleX = width > 0 ? this.framebuffer.x / width : 1;
    const scaleY = height > 0 ? this.framebuffer.y / height : 1;
    if (mesh) {
      mesh.updateMatrixWorld();
      this.inverse.copy(mesh.matrixWorld).invert();
    }
    for (let index = 0; index < buttons.length; index += 1) {
      const element = buttons[index];
      let entry = this.entries.get(element);
      if (!entry && enabled) entry = this._create(element);
      if (!entry) continue;
      if (!enabled || !element.isConnected || width <= 0 || height <= 0) {
        entry.mesh.visible = false;
        this._showDOM(entry, true);
        continue;
      }
      const rect = element._vrect || element.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        entry.mesh.visible = false;
        this._showDOM(entry, true);
        continue;
      }
      const uniforms = entry.material.uniforms;
      if (blastMesh) {
        uniforms.u_avoidP2.value = follow(uniforms.u_avoidP2.value, 1, FULL_FIELD.follow, seconds);
        uniforms.u_avoid2.value.set(
          blastMesh.position.x,
          blastMesh.position.y,
          blastMesh.scale.x / 2 || 1,
          blastMesh.scale.y / 2 || 1,
        );
        uniforms.u_avoidF2.value.set(FULL_FIELD.blastSpread, FULL_FIELD.blastAmp);
      } else {
        uniforms.u_avoidP2.value = follow(uniforms.u_avoidP2.value, 0, FULL_FIELD.follow, seconds);
        uniforms.u_avoidP.value = follow(
          uniforms.u_avoidP.value,
          amount,
          FULL_FIELD.follow,
          seconds,
        );
        if (mesh && uniforms.u_avoidP.value > 0.001) {
          uniforms.u_avoid.value.set(
            mesh.position.x,
            mesh.position.y,
            mesh.scale.x / 2 || 1,
            mesh.scale.y / 2 || 1,
          );
          uniforms.u_avoidF.value.set(FULL_FIELD.spread, FULL_FIELD.amp);
        }
        uniforms.u_dim.value = follow(
          uniforms.u_dim.value,
          index === hovered ? 1 : FULL_FIELD.dim,
          FULL_FIELD.follow,
          seconds,
        );
      }
      if (mesh) {
        uniforms.u_maskM.value.copy(this.inverse);
        uniforms.u_maskCam.value.set(worldWidth / 2, worldHeight / 2, this.camera.position.z);
        uniforms.u_maskRes.value.copy(this.framebuffer);
        uniforms.u_maskShape.value.set(
          mesh.scale.x / Math.max(mesh.scale.y, 0.0001),
          mesh.material.uniforms.u_corner?.value ?? 0,
          amount > 0.001 ? reveal : 0,
        );
      } else uniforms.u_maskShape.value.z = 0;
      uniforms.u_bulgeA.value = bulge;
      uniforms.u_bulgeH.value = worldHeight / 2;
      uniforms.u_alpha.value = alpha;
      const viewport = this._viewport(element, width, height, viewportCache);
      if (viewport?.hidden) {
        entry.mesh.visible = false;
        this._showDOM(entry, true);
        continue;
      }
      uniforms.u_clipOn.value = viewport ? 1 : 0;
      if (viewport) {
        // clipMask consumes framebuffer pixels with a bottom-left origin,
        // while getBoundingClientRect is CSS pixels with a top-left origin.
        uniforms.u_clip.value.set(
          viewport.left * scaleX,
          (height - viewport.bottom) * scaleY,
          viewport.width * scaleX,
          viewport.height * scaleY,
        );
        uniforms.u_clipR.value = 0;
        uniforms.u_clipBow.value = 0;
        uniforms.u_clipWarp.value.set(0, 0, 1);
      }
      const visibleArea = viewport || {
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height,
      };
      const bounds = this._visibleBounds(
        rect,
        entry,
        uniforms,
        width,
        height,
        worldWidth,
        worldHeight,
        bulge,
      );
      const outside =
        visibleArea.width <= 0 ||
        visibleArea.height <= 0 ||
        bounds.right < visibleArea.left - 2 ||
        bounds.left > visibleArea.right + 2 ||
        bounds.bottom < visibleArea.top - 2 ||
        bounds.top > visibleArea.bottom + 2;
      entry.culled = outside;
      entry.mesh.visible = alpha > 0.001 && !outside;
      this._showDOM(entry, false);
      if (!entry.mesh.visible) continue;
      // Offscreen rows retain the live field state, but do not rasterize,
      // upload or draw until they approach the viewport.
      const css = this.document.defaultView.getComputedStyle(element);
      const opacity = Number.parseFloat(css.opacity);
      uniforms.u_alpha.value =
        alpha * (Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1);
      const chip = this._chipLayout(element, rect, css);
      const text = (
        element.dataset.title ||
        element.querySelector?.('.case-link-label')?.textContent ||
        element.textContent ||
        ''
      ).trim();
      const signature = [
        text,
        css.font,
        css.fontSize,
        css.fontFamily,
        css.fontWeight,
        css.letterSpacing,
        css.textTransform,
        chip?.signature,
        this.renderer.getPixelRatio?.(),
      ].join('|');
      if (
        entry.dirty ||
        signature !== entry.signature ||
        Math.abs(rect.width - entry.width) > 0.5 ||
        Math.abs(rect.height - entry.height) > 0.5
      ) {
        this._raster(entry, rect, css, text, chip);
        entry.signature = signature;
      }
      const planeWidth = rect.width + entry.padX * 2,
        planeHeight = rect.height + entry.padY * 2;
      entry.mesh.scale.set(
        (worldWidth * planeWidth) / width,
        (worldHeight * planeHeight) / height,
        1,
      );
      entry.mesh.position.set(
        -worldWidth / 2 + (worldWidth * (rect.left + rect.width / 2)) / width,
        worldHeight / 2 - (worldHeight * (rect.top + rect.height / 2)) / height,
        0,
      );
    }
  }

  _remove(entry) {
    this._showDOM(entry, true);
    entry.mesh.removeFromParent();
    entry.mesh.geometry.dispose();
    entry.material.dispose();
    entry.texture.dispose();
    this.entries.delete(entry.element);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of [...this.entries.values()]) this._remove(entry);
  }
}
