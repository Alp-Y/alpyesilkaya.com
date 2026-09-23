"""
SQE EXAMPLE SITE — geometry + aerial image, from one definition.
--------------------------------------------------------------------
Generates, for the Quantity by Area Calculator demo:
  lib/sqe/site.json                 project areas, work geometry, survey points (metres)
  public/images/sqe/site-aerial.jpg an ORIGINAL rendered "satellite-style" aerial

The aerial is drawn from the same geometry, so the CAD overlay lines up
exactly. It is not a photograph of a real place: no licence is involved.

Run (optional — outputs are committed):  python3 scripts/sqe-site.py
Needs: numpy, scipy, pillow.
"""

import json, math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W_M, H_M = 1200.0, 660.0          # site extent in metres
PX = 2.0                          # pixels per metre
W, H = int(W_M * PX), int(H_M * PX)
SS = 2                            # supersampling for anti-aliased masks
E0, N0 = 485000.0, 4512000.0      # local grid origin (display only)
rng = np.random.default_rng(7)
random.seed(7)

# ------------------------------------------------------------------ geometry
def yM(x):  # motorway centreline
    return 285 + 0.06 * x + 22 * math.sin(2 * math.pi * x / 1500)

def band(x0, x1, o0, o1, step=6.0):
    xs = list(np.arange(x0, x1, step)) + [x1]
    bot = [(x, yM(x) + o0) for x in xs]
    top = [(x, yM(x) + o1) for x in xs][::-1]
    return bot + top

def line(x0, x1, off, step=4.0):
    xs = list(np.arange(x0, x1, step)) + [x1]
    return [(x, yM(x) + off) for x in xs]

def xR(y):  # existing county road (north-south, slightly skewed)
    return 832 + 0.10 * (y - 330)

# Old Mill Lane (existing, north-south). The motorway severs it, so it is
# diverted: from junction J it runs east, south of the motorway, into the
# county road at the interchange. Between J and the motorway the old lane
# is broken out.
OLD_LANE = [(350, -5), (372, 110), (395, 175), (420, 250), (445, 333), (468, 420), (480, 540), (488, 665)]
J = (395.0, 175.0)
DIV_X1 = 821.0  # meets the county road here (y = 215)

def lane_x(y):
    pts = OLD_LANE
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
    return pts[-1][0]

def div_y(x):  # diversion centreline
    t = (x - J[0]) / (DIV_X1 - J[0])
    return J[1] + 40 * t * t

def div_line(x0, x1, off, step=4.0):
    xs = list(np.arange(x0, x1, step)) + [x1]
    return [(x, div_y(x) + off) for x in xs]

def div_band(x0, x1, o0, o1, step=4.0):
    return div_line(x0, x1, o0, step) + div_line(x0, x1, o1, step)[::-1]

def circle(cx, cy, r, n=48, a0=0.0, a1=2 * math.pi):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

def annulus(cx, cy, r0, r1, a0, a1, n=36):
    outer = circle(cx, cy, r1, n, a0, a1)
    inner = circle(cx, cy, r0, n, a0, a1)[::-1]
    return outer + inner

CORR = 40.0     # half-width of the corridor areas
IC_X0, IC_X1 = 720.0, 960.0
LOOP = (905.0, yM(905) + 88.0)

IC_Y_SOUTH = 150.0

def div01_polygon():
    """Diversion band (±12 m) from the tie-in to the interchange, plus the old
    lane between the junction and the motorway (the stretch being broken out)."""
    x_w0 = lane_x(div_y(390) + 12) - 12  # lobe, west side at the band
    x_e0 = lane_x(div_y(410) + 12) + 12  # lobe, east side at the band
    lower = div_line(380, IC_X0, -12)
    upper_east = [(x, div_y(x) + 12) for x in list(np.arange(IC_X0, x_e0, -6)) + [x_e0]]
    # lobe east edge up to the corridor, corridor edge west, lobe west edge down
    def edge(side):
        pts = []
        for y in np.arange(div_y(400) + 12, 300, 6):
            x = lane_x(y) + side * 12
            if y >= yM(x) - CORR: break
            pts.append((x, y))
        return pts
    east = edge(+1)
    west = edge(-1)
    xe_top = east[-1][0] if east else x_e0
    xw_top = west[-1][0] if west else x_w0
    # meet the corridor edge exactly (shared with A02)
    top = [(x, yM(x) - CORR) for x in list(np.arange(xe_top + 1, xw_top - 1, -3))]
    upper_west = [(x, div_y(x) + 12) for x in list(np.arange(x_w0, 380, -4)) + [380]]
    return lower + upper_east + east + top + west[::-1] + upper_west

areas = [
    dict(key="B01", id="A01", name="Main line west", section="Mainline", polygon=band(40, 380, -CORR, CORR)),
    dict(key="B02", id="A02", name="Main line central", section="Mainline", polygon=band(380, 600, -CORR, CORR)),
    dict(key="B03", id="A03", name="Cutting approach", section="Mainline", polygon=band(600, IC_X0, -CORR, CORR)),
    dict(key="B04", id="IC01", name="Interchange", section="Interchange", polygon=(
        [(IC_X0, IC_Y_SOUTH), (IC_X1, IC_Y_SOUTH), (IC_X1, yM(IC_X1) - CORR), (IC_X1, yM(IC_X1) + 60),
         (975, LOOP[1] + 10), (955, LOOP[1] + 62), (850, LOOP[1] + 62), (IC_X0, yM(IC_X0) + 95)])),
    dict(key="B05", id="A04", name="Main line east", section="Mainline", polygon=band(IC_X1, 1170, -CORR, CORR)),
    dict(key="B06", id="DIV01", name="Old Mill Lane diversion", section="Diversion", polygon=div01_polygon()),
]

def dem_old_lane():
    """Old lane pavement from just north of the new junction, through the corridor."""
    y0 = div_y(410) + 14
    y1 = yM(lane_x(330)) + CORR
    ys = list(np.arange(y0, y1, 6)) + [y1]
    left = [(lane_x(y) - 3.2, y) for y in ys]
    right = [(lane_x(y) + 3.2, y) for y in ys][::-1]
    return left + right

def dem_county_road():
    y0 = yM(832) - 70; y1 = yM(832) + 70
    return [(xR(y0) - 4.2, y0), (xR(y1) - 4.2, y1), (xR(y1) + 4.2, y1), (xR(y0) + 4.2, y0)]

work = [
    dict(code="ASP-01", type="ASPHALT", polygon=band(40, 395, 3, 16)),       # A01 → paving front in A02
    dict(code="ASP-02", type="ASPHALT", polygon=band(40, 380, -16, -3)),     # A01
    dict(code="ASP-03", type="ASPHALT", polygon=div_band(J[0], DIV_X1, -3.6, 3.6)),  # DIV01 → IC01
    dict(code="EXC-01", type="EXCAVATION", polygon=band(520, 790, -32, 32)), # A02 → A03 → IC01
    dict(code="EXC-02", type="EXCAVATION", polygon=annulus(LOOP[0], LOOP[1], 28, 48, -0.35 * math.pi, 1.25 * math.pi)),
    dict(code="EXC-03", type="EXCAVATION", polygon=band(985, 1150, -30, 28)),
    dict(code="DEM-01", type="DEMOLITION", polygon=dem_old_lane()),          # DIV01 → A02
    dict(code="DEM-02", type="DEMOLITION", polygon=dem_county_road()),       # IC01
]

def stream_pts():
    return [(185 + 16 * math.sin(y / 45) + 6 * math.sin(y / 13), y) for y in np.arange(0, H_M + 5, 8)]

def ground_z(x, y):
    return 138 + 7 * math.sin(x / 210) + 4 * math.cos(y / 130) + 0.004 * x

def corners(poly, n):
    """Pick n well-spread vertices of a polygon as survey points."""
    idx = sorted(set(int(round(i * (len(poly) - 1) / n)) for i in range(n)))
    return [poly[i] for i in idx]

survey = []
for a in areas:
    count = 4 if a["id"] != "IC01" else 7
    if a["id"] == "DIV01": count = 8
    for (x, y) in corners(a["polygon"], count):
        survey.append(dict(area=a["id"], x=x, y=y, z=ground_z(x, y)))
# de-duplicate shared corners
uniq = []
for p in survey:
    if all(math.hypot(p["x"] - q["x"], p["y"] - q["y"]) > 3 for q in uniq):
        uniq.append(p)
for i, p in enumerate(uniq):
    p["id"] = f"SP-{i + 1:02d}"
survey = uniq
control = dict(id="CP-1", x=640.0, y=yM(640) - 62, z=ground_z(640, yM(640) - 62))

stations = [dict(x=x, y=yM(x), label=f"{int(x // 1000)}+{int(x % 1000):03d}",
                 angle=math.atan((yM(x + 1) - yM(x - 1)) / 2)) for x in range(100, 1200, 100)]

def rnd(pts):
    return [[round(float(x), 2), round(float(y), 2)] for x, y in pts]

site = dict(
    name="Motorway scheme — example project",
    extent=[W_M, H_M],
    origin=[E0, N0],
    image="/images/sqe/site-aerial.jpg",
    areas=[dict(key=a["key"], id=a["id"], name=a["name"], section=a["section"], polygon=rnd(a["polygon"])) for a in areas],
    work=[dict(code=w["code"], type=w["type"], polygon=rnd(w["polygon"])) for w in work],
    survey=[dict(id=p["id"], area=p["area"], x=round(p["x"], 2), y=round(p["y"], 2), z=round(p["z"], 2)) for p in survey],
    control=dict(id=control["id"], x=round(control["x"], 2), y=round(control["y"], 2), z=round(control["z"], 2)),
    centreline=rnd(line(0, W_M, 0, 10)),
    linework=[dict(layer=l, points=rnd(p)) for l, p in [
        ("C-ROAD-EDGE", line(40, 395, 16, 6)), ("C-ROAD-EDGE", line(40, 395, 3, 6)),
        ("C-ROAD-EDGE", line(40, 380, -16, 6)), ("C-ROAD-EDGE", line(40, 380, -3, 6)),
        ("C-ROAD-EDGE", line(395, 1170, 16, 8)), ("C-ROAD-EDGE", line(380, 1170, -16, 8)),
        ("C-ROAD-EDGE", div_line(J[0], DIV_X1, 3.6)), ("C-ROAD-EDGE", div_line(J[0], DIV_X1, -3.6)),
        ("C-EXIST-ROAD", [(xR(y) - 3.8, y) for y in np.arange(0, H_M + 1, 20)]),
        ("C-EXIST-ROAD", [(xR(y) + 3.8, y) for y in np.arange(0, H_M + 1, 20)]),
        ("C-EXIST-ROAD", [(lane_x(y) - 2.8, y) for y in np.arange(-5, 175, 10)]),
        ("C-EXIST-ROAD", [(lane_x(y) + 2.8, y) for y in np.arange(-5, 175, 10)]),
        ("C-EXIST-ROAD", [(lane_x(y) - 2.8, y) for y in np.arange(yM(468) + CORR, 665, 10)]),
        ("C-EXIST-ROAD", [(lane_x(y) + 2.8, y) for y in np.arange(yM(468) + CORR, 665, 10)]),
        ("C-RAMP", circle(LOOP[0], LOOP[1], 38, 60, -0.35 * math.pi, 1.25 * math.pi)),
        ("C-DRAIN", stream_pts()),
    ]],
    stations=[dict(x=round(s["x"], 2), y=round(s["y"], 2), label=s["label"], angle=round(s["angle"], 4)) for s in stations],
)
with open(os.path.join(ROOT, "lib/sqe/site.json"), "w") as f:
    json.dump(site, f, separators=(",", ":"))

# ------------------------------------------------------------------ rendering helpers
def to_px(pts, ss=1):
    return [(x * PX * ss, (H_M - y) * PX * ss) for x, y in pts]

def mask_poly(polys, blur=0.0):
    m = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon(to_px(p, SS), fill=255)
    m = m.resize((W, H), Image.LANCZOS)
    a = np.asarray(m, dtype=np.float32) / 255.0
    return ndimage.gaussian_filter(a, blur) if blur else a

def mask_line(lines, width_m, blur=0.0, dash=None):
    m = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(m)
    wpx = max(1, int(round(width_m * PX * SS)))
    for pts in lines:
        pp = to_px(pts, SS)
        if dash is None:
            d.line(pp, fill=255, width=wpx, joint="curve")
        else:
            on, off = dash
            acc = 0.0
            for (x0, y0), (x1, y1) in zip(pp, pp[1:]):
                L = math.hypot(x1 - x0, y1 - y0)
                t = 0.0
                while t < L:
                    period = (on + off) * PX * SS
                    ph = (acc + t) % period
                    seg = (on * PX * SS - ph) if ph < on * PX * SS else 0
                    if seg > 0:
                        t2 = min(L, t + seg)
                        d.line([(x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L), (x0 + (x1 - x0) * t2 / L, y0 + (y1 - y0) * t2 / L)], fill=255, width=wpx)
                        t = t2
                    else:
                        t += period - ph
                acc += L
    m = m.resize((W, H), Image.LANCZOS)
    a = np.asarray(m, dtype=np.float32) / 255.0
    return ndimage.gaussian_filter(a, blur) if blur else a

def noise(scale_px, seed, octaves=4):
    r = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32); amp = 1.0; tot = 0.0; s = scale_px
    for _ in range(octaves):
        gh, gw = max(2, int(H / s) + 2), max(2, int(W / s) + 2)
        g = r.standard_normal((gh, gw)).astype(np.float32)
        z = ndimage.zoom(g, (H / (gh - 1) * 1.0, W / (gw - 1) * 1.0), order=3)[:H, :W]
        if z.shape != (H, W):
            z = np.pad(z, ((0, H - z.shape[0]), (0, W - z.shape[1])), mode="edge")
        out += amp * z; tot += amp; amp *= 0.5; s = max(2, s / 2)
    out /= tot
    return (out - out.mean()) / (out.std() + 1e-6)

def paint(img, m, color, tex=None, tex_amt=0.0):
    c = np.array(color, np.float32)[None, None, :]
    if tex is not None:
        c = c * (1 + tex_amt * tex[..., None])
    img[:] = img * (1 - m[..., None]) + c * m[..., None]

YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
mx, my = XX / PX, H_M - YY / PX  # metres per pixel

# ------------------------------------------------------------------ base: farmland
img = np.zeros((H, W, 3), np.float32)
n_big, n_mid, n_fine = noise(260, 1), noise(60, 2), noise(6, 3, 2)
paint(img, np.ones((H, W), np.float32), (0.36, 0.40, 0.25), n_big, 0.08)

# field parcels: a recursively subdivided patchwork (how real farmland looks from above)
ANG = math.radians(7.0)
U = mx * math.cos(ANG) + my * math.sin(ANG)
V = -mx * math.sin(ANG) + my * math.cos(ANG)
rects = []
def split(u0, v0, u1, v1, depth=0):
    du, dv = u1 - u0, v1 - v0
    if (du < 170 and dv < 130 and rng.random() < 0.75) or du < 70 or dv < 55:
        rects.append((u0, v0, u1, v1)); return
    t = rng.uniform(0.35, 0.65)
    if du / 1.3 > dv:
        m = u0 + du * t; split(u0, v0, m, v1, depth + 1); split(m, v0, u1, v1, depth + 1)
    else:
        m = v0 + dv * t; split(u0, v0, u1, m, depth + 1); split(u0, m, u1, v1, depth + 1)
split(-160, -240, 1400, 820)
palette = [
    (0.49, 0.52, 0.33), (0.61, 0.57, 0.41), (0.43, 0.47, 0.29), (0.67, 0.61, 0.45),
    (0.55, 0.51, 0.37), (0.46, 0.41, 0.32), (0.39, 0.44, 0.27), (0.58, 0.58, 0.42), (0.52, 0.45, 0.35),
]
field_col = np.zeros((H, W, 3), np.float32)
field_tex = np.zeros((H, W), np.float32)
edge_m = np.zeros((H, W), np.float32)
for k, (u0, v0, u1, v1) in enumerate(rects):
    sel = (U >= u0) & (U < u1) & (V >= v0) & (V < v1)
    if not sel.any(): continue
    field_col[sel] = palette[rng.integers(0, len(palette))]
    kind = rng.integers(0, 4)
    along_u = rng.random() < 0.5
    w = (U[sel] if along_u else V[sel])
    if kind == 1: field_tex[sel] = 0.55 * np.sin(w * 2.1)                                   # crop rows
    elif kind == 2: field_tex[sel] = 0.35 * np.sin(w * 1.3) - 1.4 * (np.abs(((w / 24.0) % 1) - 0.5) < 0.02)  # tramlines
    elif kind == 3: field_tex[sel] = 0.9 * n_mid[sel]                                       # grazing / mottled
    else: field_tex[sel] = 0.4 * np.sin(w * 0.9)                                            # harvested stripes
    # thin boundary strip
    d = np.minimum(np.minimum(U[sel] - u0, u1 - U[sel]), np.minimum(V[sel] - v0, v1 - V[sel]))
    edge_m[sel] = np.clip(1.2 - d, 0, 1)
img[:] = field_col * (1 + 0.07 * (field_tex + 0.5 * n_fine + 0.5 * n_mid))[..., None]
img *= (1 - 0.14 * ndimage.gaussian_filter(edge_m, 0.7))[..., None]

# hedgerows: continuous tree lines along some parcel boundaries
hedge_pts = []
def to_xy(u, v):
    return (u * math.cos(ANG) - v * math.sin(ANG), u * math.sin(ANG) + v * math.cos(ANG))
for (u0, v0, u1, v1) in rects:
    for (a, b) in (((u0, v0), (u1, v0)), ((u0, v0), (u0, v1))):
        if rng.random() < 0.42:
            L = math.hypot(b[0] - a[0], b[1] - a[1]); t = 0.0
            gap = rng.uniform(0, L)
            while t < L:
                if not (gap < t < gap + rng.uniform(8, 25)):
                    x, y = to_xy(a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L)
                    hedge_pts.append((x + rng.normal(0, 0.7), y + rng.normal(0, 0.7), rng.uniform(1.8, 3.4)))
                t += rng.uniform(1.8, 3.0)
    if rng.random() < 0.25:  # a few field trees
        for _ in range(rng.integers(1, 4)):
            x, y = to_xy(rng.uniform(u0, u1), rng.uniform(v0, v1))
            hedge_pts.append((x, y, rng.uniform(3.5, 5.5)))

# stream (meandering, north-south near x≈185) + riparian trees
stream = [(185 + 16 * math.sin(y / 45) + 6 * math.sin(y / 13), y) for y in np.arange(0, H_M + 5, 4)]
tree_pts = []
for x, y in stream[::2]:
    for s in (-1, 1):
        if rng.random() < 0.7 and abs(y - yM(x)) > 42:
            tree_pts.append((x + s * rng.uniform(5, 14), y + rng.normal(0, 3), rng.uniform(3.5, 6.5)))
# woodland patch
for _ in range(260):
    x, y = rng.normal(1080, 45), rng.normal(95, 30)
    tree_pts.append((x, y, rng.uniform(3.5, 6.0)))
for _ in range(140):
    x, y = rng.normal(470, 40), rng.normal(560, 25)
    tree_pts.append((x, y, rng.uniform(3.2, 5.5)))

# ------------------------------------------------------------------ corridor
# remove trees/hedges inside the works corridor & interchange
def in_works(x, y):
    if 30 <= x <= 1180 and abs(y - yM(x)) < CORR + 12: return True
    if 700 <= x <= 985 and IC_Y_SOUTH - 10 < y < LOOP[1] + 70: return True
    if 610 <= x <= 715 and yM(x) + 60 < y < yM(x) + 125: return True   # site compound (north)
    if J[0] - 20 <= x <= DIV_X1 + 10 and abs(y - div_y(x)) < 16: return True  # diversion
    if abs(x - lane_x(y)) < 10 and div_y(400) < y < yM(lane_x(y)) + CORR: return True
    return False
hedge_pts = [p for p in hedge_pts if not in_works(p[0], p[1])]
tree_pts = [p for p in tree_pts if not in_works(p[0], p[1])]

soil_tex = noise(18, 11, 4)
corr_all = mask_poly([band(20, 1185, -CORR - 6, CORR + 6)], blur=2.5)
paint(img, corr_all, (0.55, 0.46, 0.34), soil_tex * 0.7 + n_fine * 0.3, 0.10)   # stripped ground

# track marks across the earthworks
tracks = []
for k in range(60):
    x0 = rng.uniform(420, 1170); o = rng.uniform(-30, 30)
    tracks.append([(x, yM(x) + o + 3 * math.sin((x - x0) / rng.uniform(20, 60))) for x in np.arange(x0, x0 + rng.uniform(40, 160), 3)])
paint(img, mask_line(tracks, 0.6, blur=0.6) * 0.35, (0.40, 0.33, 0.25))

# haul road down the corridor (compacted, lighter) + darker wet patches
haul = [line(400, 1170, 22 + 2 * math.sin(k), 4) for k in range(1)]
paint(img, mask_line(haul, 6.5, blur=1.2) * 0.55, (0.66, 0.58, 0.46), n_fine, 0.05)
wet = np.clip(noise(40, 61, 3) - 1.2, 0, 1) * corr_all
paint(img, wet * 0.5, (0.36, 0.30, 0.23))

# embankment slopes (grassed in the finished section, bare elsewhere)
slopes_w = mask_poly([band(40, 380, 22, 36), band(40, 380, -36, -22)], blur=1.2)
paint(img, slopes_w, (0.47, 0.50, 0.32), n_fine * 0.6 + n_mid * 0.4, 0.10)

# formation / subbase platform (central section) + verges
sub = mask_poly([band(380, 600, -17, 17)], blur=0.8)
paint(img, sub, (0.66, 0.64, 0.59), n_fine * 0.7 + soil_tex * 0.3, 0.06)
# roller passes on subbase
paint(img, mask_line([line(385, 598, o, 3) for o in np.arange(-15, 16, 2.4)], 0.9, blur=0.8) * 0.18, (0.74, 0.72, 0.67))

# excavation (A02 → A03): darker, benched soil
exc = mask_poly([band(520, 790, -32, 32)], blur=1.5)
paint(img, exc, (0.52, 0.38, 0.25), soil_tex, 0.14)
bench = mask_line([line(525, 785, o, 3) for o in (-26, -18, 18, 26)], 1.4, blur=1.0)
paint(img, bench * 0.35, (0.38, 0.27, 0.18))
# cut faces: shaded on the north-facing side, lit on the south-facing side (sun from the north-west)
paint(img, mask_poly([band(522, 788, 24, 32)], blur=1.6) * 0.45, (0.33, 0.24, 0.16))
paint(img, mask_poly([band(522, 788, -32, -24)], blur=1.6) * 0.35, (0.70, 0.58, 0.42))
floor_ = mask_poly([band(530, 780, -12, 12)], blur=2.0)
paint(img, floor_ * 0.8, (0.60, 0.48, 0.34), n_fine, 0.08)

# east section topsoil strip + stockpiles
east = mask_poly([band(985, 1150, -30, 28)], blur=1.2)
paint(img, east, (0.50, 0.40, 0.29), soil_tex * 0.6 + noise(3, 21, 2) * 0.4, 0.12)
paint(img, mask_line([line(990, 1148, o, 3) for o in np.arange(-28, 28, 4.5)], 1.6, blur=1.2) * 0.25, (0.42, 0.33, 0.24))

# finished carriageways (A01) + paving front into A02
asph = mask_poly([band(40, 395, 3, 16), band(40, 380, -16, -3)], blur=0.5)
paint(img, asph, (0.23, 0.235, 0.24), n_fine, 0.05)
barrier = mask_poly([band(40, 380, -0.6, 0.6)], blur=0.3)
paint(img, barrier, (0.72, 0.72, 0.70))
verge = mask_poly([band(40, 380, 16, 22), band(40, 380, -22, -16), band(40, 380, -3, -0.6), band(40, 380, 0.6, 3)], blur=0.6)
paint(img, verge, (0.50, 0.52, 0.36), n_fine, 0.12)
lines_solid = [line(40, 395, 15.2, 3), line(40, 395, 3.8, 3), line(40, 380, -15.2, 3), line(40, 380, -3.8, 3)]
paint(img, mask_line(lines_solid, 0.18, blur=0.35) * 0.9, (0.88, 0.88, 0.85))
lanes_dash = [line(40, 395, o, 2) for o in (7.5, 11.2)] + [line(40, 380, o, 2) for o in (-7.5, -11.2)]
paint(img, mask_line(lanes_dash, 0.16, blur=0.3, dash=(3, 9)) * 0.9, (0.88, 0.88, 0.85))

# existing county road (north & south of the bridge works) + bridge
road_n = [(xR(y), y) for y in np.arange(yM(832) + 72, H_M + 5, 5)]
road_s = [(xR(y), y) for y in np.arange(-5, yM(832) - 72, 5)]
paint(img, mask_line([road_n, road_s], 7.6, blur=0.5), (0.33, 0.33, 0.33), n_fine, 0.06)
paint(img, mask_line([road_n, road_s], 0.15, blur=0.3, dash=(3, 6)) * 0.8, (0.86, 0.86, 0.82))
# old road pavement at the bridge site (being broken out)
paint(img, mask_poly([dem_county_road()], blur=0.8), (0.40, 0.39, 0.37), noise(4, 31, 2), 0.18)
# bridge abutments + deck beams
for s in (-1, 1):
    y = yM(832) + s * 26
    ab = [(xR(y) - 10, y - 3.5), (xR(y) + 10, y - 3.5), (xR(y) + 10, y + 3.5), (xR(y) - 10, y + 3.5)]
    paint(img, mask_poly([ab], blur=0.4), (0.78, 0.77, 0.74))
for k in range(5):
    x = xR(yM(832)) - 7 + k * 3.5
    paint(img, mask_poly([[(x, yM(832) - 23), (x + 1.4, yM(832) - 23), (x + 1.4, yM(832) + 23), (x, yM(832) + 23)]], blur=0.3), (0.72, 0.71, 0.68))

# interchange ramps: SW asphalt, NW subbase, SE soil, NE loop in excavation
def ramp(xa, xb, off_a, off_b, w):
    step = 4 if xb > xa else -4
    pts_c = [(x, yM(x) + off_a + (off_b - off_a) * ((x - xa) / (xb - xa)) ** 2) for x in np.arange(xa, xb + step / 4, step)]
    left = [(x, y + w / 2) for x, y in pts_c]; right = [(x, y - w / 2) for x, y in pts_c][::-1]
    return left + right
paint(img, mask_poly([ramp(730, 820, -24, -60, 8)], blur=0.5), (0.25, 0.25, 0.26), n_fine, 0.05)
paint(img, mask_poly([ramp(730, 820, 24, 62, 8)], blur=0.5), (0.64, 0.62, 0.57), n_fine, 0.06)
paint(img, mask_poly([ramp(950, 850, -24, -60, 8)], blur=0.8), (0.56, 0.45, 0.32), soil_tex, 0.10)
loop_m = mask_poly([annulus(LOOP[0], LOOP[1], 28, 48, -0.35 * math.pi, 1.25 * math.pi)], blur=1.5)
paint(img, loop_m, (0.53, 0.40, 0.27), soil_tex, 0.14)
paint(img, mask_line([circle(LOOP[0], LOOP[1], r, 60, -0.35 * math.pi, 1.25 * math.pi) for r in (32, 38, 44)], 1.1, blur=0.8) * 0.3, (0.40, 0.29, 0.20))

# Old Mill Lane: existing south + north parts, the stretch J → corridor broken out,
# and the new diversion J → county road
lane_s = [(lane_x(y), y) for y in np.arange(-5, J[1] + 1, 4)]
lane_n = [(lane_x(y), y) for y in np.arange(yM(468) + CORR, 666, 4)]
paint(img, mask_line([lane_s, lane_n], 5.6, blur=0.6), (0.40, 0.40, 0.39), noise(4, 41, 2), 0.08)
paint(img, mask_poly([dem_old_lane()], blur=0.9), (0.50, 0.46, 0.41), noise(3, 42, 2), 0.25)   # broken-out pavement
paint(img, mask_poly([div_band(J[0] - 6, DIV_X1, -8, 8)], blur=1.0), (0.54, 0.48, 0.38), soil_tex, 0.08)  # verges
paint(img, mask_poly([div_band(J[0], DIV_X1, -3.6, 3.6)], blur=0.4), (0.24, 0.24, 0.25), n_fine, 0.05)
paint(img, mask_line([div_line(J[0], DIV_X1, 0, 3)], 0.16, blur=0.3, dash=(3, 5)), (0.88, 0.74, 0.30))
paint(img, mask_line([div_line(J[0], DIV_X1, 3.1, 3), div_line(J[0], DIV_X1, -3.1, 3)], 0.12, blur=0.3), (0.86, 0.86, 0.84))

# stream
paint(img, mask_line([stream], 3.4, blur=0.8), (0.20, 0.27, 0.27))
paint(img, mask_line([stream], 1.4, blur=0.6) * 0.4, (0.30, 0.38, 0.38))
for s in (-1, 1):  # culvert headwalls
    y = yM(185) + s * 36
    paint(img, mask_poly([[(178, y - 1.5), (194, y - 1.5), (194, y + 1.5), (178, y + 1.5)]], blur=0.3), (0.76, 0.75, 0.72))

# site compound (north of A03) — gravel yard, cabins, cars
yard = [(625, yM(625) + 72), (705, yM(705) + 72), (705, yM(705) + 118), (625, yM(625) + 118)]
paint(img, mask_poly([yard], blur=0.8), (0.63, 0.61, 0.56), n_fine, 0.08)

objects = []  # (cx, cy, length, width, angle_deg, color, height)
for k in range(7):
    objects.append((638 + k * 9, yM(638 + k * 9) + 108, 6.0, 2.6, 90 + 4.0, (0.86, 0.86, 0.84), 2.6))
for k in range(10):
    objects.append((640 + k * 5.5, yM(640 + k * 5.5) + 84, 4.4, 1.8, 90, [(0.55, 0.57, 0.60), (0.25, 0.27, 0.30), (0.72, 0.72, 0.72), (0.45, 0.20, 0.18)][k % 4], 1.4))
# plant on the works (yellow excavators, dump trucks, rollers, paver)
yellow = (0.86, 0.68, 0.18)
for x, o, a in [(560, -8, 30), (620, 14, -20), (690, -18, 70), (760, 6, 10), (1030, -10, 45), (1100, 12, -30), (905, 125, 0)]:
    y = yM(x) + o if x != 905 else LOOP[1] + 40
    objects.append((x, y, 7.5, 3.2, a, yellow, 3.0))
for x, o, a in [(585, -2, 5), (650, 22, 0), (740, -24, 0), (1070, 2, 2), (600, 20, 2)]:
    objects.append((x, yM(x) + o, 9.0, 3.0, a + math.degrees(math.atan(0.06)), (0.80, 0.80, 0.78), 3.2))
objects.append((402, yM(402) + 9.5, 6.0, 3.0, 2, yellow, 2.4))    # paver at the paving front
objects.append((430, yM(430) - 6, 4.5, 2.2, 2, yellow, 2.2))      # roller on subbase
objects.append((470, yM(470) + 5, 4.5, 2.2, 2, yellow, 2.2))
# cars on the county road and diversion
for y in (60, 140, 520, 610):
    objects.append((xR(y) + (1.8 if y < 300 else -1.8), y, 4.4, 1.8, 84, (0.70, 0.12, 0.10) if y == 140 else (0.85, 0.85, 0.86), 1.4))
for x in (500, 690):
    objects.append((x, div_y(x) + 1.6, 4.4, 1.8, math.degrees(math.atan(80 * (x - J[0]) / (DIV_X1 - J[0]) ** 2)), (0.20, 0.25, 0.35), 1.4))
objects.append((lane_x(250), 250, 7.5, 3.2, 70, yellow, 3.0))   # breaker on the old lane

# stockpiles (topsoil) along A04 north side + near compound
piles = [(1000 + k * 26, yM(1000 + k * 26) + 33, rng.uniform(5, 7)) for k in range(6)] + [(730 + k * 12, yM(730) + 135, 5) for k in range(3)]

# farmstead
farm = [(1075, 560, 24, 11, 12, (0.48, 0.30, 0.24)), (1105, 585, 18, 9, -30, (0.50, 0.49, 0.47)), (1060, 590, 14, 8, 60, (0.46, 0.28, 0.22))]

# ------------------------------------------------------------------ shading of 3D things
def rect_poly(cx, cy, L, Wd, a):
    a = math.radians(a); c, s = math.cos(a), math.sin(a)
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in ((-L / 2, -Wd / 2), (L / 2, -Wd / 2), (L / 2, Wd / 2), (-L / 2, Wd / 2))]

SUN = np.array([0.55, -0.55])  # shadow direction in metres (towards +x, -y = south-east)

# shadows first
shadow_polys = []
for cx, cy, L, Wd, a, col, h in objects:
    shadow_polys.append([(x + SUN[0] * h, y + SUN[1] * h) for x, y in rect_poly(cx, cy, L, Wd, a)])
for cx, cy, L, Wd, a, col in farm:
    shadow_polys.append([(x + SUN[0] * 6, y + SUN[1] * 6) for x, y in rect_poly(cx, cy, L, Wd, a)])
sh = mask_poly(shadow_polys, blur=1.0) if shadow_polys else 0
tree_shadow = Image.new("L", (W, H), 0); ts = ImageDraw.Draw(tree_shadow)
for x, y, r in tree_pts + hedge_pts:
    x2, y2 = x + SUN[0] * r * 1.6, y + SUN[1] * r * 1.6
    ts.ellipse([(x2 - r) * PX, (H_M - y2 - r) * PX, (x2 + r) * PX, (H_M - y2 + r) * PX], fill=255)
for x, y, r in piles:
    x2, y2 = x + SUN[0] * r * 0.9, y + SUN[1] * r * 0.9
    ts.ellipse([(x2 - r) * PX, (H_M - y2 - r) * PX, (x2 + r) * PX, (H_M - y2 + r) * PX], fill=200)
tsh = ndimage.gaussian_filter(np.asarray(tree_shadow, np.float32) / 255.0, 2.0)
img *= (1 - 0.55 * np.clip(sh + tsh, 0, 1))[..., None]

# stockpiles: cone shading
for x, y, r in piles:
    d = np.hypot(mx - x, my - y)
    m = np.clip((r - d) / 1.2, 0, 1)
    if m.max() == 0: continue
    lx = (-(mx - x) + (my - y)) / (r + 1e-6)   # lit from north-west
    shade = 0.85 + 0.25 * np.clip(lx, -1, 1)
    col = np.stack([0.45 * shade, 0.36 * shade, 0.26 * shade], -1)
    img[:] = img * (1 - m[..., None]) + col * m[..., None]

# vehicles / cabins / roofs
for cx, cy, L, Wd, a, col, h in objects:
    paint(img, mask_poly([rect_poly(cx, cy, L, Wd, a)], blur=0.35), col)
    paint(img, mask_poly([rect_poly(cx - 0.2, cy + 0.2, L * 0.55, Wd * 0.7, a)], blur=0.3) * 0.25, (1, 1, 1))
for cx, cy, L, Wd, a, col in farm:
    p = rect_poly(cx, cy, L, Wd, a)
    paint(img, mask_poly([p], blur=0.4), col, n_fine, 0.05)
    half = rect_poly(cx, cy, L, Wd / 2, a)
    paint(img, mask_poly([[(x, y) for x, y in rect_poly(cx - math.sin(math.radians(a)) * Wd / 4, cy + math.cos(math.radians(a)) * Wd / 4, L, Wd / 2, a)]], blur=0.4) * 0.25, (1, 1, 1))

# trees and hedges: canopies with soft self-shading
canopy = Image.new("L", (W, H), 0); cd = ImageDraw.Draw(canopy)
tone = Image.new("L", (W, H), 0); td = ImageDraw.Draw(tone)
for x, y, r in tree_pts + hedge_pts:
    box = [(x - r) * PX, (H_M - y - r) * PX, (x + r) * PX, (H_M - y + r) * PX]
    cd.ellipse(box, fill=255); td.ellipse(box, fill=int(rng.uniform(60, 200)))
cm = ndimage.gaussian_filter(np.asarray(canopy, np.float32) / 255.0, 0.8)
tv = ndimage.gaussian_filter(np.asarray(tone, np.float32) / 255.0, 1.0)
height = ndimage.gaussian_filter(cm, 2.5)
gy, gx = np.gradient(height)
light = np.clip(0.9 + 6.0 * (-gx + gy), 0.55, 1.25)
tree_col = np.stack([0.17 + 0.06 * tv, 0.24 + 0.08 * tv, 0.13 + 0.03 * tv], -1) * light[..., None]
tree_col *= (1 + 0.10 * noise(2, 51, 1))[..., None]
img[:] = img * (1 - cm[..., None]) + tree_col * cm[..., None]

# ------------------------------------------------------------------ satellite look
img = np.clip(img, 0, 1)
gray = img.mean(-1, keepdims=True)
img = gray + (img - gray) * 0.82                  # slightly desaturated
img = img * 0.94 + 0.035                          # atmospheric haze
img *= (1 + 0.025 * n_big)[..., None]             # large-scale exposure variation
img = np.clip(img, 0, 1) ** 1.05
out = Image.fromarray((img * 255).astype(np.uint8))
out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
out.save(os.path.join(ROOT, "public/images/sqe/site-aerial.jpg"), quality=82, optimize=True, progressive=True)
print("site.json + site-aerial.jpg written", W, H, len(survey), "survey points")
