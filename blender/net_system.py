# Sistema de red de voleibol para Blender (medidas FIVB, metros).
# Genera: red, bandas, antenas, cables, postes, protectores y escalera del árbitro.
#
# Uso (desde la carpeta cancha/):
#   blender --background --factory-startup --python blender/net_system.py
# Salida:
#   models/net_system.glb   -> se carga en la web (Three.js)
#   blender/net_system.blend
#   blender/preview.png
#
# Ejes de Blender: X = largo de la cancha, Y = a lo largo de la red, Z = arriba.
# El exportador glTF convierte a Y-arriba (Three.js): (x, y, z) -> (x, z, -y).
# "NetAssembly" tiene su origen en el borde superior de la red: en la web se
# coloca a 2,43 m (hombres) o 2,24 m (mujeres).

import bpy, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------- materiales
def material(name, rgb, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m.diffuse_color = (*rgb, 1)
    return m

def srgb(h):
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)

M = {
    "cord":    material("Cuerda", srgb(0x161616), 0.85),
    "canvas":  material("Lona", srgb(0xf3f3f0), 0.7),
    "stitch":  material("Costura", srgb(0xb9bcc2), 0.8),
    "steel":   material("Acero", srgb(0x9aa0a6), 0.35, 1.0),
    "rope":    material("Cuerda blanca", srgb(0xe8e6e0), 0.8),
    "alu":     material("Aluminio", srgb(0xc9cdd2), 0.28, 0.9),
    "black":   material("Negro", srgb(0x121212), 0.6),
    "rubber":  material("Goma", srgb(0x0d0d0d), 0.9),
    "pad":     material("Protector negro", srgb(0x131416), 0.5),
    "padseam": material("Protector costura", srgb(0x2b2d31), 0.65),
    "antR":    material("Antena roja", srgb(0xd31f26), 0.3),
    "antW":    material("Antena blanca", srgb(0xf5f5f5), 0.3),
    "red":     material("Rojo escalera", srgb(0xc4161c), 0.4, 0.25),
    "redpad":  material("Rojo protector", srgb(0xb0141a), 0.6),
    "grey":    material("Gris", srgb(0x3b3f45), 0.8),
}

# ---------------------------------------------------------------- geometría
class Builder:
    """Acumula cajas y cilindros en una sola malla con varios materiales."""

    def __init__(self):
        self.v, self.f, self.mi, self.sm, self.mats = [], [], [], [], []

    def _m(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _face(self, idx, m, smooth=False):
        self.f.append(idx); self.mi.append(m); self.sm.append(smooth)

    def box(self, mn, mx, mat):
        m = self._m(mat)
        x0, y0, z0 = mn; x1, y1, z1 = mx
        b = len(self.v)
        self.v += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                   (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        for q in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            self._face([b + i for i in q], m)

    def tube(self, p0, p1, r, mat, seg=12, caps=True):
        m = self._m(mat)
        p0, p1 = Vector(p0), Vector(p1)
        d = (p1 - p0).normalized()
        u = d.orthogonal().normalized()
        w = d.cross(u)
        ring = [(u * math.cos(2 * math.pi * i / seg) + w * math.sin(2 * math.pi * i / seg)) * r for i in range(seg)]
        b = len(self.v)
        self.v += [tuple(p0 + o) for o in ring] + [tuple(p1 + o) for o in ring]
        for i in range(seg):
            j = (i + 1) % seg
            self._face([b + i, b + j, b + seg + j, b + seg + i], m, True)
        if caps:  # vértices propios para que las tapas queden planas
            c = len(self.v)
            self.v += [tuple(p0 + o) for o in ring]
            self._face([c + i for i in reversed(range(seg))], m)
            c = len(self.v)
            self.v += [tuple(p1 + o) for o in ring]
            self._face([c + i for i in range(seg)], m)

    def build(self, name, parent=None):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        for mat in self.mats:
            me.materials.append(mat)
        me.polygons.foreach_set("material_index", self.mi)
        me.polygons.foreach_set("use_smooth", self.sm)
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        return ob

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    bpy.context.scene.collection.objects.link(e)
    e.parent = parent
    return e

def logo_material():
    """Logo del club con el fondo gris recortado (canal alfa)."""
    import numpy as np
    src = os.path.join(ROOT, "assets", "la_fortuna_logo.webp")
    img = bpy.data.images.load(src)
    img.scale(512, 512)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    gray_bg = (np.abs(r - g) < 0.05) & (np.abs(g - b) < 0.05) & (r > 0.22) & (r < 0.5)
    px[gray_bg, 3] = 0.0
    out = bpy.data.images.new("LaFortunaLogo", 512, 512, alpha=True)
    out.pixels[:] = px.ravel()
    out.filepath_raw = os.path.join(ROOT, "assets", "la_fortuna_logo.png")
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(img)

    m = bpy.data.materials.new("Logo")
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = out
    tex.extension = "CLIP"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.55
    m.diffuse_color = (0.8, 0.35, 0.05, 1)
    return m

def decal(name, x, yc, zc, size, facing, mat, parent):
    """Plano con UV para el logo, pegado a una cara ±X (facing = +1 / -1)."""
    h = size / 2
    if facing > 0:   # visto desde +X, la derecha es +Y
        verts = [(x, yc - h, zc - h), (x, yc + h, zc - h), (x, yc + h, zc + h), (x, yc - h, zc + h)]
    else:            # visto desde -X, la derecha es -Y
        verts = [(x, yc + h, zc - h), (x, yc - h, zc - h), (x, yc - h, zc + h), (x, yc + h, zc + h)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UVMap")
    for loop, co in zip(me.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[loop.index].uv = co
    me.materials.append(mat)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    return ob

def padded(name, mn, mx, mat, parent, bevel=0.035):
    """Caja acolchada (bisel redondeado)."""
    b = Builder(); b.box(mn, mx, mat)
    ob = b.build(name, parent)
    mod = ob.modifiers.new("Bevel", "BEVEL")
    mod.width = bevel; mod.segments = 4; mod.limit_method = "NONE"
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob

# ---------------------------------------------------------------- medidas
NET_L = 9.5        # largo de la red
NET_H = 1.0        # alto de la red
MESH = 0.10        # cuadros de 10 cm
CORD = 0.002       # medio grosor de la cuerda (4 mm)
SIDE = 4.5         # bandas laterales sobre las líneas de banda
POST_Y = 5.5       # postes a 1 m de la línea de banda
POST_H = 2.55
POST_R = 0.045
PAD_X = 0.14       # medio fondo del protector
PAD_Y = 0.25       # medio ancho del protector: caras de 50 cm para el logo

LOGO = logo_material()

root = empty("NetSystem")
net = empty("NetAssembly", root)
posts = empty("Posts", root)
stand = empty("RefereeStand", root)

# ---------------------------------------------------------------- red (malla)
mesh = Builder()
n = round(NET_L / MESH)
for k in range(n + 1):
    y = -NET_L / 2 + k * MESH
    mesh.box((-CORD, y - CORD, -NET_H), (CORD, y + CORD, 0), M["cord"])
for k in range(1, round(NET_H / MESH)):
    z = -k * MESH
    mesh.box((-CORD, -NET_L / 2, z - CORD), (CORD, NET_L / 2, z + CORD), M["cord"])
mesh.build("NetMesh", net)

# Bandas superior (7 cm) e inferior (5 cm) con costuras, varillas y cables
bands = Builder()
T = 0.004
bands.box((-T, -NET_L / 2, -0.07), (T, NET_L / 2, 0), M["canvas"])
bands.box((-T, -NET_L / 2, -NET_H), (T, NET_L / 2, -NET_H + 0.05), M["canvas"])
for z in (-0.008, -0.062, -NET_H + 0.006, -NET_H + 0.044):
    bands.box((-T - 0.0006, -NET_L / 2 + 0.01, z - 0.001), (T + 0.0006, NET_L / 2 - 0.01, z + 0.001), M["stitch"])
for s in (-1, 1):
    ey = s * (NET_L / 2 + 0.03)
    bands.tube((0, ey, -NET_H - 0.02), (0, ey, 0.02), 0.008, M["canvas"], 10)      # varilla de extremo
    # Cable de acero superior y cuerda inferior hasta los postes
    bands.tube((0, s * (NET_L / 2 - 0.02), -0.035), (0, s * (POST_Y - POST_R), -0.035), 0.003, M["steel"], 6, False)
    bands.tube((0, s * (NET_L / 2 - 0.02), -NET_H + 0.025), (0, s * (POST_Y - POST_R), -NET_H + 0.025), 0.003, M["rope"], 6, False)
    # Cordón de tensión entre la varilla y el poste
    for z in (-0.25, -0.5, -0.75):
        bands.tube((0, ey, z), (0, s * (POST_Y - POST_R), z + 0.03), 0.0022, M["rope"], 6, False)
bands.tube((0, -NET_L / 2, -0.035), (0, NET_L / 2, -0.035), 0.0032, M["steel"], 6, False)
bands.build("NetBands", net)

# Bandas laterales (5 cm) sobre las líneas de banda
side = Builder()
for s in (-1, 1):
    y0, y1 = sorted((s * (SIDE - 0.05), s * SIDE))
    side.box((-0.006, y0, -NET_H), (0.006, y1, 0), M["canvas"])
side.build("SideBands", net)

# Antenas: 1,8 m, Ø10 mm, franjas de 10 cm, 80 cm sobre la red
ant = Builder()
for s in (-1, 1):
    y = s * SIDE
    x = 0.014
    for i in range(18):
        z0 = -NET_H + i * 0.1
        ant.tube((x, y, z0), (x, y, z0 + 0.1), 0.005, M["antR"] if i % 2 == 0 else M["antW"], 10)
    ant.tube((x, y, 0.8), (x, y, 0.805), 0.0055, M["black"], 10)                     # tapón
    for z in (-0.93, -0.08):                                                          # abrazaderas
        y0, y1 = sorted((s * (SIDE - 0.055), s * (SIDE + 0.012)))
        ant.box((-0.01, y0, z - 0.015), (0.022, y1, z + 0.015), M["black"])
ant.build("Antennas", net)

# ---------------------------------------------------------------- postes
for s in (-1, 1):
    y = s * POST_Y
    p = Builder()
    p.tube((0, y, 0), (0, y, POST_H), POST_R, M["alu"], 24)
    p.tube((0, y, POST_H), (0, y, POST_H + 0.02), POST_R + 0.006, M["black"], 24)    # tapa
    p.tube((0, y, 0), (0, y, 0.008), 0.12, M["steel"], 32)                           # placa del suelo
    p.box((-0.06, y - 0.06, 2.36), (0.06, y + 0.06, 2.46), M["black"])               # guía del cable
    p.tube((0.06, y, 2.41), (0.075, y, 2.41), 0.03, M["steel"], 16)                  # polea
    if s < 0:  # tensor de manivela en uno de los postes
        p.box((0.045, y - 0.05, 1.0), (0.15, y + 0.05, 1.16), M["black"])
        p.tube((0.15, y, 1.08), (0.19, y, 1.08), 0.012, M["steel"], 12)
        p.tube((0.19, y, 1.08), (0.19, y + s * 0.12, 1.0), 0.009, M["steel"], 10)
        p.tube((0.19, y + s * 0.12, 1.0), (0.24, y + s * 0.12, 1.0), 0.015, M["rubber"], 12)
        p.tube((0, y, 1.08), (0, y, 2.38), 0.003, M["steel"], 6, False)
    p.build(f"Post{'L' if s < 0 else 'R'}", posts)

    # Protector acolchado alrededor del poste (negro, con costura de velcro y logo del club)
    PW, PD = PAD_X, PAD_Y   # caras ±X (hacia cada mitad de la cancha) llevan el logo
    tag = 'L' if s < 0 else 'R'
    padded(f"PostPad{tag}", (-PW, y - PD, 0.0), (PW, y + PD, 1.9), M["pad"], posts)
    seam = Builder()
    yo = y + s * (PD + 0.001)
    seam.box((-0.012, min(yo, yo + s * 0.004), 0.05), (0.012, max(yo, yo + s * 0.004), 1.85), M["padseam"])
    for z in (0.35, 0.95, 1.62):  # correas
        seam.box((-PW - 0.002, y - PD - 0.002, z), (PW + 0.002, y + PD + 0.002, z + 0.05), M["padseam"])
    seam.build(f"PostPadSeam{tag}", posts)
    for f in (-1, 1):  # logo en las dos caras anchas
        decal(f"PostLogo{tag}{'A' if f > 0 else 'B'}", f * (PW + 0.0015), y, 1.29, 0.44, f, LOGO, posts)

# ---------------------------------------------------------------- escalera del árbitro
Y0 = POST_Y + PAD_Y + 0.06  # frente de la escalera, pegada al protector
PLAT = 1.45                 # altura de la plataforma
RAIL = PLAT + 0.85
TR = 0.02                   # radio de los tubos
sb = Builder()
ry = lambda yl: Y0 + yl
for x in (-0.28, 0.28):
    sb.tube((x, ry(0.05), 0.0), (x, ry(0.05), RAIL), TR, M["red"], 12)              # montantes delanteros
    sb.tube((x, ry(1.05), 0.0), (x, ry(0.45), PLAT), TR, M["red"], 12)              # largueros traseros
    sb.tube((x, ry(0.45), PLAT), (x, ry(0.45), RAIL), TR, M["red"], 12)             # montante trasero de la baranda
    sb.tube((x, ry(0.05), RAIL), (x, ry(0.45), RAIL), TR, M["red"], 12)             # baranda lateral
    sb.tube((x, ry(0.05), PLAT - 0.03), (x, ry(0.45), PLAT - 0.03), TR, M["red"], 12)
    sb.tube((x, ry(0.05), 0.6), (x, ry(0.80), 0.6), TR * 0.8, M["red"], 10)         # refuerzo
    sb.box((x - 0.04, ry(0.0), 0.0), (x + 0.04, ry(0.1), 0.02), M["rubber"])        # tacos
    # Ruedas traseras
    sb.tube((x - 0.045 if x < 0 else x + 0.02, ry(1.08), 0.05), (x - 0.02 if x < 0 else x + 0.045, ry(1.08), 0.05), 0.05, M["rubber"], 20)
    sb.tube((x - 0.05 if x < 0 else x + 0.015, ry(1.08), 0.05), (x - 0.015 if x < 0 else x + 0.05, ry(1.08), 0.05), 0.018, M["steel"], 12)
for z in (0.15, 0.9):
    sb.tube((-0.28, ry(0.05), z), (0.28, ry(0.05), z), TR, M["red"], 12)            # travesaños delanteros
sb.tube((-0.28, ry(0.05), RAIL), (0.28, ry(0.05), RAIL), TR, M["red"], 12)
for z in (0.36, 0.72, 1.08):                                                          # peldaños
    yl = 1.05 - (z / PLAT) * 0.6
    sb.box((-0.27, ry(yl - 0.07), z - 0.015), (0.27, ry(yl + 0.07), z + 0.015), M["grey"])
sb.box((-0.3, ry(0.0), PLAT - 0.02), (0.3, ry(0.5), PLAT + 0.02), M["grey"])        # plataforma
sb.build("RefereeLadder", stand)
padded("RefereePad", (-0.31, ry(-0.06), PLAT + 0.08), (0.31, ry(0.03), RAIL - 0.05), M["redpad"], stand, 0.025)
for x in (-0.28, 0.28):
    padded(f"RefereeLegPad{'L' if x < 0 else 'R'}", (x - 0.045, ry(-0.02), 0.03), (x + 0.045, ry(0.11), 1.3), M["redpad"], stand, 0.02)

# Altura masculina por defecto (la web la ajusta en tiempo real)
net.location.z = 2.43

# ---------------------------------------------------------------- exportar
os.makedirs(os.path.join(ROOT, "models"), exist_ok=True)
glb = os.path.join(ROOT, "models", "net_system.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", export_apply=True, export_yup=True)

# ---------------------------------------------------------------- vista previa
scene = bpy.context.scene
cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
scene.collection.objects.link(cam)
cam.location = (2.6, 7.6, 2.0)
target = Vector((0, 5.3, 1.2))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 30
scene.camera = cam
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.color_type = "TEXTURE"
scene.display.shading.light = "STUDIO"
scene.display.shading.show_cavity = True
scene.render.resolution_x, scene.render.resolution_y = 1280, 800
scene.render.film_transparent = False
world = bpy.data.worlds.new("World"); scene.world = world
scene.render.filepath = os.path.join(HERE, "preview.png")
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "net_system.blend"))
print("OK", glb, os.path.getsize(glb))
