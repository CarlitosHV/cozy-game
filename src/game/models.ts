/**
 * Procedural 3D Composite Models for Cozy Parkour World
 * Follows Three.js 3-12 Part Composite Group guidelines with bottom-center pivots
 * and varied PBR roughness/metalness. Zero external dependencies.
 */
import * as THREE from 'three';
import { ProceduralTextures } from './textures';

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
  updateAnimation: (speed: number, isGrounded: boolean, dt: number, windTime: number) => void;
}

export function createPlayerCharacter(textures: ProceduralTextures): PlayerCharacterModel {
  const group = new THREE.Group();

  // Materials with varied roughness & PBR richness
  const sweaterMat = new THREE.MeshStandardMaterial({
    color: 0xdb6b50, // warm terracotta knit sweater
    roughness: 0.85,
    metalness: 0.05,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xfed0bb,
    roughness: 0.55,
    metalness: 0.0,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x543825, // warm dark caramel hair
    roughness: 0.8,
    metalness: 0.05,
  });

  const hatMat = new THREE.MeshStandardMaterial({
    color: 0x3d5a80, // deep slate-blue beanie
    roughness: 0.9,
    metalness: 0.0,
  });

  const pompomMat = new THREE.MeshStandardMaterial({
    color: 0xf4f1de, // cozy cream pompom
    roughness: 0.95,
    metalness: 0.0,
  });

  const scarfMat = new THREE.MeshStandardMaterial({
    color: 0xf2cc8f, // warm honey mustard scarf
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
    color: 0x3d312a, // dark brown hiking boots
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

  // 1. Primary: Torso (Terracotta sweater body)
  const bodyGeom = new THREE.CapsuleGeometry(0.22, 0.28, 8, 16);
  const body = new THREE.Mesh(bodyGeom, sweaterMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

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

  // 2. Primary: Head
  const headGeom = new THREE.SphereGeometry(0.22, 16, 16);
  const head = new THREE.Mesh(headGeom, skinMat);
  head.position.y = 0.95;
  head.castShadow = true;
  group.add(head);

  // Soft caramel hair bangs peeking out from under the beanie
  const hairBangs = new THREE.Group();
  for (let b = 0; b < 5; b++) {
    const bangGeom = new THREE.ConeGeometry(0.045, 0.1, 6);
    const bang = new THREE.Mesh(bangGeom, hairMat);
    const angle = (b - 2) * 0.18;
    bang.position.set(Math.sin(angle) * 0.18, 1.03, Math.cos(angle) * 0.18);
    bang.rotation.x = 0.45;
    bang.rotation.z = -angle * 0.5;
    hairBangs.add(bang);
  }
  // Side hair tufts framing ears
  const leftTuft = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), hairMat);
  leftTuft.position.set(0.21, 0.94, 0.05);
  leftTuft.rotation.z = -0.4;
  const rightTuft = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), hairMat);
  rightTuft.position.set(-0.21, 0.94, 0.05);
  rightTuft.rotation.z = 0.4;
  hairBangs.add(leftTuft, rightTuft);
  group.add(hairBangs);

  // Ears
  const earGeom = new THREE.SphereGeometry(0.045, 8, 8);
  earGeom.scale(0.5, 1, 0.8);
  const leftEar = new THREE.Mesh(earGeom, skinMat);
  leftEar.position.set(0.22, 0.95, 0);
  const rightEar = new THREE.Mesh(earGeom, skinMat);
  rightEar.position.set(-0.22, 0.95, 0);
  group.add(leftEar, rightEar);

  // Eyes (Cute glossy black beads with white twinkle dot)
  const eyeGeom = new THREE.SphereGeometry(0.035, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
  leftEye.position.set(0.08, 0.97, 0.19);
  const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
  rightEye.position.set(-0.08, 0.97, 0.19);

  // Eye highlights
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hlGeom = new THREE.SphereGeometry(0.012, 6, 6);
  const leftHl = new THREE.Mesh(hlGeom, hlMat);
  leftHl.position.set(0.09, 0.985, 0.215);
  const rightHl = new THREE.Mesh(hlGeom, hlMat);
  rightHl.position.set(-0.07, 0.985, 0.215);
  group.add(leftEye, rightEye, leftHl, rightHl);

  // Smiling mouth (Gentle curved smile line)
  const mouthGeom = new THREE.TorusGeometry(0.03, 0.008, 6, 10, Math.PI);
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
  const mouth = new THREE.Mesh(mouthGeom, mouthMat);
  mouth.position.set(0, 0.89, 0.21);
  mouth.rotation.x = 0.2;
  mouth.rotation.z = Math.PI;
  group.add(mouth);

  // Cute blushing rosy cheeks
  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff9999, transparent: true, opacity: 0.65 });
  const cheekGeom = new THREE.SphereGeometry(0.032, 8, 8);
  const leftCheek = new THREE.Mesh(cheekGeom, cheekMat);
  leftCheek.position.set(0.12, 0.93, 0.17);
  const rightCheek = new THREE.Mesh(cheekGeom, cheekMat);
  rightCheek.position.set(-0.12, 0.93, 0.17);
  group.add(leftCheek, rightCheek);

  // 3. Cozy Beanie Hat
  const hatGeom = new THREE.ConeGeometry(0.24, 0.28, 16);
  const hat = new THREE.Mesh(hatGeom, hatMat);
  hat.position.set(0, 1.15, -0.02);
  hat.rotation.x = -0.15;
  hat.castShadow = true;
  group.add(hat);

  // Folded beanie rim
  const rimGeom = new THREE.TorusGeometry(0.22, 0.05, 8, 20);
  const rim = new THREE.Mesh(rimGeom, hatMat);
  rim.position.set(0, 1.05, -0.01);
  rim.rotation.x = Math.PI / 2 - 0.15;
  group.add(rim);

  // Fluffy cream pompom on top
  const pompomGeom = new THREE.SphereGeometry(0.08, 12, 12);
  const hatPompom = new THREE.Mesh(pompomGeom, pompomMat);
  hatPompom.position.set(0, 1.32, -0.06);
  group.add(hatPompom);

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
  leftArm.position.set(0.25, 0.68, 0); // Shoulder pivot

  const armGeom = new THREE.CapsuleGeometry(0.055, 0.16, 6, 8);
  armGeom.translate(0, -0.08, 0);
  const leftSleeve = new THREE.Mesh(armGeom, sweaterMat);
  leftSleeve.castShadow = true;
  leftArm.add(leftSleeve);

  // Sleeve cuff
  const cuffGeom = new THREE.TorusGeometry(0.06, 0.02, 6, 12);
  cuffGeom.rotateX(Math.PI / 2);
  const leftCuff = new THREE.Mesh(cuffGeom, hatMat); // matching slate blue cuffs
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
  rightArm.position.set(-0.25, 0.68, 0); // Shoulder pivot

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

  // 6. Detailed Adventurer Backpack with Bedroll & Flask
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

  // Miniature brass lantern hanging on backpack hook
  const lanternPost = new THREE.Group();
  lanternPost.position.set(0.14, 0.52, -0.32);

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

  // 8. Floating Cloud Sprite Companion ("Nubi")
  const companionSprite = new THREE.Group();
  companionSprite.position.set(0.42, 1.25, 0.15); // hovers near shoulder

  const wispMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.05,
    emissive: 0xddf2fd,
    emissiveIntensity: 0.35,
  });
  // 3 soft puffs forming tiny cloud sprite
  const cPuff1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), wispMat);
  const cPuff2 = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), wispMat);
  cPuff2.position.set(-0.065, -0.015, 0);
  const cPuff3 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), wispMat);
  cPuff3.position.set(0.065, -0.02, 0);

  // Cute blinking dot eyes on cloud sprite
  const spriteEyeGeom = new THREE.SphereGeometry(0.014, 6, 6);
  const sEye1 = new THREE.Mesh(spriteEyeGeom, eyeMat);
  sEye1.position.set(0.03, 0.01, 0.085);
  const sEye2 = new THREE.Mesh(spriteEyeGeom, eyeMat);
  sEye2.position.set(-0.03, 0.01, 0.085);

  // Golden floating sparkle halo over sprite
  const sHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.09, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide })
  );
  sHalo.position.y = 0.13;
  sHalo.rotation.x = Math.PI / 2;

  companionSprite.add(cPuff1, cPuff2, cPuff3, sEye1, sEye2, sHalo);
  group.add(companionSprite);

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

  // Animation cycle helper
  let walkCycle = 0;
  const updateAnimation = (speed: number, isGrounded: boolean, dt: number, windTime: number) => {
    if (isGrounded) {
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
        head.position.y = 0.95 + Math.abs(Math.sin(walkCycle)) * 0.035;
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
        head.position.y = 0.95 + Math.sin(walkCycle) * 0.02;
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

    // Scarf fluttering reacting dynamically to movement & wind gusts
    const trailAngle = (speed > 0.5 ? 0.65 : 0.2) + Math.sin(windTime * 6) * 0.28;
    scarfTail1.rotation.x = trailAngle;
    scarfTail1.rotation.y = Math.cos(windTime * 4.5) * 0.22;
    scarfTail2.rotation.x = trailAngle * 0.92;
    scarfTail2.rotation.y = -Math.sin(windTime * 5.0) * 0.22;
    hatPompom.rotation.x = Math.sin(windTime * 3.5) * 0.12;

    // Companion Cloud Sprite smooth floating orbit
    companionSprite.position.x = 0.4 + Math.sin(windTime * 2.5) * 0.08;
    companionSprite.position.y = 1.25 + Math.sin(windTime * 3.2) * 0.12;
    companionSprite.position.z = 0.15 + Math.cos(windTime * 2.5) * 0.08;
    sHalo.rotation.z += dt * 1.5;
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
    updateAnimation,
  };
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
    roughness: 0.2,
    metalness: 0.85,
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

  // Hanging sacred bell (floats & spins gently)
  const bellGeom = new THREE.CylinderGeometry(0.12, 0.18, 0.28, 12);
  const bell = new THREE.Mesh(bellGeom, bellMat);
  bell.position.set(0, 1.6, 0);
  bell.castShadow = true;
  group.add(bell);

  // Soft glowing aura torus
  const auraGeom = new THREE.TorusGeometry(0.7, 0.04, 8, 24);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x64dfdf,
    transparent: true,
    opacity: 0.3,
  });
  const glowAura = new THREE.Mesh(auraGeom, auraMat);
  glowAura.rotation.x = Math.PI / 2;
  glowAura.position.y = 0.5;
  group.add(glowAura);

  let isActivated = false;
  let animTime = 0;

  const activate = () => {
    isActivated = true;
    (auraMat as THREE.MeshBasicMaterial).color.setHex(0xffd166);
    (auraMat as THREE.MeshBasicMaterial).opacity = 0.75;
  };

  const update = (dt: number) => {
    animTime += dt;
    bell.rotation.y += dt * 0.8;
    if (isActivated) {
      glowAura.position.y = 0.55 + Math.sin(animTime * 3) * 0.12;
      glowAura.rotation.z += dt * 0.5;
      (auraMat as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(animTime * 4) * 0.2;
    } else {
      glowAura.position.y = 0.5;
      (auraMat as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(animTime * 2) * 0.1;
    }
  };

  return {
    group,
    bell,
    glowAura,
    get activated() {
      return isActivated;
    },
    activate,
    update,
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

