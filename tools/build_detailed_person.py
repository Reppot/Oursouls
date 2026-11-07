"""Prepare a detailed fitting-only person, without increasing runway cost."""
import json
from pathlib import Path
import struct
import sys

import build_runway_actor as baker
from build_fitting_outfits import subdivide

FACE = {'face_eye_size_decr':.12,'face_jaw_width_incr':.16,
        'face_chin_incr':.10,'face_cheekbones_incr':.12,
        'face_nose_width_incr':.08,'face_lips_decr':.08}


def main(source,output):
    baker.TEXTURE_LIMITS.update(skin_albedo=2048,skin_normal=1024,eye=1024,
        eyebrow=512,eyelash=512,hair_short04=1024)
    baker.build(source,output,parts=('base_body','clothing_jeans','clothing_shoes','hair_short04'),morph_weights=FACE)
    doc,data=baker.read_glb(output); binary=bytearray(data)
    def accessor(rows,kind,bounds=False):
        binary.extend(b'\0'*(-len(binary)%4)); typ='SCALAR' if kind=='H' else ('VEC2' if len(rows[0])==2 else 'VEC3')
        encoded=b''.join(struct.pack('<'+kind*len(row),*row) for row in rows)
        view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(encoded)})
        binary.extend(encoded);a={'bufferView':view,'componentType':5123 if kind=='H' else 5126,'count':len(rows),'type':typ}
        if bounds:a.update(min=[min(p[k] for p in rows) for k in range(3)],max=[max(p[k] for p in rows) for k in range(3)])
        doc['accessors'].append(a);return len(doc['accessors'])-1
    triangles=0
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            if mesh['name'] not in ('base','Hair_short04'):
                triangles+=doc['accessors'][p['indices']]['count']//3;continue
            a=p['attributes'];positions=baker.read_accessor(doc,data,a['POSITION'])
            uv=baker.read_accessor(doc,data,a['TEXCOORD_0']);indices=[r[0] for r in baker.read_accessor(doc,data,p['indices'])]
            positions,normals,uv,indices=subdivide(positions,uv,indices)
            # The skin must stay aligned with the fitted clothes; the garment
            # builder's outward textile clearance is unnecessary on the body.
            positions=[tuple(p[k]-.002*n[k] for k in range(3)) for p,n in zip(positions,normals)]
            assert len(positions)<65536
            p['attributes']={'POSITION':accessor(positions,'f',True),'NORMAL':accessor(normals,'f'),'TEXCOORD_0':accessor(uv,'f')}
            p['indices']=accessor([(i,) for i in indices],'H');triangles+=len(indices)//3
            print(mesh['name'],len(positions),'vertices',len(indices)//3,'triangles')
    binary.extend(b'\0'*(-len(binary)%4));doc['buffers']=[{'byteLength':len(binary)}]
    manifest=json.dumps(doc,separators=(',',':')).encode();manifest+=b' '*(-len(manifest)%4)
    output.write_bytes(struct.pack('<5I',0x46546c67,2,28+len(manifest)+len(binary),len(manifest),0x4e4f534a)+manifest+struct.pack('<2I',len(binary),0x004e4942)+binary)
    print('Total',triangles,'triangles;',output.stat().st_size,'bytes')


if __name__=='__main__':
    main(Path(sys.argv[1]),Path(__file__).resolve().parents[1]/'static/fitting/person-detail.glb')
