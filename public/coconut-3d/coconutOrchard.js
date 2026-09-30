import * as T from 'three';

export function createCoconutOrchard() {
  const orchard = new T.Group();
  orchard.name = 'orchard';
  const soil = new T.MeshStandardMaterial({ roughness: 1 });
  const grass = new T.MeshStandardMaterial({ roughness: 0.95 });
  // ponytail: stylized water, no reflection render pass; add only for close-up water views.
  const water = new T.MeshStandardMaterial({
    roughness: 0.24,
    metalness: 0.32,
  });
  const bark = new T.MeshStandardMaterial({ roughness: 1 });
  const green = new T.MeshStandardMaterial({
    roughness: 0.9,
    side: T.DoubleSide,
  });
  const fruit = new T.MeshStandardMaterial({ roughness: 0.85 });
  const ripple = new T.MeshBasicMaterial({
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  function instances(name, geometry, material, transforms) {
    const object = new T.InstancedMesh(geometry, material, transforms.length);
    object.name = name;
    const pose = new T.Object3D();
    transforms.forEach(
      ({ position, scale = [1, 1, 1], rotation = [0, 0, 0] }, i) => {
        pose.position.set(...position);
        pose.scale.set(...scale);
        pose.rotation.set(...rotation);
        pose.updateMatrix();
        object.setMatrixAt(i, pose.matrix);
      }
    );
    object.receiveShadow = true;
    orchard.add(object);
  }
  const rows = [-16, -8, 0, 8, 16];
  instances(
    'raised-beds',
    new T.BoxGeometry(5.2, 0.65, 37),
    soil,
    rows.map((x) => ({ position: [x, 0.24, -24.5] }))
  );
  instances(
    'grassy-beds',
    new T.BoxGeometry(4.8, 0.12, 36.6),
    grass,
    rows.map((x) => ({ position: [x, 0.61, -24.5] }))
  );
  const canals = [-12, -4, 4, 12];
  instances(
    'canal-water',
    new T.PlaneGeometry(2.8, 37),
    water,
    canals.map((x) => ({
      position: [x, -0.02, -24.5],
      rotation: [-Math.PI / 2, 0, 0],
    }))
  );
  const ripples = [];
  canals.forEach((x) => {
    for (let i = 0; i < 22; i++)
      ripples.push({
        position: [x + Math.sin(i * 2) * 0.5, -0.012, -7 - i * 1.6],
        scale: [0.5 + (i % 3) * 0.25, 1, 1],
        rotation: [-Math.PI / 2, 0, 0.12],
      });
  });
  instances('water-ripples', new T.PlaneGeometry(1.5, 0.035), ripple, ripples);

  // One feathered frond silhouette shared by every background palm.
  const outline = new T.Shape();
  outline.moveTo(0, 0);
  for (const side of [1, -1]) {
    for (let j = 0; j <= 24; j++) {
      const t = side === 1 ? j / 24 : 1 - j / 24;
      const width = Math.sin(t * Math.PI) * (j % 2 ? 0.43 : 0.1);
      outline.lineTo(t * 3.2, side * width);
    }
  }
  outline.closePath();
  const frond = new T.ShapeGeometry(outline);
  frond.rotateX(-Math.PI / 2);
  const vertices = frond.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const t = vertices.getX(i) / 3.2;
    vertices.setY(i, Math.sin(t * Math.PI) * 0.65 - t * t * 0.85);
  }
  frond.computeVertexNormals();
  const trunks = [],
    leaves = [],
    fruits = [];
  rows.forEach((x, row) => {
    for (let i = 0; i < 5; i++) {
      const z = -10 - i * 7;
      const height = 4.1 + ((row * 3 + i) % 5) * 0.28;
      trunks.push({
        position: [x, 0.67 + height / 2, z],
        scale: [1, height, 1],
      });
      for (let j = 0; j < 8; j++)
        leaves.push({
          position: [x, height + 0.67, z],
          rotation: [0, (j * Math.PI) / 4 + i * 0.37, 0],
          scale: [0.85 + (j % 3) * 0.09, 1, 1],
        });
      for (let j = 0; j < 3; j++)
        fruits.push({
          position: [
            x + Math.cos(j * 2.1) * 0.24,
            height + 0.35,
            z + Math.sin(j * 2.1) * 0.24,
          ],
          scale: [0.19, 0.24, 0.19],
        });
    }
  });
  instances(
    'orchard-trunks',
    new T.CylinderGeometry(0.12, 0.24, 1, 6),
    bark,
    trunks
  );
  instances('orchard-fronds', frond, green, leaves);
  instances('orchard-fruits', new T.SphereGeometry(1, 6, 4), fruit, fruits);
  function setMode(mode) {
    const colors =
      mode === 'night'
        ? [
            '#4e493a',
            '#354e3b',
            '#25495c',
            '#665b4c',
            '#3c634c',
            '#71844c',
            '#9ebbd0',
          ]
        : [
            '#957450',
            '#729353',
            '#568e8b',
            '#a08b69',
            '#608842',
            '#a4b963',
            '#e2eee0',
          ];
    [soil, grass, water, bark, green, fruit, ripple].forEach((material, i) =>
      material.color.set(colors[i])
    );
  }
  setMode('day');
  return { orchard, setMode };
}
