import { gsap } from "gsap";

const cover = document.querySelector('[data-page="cover"] .cover-page');

if (cover) {
  const frame = cover.querySelector(".cover-visual-frame");
  const video = cover.querySelector(".cover-video-media");
  const outerOrbit = cover.querySelector(".cover-orbit-outer");
  const innerOrbit = cover.querySelector(".cover-orbit-inner");
  const rays = cover.querySelectorAll(".cover-ray");
  const scanline = cover.querySelector(".cover-scanline");
  const liveDot = cover.querySelector(".cover-feed-head i");
  const animatedEntrance = cover.querySelectorAll(
    ".cover-visual, .cover-stat, .cover-system-label, .cover-title, .cover-kicker, .cover-subtitle, .cover-cta",
  );
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (video) {
    video.playbackRate = 0.86;
    if (!reducedMotion.matches) video.play().catch(() => {});
    else video.pause();
  }

  const media = gsap.matchMedia();

  media.add(
    {
      desktop: "(min-width: 981px)",
      reduceMotion: "(prefers-reduced-motion: reduce)",
    },
    ({ conditions }) => {
      const { desktop, reduceMotion: shouldReduceMotion } = conditions;

      if (shouldReduceMotion) {
        video?.pause();
        gsap.set(animatedEntrance, { autoAlpha: 1, x: 0, y: 0, scale: 1 });
        return undefined;
      }

      video?.play().catch(() => {});

      gsap.from(animatedEntrance, {
        autoAlpha: 0,
        y: desktop ? 18 : 10,
        duration: 0.82,
        stagger: 0.065,
        ease: "power3.out",
        clearProps: "visibility",
      });

      gsap.fromTo(
        frame,
        { scale: 0.975, rotationY: desktop ? -3 : 0 },
        {
          scale: 1,
          rotationY: 0,
          duration: 1.15,
          ease: "power3.out",
          clearProps: "rotationY,scale",
        },
      );

      gsap.to(video, {
        scale: 1.055,
        xPercent: -1.2,
        yPercent: 0.7,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.to(outerOrbit, {
        rotation: "360_cw",
        duration: 22,
        repeat: -1,
        ease: "none",
        transformOrigin: "50% 50%",
      });

      gsap.to(innerOrbit, {
        rotation: "360_ccw",
        duration: 15,
        repeat: -1,
        ease: "none",
        transformOrigin: "50% 50%",
      });

      gsap.to(rays, {
        autoAlpha: 0.38,
        scaleX: 0.94,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        stagger: {
          each: 0.24,
          from: "center",
        },
        ease: "sine.inOut",
      });

      gsap.fromTo(
        scanline,
        { yPercent: -110, autoAlpha: 0 },
        {
          yPercent: 620,
          autoAlpha: 0.72,
          duration: 4.8,
          repeat: -1,
          repeatDelay: 0.8,
          ease: "none",
        },
      );

      gsap.to(liveDot, {
        scale: 1.7,
        autoAlpha: 0.45,
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      if (!desktop) return undefined;

      const onPointerMove = (event) => {
        const rect = frame.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;

        gsap.to(frame, {
          rotationY: x * 5,
          rotationX: y * -4,
          duration: 0.7,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      const onPointerLeave = () => {
        gsap.to(frame, {
          rotationX: 0,
          rotationY: 0,
          duration: 0.9,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      frame.addEventListener("pointermove", onPointerMove);
      frame.addEventListener("pointerleave", onPointerLeave);

      return () => {
        frame.removeEventListener("pointermove", onPointerMove);
        frame.removeEventListener("pointerleave", onPointerLeave);
      };
    },
  );

  document.addEventListener("visibilitychange", () => {
    if (!video) return;
    if (document.hidden) video.pause();
    else if (!reducedMotion.matches) video.play().catch(() => {});
  });
}
