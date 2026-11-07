"""Bake the CC0 CharacterCreator parts into one dressed, static runway GLB.

Usage: python tools/build_runway_actor.py <directory containing the source GLBs>
See static/runway/models/SOURCES.md for the pinned source and licence.
"""
import io
import json
import math
import struct
import sys
from copy import deepcopy
from pathlib import Path

from PIL import Image

FORMATS = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
PARTS = ('base_body', 'clothing_tshirt', 'clothing_jeans', 'clothing_shoes', 'hair_short04')
HEIGHT_SCALE = 1.105


def matrix(q, t):
    x, y, z, w = q
    return (
        1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w), t[0],
        2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w), t[1],
        2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y), t[2],
        0, 0, 0, 1,
    )


def multiply(a, b):
    return tuple(sum(a[i+k]*b[k*4+j] for k in range(4)) for i in range(0,16,4) for j in range(4))


def transpose(a):
    return tuple(a[j*4+i] for i in range(4) for j in range(4))


def transform(a, xyz, w):
    x,y,z=xyz
    return tuple(a[i]*x+a[i+1]*y+a[i+2]*z+a[i+3]*w for i in (0,4,8))


def read_glb(path):
    data = path.read_bytes()
    magic, version, length, size, kind = struct.unpack_from('<5I',data)
    if magic != 0x46546c67 or version != 2 or length != len(data) or kind != 0x4e4f534a:
        raise ValueError(f'Invalid glTF 2.0 file: {path.name}')
    return json.loads(data[20:20+size]), data[28+size:]


def read_accessor(doc, binary, index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    fmt = struct.Struct('<'+FORMATS[a['componentType']]*WIDTH[a['type']])
    offset = view.get('byteOffset',0)+a.get('byteOffset',0)
    stride = view.get('byteStride',fmt.size)
    return [fmt.unpack_from(binary,offset+i*stride) for i in range(a['count'])]


def posed_joints(doc, binary):
    # All five exports use the same skeleton. Rotate each upper arm from its
    # shoulder in world space and carry the shirt and hand with the same joints.
    skin = doc['skins'][0]
    inverse = read_accessor(doc,binary,skin['inverseBindMatrices'])
    world = {}
    def visit(index, parent):
        node = doc['nodes'][index]
        local = matrix(node.get('rotation',(0,0,0,1)),node.get('translation',(0,0,0)))
        out = multiply(parent,local)
        if node.get('name') in ('upperarm_l','upperarm_r'):
            x,y,z = transform(out,(0,0,0),1)
            sign = 1 if x > 0 else -1
            angle = -sign * math.radians(32 if sign > 0 else 36)
            turn = matrix((0,0,math.sin(angle/2),math.cos(angle/2)),(0,0,0))
            moved = multiply(turn,out)
            out = tuple({3:x,7:y,11:z}.get(i,n) for i,n in enumerate(moved))
        world[index]=out
        for child in node.get('children',[]):
            visit(child,out)
    identity = matrix((0,0,0,1),(0,0,0))
    for root in doc['scenes'][0]['nodes']:
        visit(root,identity)
    return [multiply(world[index],transpose(bind)) for index,bind in zip(skin['joints'],inverse)]


def blend(point, ids, weights, joints, w):
    result = [0.,0.,0.]
    for index,weight in zip(ids,weights):
        if weight > 0:
            for axis,value in enumerate(transform(joints[index],point,w)):
                result[axis] += value*weight
    return result


TEXTURE_LIMITS = {'skin_albedo': 1536, 'skin_normal': 768, 'eye': 384, 'eyebrow': 256,
                  'eyelash': 256, 'hair_short04': 512, 'cloth_shoes_albedo': 640}


def texture_bytes(image, data):
    limit = TEXTURE_LIMITS.get(image.get('name'))
    if not limit:
        return data
    with Image.open(io.BytesIO(data)) as photo:
        if max(photo.size) <= limit:
            return data
        photo.thumbnail((limit,limit),Image.Resampling.LANCZOS)
        result = io.BytesIO()
        if image['mimeType'] == 'image/png':
            photo.save(result,format='PNG',optimize=True)
        else:
            # Keep chroma detail on normals and the face.
            photo.save(result,format='JPEG',quality=87,optimize=True,subsampling=0)
        return result.getvalue()


def build(directory, output, parts=PARTS):
    binary = bytearray()
    doc = {'asset':{'version':'2.0','generator':'Our Souls runway actor'},
           'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],
           'accessors':[],'bufferViews':[],'buffers':[],
           'materials':[],'textures':[],'images':[],'samplers':[]}

    def append_view(data,target=None):
        binary.extend(b'\0'*(-len(binary)%4))
        view={'buffer':0,'byteOffset':len(binary),'byteLength':len(data)}
        if target:
            view['target']=target
        doc['bufferViews'].append(view)
        binary.extend(data)
        return len(doc['bufferViews'])-1

    def append_accessor(rows,typ,component,target,bounds=False):
        fmt = struct.Struct('<'+FORMATS[component]*WIDTH[typ])
        record = {'bufferView':append_view(b''.join(fmt.pack(*row) for row in rows),target),
                  'componentType':component,'count':len(rows),'type':typ}
        if bounds:
            axes=list(zip(*rows))
            record['min']=[min(values) for values in axes]
            record['max']=[max(values) for values in axes]
        doc['accessors'].append(record)
        return len(doc['accessors'])-1

    for part in parts:
        source, data = read_glb(directory/(part+'.glb'))
        skin_matrices = posed_joints(source,data)
        materials,textures,images,samplers = {},{},{},{}
        def use_texture(index):
            if index not in textures:
                texture = deepcopy(source['textures'][index])
                image_index = texture['source']
                if image_index not in images:
                    image = deepcopy(source['images'][image_index])
                    view = source['bufferViews'][image['bufferView']]
                    start = view.get('byteOffset',0)
                    image['bufferView'] = append_view(texture_bytes(image,data[start:start+view['byteLength']]))
                    images[image_index] = len(doc['images'])
                    doc['images'].append(image)
                texture['source'] = images[image_index]
                if 'sampler' in texture:
                    sampler=texture['sampler']
                    if sampler not in samplers:
                        samplers[sampler]=len(doc['samplers'])
                        doc['samplers'].append(source['samplers'][sampler])
                    texture['sampler']=samplers[sampler]
                textures[index]=len(doc['textures'])
                doc['textures'].append(texture)
            return textures[index]

        def use_material(index):
            if index not in materials:
                material=deepcopy(source['materials'][index])
                material.pop('extras',None)
                for record in (material,material.get('pbrMetallicRoughness',{})):
                    for name,value in record.items():
                        if name.endswith('Texture') and isinstance(value,dict):
                            value['index']=use_texture(value['index'])
                pbr=material.get('pbrMetallicRoughness',{})
                if part=='clothing_jeans':
                    pbr['baseColorFactor']=[.12,.13,.12,1.]
                if part=='clothing_shoes':
                    pbr['baseColorFactor']=[.26,.23,.19,1.]
                materials[index]=len(doc['materials'])
                doc['materials'].append(material)
            return materials[index]

        for mesh in source['meshes']:
            name=mesh.get('name','')
            if name in ('Teeth','Tongue'):
                continue  # closed-mouth pose
            primitives=[]
            for old in mesh['primitives']:
                attrs=old['attributes']
                positions=read_accessor(source,data,attrs['POSITION'])
                normals=read_accessor(source,data,attrs['NORMAL'])
                texcoords=read_accessor(source,data,attrs['TEXCOORD_0'])
                joints=read_accessor(source,data,attrs['JOINTS_0'])
                weights=read_accessor(source,data,attrs['WEIGHTS_0'])
                indices=[row[0] for row in read_accessor(source,data,old['indices'])]
                if name=='base':
                    zones=[int(row[0]) for row in read_accessor(source,data,attrs['_CCZONE'])]
                    covered=1|2|4|8
                    indices=[vertex for i in range(0,len(indices),3)
                             if not all(zones[v]&covered for v in indices[i:i+3])
                             for vertex in indices[i:i+3]]
                used=sorted(set(indices))
                remap={old_index:new_index for new_index,old_index in enumerate(used)}
                posed,normal=[],[]
                for i in used:
                    x,y,z=blend(positions[i],joints[i],weights[i],skin_matrices,1)
                    posed.append((x*HEIGHT_SCALE,(y+.0023)*HEIGHT_SCALE,(z-.045)*HEIGHT_SCALE))
                    vector=blend(normals[i],joints[i],weights[i],skin_matrices,0)
                    magnitude=math.sqrt(sum(x*x for x in vector)) or 1.
                    normal.append(tuple(x/magnitude for x in vector))
                primitives.append({
                    'attributes':{'POSITION':append_accessor(posed,'VEC3',5126,34962,True),
                                  'NORMAL':append_accessor(normal,'VEC3',5126,34962),
                                  'TEXCOORD_0':append_accessor([texcoords[i] for i in used],'VEC2',5126,34962)},
                    'indices':append_accessor([(remap[i],) for i in indices],'SCALAR',5123,34963),
                    'material':use_material(old['material']),
                })
            doc['scenes'][0]['nodes'].append(len(doc['nodes']))
            doc['nodes'].append({'mesh':len(doc['meshes']),'name':name})
            doc['meshes'].append({'name':name,'primitives':primitives})

    binary.extend(b'\0'*(-len(binary)%4))
    doc['buffers']=[{'byteLength':len(binary)}]
    manifest=json.dumps(doc,separators=(',',':')).encode()
    manifest+=b' '*(-len(manifest)%4)
    output.write_bytes(struct.pack('<5I',0x46546c67,2,28+len(manifest)+len(binary),len(manifest),0x4e4f534a)
                       +manifest+struct.pack('<2I',len(binary),0x004e4942)+binary)
    print(f'{output.name}: {len(binary):,} bytes of mesh and texture data')


if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    build(Path(sys.argv[1]),root/'static/runway/models/runway-human.glb')
