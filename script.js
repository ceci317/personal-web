const revealTargets = document.querySelectorAll("[data-reveal]");
const menuButton = document.querySelector(".menu-button");
const siteNav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const sections = document.querySelectorAll("section[id]");
const heroRoleCode = document.querySelector("#hero-role-code");
const heroScreen = document.querySelector(".hero-screen");
const heroPointerTrail = document.querySelector("#hero-pointer-trail");
const trailCanvas = document.querySelector("#trail-canvas");
const projectTexts = document.querySelectorAll(".project-text");
const projectVideos = document.querySelectorAll(".project-video");
const slideshowGroups = document.querySelectorAll(".phone-slideshow");
const terminalInput = document.querySelector("#terminal-input");
const terminalOutput = document.querySelector("#terminal-output");
const podcastPlayer = document.querySelector("#podcast-player");
const playerClose = document.querySelector(".player-close");
const medalRain = document.querySelector("#medal-rain");
const contactCardTrigger = document.querySelector("#contact-card-trigger");
const contactCardModal = document.querySelector("#contact-card-modal");
const contactCardClose = document.querySelector(".contact-card-close");
const quotePanel = document.querySelector("#quote");
const quoteLines = document.querySelectorAll(".quote-line[data-quote-text]");
const heroRoleChunks = [
  "> AI PRODUCT BUILDER",
  "> HACKATHON WINNER",
  "> USER-CENTRIC OPERATOR",
];

function syncHomePageState() {
  const hash = window.location.hash.trim();
  const hashPointsHome =
    hash === "" ||
    hash === "#" ||
    hash === "#/" ||
    hash === "#home" ||
    hash === "#/home";
  const nearHeroTop = window.scrollY < window.innerHeight * 0.45;
  const isHomePage = hashPointsHome || nearHeroTop;

  document.body.classList.toggle("is-home-page", isHomePage);
}

syncHomePageState();

window.addEventListener("hashchange", syncHomePageState);
window.addEventListener("routechange", syncHomePageState);
window.addEventListener("aframe:routechange", syncHomePageState);
window.addEventListener("scroll", syncHomePageState, { passive: true });

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );

  revealTargets.forEach((target) => revealObserver.observe(target));

  const navObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const activeId = `#${entry.target.id}`;
        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === activeId);
        });
      });
    },
    { threshold: 0.45 }
  );

  sections.forEach((section) => navObserver.observe(section));

  const projectObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const projectId = entry.target.dataset.project;
        activateProject(projectId);
      });
    },
    {
      rootMargin: "-35% 0px -35% 0px",
      threshold: 0.3,
    }
  );

  projectTexts.forEach((item) => projectObserver.observe(item));

  if (quotePanel && quoteLines.length > 0) {
    let hasAnimatedQuote = false;
    const quoteObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || hasAnimatedQuote) return;
          hasAnimatedQuote = true;
          runQuoteTypewriter();

          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.45 }
    );

    quoteObserver.observe(quotePanel);
  }
} else {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
  renderQuoteLinesImmediately();
}

function activateProject(projectId) {
  projectTexts.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.project === projectId);
  });

  projectVideos.forEach((video) => {
    const isTarget = video.dataset.video === projectId;
    video.classList.toggle("is-visible", isTarget);

    if (!(video instanceof HTMLVideoElement)) return;
    if (isTarget) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}

projectVideos.forEach((media) => {
  media.addEventListener("click", () => {
    if (!media.classList.contains("is-visible")) return;

    const targetLink = media.dataset.link;
    if (!targetLink) return;

    window.open(targetLink, "_blank", "noopener,noreferrer");
  });
});

function getStrongIndexes(pattern = "") {
  const indexes = new Set();
  pattern
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const [startToken, endToken] = segment.split("-");
      const start = Number.parseInt(startToken, 10);
      const end = Number.parseInt(endToken ?? startToken, 10);

      if (!Number.isFinite(start) || !Number.isFinite(end)) return;

      for (let index = start; index <= end; index += 1) {
        indexes.add(index);
      }
    });

  return indexes;
}

function appendQuoteCharacter(line, char, index, strongIndexes) {
  const span = document.createElement("span");
  span.className = "quote-char";

  if (char === " ") {
    span.classList.add("quote-char-space");
    span.innerHTML = "&nbsp;";
  } else {
    span.textContent = char;
  }

  if (strongIndexes.has(index)) {
    span.classList.add("quote-char-strong");
  }

  line.appendChild(span);
}

function renderQuoteLinesImmediately() {
  quoteLines.forEach((line) => {
    const text = line.dataset.quoteText ?? "";
    const strongIndexes = getStrongIndexes(line.dataset.quoteStrong);

    line.textContent = "";
    [...text].forEach((char, index) => {
      appendQuoteCharacter(line, char, index, strongIndexes);
    });
  });
}

function runQuoteTypewriter() {
  quoteLines.forEach((line) => {
    line.textContent = "";
  });

  const lineConfigs = [...quoteLines].map((line) => ({
    line,
    text: [...(line.dataset.quoteText ?? "")],
    strongIndexes: getStrongIndexes(line.dataset.quoteStrong),
  }));

  let lineIndex = 0;
  let charIndex = 0;

  const typeNextChar = () => {
    const currentLine = lineConfigs[lineIndex];
    if (!currentLine) return;

    if (charIndex < currentLine.text.length) {
      appendQuoteCharacter(
        currentLine.line,
        currentLine.text[charIndex],
        charIndex,
        currentLine.strongIndexes
      );
      charIndex += 1;
      window.setTimeout(typeNextChar, 42);
      return;
    }

    lineIndex += 1;
    charIndex = 0;

    if (lineIndex < lineConfigs.length) {
      window.setTimeout(typeNextChar, 180);
    }
  };

  typeNextChar();
}

if (menuButton && siteNav) {
  menuButton.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

if (heroRoleCode) {
  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  const runTypewriterLoop = () => {
    const currentPhrase = heroRoleChunks[phraseIndex];

    heroRoleCode.textContent = currentPhrase.slice(0, charIndex);

    let delay = isDeleting ? 50 : 100;

    if (!isDeleting && charIndex < currentPhrase.length) {
      charIndex += 1;
    } else if (!isDeleting && charIndex === currentPhrase.length) {
      isDeleting = true;
      delay = 2000;
    } else if (isDeleting && charIndex > 0) {
      charIndex -= 1;
    } else {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % heroRoleChunks.length;
      delay = 500;
    }

    window.setTimeout(runTypewriterLoop, delay);
  };

  runTypewriterLoop();
}

if (heroScreen && heroPointerTrail) {
  const moveTrail = (event) => {
    const bounds = heroScreen.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    heroPointerTrail.style.left = `${x}px`;
    heroPointerTrail.style.top = `${y}px`;
    heroScreen.style.setProperty("--hx", `${x}px`);
    heroScreen.style.setProperty("--hy", `${y}px`);
    heroPointerTrail.style.opacity = "1";
  };

  heroScreen.addEventListener("pointermove", moveTrail);
  heroScreen.addEventListener("pointerenter", moveTrail);
  heroScreen.addEventListener("pointerleave", () => {
    heroPointerTrail.style.opacity = "0";
  });

  heroScreen.addEventListener("pointerdown", (event) => {
    const bounds = heroScreen.getBoundingClientRect();
    const pulse = document.createElement("span");
    pulse.className = "hero-pulse";
    pulse.style.left = `${event.clientX - bounds.left}px`;
    pulse.style.top = `${event.clientY - bounds.top}px`;
    heroScreen.appendChild(pulse);
    setTimeout(() => pulse.remove(), 750);
  });
}

if (trailCanvas instanceof HTMLCanvasElement) {
  const context = trailCanvas.getContext("2d");

  if (context) {
    const trailPoints = [];
    let isPointerDown = false;
    let deviceScale = Math.min(window.devicePixelRatio || 1, 2);
    const trailLifetime = 420;
    const maxTrailPoints = 40;

    const resizeTrailCanvas = () => {
      deviceScale = Math.min(window.devicePixelRatio || 1, 2);
      trailCanvas.width = Math.floor(window.innerWidth * deviceScale);
      trailCanvas.height = Math.floor(window.innerHeight * deviceScale);
      trailCanvas.style.width = `${window.innerWidth}px`;
      trailCanvas.style.height = `${window.innerHeight}px`;
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
    };

    const pushTrailPoint = (x, y) => {
      const previous = trailPoints[trailPoints.length - 1];
      const velocity = previous ? Math.hypot(x - previous.x, y - previous.y) : 0;

      trailPoints.push({
        x,
        y,
        createdAt: performance.now(),
        velocity,
      });

      if (trailPoints.length > maxTrailPoints) {
        trailPoints.splice(0, trailPoints.length - maxTrailPoints);
      }
    };

    const handlePointerDown = (event) => {
      if (event.type === "mousedown" && "PointerEvent" in window) return;
      isPointerDown = true;
      trailPoints.length = 0;
      pushTrailPoint(event.clientX, event.clientY);
    };

    const handlePointerMove = (event) => {
      if (event.type === "mousemove" && "PointerEvent" in window) return;
      if (!isPointerDown && event.buttons !== 1) return;

      const previous = trailPoints[trailPoints.length - 1];
      const nextX = event.clientX;
      const nextY = event.clientY;

      if (!previous) {
        pushTrailPoint(nextX, nextY);
        return;
      }

      const distance = Math.hypot(nextX - previous.x, nextY - previous.y);
      const steps = Math.max(1, Math.floor(distance / 10));

      for (let index = 1; index <= steps; index += 1) {
        const progress = index / (steps + 1);
        pushTrailPoint(
          previous.x + (nextX - previous.x) * progress,
          previous.y + (nextY - previous.y) * progress
        );
      }

      pushTrailPoint(nextX, nextY);
    };

    const stopDrawing = () => {
      isPointerDown = false;
    };

    const renderTrail = () => {
      const now = performance.now();

      context.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let index = trailPoints.length - 1; index >= 0; index -= 1) {
        if (now - trailPoints[index].createdAt > trailLifetime) {
          trailPoints.splice(index, 1);
        }
      }

      if (trailPoints.length > 1) {
        for (let index = 1; index < trailPoints.length; index += 1) {
          const previous = trailPoints[index - 1];
          const current = trailPoints[index];
          const progress = index / (trailPoints.length - 1);
          const alphaAge = 1 - (now - current.createdAt) / trailLifetime;
          const speedBoost = Math.min(current.velocity / 18, 1.2);
          const lineWidth = 0.6 + progress * (9 + speedBoost * 3.5);
          const alpha = Math.max(0, alphaAge * (0.16 + progress * 0.92));

          context.strokeStyle = `rgba(245, 255, 74, ${alpha})`;
          context.shadowColor = `rgba(245, 255, 74, ${alpha * 0.8})`;
          context.shadowBlur = 12 + progress * 18;
          context.lineWidth = lineWidth;
          context.beginPath();
          context.moveTo(previous.x, previous.y);
          context.lineTo(current.x, current.y);
          context.stroke();
        }
      }

      requestAnimationFrame(renderTrail);
    };

    resizeTrailCanvas();
    renderTrail();

    window.addEventListener("resize", resizeTrailCanvas);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrawing);
    window.addEventListener("pointercancel", stopDrawing);
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", stopDrawing);
    window.addEventListener("blur", stopDrawing);
  }
}

function openPodcastPlayer() {
  if (!podcastPlayer) return;
  podcastPlayer.hidden = false;
}

function closePodcastPlayer() {
  if (!podcastPlayer) return;
  podcastPlayer.hidden = true;
}

function openContactCard() {
  if (!contactCardModal) return;
  contactCardModal.hidden = false;
}

function closeContactCard() {
  if (!contactCardModal) return;
  contactCardModal.hidden = true;
}

function showMedals() {
  if (!medalRain) return;

  const icons = ["🏸", "🥇", "🥈", "🥉"];

  for (let i = 0; i < 22; i += 1) {
    const drop = document.createElement("span");
    drop.className = "drop";
    drop.textContent = icons[i % icons.length];
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 0.6}s`;
    drop.style.fontSize = `${1.4 + Math.random() * 1.2}rem`;
    medalRain.appendChild(drop);

    setTimeout(() => {
      drop.remove();
    }, 3200);
  }
}

function openManual() {
  window.open("https://my.feishu.cn/wiki/IKRWwpzm4isdi6kFs27cIYvLnqd", "_blank", "noopener,noreferrer");
}

if (terminalInput && terminalOutput) {
  terminalInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    const command = terminalInput.value.trim();

    if (command === "ceci.play_podcast()") {
      terminalOutput.innerHTML = "Launching minimalist player...";
      openPodcastPlayer();
    } else if (command === "ceci.show_medals()") {
      terminalOutput.innerHTML = "Summoning medals and shuttlecocks...";
      showMedals();
    } else if (command === "ceci.open_manual()") {
      terminalOutput.innerHTML = "Opening personal wiki...";
      openManual();
    } else {
      terminalOutput.innerHTML = `Command not found: <code>${command || "empty"}</code>`;
    }

    terminalInput.value = "";
  });
}

playerClose?.addEventListener("click", closePodcastPlayer);
podcastPlayer?.addEventListener("click", (event) => {
  if (event.target === podcastPlayer) {
    closePodcastPlayer();
  }
});

contactCardTrigger?.addEventListener("click", openContactCard);
contactCardClose?.addEventListener("click", closeContactCard);
contactCardModal?.addEventListener("click", (event) => {
  if (event.target === contactCardModal) {
    closeContactCard();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePodcastPlayer();
    closeContactCard();
  }
});

slideshowGroups.forEach((group) => {
  const slides = group.querySelectorAll(".slide");
  if (slides.length <= 1) return;

  let index = 0;
  setInterval(() => {
    slides[index].classList.remove("is-visible");
    index = (index + 1) % slides.length;
    slides[index].classList.add("is-visible");
  }, 1800);
});
