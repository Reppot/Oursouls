"""Bake matching CC0 garments and smooth their silhouettes for the fitting view.

Uses the same skeleton/pose as the existing runway person. No runtime skinning
or external decoder is required. The long sleeve is the source hoodie body,
without its separately generated, disconnected hood.
"""
from collections import defaultdict
from copy import deepcopy
import json
import math
from pathlib import Path
import struct
import sys

from build_runway_actor import build, read_glb, read_accessor


def subdivide(positions, uvs, indices):
    # Weld positions for Loop weights, but keep UV seam vertices distinct.
    weld = {}
    ids = []
    unique = []
    for p in positions:
        key = tuple(round(x, 5) for x in p)
        if key not in weld:
            weld[key] = len(unique)
            unique.append(p)
        ids.append(weld[key])
    edges = defaultdict(list)
    neighbours = defaultdict(set)
    for a, b, c in zip(indices[::3], indices[1::3], indices[2::3]):
        a, b, c = ids[a], ids[b], ids[c]
        for x, y, z in ((a,b,c),(b,c,a),(c,a,b)):
            edges[tuple(sorted((x,y)))].append(z)
            neighbours[x].add(y); neighbours[y].add(x)
    boundary = defaultdict(set)
    for (a,b), opposite in edges.items():
        if len(opposite) == 1:
            boundary[a].add(b); boundary[b].add(a)
    moved = []
    for i,p in enumerate(unique):
        if len(boundary[i]) == 2:
            others = boundary[i]
            result = [p[k]*.75 + sum(unique[j][k] for j in others)*.125 for k in range(3)]
        else:
            others = neighbours[i]; n = len(others)
            beta = (5/8-(3/8+math.cos(2*math.pi/n)/4)**2)/n if n else 0
            result = [p[k]*(1-n*beta) + beta*sum(unique[j][k] for j in others) for k in range(3)]
        moved.append(result)
    out = [moved[i] for i in ids]
    tex = list(uvs)
    mids = {}
    def midpoint(a,b):
        key = tuple(sorted((a,b)))
        if key not in mids:
            x,y = ids[a],ids[b]
            opposite = edges[tuple(sorted((x,y)))]
            if len(opposite)==2:
                p = [(unique[x][k]+unique[y][k])*.375 + sum(unique[z][k] for z in opposite)*.125 for k in range(3)]
            else:
                p = [(unique[x][k]+unique[y][k])*.5 for k in range(3)]
            mids[key] = len(out); out.append(p)
            tex.append(tuple((uvs[a][k]+uvs[b][k])*.5 for k in range(2)))
        return mids[key]
    triangles = []
    for a,b,c in zip(indices[::3],indices[1::3],indices[2::3]):
        ab,bc,ca = midpoint(a,b),midpoint(b,c),midpoint(c,a)
        triangles += [a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca]
    normal_sum = defaultdict(lambda:[0.,0.,0.])
    keys = [tuple(round(x,6) for x in p) for p in out]
    for a,b,c in zip(triangles[::3],triangles[1::3],triangles[2::3]):
        u = [out[b][k]-out[a][k] for k in range(3)]
        v = [out[c][k]-out[a][k] for k in range(3)]
        cross = (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        for i in (a,b,c):
            for k in range(3): normal_sum[keys[i]][k] += cross[k]
    normals=[]
    for i,p in enumerate(out):
        n=normal_sum[keys[i]]; length=math.sqrt(sum(x*x for x in n)) or 1
        normal=tuple(x/length for x in n); normals.append(normal)
        out[i]=tuple(p[k]+normal[k]*.002 for k in range(3))
    return out, normals, tex, triangles


def main(source, output):
    build(source,output,parts=('clothing_tshirt','clothing_hoodie'))
    doc, data = read_glb(output)
    binary=bytearray(data)
    def accessor(rows, typ, component, bounds=False):
        binary.extend(b'\0'*(-len(binary)%4))
        code = 'f' if component==5126 else 'H'
        encoded=b''.join(struct.pack('<'+code*len(row),*row) for row in rows)
        view=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(encoded)})
        binary.extend(encoded)
        a={'bufferView':view,'componentType':component,'count':len(rows),'type':typ}
        if bounds:a.update(min=[min(r[k] for r in rows) for k in range(3)],max=[max(r[k] for r in rows) for k in range(3)])
        doc['accessors'].append(a)
        return len(doc['accessors'])-1
    raw=deepcopy(doc['meshes'])
    hoodie=deepcopy(raw[1]); hoodie['name']='Cloth_longsleeve'
    long=hoodie['primitives'][0]
    old=raw[1]['primitives'][0]
    count=doc['accessors'][old['attributes']['POSITION']]['count']
    assert count==1793, 'Pinned hoodie topology has changed; inspect hood boundaries.'
    hood_start=count-429
    long['long_indices']=[i for a,b,c in zip(*[iter([r[0] for r in read_accessor(doc,data,old['indices'])])]*3)
                          if max(a,b,c)<hood_start for i in (a,b,c)]
    raw.append(hoodie)
    doc['meshes']=[];doc['nodes']=[];doc['scenes']=[{'nodes':[]}]
    for mesh in raw:
        p=mesh['primitives'][0]; attrs=p['attributes']
        positions=read_accessor(doc,data,attrs['POSITION']);uv=read_accessor(doc,data,attrs['TEXCOORD_0'])
        indices=p.pop('long_indices',None)
        if indices is None:indices=[r[0] for r in read_accessor(doc,data,p['indices'])]
        used=sorted(set(indices)); remap={v:i for i,v in enumerate(used)}
        positions,normals,uv,indices=subdivide([positions[i] for i in used],[uv[i] for i in used],[remap[i] for i in indices])
        assert len(positions)<65536 and all(math.isfinite(v) for row in positions for v in row)
        p['attributes']={'POSITION':accessor(positions,'VEC3',5126,True),'NORMAL':accessor(normals,'VEC3',5126),'TEXCOORD_0':accessor(uv,'VEC2',5126)}
        p['indices']=accessor([(i,) for i in indices],'SCALAR',5123)
        index=len(doc['meshes']);doc['meshes'].append(mesh);doc['nodes'].append({'mesh':index,'name':mesh['name']});doc['scenes'][0]['nodes'].append(index)
        print(mesh['name'],len(positions),'vertices',len(indices)//3,'triangles')
    binary.extend(b'\0'*(-len(binary)%4)); doc['buffers']=[{'byteLength':len(binary)}]
    manifest=json.dumps(doc,separators=(',',':')).encode();manifest+=b' '*(-len(manifest)%4)
    output.write_bytes(struct.pack('<5I',0x46546c67,2,28+len(manifest)+len(binary),len(manifest),0x4e4f534a)+manifest+struct.pack('<2I',len(binary),0x004e4942)+binary)


if __name__=='__main__':
    main(Path(sys.argv[1]),Path(__file__).resolve().parents[1]/'static/fitting/outfits.glb')
