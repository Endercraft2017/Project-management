import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Circle,
  Layers3,
  MessageSquare,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
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
    body: "Bring projects, sprints and the details that matter into one clear view.",
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
    body: "Review progress together. Optional AI summaries are designed around clear usage limits.",
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

function Preview({ kind }: { kind: string }) {
  return (
    <div className={`tour-preview tour-preview--${kind}`} aria-hidden="true">
      <div className="tour-preview-top">
        <span className="tour-preview-dots">
          <i />
          <i />
          <i />
        </span>
        <span>Northstar / Product team</span>
        <span className="tour-avatar">N</span>
      </div>
      <div className="tour-preview-body">
        <aside className="tour-mini-nav">
          <Layers3 size={17} />
          <span />
          <span />
          <span />
          <span />
        </aside>
        <div className="tour-preview-work">
          <div className="tour-preview-heading">
            <span>
              {kind === "chat"
                ? "# product-team"
                : kind === "timeline"
                  ? "Launch timeline"
                  : kind === "review"
                    ? "The week in focus"
                    : "Website refresh"}
            </span>
            <span className="tour-preview-pill">Sample data</span>
          </div>
          {kind === "tasks" && (
            <>
              <div className="tour-tabs">
                <b>All tasks</b>
                <span>Board</span>
                <span>Activity</span>
              </div>
              <div className="tour-task-head">
                <span>THIS SPRINT</span>
                <span>OWNER</span>
              </div>
              {[
                "Map the customer journey",
                "Build the shared components",
                "Review the mobile experience",
                "Prepare the release notes",
              ].map((task, i) => (
                <div className="tour-task" key={task}>
                  {i === 0 ? (
                    <span className="tour-task-done">
                      <Check size={12} />
                    </span>
                  ) : (
                    <Circle size={15} />
                  )}
                  <span>{task}</span>
                  <span className={`tour-person tour-person--${i}`}>
                    {["JL", "AK", "MR", "TS"][i]}
                  </span>
                </div>
              ))}
              <div className="tour-mini-footer">
                <CheckCheck size={14} /> A little more clarity. A little less
                chasing.
              </div>
            </>
          )}
          {kind === "timeline" && (
            <>
              <div className="tour-week">
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
              </div>
              <div className="tour-timeline">
                {[
                  "Discovery",
                  "Design system",
                  "Implementation",
                  "Team review",
                ].map((label, i) => (
                  <div className="tour-timeline-row" key={label}>
                    <span>{label}</span>
                    <div className={`tour-bar tour-bar--${i}`}>
                      {i === 1 ? "In progress" : ""}
                    </div>
                  </div>
                ))}
              </div>
              <div className="tour-timeline-note">
                <span className="tour-status-dot" /> One shared view of what
                comes next
              </div>
            </>
          )}
          {kind === "chat" && (
            <>
              <div className="tour-chat-date">TODAY</div>
              <div className="tour-chat-message">
                <span className="tour-person">AK</span>
                <div>
                  <b>
                    Alex <small>09:41</small>
                  </b>
                  <p>The component previews are ready for a look.</p>
                  <span className="tour-chat-link">
                    <Layers3 size={12} /> Design system review
                  </span>
                </div>
              </div>
              <div className="tour-chat-message">
                <span className="tour-person tour-person--2">MR</span>
                <div>
                  <b>
                    Morgan <small>09:45</small>
                  </b>
                  <p>
                    Great. I’ll check the small-screen flow and leave notes on
                    the task.
                  </p>
                  <span className="tour-reaction">✓ &nbsp; 2</span>
                </div>
              </div>
              <div className="tour-compose">
                A thought, an update, a question…
                <MessageSquare size={15} />
              </div>
            </>
          )}
          {kind === "review" && (
            <>
              <div className="tour-review-title">
                <Sparkles size={17} />
                <span>Weekly summary</span>
                <span className="tour-preview-pill">Concept</span>
              </div>
              <p className="tour-review-copy">
                The team aligned on the customer journey and moved the shared
                components into review.
              </p>
              <div className="tour-review-item">
                <span className="tour-review-mark">
                  <Check size={14} />
                </span>
                <div>
                  <b>What moved forward</b>
                  <span>Design foundations ready for feedback</span>
                </div>
              </div>
              <div className="tour-review-item">
                <span className="tour-review-mark tour-review-mark--mint">
                  <ArrowUpRight size={14} />
                </span>
                <div>
                  <b>What comes next</b>
                  <span>Mobile review and implementation</span>
                </div>
              </div>
              <div className="tour-budget">
                <span>AI is optional. Usage is capped.</span>
                <span className="tour-status-dot" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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
        <a className="tour-wordmark" href="/" aria-label="Back to the app">
          <span className="tour-brand-icon">
            <Layers3 size={20} />
          </span>
          <span>
            WORKSPACE<span className="tour-wordmark-sub">PRODUCT TOUR</span>
          </span>
        </a>
        <a className="tour-open-app" href="/">
          Open the app <ArrowUpRight size={16} />
        </a>
      </header>
      <section className="tour-intro" aria-labelledby="tour-title">
        <p className="tour-kicker">
          <span /> WORK, WITH A LITTLE MORE CLARITY
        </p>
        <h1 id="tour-title">
          Less scattered.
          <br />
          <span>More in sync.</span>
        </h1>
        <p className="tour-intro-copy">
          From the first idea to the next milestone.
          <br className="tour-desktop-break" /> A connected place to plan, talk
          and move work forward.
        </p>
      </section>
      <section
        className="tour-carousel"
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
          <span>ONE CONNECTED WORKDAY</span>
          <span className="tour-sample-label">
            Illustrative previews · sample data
          </span>
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
                <Preview kind={slide.key} />
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
        <p>
          Product preview. Illustrations show sample data, not a live workspace.
          <br />
          AI, accounts and subscription limits depend on configuration and the
          staged rollout.
        </p>
        <a href="/">
          Back to the app <ArrowUpRight size={14} />
        </a>
      </footer>
    </main>
  );
}
