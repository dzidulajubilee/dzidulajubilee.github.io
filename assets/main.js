const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Heimdall-style alert feed. Illustrative data only: addresses come from the
// ranges reserved for documentation (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24).
(function feed() {
  const list = document.getElementById("feed");
  if (!list) return;
  const VISIBLE = 7;

  const pool = [
    [2, "ET POLICY SSH session in progress on Unusual Port", "198.51.100.23"],
    [3, "ET INFO Observed DNS Query to .cloud TLD", "192.0.2.61"],
    [1, "ET SCAN Nmap Scripting Engine User-Agent Detected", "203.0.113.47"],
    [2, "ET DNS Query to a *.top domain - Likely Hostile", "192.0.2.34"],
    [3, "SURICATA STREAM Packet with invalid ack", "198.51.100.8"],
    [1, "ET EXPLOIT Possible Fortinet SSL VPN Path Traversal", "203.0.113.190"],
    [2, "ET POLICY Outbound RDP Connection", "192.0.2.77"],
    [3, "ET INFO Python-requests User-Agent Observed", "192.0.2.15"],
    [2, "ET SCAN Suspicious inbound to MSSQL port 1433", "203.0.113.82"],
    [1, "ET MALWARE Cobalt Strike Beacon Observed", "192.0.2.104"],
    [3, "SURICATA TLS invalid record type", "198.51.100.41"],
    [2, "ET POLICY Modbus TCP Write Single Register", "192.0.2.212"],
  ];
  const statuses = [["new", "New"], ["inv", "Investigating"], ["ack", "Acknowledged"], ["fp", "False positive"]];

  const stamp = (d) => d.toTimeString().slice(0, 8);

  function row([sev, sig, src], time, status, fresh) {
    const li = document.createElement("li");
    li.innerHTML =
      '<span class="t"></span><span class="sev sev-' + sev + '">' + sev + "</span>" +
      '<span class="sig"></span><span class="src"></span><span class="st ' + status[0] + '"></span>';
    li.querySelector(".t").textContent = stamp(time);
    li.querySelector(".sig").textContent = sig;
    li.querySelector(".sig").title = sig;
    li.querySelector(".src").textContent = src;
    li.querySelector(".st").textContent = status[1];
    if (fresh) {
      li.classList.add("fresh");
      if (!reduceMotion) li.classList.add("enter");
      setTimeout(() => li.classList.remove("fresh"), 1400);
    }
    return li;
  }

  const now = Date.now();
  for (let n = 0; n < VISIBLE; n++) {
    const status = n === 0 ? statuses[0] : statuses[1 + (n % 3)];
    list.appendChild(row(pool[(n + 3) % pool.length], new Date(now - (n + 1) * 47000), status, false));
  }

  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    const prev = list.querySelector(".st.new");
    if (prev) { prev.className = "st inv"; prev.textContent = "Investigating"; }
    list.prepend(row(pool[i++ % pool.length], new Date(), statuses[0], true));
    while (list.children.length > VISIBLE) list.lastElementChild.remove();
  }, 3600);
})();

// Carousels: the hero's network designs and the tools slideshow share this
document.querySelectorAll(".carousel").forEach((root) => {
  const slides = [...root.querySelectorAll(".slide")];
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const count = root.querySelector("[data-count]");
  const title = root.querySelector("[data-title]");
  const caption = root.querySelector("p[data-caption]");
  const stage = root.querySelector(".slides-stage");
  const delay = Number(root.dataset.autoplay) || 8000;
  let index = 0;
  let stopped = reduceMotion;
  let paused = false;
  let visible = false;

  function go(n, dir) {
    const next = (n + slides.length) % slides.length;
    if (next === index) return;
    const forward = dir !== undefined ? dir > 0 : next > index;
    slides[index].classList.remove("is-active", "from-left");
    slides[index].setAttribute("aria-hidden", "true");
    const target = slides[next];
    target.classList.toggle("from-left", !forward);
    void target.offsetWidth;
    target.classList.add("is-active");
    target.classList.remove("from-left");
    target.removeAttribute("aria-hidden");
    tabs.forEach((t, k) => t.setAttribute("aria-selected", String(k === next)));
    if (count) count.textContent = String(next + 1).padStart(2, "0");
    if (title && target.dataset.name) title.textContent = target.dataset.name;
    if (caption && target.dataset.caption) caption.textContent = target.dataset.caption;
    index = next;
  }

  const user = (n, dir) => { stopped = true; go(n, dir); };
  root.querySelector("[data-prev]")?.addEventListener("click", () => user(index - 1, -1));
  root.querySelector("[data-next]")?.addEventListener("click", () => user(index + 1, 1));
  tabs.forEach((t, k) => t.addEventListener("click", () => user(k)));
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); user(index + 1, 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); user(index - 1, -1); }
  });

  let x0 = null;
  stage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") x0 = e.clientX; });
  stage.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 48) user(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });

  // Autoplay only while on screen and not being read; stops for good once someone navigates
  root.addEventListener("mouseenter", () => (paused = true));
  root.addEventListener("mouseleave", () => (paused = false));
  root.addEventListener("focusin", () => (paused = true));
  root.addEventListener("focusout", () => (paused = false));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.5 }).observe(root);
  setInterval(() => { if (!stopped && !paused && visible && !document.hidden) go(index + 1, 1); }, delay);
});
