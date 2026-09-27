// ─── FocusFlow Content Script ────────────────────────────
// Runs on Meetup and Luma event pages to parse and capture events

(function () {
  "use strict";

  // Detect which site we're on
  const isMeetup = window.location.hostname.includes("meetup.com");
  const isLuma = window.location.hostname.includes("lu.ma");

  if (!isMeetup && !isLuma) return;

  // ─── Meetup Parser ──────────────────────────────────────

  function parseMeetupEvent() {
    const title =
      document.querySelector("h1")?.textContent?.trim() ||
      document.querySelector('[data-testid="event-title"]')?.textContent?.trim() ||
      "";

    // Try to get date/time from time element or meta tags
    const timeEl = document.querySelector("time[datetime]");
    let startTime = "";
    let endTime = "";

    if (timeEl) {
      startTime = timeEl.getAttribute("datetime") || "";
    }

    // Try structured data
    const ldJson = document.querySelector('script[type="application/ld+json"]');
    if (ldJson) {
      try {
        const data = JSON.parse(ldJson.textContent || "{}");
        if (data.startDate) startTime = data.startDate;
        if (data.endDate) endTime = data.endDate;
        if (data.location?.name && !location) {
          // will be captured below
        }
      } catch {}
    }

    // Fallback: estimate end time as start + 2 hours
    if (startTime && !endTime) {
      const s = new Date(startTime);
      endTime = new Date(s.getTime() + 2 * 60 * 60 * 1000).toISOString();
    }

    // Ensure ISO format
    if (startTime && !startTime.includes("T")) {
      startTime = new Date(startTime).toISOString();
    }
    if (endTime && !endTime.includes("T")) {
      endTime = new Date(endTime).toISOString();
    }

    const locationEl =
      document.querySelector('[data-testid="venue-name-value"]') ||
      document.querySelector(".venue-name") ||
      document.querySelector('[class*="venue"]');
    const eventLocation = locationEl?.textContent?.trim() || "";

    // Description: first paragraph of event details
    const descEl =
      document.querySelector('[data-testid="event-description"]') ||
      document.querySelector(".event-description") ||
      document.querySelector("#event-details");
    const description = descEl
      ? descEl.textContent?.trim().slice(0, 500) || ""
      : "";

    return {
      title,
      description,
      startTime,
      endTime,
      location: eventLocation,
      source: "MEETUP",
      sourceUrl: window.location.href,
    };
  }

  // ─── Luma Parser ────────────────────────────────────────

  function parseLumaEvent() {
    const title =
      document.querySelector("h1")?.textContent?.trim() ||
      document.querySelector('[class*="title"]')?.textContent?.trim() ||
      "";

    let startTime = "";
    let endTime = "";

    // Try structured data first
    const ldJsonEls = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    ldJsonEls.forEach((el) => {
      try {
        const data = JSON.parse(el.textContent || "{}");
        if (data["@type"] === "Event" || data.startDate) {
          if (data.startDate) startTime = data.startDate;
          if (data.endDate) endTime = data.endDate;
        }
      } catch {}
    });

    // Try meta tags
    if (!startTime) {
      const metaStart = document.querySelector('meta[property="event:start_time"]');
      if (metaStart) startTime = metaStart.getAttribute("content") || "";
    }

    // Fallback end time
    if (startTime && !endTime) {
      const s = new Date(startTime);
      endTime = new Date(s.getTime() + 2 * 60 * 60 * 1000).toISOString();
    }

    if (startTime && !startTime.includes("T")) {
      startTime = new Date(startTime).toISOString();
    }
    if (endTime && !endTime.includes("T")) {
      endTime = new Date(endTime).toISOString();
    }

    const locationEl =
      document.querySelector('[class*="location"]') ||
      document.querySelector('[class*="address"]');
    const eventLocation = locationEl?.textContent?.trim() || "";

    const descEl =
      document.querySelector('[class*="desc"]') ||
      document.querySelector('[class*="about"]');
    const description = descEl
      ? descEl.textContent?.trim().slice(0, 500) || ""
      : "";

    return {
      title,
      description,
      startTime,
      endTime,
      location: eventLocation,
      source: "LUMA",
      sourceUrl: window.location.href,
    };
  }

  // ─── Inject Floating Button ─────────────────────────────

  function injectButton() {
    // Don't inject if already present
    if (document.getElementById("focusflow-capture-btn")) return;

    const btn = document.createElement("button");
    btn.id = "focusflow-capture-btn";
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      <span>Add to FocusFlow</span>
    `;

    btn.addEventListener("click", handleCapture);
    document.body.appendChild(btn);
  }

  // ─── Capture Handler ────────────────────────────────────

  async function handleCapture() {
    const btn = document.getElementById("focusflow-capture-btn");
    if (!btn) return;

    // Get stored token
    const storage = await chrome.storage.local.get(["focusflow_token"]);
    const token = storage.focusflow_token;

    if (!token) {
      showToast("Please log in via the FocusFlow extension popup first", "error");
      return;
    }

    // Parse event data
    const eventData = isMeetup ? parseMeetupEvent() : parseLumaEvent();

    if (!eventData.title) {
      showToast("Could not parse event title from this page", "error");
      return;
    }

    if (!eventData.startTime) {
      showToast("Could not parse event date/time from this page", "error");
      return;
    }

    // Update button state
    btn.classList.add("focusflow-loading");
    btn.querySelector("span").textContent = "Adding...";

    try {
      // Get BASE_URL from config (injected via manifest or storage)
      const configStorage = await chrome.storage.local.get(["focusflow_base_url"]);
      const baseUrl = configStorage.focusflow_base_url || "http://localhost:3001";

      const response = await fetch(`${baseUrl}/api/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();

      if (response.status === 201) {
        showToast("✅ Added to FocusFlow", "success");
      } else if (response.status === 409) {
        showToast("ℹ️ Already added", "info");
      } else {
        showToast(`❌ ${data.error || "Failed to add"}`, "error");
      }
    } catch (err) {
      showToast("❌ Failed to connect to FocusFlow", "error");
    } finally {
      btn.classList.remove("focusflow-loading");
      btn.querySelector("span").textContent = "Add to FocusFlow";
    }
  }

  // ─── Toast Notifications ────────────────────────────────

  function showToast(message, type = "info") {
    // Remove existing toast
    const existing = document.getElementById("focusflow-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "focusflow-toast";
    toast.className = `focusflow-toast focusflow-toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.classList.add("focusflow-toast-exit");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ─── Initialize ─────────────────────────────────────────

  // Wait for page to load, then inject
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectButton);
  } else {
    // Small delay to ensure page content is rendered
    setTimeout(injectButton, 1500);
  }
})();
