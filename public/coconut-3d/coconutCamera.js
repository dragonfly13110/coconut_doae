// Screen-space pan follows the camera orientation at any orbit angle.
export function panCamera(camera, target, distance, height, dx, dy) {
  const scale =
    (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / height;
  const basis = camera.matrixWorld.elements;
  target.x += (-dx * basis[0] + dy * basis[4]) * scale;
  target.y += (-dx * basis[1] + dy * basis[5]) * scale;
  target.z += (-dx * basis[2] + dy * basis[6]) * scale;
}
