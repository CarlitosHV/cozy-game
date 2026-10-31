/**
 * Procedural 3D Composite Models for Cozy Parkour World
 * Follows Three.js 3-12 Part Composite Group guidelines with bottom-center pivots
 * and varied PBR roughness/metalness. Zero external dependencies.
 */
import * as THREE from 'three';
import { ProceduralTextures } from './textures';
import { CharacterAppearance, DEFAULT_APPEARANCE } from './character';

export interface PlayerCharacterModel {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  hatPompom: THREE.Mesh;
  scarfTail1: THREE.Mesh;
  scarfTail2: THREE.Mesh;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  lanternPost: THREE.Group;
  lanternCore: THREE.Mesh;
  companionSprite: THREE.Group;
  shadow: THREE.Mesh;
  appearance: CharacterAppearance;
  updateAnimation: (speed: number, isGrounded: boolean, dt: number, windTime: number) => void;
}

/** Darkens/lightens a hex color by a factor (e.g. 0.8 = 20% darker). */
function shade(hex: string, factor: number): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l * factor)));
  return c;
}

export function createPlayerCharacter(
  textures: ProceduralTextures,
  appearance: CharacterAppearance = DEFAULT_APPEARANCE
): PlayerCharacterModel {
  const look = appearance;
  const isChica = look.bodyType === 'chica';
  const group = new THREE.Group();

  // Head-level elements live in their own group so they bob together with the head
  const headGroup = new THREE.Group();
  group.add(headGroup);

  // Materials with varied roughness & PBR richness
  const sweaterMat = new THREE.MeshStandardMaterial({
    color: look.sweaterColor, // knit sweater
    roughness: 0.85,
    metalness: 0.05,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: look.skinColor,
    roughness: 0.55,
    metalness: 0.0,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: look.hairColor,
    roughness: 0.8,
    metalness: 0.05,
  });

  const hatMat = new THREE.MeshStandardMaterial({
    color: look.hatColor,
    roughness: 0.9,
    metalness: 0.0,
  });

  const pompomMat = new THREE.MeshStandardMaterial({
    color: 0xf4f1de, // cozy cream pompom / mittens
    roughness: 0.95,
    metalness: 0.0,
  });

  const scarfMat = new THREE.MeshStandardMaterial({
    color: look.scarfColor,
    roughness: 0.8,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const backpackMat = new THREE.MeshStandardMaterial({
    color: 0x7a4e2d, // rich chestnut leather
    roughness: 0.65,
    metalness: 0.1,
  });

  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x4a2e1b, // dark harness leather
    roughness: 0.7,
    metalness: 0.1,
  });

  const bedrollMat = new THREE.MeshStandardMaterial({
    color: 0x588157, // forest sage rolled sleeping mat
    roughness: 0.8,
    metalness: 0.05,
  });

  const toggleMat = new THREE.MeshStandardMaterial({
    color: 0xcca987, // carved wooden toggle buttons
    roughness: 0.4,
    metalness: 0.15,
  });

  const sockMat = new THREE.MeshStandardMaterial({
    color: 0xf4f1de, // cream wool socks
    roughness: 0.9,
    metalness: 0.0,
  });

  const bootMat = new THREE.MeshStandardMaterial({
    color: look.bootColor,
    roughness: 0.75,
    metalness: 0.1,
  });

  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x1f1915, // rubber traction sole
    roughness: 0.9,
    metalness: 0.05,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xdfb15b,
    roughness: 0.25,
    metalness: 0.85,
  });

  const lanternCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffe29a,
  });

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x1c1714,
    roughness: 0.1,
    metalness: 0.2,
  });

  // 1. Primary: Torso (sweater body)
  const bodyGeom = new THREE.CapsuleGeometry(0.22, 0.28, 8, 16);
  bodyGeom.scale(isChica ? 0.94 : 1.05, 1, 1); // narrower / broader shoulders
  const body = new THREE.Mesh(bodyGeom, sweaterMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  // Secondary outfit color (overall denim, poncho stripes, dress trim, hoodie pocket…)
  const detailMat = new THREE.MeshStandardMaterial({
    color: look.detailColor,
    roughness: 0.8,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const goldButtonMat = new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.3, metalness: 0.7 });

  switch (look.outfitStyle) {
    case 'sudadera': {
      // Hoodie: ribbed hem, kangaroo pocket, drawstrings and a hood resting behind the neck
      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 20), detailMat);
      hem.rotation.x = Math.PI / 2;
      hem.position.y = 0.38;
      group.add(hem);

      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.04), detailMat);
      pocket.position.set(0, 0.47, 0.2);
      pocket.rotation.x = -0.12;
      group.add(pocket);

      const cordMat = new THREE.MeshStandardMaterial({ color: 0xf4f1de, roughness: 0.9 });
      for (const side of [1, -1]) {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.12, 5), cordMat);
        cord.position.set(0.045 * side, 0.69, 0.222);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), cordMat);
        tip.position.set(0.045 * side, 0.625, 0.224);
        group.add(cord, tip);
      }

      const hoodGeom = new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      hoodGeom.scale(1.15, 0.75, 0.75);
      const hood = new THREE.Mesh(hoodGeom, new THREE.MeshStandardMaterial({
        color: look.sweaterColor,
        roughness: 0.85,
        side: THREE.DoubleSide,
      }));
      hood.position.set(0, 0.9, -0.16);
      hood.rotation.x = -0.9;
      hood.castShadow = true;
      group.add(hood);
      break;
    }
    case 'chaqueta': {
      // Explorer jacket: zipper, chest pockets with flaps, contrasting waistband and shoulder patches
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.04, 6, 22), detailMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.38;
      group.add(band);

      const zipperMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.8 });
      const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.34, 0.012), zipperMat);
      zipper.position.set(0, 0.56, 0.222);
      const pull = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.04, 0.012), zipperMat);
      pull.position.set(0, 0.69, 0.232);
      group.add(zipper, pull);

      for (const side of [1, -1]) {
        const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.02), detailMat);
        pocket.position.set(0.095 * side, 0.58, 0.208);
        pocket.rotation.y = 0.35 * side;
        const flap = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.025, 0.025), detailMat);
        flap.position.set(0.097 * side, 0.625, 0.212);
        flap.rotation.y = 0.35 * side;
        const snap = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), zipperMat);
        snap.position.set(0.1 * side, 0.62, 0.228);
        const patch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.1), detailMat);
        patch.position.set(0.215 * side, 0.7, 0);
        group.add(pocket, flap, snap, patch);
      }
      break;
    }
    case 'overol': {
      // Overalls: pants band + bib with straps, pocket and brass buttons over the shirt
      const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.232, 0.24, 0.16, 20), detailMat);
      pants.position.y = 0.42;
      pants.castShadow = true;
      group.add(pants);

      const bib = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.17, 0.04), detailMat);
      bib.position.set(0, 0.56, 0.195);
      group.add(bib);

      const bibPocket = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.06, 0.012),
        new THREE.MeshStandardMaterial({ color: shade(look.detailColor, 0.75), roughness: 0.85 })
      );
      bibPocket.position.set(0, 0.55, 0.218);
      group.add(bibPocket);

      for (const side of [1, -1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.025), detailMat);
        strap.position.set(0.085 * side, 0.7, 0.175);
        strap.rotation.x = -0.35;
        const backStrap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.025), detailMat);
        backStrap.position.set(0.085 * side, 0.6, -0.215);
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), goldButtonMat);
        button.position.set(0.085 * side, 0.635, 0.218);
        group.add(strap, backStrap, button);
      }
      break;
    }
    case 'vestido': {
      // Dress: flared skirt with contrasting trim, waist sash and little buttons
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.34, 0.27, 24, 1, true),
        new THREE.MeshStandardMaterial({ color: look.sweaterColor, roughness: 0.85, side: THREE.DoubleSide })
      );
      skirt.position.y = 0.355;
      skirt.castShadow = true;
      group.add(skirt);

      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.338, 0.016, 6, 32), detailMat);
      trim.rotation.x = Math.PI / 2;
      trim.position.y = 0.225;
      group.add(trim);

      const sash = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.026, 6, 24), detailMat);
      sash.rotation.x = Math.PI / 2;
      sash.position.y = 0.48;
      group.add(sash);

      // Bow on the back of the sash
      for (const side of [1, -1]) {
        const loop = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), detailMat);
        loop.scale.set(1.1, 0.6, 0.4);
        loop.position.set(0.045 * side, 0.48, -0.24);
        group.add(loop);
      }

      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), detailMat);
        b.position.set(0, 0.68 - i * 0.065, 0.218);
        group.add(b);
      }
      break;
    }
    case 'poncho': {
      // Woven poncho: wide 8-sided blanket with two stripes and a fringe
      const TOP_Y = 0.77;
      const H = 0.34;
      const R_TOP = 0.13;
      const R_BOT = 0.38;
      const radiusAt = (t: number) => R_TOP + (R_BOT - R_TOP) * t;
      const ponchoMat = new THREE.MeshStandardMaterial({ color: look.sweaterColor, roughness: 0.9, side: THREE.DoubleSide });
      const poncho = new THREE.Mesh(new THREE.CylinderGeometry(R_TOP, R_BOT, H, 8, 1, true), ponchoMat);
      poncho.position.y = TOP_Y - H / 2;
      poncho.castShadow = true;
      group.add(poncho);

      for (const t of [0.45, 0.75]) {
        const band = 0.06;
        const stripe = new THREE.Mesh(
          new THREE.CylinderGeometry(radiusAt(t - band / 2) + 0.004, radiusAt(t + band / 2) + 0.004, H * band, 8, 1, true),
          detailMat
        );
        stripe.position.y = TOP_Y - H * t;
        group.add(stripe);
      }

      const fringeGeom = new THREE.BoxGeometry(0.018, 0.06, 0.018);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const f = new THREE.Mesh(fringeGeom, detailMat);
        f.position.set(Math.sin(a) * (R_BOT - 0.01), TOP_Y - H - 0.025, Math.cos(a) * (R_BOT - 0.01));
        group.add(f);
      }
      break;
    }
    case 'sueter':
    default: {
      // Sweater bottom ribbed hem ring
      const hemGeom = new THREE.TorusGeometry(0.22, 0.035, 6, 20);
      const hem = new THREE.Mesh(hemGeom, sweaterMat);
      hem.rotation.x = Math.PI / 2;
      hem.position.y = 0.38;
      group.add(hem);

      // Duffle coat wooden toggle buttons (3 wooden toggles with loops down the front)
      for (let i = 0; i < 3; i++) {
        const toggleGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.08, 6);
        const toggle = new THREE.Mesh(toggleGeom, toggleMat);
        toggle.rotation.z = Math.PI / 2;
        toggle.position.set(0, 0.65 - i * 0.09, 0.22);
        group.add(toggle);
      }
      break;
    }
  }

  // 2. Primary: Head (headGroup is the bobbing pivot; head mesh sits at its origin offset)
  const HEAD_Y = 0.95;
  const headGeom = new THREE.SphereGeometry(0.22, 16, 16);
  const head = new THREE.Mesh(headGeom, skinMat);
  head.position.y = HEAD_Y;
  head.castShadow = true;
  group.add(head);

  // Hair cap covering the top/back of the head (visible when no hat or under brims)
  const capGeom = new THREE.SphereGeometry(0.228, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.47);
  const hairCap = new THREE.Mesh(capGeom, hairMat);
  hairCap.position.y = HEAD_Y;
  hairCap.rotation.x = -0.38; // tilt back so the face stays clear
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  // Bangs peeking out at the front (shared by most styles)
  const addBangs = (count: number, length: number, spread: number) => {
    for (let b = 0; b < count; b++) {
      const bangGeom = new THREE.ConeGeometry(0.045, length, 6);
      const bang = new THREE.Mesh(bangGeom, hairMat);
      const angle = (b - (count - 1) / 2) * spread;
      bang.position.set(Math.sin(angle) * 0.18, 1.03, Math.cos(angle) * 0.18);
      bang.rotation.x = 0.45;
      bang.rotation.z = -angle * 0.5;
      headGroup.add(bang);
    }
  };
  const addSideTufts = (length: number) => {
    const leftTuft = new THREE.Mesh(new THREE.ConeGeometry(0.04, length, 6), hairMat);
    leftTuft.position.set(0.21, 0.94, 0.05);
    leftTuft.rotation.z = -0.4;
    const rightTuft = new THREE.Mesh(new THREE.ConeGeometry(0.04, length, 6), hairMat);
    rightTuft.position.set(-0.21, 0.94, 0.05);
    rightTuft.rotation.z = 0.4;
    headGroup.add(leftTuft, rightTuft);
  };

  // Swinging hair pieces (ponytail / pigtails) animated in updateAnimation
  const swingingHair: THREE.Group[] = [];

  switch (look.hairStyle) {
    case 'flequillo': {
      addBangs(5, 0.1, 0.18);
      addSideTufts(0.12);
      break;
    }
    case 'puntas': {
      addBangs(3, 0.13, 0.3);
      // Spiky tufts radiating from the top & back of the head
      const spikeGeom = new THREE.ConeGeometry(0.055, 0.17, 6);
      const spikes: [number, number][] = [
        [0, 0.55], [0.9, 0.6], [-0.9, 0.6], [1.7, 0.75], [-1.7, 0.75],
        [2.5, 0.8], [-2.5, 0.8], [Math.PI, 0.7], [0, 0.15],
      ];
      for (const [yaw, tilt] of spikes) {
        const s = new THREE.Mesh(spikeGeom, hairMat);
        const dir = new THREE.Vector3(Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt) * 0.6 - 0.25).normalize();
        s.position.set(dir.x * 0.22, HEAD_Y + dir.y * 0.22, dir.z * 0.22);
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        headGroup.add(s);
      }
      break;
    }
    case 'coleta': {
      addBangs(5, 0.1, 0.18);
      addSideTufts(0.1);
      const tail = new THREE.Group();
      tail.position.set(0, 1.02, -0.2);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.015, 6, 12), hatMat);
      tie.rotation.x = Math.PI / 2 - 0.5;
      const tailGeom = new THREE.CapsuleGeometry(0.05, 0.2, 6, 10);
      tailGeom.translate(0, -0.13, 0);
      const tailMesh = new THREE.Mesh(tailGeom, hairMat);
      tailMesh.castShadow = true;
      tail.add(tie, tailMesh);
      tail.rotation.x = 0.35;
      headGroup.add(tail);
      swingingHair.push(tail);
      break;
    }
    case 'largo': {
      addBangs(5, 0.11, 0.18);
      // Long flowing curtain down the back and sides
      const backGeom = new THREE.CapsuleGeometry(0.19, 0.2, 8, 16);
      backGeom.scale(1.15, 1, 0.55);
      const back = new THREE.Mesh(backGeom, hairMat);
      back.position.set(0, 0.86, -0.12);
      back.castShadow = true;
      headGroup.add(back);
      const sideGeom = new THREE.CapsuleGeometry(0.045, 0.22, 6, 8);
      const sideL = new THREE.Mesh(sideGeom, hairMat);
      sideL.position.set(0.2, 0.86, 0.02);
      const sideR = new THREE.Mesh(sideGeom, hairMat);
      sideR.position.set(-0.2, 0.86, 0.02);
      headGroup.add(sideL, sideR);
      break;
    }
    case 'rapado': {
      // Short crop: just the cap with a tiny fringe and sideburns
      addBangs(3, 0.05, 0.25);
      addSideTufts(0.06);
      break;
    }
    case 'chongo': {
      // Top bun with a ribbon tie
      addBangs(5, 0.1, 0.18);
      addSideTufts(0.1);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), hairMat);
      bun.position.set(0, 1.16, -0.14);
      bun.castShadow = true;
      const bunTie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 16), hatMat);
      bunTie.position.set(0, 1.11, -0.12);
      bunTie.rotation.x = Math.PI / 2 - 0.6;
      headGroup.add(bun, bunTie);
      break;
    }
    case 'trenzas': {
      addBangs(5, 0.1, 0.18);
      for (const side of [1, -1]) {
        const pig = new THREE.Group();
        pig.position.set(0.21 * side, 1.0, -0.06);
        const tie = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), hatMat);
        const tuftGeom = new THREE.CapsuleGeometry(0.045, 0.14, 6, 8);
        tuftGeom.translate(0, -0.1, 0);
        const tuft = new THREE.Mesh(tuftGeom, hairMat);
        tuft.castShadow = true;
        pig.add(tie, tuft);
        pig.rotation.z = 0.6 * side;
        headGroup.add(pig);
        swingingHair.push(pig);
      }
      break;
    }
  }

  // Ears
  const earGeom = new THREE.SphereGeometry(0.045, 8, 8);
  earGeom.scale(0.5, 1, 0.8);
  const leftEar = new THREE.Mesh(earGeom, skinMat);
  leftEar.position.set(0.22, 0.95, 0);
  const rightEar = new THREE.Mesh(earGeom, skinMat);
  rightEar.position.set(-0.22, 0.95, 0);
  headGroup.add(leftEar, rightEar);

  // Eyes
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  if (look.eyeStyle === 'felices') {
    // Closed happy eyes: little ^ ^ arcs
    const arcGeom = new THREE.TorusGeometry(0.03, 0.009, 6, 10, Math.PI);
    const leftArc = new THREE.Mesh(arcGeom, eyeMat);
    leftArc.position.set(0.08, 0.96, 0.205);
    const rightArc = new THREE.Mesh(arcGeom, eyeMat);
    rightArc.position.set(-0.08, 0.96, 0.205);
    headGroup.add(leftArc, rightArc);
  } else {
    const big = look.eyeStyle === 'grandes';
    const eyeGeom = new THREE.SphereGeometry(big ? 0.045 : 0.035, 10, 10);
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(0.08, 0.97, big ? 0.185 : 0.19);
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(-0.08, 0.97, big ? 0.185 : 0.19);

    // Eye highlights
    const hlGeom = new THREE.SphereGeometry(big ? 0.015 : 0.012, 6, 6);
    const leftHl = new THREE.Mesh(hlGeom, hlMat);
    leftHl.position.set(0.09, 0.985, 0.215);
    const rightHl = new THREE.Mesh(hlGeom, hlMat);
    rightHl.position.set(-0.07, 0.985, 0.215);
    headGroup.add(leftEye, rightEye, leftHl, rightHl);
    if (big) {
      const smallHlGeom = new THREE.SphereGeometry(0.007, 6, 6);
      const l2 = new THREE.Mesh(smallHlGeom, hlMat);
      l2.position.set(0.068, 0.958, 0.222);
      const r2 = new THREE.Mesh(smallHlGeom, hlMat);
      r2.position.set(-0.092, 0.958, 0.222);
      headGroup.add(l2, r2);
    }
  }

  // Eyelashes (chica) or eyebrows (chico)
  const lashMat = eyeMat;
  for (const side of [1, -1]) {
    if (isChica) {
      const big = look.eyeStyle === 'grandes';
      const happy = look.eyeStyle === 'felices';
      const ox = big ? 0.01 : 0;
      const oy = happy ? -0.03 : 0;
      const lash1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.009, 0.01), lashMat);
      lash1.position.set((0.118 + ox) * side, 0.992 + oy, 0.183);
      lash1.rotation.z = (happy ? -0.3 : 0.5) * side;
      lash1.rotation.y = 0.5 * side;
      const lash2 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.01), lashMat);
      lash2.position.set((0.106 + ox) * side, 1.006 + oy * 0.7, 0.19);
      lash2.rotation.z = (happy ? 0.1 : 0.95) * side;
      lash2.rotation.y = 0.45 * side;
      headGroup.add(lash1, lash2);
    } else {
      const browY = look.eyeStyle === 'grandes' ? 1.035 : 1.024;
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.014), hairMat);
      brow.position.set(0.082 * side, browY, 0.198);
      brow.rotation.z = -0.12 * side;
      brow.rotation.y = 0.38 * side;
      headGroup.add(brow);
    }
  }

  // Smiling mouth (Gentle curved smile line)
  const mouthGeom = new THREE.TorusGeometry(isChica ? 0.026 : 0.03, 0.008, 6, 10, Math.PI);
  const mouthMat = new THREE.MeshBasicMaterial({ color: isChica ? 0xc2566a : 0x8b4513 });
  const mouth = new THREE.Mesh(mouthGeom, mouthMat);
  mouth.position.set(0, 0.89, 0.21);
  mouth.rotation.x = 0.2;
  mouth.rotation.z = Math.PI;
  headGroup.add(mouth);

  // Cute blushing rosy cheeks
  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff9999, transparent: true, opacity: isChica ? 0.8 : 0.6 });
  const cheekGeom = new THREE.SphereGeometry(0.032, 8, 8);
  const leftCheek = new THREE.Mesh(cheekGeom, cheekMat);
  leftCheek.position.set(0.12, 0.93, 0.17);
  const rightCheek = new THREE.Mesh(cheekGeom, cheekMat);
  rightCheek.position.set(-0.12, 0.93, 0.17);
  headGroup.add(leftCheek, rightCheek);

  // Face accessories
  if (look.accessory === 'lentes') {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.4, metalness: 0.4 });
    const lensGeom = new THREE.TorusGeometry(0.048, 0.007, 6, 18);
    const lensL = new THREE.Mesh(lensGeom, frameMat);
    lensL.position.set(0.08, 0.97, 0.215);
    const lensR = new THREE.Mesh(lensGeom, frameMat);
    lensR.position.set(-0.08, 0.97, 0.215);
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.065, 6), frameMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.98, 0.222);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18 });
    const glassGeom = new THREE.CircleGeometry(0.045, 16);
    const glassL = new THREE.Mesh(glassGeom, glassMat);
    glassL.position.set(0.08, 0.97, 0.218);
    const glassR = new THREE.Mesh(glassGeom, glassMat);
    glassR.position.set(-0.08, 0.97, 0.218);
    headGroup.add(lensL, lensR, bridge, glassL, glassR);
  } else if (look.accessory === 'pecas') {
    const freckleMat = new THREE.MeshBasicMaterial({ color: shade(look.skinColor, 0.62) });
    const freckleGeom = new THREE.SphereGeometry(0.008, 5, 5);
    const spots: [number, number][] = [[0.1, 0.94], [0.135, 0.925], [0.115, 0.91], [0.15, 0.945]];
    for (const [x, y] of spots) {
      for (const side of [1, -1]) {
        const f = new THREE.Mesh(freckleGeom, freckleMat);
        const z = Math.sqrt(Math.max(0, 0.22 * 0.22 - x * x - (y - HEAD_Y) * (y - HEAD_Y))) + 0.004;
        f.position.set(x * side, y, z);
        headGroup.add(f);
      }
    }
  }

  // 3. Headwear
  let hatPompom: THREE.Mesh = new THREE.Mesh(); // invisible placeholder when the hat has no pompom
  switch (look.hatStyle) {
    case 'gorro': {
      // Cozy Beanie Hat
      const hatGeom = new THREE.ConeGeometry(0.24, 0.28, 16);
      const hat = new THREE.Mesh(hatGeom, hatMat);
      hat.position.set(0, 1.15, -0.02);
      hat.rotation.x = -0.15;
      hat.castShadow = true;
      headGroup.add(hat);

      // Folded beanie rim
      const rimGeom = new THREE.TorusGeometry(0.22, 0.05, 8, 20);
      const rim = new THREE.Mesh(rimGeom, hatMat);
      rim.position.set(0, 1.05, -0.01);
      rim.rotation.x = Math.PI / 2 - 0.15;
      headGroup.add(rim);

      // Fluffy cream pompom on top
      const pompomGeom = new THREE.SphereGeometry(0.08, 12, 12);
      hatPompom = new THREE.Mesh(pompomGeom, pompomMat);
      hatPompom.position.set(0, 1.32, -0.06);
      headGroup.add(hatPompom);
      break;
    }
    case 'gorra': {
      // Baseball cap with a front bill and a top button
      const crownGeom = new THREE.SphereGeometry(0.235, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      crownGeom.scale(1, 0.82, 1);
      const crown = new THREE.Mesh(crownGeom, hatMat);
      crown.position.set(0, 1.0, -0.01);
      crown.rotation.x = -0.12;
      crown.castShadow = true;
      const billGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20, 1, false, -Math.PI / 2, Math.PI);
      billGeom.scale(1, 1, 0.85);
      const bill = new THREE.Mesh(billGeom, detailMat);
      bill.position.set(0, 1.02, 0.15);
      bill.rotation.x = 0.12;
      bill.castShadow = true;
      const capBand = new THREE.Mesh(new THREE.TorusGeometry(0.232, 0.014, 6, 24), detailMat);
      capBand.rotation.x = Math.PI / 2 - 0.12;
      capBand.position.set(0, 1.005, -0.01);
      hatPompom = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), detailMat);
      hatPompom.position.set(0, 1.19, -0.035);
      headGroup.add(crown, bill, capBand, hatPompom);
      break;
    }
    case 'sombrero': {
      // Wide-brim explorer hat with a ribbon band
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.025, 28), hatMat);
      brim.position.set(0, 1.1, -0.01);
      brim.rotation.x = -0.08;
      brim.castShadow = true;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.18, 20), hatMat);
      crown.position.set(0, 1.2, -0.02);
      crown.rotation.x = -0.08;
      crown.castShadow = true;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.214, 0.221, 0.045, 20), scarfMat);
      band.position.set(0, 1.135, -0.015);
      band.rotation.x = -0.08;
      // Little feather tucked in the band (acts as the "pompom" for wind sway)
      const featherGeom = new THREE.SphereGeometry(0.05, 8, 8);
      featherGeom.scale(0.35, 1.6, 0.6);
      featherGeom.translate(0, 0.06, 0);
      hatPompom = new THREE.Mesh(featherGeom, pompomMat);
      hatPompom.position.set(0.2, 1.16, -0.04);
      hatPompom.rotation.z = -0.5;
      headGroup.add(brim, crown, band, hatPompom);
      break;
    }
    case 'orejas': {
      // Soft headband with fluffy animal ears
      const bandGeom = new THREE.TorusGeometry(0.225, 0.02, 6, 24, Math.PI);
      const headband = new THREE.Mesh(bandGeom, hatMat);
      headband.position.set(0, 0.97, -0.02);
      const innerMat = new THREE.MeshStandardMaterial({ color: 0xf6b8b8, roughness: 0.9 });
      for (const side of [1, -1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.15, 4), hatMat);
        ear.position.set(0.14 * side, 1.19, -0.02);
        ear.rotation.z = -0.35 * side;
        ear.rotation.y = Math.PI / 4;
        ear.castShadow = true;
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 4), innerMat);
        inner.position.set(0.137 * side, 1.18, 0.012);
        inner.rotation.z = -0.35 * side;
        inner.rotation.y = Math.PI / 4;
        headGroup.add(ear, inner);
      }
      headGroup.add(headband);
      break;
    }
    case 'flores': {
      // Flower crown: blossoms circling the head with tiny leaves
      const petalMat = hatMat;
      const centerMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.6 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x6a994e, roughness: 0.8 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.012, 6, 28), leafMat);
      ring.position.set(0, 1.08, -0.02);
      ring.rotation.x = Math.PI / 2 - 0.3;
      headGroup.add(ring);
      const count = 9;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const flower = new THREE.Group();
        const r = 0.215;
        // follow the tilted ring
        const local = new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r);
        local.applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.3);
        flower.position.set(local.x, 1.08 + local.y, local.z - 0.02);
        const bloomSize = i % 2 === 0 ? 0.042 : 0.032;
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(bloomSize, 8, 8), i % 3 === 1 ? pompomMat : petalMat);
        bloom.scale.set(1, 0.6, 1);
        const center = new THREE.Mesh(new THREE.SphereGeometry(bloomSize * 0.4, 6, 6), centerMat);
        center.position.y = bloomSize * 0.4;
        flower.add(bloom, center);
        headGroup.add(flower);
        if (i === 0) hatPompom = bloom; // front flower bobs in the wind
      }
      break;
    }
    case 'ninguno':
    default:
      break;
  }

  // 4. Cozy Scarf with Fringed Tassels
  const scarfRingGeom = new THREE.TorusGeometry(0.23, 0.06, 8, 20);
  const scarfRing = new THREE.Mesh(scarfRingGeom, scarfMat);
  scarfRing.position.y = 0.8;
  scarfRing.rotation.x = Math.PI / 2;
  group.add(scarfRing);

  // Scarf tails with fringe detail
  const tailGeom1 = new THREE.BoxGeometry(0.09, 0.28, 0.02);
  tailGeom1.translate(0, -0.14, 0);
  const scarfTail1 = new THREE.Mesh(tailGeom1, scarfMat);
  scarfTail1.position.set(0.08, 0.78, -0.22);

  const tailGeom2 = new THREE.BoxGeometry(0.08, 0.24, 0.02);
  tailGeom2.translate(0, -0.12, 0);
  const scarfTail2 = new THREE.Mesh(tailGeom2, scarfMat);
  scarfTail2.position.set(-0.04, 0.76, -0.21);
  group.add(scarfTail1, scarfTail2);

  // 5. Articulated Arms & Cozy Mittens (Left & Right)
  const leftArm = new THREE.Group();
  leftArm.position.set(isChica ? 0.24 : 0.26, 0.68, 0); // Shoulder pivot

  const armGeom = new THREE.CapsuleGeometry(0.055, 0.16, 6, 8);
  armGeom.translate(0, -0.08, 0);
  const leftSleeve = new THREE.Mesh(armGeom, sweaterMat);
  leftSleeve.castShadow = true;
  leftArm.add(leftSleeve);

  // Sleeve cuff
  const cuffGeom = new THREE.TorusGeometry(0.06, 0.02, 6, 12);
  cuffGeom.rotateX(Math.PI / 2);
  const leftCuff = new THREE.Mesh(cuffGeom, hatMat); // cuffs match the hat color
  leftCuff.position.y = -0.18;
  leftArm.add(leftCuff);

  // Cozy mitten hand with thumb
  const mittenGeom = new THREE.SphereGeometry(0.055, 8, 8);
  mittenGeom.scale(0.85, 1.2, 0.85);
  const leftMitten = new THREE.Mesh(mittenGeom, pompomMat);
  leftMitten.position.set(0, -0.23, 0.02);
  const thumbGeom = new THREE.SphereGeometry(0.025, 6, 6);
  const leftThumb = new THREE.Mesh(thumbGeom, pompomMat);
  leftThumb.position.set(-0.035, -0.22, 0.03);
  leftArm.add(leftMitten, leftThumb);
  group.add(leftArm);

  // Right arm (mirrored)
  const rightArm = new THREE.Group();
  rightArm.position.set(isChica ? -0.24 : -0.26, 0.68, 0); // Shoulder pivot

  const rightSleeve = new THREE.Mesh(armGeom, sweaterMat);
  rightSleeve.castShadow = true;
  rightArm.add(rightSleeve);

  const rightCuff = new THREE.Mesh(cuffGeom, hatMat);
  rightCuff.position.y = -0.18;
  rightArm.add(rightCuff);

  const rightMitten = new THREE.Mesh(mittenGeom, pompomMat);
  rightMitten.position.set(0, -0.23, 0.02);
  const rightThumb = new THREE.Mesh(thumbGeom, pompomMat);
  rightThumb.position.set(0.035, -0.22, 0.03);
  rightArm.add(rightMitten, rightThumb);
  group.add(rightArm);

  // 6. Detailed Adventurer Backpack with Bedroll & Flask (optional)
  if (look.backpack) {
    const packGeom = new THREE.BoxGeometry(0.28, 0.32, 0.16);
    const pack = new THREE.Mesh(packGeom, backpackMat);
    pack.position.set(0, 0.58, -0.22);
    pack.castShadow = true;
    group.add(pack);

    // Backpack pocket pouch
    const pocketGeom = new THREE.BoxGeometry(0.22, 0.15, 0.06);
    const pocket = new THREE.Mesh(pocketGeom, backpackMat);
    pocket.position.set(0, 0.52, -0.32);
    group.add(pocket);

    // Chest harness straps wrapping around the front
    const strapLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.02), strapMat);
    strapLeft.position.set(0.12, 0.58, 0.22);
    const strapRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.02), strapMat);
    strapRight.position.set(-0.12, 0.58, 0.22);
    group.add(strapLeft, strapRight);

    // Rolled sage-green camping bedroll strapped atop the backpack
    const rollGeom = new THREE.CylinderGeometry(0.065, 0.065, 0.32, 10);
    rollGeom.rotateZ(Math.PI / 2);
    const bedroll = new THREE.Mesh(rollGeom, bedrollMat);
    bedroll.position.set(0, 0.78, -0.24);
    bedroll.castShadow = true;
    // Two buckle strap loops holding bedroll
    const buckle1 = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 12), strapMat);
    buckle1.position.set(0.09, 0.78, -0.24);
    buckle1.rotation.y = Math.PI / 2;
    const buckle2 = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 12), strapMat);
    buckle2.position.set(-0.09, 0.78, -0.24);
    buckle2.rotation.y = Math.PI / 2;
    group.add(bedroll, buckle1, buckle2);

    // Wooden water flask / canteen on side of pack
    const flaskGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8);
    const flask = new THREE.Mesh(flaskGeom, toggleMat);
    flask.position.set(-0.17, 0.54, -0.22);
    group.add(flask);
  } else {
    // Simple leather belt so the lantern still has somewhere to hang
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.022, 6, 24), strapMat);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.44;
    group.add(belt);
  }

  // Miniature brass lantern hanging on backpack hook (or belt)
  const lanternPost = new THREE.Group();
  if (look.backpack) {
    lanternPost.position.set(0.14, 0.52, -0.32);
  } else {
    lanternPost.position.set(0.1, 0.4, -0.25);
  }

  const cageGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8);
  const cage = new THREE.Mesh(cageGeom, brassMat);
  const coreGeom = new THREE.SphereGeometry(0.03, 8, 8);
  const lanternCore = new THREE.Mesh(coreGeom, lanternCoreMat);
  lanternPost.add(cage, lanternCore);
  group.add(lanternPost);

  // 7. Legs, Wool Socks & Hiking Boots
  const bootGeom = new THREE.CapsuleGeometry(0.07, 0.14, 8, 8);

  // Left boot group
  const leftLeg = new THREE.Group();
  const leftBoot = new THREE.Mesh(bootGeom, bootMat);
  leftBoot.castShadow = true;
  // Dark traction sole
  const leftSole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.22), soleMat);
  leftSole.position.y = -0.07;
  // Cream wool sock cuff
  const leftSock = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.02, 6, 12), sockMat);
  leftSock.position.y = 0.08;
  leftSock.rotation.x = Math.PI / 2;
  leftLeg.add(leftBoot, leftSole, leftSock);
  leftLeg.position.set(0.12, 0.14, 0);

  // Right boot group
  const rightLeg = new THREE.Group();
  const rightBoot = new THREE.Mesh(bootGeom, bootMat);
  rightBoot.castShadow = true;
  const rightSole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.22), soleMat);
  rightSole.position.y = -0.07;
  const rightSock = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.02, 6, 12), sockMat);
  rightSock.position.y = 0.08;
  rightSock.rotation.x = Math.PI / 2;
  rightLeg.add(rightBoot, rightSole, rightSock);
  rightLeg.position.set(-0.12, 0.14, 0);

  group.add(leftLeg, rightLeg);

  // 8. Floating Companion
  const companionSprite = new THREE.Group();
  companionSprite.position.set(0.42, 1.25, 0.15); // hovers near shoulder
  let companionSpinner: THREE.Object3D | null = null;
  const companionWings: THREE.Mesh[] = [];
  /** Custom per-companion animation (fairy wings, serpent body…) */
  let companionAnim: ((t: number, dt: number) => void) | null = null;

  if (look.companion === 'nube') {
    // "Nubi": tiny cloud sprite with halo
    const wispMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.05,
      emissive: 0xddf2fd,
      emissiveIntensity: 0.35,
    });
    const cPuff1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), wispMat);
    const cPuff2 = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), wispMat);
    cPuff2.position.set(-0.065, -0.015, 0);
    const cPuff3 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), wispMat);
    cPuff3.position.set(0.065, -0.02, 0);

    const spriteEyeGeom = new THREE.SphereGeometry(0.014, 6, 6);
    const sEye1 = new THREE.Mesh(spriteEyeGeom, eyeMat);
    sEye1.position.set(0.03, 0.01, 0.085);
    const sEye2 = new THREE.Mesh(spriteEyeGeom, eyeMat);
    sEye2.position.set(-0.03, 0.01, 0.085);

    const sHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.09, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide })
    );
    sHalo.position.y = 0.13;
    sHalo.rotation.x = Math.PI / 2;
    companionSpinner = sHalo;

    companionSprite.add(cPuff1, cPuff2, cPuff3, sEye1, sEye2, sHalo);
  } else if (look.companion === 'estrella') {
    // "Estelita": chubby glowing five-point star
    const starShape = new THREE.Shape();
    const outer = 0.11;
    const inner = 0.05;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();
    const starGeom = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    starGeom.center();
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0xffb703,
      emissiveIntensity: 0.45,
    });
    const starBody = new THREE.Group();
    const star = new THREE.Mesh(starGeom, starMat);
    const spriteEyeGeom = new THREE.SphereGeometry(0.012, 6, 6);
    const sEye1 = new THREE.Mesh(spriteEyeGeom, eyeMat);
    sEye1.position.set(0.025, 0.0, 0.045);
    const sEye2 = new THREE.Mesh(spriteEyeGeom, eyeMat);
    sEye2.position.set(-0.025, 0.0, 0.045);
    starBody.add(star, sEye1, sEye2);
    companionSprite.add(starBody);
    companionSpinner = starBody;
  } else if (look.companion === 'catarina') {
    // "Catarina": lucky ladybug with spotted red shell, tiny antennae and a wobble
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.3, metalness: 0.1 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.4 });
    const bug = new THREE.Group();

    const shellGeom = new THREE.SphereGeometry(0.08, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    shellGeom.scale(1, 1.0, 1.15);
    const shell = new THREE.Mesh(shellGeom, shellMat);
    const belly = new THREE.Mesh(new THREE.CircleGeometry(0.08, 18), blackMat);
    belly.rotation.x = Math.PI / 2;
    belly.scale.set(1, 1.15, 1);

    // Center seam between the wing covers
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.0645, 0.004, 4, 20, Math.PI), blackMat);
    seam.rotation.y = Math.PI / 2;
    seam.scale.set(1.15, 1.24, 1);

    // Black spots sitting on the shell surface
    const spotGeom = new THREE.SphereGeometry(0.014, 8, 8);
    spotGeom.scale(1, 0.45, 1);
    const spotDirs: [number, number][] = [
      [0.8, 0.6], [2.2, 0.75], [0.5, 1.1], [2.6, 1.1], [1.5, 0.35],
    ];
    for (const [yaw, polar] of spotDirs) {
      for (const side of [1, -1]) {
        if (yaw === 1.5 && side === -1) continue;
        const x = Math.sin(polar) * Math.cos(yaw) * side;
        const y = Math.cos(polar);
        const z = Math.sin(polar) * Math.sin(yaw) * (yaw > Math.PI / 2 ? -1 : 1);
        const n = new THREE.Vector3(x, y, z).normalize();
        const spot = new THREE.Mesh(spotGeom, blackMat);
        spot.position.set(n.x * 0.08, n.y * 0.08, n.z * 0.092);
        spot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        bug.add(spot);
      }
    }

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), blackMat);
    head.position.set(0, 0.012, 0.09);
    const spriteEyeGeom = new THREE.SphereGeometry(0.01, 6, 6);
    const sEye1 = new THREE.Mesh(spriteEyeGeom, hlMat);
    sEye1.position.set(0.016, 0.026, 0.121);
    const sEye2 = new THREE.Mesh(spriteEyeGeom, hlMat);
    sEye2.position.set(-0.016, 0.026, 0.121);

    for (const side of [1, -1]) {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 4), blackMat);
      antenna.position.set(0.015 * side, 0.06, 0.11);
      antenna.rotation.set(0.5, 0, -0.35 * side);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), blackMat);
      tip.position.set(0.024 * side, 0.082, 0.123);
      bug.add(antenna, tip);
    }

    bug.add(shell, belly, seam, head, sEye1, sEye2);
    bug.rotation.x = 0.1;
    companionSprite.add(bug);
    companionSpinner = bug;
  } else if (look.companion === 'luciernaga') {
    // "Chispa": firefly with a glowing tail and flapping wings
    const bugMat = new THREE.MeshStandardMaterial({ color: 0x3b3a5a, roughness: 0.5 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xd8ff7a });
    const bodyBug = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), bugMat);
    bodyBug.position.set(0, 0.02, 0.03);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), glowMat);
    glow.scale.set(1, 1, 1.25);
    glow.position.set(0, 0, -0.05);
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xeaff9a, transparent: true, opacity: 0.18, depthWrite: false })
    );
    aura.position.copy(glow.position);
    const spriteEyeGeom = new THREE.SphereGeometry(0.011, 6, 6);
    const sEye1 = new THREE.Mesh(spriteEyeGeom, hlMat);
    sEye1.position.set(0.02, 0.035, 0.068);
    const sEye2 = new THREE.Mesh(spriteEyeGeom, hlMat);
    sEye2.position.set(-0.02, 0.035, 0.068);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    for (const side of [1, -1]) {
      const wingGeom = new THREE.CircleGeometry(0.05, 10);
      wingGeom.scale(1, 0.55, 1);
      wingGeom.translate(0.05, 0, 0);
      const wing = new THREE.Mesh(wingGeom, wingMat);
      wing.position.set(0.02 * side, 0.06, 0.0);
      wing.rotation.y = side === 1 ? 0 : Math.PI;
      companionWings.push(wing);
      companionSprite.add(wing);
    }
    companionSprite.add(bodyBug, glow, aura, sEye1, sEye2);
  } else if (look.companion === 'hada') {
    // "Lila": tiny garden fairy with a pink petal dress, lilac hair, four shimmering wings and a star wand
    const fairy = new THREE.Group();
    const skinM = new THREE.MeshStandardMaterial({ color: 0xffe0cc, roughness: 0.6 });
    const dressMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5, emissive: 0x9d174d, emissiveIntensity: 0.15 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xc4b5fd, roughness: 0.5 });
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.1, 10), dressMat);
    dress.position.y = -0.035;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), dressMat);
      petal.scale.set(1, 0.4, 1.6);
      petal.position.set(Math.cos(a) * 0.04, -0.08, Math.sin(a) * 0.04);
      petal.rotation.y = -a;
      fairy.add(petal);
    }
    const headF = new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 10), skinM);
    headF.position.y = 0.04;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
    hair.position.set(0, 0.044, -0.004);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), hairMat);
    bun.position.set(0, 0.082, -0.01);
    const fEyeGeom = new THREE.SphereGeometry(0.0075, 6, 6);
    const fEye1 = new THREE.Mesh(fEyeGeom, eyeMat);
    fEye1.position.set(0.012, 0.043, 0.03);
    const fEye2 = new THREE.Mesh(fEyeGeom, eyeMat);
    fEye2.position.set(-0.012, 0.043, 0.03);
    fairy.add(dress, headF, hair, bun, fEye1, fEye2);
    // Wings: two pairs on pivots that flap
    const wingPivots: THREE.Group[] = [];
    const wingMatA = new THREE.MeshBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false });
    const wingMatB = new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false });
    for (const side of [1, -1]) {
      for (const upper of [true, false]) {
        const pivot = new THREE.Group();
        pivot.position.set(0.006 * side, upper ? 0.012 : -0.012, -0.022);
        const wg = new THREE.CircleGeometry(upper ? 0.05 : 0.034, 14);
        wg.scale(1, upper ? 0.62 : 0.55, 1);
        wg.translate((upper ? 0.05 : 0.034) * side, upper ? 0.02 : -0.012, 0);
        const wing = new THREE.Mesh(wg, upper ? wingMatA : wingMatB);
        pivot.add(wing);
        fairy.add(pivot);
        wingPivots.push(pivot);
      }
    }
    // Star wand
    const wand = new THREE.Group();
    wand.position.set(0.045, -0.01, 0.02);
    wand.rotation.z = -0.5;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4), new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.3 }));
    stick.position.y = 0.035;
    const starTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), new THREE.MeshBasicMaterial({ color: 0xfde047 }));
    starTip.position.y = 0.075;
    wand.add(stick, starTip);
    fairy.add(wand);
    const fAura = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    fairy.add(fAura);
    companionSprite.add(fairy);
    companionAnim = (t) => {
      const flap = 0.35 + Math.sin(t * 28) * 0.5;
      wingPivots.forEach((p, i) => (p.rotation.y = (i < 2 ? -1 : 1) * flap));
      fairy.rotation.y = Math.sin(t * 1.4) * 0.5;
      fairy.position.y = Math.sin(t * 4) * 0.012;
      starTip.rotation.y = t * 4;
      (fAura.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(t * 6) * 0.05;
    };
  } else if (look.companion === 'serpiente') {
    // "Jade": a little flying jade serpent (eastern dragon style) whose body ripples through the air
    const serpent = new THREE.Group();
    const jadeA = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.1, emissive: 0x064e3b, emissiveIntensity: 0.25 });
    const jadeB = new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.35, metalness: 0.1, emissive: 0x065f46, emissiveIntensity: 0.25 });
    const goldM = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.7 });
    const segs: THREE.Mesh[] = [];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const r = 0.032 - i * 0.0019;
      const sgm = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), i % 2 ? jadeB : jadeA);
      if (i % 3 === 1) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, r * 1.4, 4), goldM);
        fin.position.y = r * 0.9;
        sgm.add(fin);
      }
      serpent.add(sgm);
      segs.push(sgm);
    }
    const headS = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), jadeA);
    skull.scale.set(1, 0.85, 1.25);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), jadeB);
    snout.position.set(0, -0.008, 0.04);
    snout.scale.set(1.1, 0.7, 1);
    const sEye1 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), eyeMat);
    sEye1.position.set(0.022, 0.014, 0.03);
    const sEye2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), eyeMat);
    sEye2.position.set(-0.022, 0.014, 0.03);
    headS.add(skull, snout, sEye1, sEye2);
    for (const side of [1, -1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.045, 5), goldM);
      horn.position.set(0.018 * side, 0.04, -0.012);
      horn.rotation.x = -0.6;
      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.001, 0.07, 3), goldM);
      whisker.position.set(0.03 * side, -0.012, 0.05);
      whisker.rotation.set(0.4, 0, -1.1 * side);
      const wingS = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 3), new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.4, transparent: true, opacity: 0.85 }));
      wingS.position.set(0.035 * side, 0.01, -0.06);
      wingS.rotation.z = -1.3 * side;
      wingS.scale.z = 0.3;
      headS.add(horn, whisker);
      segs[2].add(wingS);
    }
    serpent.add(headS);
    serpent.scale.setScalar(1.3);
    companionSprite.add(serpent);
    companionAnim = (t) => {
      for (let i = 0; i < N; i++) {
        const k = i * 0.55;
        segs[i].position.set(Math.sin(t * 3.2 - k) * 0.045, Math.cos(t * 2.4 - k * 0.8) * 0.03 + i * 0.004, -0.03 - i * 0.026);
      }
      headS.position.set(Math.sin(t * 3.2 + 0.55) * 0.045, Math.cos(t * 2.4 + 0.44) * 0.03 - 0.004, 0.012);
      headS.rotation.y = Math.cos(t * 3.2 + 0.55) * 0.5;
      serpent.rotation.y = Math.sin(t * 0.8) * 0.6;
    };
    companionAnim(0, 0);
  }
  group.add(companionSprite);
  companionSprite.visible = look.companion !== 'ninguno';

  // 9. Contact shadow plane
  const shadowGeom = new THREE.PlaneGeometry(0.75, 0.75);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.shadow,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeom, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // Body proportions (height / build)
  group.scale.set(look.build, look.height, look.build);

  // Animation cycle helper
  let walkCycle = 0;
  const updateAnimation = (speed: number, isGrounded: boolean, dt: number, windTime: number) => {
    if (isGrounded) {
      // Ease the torso back from the airborne stretch
      const k = Math.min(1, dt * 12);
      body.scale.x += (1 - body.scale.x) * k;
      body.scale.y += (1 - body.scale.y) * k;
      body.scale.z += (1 - body.scale.z) * k;

      if (speed > 0.1) {
        walkCycle += speed * dt * 9.5;
        // Legs stride
        leftLeg.position.z = Math.sin(walkCycle) * 0.2;
        rightLeg.position.z = -Math.sin(walkCycle) * 0.2;
        leftLeg.position.y = 0.14 + Math.max(0, -Math.cos(walkCycle) * 0.11);
        rightLeg.position.y = 0.14 + Math.max(0, Math.cos(walkCycle) * 0.11);

        // Arms swing in counter-motion to legs!
        leftArm.rotation.x = -Math.sin(walkCycle) * 0.65;
        rightArm.rotation.x = Math.sin(walkCycle) * 0.65;
        leftArm.rotation.z = 0.12;
        rightArm.rotation.z = -0.12;

        body.position.y = 0.55 + Math.abs(Math.sin(walkCycle)) * 0.045;
        head.position.y = HEAD_Y + Math.abs(Math.sin(walkCycle)) * 0.035;
        body.rotation.z = Math.sin(walkCycle * 0.5) * 0.06;

        // Lantern pendulum sway
        lanternPost.rotation.z = Math.sin(walkCycle * 0.5) * 0.25;
        lanternPost.rotation.x = 0.15 + Math.cos(walkCycle) * 0.1;
      } else {
        // Idle breathing
        walkCycle += dt * 2.2;
        leftLeg.position.z = 0;
        rightLeg.position.z = 0;
        leftLeg.position.y = 0.14;
        rightLeg.position.y = 0.14;

        // Arms rest softly at sides
        leftArm.rotation.x = Math.sin(walkCycle) * 0.04;
        rightArm.rotation.x = -Math.sin(walkCycle) * 0.04;
        leftArm.rotation.z = 0.12;
        rightArm.rotation.z = -0.12;

        body.position.y = 0.55 + Math.sin(walkCycle) * 0.015;
        head.position.y = HEAD_Y + Math.sin(walkCycle) * 0.02;
        body.rotation.z = 0;
        lanternPost.rotation.z = Math.sin(walkCycle * 0.8) * 0.06;
      }
    } else {
      // In air: Joyful jump celebration pose!
      // Arms raise up in the air!
      leftArm.rotation.x = -1.9 + Math.sin(windTime * 4) * 0.1;
      rightArm.rotation.x = -1.9 - Math.sin(windTime * 4) * 0.1;
      leftArm.rotation.z = 0.35;
      rightArm.rotation.z = -0.35;

      leftLeg.position.y = 0.22;
      rightLeg.position.y = 0.24;
      leftLeg.position.z = -0.08;
      rightLeg.position.z = 0.05;
      body.scale.set(0.92, 1.12, 0.92);
      lanternPost.rotation.x = -0.35;
    }

    // Everything attached to the head follows its bob
    headGroup.position.y = head.position.y - HEAD_Y;

    // Scarf fluttering reacting dynamically to movement & wind gusts
    const trailAngle = (speed > 0.5 ? 0.65 : 0.2) + Math.sin(windTime * 6) * 0.28;
    scarfTail1.rotation.x = trailAngle;
    scarfTail1.rotation.y = Math.cos(windTime * 4.5) * 0.22;
    scarfTail2.rotation.x = trailAngle * 0.92;
    scarfTail2.rotation.y = -Math.sin(windTime * 5.0) * 0.22;
    hatPompom.rotation.x = Math.sin(windTime * 3.5) * 0.12;

    // Ponytail / pigtails swing with movement
    for (let i = 0; i < swingingHair.length; i++) {
      const h = swingingHair[i];
      const base = swingingHair.length === 1 ? 0.35 : 0;
      h.rotation.x = base + (speed > 0.5 ? 0.45 : 0.05) + Math.sin(windTime * 5 + i) * 0.12 + (isGrounded ? 0 : -0.3);
    }

    // Companion smooth floating orbit
    companionSprite.position.x = 0.4 + Math.sin(windTime * 2.5) * 0.08;
    companionSprite.position.y = 1.25 + Math.sin(windTime * 3.2) * 0.12;
    companionSprite.position.z = 0.15 + Math.cos(windTime * 2.5) * 0.08;
    if (companionSpinner) {
      if (look.companion === 'nube') companionSpinner.rotation.z += dt * 1.5;
      else companionSpinner.rotation.y = Math.sin(windTime * 1.8) * 0.6;
    }
    for (let i = 0; i < companionWings.length; i++) {
      const flap = Math.sin(windTime * 30) * 0.7;
      companionWings[i].rotation.x = flap;
    }
    companionAnim?.(windTime, dt);
  };

  return {
    group,
    body,
    head,
    hatPompom,
    scarfTail1,
    scarfTail2,
    leftFoot: leftBoot,
    rightFoot: rightBoot,
    leftArm,
    rightArm,
    lanternPost,
    lanternCore,
    companionSprite,
    shadow,
    appearance: { ...look },
    updateAnimation,
  };
}

/** Frees GPU resources of a player model (shared textures like the shadow map are kept). */
export function disposePlayerCharacter(model: PlayerCharacterModel) {
  model.group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) m?.dispose();
    }
  });
}

// --- Bouncy Mushroom ---
export interface BouncyMushroomModel {
  group: THREE.Group;
  cap: THREE.Mesh;
  stalk: THREE.Mesh;
  triggerBounce: (superBounce?: boolean) => void;
  update: (dt: number) => void;
}

export function createBouncyMushroom(radius: number = 1.2, textures: ProceduralTextures): BouncyMushroomModel {
  const group = new THREE.Group();

  const stalkMat = new THREE.MeshStandardMaterial({
    color: 0xfbf6e9,
    roughness: 0.75,
    metalness: 0.05,
  });

  const capMat = new THREE.MeshStandardMaterial({
    map: textures.mushroomCap,
    roughness: 0.45,
    metalness: 0.1,
  });

  const gillMat = new THREE.MeshStandardMaterial({
    color: 0xedd6b8,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Stalk: Fluted bottom-heavy cylinder
  const stalkGeom = new THREE.CylinderGeometry(radius * 0.28, radius * 0.4, 1.1, 12);
  stalkGeom.translate(0, 0.55, 0); // flush to ground
  const stalk = new THREE.Mesh(stalkGeom, stalkMat);
  stalk.castShadow = true;
  stalk.receiveShadow = true;
  group.add(stalk);

  // Gills underneath cap
  const gillGeom = new THREE.CylinderGeometry(radius * 0.9, radius * 0.3, 0.15, 16);
  const gill = new THREE.Mesh(gillGeom, gillMat);
  gill.position.y = 1.05;
  group.add(gill);

  // Cap: Plump beveled dome
  const capGeom = new THREE.SphereGeometry(radius, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const cap = new THREE.Mesh(capGeom, capMat);
  cap.position.y = 1.1;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  // Contact shadow
  const shadowGeom = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.shadow,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeom, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // Spring animation state for bounce
  let bounceTimer = 0;
  let isSuperBounce = false;

  const triggerBounce = (superBounce: boolean = false) => {
    bounceTimer = 0.6; // active spring
    isSuperBounce = superBounce;
  };

  const update = (dt: number) => {
    if (bounceTimer > 0) {
      bounceTimer -= dt;
      const progress = 1 - bounceTimer / 0.6;
      // Damped oscillation squash-and-stretch with extra amplitude on super bounce
      const amp = isSuperBounce ? 0.55 : 0.35;
      const squash = 1 - Math.sin(progress * Math.PI * 3) * Math.exp(-progress * 3.8) * amp;
      const stretch = 1 + Math.sin(progress * Math.PI * 3) * Math.exp(-progress * 3.8) * (amp * 0.7);
      cap.scale.set(stretch, squash, stretch);
    } else {
      cap.scale.set(1, 1, 1);
    }
  };

  return {
    group,
    cap,
    stalk,
    triggerBounce,
    update,
  };
}

// --- Cozy Trees (Cherry Blossom Sakura / Autumn Amber) ---
export function createCozyTree(
  type: 'sakura' | 'autumn' | 'pine',
  scale: number = 1.0,
  textures: ProceduralTextures
): THREE.Group {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.8,
    metalness: 0.1,
  });

  const leafColors = {
    sakura: [0xffb7c5, 0xffc2d1, 0xff9ebb],
    autumn: [0xee8937, 0xd05322, 0xf6ad3c],
    pine: [0x4f772d, 0x31572c, 0x90a955],
  };
  const colors = leafColors[type];

  // 1. Trunk (composite 2-part twisted trunk)
  const trunkGeom1 = new THREE.CylinderGeometry(0.28 * scale, 0.42 * scale, 2.2 * scale, 8);
  trunkGeom1.translate(0, 1.1 * scale, 0);
  const trunk1 = new THREE.Mesh(trunkGeom1, woodMat);
  trunk1.castShadow = true;
  trunk1.receiveShadow = true;
  group.add(trunk1);

  // Branch fork
  const branchGeom = new THREE.CylinderGeometry(0.18 * scale, 0.25 * scale, 1.4 * scale, 8);
  branchGeom.translate(0, 0.7 * scale, 0);
  const branch = new THREE.Mesh(branchGeom, woodMat);
  branch.position.set(0, 1.8 * scale, 0);
  branch.rotation.z = 0.45;
  branch.rotation.y = 0.5;
  branch.castShadow = true;
  group.add(branch);

  // 2. Foliage blobs (4-5 overlapping soft cloud-like spheres)
  const blobOffsets = [
    [0, 2.6 * scale, 0, 1.2 * scale, colors[0]],
    [0.7 * scale, 2.7 * scale, 0.3 * scale, 0.9 * scale, colors[1]],
    [-0.6 * scale, 2.5 * scale, -0.4 * scale, 0.85 * scale, colors[2]],
    [0.2 * scale, 3.2 * scale, -0.2 * scale, 0.95 * scale, colors[0]],
    [-0.3 * scale, 2.8 * scale, 0.5 * scale, 0.8 * scale, colors[1]],
  ];

  blobOffsets.forEach(([x, y, z, rad, col]) => {
    const geom = new THREE.DodecahedronGeometry(rad as number, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: col as number,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });
    const foliage = new THREE.Mesh(geom, mat);
    foliage.position.set(x as number, y as number, z as number);
    foliage.castShadow = true;
    group.add(foliage);
  });

  // 3. Hanging paper lantern on branch
  const cordGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.35 * scale, 4);
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x4a3b32 });
  const cord = new THREE.Mesh(cordGeom, cordMat);
  cord.position.set(0.6 * scale, 2.1 * scale, 0.25 * scale);

  const lanternGeom = new THREE.SphereGeometry(0.14 * scale, 8, 8);
  const lanternMat = new THREE.MeshBasicMaterial({
    color: type === 'sakura' ? 0xffe0e6 : 0xffe6a7,
  });
  const lantern = new THREE.Mesh(lanternGeom, lanternMat);
  lantern.position.set(0.6 * scale, 1.9 * scale, 0.25 * scale);
  group.add(cord, lantern);

  // Contact shadow
  const shadowGeom = new THREE.PlaneGeometry(2.8 * scale, 2.8 * scale);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.shadow,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeom, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return group;
}

// --- Checkpoint Stone Shrine ---
export interface CheckpointShrineModel {
  group: THREE.Group;
  bell: THREE.Mesh;
  glowAura: THREE.Mesh;
  activated: boolean;
  activate: () => void;
  update: (dt: number) => void;
}

export function createCheckpointShrine(textures: ProceduralTextures): CheckpointShrineModel {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    roughness: 0.85,
    metalness: 0.1,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.7,
    metalness: 0.1,
  });

  const bellMat = new THREE.MeshStandardMaterial({
    color: 0xdfb15b,
    roughness: 0.25,
    metalness: 0.85,
    emissive: 0x3d2805,
    emissiveIntensity: 0.2,
  });

  // Plinth base (two-tiered stone steps)
  const baseGeom1 = new THREE.BoxGeometry(2.0, 0.25, 2.0);
  baseGeom1.translate(0, 0.125, 0);
  const base1 = new THREE.Mesh(baseGeom1, stoneMat);
  base1.receiveShadow = true;

  const baseGeom2 = new THREE.BoxGeometry(1.5, 0.2, 1.5);
  baseGeom2.translate(0, 0.35, 0);
  const base2 = new THREE.Mesh(baseGeom2, stoneMat);
  base2.receiveShadow = true;
  group.add(base1, base2);

  // Torii / Archway Pillars
  const pillarGeom = new THREE.CylinderGeometry(0.09, 0.11, 2.0, 8);
  pillarGeom.translate(0, 1.0, 0);
  const leftPillar = new THREE.Mesh(pillarGeom, woodMat);
  leftPillar.position.set(0.65, 0.45, 0);
  leftPillar.castShadow = true;

  const rightPillar = new THREE.Mesh(pillarGeom, woodMat);
  rightPillar.position.set(-0.65, 0.45, 0);
  rightPillar.castShadow = true;
  group.add(leftPillar, rightPillar);

  // Crossbeams (lintels)
  const lintelGeom = new THREE.BoxGeometry(1.8, 0.14, 0.18);
  const lintel = new THREE.Mesh(lintelGeom, woodMat);
  lintel.position.set(0, 2.35, 0);
  lintel.castShadow = true;
  group.add(lintel);

  // Roof cap
  const roofGeom = new THREE.BoxGeometry(2.0, 0.08, 0.35);
  const roof = new THREE.Mesh(roofGeom, woodMat);
  roof.position.set(0, 2.45, 0);
  group.add(roof);

  // --- Dynamic Hanging Bell Assembly (Pivoted from the crossbeam) ---
  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, 2.32, 0);
  group.add(bellPivot);

  // Suspension ring & chain
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.01, 6, 14), bellMat);
  hook.position.set(0, -0.04, 0);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.28, 6), bellMat);
  chain.position.set(0, -0.18, 0);
  bellPivot.add(hook, chain);

  // Sacred Temple Bell (Composite: cap, flared body, and rim)
  const bellBodyGroup = new THREE.Group();
  bellBodyGroup.position.set(0, -0.32, 0);

  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    bellMat
  );
  bellDome.position.set(0, -0.05, 0);

  const bellSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.22, 0.28, 16, 1, false),
    bellMat
  );
  bellSkirt.position.set(0, -0.19, 0);

  const bellRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.025, 8, 20),
    bellMat
  );
  bellRim.rotation.x = Math.PI / 2;
  bellRim.position.set(0, -0.33, 0);

  bellBodyGroup.add(bellDome, bellSkirt, bellRim);
  bellPivot.add(bellBodyGroup);

  // Internal Clapper with hanging paper talisman
  const clapperPivot = new THREE.Group();
  clapperPivot.position.set(0, -0.32, 0);

  const clapperRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, 0.35, 4),
    bellMat
  );
  clapperRod.position.set(0, -0.18, 0);

  const clapperBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.3, metalness: 0.8 })
  );
  clapperBall.position.set(0, -0.35, 0);

  // Dangling talisman / ribbon beneath the bell
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.22, 0.004),
    ribbonMat
  );
  ribbon.position.set(0, -0.48, 0);

  clapperPivot.add(clapperRod, clapperBall, ribbon);
  bellPivot.add(clapperPivot);

  // Soft glowing aura torus on ground
  const auraGeom = new THREE.TorusGeometry(0.75, 0.045, 8, 24);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x64dfdf,
    transparent: true,
    opacity: 0.3,
  });
  const glowAura = new THREE.Mesh(auraGeom, auraMat);
  glowAura.rotation.x = Math.PI / 2;
  glowAura.position.y = 0.5;
  group.add(glowAura);

  // Expanding shockwave ring when activated
  const shockwaveGeom = new THREE.RingGeometry(0.2, 0.35, 32);
  const shockwaveMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shockwave = new THREE.Mesh(shockwaveGeom, shockwaveMat);
  shockwave.rotation.x = -Math.PI / 2;
  shockwave.position.y = 0.48;
  group.add(shockwave);

  // Celestial upward beacon column that appears on activation
  const beaconGeom = new THREE.CylinderGeometry(0.35, 0.6, 7.0, 16, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beacon = new THREE.Mesh(beaconGeom, beaconMat);
  beacon.position.set(0, 3.8, 0);
  group.add(beacon);

  // --- Celebratory Burst Particles System ---
  const PARTICLE_COUNT = 55;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const velocities: { x: number; y: number; z: number }[] = [];
  const particleLife = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = 0;
    positions[i * 3 + 1] = 1.7;
    positions[i * 3 + 2] = 0;
    particleLife[i] = 0;
    velocities.push({ x: 0, y: 0, z: 0 });
    colors[i * 3 + 0] = 1.0;
    colors[i * 3 + 1] = 0.85;
    colors[i * 3 + 2] = 0.3;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 0.16,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particleSystem = new THREE.Points(particleGeo, particleMat);
  group.add(particleSystem);

  let isActivated = false;
  let animTime = 0;
  let ringTimer = 0;
  let shockwaveTimer = 0;

  const activate = () => {
    if (isActivated) return;
    isActivated = true;
    ringTimer = 2.8; // Trigger ringing oscillation
    shockwaveTimer = 1.4; // Trigger ground shockwave

    // Transition ground aura
    (auraMat as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
    (auraMat as THREE.MeshBasicMaterial).opacity = 0.85;
    (bellMat as THREE.MeshStandardMaterial).emissive.setHex(0xb45309);
    (bellMat as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;

    // Launch celebratory particle fountain from the bell
    const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = particleGeo.getAttribute('color') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;
    const colArray = colAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 1.8 + Math.random() * 3.2;
      const verticalSpeed = 2.2 + Math.random() * 3.8;

      velocities[i].x = Math.cos(angle) * speed;
      velocities[i].y = verticalSpeed;
      velocities[i].z = Math.sin(angle) * speed;

      posArray[i * 3 + 0] = (Math.random() - 0.5) * 0.25;
      posArray[i * 3 + 1] = 1.7 + (Math.random() - 0.5) * 0.25;
      posArray[i * 3 + 2] = (Math.random() - 0.5) * 0.25;

      particleLife[i] = 1.5 + Math.random() * 0.8;

      // Color variation: golden, amber, and celestial white
      const r = Math.random();
      if (r < 0.6) {
        colArray[i * 3 + 0] = 1.0;
        colArray[i * 3 + 1] = 0.84;
        colArray[i * 3 + 2] = 0.2;
      } else if (r < 0.85) {
        colArray[i * 3 + 0] = 0.98;
        colArray[i * 3 + 1] = 0.55;
        colArray[i * 3 + 2] = 0.15;
      } else {
        colArray[i * 3 + 0] = 1.0;
        colArray[i * 3 + 1] = 1.0;
        colArray[i * 3 + 2] = 0.9;
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    particleMat.opacity = 1.0;
  };

  const update = (dt: number) => {
    animTime += dt;

    // 1. Dynamic Bell Chiming & Pendulum Motion
    if (ringTimer > 0) {
      ringTimer = Math.max(0, ringTimer - dt);
      const progress = 1 - ringTimer / 2.8;
      // Vigorous swinging chime with natural exponential damping
      const chimeStrength = Math.sin(progress * Math.PI * 14) * Math.exp(-progress * 2.5) * 0.65;
      bellPivot.rotation.z = chimeStrength;
      bellPivot.rotation.x = Math.sin(progress * Math.PI * 8) * Math.exp(-progress * 2.5) * 0.2;
      // Clapper counter-rotates with momentum
      clapperPivot.rotation.z = -chimeStrength * 1.35;
      clapperPivot.rotation.x = -Math.cos(progress * Math.PI * 8) * Math.exp(-progress * 2.5) * 0.3;
      ribbon.rotation.z = chimeStrength * 1.8;
    } else if (isActivated) {
      // Harmonic resonance after activation: gentle swinging chime
      bellPivot.rotation.z = Math.sin(animTime * 2.4) * 0.14;
      bellPivot.rotation.x = Math.cos(animTime * 1.8) * 0.06;
      clapperPivot.rotation.z = -Math.sin(animTime * 2.4) * 0.18;
      ribbon.rotation.z = Math.sin(animTime * 3.6) * 0.25;
    } else {
      // Peaceful idle breeze sway
      bellPivot.rotation.z = Math.sin(animTime * 1.5) * 0.05;
      bellPivot.rotation.x = Math.cos(animTime * 1.2) * 0.03;
      clapperPivot.rotation.z = -Math.sin(animTime * 1.5) * 0.06;
      ribbon.rotation.z = Math.sin(animTime * 2.2) * 0.12;
    }

    // 2. Shockwave Expansion
    if (shockwaveTimer > 0) {
      shockwaveTimer = Math.max(0, shockwaveTimer - dt);
      const sp = 1 - shockwaveTimer / 1.4;
      const radiusScale = 0.5 + sp * 3.2;
      shockwave.scale.set(radiusScale, radiusScale, radiusScale);
      shockwaveMat.opacity = Math.max(0, (1 - sp) * 0.85);
      shockwave.rotation.z += dt * 1.2;
    } else {
      shockwaveMat.opacity = 0;
    }

    // 3. Aura & Sacred Light Beacon
    if (isActivated) {
      glowAura.position.y = 0.52 + Math.sin(animTime * 3.2) * 0.1;
      glowAura.rotation.z += dt * 0.6;
      (auraMat as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(animTime * 4.0) * 0.18;
      // Light beacon column breathing
      beaconMat.opacity = THREE.MathUtils.damp(beaconMat.opacity, 0.22 + Math.sin(animTime * 3.0) * 0.06, 3.0, dt);
      beacon.rotation.y += dt * 0.3;
    } else {
      glowAura.position.y = 0.5;
      (auraMat as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(animTime * 2) * 0.08;
      beaconMat.opacity = 0;
    }

    // 4. Update Burst Particles
    let hasLiveParticles = false;
    const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (particleLife[i] > 0) {
        particleLife[i] -= dt;
        hasLiveParticles = true;

        // Gravity and air drag
        velocities[i].x *= Math.pow(0.55, dt);
        velocities[i].z *= Math.pow(0.55, dt);
        velocities[i].y -= 4.8 * dt;

        posArray[i * 3 + 0] += velocities[i].x * dt;
        posArray[i * 3 + 1] += velocities[i].y * dt;
        posArray[i * 3 + 2] += velocities[i].z * dt;
      }
    }

    if (hasLiveParticles) {
      posAttr.needsUpdate = true;
      particleMat.opacity = THREE.MathUtils.damp(particleMat.opacity, 0.9, 5.0, dt);
    } else {
      particleMat.opacity = 0;
    }
  };

  return {
    group,
    bell: bellRim,
    glowAura,
    get activated() {
      return isActivated;
    },
    activate,
    update,
  };
}

// --- Victory Portal (Summit Goal Gateway) ---
export interface VictoryPortalModel {
  group: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  height: number;
  update: (dt: number, time?: number) => void;
  isInside: (pos: THREE.Vector3) => boolean;
}

export function createVictoryPortal(
  textures: ProceduralTextures,
  position: THREE.Vector3,
  themeColor: number = 0x38bdf8
): VictoryPortalModel {
  const group = new THREE.Group();
  group.position.copy(position);

  // 1. Stone threshold plinth on ground
  const plinthGeom = new THREE.CylinderGeometry(1.6, 1.8, 0.28, 16);
  plinthGeom.translate(0, 0.14, 0);
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    roughness: 0.85,
    metalness: 0.1,
  });
  const plinth = new THREE.Mesh(plinthGeom, stoneMat);
  plinth.receiveShadow = true;
  group.add(plinth);

  // Ground runic energy ring
  const runeRingGeom = new THREE.RingGeometry(0.5, 1.35, 24);
  const runeMat = new THREE.MeshBasicMaterial({
    color: themeColor,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const runeRing = new THREE.Mesh(runeRingGeom, runeMat);
  runeRing.rotation.x = -Math.PI / 2;
  runeRing.position.y = 0.29;
  group.add(runeRing);

  // 2. Pillars (Left & Right)
  const pillarMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    roughness: 0.75,
    metalness: 0.15,
  });
  const pillarGeom = new THREE.CylinderGeometry(0.18, 0.22, 3.4, 10);
  pillarGeom.translate(0, 1.7 + 0.28, 0);

  const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
  leftPillar.position.x = -1.15;
  leftPillar.castShadow = true;

  const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
  rightPillar.position.x = 1.15;
  rightPillar.castShadow = true;

  // Brass / Gold rings around pillars
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.3,
    metalness: 0.8,
  });
  const ringGeom = new THREE.TorusGeometry(0.22, 0.04, 6, 16);
  for (const p of [leftPillar, rightPillar]) {
    for (const yOff of [1.2, 2.4, 3.3]) {
      const ring = new THREE.Mesh(ringGeom, brassMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = yOff;
      p.add(ring);
    }
  }
  group.add(leftPillar, rightPillar);

  // 3. Top Arch / Lintel
  const archGeom = new THREE.BoxGeometry(2.9, 0.35, 0.45);
  archGeom.translate(0, 3.4 + 0.28, 0);
  const arch = new THREE.Mesh(archGeom, pillarMat);
  arch.castShadow = true;
  group.add(arch);

  // Top Pagoda / Crest trim
  const crestGeom = new THREE.ConeGeometry(0.55, 0.4, 4);
  crestGeom.translate(0, 3.8 + 0.28, 0);
  crestGeom.rotateY(Math.PI / 4);
  const crest = new THREE.Mesh(crestGeom, brassMat);
  group.add(crest);

  // Floating rotating Keystone Star / Crystal atop arch
  const gemGeom = new THREE.OctahedronGeometry(0.3, 0);
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
    roughness: 0.1,
    metalness: 0.2,
  });
  const gem = new THREE.Mesh(gemGeom, gemMat);
  gem.position.set(0, 4.3 + 0.28, 0);
  group.add(gem);

  // 4. Swirling Portal Energy Plane in Center
  const portalPlaneGeom = new THREE.PlaneGeometry(1.9, 2.8, 1, 1);
  const portalMat = new THREE.MeshBasicMaterial({
    color: themeColor,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const portalPlane = new THREE.Mesh(portalPlaneGeom, portalMat);
  portalPlane.position.set(0, 1.8 + 0.28, 0);
  group.add(portalPlane);

  // Rotating outer swirling ring
  const vortexGeom = new THREE.TorusGeometry(0.9, 0.05, 8, 24);
  const vortexMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const vortexRing1 = new THREE.Mesh(vortexGeom, vortexMat);
  vortexRing1.position.set(0, 1.8 + 0.28, 0);
  const vortexRing2 = new THREE.Mesh(vortexGeom, vortexMat.clone());
  vortexRing2.scale.setScalar(0.65);
  vortexRing2.position.set(0, 1.8 + 0.28, 0);
  group.add(vortexRing1, vortexRing2);

  // Floating energy sparkle motes inside portal
  const moteCount = 6;
  const motes: THREE.Mesh[] = [];
  const moteGeom = new THREE.SphereGeometry(0.06, 6, 6);
  const moteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  for (let i = 0; i < moteCount; i++) {
    const m = new THREE.Mesh(moteGeom, moteMat);
    m.position.set((Math.random() - 0.5) * 1.4, 0.6 + Math.random() * 2.2, (Math.random() - 0.5) * 0.3);
    group.add(m);
    motes.push(m);
  }

  // Vertical light beacon beam (soft translucent cylinder rising upward)
  const beamGeom = new THREE.CylinderGeometry(0.85, 0.85, 14, 16, 1, true);
  beamGeom.translate(0, 7 + 0.28, 0);
  const beamMat = new THREE.MeshBasicMaterial({
    color: themeColor,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeom, beamMat);
  group.add(beam);

  let animTime = 0;
  const update = (dt: number, time?: number) => {
    animTime += dt;
    const t = time ?? animTime;

    // Gem rotating & floating
    gem.rotation.y = t * 1.6;
    gem.position.y = 4.3 + 0.28 + Math.sin(t * 3.0) * 0.08;

    // Ground runes breathing
    runeRing.rotation.z = -t * 0.6;
    runeMat.opacity = 0.55 + Math.sin(t * 3.2) * 0.2;

    // Swirling rings
    vortexRing1.rotation.z = t * 2.2;
    vortexRing2.rotation.z = -t * 3.0;
    portalMat.opacity = 0.5 + Math.sin(t * 4.0) * 0.18;

    // Sparkle motes rising
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.position.y += dt * (0.8 + (i % 3) * 0.4);
      if (m.position.y > 3.2) {
        m.position.y = 0.4;
        m.position.x = (((i * 0.37) % 1) - 0.5) * 1.4;
      }
      m.position.z = Math.sin(t * 3 + i) * 0.15;
    }
  };

  const isInside = (pos: THREE.Vector3): boolean => {
    const dx = pos.x - position.x;
    const dz = pos.z - position.z;
    const distXZ = Math.hypot(dx, dz);
    const dy = pos.y - position.y;
    return distXZ < 1.35 && dy >= -0.3 && dy <= 3.4;
  };

  return {
    group,
    position,
    radius: 1.35,
    height: 3.4,
    update,
    isInside,
  };
}

// --- Collectible Item: Sun Prism / Golden Acorn ---
export interface CollectibleModel {
  group: THREE.Group;
  id: string;
  type: 'sun_crystal' | 'golden_acorn';
  collected: boolean;
  update: (dt: number) => void;
}

export function createCollectible(
  id: string,
  type: 'sun_crystal' | 'golden_acorn',
  position: THREE.Vector3
): CollectibleModel {
  const group = new THREE.Group();
  group.position.copy(position);

  let mesh: THREE.Mesh;
  if (type === 'golden_acorn') {
    const acornMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      roughness: 0.2,
      metalness: 0.85,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x6b4226,
      roughness: 0.9,
      metalness: 0.05,
    });
    // Acorn nut
    const nutGeom = new THREE.SphereGeometry(0.24, 12, 12);
    nutGeom.scale(1, 1.25, 1);
    const nut = new THREE.Mesh(nutGeom, acornMat);

    // Acorn cap
    const capGeom = new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.position.y = 0.1;

    // Stem hook
    const stemGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6);
    const stem = new THREE.Mesh(stemGeom, capMat);
    stem.position.y = 0.38;

    group.add(nut, cap, stem);
    mesh = nut;
  } else {
    // Sun Crystal Prism (Faceted Bipyramid)
    const crystalGeom = new THREE.OctahedronGeometry(0.28, 0);
    crystalGeom.scale(1, 1.4, 1);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x48cae4,
      roughness: 0.15,
      metalness: 0.6,
      emissive: 0x0077b6,
      emissiveIntensity: 0.4,
    });
    mesh = new THREE.Mesh(crystalGeom, crystalMat);
    group.add(mesh);
  }

  // Floating sparkle halo
  const haloGeom = new THREE.RingGeometry(0.35, 0.38, 16);
  const haloMat = new THREE.MeshBasicMaterial({
    color: type === 'golden_acorn' ? 0xffd166 : 0x90e0ef,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const halo = new THREE.Mesh(haloGeom, haloMat);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  let isCollected = false;
  let time = Math.random() * 10;
  const initialY = position.y;

  const update = (dt: number) => {
    if (isCollected) {
      group.scale.multiplyScalar(Math.max(0, 1 - dt * 8));
      return;
    }
    time += dt;
    group.position.y = initialY + Math.sin(time * 3) * 0.15;
    group.rotation.y += dt * 1.8;
    halo.rotation.z += dt * 2.5;
  };

  return {
    group,
    id,
    type,
    get collected() {
      return isCollected;
    },
    set collected(val: boolean) {
      isCollected = val;
    },
    update,
  };
}

// --- Updraft Thermal Geyser (Gentle wind funnel that lifts player) ---
export interface UpdraftVortexModel {
  group: THREE.Group;
  height: number;
  radius: number;
  update: (dt: number) => void;
}

export function createUpdraftVortex(radius: number = 2.0, height: number = 16.0): UpdraftVortexModel {
  const group = new THREE.Group();

  // Swirling atmospheric wind rings (10 ascending rings for towering thermal column)
  const ringCount = 10;
  const rings: THREE.Mesh[] = [];
  const ringGeom = new THREE.TorusGeometry(radius * 0.85, 0.05, 8, 28);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x90e0ef,
    transparent: true,
    opacity: 0.55,
  });

  for (let i = 0; i < ringCount; i++) {
    const ring = new THREE.Mesh(ringGeom, ringMat.clone());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = (i / ringCount) * height;
    rings.push(ring);
    group.add(ring);
  }

  // Vertical thermal spiral ribbon/whisper particles
  const particleCount = 18;
  const particles: THREE.Mesh[] = [];
  const partGeom = new THREE.SphereGeometry(0.12, 6, 6);
  const partMat = new THREE.MeshBasicMaterial({
    color: 0xe0fbfc,
    transparent: true,
    opacity: 0.7,
  });

  for (let i = 0; i < particleCount; i++) {
    const p = new THREE.Mesh(partGeom, partMat);
    const angle = (i / particleCount) * Math.PI * 4;
    const r = radius * (0.3 + (i % 3) * 0.25);
    p.position.set(Math.cos(angle) * r, (i / particleCount) * height, Math.sin(angle) * r);
    particles.push(p);
    group.add(p);
  }

  // Base stone rim with warm rune carvings
  const baseGeom = new THREE.TorusGeometry(radius * 1.1, 0.22, 10, 24);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x6c757d,
    roughness: 0.8,
    metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.rotation.x = Math.PI / 2;
  base.position.y = 0.12;
  group.add(base);

  // Inner thermal glow disc
  const discGeom = new THREE.CircleGeometry(radius * 0.95, 24);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x48cae4,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(discGeom, discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.08;
  group.add(disc);

  let swirlTime = 0;

  const update = (dt: number) => {
    swirlTime += dt;
    // Animate swirling ascending rings
    rings.forEach((ring, idx) => {
      ring.position.y += dt * 4.2;
      if (ring.position.y > height) {
        ring.position.y = 0.2;
      }
      ring.rotation.z += dt * (idx % 2 === 0 ? 2.4 : -2.4);
      const ratio = ring.position.y / height;
      const baseScale = 0.8 + Math.sin(ratio * Math.PI) * 0.4;
      ring.scale.set(baseScale, baseScale, baseScale);
      (ring.material as THREE.MeshBasicMaterial).opacity = Math.sin(ratio * Math.PI) * 0.65;
    });

    // Animate upward spiral particles
    particles.forEach((p, idx) => {
      p.position.y += dt * 5.0;
      if (p.position.y > height) {
        p.position.y = 0.3;
      }
      const angle = swirlTime * 3.0 + idx * 0.6;
      const r = radius * (0.35 + (idx % 3) * 0.2);
      p.position.x = Math.cos(angle) * r;
      p.position.z = Math.sin(angle) * r;
    });

    disc.rotation.z += dt * 0.6;
  };

  return {
    group,
    height,
    radius,
    update,
  };
}

// --- Swinging Bamboo Chime Obstacle ---
export interface SwingingObstacleModel {
  group: THREE.Group;
  pivot: THREE.Group;
  armLength: number;
  bobRadius: number;
  period: number;
  update: (time: number) => void;
  getHitboxPosition: (target: THREE.Vector3) => void;
}

export function createSwingingObstacle(
  armLength: number = 4.0,
  bobRadius: number = 0.7,
  period: number = 3.0,
  textures: ProceduralTextures
): SwingingObstacleModel {
  const group = new THREE.Group();

  // Top mount beam
  const beamGeom = new THREE.BoxGeometry(0.3, 0.3, 2.0);
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.75,
    metalness: 0.1,
  });
  const beam = new THREE.Mesh(beamGeom, woodMat);
  group.add(beam);

  // Pivot container
  const pivot = new THREE.Group();
  group.add(pivot);

  // Hanging bamboo cord
  const cordGeom = new THREE.CylinderGeometry(0.04, 0.04, armLength, 6);
  cordGeom.translate(0, -armLength / 2, 0); // pivot at top
  const cord = new THREE.Mesh(cordGeom, woodMat);
  pivot.add(cord);

  // Heavy padded bell / chime bob at the bottom
  const bobGeom = new THREE.DodecahedronGeometry(bobRadius, 1);
  const bobMat = new THREE.MeshStandardMaterial({
    color: 0xcc5a71, // soft woven berry yarn ball
    roughness: 0.9,
    metalness: 0.05,
  });
  const bob = new THREE.Mesh(bobGeom, bobMat);
  bob.position.y = -armLength;
  bob.castShadow = true;
  pivot.add(bob);

  const update = (time: number) => {
    // Harmonic oscillation
    const angle = Math.sin((time * Math.PI * 2) / period) * 0.75;
    pivot.rotation.z = angle;
  };

  const getHitboxPosition = (target: THREE.Vector3) => {
    bob.getWorldPosition(target);
  };

  return {
    group,
    pivot,
    armLength,
    bobRadius,
    period,
    update,
    getHitboxPosition,
  };
}

// --- Dynamic Rolling Wool Yarn Ball Physics Obstacle ---
export interface RollingWoolBallModel {
  group: THREE.Group;
  ball: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  mass: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  update: (dt: number) => void;
  applyImpulse: (impulse: THREE.Vector3) => void;
}

export function createRollingWoolBall(
  radius: number = 0.65,
  initialPos: THREE.Vector3,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  color: number = 0xf4a261,
  textures: ProceduralTextures
): RollingWoolBallModel {
  const group = new THREE.Group();
  group.position.copy(initialPos);

  const woolMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });

  // Main knit sphere
  const ballGeom = new THREE.IcosahedronGeometry(radius, 2);
  const ball = new THREE.Mesh(ballGeom, woolMat);
  ball.position.y = radius;
  ball.castShadow = true;
  group.add(ball);

  // Wrapped yarn string ribs
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    transparent: true,
    opacity: 0.5,
  });
  const ringGeom = new THREE.TorusGeometry(radius * 0.98, radius * 0.04, 6, 16);
  const ring1 = new THREE.Mesh(ringGeom, ribMat);
  ring1.rotation.x = Math.PI / 4;
  ball.add(ring1);

  const ring2 = new THREE.Mesh(ringGeom, ribMat);
  ring2.rotation.y = Math.PI / 3;
  ball.add(ring2);

  // Contact shadow
  const shadowGeom = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.shadow,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeom, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  const position = initialPos.clone();
  const velocity = new THREE.Vector3(1.8, 0, 0); // initial roll

  const applyImpulse = (imp: THREE.Vector3) => {
    velocity.add(imp);
  };

  const update = (dt: number) => {
    // Integrate motion along track
    position.x += velocity.x * dt;
    position.z += velocity.z * dt;

    // Bounce off platform boundaries
    if (position.x > bounds.maxX) {
      position.x = bounds.maxX;
      velocity.x = -Math.abs(velocity.x);
    } else if (position.x < bounds.minX) {
      position.x = bounds.minX;
      velocity.x = Math.abs(velocity.x);
    }

    if (position.z > bounds.maxZ) {
      position.z = bounds.maxZ;
      velocity.z = -Math.abs(velocity.z);
    } else if (position.z < bounds.minZ) {
      position.z = bounds.minZ;
      velocity.z = Math.abs(velocity.z);
    }

    // Physical rolling rotation proportional to linear velocity: omega = v / r
    ball.rotation.z -= (velocity.x / radius) * dt;
    ball.rotation.x += (velocity.z / radius) * dt;

    group.position.x = position.x;
    group.position.z = position.z;
    group.position.y = position.y;
  };

  return {
    group,
    ball,
    position,
    velocity,
    radius,
    mass: 2.0,
    bounds,
    update,
    applyImpulse,
  };
}

// --- 1. Rotating Floral Pinwheel Barrier (Cozy Windmill Obstacle) ---
export interface RotatingPinwheelModel {
  group: THREE.Group;
  spinner: THREE.Group;
  speed: number;
  bladeRadius: number;
  axis: 'x' | 'z';
  update: (time: number) => void;
  getHitboxPositions: (targets: THREE.Vector3[]) => void;
}

export function createRotatingPinwheel(
  bladeRadius: number = 2.8,
  speed: number = 1.35,
  axis: 'x' | 'z' = 'z',
  textures: ProceduralTextures
): RotatingPinwheelModel {
  const group = new THREE.Group();

  // Central wooden post with carved rings
  const postGeom = new THREE.CylinderGeometry(0.18, 0.22, 3.8, 8);
  postGeom.translate(0, 1.9, 0);
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.75,
    metalness: 0.1,
  });
  const post = new THREE.Mesh(postGeom, woodMat);
  post.castShadow = true;
  post.receiveShadow = true;
  group.add(post);

  // Stone base pedestal
  const baseGeom = new THREE.CylinderGeometry(0.5, 0.65, 0.4, 8);
  baseGeom.translate(0, 0.2, 0);
  const baseMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    roughness: 0.85,
    metalness: 0.1,
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.receiveShadow = true;
  group.add(base);

  // Spinner container
  const spinner = new THREE.Group();
  spinner.position.set(0, 3.2, 0);
  group.add(spinner);

  // Brass axle hub
  const hubGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.45, 12);
  hubGeom.rotateX(Math.PI / 2);
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xdfb15b,
    metalness: 0.8,
    roughness: 0.25,
  });
  const hub = new THREE.Mesh(hubGeom, brassMat);
  hub.castShadow = true;
  spinner.add(hub);

  // 4 Floral wooden petal blades in cozy pastel tones
  const petalColors = [0xf4a261, 0x2a9d8f, 0xe76f51, 0xe9c46a];
  const bladeHitboxPaddles: THREE.Mesh[] = [];

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const bladeArm = new THREE.Group();
    bladeArm.rotation.z = angle;

    // Wooden connecting arm
    const armGeom = new THREE.BoxGeometry(0.08, bladeRadius * 0.7, 0.08);
    armGeom.translate(0, bladeRadius * 0.35, 0);
    const armMesh = new THREE.Mesh(armGeom, woodMat);
    armMesh.castShadow = true;
    bladeArm.add(armMesh);

    // Carved petal paddle at blade tip
    const paddleGeom = new THREE.BoxGeometry(0.65, 0.95, 0.1);
    paddleGeom.translate(0, bladeRadius * 0.78, 0);
    const paddleMat = new THREE.MeshStandardMaterial({
      color: petalColors[i],
      roughness: 0.6,
      metalness: 0.1,
    });
    const paddle = new THREE.Mesh(paddleGeom, paddleMat);
    paddle.castShadow = true;
    bladeArm.add(paddle);
    bladeHitboxPaddles.push(paddle);

    spinner.add(bladeArm);
  }

  // Orient axis
  if (axis === 'x') {
    spinner.rotation.y = Math.PI / 2;
  }

  const update = (time: number) => {
    spinner.rotation.z = time * speed;
  };

  const getHitboxPositions = (targets: THREE.Vector3[]) => {
    for (let i = 0; i < bladeHitboxPaddles.length; i++) {
      if (!targets[i]) targets[i] = new THREE.Vector3();
      bladeHitboxPaddles[i].getWorldPosition(targets[i]);
    }
  };

  return {
    group,
    spinner,
    speed,
    bladeRadius,
    axis,
    update,
    getHitboxPositions,
  };
}

// --- 2. Rotating Balance Log (Mossy Rolling Log Obstacle) ---
export interface RotatingBalanceLogModel {
  group: THREE.Group;
  logMesh: THREE.Mesh;
  length: number;
  radius: number;
  speed: number;
  axis: 'x' | 'z';
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; y: number };
  update: (time: number) => void;
}

export function createRotatingBalanceLog(
  length: number = 7.0,
  radius: number = 0.55,
  speed: number = 1.1,
  axis: 'x' | 'z' = 'z',
  position: THREE.Vector3 = new THREE.Vector3(),
  textures: ProceduralTextures
): RotatingBalanceLogModel {
  const group = new THREE.Group();
  group.position.copy(position);

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.8,
    metalness: 0.05,
  });

  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x6ca34e,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Main rotating trunk
  const logGeom = new THREE.CylinderGeometry(radius, radius, length, 12);
  if (axis === 'z') {
    logGeom.rotateX(Math.PI / 2);
  } else {
    logGeom.rotateZ(Math.PI / 2);
  }
  const logMesh = new THREE.Mesh(logGeom, woodMat);
  logMesh.castShadow = true;
  logMesh.receiveShadow = true;
  group.add(logMesh);

  // Decorative moss tufts on log surface
  for (let i = 0; i < 4; i++) {
    const tuftGeom = new THREE.SphereGeometry(radius * 0.35, 6, 6);
    tuftGeom.scale(1.2, 0.4, 1.0);
    const tuft = new THREE.Mesh(tuftGeom, mossMat);
    const offset = ((i - 1.5) / 1.5) * (length * 0.38);
    if (axis === 'z') {
      tuft.position.set(0, radius * 0.9, offset);
    } else {
      tuft.position.set(offset, radius * 0.9, 0);
    }
    logMesh.add(tuft);
  }

  // Stone brackets at both ends
  const bracketGeom = new THREE.BoxGeometry(1.2, 1.4, 0.8);
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    roughness: 0.85,
    metalness: 0.1,
  });

  const b1 = new THREE.Mesh(bracketGeom, stoneMat);
  const b2 = new THREE.Mesh(bracketGeom, stoneMat);
  if (axis === 'z') {
    b1.position.set(0, -0.4, -length / 2 - 0.4);
    b2.position.set(0, -0.4, length / 2 + 0.4);
  } else {
    b1.position.set(-length / 2 - 0.4, -0.4, 0);
    b2.position.set(length / 2 + 0.4, -0.4, 0);
  }
  b1.receiveShadow = true;
  b2.receiveShadow = true;
  group.add(b1, b2);

  const halfL = length / 2;
  const bounds = {
    minX: axis === 'z' ? position.x - radius : position.x - halfL,
    maxX: axis === 'z' ? position.x + radius : position.x + halfL,
    minZ: axis === 'z' ? position.z - halfL : position.z - radius,
    maxZ: axis === 'z' ? position.z + halfL : position.z + radius,
    y: position.y + radius,
  };

  const update = (time: number) => {
    if (axis === 'z') {
      logMesh.rotation.z = time * speed;
    } else {
      logMesh.rotation.x = time * speed;
    }
  };

  return {
    group,
    logMesh,
    length,
    radius,
    speed,
    axis,
    bounds,
    update,
  };
}

// --- 3. Warm Spore Steam Vent (Puffing Geyser Vent) ---
export interface SporeSteamVentModel {
  group: THREE.Group;
  radius: number;
  isErupting: boolean;
  cycleTimer: number;
  period: number;
  update: (dt: number) => void;
  getHitboxPosition: (target: THREE.Vector3) => void;
}

export function createSporeSteamVent(
  radius: number = 1.2,
  period: number = 3.6,
  position: THREE.Vector3 = new THREE.Vector3(),
  textures: ProceduralTextures
): SporeSteamVentModel {
  const group = new THREE.Group();
  group.position.copy(position);

  // Stone caldera ring
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    roughness: 0.85,
    metalness: 0.1,
  });

  const rimGeom = new THREE.TorusGeometry(radius, 0.28, 8, 16);
  rimGeom.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeom, stoneMat);
  rim.position.y = 0.2;
  rim.receiveShadow = true;
  group.add(rim);

  // Boiling warm water surface inside
  const poolGeom = new THREE.CircleGeometry(radius * 0.9, 16);
  poolGeom.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshStandardMaterial({
    color: 0x56cfe1,
    roughness: 0.1,
    metalness: 0.8,
  });
  const pool = new THREE.Mesh(poolGeom, poolMat);
  pool.position.y = 0.12;
  group.add(pool);

  // Steam blast cloud cluster
  const steamGroup = new THREE.Group();
  steamGroup.position.y = 0.3;
  group.add(steamGroup);

  const steamRings: THREE.Mesh[] = [];
  const ringGeom = new THREE.TorusGeometry(radius * 0.7, 0.08, 6, 16);
  ringGeom.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe8d6,
    transparent: true,
    opacity: 0.0,
  });

  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(ringGeom, ringMat.clone());
    steamRings.push(ring);
    steamGroup.add(ring);
  }

  let cycleTimer = Math.random() * period;
  let isErupting = false;

  const update = (dt: number) => {
    cycleTimer = (cycleTimer + dt) % period;
    // Erupts for 1.1s out of period
    const eruptDuration = 1.1;
    isErupting = cycleTimer < eruptDuration;

    if (isErupting) {
      const progress = cycleTimer / eruptDuration;
      steamRings.forEach((r, idx) => {
        const ringProg = Math.min(1, Math.max(0, progress * 1.5 - idx * 0.2));
        r.position.y = ringProg * 4.8;
        const scale = 0.8 + ringProg * 1.6;
        r.scale.set(scale, scale, scale);
        (r.material as THREE.MeshBasicMaterial).opacity = Math.sin(ringProg * Math.PI) * 0.7;
      });
    } else {
      steamRings.forEach((r) => {
        (r.material as THREE.MeshBasicMaterial).opacity = 0;
      });
    }
  };

  const getHitboxPosition = (target: THREE.Vector3) => {
    group.getWorldPosition(target);
    target.y += 1.5;
  };

  return {
    group,
    radius,
    get isErupting() {
      return isErupting;
    },
    cycleTimer,
    period,
    update,
    getHitboxPosition,
  };
}

