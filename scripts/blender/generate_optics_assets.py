from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "src" / "assets" / "models" / "optics"

EYES = {
    "a": 17.6,
    "b": 20.8,
    "c": 22.6,
    "d": 24.0,
    "e": 26.4,
    "f": 29.1,
    "g": 31.8,
}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    try:
        bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.unit_settings.system = "METRIC"


def mat(name: str, color, *, metallic=0.0, roughness=0.45, alpha=1.0, emission=None, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1 else "OPAQUE"
    if hasattr(material, "use_screen_refraction"):
        material.use_screen_refraction = alpha < 1
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if emission:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = emission
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def materials():
    return {
        "bench": mat("warm enamel", (0.88, 0.92, 0.98, 1), roughness=0.58),
        "rail": mat("brushed rail", (0.48, 0.58, 0.65, 1), metallic=0.35, roughness=0.32),
        "dark": mat("dark anodized metal", (0.16, 0.21, 0.25, 1), metallic=0.42, roughness=0.32),
        "metal": mat("satin metal", (0.62, 0.70, 0.76, 1), metallic=0.36, roughness=0.36),
        "glass": mat("optical glass", (0.52, 0.82, 1.0, 0.42), roughness=0.03, alpha=0.42),
        "violet": mat("violet optical edge", (0.35, 0.22, 0.82, 1), roughness=0.2),
        "screen": mat("matte screen", (0.98, 0.99, 1.0, 0.9), roughness=0.78, alpha=0.92),
        "glow": mat("warm emitter", (1.0, 0.76, 0.34, 1), roughness=0.2, emission=(1.0, 0.64, 0.2, 1), emission_strength=1.2),
        "object": mat("object ink", (0.08, 0.16, 0.20, 1), roughness=0.5),
        "mirror": mat("silver mirror", (0.78, 0.84, 0.9, 1), metallic=0.78, roughness=0.16),
        "axis": mat("cyan axis", (0.06, 0.62, 0.78, 1), roughness=0.2, emission=(0.02, 0.42, 0.52, 1), emission_strength=0.35),
    }


def shade(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth()
    except RuntimeError:
        pass
    obj.select_set(False)
    return obj


def cube(name, loc, dims, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def cyl(name, loc, radius, depth, material, *, vertices=32, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return shade(obj)


def cone(name, loc, radius1, radius2, depth, material, *, vertices=32, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return shade(obj)


def torus(name, loc, major, minor, material, *, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=80, minor_segments=10, major_radius=major, minor_radius=minor, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return shade(obj)


def text_label(name, text, loc, material, *, size=0.22, rotation=(math.pi / 2, 0, math.pi / 2)):
    bpy.ops.object.text_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.006
    obj.data.materials.append(material)
    bpy.ops.object.convert(target="MESH")
    return bpy.context.object


def lens_mesh(name, convex, center_thickness, edge_thickness, radius, material):
    radial = 14
    angular = 56
    verts = []
    faces = []

    for side in (-1, 1):
        for i in range(radial + 1):
            r = radius * i / radial
            t = r / radius if radius else 0
            if convex:
                half = edge_thickness / 2 + (center_thickness - edge_thickness) / 2 * (1 - t * t)
            else:
                half = center_thickness / 2 + (edge_thickness - center_thickness) / 2 * t * t
            x = side * half
            for j in range(angular):
                a = 2 * math.pi * j / angular
                verts.append((x, r * math.cos(a), r * math.sin(a)))

    def idx(side_index, i, j):
        return side_index * (radial + 1) * angular + i * angular + (j % angular)

    for side_index in (0, 1):
        for i in range(radial):
            for j in range(angular):
                if side_index == 0:
                    faces.append((idx(side_index, i, j), idx(side_index, i, j + 1), idx(side_index, i + 1, j + 1), idx(side_index, i + 1, j)))
                else:
                    faces.append((idx(side_index, i, j), idx(side_index, i + 1, j), idx(side_index, i + 1, j + 1), idx(side_index, i, j + 1)))

    for j in range(angular):
        faces.append((idx(0, radial, j), idx(0, radial, j + 1), idx(1, radial, j + 1), idx(1, radial, j)))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return shade(obj)


def mirror_cap(name, convex, material):
    radial = 12
    angular = 56
    radius = 0.72
    depth = 0.22 if convex else -0.22
    verts = []
    faces = []
    for i in range(radial + 1):
        r = radius * i / radial
        t = r / radius
        x = depth * (1 - t * t)
        for j in range(angular):
            a = 2 * math.pi * j / angular
            verts.append((x, r * math.cos(a), r * math.sin(a)))

    def idx(i, j):
        return i * angular + (j % angular)

    for i in range(radial):
        for j in range(angular):
            faces.append((idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return shade(obj)


def build_bench(m):
    cube("bench body", (0, 0, 0), (18.6, 0.22, 1.36), m["bench"])
    for z in (-0.38, 0.38):
        cube("steel rail", (0, 0.22, z), (18.2, 0.08, 0.08), m["rail"])
    cube("front bevel", (0, -0.17, 0.58), (18.7, 0.14, 0.16), m["dark"])
    for cm in range(-36, 37, 2):
        h = 0.075 if cm % 10 == 0 else 0.045 if cm % 5 == 0 else 0.032
        cube("ruler tick", (cm / 4, 0.34, 0.0), (0.012, h, 1.18), m["rail"])
    for cm in range(-30, 31, 10):
        text_label(f"tick label {cm}", str(cm), (cm / 4, 0.42, 0.63), m["dark"], size=0.18, rotation=(math.pi / 2, 0, 0))


def build_source(m, point=False):
    cyl("lamp barrel", (0, 0, 0), 0.26 if not point else 0.18, 0.82 if not point else 0.48, m["metal"], rotation=(0, math.pi / 2, 0))
    cyl("emitter", (0.43 if not point else 0.26, 0, 0), 0.2 if not point else 0.12, 0.025, m["glow"], vertices=32, rotation=(0, math.pi / 2, 0))
    if not point:
        cube("collimator shade", (-0.12, 0, 0), (0.36, 0.64, 0.64), m["dark"])
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.18, location=(0.12, 0, 0))
        bulb = bpy.context.object
        bulb.name = "point bulb"
        bulb.data.materials.append(m["glow"])
        shade(bulb)


def build_object_screen(m):
    cube("translucent object plate", (0, 0, 0), (0.08, 1.38, 0.92), m["screen"])
    cone("object arrow", (-0.055, 0.24, 0), 0.18, 0.0, 0.48, m["object"], vertices=3, rotation=(0, 0, math.pi))
    cube("object stem", (-0.055, -0.15, 0), (0.035, 0.62, 0.035), m["object"])
    torus("object rim", (0, 0, 0), 0.55, 0.012, m["rail"], rotation=(0, math.pi / 2, 0))


def build_screen(m):
    cube("screen panel", (0, 0, 0), (0.08, 1.82, 1.2), m["screen"])
    cube("screen top frame", (-0.01, 0.94, 0), (0.13, 0.055, 1.32), m["metal"])
    cube("screen bottom frame", (-0.01, -0.94, 0), (0.13, 0.055, 1.32), m["metal"])
    cube("screen left frame", (-0.01, 0, -0.66), (0.13, 1.9, 0.055), m["metal"])
    cube("screen right frame", (-0.01, 0, 0.66), (0.13, 1.9, 0.055), m["metal"])


def build_lens(m, convex=True, thickness=0.38):
    lens_mesh("optical element", convex, thickness if convex else 0.13, 0.1 if convex else 0.36, 0.78, m["glass"])
    torus("lens rim", (0, 0, 0), 0.79, 0.02, m["violet"], rotation=(0, math.pi / 2, 0))
    cube("vertical glint", (-0.08, 0, 0.24), (0.018, 1.38, 0.018), m["screen"])


def build_cylinder_lens(m):
    cube("cylinder glass plate", (0, 0, 0), (0.08, 1.45, 0.58), m["glass"])
    cyl("cylinder axis", (-0.055, 0, 0), 0.014, 1.46, m["axis"], vertices=16, rotation=(0, 0, 0))
    torus("cylinder curvature guide", (0, 0, 0), 0.36, 0.012, m["axis"], rotation=(0, math.pi / 2, 0))


def build_correction_support(m):
    for z in (-0.48, 0.48):
        cube("support upright", (0, 0, z), (0.12, 1.74, 0.08), m["metal"])
    cube("support top bridge", (0, 0.84, 0), (0.14, 0.08, 1.08), m["metal"])
    cube("support lower cradle", (0, -0.8, 0), (0.2, 0.12, 1.0), m["dark"])


def build_sim_eye(m, eye_key):
    focus = EYES[eye_key]
    offset = (24.0 - focus) / 8
    thickness = max(0.22, min(0.56, 0.36 + offset * 0.2))
    build_lens(m, True, thickness)
    cube("insert tab", (0, -0.96, 0), (0.16, 0.22, 0.82), m["dark"])
    text_label("eye label", eye_key.upper(), (-0.11, -0.96, 0), m["screen"], size=0.2, rotation=(math.pi / 2, 0, math.pi / 2))


def build_mirror(m, convex=False):
    mirror_cap("mirror surface", convex, m["mirror"])
    torus("mirror rim", (0, 0, 0), 0.73, 0.018, m["dark"], rotation=(0, math.pi / 2, 0))
    cube("mirror back", (-0.1 if convex else 0.1, 0, 0), (0.05, 1.08, 1.08), m["dark"])


ASSETS = {
    "bench.glb": lambda m: build_bench(m),
    "source-parallel.glb": lambda m: build_source(m, point=False),
    "source-point.glb": lambda m: build_source(m, point=True),
    "object-screen.glb": lambda m: build_object_screen(m),
    "image-screen.glb": lambda m: build_screen(m),
    "lens-convex.glb": lambda m: build_lens(m, True),
    "lens-concave.glb": lambda m: build_lens(m, False),
    "lens-cylinder.glb": lambda m: build_cylinder_lens(m),
    "correction-support.glb": lambda m: build_correction_support(m),
    "mirror-concave.glb": lambda m: build_mirror(m, convex=False),
    "mirror-convex.glb": lambda m: build_mirror(m, convex=True),
    **{f"sim-eye-{key}.glb": (lambda m, eye_key=key: build_sim_eye(m, eye_key)) for key in EYES},
}


def export_asset(file_name: str, builder) -> None:
    clear_scene()
    builder(materials())
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_DIR / file_name),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for file_name, builder in ASSETS.items():
        export_asset(file_name, builder)
        print(f"wrote {OUT_DIR / file_name}")


if __name__ == "__main__":
    main()
