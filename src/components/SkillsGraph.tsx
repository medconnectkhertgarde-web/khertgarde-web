import { useEffect, useRef } from "react";

import type { PortfolioSkill } from "@/lib/portfolio-skills";

interface SkillsGraphProps {
  skills: PortfolioSkill[];
  loading?: boolean;
}

interface GraphNode {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
}

interface GraphEdge {
  a: number;
  b: number;
}

interface Palette {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  accent: string;
}

const MAX_SKILLS = 30;
const NODE_HEIGHT = 34;
const MIN_NODE_WIDTH = 78;
const MAX_NODE_WIDTH = 190;

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number) {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function buildEdges(count: number) {
  if (count < 2) return [];

  const pairs = new Set<string>();
  const edges: GraphEdge[] = [];

  function add(a: number, b: number) {
    if (a === b) return;
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    const key = `${low}:${high}`;
    if (pairs.has(key)) return;
    pairs.add(key);
    edges.push({ a: low, b: high });
  }

  for (let index = 0; index < count - 1; index += 1) {
    add(index, index + 1);
  }

  if (count > 3) {
    for (let index = 0; index < count; index += 2) {
      add(index, (index * 5 + 3) % count);
    }
  }

  return edges;
}

function getPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const dark = document.documentElement.classList.contains("dark");

  return {
    background: styles.getPropertyValue("--background").trim() || (dark ? "#0d0d0d" : "#faf9f6"),
    foreground: styles.getPropertyValue("--foreground").trim() || (dark ? "#eeeeeb" : "#151515"),
    muted: styles.getPropertyValue("--muted").trim() || (dark ? "#1b1b1b" : "#f0efeb"),
    mutedForeground:
      styles.getPropertyValue("--muted-foreground").trim() || (dark ? "#a7a6a1" : "#6c6b67"),
    border: styles.getPropertyValue("--border").trim() || (dark ? "#3a3a38" : "#d3d1cb"),
    accent: dark ? "#8bbfc0" : "#477e82",
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
}

export function SkillsGraph({ skills, loading = false }: SkillsGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipTitleRef = useRef<HTMLSpanElement | null>(null);
  const tooltipDescriptionRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (loading || !skills.length) return;

    const canvas = canvasRef.current;
    const shell = shellRef.current;
    const tooltip = tooltipRef.current;
    const tooltipTitle = tooltipTitleRef.current;
    const tooltipDescription = tooltipDescriptionRef.current;
    if (!canvas || !shell || !tooltip || !tooltipTitle || !tooltipDescription) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const canvasElement: HTMLCanvasElement = canvas;
    const shellElement: HTMLDivElement = shell;
    const drawingContext: CanvasRenderingContext2D = context;
    const tooltipElement: HTMLDivElement = tooltip;
    const tooltipTitleElement: HTMLSpanElement = tooltipTitle;
    const tooltipDescriptionElement: HTMLParagraphElement = tooltipDescription;

    const visibleSkills = skills.slice(0, MAX_SKILLS);
    let palette = getPalette();
    let nodes: GraphNode[] = [];
    let edges: GraphEdge[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;
    let lastFrame = 0;
    let active = true;
    let inView = true;
    let documentVisible = !document.hidden;
    let hoveredIndex = -1;
    let draggedIndex = -1;
    let pointerId: number | null = null;
    let tooltipHideTimer: number | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function measureNodeWidth(label: string) {
      drawingContext.font = '500 12px "Geist Mono", ui-monospace, monospace';
      return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, drawingContext.measureText(label).width + 28));
    }

    function createNodes(nextWidth: number, nextHeight: number) {
      const centerX = nextWidth / 2;
      const centerY = nextHeight / 2;
      const spreadX = Math.max(80, nextWidth * 0.35);
      const spreadY = Math.max(70, nextHeight * 0.3);

      nodes = visibleSkills.map((skill, index) => {
        const seed = hashString(`${skill.id}:${skill.name}`);
        const angle = seededUnit(seed) * Math.PI * 2;
        const radius = 0.25 + seededUnit(seed ^ 0x9e3779b9) * 0.75;
        const jitterX = (seededUnit(seed ^ 0x85ebca6b) - 0.5) * 36;
        const jitterY = (seededUnit(seed ^ 0xc2b2ae35) - 0.5) * 36;

        return {
          id: skill.id,
          label: skill.name,
          description: skill.description?.trim() || "Description available soon.",
          x: centerX + Math.cos(angle) * spreadX * radius + jitterX,
          y: centerY + Math.sin(angle) * spreadY * radius + jitterY,
          vx: (seededUnit(seed + index + 7) - 0.5) * 0.3,
          vy: (seededUnit(seed + index + 17) - 0.5) * 0.3,
          width: measureNodeWidth(skill.name),
          height: NODE_HEIGHT,
        };
      });

      edges = buildEdges(nodes.length);
    }

    function resize() {
      const rect = shellElement.getBoundingClientRect();
      const nextWidth = Math.max(280, Math.floor(rect.width));
      const nextHeight = Math.max(300, Math.floor(rect.height));
      const previousWidth = width || nextWidth;
      const previousHeight = height || nextHeight;

      width = nextWidth;
      height = nextHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvasElement.width = Math.round(width * dpr);
      canvasElement.height = Math.round(height * dpr);
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!nodes.length) {
        createNodes(width, height);
      } else {
        const scaleX = width / previousWidth;
        const scaleY = height / previousHeight;
        for (const node of nodes) {
          node.x *= scaleX;
          node.y *= scaleY;
          node.width = measureNodeWidth(node.label);
        }
      }

      draw();
    }

    function clampNode(node: GraphNode) {
      const padding = 12;
      const halfWidth = node.width / 2;
      const halfHeight = node.height / 2;
      const minX = padding + halfWidth;
      const maxX = Math.max(minX, width - padding - halfWidth);
      const minY = padding + halfHeight;
      const maxY = Math.max(minY, height - padding - halfHeight);

      if (node.x < minX) {
        node.x = minX;
        node.vx = Math.abs(node.vx) * 0.45;
      } else if (node.x > maxX) {
        node.x = maxX;
        node.vx = -Math.abs(node.vx) * 0.45;
      }

      if (node.y < minY) {
        node.y = minY;
        node.vy = Math.abs(node.vy) * 0.45;
      } else if (node.y > maxY) {
        node.y = maxY;
        node.vy = -Math.abs(node.vy) * 0.45;
      }
    }

    function simulate(time: number) {
      const centerX = width / 2;
      const centerY = height / 2;
      const springTarget = Math.max(105, Math.min(165, width * 0.17));

      for (const edge of edges) {
        const a = nodes[edge.a];
        const b = nodes[edge.b];
        if (!a || !b) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = (distance - springTarget) * 0.00075;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        if (edge.a !== draggedIndex) {
          a.vx += fx;
          a.vy += fy;
        }
        if (edge.b !== draggedIndex) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      for (let first = 0; first < nodes.length; first += 1) {
        const a = nodes[first];
        if (!a) continue;

        for (let second = first + 1; second < nodes.length; second += 1) {
          const b = nodes[second];
          if (!b) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const repelRange = 180;

          if (distance < repelRange) {
            const strength = (1 - distance / repelRange) * 0.055;
            const fx = (dx / distance) * strength;
            const fy = (dy / distance) * strength;

            if (first !== draggedIndex) {
              a.vx -= fx;
              a.vy -= fy;
            }
            if (second !== draggedIndex) {
              b.vx += fx;
              b.vy += fy;
            }
          }

          const overlapX = (a.width + b.width) / 2 + 9 - Math.abs(dx);
          const overlapY = (a.height + b.height) / 2 + 9 - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              const push = overlapX * 0.015 * (dx >= 0 ? 1 : -1);
              if (first !== draggedIndex) a.vx -= push;
              if (second !== draggedIndex) b.vx += push;
            } else {
              const push = overlapY * 0.015 * (dy >= 0 ? 1 : -1);
              if (first !== draggedIndex) a.vy -= push;
              if (second !== draggedIndex) b.vy += push;
            }
          }
        }
      }

      nodes.forEach((node, index) => {
        if (index === draggedIndex) return;

        node.vx += (centerX - node.x) * 0.00012;
        node.vy += (centerY - node.y) * 0.00012;

        if (!reducedMotion.matches) {
          node.vx += Math.sin(time * 0.0005 + index * 1.7) * 0.0015;
          node.vy += Math.cos(time * 0.00045 + index * 1.3) * 0.0015;
        }

        node.vx *= 0.965;
        node.vy *= 0.965;
        node.x += node.vx;
        node.y += node.vy;
        clampNode(node);
      });
    }

    function draw() {
      drawingContext.clearRect(0, 0, width, height);

      drawingContext.save();
      drawingContext.lineWidth = 1;
      drawingContext.strokeStyle = palette.border;
      drawingContext.globalAlpha = 0.58;
      for (const edge of edges) {
        const a = nodes[edge.a];
        const b = nodes[edge.b];
        if (!a || !b) continue;
        drawingContext.beginPath();
        drawingContext.moveTo(a.x, a.y);
        drawingContext.lineTo(b.x, b.y);
        drawingContext.stroke();
      }
      drawingContext.restore();

      nodes.forEach((node, index) => {
        const activeNode = index === hoveredIndex || index === draggedIndex;
        const x = node.x - node.width / 2;
        const y = node.y - node.height / 2;

        drawingContext.save();
        if (activeNode) {
          drawingContext.shadowColor = palette.accent;
          drawingContext.shadowBlur = 14;
        }

        roundedRect(drawingContext, x, y, node.width, node.height, 5);
        drawingContext.fillStyle = activeNode ? palette.foreground : palette.muted;
        drawingContext.fill();
        drawingContext.shadowBlur = 0;
        drawingContext.lineWidth = activeNode ? 1.5 : 1;
        drawingContext.strokeStyle = activeNode ? palette.accent : palette.border;
        drawingContext.stroke();

        const displayLabel = node.label.length > 30 ? `${node.label.slice(0, 29)}…` : node.label;
        drawingContext.fillStyle = activeNode ? palette.background : palette.foreground;
        drawingContext.font = '500 12px "Geist Mono", ui-monospace, monospace';
        drawingContext.textAlign = "center";
        drawingContext.textBaseline = "middle";
        drawingContext.fillText(displayLabel, node.x, node.y);
        drawingContext.restore();
      });
    }

    function clearTooltipTimer() {
      if (tooltipHideTimer !== null) {
        window.clearTimeout(tooltipHideTimer);
        tooltipHideTimer = null;
      }
    }

    function hideTooltip() {
      clearTooltipTimer();
      tooltipElement.classList.remove("is-visible");
      tooltipElement.setAttribute("aria-hidden", "true");
    }

    function showTooltip(index: number, pointerX: number, pointerY: number) {
      const node = nodes[index];
      if (!node) {
        hideTooltip();
        return;
      }

      clearTooltipTimer();
      tooltipTitleElement.textContent = node.label;
      tooltipDescriptionElement.textContent = node.description;
      tooltipElement.setAttribute("aria-hidden", "false");
      tooltipElement.classList.add("is-visible");

      const horizontalPadding = 12;
      const gap = 14;
      tooltipElement.style.maxWidth = `${Math.max(210, Math.min(320, width - horizontalPadding * 2))}px`;

      const tooltipWidth = tooltipElement.offsetWidth;
      const tooltipHeight = tooltipElement.offsetHeight;
      let left = pointerX + gap;
      let top = pointerY - tooltipHeight - gap;

      if (left + tooltipWidth > width - horizontalPadding) {
        left = pointerX - tooltipWidth - gap;
      }
      if (left < horizontalPadding) {
        left = horizontalPadding;
      }
      if (top < horizontalPadding) {
        top = pointerY + gap;
      }
      if (top + tooltipHeight > height - horizontalPadding) {
        top = Math.max(horizontalPadding, height - tooltipHeight - horizontalPadding);
      }

      tooltipElement.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    }

    function scheduleTouchTooltipHide() {
      clearTooltipTimer();
      tooltipHideTimer = window.setTimeout(() => {
        hideTooltip();
      }, 2800);
    }

    function frame(time: number) {
      if (!active) return;

      const fps = width < 620 ? 30 : 45;
      const interval = 1000 / fps;
      const shouldAnimate = inView && documentVisible;

      if (shouldAnimate && time - lastFrame >= interval) {
        lastFrame = time;
        if (!reducedMotion.matches || draggedIndex >= 0) {
          simulate(time);
        }
        draw();
      }

      animationFrame = window.requestAnimationFrame(frame);
    }

    function getPointerPosition(event: PointerEvent) {
      const rect = canvasElement.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function hitTest(x: number, y: number) {
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        if (!node) continue;
        if (
          x >= node.x - node.width / 2 &&
          x <= node.x + node.width / 2 &&
          y >= node.y - node.height / 2 &&
          y <= node.y + node.height / 2
        ) {
          return index;
        }
      }
      return -1;
    }

    function onPointerDown(event: PointerEvent) {
      const point = getPointerPosition(event);
      const index = hitTest(point.x, point.y);
      if (index < 0) {
        hideTooltip();
        return;
      }

      showTooltip(index, point.x, point.y);
      draggedIndex = index;
      pointerId = event.pointerId;
      canvasElement.setPointerCapture(event.pointerId);
      canvasElement.classList.add("is-dragging");
      const node = nodes[index];
      if (node) {
        node.vx = 0;
        node.vy = 0;
        node.x = point.x;
        node.y = point.y;
        clampNode(node);
      }
      draw();
    }

    function onPointerMove(event: PointerEvent) {
      const point = getPointerPosition(event);

      if (draggedIndex >= 0 && pointerId === event.pointerId) {
        const node = nodes[draggedIndex];
        if (node) {
          node.x = point.x;
          node.y = point.y;
          node.vx = 0;
          node.vy = 0;
          clampNode(node);
          showTooltip(draggedIndex, point.x, point.y);
        }
        draw();
        return;
      }

      const nextHover = hitTest(point.x, point.y);
      if (nextHover !== hoveredIndex) {
        hoveredIndex = nextHover;
        canvasElement.classList.toggle("is-hovering", hoveredIndex >= 0);
        draw();
      }

      if (nextHover >= 0) {
        showTooltip(nextHover, point.x, point.y);
      } else if (event.pointerType === "mouse") {
        hideTooltip();
      }
    }

    function releasePointer(event: PointerEvent) {
      if (pointerId !== event.pointerId) return;
      const releasedIndex = draggedIndex;
      draggedIndex = -1;
      pointerId = null;
      canvasElement.classList.remove("is-dragging");
      if (canvasElement.hasPointerCapture(event.pointerId)) {
        canvasElement.releasePointerCapture(event.pointerId);
      }

      if (event.pointerType !== "mouse" && releasedIndex >= 0) {
        scheduleTouchTooltipHide();
      }
      draw();
    }

    function onPointerLeave(event: PointerEvent) {
      if (draggedIndex >= 0) return;
      hoveredIndex = -1;
      canvasElement.classList.remove("is-hovering");
      if (event.pointerType === "mouse") {
        hideTooltip();
      }
      draw();
    }

    function onVisibilityChange() {
      documentVisible = !document.hidden;
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(shellElement);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
      },
      { rootMargin: "120px" },
    );
    intersectionObserver.observe(shellElement);

    const themeObserver = new MutationObserver(() => {
      palette = getPalette();
      draw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedMotionChange = () => draw();
    reducedMotion.addEventListener("change", onReducedMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    canvasElement.addEventListener("pointerdown", onPointerDown);
    canvasElement.addEventListener("pointermove", onPointerMove);
    canvasElement.addEventListener("pointerup", releasePointer);
    canvasElement.addEventListener("pointercancel", releasePointer);
    canvasElement.addEventListener("pointerleave", onPointerLeave);

    resize();
    animationFrame = window.requestAnimationFrame(frame);

    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      clearTooltipTimer();
      reducedMotion.removeEventListener("change", onReducedMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvasElement.removeEventListener("pointerdown", onPointerDown);
      canvasElement.removeEventListener("pointermove", onPointerMove);
      canvasElement.removeEventListener("pointerup", releasePointer);
      canvasElement.removeEventListener("pointercancel", releasePointer);
      canvasElement.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [loading, skills]);

  if (!loading && skills.length === 0) return null;

  return (
    <section id="skills" className="section skills-section" aria-labelledby="skills-heading">
      <div className="section-heading-row skills-heading-row">
        <div>
          <h2 id="skills-heading" className="section-label">
            03 — Skills
          </h2>
          <p className="skills-intro">
            A lightweight interactive map of the technical, research, and service skills I work with.
          </p>
        </div>
        <span className="section-note">Hover · touch · drag</span>
      </div>

      {loading ? (
        <div className="skills-graph-shell skills-graph-skeleton" role="status" aria-live="polite">
          <span className="sr-only">Loading skills</span>
          <span className="skeleton-block skills-skeleton-node skills-skeleton-node-a" />
          <span className="skeleton-block skills-skeleton-node skills-skeleton-node-b" />
          <span className="skeleton-block skills-skeleton-node skills-skeleton-node-c" />
          <span className="skeleton-block skills-skeleton-node skills-skeleton-node-d" />
          <span className="skeleton-block skills-skeleton-node skills-skeleton-node-e" />
        </div>
      ) : (
        <div ref={shellRef} className="skills-graph-shell">
          <canvas
            ref={canvasRef}
            className="skills-graph-canvas"
            aria-label="Interactive skill network. Hover or touch a skill for its description, and drag any labeled skill box to move it."
          />
          <div ref={tooltipRef} className="skills-tooltip" role="tooltip" aria-hidden="true">
            <span ref={tooltipTitleRef} className="skills-tooltip-title" />
            <p ref={tooltipDescriptionRef} className="skills-tooltip-description" />
          </div>
          <div className="skills-graph-hint" aria-hidden="true">
            Hover / touch for details · Drag nodes
          </div>
          <ul className="sr-only">
            {skills.slice(0, MAX_SKILLS).map((skill) => (
              <li key={skill.id}>
                {skill.name}: {skill.description || "Description available soon."}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
