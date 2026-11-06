import * as T from './three/three.module.min.js';

const TAU = Math.PI * 2;
const SLICES = 128;
const ROWS = 64;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
const signedPow = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);
const V = (x, y, z) => new T.Vector3(x, y, z);

const styles = {
    tee: { width: .59, depth: .245, length: 1, sleeveX: .47, sleeveY: .28, cuff: .178, neck: .235, rib: .025 },
    long: { width: .585, depth: .25, length: 1.04, sleeveX: .47, sleeveY: 1.28, cuff: .103, neck: .222, rib: .062 },
    hoodie: { width: .635, depth: .283, length: 1.02, sleeveX: .49, sleeveY: 1.25, cuff: .111, neck: .248, rib: .117 },
};

function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

const gaussian = x => Math.exp(-x * x);
const crease = x => gaussian(x) - .57 * gaussian((x - 1.3) / 1.2);
const lengthwiseFolds = [
    [-.82, .028, .16, .26, .36, .39],
    [-.46, -.020, .135, -.34, .43, .32],
    [.38, .024, .13, -.32, .26, .34],
    [.95, .032, .16, .22, .53, .40],
    [2.65, .033, .17, .27, .33, .45],
    [-2.58, -.026, .15, -.31, .42, .42],
    [-1.94, .023, .19, .28, .45, .31]
];

function bodyPoint(spec, t, a) {
    const sin = Math.sin(a), cos = Math.cos(a);
    const hem = .023 * Math.sin(a * 3 + .37) + .010 * Math.sin(a * 7 + .8);
    const relaxed = .016 * Math.sin(t * Math.PI * 1.8) - .025 * gaussian((t - .39) / .24);
    const w = spec.width + relaxed + .012 * smooth((t - .55) / .25);
    const depth = spec.depth * (1 + .10 * Math.sin(t * Math.PI) - .11 * smooth((t - .78) / .22));
    let fold = .004 * Math.cos(a * 9 + t * 4.2) + .003 * Math.sin(a * 13 - t * 3.1);

    // Long folds widen as they fall. Shorter diagonal creases radiate from the armholes.
    for (const [theta, strength, spread, drift, height, extent] of lengthwiseFolds) {
        const offset = wrapAngle(a - theta - drift * Math.sin(t * 3.1));
        fold += strength * crease(offset / (spread * (1.16 - .29 * t))) * gaussian((t - height) / extent);
    }
    const nearArm = Math.abs(sin);
    const diagonal = t - (.57 + .17 * nearArm + .025 * sin);
    fold += .029 * crease(diagonal / .042) * smooth((nearArm - .35) / .53);
    fold -= .018 * crease((diagonal + .107) / .049) * smooth((nearArm - .52) / .46);
    const lower = t - (.155 + .04 * Math.sin(a * 2.6) - .026 * Math.cos(a * 4));
    fold += .026 * crease(lower / .047) * (.38 + .62 * Math.pow(Math.abs(sin), 1.4));
    fold *= 1 - .86 * smooth((t - .82) / .18);

    const shoulder = .575 + .229 * Math.pow(Math.abs(sin), 1.55) + .067 * Math.pow(Math.max(-cos, 0), 1.45);
    const y = lerp(-spec.length + hem, shoulder, t);
    return V((w + fold * .48) * signedPow(sin, .69), y, (depth + fold) * signedPow(cos, .78));
}

function neckPoint(spec, a) {
    const c = Math.cos(a);
    return V(spec.neck * Math.sin(a), .855 - .228 * Math.pow(Math.max(c, 0), 1.42), (c > 0 ? spec.depth * .91 : .158) * c);
}

function meshOf(points, groups, material) {
    const geometry = new T.BufferGeometry();
    const positions = [], uvs = [];
    points.forEach(p => { positions.push(p.x, p.y, p.z); uvs.push(p.x * .62 + p.z * .22, p.y * .62 + p.z * .15); });
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    const indices = [];
    groups.forEach((faces, i) => { geometry.addGroup(indices.length, faces.length, i); for (const index of faces) indices.push(index); });
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function join(a, b, out, reverse = false) {
    for (let k = 0; k < a.length; k++) {
        const n = (k + 1) % a.length;
        if (reverse) out.push(a[k], b[n], a[n], a[k], b[k], b[n]);
        else out.push(a[k], a[n], b[n], a[k], b[n], b[k]);
    }
}

function seam(points, radius, material, closed = false) {
    const path = new T.CatmullRomCurve3(points, closed, 'centripetal');
    const mesh = new T.Mesh(new T.TubeGeometry(path, Math.max(20, points.length * 2), radius, 6, closed), material);
    mesh.receiveShadow = true;
    return mesh;
}

function sleeve(points, socket, spec, sign, kind, cloth, rib, group, materials) {
    const root = socket.map(i => points[i]);
    const center = root.reduce((p, v) => p.add(v), V(0, 0, 0)).multiplyScalar(1 / root.length);
    const advance = V(sign * spec.sleeveX, -spec.sleeveY, .01);
    const up = V(sign * spec.sleeveY, spec.sleeveX, 0).normalize();
    const theta = root.map(p => {
        const d = p.clone().sub(center);
        return Math.atan2(d.z / .184, d.dot(up) / .255);
    });
    const pos = (a, t, inside = false) => {
        const w = lerp(kind === 'hoodie' ? .262 : .232, spec.cuff, Math.pow(t, .82));
        const compression = kind === 'tee' ? .36 : .54;
        const underside = .32 + .68 * (1 - Math.cos(a)) / 2;
        const elbow = crease((t - compression - .065 * Math.sin(a + sign * .4)) / .058);
        const cuffFold = crease((t - .8 - .054 * Math.cos(a)) / .056);
        const gather = .014 * Math.sin(a * 5 + t * 8) + .009 * Math.cos(a * 8 - t * 4);
        const folds = (gather + .021 * elbow * underside + .016 * cuffFold * underside) * smooth(t / .35);
        const shape = 1 + .034 * Math.sin(a * 3 + t * 5);
        const taper = t > .89 && kind !== 'tee' ? lerp(1, .9, smooth((t - .89) / .11)) : 1;
        const r = ((w * shape + folds) * taper - (inside ? .016 : 0));
        return center.clone().addScaledVector(advance, t - (inside ? .034 : 0))
            .add(V(sign * .048 * Math.sin(t * Math.PI), 0, .016 * Math.sin(t * 5)))
            .addScaledVector(up, Math.cos(a) * r).add(V(0, 0, Math.sin(a) * r * .84));
    };
    let last = socket;
    const segments = 38;
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const next = theta.map((a, k) => {
            const target = pos(a, t);
            if (t < .28) target.lerp(root[k].clone().addScaledVector(advance, t), 1 - smooth(t / .28));
            points.push(target);
            return points.length - 1;
        });
        join(last, next, t > (kind === 'tee' ? .955 : .90) ? rib : cloth);
        last = next;
    }
    const inner = theta.map(a => { points.push(pos(a, 1, true)); return points.length - 1; });
    join(last, inner, rib);
    const tSeam = kind === 'tee' ? .946 : .895;
    group.add(seam(theta.map(a => pos(a, tSeam)), .005, materials.stitch, true));
}

function hood(group, materials) {
    const points = [], faces = [], rings = [];
    const n = 80, depth = 30;
    const p = (a, t) => {
        const shrink = Math.cos(t), travel = Math.sin(t);
        const c = Math.cos(a), s = Math.sin(a);
        const edge = .265 + .065 * (1 - c) / 2 - .032 * Math.abs(s);
        const width = .393 * (1 - .22 * Math.pow(Math.max(-c, 0), 1.6));
        return V(width * s * shrink * (1 + .038 * Math.cos(a * 3 + t * 2)),
            1.092 - .084 * travel + .449 * c * shrink,
            edge - .624 * travel + .026 * Math.cos(a * 4 + t * 5) * shrink * travel);
    };
    for (let j = 0; j <= depth; j++) {
        const t = j / depth * (Math.PI / 2 - .006);
        const ring = Array.from({ length: n }, (_, i) => { points.push(p(i * TAU / n, t)); return points.length - 1; });
        if (j) join(rings[j - 1], ring, faces);
        rings.push(ring);
    }
    const tip = points.length;
    points.push(V(0, 1.008, -.35));
    rings.at(-1).forEach((i, k, ring) => faces.push(i, ring[(k + 1) % n], tip));
    const mesh = meshOf(points, [faces], materials.hood);
    mesh.name = 'hood shell';
    group.add(mesh);
    const opening = Array.from({ length: 48 }, (_, k) => p(k * TAU / 48, 0));
    group.add(seam(opening, .015, materials.rib, true));
    group.add(seam(Array.from({ length: 18 }, (_, k) => p(0, k * 1.52 / 17).add(V(0, .002, 0))), .005, materials.stitch));
    for (const sign of [-1, 1]) {
        const eyelet = new T.Mesh(new T.TorusGeometry(.020, .0045, 8, 24), materials.hardware);
        eyelet.position.set(.112 * sign, .643, .331);
        eyelet.castShadow = true;
        group.add(eyelet);
        const endY = sign === -1 ? .103 : .182;
        const cord = seam([V(sign * .112, .645, .341), V(sign * .109, .561, .365), V(sign * .082, .418, .340), V(sign * .112, .287, .332), V(sign * .128, endY, .327)], .010, materials.cord);
        cord.name = 'drawstring'; cord.castShadow = true;
        group.add(cord);
        const end = new T.Mesh(new T.CylinderGeometry(.012, .012, .045, 10), materials.hardware);
        end.position.set(sign * .128, endY - .014, .327);
        end.rotation.z = sign * .09;
        end.castShadow = true;
        group.add(end);
    }
}

function pocket(group, spec, materials) {
    const pts = [], faces = [], nx = 30, ny = 16;
    const surf = (u, t) => {
        const w = lerp(.247, .414, smooth(t));
        const x = u * w;
        const y = lerp(-.235, -.745, t) + .02 * u * u;
        let low = -Math.PI / 2, high = Math.PI / 2, body;
        for (let step = 0; step < 12; step++) {
            const a = (low + high) / 2;
            const bottom = bodyPoint(spec, 0, a).y, top = bodyPoint(spec, 1, a).y;
            body = bodyPoint(spec, (y - bottom) / (top - bottom), a);
            if (body.x < x) low = a;
            else high = a;
        }
        return V(x, y, body.z + .018 + .033 * Math.sin(t * Math.PI) * (1 - .48 * u * u));
    };
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) pts.push(surf(i / nx * 2 - 1, j / ny));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * (nx + 1) + i, l = k + nx + 1;
        faces.push(k, l, l + 1, k, l + 1, k + 1);
    }
    const mesh = meshOf(pts, [faces], materials.pocket);
    mesh.name = 'kangaroo pocket'; group.add(mesh);
    for (const sign of [-1, 1]) group.add(seam(Array.from({ length: 15 }, (_, i) => surf(sign * .985, i / 14).add(V(0, 0, .003))), .007, materials.stitch));
    for (const t of [.018, .978]) group.add(seam(Array.from({ length: 18 }, (_, i) => surf(i / 17 * 1.98 - .99, t).add(V(0, 0, .003))), .0045, materials.stitch));
}

export function createGarment(kind, materials) {
    const spec = styles[kind];
    if (!spec) throw new Error('Unknown garment');
    const group = new T.Group(); group.name = kind;
    const points = [], cloth = [], rib = [], grid = [];
    const sockets = [SLICES / 4, SLICES * 3 / 4].map(center => ({ lo: center - 12, hi: center + 12, bottom: 41, top: ROWS }));
    for (let j = 0; j <= ROWS; j++) {
        grid.push(Array.from({ length: SLICES }, (_, i) => {
            points.push(bodyPoint(spec, j / ROWS, i * TAU / SLICES)); return points.length - 1;
        }));
    }
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < SLICES; i++) {
        if (sockets.some(s => j >= s.bottom && j < s.top && i >= s.lo && i < s.hi)) continue;
        const n = (i + 1) % SLICES;
        const out = j / ROWS < spec.rib / 1.65 ? rib : cloth;
        out.push(grid[j][i], grid[j][n], grid[j+1][n], grid[j][i], grid[j+1][n], grid[j+1][i]);
    }
    sockets.forEach((s, i) => {
        const edge = [];
        for (let k = s.lo; k < s.hi; k++) edge.push(grid[s.bottom][k]);
        for (let j = s.bottom; j < s.top; j++) edge.push(grid[j][s.hi]);
        for (let k = s.hi; k > s.lo; k--) edge.push(grid[s.top][k]);
        for (let j = s.top; j > s.bottom; j--) edge.push(grid[j][s.lo]);
        sleeve(points, edge, spec, i === 0 ? 1 : -1, kind, cloth, rib, group, materials);
    });
    let ring = grid[ROWS];
    for (let j = 1; j <= 20; j++) {
        const t = j / 20;
        const next = Array.from({ length: SLICES }, (_, i) => {
            const a = i * TAU / SLICES;
            const base = bodyPoint(spec, 1, a), neck = neckPoint(spec, a);
            const p = base.clone().lerp(neck, t * t * (2 - t));
            p.y = lerp(base.y, neck.y, t) + .032 * Math.sin(t * Math.PI) * (.44 + .56 * Math.abs(Math.sin(a)));
            p.y += .008 * Math.sin(a * 3.0 + .45) * Math.sin(t * Math.PI);
            points.push(p); return points.length - 1;
        });
        join(ring, next, j >= 18 ? rib : cloth);
        ring = next;
    }
    const neck = ring.map(i => points[i]);
    const insideNeck = neck.map(p => { points.push(V(p.x * .953, p.y - .032, p.z * .953)); return points.length - 1; });
    join(ring, insideNeck, rib);
    const insideHem = grid[0].map(i => { const p = points[i]; points.push(V(p.x * .969, p.y + .041, p.z * .933)); return points.length - 1; });
    join(grid[0], insideHem, rib, true);
    const fabric = meshOf(points, [cloth, rib], [materials.fabric, materials.rib]);
    fabric.name = 'printable cloth';
    // Ridges shade through their normals. Only seams and trim need to cast onto the cloth.
    fabric.castShadow = false;
    group.add(fabric);
    group.add(seam(neck.filter((_, i) => i % 2 === 0), .0055, materials.stitch, true));
    group.add(seam(Array.from({length: 48}, (_, i) => bodyPoint(spec, spec.rib / 1.65 + .01, i * TAU / 48)), .005, materials.stitch, true));
    if (kind === 'hoodie') { hood(group, materials); pocket(group, spec, materials); }
    return { group, fabric, center: kind === 'hoodie' ? .216 : -.058, span: kind === 'hoodie' ? 3.05 : 2.46 };
}
