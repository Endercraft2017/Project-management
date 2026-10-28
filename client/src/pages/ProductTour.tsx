import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Swiper, SwiperSlide } from "swiper/react";
import {
  A11y,
  Autoplay,
  EffectCoverflow,
  Navigation,
  Pagination,
} from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/a11y";
import "./ProductTour.css";

const slides = [
  {
    key: "tasks",
    eyebrow: "01 / MAKE A PLAN",
    title: "A place for every next step.",
    body: "Bring sprints, tasks and the details that matter into one clear view.",
  },
  {
    key: "timeline",
    eyebrow: "02 / SEE THE BIG PICTURE",
    title: "Know what connects.",
    body: "See the sequence of work, spot dependencies and make room for what comes next.",
  },
  {
    key: "chat",
    eyebrow: "03 / KEEP THE CONTEXT",
    title: "The conversation stays close.",
    body: "Keep team discussions and daily updates alongside the work they belong to.",
  },
  {
    key: "review",
    eyebrow: "04 / CLOSE THE LOOP",
    title: "Turn updates into perspective.",
    body: "See progress across the team. AI summaries and usage controls remain part of the staged rollout.",
  },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function Preview({ kind, first }: { kind: string; first: boolean }) {
  const screens: Record<string, { source: string; alt: string }> = {
    tasks: {
      source: "/screens/ez-tasks-demo.png",
      alt: "E-Z task list with demo project data.",
    },
    timeline: {
      source: "/screens/ez-gantt-demo.png",
      alt: "E-Z Gantt timeline with demo sprint data.",
    },
    chat: {
      source: "/screens/ez-chat-demo.png",
      alt: "E-Z conversation with demo team messages.",
    },
    review: {
      source: "/screens/ez-dashboard-demo.png",
      alt: "E-Z progress dashboard with demo statistics.",
    },
  };
  const screen = screens[kind];
  return (
    <figure className="tour-preview">
      <img
        src={screen.source}
        alt={screen.alt}
        width="1920"
        height="1080"
        loading={first ? "eager" : "lazy"}
        decoding="async"
      />
      <figcaption>
        <span>Demo data · actual application UI</span>
        <a
          href={screen.source}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View full-size screenshot: ${kind} (opens in a new tab)`}
        >
          View full-size screenshot{" "}
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </figcaption>
    </figure>
  );
}

export default function ProductTour() {
  const reducedMotion = useReducedMotion();
  const [instance, setInstance] = useState<SwiperInstance | null>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const previous = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const region = useRef<HTMLElement>(null);
  const activeRef = useRef(0);
  const stop = () => {
    instance?.autoplay?.stop();
    setPlaying(false);
  };
  useEffect(() => {
    if (
      !instance ||
      instance.destroyed ||
      !instance.params.navigation ||
      typeof instance.params.navigation === "boolean"
    )
      return;
    instance.params.navigation.prevEl = previous.current;
    instance.params.navigation.nextEl = next.current;
    instance.navigation.destroy();
    instance.navigation.init();
    instance.navigation.update();
  }, [instance]);
  useEffect(() => {
    if (!instance || instance.destroyed) return;
    instance.slides.forEach((slide, index) => {
      slide.toggleAttribute("inert", index !== active);
      slide.setAttribute("aria-hidden", String(index !== active));
    });
  }, [instance, active]);
  useEffect(() => {
    if (reducedMotion) {
      instance?.autoplay?.stop();
      setPlaying(false);
    }
  }, [reducedMotion, instance]);
  useEffect(() => {
    const pause = () => {
      instance?.autoplay?.stop();
      setPlaying(false);
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", visibility);
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              if (!entry.isIntersecting) pause();
            },
            { threshold: 0.15 },
          )
        : null;
    if (region.current) observer?.observe(region.current);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      observer?.disconnect();
    };
  }, [instance]);
  function togglePlayback() {
    if (!instance || reducedMotion) return;
    if (playing) {
      stop();
      return;
    }
    if (instance.isEnd) instance.slideTo(0, 0);
    instance.autoplay.start();
    setPlaying(true);
  }
  return (
    <main className="product-tour">
      <div className="tour-ambient" aria-hidden="true" />
      <header className="tour-header">
        <a
          className="tour-wordmark"
          href={BRAND.landingPath}
          aria-label="E-Z home"
        >
          <img src="/brand/ez-logo.webp" alt="" width="44" height="48" />
          <span>
            {BRAND.name}
            <small>BY AFK³ SOLUTIONS</small>
          </span>
        </a>
        <nav className="tour-header-actions" aria-label="Primary">
          <a className="tour-contact" href={BRAND.contactURL}>
            Talk to us <ArrowUpRight size={16} />
          </a>
          <a className="tour-login" href={BRAND.loginPath}>
            Log in <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <section className="tour-intro" aria-labelledby="tour-title">
        <p className="tour-kicker">
          <span /> E-Z · IN DEVELOPMENT
        </p>
        <h1 id="tour-title">
          Skip the <span>basic.</span>
        </h1>
        <p className="tour-long-tagline">{BRAND.longTagline}.</p>
        <p className="tour-intro-copy">
          The usual choices are A to D. We start at E.
          <br />
          One place to plan the work, keep the context and see what comes next.
        </p>
        <div className="tour-intro-actions">
          <a
            className="tour-contact tour-contact--primary"
            href={BRAND.contactURL}
          >
            Talk to us <ArrowUpRight size={17} />
          </a>
          <a className="tour-text-link" href="#product-screens">
            See E-Z in action <ArrowRight size={16} />
          </a>
        </div>
      </section>
      <section
        className="tour-carousel"
        id="product-screens"
        ref={region}
        aria-label="Explore the product"
        aria-roledescription="carousel"
        onMouseEnter={stop}
        onFocusCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            stop();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            stop();
            event.key === "ArrowRight"
              ? instance?.slideNext()
              : instance?.slidePrev();
          }
        }}
      >
        <div className="tour-carousel-heading">
          <span>YOUR WORK, FROM E TO Z</span>
          <span className="tour-sample-label">Real screens · demo data</span>
        </div>
        <div className="tour-controls">
          <button
            type="button"
            className="tour-play"
            onClick={togglePlayback}
            disabled={reducedMotion || !instance}
            aria-label={playing ? "Pause tour" : "Play tour"}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            <span>
              {reducedMotion
                ? "Manual tour"
                : playing
                  ? "Pause tour"
                  : "Play tour"}
            </span>
          </button>
          <p
            className="tour-position"
            aria-live={playing ? "off" : "polite"}
            aria-atomic="true"
          >
            <b>{String(active + 1).padStart(2, "0")}</b>
            <span>/ {String(slides.length).padStart(2, "0")}</span>
          </p>
          <div className="tour-arrows">
            <button
              ref={previous}
              type="button"
              aria-label="Previous preview"
              onClick={stop}
              disabled={active === 0}
            >
              <ArrowLeft size={19} />
            </button>
            <button
              ref={next}
              type="button"
              aria-label="Next preview"
              onClick={stop}
              disabled={active === slides.length - 1}
            >
              <ArrowRight size={19} />
            </button>
          </div>
        </div>
        <Swiper
          key={reducedMotion ? "reduced" : "motion"}
          className="tour-swiper"
          modules={[EffectCoverflow, Autoplay, Navigation, Pagination, A11y]}
          effect={reducedMotion ? "slide" : "coverflow"}
          speed={reducedMotion ? 0 : 420}
          initialSlide={activeRef.current}
          slidesPerView={1}
          centeredSlides
          spaceBetween={20}
          loop={false}
          watchOverflow
          breakpoints={{
            768: { slidesPerView: 1.2, spaceBetween: 28 },
            1100: { slidesPerView: 1.55, spaceBetween: 32 },
          }}
          coverflowEffect={{
            rotate: 7,
            depth: 85,
            scale: 0.97,
            stretch: 0,
            modifier: 1,
            slideShadows: false,
          }}
          navigation={{ prevEl: previous.current, nextEl: next.current }}
          pagination={{ clickable: true, bulletElement: "button" }}
          autoplay={{
            enabled: false,
            delay: 6500,
            disableOnInteraction: true,
            pauseOnMouseEnter: false,
            stopOnLastSlide: true,
            waitForTransition: true,
          }}
          a11y={{
            enabled: true,
            containerMessage: "Product workflow previews",
            containerRole: "group",
            itemRoleDescriptionMessage: "slide",
            slideLabelMessage: "{{index}} of {{slidesLength}}",
            prevSlideMessage: "Previous preview",
            nextSlideMessage: "Next preview",
            paginationBulletMessage: "Show preview {{index}}",
            wrapperLiveRegion: false,
          }}
          onBeforeInit={(swiper) => {
            if (
              swiper.params.navigation &&
              typeof swiper.params.navigation !== "boolean"
            ) {
              swiper.params.navigation.prevEl = previous.current;
              swiper.params.navigation.nextEl = next.current;
            }
          }}
          onSwiper={(swiper) => {
            setInstance(swiper);
            swiper.autoplay.stop();
          }}
          onSlideChange={(swiper) => {
            activeRef.current = swiper.activeIndex;
            setActive(swiper.activeIndex);
            if (swiper.activeIndex === slides.length - 1) {
              swiper.autoplay?.stop();
              setPlaying(false);
            }
          }}
          onTouchStart={stop}
          onAutoplayStop={() => setPlaying(false)}
        >
          {slides.map((slide, index) => (
            <SwiperSlide key={slide.key} aria-hidden={index !== active}>
              <article className="tour-slide">
                <Preview kind={slide.key} first={index === 0} />
                <div className="tour-slide-caption">
                  <p>{slide.eyebrow}</p>
                  <h2>{slide.title}</h2>
                  <span>{slide.body}</span>
                </div>
              </article>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>
      <section className="tour-overview" aria-label="Product overview">
        <p>A shared rhythm, from start to finish.</p>
        <ol>
          <li>
            <span>01</span> Plan the work
          </li>
          <li>
            <span>02</span> See the timeline
          </li>
          <li>
            <span>03</span> Stay in conversation
          </li>
          <li>
            <span>04</span> Review together
          </li>
        </ol>
      </section>
      <footer className="tour-footer">
        <div>
          <a className="tour-footer-brand" href={BRAND.productURL}>
            {BRAND.name} <span>by AFK³ Solutions</span>
          </a>
          <p>
            In development. Screens show the actual local application with
            synthetic demo data, not customer data.
            <br />
            Team accounts, AI usage limits and paid plans are in development.
          </p>
        </div>
        <div className="tour-footer-links">
          <a href={BRAND.contactURL}>
            Talk to us <ArrowUpRight size={14} />
          </a>
          <a href={BRAND.loginPath}>
            Log in <ArrowUpRight size={14} />
          </a>
        </div>
      </footer>
    </main>
  );
}
