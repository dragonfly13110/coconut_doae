export function createCoconutHarvest(T, crown, bunches) {
  const templates = bunches.map((bunch) => bunch.clone(true));
  const ground = new T.Group();
  ground.name = 'harvested-bunches';
  const harvested = [];
  let nextId = 10;
  let needsGrowth = false;
  bunches.forEach((bunch, i) => (bunch.userData.cohort = i + 1));

  function setCount(bunch, value) {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > 13) {
      throw new RangeError('กรอกจำนวนเต็ม 1–13 ลูก');
    }
    const fruits = bunch.children.filter(
      (part) => part.name === 'coconut-fruit'
    );
    if (fruits.length !== 13) throw new Error('ทลายนี้ยังไม่พร้อมเก็บเกี่ยว');
    fruits.forEach((fruit, i) => (fruit.visible = i < count));
    bunch.userData.fruitCount = count;
    return count;
  }

  function placeOnGround(bunch, index) {
    // Use visible geometry so a reduced bunch rests on the ground too.
    bunch.rotation.set(Math.PI / 2, 0, -0.35);
    bunch.position.set(0, 0, 0);
    bunch.updateMatrixWorld(true);
    const bounds = new T.Box3();
    bunch.traverseVisible((part) => {
      if (!part.isMesh) return;
      bounds.union(new T.Box3().setFromObject(part, true));
    });
    const center = bounds.getCenter(new T.Vector3());
    bunch.position.set(
      4 + (index % 4) * 3.2 - center.x,
      -0.065 - bounds.min.y,
      1.8 + Math.floor(index / 4) * 3.2 - center.z
    );
    bunch.updateMatrixWorld(true);
  }

  function cut(value) {
    if (needsGrowth) throw new Error('จำลองเติบโตรอบถัดไปก่อนตัด');
    const bunch = bunches[0];
    setCount(bunch, value);
    bunches.shift();
    ground.add(bunch);
    harvested.push(bunch);
    placeOnGround(bunch, harvested.length - 1);
    needsGrowth = true;
    return bunch;
  }

  function grow() {
    if (!needsGrowth) return false;
    bunches.forEach((bunch, i) => {
      const nextStage = templates[i].clone(true);
      bunch.clear();
      while (nextStage.children.length) bunch.add(nextStage.children[0]);
      bunch.position.copy(nextStage.position);
      bunch.rotation.copy(nextStage.rotation);
    });
    const young = templates[8].clone(true);
    young.userData.cohort = nextId++;
    crown.add(young);
    bunches.push(young);
    needsGrowth = false;
    return true;
  }

  function update(index, value) {
    const bunch = harvested[index];
    setCount(bunch, value);
    placeOnGround(bunch, index);
  }

  return {
    reset() {
      bunches.forEach((bunch) => crown.remove(bunch));
      ground.clear();
      harvested.length = 0;
      bunches.length = 0;
      templates.forEach((template, i) => {
        const bunch = template.clone(true);
        bunch.userData.cohort = i + 1;
        crown.add(bunch);
        bunches.push(bunch);
      });
      nextId = 10;
      needsGrowth = false;
    },
    ground,
    harvested,
    cut,
    grow,
    update,
    get needsGrowth() {
      return needsGrowth;
    },
  };
}
