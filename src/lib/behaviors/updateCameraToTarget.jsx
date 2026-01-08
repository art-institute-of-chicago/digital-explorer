import gsap from "gsap";

function updateCameraToTarget(target) {

  gsap.to(this.position, {
    x: target.position.x,
    y: target.position.y,
    z: target.position.z,
    duration: 2,
    ease: "power2.inOut"
  });

}

export default updateCameraToTarget